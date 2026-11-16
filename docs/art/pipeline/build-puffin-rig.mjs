// build-puffin-rig.mjs : the Puffin's rig (boats/puffin-rig.glb), built in code (no generation job).
// Usage: node build-puffin-rig.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg] [--sockets rig.json]     (paint with paint-atlas.py)
// Origin at the mast foot (the hull's `MastStep`), +Y up, bow toward +Z; the boom points aft (-Z). One material, `main`.
// The root mesh does not move: mast, shrouds (down to the hull's chainplates), forestay (to the stem head), a burgee.
// Two mesh nodes move, each with two morph targets:
//   `Main`  boom, gaff, mainsail and peak halyard. Its origin is on the mast's axis at the boom; the game turns it about Y.
//           0 `belly` (starts at 1): the sail filled toward +X; -1 fills it toward -X, 0 leaves it flat.
//           1 `furl`  (starts at 0): the gaff down on the boom with the cloth rolled between them.
//   `Jib`   the jib on the forestay; its origin is at its tack.
//           0 `belly` (starts at 1): filled toward +X, -1 toward -X.    1 `furl` (starts at 0): rolled up along the stay.
// The targets add up, so bring belly to 0 as furl goes to 1.
import fs from 'node:fs';
import { Model, pack, cli, emit, add, sub, mul, dot, norm, len, lerp, rad, rotX } from './kit.mjs';
import { quadToward, triToward } from './fish.mjs';
import * as P from './puffin.mjs';

const argv = process.argv.slice(2); const si = argv.indexOf('--sockets'); const SOCKETS = si < 0 ? null : argv.splice(si, 2)[1];
const args = cli(argv); const ATLAS = [1024, 1024];
const TAN = '#8E4B35', CORAL = '#E0685F', BONE = '#EFE3C8';

// ---- the rig in metres, in its own coordinates (the hull's, less the mast step)
const STEP = [0, P.deckY(0, P.MAST_Z), P.MAST_Z], rig = (p) => sub(p, STEP);
const MAST_H = 5.2, HOUNDS = 4.56, GOOSE = 1.10, RISE = 0.18, BOOM_L = 2.90, R_BOOM = 0.058, R_GAFF = 0.048;
const THROAT = 3.95, GAFF_L = 2.32, PEAK = rad(44);
const BOOM = [[0, GOOSE, -0.10], [0, GOOSE + RISE, -BOOM_L]], boomY = (z) => GOOSE + RISE * (-z / BOOM_L);
const GAFF = [[0, THROAT, -0.10], [0, THROAT + GAFF_L * Math.sin(PEAK), -0.10 - GAFF_L * Math.cos(PEAK)]];
const aBoom = norm(sub(BOOM[1], BOOM[0])), aGaff = norm(sub(GAFF[1], GAFF[0]));
const chain = P.lines(P.CHAIN_Z), SHROUD = (sx) => rig([sx * (chain.B + 0.012), chain.S + 0.03, P.CHAIN_Z]);
const STAY = [rig([0, P.deckY(0, 2.50) + 0.02, 2.50]), [0, HOUNDS + 0.04, 0.07]], aStay = norm(sub(STAY[1], STAY[0])), stayLen = len(sub(STAY[1], STAY[0]));
// mainsail: tack, clew, throat, peak (the head hangs just under the gaff, the foot lies just over the boom)
const up = (a) => [0, -a[2], a[1]];                                   // the normal of a direction in the Y-Z plane that points up (aft is -Z)
const upOf = (a) => { const n = up(a); return n[1] >= 0 ? n : mul(n, -1); };
const TACK = add(add(BOOM[0], mul(aBoom, 0.03)), mul(upOf(aBoom), R_BOOM * 0.9)), CLEW = add(add(BOOM[0], mul(aBoom, len(sub(BOOM[1], BOOM[0])) - 0.10)), mul(upOf(aBoom), R_BOOM * 0.9));
const HEAD0 = add(add(GAFF[0], mul(aGaff, 0.04)), mul(upOf(aGaff), -R_GAFF * 0.9)), HEAD1 = add(add(GAFF[0], mul(aGaff, GAFF_L - 0.06)), mul(upOf(aGaff), -R_GAFF * 0.9));
// jib: tack and head on the stay, the clew a little before the mast and high enough to clear a cat on the cuddy roof
const JTACK = add(STAY[0], mul(aStay, 0.34)), JHEAD = add(STAY[0], mul(aStay, stayLen * 0.90)), JCLEW = rig([0, 1.72, 0.80]);

