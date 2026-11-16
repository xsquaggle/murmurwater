// build-puffin.mjs : the sloop Puffin afloat (boats/puffin.glb), built in code (no generation job).
// Usage: node build-puffin.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg] [--sockets sockets.json]     (paint with paint-atlas.py)
// Her lines and the pieces of her hull are in puffin.mjs. Origin on the centre line, half way along her, at the
// waterline; bow toward +Z, port is +X. 5.4 m long with the rudder, 2.0 m in the beam, 0.6 m of draft.
// Materials: `main`, `Glass` (the stern lantern's panes; the atlas is also the glow map) and `HullMask`.
// Child mesh nodes: `Tiller` (the tiller and the rudder it turns; its origin is on the pintles' axis at the height of
// the tiller) and `HullMask` (a lid 5 cm under the sheer that the game gives a material which keeps the sea out of her).
// Empty nodes: Helm, Stand, MastStep, BowStem, Lantern, Crew1, Crew2. The +Z of each is the way to face there.
import fs from 'node:fs';
import { Model, pack, cli, emit, within, rotX, rotY, rotZ, move, compose, rad, add, sub, mul, norm, cross } from './kit.mjs';
import { mirrored, quadToward, triToward } from './fish.mjs';
import { cagedLantern, lanternRects } from './fen-parts.mjs';
import * as P from './puffin.mjs';

const argv = process.argv.slice(2); const si = argv.indexOf('--sockets'); const SOCKETS = si < 0 ? null : argv.splice(si, 2)[1];
const args = cli(argv); const ATLAS = [2048, 2048];
export const C = { bone: '#EFE3C8', ink: '#2B2634', coral: '#E0685F', bottom: '#7E4038', teal: '#3F8F8A', roof: '#E2D4B2' };
const { ZT, SOLE, SEAT, DECK_Z } = P, S0 = P.lines(ZT).S;
const oiled = (o = {}) => ({ mat: 'wood', tone: 'oiled', along: 'x', weather: 0.12, ...o });
const R = pack(...ATLAS, {
  topsides: [1520, 150, { mat: 'planked', colour: C.bone, planks: 4, first: true, wear: 0.07 }], sheer: [1520, 40, { mat: 'planked', colour: C.ink, planks: 0, wear: 0.1, under: '#6B5A4A' }],
  boot: [1520, 36, { mat: 'planked', colour: C.coral, planks: 0, wear: 0.1 }], bottom: [1520, 170, { mat: 'antifoul' }],
  rub: [1520, 20, oiled({ weather: 0.2 })], rail: [1520, 50, oiled({ edge: 0.25 })],
  keel: [600, 60, { mat: 'antifoul', slime: 0.15 }], stem: [150, 320, { mat: 'bands', ys: [P.STEM_BOX.y0, P.STEM_BOX.y1], top: 0.955 - P.STRAKE, wood_from: 0.95, wear: 0.1 }],
  transomOut: [560, 300, { mat: 'bands', ys: [P.TRANSOM.y0, P.TRANSOM.y1], planks: 4, top: S0 - P.STRAKE, wear: 0.1 }],
  transomIn: [400, 200, oiled({ planks: 5, ao: { bottom: 0.3 } })], cap: [300, 22, oiled()],
  ceiling: [1000, 210, oiled({ planks: 5, ao: { bottom: 0.35 } })],
  sole: [660, 300, { mat: 'wood', planks: 9, along: 'x', tone: 'pale', weather: 0.35, nails: 3 }],
  bench: [300, 170, oiled({ planks: 3 })], sheets: [420, 220, oiled({ planks: 7, along: 'y' })],
  riser: [330, 160, oiled({ planks: 3, light: 0.72, ao: { bottom: 0.35 } })],
  deck: [520, 600, { mat: 'wood', planks: 13, along: 'y', tone: 'pale', weather: 0.3 }], bulk: [520, 240, oiled({ planks: 12, along: 'y', ao: { bottom: 0.3, top: 0.3 } })],
  cuddySide: [420, 90, oiled({ planks: 2, edge: 0.2 })], cuddyEnd: [420, 90, oiled({ planks: 2, edge: 0.2 })],
  roof: [360, 380, { mat: 'planked', colour: C.roof, planks: 0, wear: 0.025 }], eave: [300, 18, { mat: 'wood', tone: 'dark', along: 'x' }],
  rudder: [120, 460, { mat: 'bands', ys: [-0.6, 0.66], colour: C.coral, wear: 0.12 }], rudderEdge: [24, 300, { mat: 'planked', colour: C.coral, planks: 0, wear: 0.1 }],
  tiller: [256, 36, { mat: 'wood', tone: 'pale', along: 'x', weather: 0.15 }],
  name: [440, 106, { mat: 'lettering', text: 'PUFFIN', ink: C.bone, rim: 0.07, edge: 0.3 }], badge: [200, 200, { mat: 'badge' }], badgeEdge: [120, 14, { mat: 'flat', colour: C.ink }],
  door: [150, 220, { mat: 'wood', planks: 4, along: 'y', tone: 'teal', weather: 0.3, nails: 2, edge: 0.5 }], port: [72, 72, { mat: 'porthole' }],
  hatch: [150, 120, oiled({ planks: 5, edge: 0.4 })],
  post: [48, 300, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.3 }], dark: [200, 60, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.2 }],
  iron: [64, 64, { mat: 'iron', rust: 0.25 }], brass: [64, 64, { mat: 'brass', patina: 0.25 }],
  rope: [288, 32, { mat: 'rope', pitch: 48 }], float: [64, 64, { mat: 'cloth', stripes: [C.coral, '#F2E3C6'], n: 2, along: 'x', worn: 0.2 }], buoy: [256, 40, { mat: 'cloth', stripes: [C.coral, '#F2E3C6'], n: 8, along: 'y', worn: 0.15 }],
  pot: [260, 150, { mat: 'wicker', rows: 11, ribs: 10 }], potEnd: [110, 60, { mat: 'wicker', rows: 6, ribs: 8, light: 0.8 }], hole: [24, 24, { mat: 'flat', colour: '#1E1A1C' }],
  bucket: [200, 90, { mat: 'wood', planks: 9, along: 'y', tone: 'pale', weather: 0.3, tile_x: true, ao: { bottom: 0.2 } }], bucketIn: [120, 60, { mat: 'wood', planks: 9, along: 'y', tone: 'dark', weather: 0.2, tile_x: true, light: 0.7 }],
  ...lanternRects(200, 'warm'),
});

