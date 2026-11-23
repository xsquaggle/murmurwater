// build-tryworks.mjs : the cold tryworks at Tryworks Landing, built in code (no generation job).
// Usage: node build-tryworks.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A squat brick furnace 3 m long (along X) and 1.8 m deep, 1.5 m high, with two great iron try-pots set in its top. The
// one on the +X side has a broken lip and a crack down its side and is full of earth and sea-thrift, two heads of it
// leaning out over the break; the other holds
// rain water. Two fire-holes in the front (+Z) under iron lintels: the left one has lost its door, the right one's door
// hangs open. A rusted iron chimney on a brick base stands at the back between the pots, its top 2.6 m up. A long-handled
// skimmer leans on the +X end, and three fallen bricks lie by the front. Nothing has been boiled here in forty years:
// rust and moss and salt, no soot. Origin on the ground under the middle; the brick goes 0.1 m into it. One material, `main`.
import { Model, pack, cli, emit, within, rotY, move, compose, rad, rng, add, sub, mul, norm, cross } from './kit.mjs';

const args = cli(), ATLAS = [1024, 1024], rnd = rng(47);
const HX = 1.5, HZ = 0.9, TOP = 1.5, BASE = -0.1, PX = 0.75, PZ = 0.05, HOLE = 0.62;            // half length and depth, the top, the foot; where the pots sit, the hole each is set in
const FX = [-0.75, 0.75], FW = 0.26, FY0 = 0.16, FY1 = 0.68, FD = 0.46;                            // the fire-holes: middles, half width, sill, top, depth
const R = pack(...ATLAS, {
  front: [450, 240, { mat: 'brickwork', ppm: 150, rust: 0.45, moss: 0.55, lichen: 0.3 }],
  back: [450, 240, { mat: 'brickwork', ppm: 150, rust: 0.3, moss: 0.7, lichen: 0.4 }],
  side: [270, 240, { mat: 'brickwork', ppm: 150, rust: 0.4, moss: 0.6, lichen: 0.35 }],
  top: [450, 270, { mat: 'brickwork', ppm: 150, rust: 0.0, moss: 0.35, lichen: 0.5 }],
  potA: [400, 120, { mat: 'trypot', crack: 10.5 / 14, moss: 0.35, soft: 0 }],
  potB: [400, 120, { mat: 'trypot', moss: 0.2, soft: 0 }],
  water: [128, 128, { mat: 'flat', colour: '#3E4E58', var: 0.18, soft: 0 }],
  dome: [256, 60, { mat: 'thriftdome', tone: ['#2C4629', '#4A6B3C', '#728F50'], soft: 2 }], heads: [240, 24, { mat: 'thrifthead', n: 12, soft: 0 }], stalk: [40, 40, { mat: 'flat', colour: '#7C8A4C', var: 0.14 }],
  dark: [64, 64, { mat: 'flat', colour: '#2C2826', var: 0.12 }], ash: [96, 64, { mat: 'flat', colour: '#3E3A36', var: 0.25 }],
  chimney: [120, 220, { mat: 'iron', rust: 0.85, tile_x: true }], iron: [96, 96, { mat: 'iron', rust: 0.7 }],
  pole: [24, 220, { mat: 'wood', tone: 'grey', along: 'y', weather: 0.8, tile_x: true }], pan: [96, 96, { mat: 'skimmer', soft: 0 }],
  brick: [64, 32, { mat: 'flat', colour: '#7E5246', var: 0.18, edge: 0.4 }],
});
const m = new Model('tryworks');
m.material('main', { kind: 'texture', roughness: 0.92 });
const body = m.part('furnace', { crease: 30 }), pots = m.part('pots', { crease: 50 }), fit = m.part('fittings', { crease: 40 }), green = m.part('thrift', { crease: 50 });