const MB = { z0: TACK[2] + 0.02, z1: CLEW[2] - 0.02, y0: TACK[1] - 0.02, y1: HEAD1[1] + 0.02 }, JB = { z0: JCLEW[2] - 0.02, z1: JTACK[2] + 0.02, y0: JTACK[1] - 0.02, y1: JHEAD[1] + 0.02 };
// a point of a flat sail (it lies in the Y-Z plane) in its patch of the atlas: s runs aft from the luff, t up
const mUV = (p) => [(MB.z0 - p[2]) / (MB.z0 - MB.z1), (p[1] - MB.y0) / (MB.y1 - MB.y0)], jUV = (p) => [(JB.z1 - p[2]) / (JB.z1 - JB.z0), (p[1] - JB.y0) / (JB.y1 - JB.y0)];
const wood = (o = {}) => ({ mat: 'wood', tone: 'oiled', along: 'y', weather: 0.15, tile_x: true, ...o });
const R = pack(...ATLAS, {
  main: [560, 920, { mat: 'sailcloth', colour: TAN, cloths: 7, reefs: [0.16, 0.30], patch: [0.33, 0.42, 0.17, 0.10], outline: [TACK, CLEW, HEAD1, HEAD0].map(mUV), worn: 0.35 }],
  jib: [300, 620, { mat: 'sailcloth', colour: TAN, cloths: 4, outline: [JTACK, JCLEW, JHEAD].map(jUV), worn: 0.3, tabling: 0.045 }],
  mast: [112, 600, wood()], mastTop: [96, 110, { mat: 'planked', colour: BONE, planks: 0, wear: 0.08, tile_x: true }],
  spar: [400, 48, { mat: 'wood', tone: 'pale', along: 'x', weather: 0.2 }], jaw: [96, 64, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.2 }],
  iron: [48, 48, { mat: 'iron', rust: 0.2 }], rope: [144, 24, { mat: 'rope', pitch: 48 }], wire: [96, 16, { mat: 'flat', colour: '#2E2A2C', var: 0.1 }],
  coral: [64, 64, { mat: 'planked', colour: CORAL, planks: 0, wear: 0.06 }],
});

const m = new Model('puffin-rig');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.node('Main', [0, GOOSE, 0]).node('Jib', JTACK);
m.morphs('Main', ['belly', 'furl'], [1, 0]).morphs('Jib', ['belly', 'furl'], [1, 0]);

// ---- what stands: mast, hounds band, truck, burgee, shrouds, forestay
const mast = m.part('mast', { crease: 50 });
mast.lathe([[0.098, 0], [0.092, 2.4], [0.070, HOUNDS - 0.06]], 8, R.mast);
mast.lathe([[0.070, HOUNDS - 0.06], [0.080, HOUNDS - 0.03], [0.080, HOUNDS + 0.06], [0.062, HOUNDS + 0.09]], 8, R.iron);
mast.lathe([[0.062, HOUNDS + 0.09], [0.048, MAST_H - 0.08]], 8, R.mastTop);
mast.lathe([[0.048, MAST_H - 0.08], [0.078, MAST_H - 0.04], [0.05, MAST_H + 0.01], [0, MAST_H + 0.03]], 6, R.coral);
const stand = m.part('standing', { crease: 30 });
stand.tube([[0, MAST_H, 0], [0, MAST_H + 0.46, 0]], 0.010, 3, R.wire, { open: true });
for (const s of [1, -1]) triToward(stand, [[0, MAST_H + 0.46, -0.008], R.coral.at(0, 1)], [[0, MAST_H + 0.24, -0.008], R.coral.at(0, 0)], [[0, MAST_H + 0.33, -0.44], R.coral.at(1, 0.4)], [s, 0, 0]);
for (const sx of [1, -1]) { const lo = SHROUD(sx), hi = [sx * 0.07, HOUNDS, -0.01], d = norm(sub(hi, lo)), mid = add(lo, mul(d, 0.30));
  stand.tube([lo, mid], 0.022, 4, R.rope, { lay: 1 }); stand.tube([mid, hi], 0.011, 3, R.wire, { open: true }); }
