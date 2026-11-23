// rib.mjs : the great ribs of Saltbone Reach (build-rib-a.mjs, build-rib-b.mjs), built in code.
// A rib is one skin drawn over rings along a middle line that stands in the X-Y plane: upright at the waterline, bellied
// a little away from the channel low down, then leaning in over it toward +X (an upright quarter of an ellipse and a
// little more, so the tip droops). Eight-sided, with a keel down its back, every corner pushed a little out of true.
// Origin at the waterline in the middle of the foot; the rib goes on 2.5 m below it. One material, `main`.
// The bone is painted by place (reachmats.py `bone`, from the map geomap.mjs writes): green below the tide, lichen high
// up. So the skin may be cut into columns of the atlas wherever it suits (the foot, which a boat passes close by, gets
// the most pixels) and no seam shows where they meet.
import { Model, strip, emit, add, sub, mul, norm, cross, dot, rad, rng, move, rotY, rotZ, compose, ident } from './kit.mjs';
import { writeGeo } from './geomap.mjs';
import { r3, facing, limpetCone } from './reach-parts.mjs';

const SIDES = 8, DEEP = -2.5, CAP = 0.27;

/**
 * spec: { name, seed, atlas, cols (how many columns of the atlas the skin is cut into: 1 or 2), wide (pixels of a column),
 * high, over (the rib's height and overhang, to its outermost corners; for a broken rib those of the whole rib it was),
 * turn (degrees the middle line turns through), belly, foot (radius at the waterline), tip (radius at the tip),
 * rings (above the water), limpets (cones), painted (limpets in the paint), tide, lichen { lo, hi, amount },
 * broken: { at (height of the middle of the break), top (height of the tallest shard) } }
 */
