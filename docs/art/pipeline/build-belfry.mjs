// build-belfry.mjs : the Drowned Belfry, the top of a stone church tower standing in the sea, built in code (no generation job).
// Usage: node build-belfry.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]
//   1. node build-belfry.mjs out.glb --layout belfry.layout.json     writes where everything sits in the atlas
//   2. python paint-belfry.py belfry.layout.json belfry.png          paints the atlas (2048 px)
//   3. node build-belfry.mjs out.glb belfry.png                      builds the model with it
// Origin at the waterline, centre of the footprint, +Y up, metres. The tower leans 6 degrees toward +X (a turn about Z
// through the origin). The node `Bell` hangs plumb from its headstock: its origin is on the gudgeons' axis, which runs
// along Z, so the bell swings by turning about its own Z. The empty `RopeSocket` (a child of Bell) is the clapper's end.
import fs from 'node:fs';
import { Model, rect, rng, rotX, rotY, rotZ, move, compose, rad, add, sub, mul, dot, cross, norm, lerp } from './kit.mjs';

const args = process.argv.slice(2); const flag = (k) => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; };
const layoutOut = flag('--layout'), uvOut = flag('--uv'); const [out, texture] = args;

const ATLAS = [2048, 2048];
const R = {
  wall: rect(0, 0, 2048, 648),                 // the four outer faces above water, side by side (+Z, +X, -Z, -X), 160 px/m
  string: rect(0, 652, 2048, 692), cornice: rect(0, 696, 2048, 744),
  under: rect(0, 748, 2048, 1012),             // the same four faces below the waterline
  inner0: rect(0, 1016, 352, 1368), inner1: rect(352, 1016, 704, 1368), inner2: rect(704, 1016, 1056, 1368), inner3: rect(1056, 1016, 1408, 1368),
  floor: rect(1412, 1016, 1668, 1272), butt: rect(1672, 1016, 2044, 1282),   // butt: a buttress unrolled, side | front | side, 2.52 m wide and 1.8 m high
  roof0: rect(0, 1372, 500, 1686), roof1: rect(512, 1372, 1012, 1686), roof2: rect(1024, 1372, 1524, 1686), roof3: rect(1536, 1372, 2036, 1686),
  bell: rect(0, 1690, 768, 2010), bellIn: rect(776, 1690, 1032, 1818), clapper: rect(1040, 1690, 1104, 1818),
  iron: rect(1112, 1690, 1368, 1738), wood: rect(1112, 1746, 1624, 1810), roofUnder: rect(1632, 1690, 1888, 1850),
  frond: rect(1896, 1690, 1992, 1882), reveal: rect(776, 1826, 1408, 1906), sill: rect(1416, 1826, 1624, 1906),
  barnacle: rect(1640, 1858, 1704, 1906),
  headstock: rect(776, 1914, 1160, 2042), headEnd: rect(1168, 1914, 1216, 1962), buttLow: rect(1224, 1914, 1480, 2042),
  slope: rect(1488, 1914, 1584, 1978), wallTop: rect(1592, 1914, 1688, 1978), slate: rect(1696, 1914, 1792, 1978),
};
R.hip = rect(1736, 1890, 1992, 1910);                                    // lead on the hips

// ---- sizes (metres, before the lean)
const LEAN = 6;
const A = 1.6, T = 0.5, AI = A - T;                                     // half the outer width, wall thickness, half the room
const Y = { foot: -3.0, string: [1.78, 1.82, 1.93, 1.99], stage: 1.99, floor: 2.05, sill: 2.2, spring: 2.95, top: 4.05, cornice: [4.03, 4.12, 4.25], eaves: 4.25, apex: 5.50 };
const OPEN = { w: 1.5, rise: 0.8, segs: 7 };
const E = 1.78;                                                         // half the roof at the eaves
const PIVOT = [0, 3.5, 0];
const lean = rotZ(-rad(LEAN));
const side = (k) => compose(lean, rotY(k * Math.PI / 2));

const m = new Model('belfry');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.node('Bell', lean(PIVOT));