const m = new Model('puffin');
m.material('main', { kind: 'texture', roughness: 0.88 });
m.material('Glass', { kind: 'texture', roughness: 0.4, emissive: [1, 1, 1], glow: true });
m.material('HullMask', { kind: 'plain', color: [0.03, 0.03, 0.04], roughness: 1 });

// ---- places
const TILLER_Y = S0 - P.NOTCH[1] + 0.055, PIVOT = [0, TILLER_Y, ZT - 0.032];
const HELM = [0.26, SOLE, -1.72], GRIP = [0, SOLE + 0.62, HELM[2] - 0.09], STAND = [0, SOLE, -0.12];
const MAST = [0, P.deckY(0, 0.515), 0.515], BOW = [0, P.STEM_TOP, P.stemZ(P.STEM_TOP) - 0.075];
const CAT = [-0.26, P.roofY(-0.26, 1.27), 1.27], HOLLIS = [0.62, SOLE, -0.70];
m.node('Tiller', PIVOT); m.node('HullMask', [0, 0, 0]);

const hull = m.part('hull', { crease: 62 }), wood = m.part('wood', { crease: 40 }), fit = m.part('fittings', { crease: 40 }), round = m.part('round', { crease: 50 });
const glass = m.part('glass', { material: 'Glass', crease: 20 }), til = m.part('tiller', { node: 'Tiller', crease: 45 }), mask = m.part('mask', { node: 'HullMask', material: 'HullMask' });
P.shell(hull, R); P.backbone(wood, R); P.transom(wood, { out: R.transomOut, in: R.transomIn, cap: R.cap });
P.rubrail(wood, R.rub); P.rail(wood, R.rail); P.ceiling(wood, R.ceiling); P.cockpit(wood, R); P.deck(wood, R); P.cuddy(wood, { side: R.cuddySide, end: R.cuddyEnd, roof: R.roof, eave: R.eave });
P.hullMask(mask);

