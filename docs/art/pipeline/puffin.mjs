// puffin.mjs : the lines of the sloop Puffin and the pieces of her hull, shared by build-puffin.mjs (afloat) and
// build-puffin-wreck.mjs (as she is found). Metres. Origin on the centre line, half way along her, at the waterline;
// bow toward +Z, port is +X. She is 5.4 m long, 2.0 m in the beam and draws 0.6 m.
// A section is a superellipse from the bottom of the body on the centre line (yb) to the sheer (B out, S up): fullness
// 2 is an ellipse, more is squarer (a firm bilge and plumb topsides), less is a V. The keel and stem are a slab under it.
import { add, sub, mul, norm, cross, dot } from './kit.mjs';
import { curve, mirrored, quadToward, triToward } from './fish.mjs';

export const ZT = -2.42, ZB = 2.70;            // the transom's outer face; the stem's forward face at its head
export const MAST_Z = 0.515, CHAIN_Z = 0.35;        // the mast stands on the bridge deck; the shrouds come down to the rail a little aft of it
export const KW = 0.05;                        // half the thickness of keel and stem
export const WL = [-0.04, 0.07];               // the boot-top: from just under the water to a hand's breadth above it
export const STRAKE = 0.11, SKIN = 0.04;       // depth of the sheer strake; planking and ceiling together
export const SOLE = -0.25, SEAT = SOLE + 0.465, LIP = 0.035;      // cockpit sole, bench tops, thickness of a bench top
export const BENCH = 0.47, BENCH_Z = [-1.44, -0.55];              // inner edge of the side benches; where they run from and to
export const DECK_Z = 0.37, CUDDY_Z = [0.66, 1.92];               // the deck's aft edge (the bulkhead); the cuddy
export const NOTCH = [0.10, 0.20];                               // the tiller's notch in the transom: half width, depth

// z -> [half breadth at the sheer, sheer height, bottom of the body on the centre line, fullness]
const LINES = curve([
  [-2.42, 0.760, 0.680, -0.14, 2.7], [-2.10, 0.860, 0.645, -0.24, 2.8], [-1.70, 0.930, 0.610, -0.33, 2.9], [-1.30, 0.965, 0.580, -0.39, 3.0],
  [-0.90, 0.980, 0.560, -0.42, 3.0], [-0.50, 0.985, 0.550, -0.43, 3.0], [-0.10, 0.985, 0.550, -0.43, 3.0], [0.30, 0.970, 0.560, -0.42, 2.9],
  [0.70, 0.930, 0.585, -0.40, 2.7], [1.10, 0.860, 0.620, -0.36, 2.4], [1.50, 0.750, 0.670, -0.30, 2.1], [1.85, 0.610, 0.730, -0.22, 1.8],
  [2.15, 0.450, 0.800, -0.13, 1.6], [2.40, 0.280, 0.870, -0.04, 1.45], [2.50, 0.200, 0.900, 0.02, 1.4],
]);
export const STATIONS = [-2.42, -2.10, -1.70, -1.30, -0.90, -0.50, -0.10, 0.30, 0.70, 1.10, 1.50, 1.85, 2.15, 2.40, 2.50];
export const BEAM = 0.985;                     // the half breadths below are of a hull 2 cm fuller; this brings rail and rubbing strake inside 2.0 m
export const lines = (z) => { const [B, S, yb, n] = LINES(z); return { B: B * BEAM, S, yb, n }; };
/** Half breadth of the outside of the planking at height y in the section at z. */
export const half = (z, y) => { const { B, S, yb, n } = lines(z); if (y >= S) return B; if (y <= yb) return KW; const phi = Math.acos(Math.min(1, Math.pow((S - y) / (S - yb), n / 2))); return KW + (B - KW) * Math.pow(Math.sin(phi), 2 / n); };
/** The inside of the ceiling at height y in the section at z. */
export const inside = (z, y) => Math.max(0, half(z, y) - SKIN);

// the keel's bottom by z, and the stem's forward face by y (it is cut away under water and nearly plumb above it)
const KEEL = curve([[-2.42, -0.60], [1.20, -0.60], [1.50, -0.585], [1.80, -0.55], [2.05, -0.48], [2.25, -0.38]]);
const STEM = curve([[-0.38, 2.25], [-0.26, 2.42], [-0.15, 2.52], [-0.02, 2.59], [0.10, 2.63], [0.28, 2.66], [0.45, 2.68], [0.75, 2.70], [1.00, 2.70]]);
export const keelY = (z) => KEEL(z)[0], stemZ = (y) => STEM(y)[0];
export const STEM_TOP = 0.99, RAB = 0.07;        // the stem head; how far aft of the stem's face the planking ends