export const rib = async (spec, args) => {
  const ATLAS = spec.atlas, rnd = rng(spec.seed), B = spec.broken || null;
  const wob = Array.from({ length: 64 }, () => Array.from({ length: SIDES }, () => 1 + 0.085 * (2 * rnd() - 1)));
  const swell = Array.from({ length: 64 }, () => 1 + 0.05 * (2 * rnd() - 1));

  // ---- the middle line above the water, for half-axes a (across) and b (up): [x, y] at close steps, with the length run so far
  const lineOf = (a, b) => {
    const pts = [], N = 600, t1 = rad(spec.turn);
    for (let i = 0; i <= N; i++) { const t = t1 * i / N; pts.push([a * (1 - Math.cos(t)) - spec.belly * Math.sin(Math.PI * Math.min(1, t / rad(58))), b * Math.sin(t)]); }
    const s = [0]; for (let i = 1; i <= N; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, s, L: s[N] };
  };
  const at = (ln, d) => {                                             // the point and the direction at length d along the line
    let i = 1; while (i < ln.s.length - 1 && ln.s[i] < d) i++;
    const f = (d - ln.s[i - 1]) / (ln.s[i] - ln.s[i - 1]), p = [0, 1].map((k) => ln.pts[i - 1][k] + f * (ln.pts[i][k] - ln.pts[i - 1][k]));
    const j0 = Math.max(0, i - 3), j1 = Math.min(ln.pts.length - 1, i + 2); return { p, t: norm([ln.pts[j1][0] - ln.pts[j0][0], ln.pts[j1][1] - ln.pts[j0][1], 0]) };
  };
  const radius = (u) => (spec.foot + (spec.tip - spec.foot) * u ** 1.25 + 0.07 * Math.exp(-((u / 0.05) ** 2)));      // u: 0 at the waterline, 1 at the tip of the whole rib
  /** A ring about a point of the middle line: corner j at angle j/8 of a turn from the channel side, the keel at the back. */
  const ring = (c, t, r, i, squash = 1) => { const n = [t[1], -t[0], 0], b = [0, 0, -1];
    return Array.from({ length: SIDES }, (_, j) => { const a = 2 * Math.PI * j / SIDES, k = wob[i][j] * swell[i] * (1 + 0.10 * Math.max(0, -Math.cos(a)) ** 3); return add([c[0], c[1], 0], add(mul(n, r * k * Math.cos(a)), mul(b, r * k * squash * Math.sin(a)))); }); };

  // ---- rings: two below the water, then along the line, closer together where it bends
  const build = (a, b) => {
    const ln = lineOf(a, b), rings = [], mid = [];
    for (const [y, r] of [[DEEP, radius(0) * 1.16], [-1.15, radius(0) * 1.06]]) { const c = [-0.06 * y, y]; mid.push(c); rings.push(ring(c, [-0.06, 1, 0].map((v) => v / Math.hypot(0.06, 1)), r, rings.length)); }
    const end = B ? (() => { let lo = 0, hi = ln.L; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; (at(ln, m).p[1] < B.at ? (lo = m) : (hi = m)); } return lo; })() : ln.L;
    const bend = (d) => { const e = 0.25, t0 = at(ln, Math.max(0, d - e)).t, t1 = at(ln, Math.min(ln.L, d + e)).t; return Math.acos(Math.min(1, dot(t0, t1))) / (2 * e); };
    const M = 400, wsum = [0]; for (let i = 1; i <= M; i++) wsum.push(wsum[i - 1] + 1 + 9 * bend(end * (i - 0.5) / M));
    for (let k = 0; k <= spec.rings; k++) { const want = wsum[M] * k / spec.rings; let i = 0; while (i < M && wsum[i + 1] < want) i++; const d = end * Math.min(1, (i + (want - wsum[i]) / (wsum[i + 1] - wsum[i] || 1)) / M);
      const q = at(ln, d); mid.push(q.p); rings.push(ring(q.p, q.t, radius(d / ln.L), rings.length, 1 + 0.12 * d / ln.L)); }
    return { ln, rings, mid, end, last: at(ln, end) };
  };
  const tipOf = (q) => add([q.last.p[0], q.last.p[1], 0], mul(q.last.t, CAP));
  const capOf = (q) => { const c = [q.last.p[0], q.last.p[1], 0], c1 = add(c, mul(q.last.t, 0.17)); return q.rings[q.rings.length - 1].map((p) => add(c1, mul(sub(p, c), 0.62))); };      // the smaller ring of a blunt tip
  let a = spec.over, b = spec.high, G = build(a, b);
  if (!B) for (let k = 0; k < 40; k++) { const all = [...G.rings.flat(), ...capOf(G), tipOf(G)], mx = Math.max(...all.map((p) => p[0])), my = Math.max(...all.map((p) => p[1])); a += 0.7 * (spec.over - mx); b += 0.9 * (spec.high - my); G = build(a, b); }      // fitted so that the outermost corners are `over` out and `high` up
  const { rings, mid, last } = G, top = rings.length - 1, cTop = [last.p[0], last.p[1], 0];
  const jag = [0.30, 0.55, 0.36, 0.86, 1.0, 0.45, 0.70, 0.28], shard = (j, k) => add(add(cTop, mul(sub(rings[top][j], cTop), 0.90)), mul(last.t, jag[j] * k));
  const K = B ? (B.top - Math.max(...rings[top].map((p) => p[1]))) / Math.max(...rings[top].map((p, j) => shard(j, 1)[1] - p[1])) : 0;      // how far the shards of a break stand up; the tallest is set to B.top below

  // ---- the atlas: the skin of the rib in one or two columns from the left (the lower rib first, the water's 2.5 m squeezed into the foot of it), the small things in a strip down the right
  const span = []; let run = 0; for (let i = 0; i < mid.length; i++) { if (i) run += Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]); span.push(run); }
  const total = run + (B ? K : CAP), wet = span[2], cut = spec.cols === 2 ? span.findIndex((d) => d - wet >= (total - wet) * 0.42) : top + 1;      // ring 2 stands at the waterline; the skin changes column at ring `cut`
  const W = spec.wide, X = spec.cols * (W + 8) + 4, TALL = B ? ATLAS[1] - 148 : ATLAS[1];      // where the strip of small things begins; a broken rib keeps a band along the bottom for the inside of its break
  const axis = [...mid.map((p) => r3([p[0], p[1], 0])), r3(add(cTop, mul(last.t, B ? K : CAP)))];
  const skin = { mat: 'bone', tile_x: true, axis, tide: { top: spec.tide, limpets: spec.painted }, lichen: spec.lichen, soft: 0 };
  const R = {
    skin0: strip(0, 0, W, TALL, skin, spec.seed), ...(spec.cols === 2 ? { skin1: strip(W + 8, 0, 2 * W + 8, TALL, skin, spec.seed) } : {}),
    limpet: strip(X, 8, X + 96, 104, { mat: 'limpet' }, spec.seed + 1),
    ...(B ? {
      broke: strip(4, TALL + 12, ATLAS[0] - 4, ATLAS[1] - 4, { mat: 'bone', raw: 0.9, cracks: 0, soft: 0 }, spec.seed),
      nest: strip(X - 4, 116, X + 100, 180, { mat: 'gullnest' }, spec.seed + 3),
      egg: strip(X, 192, X + 96, 240, { mat: 'gullegg' }, spec.seed + 4),
      twig: strip(X, 252, X + 96, 276, { mat: 'wood', tone: 'drift', along: 'x', weather: 0.6 }, spec.seed + 5),
    } : {}),
  };
  const end0 = spec.cols === 2 ? span[cut] : total;
  /** The pixel of a place on the skin: d metres along the rib from its foot, j/8 of a turn round it, in column `col`. */
  const px = (col, j, d) => (col ? R.skin1.at(j / SIDES, 0.004 + 0.992 * (d - span[cut]) / (total - span[cut])) : R.skin0.at(j / SIDES, d < wet ? 0.004 + 0.106 * d / wet : 0.11 + 0.886 * (d - wet) / (end0 - wet)));

  const m = new Model(spec.name); m.material('main', { kind: 'texture', roughness: 0.92 });
  const g = m.part('rib', { crease: 40 }), bits = m.part('bits', { crease: 35 });
  const C = (i, j, col) => [rings[i][j % SIDES], px(col, j, span[i]), i < 2 ? 0.8 : 1];
  for (let i = 0; i < top; i++) { const col = i >= cut ? 1 : 0; for (let j = 0; j < SIDES; j++) g.quad(C(i, j, col), C(i, j + 1, col), C(i + 1, j + 1, col), C(i + 1, j, col)); }
  const col = spec.cols - 1;

  if (!B) {                                                           // a blunt tip: one smaller ring, then the point
    const small = capOf(G), apex = tipOf(G);
    const S = (j) => [small[j % SIDES], px(col, j, run + 0.17), 1];
    for (let j = 0; j < SIDES; j++) { g.quad(C(top, j, col), C(top, j + 1, col), S(j + 1), S(j)); g.tri(S(j), S(j + 1), [apex, px(col, j + 0.5, total), 1]); }
  } else {                                                            // the break: a crown of shards about a hollow, a nest in the hollow
    const rim = rings[top].map((p, j) => shard(j, K)), lift = B.top - Math.max(...rim.map((p) => p[1])); rim.forEach((p) => { p[1] += lift; });
    const fc = add(cTop, [0.04, 0.10, 0]), fr = 0.58 * radius(G.end / G.ln.L), floor = Array.from({ length: SIDES }, (_, j) => { const a2 = 2 * Math.PI * j / SIDES; return add(fc, [fr * Math.cos(a2), 0, -fr * Math.sin(a2)]); });
    const Rm = (j) => [rim[j % SIDES], px(col, j, run + jag[j % SIDES] * K), 1];
    const band = (j, t) => R.broke.at(0.01 + 0.98 * j / SIDES, t);                // the inside of the break unrolled: the floor's middle along the bottom of the patch, its edge a quarter of the way up, the shards' tips along the top
    for (let j = 0; j < SIDES; j++) {
      g.quad(C(top, j, col), C(top, j + 1, col), Rm(j + 1), Rm(j));
      g.quad(...facing([[rim[j], band(j, 0.99), 0.9], [rim[(j + 1) % SIDES], band(j + 1, 0.99), 0.9], [floor[(j + 1) % SIDES], band(j + 1, 0.25), 0.62], [floor[j], band(j, 0.25), 0.62]], add(fc, [0, 0.6, 0])));
      g.tri(...facing([[floor[j], band(j, 0.25), 0.62], [floor[(j + 1) % SIDES], band(j + 1, 0.25), 0.62], [fc, band(j + 0.5, 0.01), 0.55]], add(fc, [0, 5, 0])));
    }
    const nr = fr * 0.97, nc = add(fc, [0, 0.01, 0]);
    bits.xf = move(nc);
    bits.lathe([[nr * 0.72, 0], [nr, 0.09], [nr * 0.93, 0.21], [nr * 0.58, 0.12], [0, 0.10]], SIDES, R.nest, { wobble: (i, j) => 1 + 0.10 * (((i * 7 + j * 13) % 5) / 4 - 0.5), shade: (i) => [0.7, 0.95, 1, 0.8, 0.7][i] });
    for (const [a2, l2, up] of [[8, 0.50, 0.16], [84, 0.46, 0.22], [334, 0.40, 0.28], [304, 0.52, 0.12]]) { const d = [Math.cos(rad(a2)), 0, -Math.sin(rad(a2))], from = add([0, 0.15, 0], mul(d, nr * 0.6)); bits.tube([from, add(from, add(mul(d, l2), [0, up, 0]))], [0.022, 0.006], 3, R.twig, { open: true }); }      // sticks out through the gaps between the shards
    bits.xf = ident;
    for (const [ex, ez, turn] of [[-0.09, 0.03, 0.4], [0.08, -0.05, 2.1]]) m.part('egg', { crease: 60, xf: compose(move(add(nc, [ex, 0.165, ez])), rotY(turn), rotZ(rad(82))) }).lathe([[0, -0.085], [0.058, -0.03], [0.046, 0.045], [0, 0.085]], 5, R.egg, { v: [1, 0.72, 0.3, 0] });
  }

  // ---- limpets between the tides: low six-sided cones set into the faces of the skin
  for (let k = 0; k < (spec.limpets || 0); k++) {
    const y = 0.2 + 1.25 * rnd(), j = (k * 3 + Math.floor(rnd() * 2)) % SIDES, fu = 0.34 + 0.32 * rnd(), r = 0.12 + 0.06 * rnd();      // between 0.2 and 1.45 m above the water
    let i = 2; while (mid[i + 1][1] < y) i++;
    const fv = (y - mid[i][1]) / (mid[i + 1][1] - mid[i][1]), p00 = rings[i][j], p01 = rings[i][(j + 1) % SIDES], p10 = rings[i + 1][j], p11 = rings[i + 1][(j + 1) % SIDES];
    const lo = add(p00, mul(sub(p01, p00), fu)), hi = add(p10, mul(sub(p11, p10), fu)), c = add(lo, mul(sub(hi, lo), fv));
    limpetCone(bits, c, norm(cross(sub(p01, p00), sub(p10, p00))), r, R.limpet, rnd() * 6);
  }

  return emit(m, R, ATLAS, args, { size: ATLAS, quality: 88, extra: { ...writeGeo(m, ATLAS, args), axis } });
};
