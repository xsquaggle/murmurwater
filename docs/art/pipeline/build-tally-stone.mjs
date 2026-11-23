// build-tally-stone.mjs : Isolde's Tally Stone on Saltbone Reach, built in code (no generation job).
// Usage: node build-tally-stone.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A slab of slate as tall as a door (2.1 m over the ground, 1.2 m wide), stood upright in a dry-stone cairn 2 m
// across and leaning a little back, cut on both faces with tallies in fives big enough to read from six metres (each
// five about 15 cm square, six to a row in rows that drift): 27 fives on the front (+Z), the newest low down in the
// last row, bright new cuts, and 30 older ones on the back, all cut pale into the grey; the oldest worn and grown
// over. A dead hand lantern on a flat stone at its foot, in front; a tin box wedged in the front of the cairn, child
// node `LogBox` (its pivot is the middle of the box's foot; the lid is on top). Origin on the ground under the middle
// of the slab; the slab goes 0.15 m into it, the cairn 0.1 m. One material, `main`.
import { Model, pack, cli, emit, within, rotX, rotY, rotZ, move, compose, rad, rng } from './kit.mjs';

const args = cli(), ATLAS = [2048, 1024], rnd = rng(29);
const X0 = -0.62, Y0 = -0.15, FW = 1.24, FH = 2.25, PPM = 440;                       // the slab's face, as painted: its bottom left corner and size
const OUT = [[-0.58, -0.15], [0.6, -0.15], [0.61, 0.9], [0.6, 1.7], [0.55, 1.98], [0.42, 2.1], [0.1, 2.07], [-0.25, 2.02], [-0.5, 1.95], [-0.59, 1.8], [-0.6, 0.9]];   // its outline, counter-clockwise from in front
const CROWN = OUT.slice(2).concat([OUT[0]]).filter(([, y]) => y > 0).sort((a, b) => a[0] - b[0]);
const cut = { mat: 'slate', ppm: PPM, x0: X0, y0: Y0, floor: 0.7, side: 0.07, top: 0.08, lichen: 0.5, moss: 0.35 };
const R = pack(...ATLAS, {
  front: [Math.round(FW * PPM), Math.round(FH * PPM), { ...cut, crown: CROWN, era: [0.5, 1.0], fresh: 0.12, left: 3, part: 3, lichen: 0.35 }],
  back: [Math.round(FW * PPM), Math.round(FH * PPM), { ...cut, crown: CROWN.map(([x, y]) => [-x, y]).reverse(), era: [0.0, 0.5], fresh: 0, seed: 9 }],
  edge: [72, 600, { mat: 'slate', cuts: false, layers: 'y', lichen: 0.4, moss: 0.2 }],
  cairn: [640, 200, { mat: 'drystone', ppm: 135, course: [0.06, 0.13], block: [0.1, 0.26], lichen: 0.45, moss: 0.65, tile_x: true }],
  stone: [96, 48, { mat: 'flat', colour: '#5E636B', var: 0.25, tile_x: true }],
  slab: [128, 96, { mat: 'slate', cuts: false, lichen: 0.7, moss: 0.4, seed: 4 }],
  flag: [128, 96, { mat: 'slate', cuts: false, lichen: 0.6, moss: 0.5 }],
  box: [160, 96, { mat: 'tin', colour: '#55685A' }],
  tin: [128, 64, { mat: 'tin', colour: '#6B7376', tile_x: true }],
  soot: [96, 48, { mat: 'flat', colour: '#3B3A34', var: 0.3, tile_x: true }],
  iron: [32, 32, { mat: 'iron', rust: 0.6 }],
});
const m = new Model('tally-stone');
m.material('main', { kind: 'texture', roughness: 0.9 });
const BOX = [-0.36, 0.2, 0.6];
m.node('LogBox', BOX);
const stone = m.part('stone', { crease: 30, xf: rotX(-rad(2)) }), cairn = m.part('cairn', { crease: 50 }), kit = m.part('lantern', { crease: 45 });
const lid = m.part('box', { node: 'LogBox', crease: 30 });