// ---- helpers
const disc = (part, c, e1, e2, r, sides, rect, { proud = 0, edge = null, flipU = false } = {}) => {            // a flat round face in the plane of e1 (to the right) and e2 (up)
  const n = norm(cross(e1, e2)), at = (a, k = 1, d = proud) => add(add(c, mul(n, d)), add(mul(e1, k * r * Math.cos(a)), mul(e2, k * r * Math.sin(a)))), uv = (a, k = 1) => rect.at(0.5 + (flipU ? -0.5 : 0.5) * k * Math.cos(a), 0.5 + 0.5 * k * Math.sin(a));
  for (let i = 0; i < sides; i++) { const a = 2 * Math.PI * (i + 0.5) / sides, b = 2 * Math.PI * (i + 1.5) / sides;
    triToward(part, [at(0, 0), uv(0, 0)], [at(a), uv(a)], [at(b), uv(b)], n);
    if (edge) quadToward(part, [at(a, 1, 0), edge.at(i / sides, 0)], [at(b, 1, 0), edge.at((i + 1) / sides, 0)], [at(b), edge.at((i + 1) / sides, 1)], [at(a), edge.at(i / sides, 1)], add(mul(e1, Math.cos((a + b) / 2)), mul(e2, Math.sin((a + b) / 2)))); }
};
const slabZY = (part, outline, w, side, edge, box) => {                                                          // a plate in the Y-Z plane, 2w thick: outline [[z, y], ...]
  const c = outline.reduce((s, q) => [s[0] + q[0] / outline.length, s[1] + q[1] / outline.length], [0, 0]), uv = ([z, y]) => side.at((box.z1 - z) / (box.z1 - box.z0), (y - box.y0) / (box.y1 - box.y0)), N = outline.length;
  for (let i = 0; i < N; i++) { const a = outline[i], b = outline[(i + 1) % N];
    for (const sx of [1, -1]) triToward(part, [[sx * w, c[1], c[0]], uv(c)], [[sx * w, a[1], a[0]], uv(a)], [[sx * w, b[1], b[0]], uv(b)], [sx, 0, 0]);
    const d = [b[0] - a[0], b[1] - a[1]], out = [0, d[0], -d[1]], mid = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1]], o = (out[2] * mid[0] + out[1] * mid[1]) >= 0 ? out : mul(out, -1);
    quadToward(part, [[-w, a[1], a[0]], edge.at(0, i / N)], [[w, a[1], a[0]], edge.at(1, i / N)], [[w, b[1], b[0]], edge.at(1, (i + 1) / N)], [[-w, b[1], b[0]], edge.at(0, (i + 1) / N)], o); }
};
const all = (r) => ({ px: r, nx: r, py: r, ny: r, pz: r, nz: r });

// ---- the rudder and the tiller (they turn together about the pintles)
const RUD = { z0: ZT - 0.29, z1: ZT, y0: -0.6, y1: 0.66 };
slabZY(til, [[ZT - 0.012, -0.57], [ZT - 0.27, -0.55], [ZT - 0.28, -0.05], [ZT - 0.22, 0.15], [ZT - 0.13, 0.40], [ZT - 0.115, TILLER_Y + 0.085], [ZT - 0.012, TILLER_Y + 0.085]], 0.028, R.rudder, R.rudderEdge, RUD);
for (const y of [0.33, -0.01]) til.box([0, y, ZT - 0.075], [0.036, 0.022, 0.068], all(R.iron));
for (const y of [0.33, -0.01]) fit.box([0, y, ZT - 0.004], [0.10, 0.022, 0.010], all(R.iron));                    // the gudgeons' straps on the transom
const TPATH = [[PIVOT[2] - 0.035, TILLER_Y], [ZT + 0.14, TILLER_Y], [-2.12, TILLER_Y - 0.035], [-1.99, GRIP[1] + 0.05], [-1.90, GRIP[1] + 0.006], [GRIP[2] + 0.08, GRIP[1]], [GRIP[2] + 0.10, GRIP[1]]];
til.tube(TPATH.map(([z, y]) => [0, y, z]), [0.032, 0.031, 0.029, 0.026, 0.023, 0.022, 0.030], 6, R.tiller, { lay: 1 });

// ---- name board and badge on the transom
fit.box([0.385, 0.355, ZT - 0.014], [0.29, 0.07, 0.014], { nz: R.name, px: R.cap, nx: R.cap, py: R.cap, ny: R.cap });
disc(fit, [-0.385, 0.355, ZT], [-1, 0, 0], [0, 1, 0], 0.135, 12, R.badge, { proud: 0.014, edge: R.badgeEdge });