/** The nine points of half a section, keel to sheer: five on the bottom, the two edges of the boot-top, the middle of the topsides, the foot of the sheer strake, the sheer. Each is [x, y, z]. */
export const ringAt = (z) => {
  const { B, S, yb, n } = lines(z), lo = Math.max(yb, WL[0]), hi = Math.max(lo, WL[1]);
  const phiOf = (y) => Math.acos(Math.min(1, Math.pow((S - y) / (S - yb), n / 2))), pt = (phi) => [KW + (B - KW) * Math.pow(Math.sin(phi), 2 / n), S - (S - yb) * Math.pow(Math.cos(phi), 2 / n), z];
  const pl = phiOf(lo), out = [0, 0.3, 0.56, 0.8, 1].map((k) => pt(pl * k)); out[4][1] = lo;
  for (const y of [hi, (hi + S - STRAKE) / 2, S - STRAKE]) out.push([half(z, y), y, z]); out.push([B, S, z]); return out;
};
/** The same nine points where the planking meets the stem. */
export const STEM_RING = (() => { const S = 0.955, yb = 0.05, x = KW + 0.006, at = (y) => [x, y, stemZ(y) - RAB]; return [at(yb), at(yb), at(yb), at(yb), at(yb), at(WL[1]), at((WL[1] + S - STRAKE) / 2), at(S - STRAKE), at(S)]; })();
export const RINGS = [...STATIONS.map(ringAt), STEM_RING];
const BANDS = [['bottom', 0, 4, [0, 0.25, 0.5, 0.75, 1]], ['boot', 4, 5, [0, 1]], ['topsides', 5, 7, [0, 0.5, 1]], ['sheer', 7, 8, [0, 1]]];
const U = (z) => (z - ZT) / (ZB - ZT);

/** The planking, both sides: R.bottom, R.boot, R.topsides and R.sheer run the length of her, stern at the left. skip(i, band) leaves a plank out (a sprung plank in a wreck). */
export const shell = (part, R, { skip = null } = {}) => mirrored(part, (p) => {
  for (let i = 0; i + 1 < RINGS.length; i++) for (const [name, a, b, vs] of BANDS) for (let k = a; k < b; k++) {
    if (skip && skip(i, name, k - a)) continue;
    const A = RINGS[i], Bq = RINGS[i + 1], r = R[name], c = (ring, j) => [ring[j], r.at(U(ring[j][2]), vs[j - a])];
    quadToward(p, c(A, k), c(Bq, k), c(Bq, k + 1), c(A, k + 1), [1, 0.15, 0]);
  }
});

/** A rubbing strake along the foot of the sheer strake: a bead that stands 2.5 cm out. */
export const rubrail = (part, r) => mirrored(part, (p) => {
  const pts = RINGS.map((ring) => ring[7]);
  for (let i = 0; i + 1 < pts.length; i++) { const [a, b] = [pts[i], pts[i + 1]], o = (q, dx, dy) => [q[0] + dx, q[1] + dy, q[2]];
    quadToward(p, [o(a, 0.026, 0), r.at(U(a[2]), 0.5)], [o(b, 0.026, 0), r.at(U(b[2]), 0.5)], [o(b, 0, 0.028), r.at(U(b[2]), 1)], [o(a, 0, 0.028), r.at(U(a[2]), 1)], [1, 1, 0]);
    quadToward(p, [o(a, 0, -0.028), r.at(U(a[2]), 0)], [o(b, 0, -0.028), r.at(U(b[2]), 0)], [o(b, 0.026, 0), r.at(U(b[2]), 0.5)], [o(a, 0.026, 0), r.at(U(a[2]), 0.5)], [1, -1, 0]); }
});