// ---- the slab: two faces and the broken edges between them, a little thinner toward the top
const half = (y) => 0.085 - 0.025 * (y - Y0) / FH;
const F = OUT.map(([x, y]) => [x, y, half(y)]), B = OUT.map(([x, y]) => [x, y, -half(y)]);
stone.poly(F, ([x, y]) => R.front.at((x - X0) / FW, (y - Y0) / FH));
stone.poly([...B].reverse(), ([x, y]) => R.back.at((X0 + FW - x) / FW, (y - Y0) / FH));
const per = OUT.map((p, i) => Math.hypot(OUT[(i + 1) % OUT.length][0] - p[0], OUT[(i + 1) % OUT.length][1] - p[1])), tot = per.reduce((a, b) => a + b);
for (let i = 1, at = per[0]; i < OUT.length; at += per[i], i++) {                    // the foot (edge 0) is under the cairn
  const k = (i + 1) % OUT.length, t0 = at / tot, t1 = (at + per[i]) / tot, sh = i >= 5 && i <= 8 ? 1 : 0.82;
  stone.quad([B[i], R.edge.at(0, t0), sh], [B[k], R.edge.at(0, t1), sh], [F[k], R.edge.at(1, t1), sh], [F[i], R.edge.at(1, t0), sh]);
}

// ---- the cairn: split stone heaped round the slab's foot, longer across than front to back
const CP = [[1.0, -0.1], [1.0, 0.08], [0.84, 0.25], [0.6, 0.42], [0.4, 0.56], [0.22, 0.68], [0, 0.74]], SQ = 0.8;
within(cairn, (p) => [p[0], p[1], p[2] * SQ], (p) => p.lathe(CP, 11, R.cairn, {
  wobble: (i, j) => (i > 0 && i < CP.length - 1 ? 1 + 0.15 * (((j * 7 + i * 5) % 9) / 8 - 0.5) : 1),
  lift: (i, j) => (i > 1 && i < CP.length - 1 ? 0.07 * (((j * 3 + i) % 5) / 4 - 0.5) : 0),
  shade: (i) => [0.6, 0.8, 0.95, 1, 1, 1, 1][i] }));
// flat stones laid on the heap, lying with its slope (a: degrees round from +X, +Z is -90; y: how high up it)
const onHeap = (y) => { let i = 1; while (i < CP.length - 1 && CP[i + 1][1] < y) i++; const [[r0, y0], [r1, y1]] = [CP[i], CP[i + 1]]; return [r0 + (r1 - r0) * (y - y0) / (y1 - y0), Math.atan2(y1 - y0, r0 - r1)]; };
for (const [a, y, w, d] of [[-62, 0.16, 0.16, 0.11], [-150, 0.2, 0.14, 0.1], [-20, 0.4, 0.13, 0.09], [25, 0.18, 0.17, 0.12], [-88, 0.44, 0.12, 0.08], [160, 0.36, 0.15, 0.1], [215, 0.14, 0.18, 0.12], [262, 0.3, 0.15, 0.1]]) {
  const [r, slope] = onHeap(y), c = Math.cos(rad(a)), s = -Math.sin(rad(a));
  within(cairn, compose(move([(r - 0.03) * c, y - 0.03, (r - 0.03) * s * SQ]), rotY(rad(a) + Math.PI / 2), rotX(slope * 0.9), rotY((rnd() - 0.5) * 0.6)), (p) =>
    p.box([0, 0, 0], [w, 0.05, d], { py: R.slab, pz: R.slab.sub(0, 0, 1, 0.25), nz: R.slab.sub(0, 0, 1, 0.25), px: R.slab.sub(0, 0, 0.25, 1), nx: R.slab.sub(0, 0, 0.25, 1) }, { shade: { pz: 0.75, nz: 0.75, px: 0.75, nx: 0.75 } }));
}
for (const [x, z, s] of [[0.98, 0.5, 0.17], [-1.02, 0.28, 0.21], [-0.62, -0.78, 0.15], [0.72, -0.7, 0.19], [-0.8, 0.72, 0.13]])    // stones fallen from it
  within(cairn, compose(move([x, 0, z]), rotY(rnd() * 6)), (p) => p.lathe([[s, -0.06], [s * 0.9, 0.3 * s], [0, 0.55 * s]], 5, R.stone, { wobble: (i, j) => 1 + 0.25 * (((j * 3 + i) % 4) / 3 - 0.5), shade: (i) => [0.7, 0.9, 1][i] }));