// ---- the furnace: back and ends as one quad each, the top with two round holes, the front cut round the fire-holes
const onWall = (r, x0, x1) => (x, y) => r.at((x - x0) / (x1 - x0), (y - BASE) / (TOP - BASE));
const fr = onWall(R.front, -HX, HX), sd = onWall(R.side, -HZ, HZ);
body.quad([[HX, BASE, -HZ], onWall(R.back, -HX, HX)(-HX, BASE)], [[-HX, BASE, -HZ], onWall(R.back, -HX, HX)(HX, BASE)], [[-HX, TOP, -HZ], onWall(R.back, -HX, HX)(HX, TOP)], [[HX, TOP, -HZ], onWall(R.back, -HX, HX)(-HX, TOP)]);
for (const sx of [1, -1]) body.quad([[sx * HX, BASE, sx * HZ], sd(-HZ, BASE)], [[sx * HX, BASE, -sx * HZ], sd(HZ, BASE)], [[sx * HX, TOP, -sx * HZ], sd(HZ, TOP)], [[sx * HX, TOP, sx * HZ], sd(-HZ, TOP)]);
const panel = (x0, y0, x1, y1) => body.quad([[x0, y0, HZ], fr(x0, y0)], [[x1, y0, HZ], fr(x1, y0)], [[x1, y1, HZ], fr(x1, y1)], [[x0, y1, HZ], fr(x0, y1)]);
const XS = [-HX, FX[0] - FW, FX[0] + FW, FX[1] - FW, FX[1] + FW, HX];
for (let i = 0; i + 1 < XS.length; i++) { if (i % 2 === 0) panel(XS[i], BASE, XS[i + 1], TOP); else { panel(XS[i], BASE, XS[i + 1], FY0); panel(XS[i], FY1, XS[i + 1], TOP); } }
for (const cx of FX) {                                                                             // the fire-hole: dark inside, ash on its floor
  const a = cx - FW, b = cx + FW, z1 = HZ - FD, d = R.dark;
  body.quad([[a, FY0, z1], d.at(0, 0), 0.5], [[b, FY0, z1], d.at(1, 0), 0.5], [[b, FY1, z1], d.at(1, 1), 0.4], [[a, FY1, z1], d.at(0, 1), 0.4]);
  body.quad([[a, FY0, HZ], fr(a, FY0), 0.8], [[a, FY0, z1], fr(a + 0.05, FY0), 0.55], [[a, FY1, z1], fr(a + 0.05, FY1), 0.45], [[a, FY1, HZ], fr(a, FY1), 0.7]);
  body.quad([[b, FY0, z1], fr(b - 0.05, FY0), 0.55], [[b, FY0, HZ], fr(b, FY0), 0.8], [[b, FY1, HZ], fr(b, FY1), 0.7], [[b, FY1, z1], fr(b - 0.05, FY1), 0.45]);
  body.quad([[a, FY1, HZ], d.at(0, 1), 0.45], [[a, FY1, z1], d.at(0, 0), 0.35], [[b, FY1, z1], d.at(1, 0), 0.35], [[b, FY1, HZ], d.at(1, 1), 0.45]);
  body.quad([[a, FY0, z1], R.ash.at(0, 0), 0.6], [[a, FY0, HZ], R.ash.at(0, 1), 0.85], [[b, FY0, HZ], R.ash.at(1, 1), 0.85], [[b, FY0, z1], R.ash.at(1, 0), 0.6]);
  fit.box([cx, FY1 + 0.04, HZ + 0.012], [FW + 0.12, 0.04, 0.012], { pz: R.iron, py: R.iron, ny: R.iron, px: R.iron, nx: R.iron }, { shade: { ny: 0.6 } });       // the lintel
}
{ // the top: each half a rectangle round a hole, as quads from the hole out to the rectangle's edge (corners included)
  const tp = (x, z) => R.top.at((x + HX) / (2 * HX), (HZ - z) / (2 * HZ));
  for (const sx of [-1, 1]) {
    const cx = sx * PX, x0 = Math.min(0, sx * HX), x1 = Math.max(0, sx * HX), E = [];
    const corners = [[x1, HZ], [x0, HZ], [x0, -HZ], [x1, -HZ]];                                   // counter-clockwise seen from above (x right, z toward the viewer)
    for (let c = 0; c < 4; c++) { const [p, q] = [corners[c], corners[(c + 1) % 4]]; for (let k = 0; k < 4; k++) E.push([p[0] + (q[0] - p[0]) * k / 4, p[1] + (q[1] - p[1]) * k / 4]); }
    const ring = E.map(([x, z]) => { const a = Math.atan2(z - PZ, x - cx); return [cx + HOLE * Math.cos(a), PZ + HOLE * Math.sin(a)]; });
    for (let k = 0; k < 16; k++) { const k1 = (k + 1) % 16, P = ([x, z]) => [[x, TOP, z], tp(x, z)];
      body.quad(P(ring[k]), P(ring[k1]), P(E[k1]), P(E[k])); }
  }
}