stand.tube([STAY[0], STAY[1]], 0.011, 3, R.wire, { open: true });

// ---- Main: the boom with its jaws and a sheet block
const boom = m.part('boom', { node: 'Main', crease: 50 });
boom.tube([BOOM[0], lerp(BOOM[0], BOOM[1], 0.5), BOOM[1]], [R_BOOM, R_BOOM * 1.06, R_BOOM * 0.85], 6, R.spar, { lay: 1 });
boom.box([0, GOOSE, -0.09], [0.122, 0.064, 0.14], { px: R.jaw, nx: R.jaw, py: R.jaw, ny: R.jaw, nz: R.jaw, pz: R.jaw });
boom.box([0, boomY(-2.5) - R_BOOM - 0.045, -2.5], [0.028, 0.05, 0.04], { px: R.jaw, nx: R.jaw, py: R.iron, ny: R.iron, nz: R.jaw, pz: R.jaw });

// ---- furled: the gaff comes down the mast to lie along the boom on a roll of cloth
const FURL = { rx: 0.105, ry: 0.078, lift: 0.9 * R_BOOM };
const gaffDown0 = [0, boomY(GAFF[0][2]) + FURL.lift + 2 * FURL.ry + R_GAFF - 0.012, GAFF[0][2]];
const cs = dot(aGaff, aBoom), sn = aGaff[1] * aBoom[2] - aGaff[2] * aBoom[1], turn = (v) => [v[0], cs * v[1] - sn * v[2], sn * v[1] + cs * v[2]];
const lower = (p) => add(turn(sub(p, GAFF[0])), gaffDown0);                                    // the gaff keeps its length: it turns to the boom's slope and drops
const gaff = m.part('gaff', { node: 'Main', crease: 50, morph: [null, lower] });
gaff.tube(GAFF, [R_GAFF * 1.1, R_GAFF * 0.85], 6, R.spar, { lay: 1 });
gaff.box(add(GAFF[0], [0, 0.0, 0.02]), [0.108, 0.054, 0.125], { px: R.jaw, nx: R.jaw, py: R.jaw, ny: R.jaw, nz: R.jaw, pz: R.jaw }, { warp: (p) => add(GAFF[0], rotX(PEAK)(sub(p, GAFF[0]))) });                 // the jaws lean with the gaff
const HAL = { top: [0, MAST_H - 0.22, -0.06], on: add(GAFF[0], mul(aGaff, GAFF_L * 0.58)) };
m.part('halyard', { node: 'Main', crease: 30, morph: [null, (p) => (len(sub(p, HAL.top)) < 0.08 ? p : lower(p))] }).tube([add(HAL.on, mul(upOf(aGaff), R_GAFF)), HAL.top], 0.009, 3, R.wire, { open: true });