// ---- the dead lantern on a flat stone at the foot: a tin base, sooted glass in three wires, a tin hood and a bail
const LX = [0.4, 0.05, 0.98];
cairn.box([LX[0] + 0.02, 0.02, LX[2] - 0.01], [0.17, 0.035, 0.13], { py: R.flag, pz: R.flag.sub(0, 0, 1, 0.2), px: R.flag.sub(0, 0, 0.2, 1), nx: R.flag.sub(0, 0, 0.2, 1), nz: R.flag.sub(0, 0, 1, 0.2) }, { shade: { pz: 0.8, px: 0.8, nx: 0.8, nz: 0.8 }, warp: (p) => [p[0], p[1] + 0.03 * p[0], p[2]] });
within(kit, compose(move(LX), rotY(rad(30)), rotZ(rad(3))), (p) => {
  p.lathe([[0, 0.005], [0.085, 0.005], [0.092, 0.03], [0.086, 0.06]], 8, R.tin.sub(0, 0, 1, 0.3), { shade: (i) => [1, 0.7, 0.9, 1][i] });
  p.lathe([[0.086, 0.06], [0.074, 0.085], [0.076, 0.19], [0.068, 0.215]], 8, R.soot);
  p.lathe([[0.068, 0.215], [0.094, 0.225], [0.05, 0.285], [0.016, 0.3], [0, 0.31]], 8, R.tin.sub(0, 0.35, 1, 1));
  for (let k = 0; k < 3; k++) { const a = rad(120 * k + 15), c = Math.cos(a), s = -Math.sin(a);
    p.tube([[0.09 * c, 0.055, 0.09 * s], [0.083 * c, 0.14, 0.083 * s], [0.078 * c, 0.222, 0.078 * s]], 0.005, 3, R.iron, { open: true }); }
  p.tube([[-0.06, 0.25, 0], [-0.07, 0.33, 0], [-0.03, 0.38, 0], [0.03, 0.38, 0], [0.07, 0.33, 0], [0.06, 0.25, 0]], 0.006, 3, R.iron, { open: true });
});

// ---- the log box: a tin box with a lid, wedged into the front of the cairn, tilted, facing out a little to the left
within(lid, compose(move(BOX), rotY(-rad(23)), rotX(rad(8)), rotZ(rad(5))), (p) => {
  const side = R.box.sub(0, 0, 1, 0.55), end = R.box.sub(0, 0, 0.45, 0.55);
  p.box([0, 0.05, 0], [0.13, 0.05, 0.085], { pz: side, nz: side, px: end, nx: end, ny: end });
  p.box([0, 0.112, 0], [0.135, 0.013, 0.09], { py: R.box.sub(0, 0.55, 1, 1), pz: R.box.sub(0, 0.55, 1, 0.65), nz: R.box.sub(0, 0.55, 1, 0.65), px: R.box.sub(0, 0.55, 0.2, 0.65), nx: R.box.sub(0, 0.55, 0.2, 0.65), ny: end }, { shade: { pz: 0.85, px: 0.85, nx: 0.85 } });
  p.box([0, 0.085, 0.09], [0.018, 0.03, 0.006], R.iron);                         // the hasp
});

await emit(m, R, ATLAS, args);
