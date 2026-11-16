// fish.mjs : fish that are built in code (build-fen-fish.mjs). A fish is a body lofted through cross-sections from its
// lips to the root of its tail, eyes that are domes on its skin, fins that are thin two-faced wedges, and whatever
// else the species carries. It is built 1 unit long about the middle, nose toward +Z, and then fitted so that it is
// exactly 1 m from nose to tail with the middle of its bounds at the origin, as the generated fish are.
// The right side (+X) is built and mirrored, so both sides share one painted skin (fishmats.py).
import { Model, Part, pack, emit, rad, add, sub, mul, norm, cross, dot } from './kit.mjs';

/** A smooth curve through keys [[s, a, b, ...], ...]: curve(keys)(s) -> [a, b, ...] (Catmull-Rom on every column). */
export const curve = (keys) => (s) => {
  const n = keys.length; if (s <= keys[0][0]) return keys[0].slice(1); if (s >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (s > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)], h = k2[0] - k1[0], t = (s - k1[0]) / h;
  return k1.slice(1).map((_, c) => {
    const p1 = k1[c + 1], p2 = k2[c + 1], m1 = i > 0 ? (p2 - k0[c + 1]) / (k2[0] - k0[0]) * h : p2 - p1, m2 = i + 2 < n ? (k3[c + 1] - p1) / (k3[0] - k1[0]) * h : p2 - p1;
    const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
  });
};
const shapeOf = (sh, dflt) => (typeof sh === 'function' ? sh : sh ? ((c) => (t) => c(t)[0])(curve(sh)) : dflt);

/** Run fn(part) for the right side and add its mirror image in X as well. */
export const mirrored = (part, fn) => {
  const tmp = new Part('tmp', { shade: part.shade, xf: part.xf }); fn(tmp);
  for (const t of tmp.tris) { part.tris.push(t); part.tris.push([t[2], t[1], t[0]].map((c) => ({ ...c, p: [-c.p[0], c.p[1], c.p[2]] }))); }
  return part;
};
const nrmOf = (a, b, c) => cross(sub(b[0], a[0]), sub(c[0], a[0]));
/** A triangle or a quad wound so that it faces along `dir`. */
export const triToward = (part, a, b, c, dir) => (dot(nrmOf(a, b, c), dir) >= 0 ? part.tri(a, b, c) : part.tri(a, c, b));
export const quadToward = (part, a, b, c, d, dir) => { const n = add(nrmOf(a, b, c), nrmOf(a, c, d)); return dot(n, dir) >= 0 ? part.quad(a, b, c, d) : part.quad(a, d, c, b); };
/** A transform that puts +Y along `axis` at `at` (for a lathe that points somewhere). */
export const aim = (at, axis, ref = [0, 0, 1]) => { const ey = norm(axis), ex = norm(cross(ey, Math.abs(dot(ey, ref)) > 0.95 ? [1, 0, 0] : ref)), ez = cross(ex, ey); return (p) => add(at, add(add(mul(ex, p[0]), mul(ey, p[1])), mul(ez, p[2]))); };

/**
 * A thin two-faced wedge through a grid of points G[i][j] (i along the root, j from the root to the edge): u runs
 * across the patch with i, v up it with j. It is `thick` at the middle of its root and comes to an edge everywhere else.
 */
export const membrane = (part, G, r, { thick = 0, nrm = null, u = [0, 1] } = {}) => {
  const n = G.length - 1, J = G[0].length - 1;
  const N0 = norm(nrm || cross(sub(G[n][0], G[0][0]), sub(G[Math.round(n / 2)][J], G[0][0])));
  const P = (i, j, side) => add(G[i][j], mul(N0, side * 0.5 * thick * (1 - j / J) * Math.sqrt(Math.sin(Math.PI * i / n))));
  const C = (i, j, side) => [P(i, j, side), r.at(u[0] + (u[1] - u[0]) * i / n, j / J)];
  for (const side of [1, -1]) for (let i = 0; i < n; i++) for (let j = 0; j < J; j++) quadToward(part, C(i, j, side), C(i + 1, j, side), C(i + 1, j + 1, side), C(i, j + 1, side), mul(N0, side));
  return part;
};

/**
 * The body. spec.body: [[s, top, bottom, half width], ...] with s = 0 at the lips and 1 at the root of the tail;
 * spec.len: how much of the fish's length the body takes; spec.mid: where between bottom (0) and top (1) it is widest;
 * spec.pow: 1 = oval sections, less = squarer, more = keeled (a number or a function of s); spec.rings, spec.around:
 * sections along it and faces round half of it; spec.mouth: { open, smile, reach, tilt, tiltReach, depth }.
 */