/** Adds triangles that face `dir` whatever order their corners come in. */
const facing = (part, dir) => ({
  tri(a, b, c) { const n = cross(sub(b[0], a[0]), sub(c[0], a[0])); return dot(n, dir) >= 0 ? part.tri(a, b, c) : part.tri(a, c, b); },
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); },
});

// ---- the opening: a pointed arch. Points up its right side from the springing to the apex.
const RR = (OPEN.rise * OPEN.rise + OPEN.w * OPEN.w / 4) / OPEN.w;        // the radius of each arc
const ARC = Math.acos((RR - OPEN.w / 2) / RR);
const archPts = Array.from({ length: OPEN.segs + 1 }, (_, i) => { const a = ARC * i / OPEN.segs; return [OPEN.w / 2 - RR + RR * Math.cos(a), Y.spring + RR * Math.sin(a)]; });
archPts[OPEN.segs][0] = 0;
const REVEAL_LEN = 2 * (Y.spring - Y.sill) + 2 * RR * ARC;

for (let k = 0; k < 4; k++) {
  const xf = side(k);
  // -- outer face
  const wall = m.part('wall' + k, { crease: 30, xf }); const W = facing(wall, [0, 0, 1]);
  const uvW = (s, y) => (y >= 0 ? R.wall.at((k * 2 * A + s + A) / (8 * A), y / Y.top) : R.under.at((k * 2 * A + s + A) / (8 * A), (y - Y.foot) / -Y.foot));
  const pw = (s, y, y0 = y) => [[s, y, A], uvW(s, y0 < 0 ? Math.min(y, -1e-6) : y)];
  const cols = [-A, -OPEN.w / 2, OPEN.w / 2, A];
  for (let c = 0; c < 3; c++) {
    W.quad(pw(cols[c], Y.foot, -1), pw(cols[c + 1], Y.foot, -1), pw(cols[c + 1], 0, -1), pw(cols[c], 0, -1));
    W.quad(pw(cols[c], 0), pw(cols[c + 1], 0), pw(cols[c + 1], Y.sill), pw(cols[c], Y.sill));
  }
  for (const sg of [1, -1]) {
    const P = archPts.map(([x, y]) => pw(sg * x, y)), C = pw(sg * A, Y.top);
    W.quad(pw(sg * OPEN.w / 2, Y.sill), pw(sg * A, Y.sill), pw(sg * A, Y.spring), pw(sg * OPEN.w / 2, Y.spring));
    W.tri(C, pw(sg * A, Y.spring), P[0]);
    for (let i = 0; i < OPEN.segs; i++) W.tri(C, P[i], P[i + 1]);
    W.tri(C, P[OPEN.segs], pw(0, Y.top));
  }
  // -- inner face (seen from inside the room)
  const inn = m.part('inner' + k, { crease: 30, xf }); const I = facing(inn, [0, 0, -1]); const ri = R['inner' + k];
  const pi = (s, y) => [[s, y, AI], ri.at((AI - s) / (2 * AI), (y - Y.floor) / (Y.eaves - Y.floor))];
  const colsI = [-AI, -OPEN.w / 2, OPEN.w / 2, AI];
  for (let c = 0; c < 3; c++) I.quad(pi(colsI[c], Y.floor), pi(colsI[c + 1], Y.floor), pi(colsI[c + 1], Y.sill), pi(colsI[c], Y.sill));
  for (const sg of [1, -1]) {
    const P = archPts.map(([x, y]) => pi(sg * x, y)), C = pi(sg * AI, Y.eaves);
    I.quad(pi(sg * OPEN.w / 2, Y.sill), pi(sg * AI, Y.sill), pi(sg * AI, Y.spring), pi(sg * OPEN.w / 2, Y.spring));
    I.tri(C, pi(sg * AI, Y.spring), P[0]);
    for (let i = 0; i < OPEN.segs; i++) I.tri(C, P[i], P[i + 1]);
    I.tri(C, P[OPEN.segs], pi(0, Y.eaves));
  }
  // -- the reveal: both jambs and the arch's soffit, and the sill
  const rev = m.part('reveal' + k, { crease: 50, xf });
  const path = [[-OPEN.w / 2, Y.sill], ...archPts.map(([x, y]) => [-x, y]), ...archPts.slice(0, -1).reverse(), [OPEN.w / 2, Y.sill]];
  let run = 0; const centre = [0, (Y.sill + Y.spring) / 2 + 0.3, A - T / 2];
  for (let i = 0; i + 1 < path.length; i++) {
    const [x0, y0] = path[i], [x1, y1] = path[i + 1], l = Math.hypot(x1 - x0, y1 - y0); const u0 = run / REVEAL_LEN, u1 = (run + l) / REVEAL_LEN; run += l;
    const mid = [(x0 + x1) / 2, (y0 + y1) / 2, A - T / 2];
    facing(rev, sub(centre, mid)).quad([[x0, y0, A], R.reveal.at(u0, 1)], [[x1, y1, A], R.reveal.at(u1, 1)], [[x1, y1, AI], R.reveal.at(u1, 0)], [[x0, y0, AI], R.reveal.at(u0, 0)]);
  }
  facing(m.part('sill' + k, { xf }), [0, 1, 0]).quad([[-OPEN.w / 2, Y.sill, A], R.sill.at(0, 0)], [[OPEN.w / 2, Y.sill, A], R.sill.at(1, 0)], [[OPEN.w / 2, Y.sill, AI], R.sill.at(1, 1)], [[-OPEN.w / 2, Y.sill, AI], R.sill.at(0, 1)]);
  // -- the top of the wall under the roof
  facing(m.part('walltop' + k, { xf }), [0, 1, 0]).quad([[-AI, Y.eaves, AI], R.wallTop.at(0.2, 0)], [[AI, Y.eaves, AI], R.wallTop.at(0.8, 0)], [[A + 0.1, Y.eaves, A + 0.1], R.wallTop.at(1, 1)], [[-A - 0.1, Y.eaves, A + 0.1], R.wallTop.at(0, 1)]);

  // -- string course and cornice: rings that stand proud of the wall
  const ring = (name, r, ys, p) => {                                     // ys: [wall below, front bottom, front top, wall above]
    const part = m.part(name + k, { crease: 30, xf }); const u = (s) => (k * 2 * A + s + A) / (8 * A);
    const v = [0, 0.25, 0.8, 1], zs = [A, A + p, A + p, A], hw = [A, A + p, A + p, A];
    for (let i = 0; i < 3; i++) {
      if (ys[i + 1] === undefined) break;
      const a = [[-hw[i], ys[i], zs[i]], r.at(u(-hw[i]), v[i])], b = [[hw[i], ys[i], zs[i]], r.at(u(hw[i]), v[i])];
      const c = [[hw[i + 1], ys[i + 1], zs[i + 1]], r.at(u(hw[i + 1]), v[i + 1])], d = [[-hw[i + 1], ys[i + 1], zs[i + 1]], r.at(u(-hw[i + 1]), v[i + 1])];
      facing(part, [0, i === 0 ? -1 : i === 2 ? 1 : 0, 1]).quad(a, b, c, d);
    }
  };
  ring('string', R.string, Y.string, 0.07);
  ring('cornice', R.cornice, [...Y.cornice, undefined], 0.10);

  // -- a diagonal buttress on the corner to the right of this face, in two stages
  const d = norm([1, 0, 1]), t = norm([1, 0, -1]); const at = (bx, y, bz) => [A + bx * t[0] + bz * d[0], y, A + bx * t[2] + bz * d[2]];
  const butt = m.part('buttress' + k, { crease: 30, xf }); const hw = 0.31;
  const BW = 0.95 + 0.62 + 0.95;                                         // the unrolled width: a side from the wall to the front, the front, the other side
  const uvB = (um, y) => (y >= 0 ? R.butt.at(um / BW, y / 1.8) : R.buttLow.at(um / BW, (y - Y.foot) / -Y.foot));
  const stage = (p, yb, y1, y2, slopeEnd) => {                         // front at `p` from the corner, a sloping top from y1 at the front to y2 at `slopeEnd`
    const back = -0.33, F0 = 0.95, F1 = 0.95 + 0.62;                     // the sides start inside the wall; F0..F1 is the front in the unrolled texture
    const uL = (bz) => F0 - (p - bz), uR = (bz) => F1 + (p - bz);
    const corner = (bx, y, bz, um, yuv = y) => [at(bx, y, bz), uvB(um, yuv)];
    const split = yb < 0 && y1 > 0 ? [[yb, -1e-6], [0, y1]] : [[yb, y1]];
    for (const [ya, yc] of split) {
      facing(butt, d).quad(corner(-hw, ya, p, F0), corner(hw, ya, p, F1), corner(hw, yc, p, F1), corner(-hw, yc, p, F0));
      facing(butt, mul(t, -1)).quad(corner(-hw, ya, back, uL(back)), corner(-hw, ya, p, F0), corner(-hw, yc, p, F0), corner(-hw, yc, back, uL(back)));
      facing(butt, t).quad(corner(hw, ya, p, F1), corner(hw, ya, back, uR(back)), corner(hw, yc, back, uR(back)), corner(hw, yc, p, F1));
    }
    const yBack = y1 + (y2 - y1) * (p - back) / (p - slopeEnd);          // the slope carried on into the wall
    facing(butt, mul(t, -1)).tri(corner(-hw, y1, back, uL(back)), corner(-hw, y1, p, F0), corner(-hw, yBack, back, uL(back)));
    facing(butt, t).tri(corner(hw, y1, p, F1), corner(hw, y1, back, uR(back)), corner(hw, yBack, back, uR(back)));
    facing(butt, add(d, [0, 1, 0])).quad([at(-hw, y1, p), R.slope.at(0, 0)], [at(hw, y1, p), R.slope.at(1, 0)], [at(hw, yBack, back), R.slope.at(1, 1)], [at(-hw, yBack, back), R.slope.at(0, 1)]);
  };
  stage(0.62, Y.foot, 0.74, 1.02, 0.34);
  stage(0.34, 0.74, 1.40, 1.66, 0.0);

  // -- the roof: one face of the pyramid as a grid that closes on the apex; some cells are gone
  const M = 6, K = 5, rise = Y.apex - Y.eaves;
  const HOLES = { 0: ['1,3', '1,4', '1,5', '2,3', '2,4', '2,5', '3,4', '3,5'], 1: ['1,0', '1,1', '2,0', '2,1', '3,0'], 2: ['2,2'], 3: [] }[k];
  const roofP = (u, tt) => [u * E * (1 - tt), Y.eaves + tt * rise, E * (1 - tt)];
  const rr = R['roof' + k]; const uvR = (u, tt) => rr.at(0.5 + 0.5 * u * (1 - tt), tt), uvU = (u, tt) => R.roofUnder.at(0.5 + 0.5 * u * (1 - tt), tt);
  const top = m.part('roof' + k, { crease: 25, xf }), und = m.part('roofUnder' + k, { crease: 25, xf });
  const up = facing(top, [0, 1, 1]), down = facing(und, [0, -1, -1]);
  for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) {
    if (HOLES.includes(i + ',' + j)) continue;
    const c = [[-1 + 2 * j / M, i / K], [-1 + 2 * (j + 1) / M, i / K], [-1 + 2 * (j + 1) / M, (i + 1) / K], [-1 + 2 * j / M, (i + 1) / K]];
    up.quad(...c.map(([u, tt]) => [roofP(u, tt), uvR(u, tt)])); down.quad(...c.map(([u, tt]) => [roofP(u, tt), uvU(u, tt)]));
  }
  facing(top, [0, 0, 1]).quad([[-E, Y.eaves - 0.07, E], R.slate.at(0, 0)], [[E, Y.eaves - 0.07, E], R.slate.at(1, 0)], [[E, Y.eaves, E], R.slate.at(1, 1)], [[-E, Y.eaves, E], R.slate.at(0, 1)]);     // the edge of the eaves
  facing(und, [0, -1, 0]).quad([[-E, Y.eaves - 0.07, E], R.slate.at(0, 0)], [[E, Y.eaves - 0.07, E], R.slate.at(1, 0)], [[A + 0.1, Y.eaves - 0.07, A + 0.1], R.slate.at(1, 1)], [[-A - 0.1, Y.eaves - 0.07, A + 0.1], R.slate.at(0, 1)]);
  // slates left hanging over the edges of the holes (two-sided)
  const nrm = norm([0, E, rise]);
  const LOOSE = { 0: [[[0.02, 0.2], [0.34, 0.2], [0.30, 0.31], [0.10, 0.36], [0.0, 0.3]], [[0.0, 0.42], [0.22, 0.4], [0.3, 0.52], [0.05, 0.6]], [[0.66, 0.2], [1.0, 0.2], [0.98, 0.27], [0.75, 0.3]], [[0.34, 0.8], [0.8, 0.8], [0.62, 0.7], [0.45, 0.68]]],
    1: [[[-1, 0.2], [-0.55, 0.2], [-0.62, 0.3], [-0.9, 0.33]], [[-0.34, 0.2], [-0.33, 0.48], [-0.5, 0.38], [-0.48, 0.25]], [[-0.66, 0.6], [-0.33, 0.6], [-0.4, 0.52], [-0.6, 0.5]]], 2: [], 3: [] }[k];
  for (const poly of LOOSE) {
    const pts = poly.map(([u, tt]) => [add(roofP(u, tt), mul(nrm, 0.012)), uvR(u, tt)]), ptsU = poly.map(([u, tt]) => [add(roofP(u, tt), mul(nrm, 0.012)), uvU(u, tt)]);
    for (let i = 1; i + 1 < pts.length; i++) { up.tri(pts[0], pts[i], pts[i + 1]); down.tri(ptsU[0], ptsU[i], ptsU[i + 1]); }
  }
  // rafters and battens where the roof is open
  const timber = m.part('timber' + k, { crease: 30, xf });
  const beam = (p0, p1, w, h, upv, r = R.wood) => {                         // a square timber from p0 to p1; its top faces `upv`
    const ax = norm(sub(p1, p0)), sd = norm(cross(ax, upv)), u2 = cross(sd, ax), L = Math.hypot(...sub(p1, p0)), ul = Math.min(1, L / 3.2);
    const c = (e, a, b) => add(e, add(mul(sd, a * w / 2), mul(u2, b * h / 2)));
    const faces = [[[-1, 1], [1, 1], u2, 0], [[1, 1], [1, -1], sd, 1], [[1, -1], [-1, -1], mul(u2, -1), 2], [[-1, -1], [-1, 1], mul(sd, -1), 3]];
    for (const [[a0, b0], [a1, b1], n, band] of faces) facing(timber, n).quad([c(p0, a0, b0), r.at(0, band / 4)], [c(p0, a1, b1), r.at(0, (band + 1) / 4)], [c(p1, a1, b1), r.at(ul, (band + 1) / 4)], [c(p1, a0, b0), r.at(ul, band / 4)]);
  };
  const under = (u, tt, off) => add(roofP(u, tt), mul(nrm, -off));
  const RAFT = { 0: [0.3, 0.9, 1.5], 1: [-1.5, -0.9], 2: [-0.3], 3: [] }[k];
  for (const x of RAFT) { const te = 1 - Math.abs(x) / E; beam(add([x, Y.eaves, E], mul(nrm, -0.085)), add([x, Y.eaves + te * rise, E * (1 - te)], mul(nrm, -0.085)), 0.08, 0.12, nrm); }
  const BATT = { 0: [[0.3, 0.02, 1], [0.5, 0.02, 1], [0.7, 0.34, 1]], 1: [[0.3, -1, -0.3], [0.5, -1, -0.3], [0.7, -1, -0.64]], 2: [[0.5, -0.36, 0.02]], 3: [] }[k];
  for (const [tt, u0, u1] of BATT) beam(under(u0, tt, 0.012), under(u1, tt, 0.012), 0.05, 0.025, nrm);

  // the hip to the right of this face: a lead roll (and, where the roof is open, the bare hip rafter under it)
  const hipPart = m.part('hip' + k, { crease: 70, xf });
  hipPart.tube([[E + 0.02, Y.eaves + 0.01, E + 0.02], [0.02, Y.apex + 0.01, 0.02]], [0.055, 0.045], 4, R.hip, { open: true, twist: Math.PI / 4 });
}

