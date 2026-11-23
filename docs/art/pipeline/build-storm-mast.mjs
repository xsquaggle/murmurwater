// build-storm-mast.mjs : Captain Oake's weather mast at Tryworks Landing, built in code (no generation job).
// Usage: node build-storm-mast.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A grey spar 5.6 m tall stepped in a cairn of slate and held by three guys, a yard across it (along X) at 4.5 m, and on
// top a copper wind vane in the shape of a whale over a compass cross. Three tarred canvas storm cones: one hangs point
// down under each yardarm on its halyard, and the third, point up, rides on a halyard of its own that runs straight down
// in front of the spar (+Z) from a bracket at the masthead to a pin in the cairn; it hangs low, ready to be hoisted.
// The whale is a child node `Vane` whose pivot is on the spar's axis at the masthead (it turns about Y; its head looks
// along +X). The third cone is a child node `Cone` whose origin is its point, on the halyard: moving it straight up by up
// to HOIST metres runs it up to the block. 6 m from the ground to the top of the vane. Origin on the ground at the foot of the
// spar; the cairn goes 0.1 m into it. One material, `main`.
import { Model, pack, cli, emit, within, rotY, rotX, move, compose, rad, rng, add, sub, mul, norm, cross } from './kit.mjs';

const args = cli(), ATLAS = [512, 512], rnd = rng(61);
const TOP = 5.6, YARD = 4.5, ARM = 1.15, STAY = 4.25, HZ = 0.46, BR = 5.30, PIN = 0.62;      // masthead, yard, yardarms, where the guys are made fast, the third halyard's way out in front, its bracket, its pin
const C = { h: 0.7, r: 0.27 }, LOW = 2.35, HOIST = +(BR - 0.12 - 0.04 - LOW).toFixed(2);          // a cone; the third cone's point at rest, and how far it may be hoisted
const R = pack(...ATLAS, {
  spar: [44, 440, { mat: 'wood', tone: 'grey', along: 'y', weather: 0.85, tile_x: true }],
  yard: [300, 28, { mat: 'wood', tone: 'grey', along: 'x', weather: 0.7 }],
  cone: [176, 96, { mat: 'canvas', colour: '#47443E', seams: 4, along: 'y', stain: 0.5, tar: 0.7, tile_x: true }],
  coneBase: [72, 72, { mat: 'canvas', colour: '#4A4740', seams: 0, stain: 0.6, tar: 0.4 }],
  cairn: [220, 90, { mat: 'drystone', ppm: 150, lichen: 0.5, moss: 0.6, tile_x: true }],
  rope: [480, 12, { mat: 'rope', pitch: 12 }],                                              // ROPE m of rope, laid end to end
  whale: [140, 64, { mat: 'copper', green: 0.72, top: 0.3 }],
  iron: [48, 48, { mat: 'iron', rust: 0.5 }], block: [48, 32, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.3, edge: 0.4 }],
  stone: [64, 32, { mat: 'flat', colour: '#7B8089', var: 0.2, tile_x: true }],
});
const m = new Model('storm-mast');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.node('Vane', [0, TOP + 0.06, 0]).node('Cone', [0, LOW, HZ]);
const spar = m.part('spar', { crease: 50 }), rig = m.part('rigging', { crease: 40 }), cones = m.part('cones', { crease: 35 });
const vane = m.part('vane', { node: 'Vane', crease: 30 }), cone = m.part('cone', { node: 'Cone', crease: 35 });
const ROPE = 4.8, line = (a, b, r = 0.011) => rig.tube([a, b], r, 3, R.rope, { lay: Math.min(1, Math.hypot(...sub(b, a)) / ROPE), open: true });     // each line takes its length of the rope's rectangle
const block = (c, k = 1) => rig.box(c, [0.04 * k, 0.065 * k, 0.03 * k], { pz: R.block, nz: R.block, px: R.block.sub(0, 0, 0.5, 1), nx: R.block.sub(0, 0, 0.5, 1), ny: R.block.sub(0, 0, 1, 0.3) });

// ---- the cairn, the spar and its truck, the yard
spar.lathe([[0.62, -0.1], [0.64, 0.14], [0.50, 0.36], [0.26, 0.50], [0.1, 0.53]], 7, R.cairn, { wobble: (i, j) => (i < 4 ? 1 + 0.10 * (((j * 5 + i * 3) % 7) / 6 - 0.5) : 1), shade: (i) => [0.7, 0.9, 1, 1, 0.9][i] });
spar.tube([[0, -0.1, 0], [0, 2.5, 0], [0, TOP, 0]], [0.085, 0.074, 0.056], 6, R.spar, { open: true });
spar.lathe([[0.085, TOP], [0.085, TOP + 0.055], [0, TOP + 0.06]], 6, R.block);
spar.tube([[-ARM - 0.12, YARD, 0.1], [0, YARD + 0.03, 0.1], [ARM + 0.12, YARD, 0.1]], [0.03, 0.05, 0.03], 6, { ...R.yard, at: (s, t) => R.yard.at(t, s) });
rig.box([0, YARD + 0.03, 0.05], [0.07, 0.05, 0.06], R.iron);                                       // the iron band that holds the yard to the spar
// ---- the compass cross and the spindle under the vane
for (const [dx, dz] of [[1, 0], [0, 1]]) rig.tube([[-0.34 * dx, TOP - 0.18, -0.34 * dz], [0.34 * dx, TOP - 0.18, 0.34 * dz]], 0.011, 3, R.iron);
rig.tube([[0, TOP + 0.06, 0], [0, TOP + 0.38, 0]], 0.012, 3, R.iron, { open: true });