// ---- the mast's tabernacle on the bridge deck
for (const sx of [1, -1]) fit.box([sx * 0.135, MAST[1] + 0.15, MAST[2]], [0.027, 0.17, 0.095], all(R.dark), { warp: (p) => [p[0], p[1], p[2] + (p[1] > MAST[1] + 0.2 ? (p[2] > MAST[2] ? -0.03 : 0.03) : 0)] });
fit.tube([[-0.19, MAST[1] + 0.20, MAST[2]], [0.19, MAST[1] + 0.20, MAST[2]]], 0.016, 5, R.iron);

// ---- cuddy: portholes, a hatch on the roof, the door in the bulkhead, a ring buoy beside it
mirrored(fit, (p) => { for (const z of [0.98, 1.44]) { const w0 = P.CUDDY.hw(z), w1 = P.CUDDY.hw(z + 0.1), yb = P.deckY(w0, z) - 0.02, yt = P.deckY(0, z) - 0.02 + P.CUDDY.h(z), e1 = norm([w1 - w0, 0, 0.1]), e2 = norm([-P.CUDDY.tumble, yt - yb, 0]);
  disc(p, [w0 - P.CUDDY.tumble / 2, (yb + yt) / 2 + 0.005, z], mul(e1, -1), e2, 0.072, 8, R.port, { proud: 0.012, edge: R.brass }); } });
{ const y = P.roofY(0, 0.90); fit.box([0, y + 0.012, 0.90], [0.20, 0.024, 0.16], { py: R.hatch, px: R.eave, nx: R.eave, pz: R.eave, nz: R.eave }); }
fit.box([0.37, (SOLE + 0.05 + 0.40) / 2, DECK_Z - 0.014], [0.21, (0.40 - SOLE - 0.05) / 2, 0.014], { nz: R.door, px: R.dark, nx: R.dark, py: R.dark, ny: R.dark });
round.torus(0.028, 0.007, 6, 3, R.brass, { xf: compose(move([0.50, 0.10, DECK_Z - 0.036]), rotX(rad(90))) });
round.torus(0.155, 0.045, 10, 5, R.buoy, { xf: compose(move([-0.37, 0.13, DECK_Z - 0.05]), rotX(rad(90))) });

// ---- foredeck: a samson post and a coil of rope
{ const y = P.deckY(0, 2.2); fit.box([0, y + 0.10, 2.20], [0.042, 0.115, 0.042], all(R.post)); fit.tube([[-0.10, y + 0.15, 2.20], [0.10, y + 0.15, 2.20]], 0.013, 5, R.iron); }
const coil = (at, turn = 0) => { for (const [rr, dy] of [[0.135, 0.022], [0.082, 0.022], [0.108, 0.058]]) round.torus(rr, 0.022, 9, 3, R.rope, { xf: compose(move([at[0], at[1] + dy, at[2]]), rotY(turn)) }); };
coil([-0.22, P.deckY(-0.22, 2.03), 2.03], 0.4); coil([0.50, SEAT, -2.14], 1.1);

// ---- an anchor stowed on the foredeck (port side), its stock folded along the shank
{ const A = [0.215, 2.02], B = [0.095, 2.43], L = Math.hypot(B[0] - A[0], B[1] - A[1]), d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [d[1], -d[0]];
  const at = (s, w, up = 0.018) => { const x = A[0] + d[0] * s + n[0] * w, z = A[1] + d[1] * s + n[1] * w; return [x, P.deckY(x, z) + up, z]; };
  fit.tube([at(0, 0), at(L, 0)], [0.017, 0.012], 5, R.iron);
  fit.tube([at(0.105, -0.12, 0.014), at(0.03, -0.08, 0.016), at(-0.005, 0), at(0.03, 0.08, 0.016), at(0.105, 0.12, 0.014)], [0.007, 0.013, 0.017, 0.013, 0.007], 4, R.iron);
  for (const k of [-1, 1]) quadToward(fit, [at(0.14, k * 0.125, 0.02), R.iron.at(0.5, 1)], [at(0.10, k * 0.155, 0.022), R.iron.at(1, 0.5)], [at(0.06, k * 0.11, 0.02), R.iron.at(0.5, 0)], [at(0.10, k * 0.09, 0.03), R.iron.at(0, 0.5)], [0, 1, 0]);
  fit.tube([at(L - 0.31, 0.034, 0.02), at(L - 0.035, 0.034, 0.02)], [0.013, 0.010], 4, R.dark);
  round.torus(0.028, 0.006, 6, 3, R.iron, { xf: move(at(L + 0.022, 0, 0.012)) }); }