// ---- weed that hangs clear of the wall, and barnacles standing on it, in the lowest metre and a half
{ const rnd = rng(31);
  for (let k = 0; k < 4; k++) {
    const xf = side(k), weed = m.part('weed' + k, { crease: 60, xf }), barn = m.part('barnacles' + k, { crease: 20, xf });
    for (let i = 0; i < 3; i++) {
      const s0 = -1.05 + 2.1 * (i + rnd()) / 3, y0 = 0.45 + 0.85 * rnd(), len = 0.34 + 0.22 * rnd(), w = 0.07 + 0.04 * rnd(), lean2 = (rnd() - 0.5) * 0.16;
      const row = (t) => { const out2 = 0.015 + 0.10 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.6 + 0.4 * t), hw2 = w * (0.45 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.7)) + 0.1) * (t > 0.99 ? 0.25 : 1);
        const c = [s0 + lean2 * t * t, y0 - len * t, A + out2]; return [[[c[0] - hw2, c[1], c[2]], R.frond.at(0, 1 - t)], [[c[0] + hw2, c[1], c[2]], R.frond.at(1, 1 - t)]]; };
      const ts = [0, 0.3, 0.65, 1];
      for (let j = 0; j + 1 < ts.length; j++) { const [a, b] = row(ts[j]), [d, c] = row(ts[j + 1]); weed.quad(d, c, b, a); weed.quad(a, b, c, d); }
    }
    for (let c = 0; c < 2; c++) {
      const sc = -1.0 + 2.0 * rnd(), yc = 0.2 + 0.55 * rnd();
      for (let i = 0; i < 4; i++) {
        const ctr = [sc + (rnd() - 0.5) * 0.3, yc + (rnd() - 0.5) * 0.22, A], r = 0.045 + 0.035 * rnd(), h = r * (0.7 + 0.4 * rnd()), ph = rnd() * 6.28;
        const rim = (j) => { const a = ph + 2 * Math.PI * j / 5; return [[ctr[0] + r * Math.cos(a), ctr[1] + r * Math.sin(a), A - 0.004], R.barnacle.at(0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a))]; };
        for (let j = 0; j < 5; j++) facing(barn, [Math.cos(ph + 2 * Math.PI * (j + 0.5) / 5), Math.sin(ph + 2 * Math.PI * (j + 0.5) / 5), 1]).tri(rim(j), rim(j + 1), [[ctr[0], ctr[1], A + h], R.barnacle.at(0.5, 0.5)]);
      }
    }
  }
}