export const makeBody = (spec) => {
  const f = curve(spec.body), L = spec.len ?? 0.76, mo = spec.mouth || {}, M = spec.around ?? 8, N = spec.rings ?? 20, bias = spec.bias ?? 1.15;
  const fn = (v, d) => (typeof v === 'function' ? v : () => v ?? d), midOf = fn(spec.mid, 0.5), powOf = fn(spec.pow, 1);
  const Z = (s) => 0.5 - s * L;
  const at = (s) => { const [t0, bot, w] = f(s), top = Math.max(t0, bot + 1e-5); return { top, bot, w: Math.max(w, 0), cy: bot + (top - bot) * midOf(s), p: powOf(s) }; };
  /** A point of the skin: s along the body, th round it from the belly line (-90 degrees) over the side (0) to the back line (90). */
  const pt = (s, th) => {
    const { top, bot, w, cy, p } = at(s), c = Math.max(Math.cos(th), 0), sn = Math.sin(th), x = w * Math.pow(c, p);
    let y = cy + (sn >= 0 ? top - cy : cy - bot) * Math.sign(sn) * Math.pow(Math.abs(sn), p), z = Z(s);
    if (mo.smile) { const k = Math.max(0, 1 - s / (mo.reach ?? 0.10)); y += mo.smile * k * k * (w > 1e-6 ? (x / w) ** 2 : 0); }      // the corners of the mouth turn up
    if (mo.tilt) { const k = Math.max(0, 1 - s / (mo.tiltReach ?? 0.12)); z += Math.tan(rad(mo.tilt)) * k * k * (cy - y); }         // tilt > 0: the lower jaw reaches further forward
    return [x, y, z];
  };
  const normal = (s, th) => { const e = 2e-3, a = sub(pt(Math.min(1, s + e), th), pt(Math.max(0, s - e), th)), b = sub(pt(s, th + e), pt(s, th - e)); return norm(cross(a, b)); };
  const ss = Array.from({ length: N + 1 }, (_, k) => Math.pow(k / N, bias)), TH = (j) => -Math.PI / 2 + Math.PI * j / M;
  /** Half the length of a section's outline (belly line to back line), in the model's units. */
  const arc = (s) => { let l = 0, q = pt(s, TH(0)); for (let j = 1; j <= 4 * M; j++) { const p = pt(s, -Math.PI / 2 + Math.PI * j / (4 * M)); l += Math.hypot(p[0] - q[0], p[1] - q[1]); q = p; } return l; };
  const deepest = () => { let best = 0; for (let k = 0; k <= 40; k++) best = Math.max(best, arc(k / 40)); return best; };
  return {
    L, Z, at, pt, normal, arc, M, N, ss, mouth: mo,
    /** For the painter: pixels of v per pixel of u that cover the same distance, for a skin patch w by h pixels. */
    ratio: (w, h) => (L / w) / (deepest() / h),
    /** Where a point of the skin is on the skin patch: [u, v]. */
    uv: (s, deg) => [s, (rad(deg) + Math.PI / 2) / Math.PI],
    skin(part, r) {
      const C = (k, j) => [pt(ss[k], TH(j)), r.at(ss[k], j / M)];
      return mirrored(part, (p) => {
        for (let k = 0; k < N; k++) for (let j = 0; j < M; j++) p.quad(C(k, j), C(k + 1, j), C(k + 1, j + 1), C(k, j + 1));
        const e = at(1); if (e.w > 2e-3) { const c = [[0, e.cy, Z(1) - 0.4 * e.w], r.at(1, 0.5)]; for (let j = 0; j < M; j++) triToward(p, c, C(N, j), C(N, j + 1), [0, 0, -1]); }       // close the root of the tail
        const o = at(0); if (o.w > 1e-4 && !mo.open) { const c = [[0, o.cy, Z(0) + 0.5 * o.w], r.at(0, 0.5)]; for (let j = 0; j < M; j++) triToward(p, c, C(0, j), C(0, j + 1), [0, 0, 1]); }   // close a shut mouth
      });
    },
    /** The inside of an open mouth: from the lips back and inward to the throat. */
    maw(part, r) {
      const o = at(0), ctr = [0, o.cy, Z(0)], depth = mo.depth ?? 0.05, hh = Math.max(o.top - o.cy, o.cy - o.bot) + Math.abs(mo.smile || 0);
      const rings = [[1, 0], [0.84, 0.3 * depth], [0.5, depth], [0, 1.15 * depth]];
      const C = (k, j) => { const q = pt(0, TH(j)), [sc, back] = rings[k], p = [q[0] * sc, ctr[1] + (q[1] - ctr[1]) * sc, q[2] - back]; return [p, r.at(0.5 + 0.48 * p[0] / (o.w || 1), 0.5 + 0.48 * (p[1] - ctr[1]) / hh)]; };
      return mirrored(part, (p) => { for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < M; j++) { const mid = mul(add(C(k, j)[0], C(k + 1, j + 1)[0]), 0.5), dir = sub([0, ctr[1], Z(0) + 0.3], mid); quadToward(p, C(k, j), C(k, j + 1), C(k + 1, j + 1), C(k + 1, j), dir); } });
    },
  };
};

