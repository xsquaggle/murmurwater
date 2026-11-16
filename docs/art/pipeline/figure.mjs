// figure.mjs : pieces for people who are built in code (build-calloway.mjs). A figure is made of skins stretched over
// rings of points (limbs, a trunk, a head), lumps (hair), and the props of kit.mjs, each part bound to the joints of a
// skeleton so that the clips of the generated characters move it.
// Rings: a ring is N points round a centre, counter-clockwise seen from where the skin is going (ring 0 to ring 1 ...),
// which makes the outside of loft() face outward. With the default phase the first point is at the back, so the seam
// of the texture is there: u = 0.25 is her right side, 0.5 the front, 0.75 her left.
import { add, sub, mul, dot, cross, norm, len, lerp, rad, rng } from './kit.mjs';
import { quadToward } from './fish.mjs';

/** A frame for rings: Y along the limb, F toward the front. Points are c + X rx cos a + F rz sin a (a = 90 degrees is the front). */
export const frame = (along, front = [0, 0, 1]) => { const Y = norm(along); const F = norm(sub(front, mul(Y, dot(front, Y)))); return { X: cross(F, Y), Y, F }; };

/**
 * One ring: N points about c in a frame, radii rx (sideways) and rz (front to back; [front, back] for two different ones).
 * pow: 2 = an ellipse, more = squarer. k(a) scales a point's radius (a in radians, 90 degrees = front).
 */
export const ring = (c, fr, rx, rz, N, { pow = 2, phase = -90, k = null } = {}) => {
  const e = 2 / pow, [rf, rb] = Array.isArray(rz) ? rz : [rz, rz], out = [];
  for (let j = 0; j < N; j++) {
    const a = rad(phase) + 2 * Math.PI * j / N, cs = Math.cos(a), sn = Math.sin(a), kk = k ? k(a, j) : 1;
    const px = rx * Math.sign(cs) * Math.abs(cs) ** e * kk, pz = (sn >= 0 ? rf : rb) * Math.sign(sn) * Math.abs(sn) ** e * kk;
    out.push(add(c, add(mul(fr.X, px), mul(fr.F, pz))));
  }
  return out;
};
export const centre = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);

/**
 * A skin over rings (each the same number of points). r: the rectangle, u round the ring and v along the skin (by the
 * distance between ring centres, or opt.v: one 0..1 per ring). opt.closed = false for a strip that does not go all the
 * way round (the points are then a row, u from the first to the last). opt.cap = [start, end]: close an end with a fan.
 * opt.uv(i, j, p) gives a corner's pixel itself; opt.shade(i, j) its shade; opt.u = [from, to] part of the rectangle.
 */
export const loft = (part, rings, r, opt = {}) => {
  const n = rings.length, N = rings[0].length, closed = opt.closed !== false, [u0, u1] = opt.u || [0, 1];
  const cs = rings.map(centre); let L = 0; const acc = [0];
  for (let i = 1; i < n; i++) { L += len(sub(cs[i], cs[i - 1])) || 1e-6; acc.push(L); }
  const V = (i) => (opt.v ? opt.v[i] : acc[i] / (L || 1));
  const C = (i, j) => { const jj = closed ? j % N : j, p = rings[i][jj]; return [p, opt.uv ? opt.uv(i, j, p) : r.at(u0 + (u1 - u0) * j / (closed ? N : N - 1), V(i)), opt.shade ? opt.shade(i, jj) : 1]; };
  const M = closed ? N : N - 1;
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j < M; j++) {
    if (opt.skip && opt.skip(i, j)) continue;
    opt.flip ? part.quad(C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1)) : part.quad(C(i, j), C(i, j + 1), C(i + 1, j + 1), C(i + 1, j));
  }
  const cap = opt.cap || [false, false];
  for (const [i, on, first] of [[0, cap[0], true], [n - 1, cap[1], false]]) if (on) {
    const cp = [typeof on === 'object' ? on : cs[i], opt.uv ? opt.uv(i, -1, cs[i]) : r.at((u0 + u1) / 2, V(i)), opt.shade ? opt.shade(i, 0) : 1];
    for (let j = 0; j < M; j++) (first !== !!opt.flip) ? part.tri(cp, C(i, j + 1), C(i, j)) : part.tri(cp, C(i, j), C(i, j + 1));
  }
  return part;
};

/** A limb: a skin through stations [{ c, rx, rz, pow?, k? }, ...] whose rings stand across the path, their fronts toward `front`. */
export const limb = (part, st, N, r, opt = {}) => {
  const rings = st.map((s, i) => { const a = st[Math.max(0, i - 1)].c, b = st[Math.min(st.length - 1, i + 1)].c; return ring(s.c, frame(s.along || sub(b, a), s.front || opt.front || [0, 0, 1]), s.rx, s.rz ?? s.rx, N, { pow: s.pow ?? opt.pow ?? 2, phase: opt.phase ?? -90, k: s.k }); });
  return loft(part, rings, r, opt);
};