// ---- the whale: a flat copper whale, head along +X, balanced on its pivot (every piece is given both faces)
within(vane, move([0, TOP + 0.22, 0]), (p) => {
  const uv = ([x, y]) => R.whale.at(0.5 + x / 1.0, 0.5 + y / 0.36), two = (pts) => { const P = pts.map(([x, y]) => [[x, y, 0], uv([x, y])]);
    for (let i = 1; i + 1 < P.length; i++) { p.tri(P[0], P[i], P[i + 1]); p.tri(P[0], P[i + 1], P[i]); } };
  two([[0.06, 0.02], [0.45, 0.0], [0.44, 0.07], [0.39, 0.115], [0.22, 0.13], [0.0, 0.11], [-0.18, 0.07], [-0.30, 0.03], [-0.36, 0.005], [-0.30, -0.025], [-0.14, -0.06],
    [0.06, -0.075], [0.26, -0.07], [0.39, -0.045], [0.45, 0.0]]);                                    // the body, a fan from inside it
  two([[-0.33, 0.012], [-0.52, 0.15], [-0.46, 0.03], [-0.44, 0.0]]); two([[-0.33, -0.004], [-0.44, 0.0], [-0.46, -0.03], [-0.52, -0.13]]);      // the flukes
  two([[0.17, -0.06], [0.05, -0.17], [0.02, -0.068]]); two([[-0.10, 0.085], [-0.19, 0.14], [-0.21, 0.06]]);                                     // a flipper, and the hump on its back
  p.tube([[0, -0.16, 0], [0, -0.06, 0]], 0.02, 4, R.iron, { twist: Math.PI / 4 });                  // its collar on the spindle
});

// ---- a storm cone: canvas on a hoop, its point at `tip`, its mouth `dir` from it (one hangs point down, one rides point up)
const stormCone = (part, tip, dir, turn) => within(part, compose(move(tip), (q) => (dir > 0 ? q : [q[0], -q[1], -q[2]]), rotY(turn)), (p) => {
  p.lathe([[0, 0], [C.r, C.h]], 8, R.cone);
  p.lathe([[C.r, C.h], [0, C.h - 0.03]], 8, R.coneBase, { shade: () => 0.7 });
});
// under each yardarm: a block, the halyard down to a bridle of three legs, the cone point down; the hauling part slants down to the cairn
for (const sx of [1, -1]) {
  const x = sx * ARM, top = YARD - 0.62, mouth = top - 0.18; block([x, YARD - 0.1, 0.1]);
  line([x, YARD - 0.16, 0.1], [x, top, 0.1]);
  for (let k = 0; k < 3; k++) { const a = rad(90 + 120 * k + (sx > 0 ? 20 : 70)); line([x, top, 0.1], [x + C.r * Math.cos(a), mouth - 0.01, 0.1 - C.r * Math.sin(a)], 0.007); }
  stormCone(cones, [x, mouth - 0.02 - C.h, 0.1], 1, rad(sx > 0 ? 10 : 50));
  line([x - sx * 0.03, YARD - 0.14, 0.1], [sx * 0.45, 0.47, 0.2 * sx]);
}
// the third halyard: a bracket at the masthead, a block, the line straight down in front of the spar to its pin; the cone rides on it point up
rig.box([0, BR, HZ / 2], [0.03, 0.03, HZ / 2 + 0.03], { px: R.yard, nx: R.yard, py: R.yard, ny: R.yard, pz: R.yard.sub(0, 0, 0.1, 1) });
block([0, BR - 0.1, HZ]);
line([0, BR - 0.16, HZ], [0, PIN, HZ]); rig.box([0, PIN - 0.02, HZ], [0.02, 0.06, 0.02], R.iron);
stormCone(cone, [0, LOW, HZ], -1, rad(25));
// ---- three guys from the spar to stones on the ground
for (const [gx, gz] of [[1.75, 1.0], [-1.75, 1.0], [0, -2.05]]) {
  line([gx * 0.03, STAY, gz * 0.03], [gx, 0.16, gz], 0.012);
  within(rig, compose(move([gx, 0.03, gz]), rotY(rnd() * 6)), (p) => p.lathe([[0.21, -0.1], [0.21, 0.08], [0, 0.18]], 5, R.stone, { wobble: (i, j) => 1 + 0.15 * (((j * 3 + i) % 4) / 3 - 0.5) }));
}

await emit(m, R, ATLAS, args, { extra: { hoist: HOIST } });