/** An eye: a dome on the skin at (s, a degrees above the side), `size` in radius, both sides. look turns it from square to the skin toward `toward`. */
export const eyeDome = (part, r, B, { s, a, size = 0.045, bulge = 0.6, look = 0.4, toward = [1, 0.15, 0.3], sides = 10, sink = 0.3 }) => mirrored(part, (p) => {
  const th = rad(a), P0 = B.pt(s, th), n = B.normal(s, th), d = norm(add(mul(n, 1 - look), mul(norm(toward), look)));
  const eu = norm(cross([0, 1, 0], d)), ev = cross(d, eu), C0 = sub(P0, mul(d, sink * bulge * size));          // eu: toward the tail, ev: up
  const rings = [[1, 0], [0.8, 0.6], [0.45, 0.893], [0, 1]];
  const V = (k, j) => { const [rho, h] = rings[k], ang = 2 * Math.PI * (j % sides) / sides; return [add(C0, add(add(mul(eu, rho * size * Math.cos(ang)), mul(ev, rho * size * Math.sin(ang))), mul(d, h * bulge * size))), r.at(0.5 + 0.48 * rho * Math.cos(ang), 0.5 + 0.48 * rho * Math.sin(ang))]; };
  for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < sides; j++) { if (rings[k + 1][0] === 0) p.tri(V(k, j), V(k, j + 1), V(k + 1, 0)); else p.quad(V(k, j), V(k, j + 1), V(k + 1, j + 1), V(k + 1, j)); }
});

/** A fin along the back (or the belly): from s = from to s = to, `h` high at shape = 1, its rays leaning back by `sweep`. Every ray stands a little proud of the web between (spike). */
export const ridgeFin = (part, r, B, { from, to, h, rays = 6, spike = 0.25, sweep = 0.5, shape, belly = false, sink = 0.012, thick = 0.014, ripple = 0.004, curl = 0 }) => {
  const n = rays * 2, sh = shapeOf(shape, (t) => Math.sin(Math.PI * (0.12 + 0.76 * t)) ** 0.7), sg = belly ? -1 : 1, G = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = from + (to - from) * t, c = B.at(s), y0 = belly ? c.bot + sink : c.top - sink, hh = h * sh(t) * (i % 2 ? 1 - spike : 1), x = (i % 2 ? -1 : 1) * ripple;
    G.push([[0, y0, B.Z(s)], [x * 0.5, y0 + sg * hh * 0.55, B.Z(s) - sweep * hh * 0.5 * (1 - curl)], [x, y0 + sg * hh, B.Z(s) - sweep * hh]]);
  }
  return membrane(part, G, r, { thick, nrm: [1, 0, 0] });
};

/** The tail fin: a fan from the root of the tail. fork > 0 notches it, fork < 0 rounds it; lobes = [lower, upper] lengths. */
export const tailFin = (part, r, B, { len = 0.24, spread = 38, fork = 0.3, rays = 7, spike = 0.15, lobes = [1, 1], shape, thick = 0.016, ripple = 0.004, inset = 0.025, rootK = 0.92, droop = 0 }) => {
  const n = rays * 2, e = B.at(1), zc = B.Z(1) + inset, sh = shapeOf(shape, null), G = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, q = 2 * t - 1, phi = rad(spread) * q + rad(droop), lobe = (sh ? sh(t) : 1 - fork * (1 - Math.abs(q) ** 1.4)) * (q < 0 ? lobes[0] : lobes[1]);
    const Lr = len * lobe * (i % 2 ? 1 - spike : 1), yr = e.cy + q * rootK * (q > 0 ? e.top - e.cy : e.cy - e.bot), x = (i % 2 ? -1 : 1) * ripple;
    G.push([[0, yr, zc], [x * 0.5, yr + 0.5 * Lr * Math.sin(phi), zc - 0.5 * Lr * Math.cos(phi)], [x, yr + Lr * Math.sin(phi), zc - Lr * Math.cos(phi)]]);
  }
  return membrane(part, G, r, { thick, nrm: [1, 0, 0] });
};