/** A lump: a ball about c with radii [x, y, z], knobbly by `lump` (0 = smooth), its pole along +Y turned by opt.xf. u round it, v pole to pole. */
export const lump = (part, c, radii, r, { lat = 5, lon = 8, lump = 0.2, seed = 1, xf = (p) => p, squash = null } = {}) => {
  const rnd = rng(seed), rings = [], K = Array.from({ length: lat + 1 }, () => Array.from({ length: lon }, () => 1 + lump * (rnd() * 2 - 1)));
  for (let i = 1; i < lat; i++) { const t = Math.PI * (i / lat - 0.5), cy = Math.sin(t), cr = Math.cos(t), row = []; for (let j = 0; j < lon; j++) { const a = -Math.PI / 2 + 2 * Math.PI * j / lon, k = K[i][j]; let p = [-radii[0] * cr * Math.cos(a) * k, radii[1] * cy * k, radii[2] * cr * Math.sin(a) * k]; if (squash) p = squash(p); row.push(add(c, xf(p))); } rings.push(row); }
  const pole = (s) => add(c, xf(squash ? squash([0, s * radii[1], 0]) : [0, s * radii[1], 0]));
  return loft(part, rings, r, { cap: [pole(-1), pole(1)], v: rings.map((_, i) => (i + 1) / lat) });
};

// ---- binding to a skeleton: a bind is a joint's name, or a function of a point giving [[joint, weight], ...]
/** Between two joints along a line: all `a` before the point `at`, all `b` after it, mixed over `width` (metres) along `dir`. */
export const across = (a, b, at, dir, width = 0.06) => { const d = norm(dir); return (p) => { const t = Math.min(1, Math.max(0, dot(sub(p, at), d) / width + 0.5)), s = t * t * (3 - 2 * t); return s <= 0 ? [[a, 1]] : s >= 1 ? [[b, 1]] : [[a, 1 - s], [b, s]]; }; };
/** A chain of binds along a direction: stops [[height, joint], ...]; between two stops the weights run from one joint to the next. */
export const ladder = (stops, axis = 1) => (p) => {
  const h = typeof axis === 'function' ? axis(p) : p[axis]; if (h <= stops[0][0]) return [[stops[0][1], 1]]; const n = stops.length; if (h >= stops[n - 1][0]) return [[stops[n - 1][1], 1]];
  let i = 0; while (h > stops[i + 1][0]) i++; const t = (h - stops[i][0]) / (stops[i + 1][0] - stops[i][0]), s = t * t * (3 - 2 * t);
  return stops[i][1] === stops[i + 1][1] ? [[stops[i][1], 1]] : [[stops[i][1], 1 - s], [stops[i + 1][1], s]];
};
/** Mix two binds by a function of the point (0 = all the first). */
export const blend = (A, B, f) => (p) => { const t = Math.min(1, Math.max(0, f(p))), w = new Map(); const put = (b, k) => { for (const [j, x] of (typeof b === 'string' ? [[b, 1]] : b(p))) w.set(j, (w.get(j) || 0) + x * k); }; if (t < 1) put(A, 1 - t); if (t > 0) put(B, t); return [...w]; };
export { lerp };
const s01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const asW = (b, p) => (typeof b === 'string' ? [[b, 1]] : b(p));
/** Two sets of weights mixed (t = 0: all the first). */
export const mixW = (A, B, t) => { const w = new Map(); for (const [j, x] of A) w.set(j, (w.get(j) || 0) + x * (1 - t)); for (const [j, x] of B) w.set(j, (w.get(j) || 0) + x * t); return [...w].filter(([, x]) => x > 1e-4); };
/**
 * The bind of a limb: `from` is the bind above its first joint, links = [[joint, where it is], ...] down the limb. A point
 * belongs to the last joint it has passed; round each joint the weights change over `width` metres (a number, or one per joint).
 */
export const chain = (from, links, width = 0.06) => {
  const O = links.map(([, o]) => o), n = O.length, dirs = O.map((o, i) => norm(sub(O[Math.min(n - 1, i + 1)], O[Math.max(0, i - 1)])));
  return (p) => {
    let prev = 1; const t = O.map((o, i) => { const v = Math.min(prev, s01(dot(sub(p, o), dirs[i]) / (Array.isArray(width) ? width[i] : width) + 0.5)); prev = v; return v; });
    const out = new Map(), put = (j, x) => { if (x > 1e-4) out.set(j, (out.get(j) || 0) + x); };
    if (t[0] < 1) for (const [j, x] of asW(from, p)) put(j, x * (1 - t[0]));
    links.forEach(([j], i) => put(j, t[i] - (i + 1 < n ? t[i + 1] : 0)));
    return [...out];
  };
};
/** Everything bound as one point is (a hard thing that hangs on something soft). */
export const rigid = (bind, at) => { const w = asW(bind, at); return () => w; };

/**
 * A band along a path, lying on something: pts [{ p, n, w? }] (a point of its middle line, the way its face looks, its
 * width there). The rectangle runs along it: u across, v along. `thick` gives it edges down toward -n; opt.ends closes them.
 */