// ---- chainplates for the shrouds (the rig's shrouds come down to the rail here) and the mainsheet's horse over the tiller
for (const sx of [1, -1]) { const l = P.lines(P.CHAIN_Z); fit.box([sx * (l.B + 0.012), l.S - 0.07, P.CHAIN_Z], [0.008, 0.10, 0.022], all(R.iron), { warp: (q) => [q[0] + sx * (l.S - q[1]) * -0.10, q[1], q[2]] }); }
fit.tube([[-0.30, S0 + 0.012, ZT + 0.03], [-0.29, S0 + 0.125, ZT + 0.03], [0.29, S0 + 0.125, ZT + 0.03], [0.30, S0 + 0.012, ZT + 0.03]], 0.011, 4, R.iron);

// ---- stern: the lantern on its post, starboard quarter
const LPOST = { foot: [-0.60, SEAT, -2.24], top: [-0.63, 1.33, -2.27] };
fit.box([0, 0, 0], [0.036, 0.5, 0.036], all(R.post), { warp: (p) => { const k = p[1] + 0.5; return [LPOST.foot[0] + (LPOST.top[0] - LPOST.foot[0]) * k + p[0], LPOST.foot[1] + (LPOST.top[1] - LPOST.foot[1]) * k, LPOST.foot[2] + (LPOST.top[2] - LPOST.foot[2]) * k + p[2]]; } });
const ARM = { a: [LPOST.top[0] - 0.05, LPOST.top[1] - 0.07, LPOST.top[2]], b: [LPOST.top[0] + 0.30, LPOST.top[1] - 0.03, LPOST.top[2] + 0.02] };
fit.box([(ARM.a[0] + ARM.b[0]) / 2, (ARM.a[1] + ARM.b[1]) / 2, (ARM.a[2] + ARM.b[2]) / 2], [0.175, 0.03, 0.03], all(R.dark), { warp: (p) => [p[0], p[1] + (p[0] - ARM.a[0]) * 0.11, p[2] + (p[0] - ARM.a[0]) * 0.06] });
fit.tube([[LPOST.top[0] + 0.02, LPOST.top[1] - 0.30, LPOST.top[2]], [LPOST.top[0] + 0.19, LPOST.top[1] - 0.085, LPOST.top[2] + 0.01]], 0.016, 4, R.dark);                       // a knee under the arm
const LAN = { x: ARM.b[0] - 0.035, z: ARM.b[2] + 0.012, h: 0.30 }, lanTop = ARM.b[1] - 0.045, lan = cagedLantern(fit, glass, R, { at: [LAN.x, lanTop - LAN.h - 0.03, LAN.z], h: LAN.h, r: 0.056 });
fit.tube([[LAN.x, lan.ringMid, LAN.z], [LAN.x, ARM.b[1] - 0.02, LAN.z]], 0.008, 4, R.iron, { open: true });
const FLAME = [LAN.x, lan.glassMid, LAN.z];

// ---- cockpit clutter: a crab pot on the stern sheets, a bucket in the well, a boat hook along the starboard side
{ const c = [-0.63, SEAT, -1.90], r = 0.17, L = 0.44, K = 6, pt = (k, z) => [c[0] + r * Math.cos(Math.PI * k / K), c[1] + r * Math.sin(Math.PI * k / K) * 1.05, c[2] + z];
  for (let k = 0; k < K; k++) quadToward(fit, [pt(k, -L / 2), R.pot.at(0, k / K)], [pt(k, L / 2), R.pot.at(1, k / K)], [pt(k + 1, L / 2), R.pot.at(1, (k + 1) / K)], [pt(k + 1, -L / 2), R.pot.at(0, (k + 1) / K)], [Math.cos(Math.PI * (k + 0.5) / K), Math.sin(Math.PI * (k + 0.5) / K), 0]);
  for (const s of [-1, 1]) { for (let k = 0; k < K; k++) triToward(fit, [[c[0], c[1], c[2] + s * L / 2], R.potEnd.at(0.5, 0)], [pt(k, s * L / 2), R.potEnd.at(0.5 + 0.5 * Math.cos(Math.PI * k / K), Math.sin(Math.PI * k / K))], [pt(k + 1, s * L / 2), R.potEnd.at(0.5 + 0.5 * Math.cos(Math.PI * (k + 1) / K), Math.sin(Math.PI * (k + 1) / K))], [0, 0, s]);
    disc(fit, [c[0], c[1] + 0.075, c[2] + s * L / 2], [s, 0, 0], [0, 1, 0], 0.05, 6, R.hole, { proud: 0.004 }); } }