/**
 * A paired fin (both sides): a fan rooted on the skin at (s, a degrees), `len` long along `dir` (for the right side),
 * opening `fan` degrees either way in the plane of `dir` and `up`; `root` is the width of its root. rows: sections along it.
 */
export const sideFin = (part, r, B, { s, a, len, fan = 35, root = 0.05, dir, up = [0, 1, 0], rays = 5, spike = 0.15, shape, sink = 0.012, thick = 0.008, ripple = 0.003, cup = 0, bow = 0, rows = 2 }) => mirrored(part, (p) => {
  const th = rad(a), P0 = sub(B.pt(s, th), mul(B.normal(s, th), sink)), d = norm(dir), ac = norm(sub(up, mul(d, dot(up, d)))), nrm = norm(cross(d, ac));
  const n = rays * 2, sh = shapeOf(shape, (t) => 1 - 0.35 * (2 * t - 1) ** 2), G = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, q = 2 * t - 1, phi = rad(fan) * q, Lr = len * sh(t) * (i % 2 ? 1 - spike : 1), rp = add(P0, mul(ac, q * root / 2)), ray = add(mul(d, Math.cos(phi)), mul(ac, Math.sin(phi)));
    const off = (k) => mul(nrm, (i % 2 ? -1 : 1) * ripple * k + cup * k * k * (1 - q * q) * len + bow * k * k * len);      // cup: hollowed like a hand; bow: the whole fin curves out of its plane
    G.push(Array.from({ length: rows + 1 }, (_, j) => (j ? add(add(rp, mul(ray, Lr * j / rows)), off(j / rows)) : rp)));
  }
  membrane(p, G, r, { thick, nrm });
});

/** Fit the model: 1 m from nose to tail, the middle of its bounds at the origin. */
const fit = (m, originY = null) => {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of m.parts) for (const t of p.tris) for (const c of t) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], c.p[q]); hi[q] = Math.max(hi[q], c.p[q]); }
  const k = 1 / (hi[2] - lo[2]), mid = [0, originY ?? (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];      // originY: a height (as built) to put at the origin instead, for a fish with something long hanging from it
  for (const p of m.parts) for (const t of p.tris) for (const c of t) c.p = c.p.map((v, q) => (v - mid[q]) * k);
  return { k, mid };
};

/**
 * Build a fish from its spec and write what the command line asked for. spec: { name, atlas, body..., rects(B): what
 * pack() lays out (a skin `side`, an `eye`, a `maw` if the mouth is open, a patch for every fin), eyes: [..], fins:
 * [{ kind: 'ridge' | 'tail' | 'side', rect, ... }], more({ m, B, R, body, eyes, fins, bits }): the rest, glow: true if
 * something is painted into the glow map, roughness }.
 */
export const buildFish = async (spec, args) => {
  const ATLAS = spec.atlas || [1024, 512], B = makeBody(spec), R = pack(...ATLAS, spec.rects(B), spec.pad ?? 8);
  const m = new Model(spec.name);
  m.material('main', { kind: 'texture', roughness: spec.roughness ?? 0.7, ...(spec.glow ? { emissive: [1, 1, 1], glow: true } : {}) });
  const body = m.part('body', { crease: 75 }), eyes = m.part('eyes', { crease: 80 }), fins = m.part('fins', { crease: 35 }), bits = m.part('bits', { crease: 60 });
  B.skin(body, R.side); if (B.mouth.open) B.maw(body, R.maw);
  for (const e of spec.eyes || []) eyeDome(eyes, R[e.rect || 'eye'], B, e);
  const FIN = { ridge: ridgeFin, tail: tailFin, side: sideFin };
  for (const f of spec.fins || []) FIN[f.kind](fins, R[f.rect], B, f);
  if (spec.more) spec.more({ m, B, R, body, eyes, fins, bits });
  const fitted = fit(m, spec.originY ?? null);
  return emit(m, R, ATLAS, args, { glowSize: spec.glowSize || null, extra: { fit: fitted } });
};