// ---- the mainsail: a grid from luff to leech and from foot to head, both sides
const sail = m.part('mainsail', { node: 'Main', crease: 80 });
{ const NU = 8, NV = 10, BELLY = 0.26, camber = (u) => 0.85 * Math.sin(Math.PI * Math.pow(u, 0.75)) + 0.25 * u * u;
  const foot = (u) => lerp(TACK, CLEW, u), head = (u) => lerp(HEAD0, HEAD1, u), flat = (u, v) => lerp(foot(u), head(u), v);
  const full = (u, v) => add(flat(u, v), [BELLY * Math.pow(Math.sin(Math.PI * v), 0.8) * camber(u) * (1 - 0.25 * v), 0, 0]);
  const headDown = (u) => lower(head(u));
  const furled = (u, v) => {                                           // once round the roll from the foot (the first 8 rows), then up through its middle to the gaff
    const zf = foot(u)[2], z = zf + (headDown(u)[2] - zf) * v, rx = FURL.rx * (0.8 + 0.2 * Math.sin(Math.PI * u)) * (1 + 0.15 * Math.sin(6 * Math.PI * u + 0.5));
    const th = -Math.PI / 2 + 2 * Math.PI * Math.min(v, 0.8) / 0.8, lift = Math.max(0, v - 0.8) / 0.2 * 2 * FURL.ry;
    return [v <= 0.8 ? rx * Math.cos(th) : 0, boomY(z) + FURL.lift + FURL.ry + FURL.ry * Math.sin(th) + lift, z]; };
  const C = (i, j) => { const u = i / NU, v = j / NV, p = flat(u, v); return [p, R.main.at(...mUV(p)), 1, [full(u, v), furled(u, v)]]; };
  for (const side of [1, -1]) for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) quadToward(sail, C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1), [side, 0, 0]); }

// ---- the jib: rows up the luff, each from the stay to the far edge (the foot, then the leech), both sides
const jib = m.part('jib', { node: 'Jib', crease: 80 });
{ const NU = 5, NV = 8, vc = dot(sub(JCLEW, JTACK), aStay) / len(sub(JHEAD, JTACK));                      // how far up the luff the clew is
  const luff = (v) => lerp(JTACK, JHEAD, v), far = (v) => (v <= vc ? lerp(JTACK, JCLEW, v / vc) : lerp(JCLEW, JHEAD, (v - vc) / (1 - vc)));
  const rows = [0, vc * 0.34, vc * 0.68, vc, vc + (1 - vc) * 0.22, vc + (1 - vc) * 0.44, vc + (1 - vc) * 0.66, vc + (1 - vc) * 0.86, 1];
  const flat = (u, v) => lerp(luff(v), far(v), u), chord = (v) => len(sub(far(v), luff(v)));
  const full = (u, v) => add(flat(u, v), [0.20 * u * chord(v) + 0.13 * chord(v) * Math.sin(Math.PI * Math.pow(u, 0.7)), 0, 0]);
  const e1 = [1, 0, 0], e2 = norm([0, aStay[2], -aStay[1]]);                                           // across the stay
  const furled = (u, v) => { const r = 0.016 + 0.034 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.6) * (1 + 0.12 * Math.sin(9 * v)), th = 2 * Math.PI * u; return add(luff(v), add(mul(e1, r * Math.sin(th)), mul(e2, r * (Math.cos(th) - 1) * 0.5 - 0 * r))); };
  const C = (i, j) => { const u = i / NU, v = rows[j], p = flat(u, v); return [p, R.jib.at(...jUV(p)), 1, [full(u, v), furled(u, v)]]; };
  for (const side of [1, -1]) for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) quadToward(jib, C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1), [side, 0, 0]); }

const r3 = (p) => p.map((v) => +v.toFixed(3));
const out = { mastStepInHull: r3(STEP), mastTop: MAST_H, main: { origin: [0, GOOSE, 0], boomAtMast: GOOSE, boomTip: r3(BOOM[1]), boomRadius: R_BOOM, peak: r3(GAFF[1]), furledTopAboveBoom: +(FURL.lift + 2 * FURL.ry + 2 * R_GAFF).toFixed(3) },
  jib: { origin: r3(JTACK), head: r3(JHEAD), clew: r3(JCLEW) }, shroudFeet: [r3(SHROUD(1)), r3(SHROUD(-1))], stayFoot: r3(STAY[0]) };
if (SOCKETS) fs.writeFileSync(SOCKETS, JSON.stringify(out, null, 1));
await emit(m, R, ATLAS, args, { size: 1024 });