within(round, move([-0.40, SOLE, 0.10]), (b) => { b.lathe([[0.105, 0], [0.13, 0.25]], 8, R.bucket); b.lathe([[0.13, 0.25], [0.115, 0.25]], 8, R.iron); b.lathe([[0.115, 0.25], [0.095, 0.03]], 8, R.bucketIn); b.lathe([[0.095, 0.03], [0, 0.03]], 8, R.bucketIn);
  for (const y of [0.05, 0.19]) b.lathe([[0.105 + 0.1 * y + 0.004, y - 0.012], [0.105 + 0.1 * y + 0.006, y + 0.012]], 8, R.iron); });
within(round, compose(move([-0.36, SEAT + 0.062, -1.74]), rotY(rad(25)), rotZ(rad(90))), (b) => { b.lathe([[0, -0.10], [0.045, -0.07], [0.062, 0], [0.04, 0.085], [0, 0.10]], 6, R.float); });      // a pot float lying beside the pot
{ const y = SEAT + 0.20, pts = [-1.38, -0.5, 0.26].map((z) => [-(P.inside(z, y) - 0.03), y, z]); fit.tube(pts, 0.016, 5, R.tiller, { lay: 3 });
  fit.tube([pts[2], add(pts[2], [0, 0, 0.07]), add(pts[2], [0.03, 0.035, 0.085])], [0.012, 0.011, 0.006], 4, R.brass);
  for (const q of [pts[0], pts[1]]) fit.box(add(q, [-0.012, -0.022, 0.1]), [0.02, 0.012, 0.012], all(R.iron)); }

// ---- cleats on the rail
const cleat = (x, z, turn = 0) => { const y = P.lines(z).S + P.RAIL.up; within(fit, compose(move([x, y, z]), rotY(turn)), (f) => { f.box([0, 0.012, 0], [0.018, 0.012, 0.03], all(R.iron)); f.tube([[0, 0.034, -0.085], [0, 0.03, -0.04], [0, 0.03, 0.04], [0, 0.034, 0.085]], [0.008, 0.014, 0.014, 0.008], 4, R.iron); }); };
for (const sx of [1, -1]) { cleat(sx * (P.lines(-2.0).B - 0.035), -2.0, sx * 0.12); cleat(sx * (P.lines(-0.2).B - 0.035), -0.2); cleat(sx * (P.lines(1.75).B - 0.035), 1.75, -sx * 0.42); }

// ---- the places the game reads
m.empty('Helm', HELM).empty('Stand', STAND).empty('MastStep', MAST).empty('BowStem', BOW).empty('Lantern', FLAME).empty('Crew1', CAT, 'root', -90).empty('Crew2', HOLLIS, 'root', 90);
const r3 = (p) => p.map((v) => +v.toFixed(3));
const sockets = { Helm: r3(HELM), Stand: r3(STAND), MastStep: r3(MAST), BowStem: r3(BOW), Lantern: r3(FLAME), Crew1: { at: r3(CAT), yaw: -90 }, Crew2: { at: r3(HOLLIS), yaw: 90 }, Tiller: { pivot: r3(PIVOT), grip: r3(GRIP) },
  sole: SOLE, seat: +SEAT.toFixed(3), sheerAmidships: P.lines(-0.3).S, boomMustClear: +(SOLE + 1.75).toFixed(3) };
if (SOCKETS) fs.writeFileSync(SOCKETS, JSON.stringify(sockets, null, 1));
await emit(m, R, ATLAS, args, { size: 2048 });