// ---- floor of the bell chamber, the bell frame
facing(m.part('floor', { xf: lean }), [0, 1, 0]).quad([[-AI, Y.floor, AI], R.floor.at(0, 0)], [[AI, Y.floor, AI], R.floor.at(1, 0)], [[AI, Y.floor, -AI], R.floor.at(1, 1)], [[-AI, Y.floor, -AI], R.floor.at(0, 1)]);
const frame = m.part('frame', { crease: 30, xf: lean });
for (const z of [-0.86, 0.86]) {
  const c = [0, PIVOT[1] - 0.14, z], h = [AI, 0.10, 0.09], r4 = (b) => R.wood.sub(0, b / 4, 0.6875, (b + 1) / 4);
  frame.box(c, h, { py: r4(0), ny: r4(2), pz: r4(1), nz: r4(3) });
}

// ---- the cross: a ball, a shaft that was bent, one arm
const cross_ = m.part('cross', { crease: 40, xf: lean });
cross_.lathe([[0.06, Y.apex - 0.05], [0.11, Y.apex + 0.03], [0.09, Y.apex + 0.11], [0.03, Y.apex + 0.15]], 6, R.iron.sub(0, 0, 0.25, 1));
const shaft = [[0, Y.apex + 0.12, 0], [0, Y.apex + 0.34, 0], [0.10, Y.apex + 0.56, 0.04], [0.26, Y.apex + 0.76, 0.10]];
cross_.tube(shaft, 0.036, 4, R.iron.sub(0.25, 0, 1, 0.5), { twist: Math.PI / 4 });
{ const c = lerp(shaft[2], shaft[3], 0.3), ax = norm(sub(shaft[3], shaft[2])), arm = norm(cross(ax, [1, 0, 0])); cross_.tube([add(c, mul(arm, -0.24)), add(c, mul(arm, 0.24))], 0.032, 4, R.iron.sub(0.25, 0.5, 0.75, 1), { twist: Math.PI / 4 }); }