/** The rail on top of the sheer: 10 cm wide, standing 3 cm above it; it ends on the transom and at the stem. */
export const RAIL = { out: 0.02, in: 0.10, up: 0.04, down: 0.025 };
export const rail = (part, r) => mirrored(part, (p) => {
  const sec = RINGS.map((ring) => { const [x, y, z] = ring[8], xi = Math.max(0.012, x - RAIL.in); return { ot: [x + RAIL.out, y + RAIL.up, z], it: [xi, y + RAIL.up, z], ob: [x + RAIL.out, y - RAIL.down, z], ib: [xi, y - RAIL.down, z], is: [Math.max(0.012, x - SKIN), y - RAIL.down, z] }; });
  for (let i = 0; i + 1 < sec.length; i++) { const a = sec[i], b = sec[i + 1], ua = U(a.ot[2]), ub = U(b.ot[2]);
    quadToward(p, [a.ob, r.at(ua, 0)], [b.ob, r.at(ub, 0)], [b.ot, r.at(ub, 0.28)], [a.ot, r.at(ua, 0.28)], [1, 0, 0]);
    quadToward(p, [a.ot, r.at(ua, 0.28)], [b.ot, r.at(ub, 0.28)], [b.it, r.at(ub, 0.78)], [a.it, r.at(ua, 0.78)], [0, 1, 0]);
    quadToward(p, [a.it, r.at(ua, 0.78)], [b.it, r.at(ub, 0.78)], [b.ib, r.at(ub, 1)], [a.ib, r.at(ua, 1)], [-1, 0, 0]);
    quadToward(p, [a.ib, r.at(ua, 0.9), 0.7], [b.ib, r.at(ub, 0.9), 0.7], [b.is, r.at(ub, 1), 0.7], [a.is, r.at(ua, 1), 0.7], [0, -1, 0]); }
  const a = sec[0]; quadToward(p, [a.ob, r.at(0, 0)], [a.ot, r.at(0, 0.28)], [a.it, r.at(0.01, 0.28)], [a.ib, r.at(0.01, 0)], [0, 0, -1]);
});

/** The keel, the forefoot and the stem as one slab. R.keel is its part under the body, R.stem the forefoot and stem seen from the side: x of the rectangle is z from 2.0 to 2.72, y is height from -0.5 to 1.02. */
export const STEM_BOX = { z0: 2.0, z1: 2.72, y0: -0.5, y1: 1.02 };
export const backbone = (part, R) => {
  const w = KW + 0.006, K = [-2.42, -1.6, -0.8, 0, 0.6, 1.2, 1.5, 1.8, 2.05, 2.25].map((z) => ({ o: [z, keelY(z)], n: [z, lines(Math.min(z, 2.5)).yb + 0.035], keel: true }));
  const T = [-0.26, -0.15, -0.02, 0.10, 0.28, 0.45, 0.62, 0.80, STEM_TOP].map((y) => ({ o: [stemZ(y), y], n: [stemZ(y) - (y < 0 ? 0.20 : 0.15), y + (y < 0.1 ? 0.10 : 0)] }));
  const P = [...K, ...T], at = (q, x) => [x, q[1], q[0]];
  const uv = (s, q, edge) => { if (s.keel) return R.keel.at((q[0] - ZT) / (2.3 - ZT), edge ? 0.02 : (q[1] + 0.62) / 0.6); return R.stem.at(edge ? 0.97 : (q[0] - STEM_BOX.z0) / (STEM_BOX.z1 - STEM_BOX.z0), (q[1] - STEM_BOX.y0) / (STEM_BOX.y1 - STEM_BOX.y0)); };
  for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1], s = b.keel ? a : b;
    for (const sx of [1, -1]) quadToward(part, [at(a.o, sx * w), uv(s, a.o)], [at(b.o, sx * w), uv(s, b.o)], [at(b.n, sx * w), uv(s, b.n)], [at(a.n, sx * w), uv(s, a.n)], [sx, 0, 0]);
    const d = sub(at(b.o, 0), at(a.o, 0)), out = norm([0, -d[2], d[1]]);                                    // under the keel, in front of the stem
    quadToward(part, [at(a.o, -w), uv(s, a.o, true)], [at(a.o, w), uv(s, a.o, true)], [at(b.o, w), uv(s, b.o, true)], [at(b.o, -w), uv(s, b.o, true)], out);
    if (!s.keel && b.o[1] > 0.5) quadToward(part, [at(a.n, -w), uv(s, a.n, true)], [at(a.n, w), uv(s, a.n, true)], [at(b.n, w), uv(s, b.n, true)], [at(b.n, -w), uv(s, b.n, true)], [0, 0, -1]); }
  const a = P[0], e = P[P.length - 1];
  quadToward(part, [at(a.o, -w), uv(a, a.o, true)], [at(a.o, w), uv(a, a.o, true)], [at(a.n, w), uv(a, a.n, true)], [at(a.n, -w), uv(a, a.n, true)], [0, 0, -1]);
  quadToward(part, [at(e.o, -w), uv(e, e.o)], [at(e.o, w), uv(e, e.o)], [at(e.n, w), uv(e, e.n)], [at(e.n, -w), uv(e, e.n)], [0, 1, 0]);
  return part;
};