// ---- the pots: a lathe from the outside (below the brick) over the lip and down inside; one full of earth and thrift, one of rain
const POT = [[0.62, 1.40], [0.65, 1.60], [0.678, 1.68], [0.636, 1.738], [0.57, 1.70], [0.55, 1.62], [0.53, 1.47]];
const LIP = [0, -0.03, -0.09, -0.15, -0.11, -0.04, 0];                                            // how far the broken lip drops
within(pots, move([PX, 0, PZ]), (p) => p.lathe(POT, 14, R.potA, { lift: (i, j) => ((j === 10 || j === 11) ? LIP[i] : 0) * (j === 10 ? 0.8 : 1), shade: (i) => (i === 0 ? 0.6 : i >= 5 ? 0.7 : 1) }));
within(pots, compose(move([-PX, 0, PZ]), rotY(rad(40))), (p) => { p.lathe(POT, 14, R.potB, { shade: (i) => (i === 0 ? 0.6 : i >= 5 ? 0.7 : 1) }); p.lathe([[0.53, 1.47], [0, 1.47]], 14, R.water); });
{ // the earth and the thrift in the cracked pot: a mounded cushion, and nine heads on stalks, two of them leaning out over the broken lip
  const D = [[0.53, 1.47], [0.545, 1.66], [0.48, 1.76], [0.34, 1.84], [0.17, 1.88], [0, 1.89]], wob = Array.from({ length: 10 }, () => 1 + 0.07 * (2 * rnd() - 1));
  within(green, move([PX, 0, PZ]), (p) => p.lathe(D, 10, R.dome, { wobble: (i, j) => (i ? wob[j % 10] : 1), shade: (i) => [0.7, 0.85, 1, 1, 1, 1][i] }));
  const domeY = (r) => { for (let i = 0; i + 1 < D.length; i++) { const [r0, y0] = D[i], [r1, y1] = D[i + 1]; if (r <= r0 && r >= r1) return y0 + (y1 - y0) * (r0 - r) / (r0 - r1); } return 1.89; };
  const HEADS = [[0.0, 0, 0.09], [0.17, 20, 0.08], [0.19, 140, 0.085], [0.2, 250, 0.075], [0.3, 80, 0.07], [0.32, 190, 0.08], [0.31, 320, 0.075], [0.40, 30, 0.06], [0.41, 125, 0.065], [0.40, 225, 0.06], [0.50, 263, 0.13], [0.47, 283, 0.11]];
  HEADS.forEach(([rho, deg, hgt], k) => {
    const a = rad(deg), d = [Math.cos(a), 0, -Math.sin(a)], side = [Math.sin(a), 0, Math.cos(a)], base = add([PX, 0, PZ], add(mul(d, rho), [0, domeY(rho) - 0.01, 0]));
    const out = rho > 0.45 ? 0.2 : 0.03, c = add(base, add(mul(d, out), [0, hgt, 0])), st = R.stalk;
    for (const s of [1, -1]) green.tri([add(base, mul(side, -0.012 * s)), st.at(0, 0)], [add(base, mul(side, 0.012 * s)), st.at(1, 0)], [c, st.at(0.5, 1)]);
    const n = norm(add(norm(sub(c, base)), [0, 1.2, 0])), ex = norm(cross(n, side)), ey = cross(n, ex), sw = R.heads.sub(k / 12 + 0.004, 0, (k + 1) / 12 - 0.004, 1), rr = 0.062 + 0.012 * rnd(), t0 = rnd() * 6;
    const rim = (j) => { const b = t0 + 2 * Math.PI * (j % 5) / 5; return [add(add(c, mul(n, -0.012)), add(mul(ex, rr * Math.cos(b)), mul(ey, rr * Math.sin(b)))), sw.at(0.5 + 0.42 * Math.cos(b), 0.15), 0.8]; };
    for (let j = 0; j < 5; j++) green.tri(rim(j), rim(j + 1), [add(c, mul(n, 0.04)), sw.at(0.5, 1), 1]);
  });
}