// ---- the bell: its own node, hanging plumb. Heights are below the gudgeons' axis.
const pv = lean(PIVOT), bx = move(pv);
const BELL_OUT = [[0.455, -0.985], [0.475, -0.955], [0.45, -0.88], [0.345, -0.70], [0.285, -0.52], [0.262, -0.36], [0.255, -0.27], [0.228, -0.20], [0.15, -0.165], [0, -0.16]];
const BELL_IN = [[0, -0.23], [0.215, -0.26], [0.25, -0.52], [0.40, -0.86], [0.44, -0.985], [0.455, -0.985]];
const BS = 18;
m.part('bell', { node: 'Bell', crease: 50, xf: bx }).lathe(BELL_OUT, BS, R.bell);
m.part('bellIn', { node: 'Bell', crease: 50, xf: bx }).lathe(BELL_IN, BS, R.bellIn);
const head = m.part('headstock', { node: 'Bell', crease: 30, xf: bx });
{ const hs = (b) => R.headstock.sub(0, b / 4, 1, (b + 1) / 4);
  head.box([0, 0.03, 0], [0.12, 0.11, 0.70], { px: hs(0), py: hs(1), nx: hs(2), ny: hs(3), pz: R.headEnd, nz: R.headEnd });
  head.box([0, -0.12, 0], [0.085, 0.045, 0.085], R.iron.sub(0.75, 0.5, 1, 1));                                     // the crown staple between bell and headstock
  for (const sg of [1, -1]) head.tube([[0, 0, sg * 0.69], [0, 0, sg * 0.81]], 0.032, 5, R.iron.sub(0.25, 0.5, 0.5, 1)); }                 // the gudgeons