/** The transom: R.out is its outer face (x from port at the left to starboard, 1.64 m across; y from -0.18 to 0.70), R.in its inner face, R.cap its top edge. */
export const TRANSOM = { hw: 0.82, y0: -0.18, y1: 0.70, thick: 0.05 };
export const transom = (part, R) => {
  const ring = RINGS[0], S = ring[8][1], [nw, nd] = NOTCH, top = [[ring[8][0], S], [nw + 0.02, S], [nw, S - nd], [0, S - nd]];
  const halfOutline = [...ring.map(([x, y]) => [x, y]), ...top.slice(1)], outline = [...halfOutline, ...halfOutline.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  const uvo = ([x, y]) => R.out.at(0.5 - x / (2 * TRANSOM.hw), (y - TRANSOM.y0) / (TRANSOM.y1 - TRANSOM.y0)), uvi = ([x, y]) => R.in.at(0.5 + x / (2 * TRANSOM.hw), (y - TRANSOM.y0) / (TRANSOM.y1 - TRANSOM.y0));
  const c = [0, 0.2], zi = ZT + TRANSOM.thick, N = outline.length;
  for (let i = 0; i < N; i++) { const a = outline[i], b = outline[(i + 1) % N];
    triToward(part, [[c[0], c[1], ZT], uvo(c)], [[a[0], a[1], ZT], uvo(a)], [[b[0], b[1], ZT], uvo(b)], [0, 0, -1]);
    if (Math.min(a[1], b[1]) > SEAT - 0.3) triToward(part, [[c[0], Math.max(c[1], SEAT - 0.02), zi], uvi([c[0], SEAT])], [[a[0], a[1], zi], uvi(a)], [[b[0], b[1], zi], uvi(b)], [0, 0, 1]); }
  const edge = [...top, ...top.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  for (let i = 0; i + 1 < edge.length; i++) { const a = edge[i], b = edge[i + 1], d = [b[0] - a[0], b[1] - a[1]], out = [d[1], -d[0], 0], up = out[1] >= 0 ? out : mul(out, -1), u0 = i / (edge.length - 1), u1 = (i + 1) / (edge.length - 1);
    quadToward(part, [[a[0], a[1], ZT], R.cap.at(u0, 0)], [[b[0], b[1], ZT], R.cap.at(u1, 0)], [[b[0], b[1], zi], R.cap.at(u1, 1)], [[a[0], a[1], zi], R.cap.at(u0, 1)], Math.abs(d[1]) > Math.abs(d[0]) ? [a[0] > 0 ? -1 : 1, 0, 0] : up); }
  return part;
};

/** The ceiling: the inside of the planking where it shows, from the sole (or the bench tops, abaft the benches' fore end) to the rail. R: one rectangle, stern at the left. */
export const ceiling = (part, r, { from = ZT + TRANSOM.thick, to = DECK_Z } = {}) => mirrored(part, (p) => {
  const zs = [from, ...STATIONS.filter((z) => z > from + 0.05 && z < to - 0.05), to], foot = (z) => (z < BENCH_Z[0] + 0.01 ? SEAT - 0.02 : SOLE);
  const col = (z) => { const S = lines(z).S, y0 = foot(z); return [0, 0.4, 0.75, 1].map((k) => { const y = y0 + (S - RAIL.down - y0) * k; return [[inside(z, y), y, z], k]; }); };
  for (let i = 0; i + 1 < zs.length; i++) { const A = col(zs[i]), Bc = col(zs[i + 1]), ua = (zs[i] - from) / (to - from), ub = (zs[i + 1] - from) / (to - from);
    for (let k = 0; k < 3; k++) quadToward(p, [A[k][0], r.at(ua, A[k][1])], [Bc[k][0], r.at(ub, Bc[k][1])], [Bc[k + 1][0], r.at(ub, Bc[k + 1][1])], [A[k + 1][0], r.at(ua, A[k + 1][1])], [-1, 0.1, 0]); }
});

/** The cockpit: sole, two side benches and the stern sheets that join them. R: sole, bench (a top, 0.9 m of it), sheets (the stern sheets' top), riser. */
export const cockpit = (part, R) => {
  const zs = [BENCH_Z[0] - 0.03, ...STATIONS.filter((z) => z > BENCH_Z[0] && z < DECK_Z - 0.03), DECK_Z], z0 = zs[0], z1 = DECK_Z, sw = 0.72;
  for (let i = 0; i + 1 < zs.length; i++) { const a = zs[i], b = zs[i + 1], xa = inside(a, SOLE) + 0.01, xb = inside(b, SOLE) + 0.01, uv = (x, z) => R.sole.at((z - z0) / (z1 - z0), 0.5 + x / (2 * sw));
    quadToward(part, [[-xa, SOLE, a], uv(-xa, a)], [[xa, SOLE, a], uv(xa, a)], [[xb, SOLE, b], uv(xb, b)], [[-xb, SOLE, b], uv(-xb, b)], [0, 1, 0]); }
  mirrored(part, (p) => {                                                                                  // a side bench: its top out to the ceiling, its lip, its riser, its fore end
    const bz = [BENCH_Z[0], ...STATIONS.filter((z) => z > BENCH_Z[0] + 0.05 && z < BENCH_Z[1] - 0.05), BENCH_Z[1]], u = (z) => (z - BENCH_Z[0]) / (BENCH_Z[1] - BENCH_Z[0]), xo = (z) => inside(z, SEAT) + 0.012;
    for (let i = 0; i + 1 < bz.length; i++) { const a = bz[i], b = bz[i + 1];
      quadToward(p, [[BENCH, SEAT, a], R.bench.at(u(a), 0)], [[BENCH, SEAT, b], R.bench.at(u(b), 0)], [[xo(b), SEAT, b], R.bench.at(u(b), (xo(b) - BENCH) / 0.5)], [[xo(a), SEAT, a], R.bench.at(u(a), (xo(a) - BENCH) / 0.5)], [0, 1, 0]); }
    const [a, b] = BENCH_Z, xe = xo(b), r = BENCH + 0.03;
    quadToward(p, [[BENCH, SEAT - LIP, a], R.riser.at(0, 0.93)], [[BENCH, SEAT - LIP, b], R.riser.at(0.6, 0.93)], [[BENCH, SEAT, b], R.riser.at(0.6, 1)], [[BENCH, SEAT, a], R.riser.at(0, 1)], [-1, 0, 0]);
    quadToward(p, [[r, SOLE, a], R.riser.at(0, 0)], [[r, SOLE, b - 0.03], R.riser.at(0.6, 0)], [[r, SEAT - LIP, b - 0.03], R.riser.at(0.6, 0.93), 0.8], [[r, SEAT - LIP, a], R.riser.at(0, 0.93), 0.8], [-1, 0, 0]);
    quadToward(p, [[BENCH, SEAT - LIP, b], R.riser.at(0.62, 0.93)], [[xe, SEAT - LIP, b], R.riser.at(0.95, 0.93)], [[xe, SEAT, b], R.riser.at(0.95, 1)], [[BENCH, SEAT, b], R.riser.at(0.62, 1)], [0, 0, 1]);
    quadToward(p, [[r, SOLE, b - 0.03], R.riser.at(0.62, 0)], [[inside(b, SOLE) + 0.02, SOLE, b - 0.03], R.riser.at(0.95, 0)], [[xe, SEAT - LIP, b - 0.03], R.riser.at(0.95, 0.93), 0.8], [[r, SEAT - LIP, b - 0.03], R.riser.at(0.62, 0.93), 0.8], [0, 0, 1]);
    quadToward(p, [[BENCH, SEAT - LIP, a], R.riser.at(0, 0.9), 0.6], [[BENCH, SEAT - LIP, b], R.riser.at(0.6, 0.9), 0.6], [[r, SEAT - LIP, b], R.riser.at(0.6, 0.93), 0.6], [[r, SEAT - LIP, a], R.riser.at(0, 0.93), 0.6], [0, -1, 0]);
  });
  const sz = [ZT + TRANSOM.thick - 0.01, ...STATIONS.filter((z) => z > ZT + 0.1 && z < BENCH_Z[0] - 0.05), BENCH_Z[0]], v = (z) => (z - sz[0]) / (BENCH_Z[0] - sz[0]), sx = (z) => inside(z, SEAT) + 0.012;
  for (let i = 0; i + 1 < sz.length; i++) { const a = sz[i], b = sz[i + 1], uv = (x, z) => R.sheets.at(0.5 - x / 1.84, v(z));
    quadToward(part, [[-sx(a), SEAT, a], uv(-sx(a), a)], [[sx(a), SEAT, a], uv(sx(a), a)], [[sx(b), SEAT, b], uv(sx(b), b)], [[-sx(b), SEAT, b], uv(-sx(b), b)], [0, 1, 0]); }
  const f = BENCH_Z[0];                                                                                    // the stern sheets' lip and riser between the benches
  part.quad([[-BENCH, SEAT - LIP, f], R.riser.at(0, 0.93)], [[BENCH, SEAT - LIP, f], R.riser.at(0.6, 0.93)], [[BENCH, SEAT, f], R.riser.at(0.6, 1)], [[-BENCH, SEAT, f], R.riser.at(0, 1)]);
  part.quad([[-BENCH - 0.03, SOLE, f - 0.03], R.riser.at(0, 0)], [[BENCH + 0.03, SOLE, f - 0.03], R.riser.at(0.6, 0)], [[BENCH + 0.03, SEAT - LIP, f - 0.03], R.riser.at(0.6, 0.93), 0.8], [[-BENCH - 0.03, SEAT - LIP, f - 0.03], R.riser.at(0, 0.93), 0.8]);
  return part;
};

/** Height of the deck at (x, z): it lies a little under the sheer and is cambered. */
export const deckY = (x, z) => { const { B, S } = lines(Math.min(z, 2.5)); return S - 0.012 + 0.04 * (1 - Math.min(1, (x / Math.max(B, 0.2)) ** 2)); };
const DECK_BOX = { hw: 1.0, z0: DECK_Z, z1: 2.66 };
/** The foredeck from the bulkhead to the stem, and the bulkhead under its aft edge. R: deck (x across, 2 m; z up the rectangle), bulk (the bulkhead seen from aft, 2 m across, from the sole to 0.65). */
export const deck = (part, R) => {
  const zs = [DECK_Z, ...STATIONS.filter((z) => z > DECK_Z + 0.05), 2.60], uv = (p) => R.deck.at(0.5 + p[0] / (2 * DECK_BOX.hw), (p[2] - DECK_BOX.z0) / (DECK_BOX.z1 - DECK_BOX.z0));
  const row = (z) => { const B = z > 2.5 ? 0.11 : lines(z).B, xe = Math.max(0.03, B - RAIL.in + 0.01); return [-1, -0.55, 0, 0.55, 1].map((k) => [k * xe, deckY(k * xe, z), z]); };
  for (let i = 0; i + 1 < zs.length; i++) { const A = row(zs[i]), Bq = row(zs[i + 1]); for (let k = 0; k < 4; k++) quadToward(part, [A[k], uv(A[k])], [A[k + 1], uv(A[k + 1])], [Bq[k + 1], uv(Bq[k + 1])], [Bq[k], uv(Bq[k])], [0, 1, 0]); }
  const A = row(DECK_Z), ub = (p) => R.bulk.at(0.5 - p[0] / 2, (p[1] - SOLE) / (0.65 - SOLE)), z = DECK_Z, foot = [-1, -0.5, 0, 0.5, 1].map((k) => [k * (inside(z, SOLE) + 0.01), SOLE, z]), mid = [-1, -0.5, 0, 0.5, 1].map((k) => [k * (inside(z, 0.1) + 0.01), 0.1 + 0.02 * (1 - Math.abs(k)), z]);
  for (let k = 0; k < 4; k++) { quadToward(part, [foot[k], ub(foot[k])], [foot[k + 1], ub(foot[k + 1])], [mid[k + 1], ub(mid[k + 1])], [mid[k], ub(mid[k])], [0, 0, -1]); quadToward(part, [mid[k], ub(mid[k])], [mid[k + 1], ub(mid[k + 1])], [A[k + 1], ub(A[k + 1])], [A[k], ub(A[k])], [0, 0, -1]); }
  return part;
};

/** The cuddy: a low trunk on the foredeck with a cambered roof that overhangs it. R: side (one side, aft at the left), end (its fore and aft faces), roof (x across 1.4 m, z up the rectangle), eave. Returns roofY(x, z). */
export const CUDDY = { hw: (z) => Math.min(0.60, lines(z).B - 0.25), h: (z) => 0.25 - 0.06 * (z - CUDDY_Z[0]) / (CUDDY_Z[1] - CUDDY_Z[0]), over: 0.04, camber: 0.05, slab: 0.03, tumble: 0.03 };
export const roofY = (x, z) => { const zc = Math.min(CUDDY_Z[1], Math.max(CUDDY_Z[0], z)), w = CUDDY.hw(zc); return deckY(0, zc) - 0.02 + CUDDY.h(zc) + CUDDY.slab + CUDDY.camber * (1 - Math.min(1, (x / w) ** 2)); };
export const cuddy = (part, R) => {
  const [z0, z1] = CUDDY_Z, zs = [z0, 1.08, 1.50, z1], u = (z) => (z - z0) / (z1 - z0), top = (z) => deckY(0, z) - 0.02 + CUDDY.h(z);
  mirrored(part, (p) => { for (let i = 0; i + 1 < zs.length; i++) { const a = zs[i], b = zs[i + 1], wa = CUDDY.hw(a), wb = CUDDY.hw(b);
    quadToward(p, [[wa, deckY(wa, a) - 0.02, a], R.side.at(u(a), 0)], [[wb, deckY(wb, b) - 0.02, b], R.side.at(u(b), 0)], [[wb - CUDDY.tumble, top(b), b], R.side.at(u(b), 1)], [[wa - CUDDY.tumble, top(a), a], R.side.at(u(a), 1)], [1, 0, 0]); } });
  for (const [z, dir, s0, s1] of [[z0, -1, 0, 0.56], [z1, 1, 0.58, 1]]) { const w = CUDDY.hw(z), t = top(z);
    quadToward(part, [[-w, deckY(w, z) - 0.02, z], R.end.at(s0, 0)], [[w, deckY(w, z) - 0.02, z], R.end.at(s1, 0)], [[w - CUDDY.tumble, t, z], R.end.at(s1, 1)], [[-w + CUDDY.tumble, t, z], R.end.at(s0, 1)], [0, 0, dir]); }
  const rz = [z0 - CUDDY.over, 1.08, 1.50, z1 + CUDDY.over], row = (z) => { const zc = Math.min(z1, Math.max(z0, z)), w = CUDDY.hw(zc) - CUDDY.tumble + CUDDY.over; return [-1, -0.5, 0, 0.5, 1].map((k) => [k * w, roofY(k * (w - CUDDY.over), zc), z]); };
  const uv = (q) => R.roof.at(0.5 + q[0] / 1.4, (q[2] - rz[0]) / (rz[3] - rz[0])), dn = (q) => [q[0], q[1] - CUDDY.slab - 0.01, q[2]];
  for (let i = 0; i < 3; i++) { const A = row(rz[i]), Bq = row(rz[i + 1]);
    for (let k = 0; k < 4; k++) quadToward(part, [A[k], uv(A[k])], [A[k + 1], uv(A[k + 1])], [Bq[k + 1], uv(Bq[k + 1])], [Bq[k], uv(Bq[k])], [0, 1, 0]);
    for (const k of [0, 4]) quadToward(part, [dn(A[k]), R.eave.at(i / 3, 0)], [dn(Bq[k]), R.eave.at((i + 1) / 3, 0)], [Bq[k], R.eave.at((i + 1) / 3, 1)], [A[k], R.eave.at(i / 3, 1)], [k ? 1 : -1, 0, 0]); }
  for (const [i, dir] of [[0, -1], [3, 1]]) { const A = row(rz[i]); for (let k = 0; k < 4; k++) quadToward(part, [dn(A[k]), R.eave.at(k / 4, 0)], [dn(A[k + 1]), R.eave.at((k + 1) / 4, 0)], [A[k + 1], R.eave.at((k + 1) / 4, 1)], [A[k], R.eave.at(k / 4, 1)], [0, 0, dir]); }
  return part;
};

/** The lid that closes her at the rail (the game gives it a material that keeps the sea out of her): a strip from the transom to the stem, 5 cm under the sheer. */
export const hullMask = (part) => {
  const zs = [ZT + 0.02, ...STATIONS.slice(1), 2.60], row = (z) => { const { B, S } = z > 2.5 ? { B: 0.10, S: 0.93 } : lines(z); return [[-(B - 0.03), S - 0.05, z], [B - 0.03, S - 0.05, z]]; };
  for (let i = 0; i + 1 < zs.length; i++) { const A = row(zs[i]), Bq = row(zs[i + 1]); quadToward(part, [A[0], [0, 0]], [A[1], [0, 0]], [Bq[1], [0, 0]], [Bq[0], [0, 0]], [0, 1, 0]); }
  return part;
};

// ---- small pieces both builders use
/** A flat round face in the plane of e1 (to the right) and e2 (up), `proud` of its centre along the normal; edge: a rectangle for a rim down to the surface. */
export const disc = (part, c, e1, e2, r, sides, rect, { proud = 0, edge = null, flipU = false } = {}) => {            // a flat round face in the plane of e1 (to the right) and e2 (up)
  const n = norm(cross(e1, e2)), at = (a, k = 1, d = proud) => add(add(c, mul(n, d)), add(mul(e1, k * r * Math.cos(a)), mul(e2, k * r * Math.sin(a)))), uv = (a, k = 1) => rect.at(0.5 + (flipU ? -0.5 : 0.5) * k * Math.cos(a), 0.5 + 0.5 * k * Math.sin(a));
  for (let i = 0; i < sides; i++) { const a = 2 * Math.PI * (i + 0.5) / sides, b = 2 * Math.PI * (i + 1.5) / sides;
    triToward(part, [at(0, 0), uv(0, 0)], [at(a), uv(a)], [at(b), uv(b)], n);
    if (edge) quadToward(part, [at(a, 1, 0), edge.at(i / sides, 0)], [at(b, 1, 0), edge.at((i + 1) / sides, 0)], [at(b), edge.at((i + 1) / sides, 1)], [at(a), edge.at(i / sides, 1)], add(mul(e1, Math.cos((a + b) / 2)), mul(e2, Math.sin((a + b) / 2)))); }
};
/** A plate in the Y-Z plane, 2w thick, from an outline [[z, y], ...]: `side` is painted over the box { z0, z1, y0, y1 }, `edge` runs round it. */
export const slabZY = (part, outline, w, side, edge, box) => {                                                          // a plate in the Y-Z plane, 2w thick: outline [[z, y], ...]
  const c = outline.reduce((s, q) => [s[0] + q[0] / outline.length, s[1] + q[1] / outline.length], [0, 0]), uv = ([z, y]) => side.at((box.z1 - z) / (box.z1 - box.z0), (y - box.y0) / (box.y1 - box.y0)), N = outline.length;
  for (let i = 0; i < N; i++) { const a = outline[i], b = outline[(i + 1) % N];
    for (const sx of [1, -1]) triToward(part, [[sx * w, c[1], c[0]], uv(c)], [[sx * w, a[1], a[0]], uv(a)], [[sx * w, b[1], b[0]], uv(b)], [sx, 0, 0]);
    const d = [b[0] - a[0], b[1] - a[1]], out = [0, d[0], -d[1]], mid = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]], o = (out[2] * mid[0] + out[1] * mid[1]) >= 0 ? out : mul(out, -1);
    quadToward(part, [[-w, a[1], a[0]], edge.at(0, i / N)], [[w, a[1], a[0]], edge.at(1, i / N)], [[w, b[1], b[0]], edge.at(1, (i + 1) / N)], [[-w, b[1], b[0]], edge.at(0, (i + 1) / N)], o); }
};
/** One rectangle on every face of a box. */
export const all = (r) => ({ px: r, nx: r, py: r, ny: r, pz: r, nz: r });
/** The rudder's outline [[z, y], ...] up to the height `top` of its head; it is painted over RUDDER_BOX. */
export const RUDDER_BOX = { z0: ZT - 0.29, z1: ZT, y0: -0.6, y1: 0.66 };
export const rudderOutline = (top) => [[ZT - 0.012, -0.57], [ZT - 0.27, -0.55], [ZT - 0.28, -0.05], [ZT - 0.22, 0.15], [ZT - 0.13, 0.40], [ZT - 0.115, top], [ZT - 0.012, top]];