// ---- the chimney: a brick base at the back between the pots, an iron stack on it leaning a little, a band and a lip at the top
{ const cz = -0.6, cb = 1.86;
  body.box([0, (TOP + cb) / 2 - 0.02, cz], [0.27, (cb - TOP) / 2 + 0.02, 0.24], { pz: R.front.sub(0.4, 0.82, 0.58, 0.98), px: R.side.sub(0.1, 0.82, 0.3, 0.98), nx: R.side.sub(0.6, 0.82, 0.8, 0.98), nz: R.back.sub(0.4, 0.82, 0.58, 0.98), py: R.top.sub(0.45, 0.05, 0.55, 0.15) });
  const lean = (y) => [0.03 * (y - cb), y, cz - 0.02 * (y - cb)], c = R.chimney;
  { const p = fit;
    const S = [[0.165, cb - 0.02], [0.155, 2.2], [0.15, 2.5], [0.17, 2.56], [0.17, 2.6], [0.12, 2.6], [0.12, 2.4]];
    const ring = (r, y, j) => { const a = 2 * Math.PI * j / 8; return add(lean(y), [r * Math.cos(a), 0, -r * Math.sin(a)]); };
    for (let i = 0; i + 1 < S.length; i++) for (let j = 0; j < 8; j++) { const v0 = i / (S.length - 1), v1 = (i + 1) / (S.length - 1);
      p.quad([ring(S[i][0], S[i][1], j), c.at(j / 8, v0)], [ring(S[i][0], S[i][1], j + 1), c.at((j + 1) / 8, v0)], [ring(S[i + 1][0], S[i + 1][1], j + 1), c.at((j + 1) / 8, v1), i >= 4 ? 0.45 : 1], [ring(S[i + 1][0], S[i + 1][1], j), c.at(j / 8, v1), i >= 4 ? 0.45 : 1]); }
    for (let j = 0; j < 8; j++) p.quad([ring(0.172, 2.18, j), c.at(j / 8, 0.4)], [ring(0.172, 2.18, j + 1), c.at((j + 1) / 8, 0.4)], [ring(0.172, 2.24, j + 1), c.at((j + 1) / 8, 0.46)], [ring(0.172, 2.24, j), c.at(j / 8, 0.46)]);
  }
}

// ---- the fire door hanging open on the right-hand hole; the skimmer leaning on the +X end; three fallen bricks
{ const hx = FX[1] + FW + 0.02, a = rad(118), w = 2 * FW + 0.04, d = [-Math.cos(a), 0, Math.sin(a)], z0 = HZ + 0.03, i = R.iron;
  const P = (s, y) => add([hx, y, z0], mul(d, s)), Q = (s, y, t) => [P(s, y), i.at(s / w, (y - FY0) / (FY1 - FY0 + 0.04)), t];
  fit.quad(Q(0, FY0 - 0.01, 0.8), Q(w, FY0 - 0.01, 0.8), Q(w, FY1 + 0.03, 1), Q(0, FY1 + 0.03, 1)); fit.quad(Q(w, FY0 - 0.01, 0.6), Q(0, FY0 - 0.01, 0.6), Q(0, FY1 + 0.03, 0.75), Q(w, FY1 + 0.03, 0.75));
  for (const y of [FY0 + 0.08, FY1 - 0.06]) fit.box([hx + 0.015, y, z0], [0.025, 0.035, 0.025], i); }
{ const foot = [HX + 0.62, 0, 0.62], top = [HX - 0.02, TOP + 0.02, 0.62], d = norm(sub(top, foot)), end = add(foot, mul(d, 2.35)), s = [0, 0, 1], n = cross(d, s);
  fit.tube([foot, end], [0.024, 0.02], 4, R.pole, { twist: Math.PI / 4 });
  const c = add(end, mul(d, 0.17)), pan = (k) => { const a = 2 * Math.PI * k / 8; return add(c, add(mul(d, 0.17 * Math.cos(a)), mul(s, 0.17 * Math.sin(a)))); }, uv = (k) => R.pan.at(0.5 + 0.5 * Math.cos(2 * Math.PI * k / 8), 0.5 + 0.5 * Math.sin(2 * Math.PI * k / 8));
  const ctr = (o) => add(c, mul(n, o));
  for (let k = 0; k < 8; k++) { fit.tri([pan(k), uv(k)], [pan(k + 1), uv(k + 1)], [ctr(0.03), R.pan.at(0.5, 0.5)]); fit.tri([pan(k + 1), uv(k + 1), 0.7], [pan(k), uv(k), 0.7], [ctr(0.01), R.pan.at(0.5, 0.5), 0.7]); }
  fit.tube([add(end, mul(d, -0.04)), add(end, mul(d, 0.03))], 0.032, 4, R.iron, { twist: Math.PI / 4 }); }
for (const [x, z, yaw, tilt] of [[-1.05, HZ + 0.34, 20, 0], [-0.82, HZ + 0.52, -35, 0], [-1.32, HZ + 0.22, 70, 0.35]])
  within(fit, compose(move([x, 0.035, z]), rotY(rad(yaw)), (p) => [p[0], p[1] * Math.cos(tilt) + p[0] * Math.sin(tilt) * 0.5, p[2]]), (p) => p.box([0, 0, 0], [0.11, 0.035, 0.055], { py: R.brick, pz: R.brick, nz: R.brick, px: R.brick, nx: R.brick }, { shade: { pz: 0.85, nz: 0.85 } }));

await emit(m, R, ATLAS, args);