const clap = m.part('clapper', { node: 'Bell', crease: 60, xf: bx });
clap.lathe([[0.02, -0.23], [0.02, -0.80], [0.075, -0.87], [0.082, -0.93], [0.05, -0.985], [0.028, -1.0], [0.022, -1.06], [0, -1.07]], 6, R.clapper);
m.empty('RopeSocket', add(pv, [0, -1.07, 0]), 'Bell');

if (layoutOut) {
  const rects = Object.fromEntries(Object.entries(R).map(([k, r]) => [k, [r.x0, r.y0, r.x1, r.y1]]));
  let L = 0; const acc = [0]; for (let i = 1; i < BELL_OUT.length; i++) { L += Math.hypot(BELL_OUT[i][0] - BELL_OUT[i - 1][0], BELL_OUT[i][1] - BELL_OUT[i - 1][1]); acc.push(L); }
  fs.writeFileSync(layoutOut, JSON.stringify({ atlas: ATLAS, rects, A, T, AI, Y, OPEN: { ...OPEN, RR, ARC }, E, revealLen: REVEAL_LEN, bell: BELL_OUT.map(([r, y], i) => [r, y, +(acc[i] / L).toFixed(5)]),
    rafters: [0.3, 0.9, 1.5], pivot: PIVOT, lean: LEAN }, null, 1));
}
if (uvOut) fs.writeFileSync(uvOut, m.uvSvg(ATLAS));
const stats = await m.write(out, { texture: texture && fs.existsSync(texture) ? texture : null, size: 2048, atlas: ATLAS, quality: 88 });
console.log(JSON.stringify(stats));