export const ribbon = (part, pts, w, r, { thick = 0.004, v = null, ends = true, edge = 0.06 } = {}) => {
  const n = pts.length; let L = 0; const acc = [0]; for (let i = 1; i < n; i++) { L += len(sub(pts[i].p, pts[i - 1].p)); acc.push(L); }
  const tan = (i) => norm(sub(pts[Math.min(n - 1, i + 1)].p, pts[Math.max(0, i - 1)].p)), side = pts.map((q, i) => norm(cross(tan(i), q.n)));
  const P = (i, s, d) => add(add(pts[i].p, mul(side[i], s * (pts[i].w ?? w) / 2)), mul(pts[i].n, -d)), T = (i) => (v ? v[i] : acc[i] / (L || 1));
  for (let i = 0; i + 1 < n; i++) {
    quadToward(part, [P(i, -1, 0), r.at(0, T(i))], [P(i, 1, 0), r.at(1, T(i))], [P(i + 1, 1, 0), r.at(1, T(i + 1))], [P(i + 1, -1, 0), r.at(0, T(i + 1))], add(pts[i].n, pts[i + 1].n));
    if (thick) for (const s of [-1, 1]) { const u0 = s < 0 ? 0 : 1, u1 = s < 0 ? edge : 1 - edge; quadToward(part, [P(i, s, 0), r.at(u0, T(i))], [P(i + 1, s, 0), r.at(u0, T(i + 1))], [P(i + 1, s, thick), r.at(u1, T(i + 1))], [P(i, s, thick), r.at(u1, T(i))], mul(add(side[i], side[i + 1]), s)); }
  }
  if (thick && ends) for (const [i, s] of [[0, -1], [n - 1, 1]]) quadToward(part, [P(i, -1, 0), r.at(0, T(i))], [P(i, 1, 0), r.at(1, T(i))], [P(i, 1, thick), r.at(1, T(i) + s * -0.004)], [P(i, -1, thick), r.at(0, T(i) + s * -0.004)], mul(tan(i), s));
  return part;
};

/**
 * A slab that lies on a surface. S(x, y, z) gives a point: x and y along the surface (x to the right seen from outside,
 * y up), z out of it. It covers x0..x1, y0..y1 and stands from z0 to z1; its face is a grid so that it follows the
 * surface. rects: one rectangle, or { front, edge }. inset: how much smaller the face is than the foot, all round.
 */
export const slab = (part, S, [x0, x1], [y0, y1], [z0, z1], rects, { cols = 3, rows = 1, inset = 0, shade = 1 } = {}) => {
  const rf = rects.front || rects, re = rects.edge || rf;
  const P = (i, j, top) => { const k = top ? inset : 0; return S(x0 + k + (x1 - x0 - 2 * k) * i / cols, y0 + k + (y1 - y0 - 2 * k) * j / rows, top ? z1 : z0); };
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) part.quad([P(i, j, 1), rf.at(i / cols, j / rows), shade], [P(i + 1, j, 1), rf.at((i + 1) / cols, j / rows), shade], [P(i + 1, j + 1, 1), rf.at((i + 1) / cols, (j + 1) / rows), shade], [P(i, j + 1, 1), rf.at(i / cols, (j + 1) / rows), shade]);
  for (let i = 0; i < cols; i++) {
    part.quad([P(i, 0, 0), re.at(i / cols, 0)], [P(i + 1, 0, 0), re.at((i + 1) / cols, 0)], [P(i + 1, 0, 1), re.at((i + 1) / cols, 1)], [P(i, 0, 1), re.at(i / cols, 1)]);
    part.quad([P(i, rows, 0), re.at(i / cols, 0)], [P(i, rows, 1), re.at(i / cols, 1)], [P(i + 1, rows, 1), re.at((i + 1) / cols, 1)], [P(i + 1, rows, 0), re.at((i + 1) / cols, 0)]);
  }
  for (let j = 0; j < rows; j++) {
    part.quad([P(0, j, 0), re.at(j / rows, 0)], [P(0, j, 1), re.at(j / rows, 1)], [P(0, j + 1, 1), re.at((j + 1) / rows, 1)], [P(0, j + 1, 0), re.at((j + 1) / rows, 0)]);
    part.quad([P(cols, j, 0), re.at(j / rows, 0)], [P(cols, j + 1, 0), re.at((j + 1) / rows, 0)], [P(cols, j + 1, 1), re.at((j + 1) / rows, 1)], [P(cols, j, 1), re.at(j / rows, 1)]);
  }
  return part;
};
/** Turn the triangles a part got since `from` so that they face away from a point (for an open skin whose winding is not worth working out). */
export const outward = (part, from, centre) => { for (let i = from; i < part.tris.length; i++) { const t = part.tris[i], nrm = cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p)), mid = mul(add(add(t[0].p, t[1].p), t[2].p), 1 / 3); if (dot(nrm, sub(mid, centre)) < 0) part.tris[i] = [t[0], t[2], t[1]]; } return part; };
