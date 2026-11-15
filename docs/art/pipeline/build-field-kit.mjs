// build-field-kit.mjs : Dr. Calloway's field table and theodolite at Sedge Landing, built in code (no generation job).
// Usage: node build-field-kit.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A folding table 1.2 x 0.6 m, 0.74 m high, on two crossed pairs of legs; on it a fish-measuring board marked in
// centimetres with a stop at its head, a brass balance with two pans, three specimen jars, a notebook and a pencil.
// Beside it, 1.2 m toward +X, a brass theodolite on a wooden tripod, 1.4 m to the top, with a plumb bob under it.
// Origin on the ground under the middle of the table; the table's long side faces +Z. One material, `main`.
import { Model, pack, cli, emit, within, rotX, rotY, rotZ, move, compose, rad } from './kit.mjs';

const args = cli(); const ATLAS = [1024, 512];
const TOP = 0.74, TX = 0.6, TZ = 0.3, THEO = [1.2, 0, 0.06];
const R = pack(...ATLAS, {
  top: [384, 192, { mat: 'wood', planks: 5, along: 'x', tone: 'drift', weather: 0.45, nails: 0, edge: 0.3 }], edge: [256, 20, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.3 }],
  leg: [36, 200, { mat: 'wood', tone: 'drift', along: 'y', weather: 0.4, tile_x: true }],
  ruler: [384, 70, { mat: 'ruler', marks: 72, edge: 0.3 }], stop: [64, 40, { mat: 'wood', tone: 'pale', along: 'x', weather: 0.2 }],
  brass: [110, 110, { mat: 'brass', patina: 0.25 }], pan: [128, 56, { mat: 'brass', patina: 0.15, tile_x: true }], scope: [128, 130, { mat: 'brass', patina: 0.3, tile_x: true, top: 0.1 }],
  jarA: [72, 110, { mat: 'jar' }], jarB: [72, 110, { mat: 'jar', liquid: '#C9D9A8', thing: '#8A6E52' }], jarC: [72, 110, { mat: 'jar', liquid: '#A9D2C8', thing: '#4F6E6A' }],
  cover: [96, 70, { mat: 'flat', colour: '#6E2F2A', var: 0.2, grain: 0.15, edge: 0.4 }], pages: [96, 14, { mat: 'flat', colour: '#E9E0C6', var: 0.1, grain: 0.3, along: 'x' }],
  pencil: [14, 64, { mat: 'flat', colour: '#C9A23A', var: 0.15 }],
  tripod: [40, 260, { mat: 'wood', tone: 'pale', along: 'y', weather: 0.35, tile_x: true, ao: { bottom: 0.3 } }],
  dial: [110, 110, { mat: 'dial' }], dialV: [96, 96, { mat: 'dial', marks: 24 }], lens: [40, 40, { mat: 'flat', colour: '#24384A', var: 0.3 }], iron: [48, 48, { mat: 'iron', rust: 0.15 }],
});

const m = new Model('field-kit');
m.material('main', { kind: 'texture', roughness: 0.85 });
const table = m.part('table', { crease: 40 }), kit = m.part('kit', { crease: 40 }), theo = m.part('theodolite', { crease: 40 });
/** A flat disc with a picture on it: `to` turns it from lying face up at the origin to where it belongs. */
const disc = (part, rect, r, sides, to) => within(part, to, (p) => { for (let k = 0; k < sides; k++) { const a = 2 * Math.PI * k / sides, b = 2 * Math.PI * (k + 1) / sides, C = (t) => [[r * Math.cos(t), 0, -r * Math.sin(t)], rect.at(0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t))]; p.tri(C(a), C(b), [[0, 0, 0], rect.at(0.5, 0.5)]); } });

// ---- the table: a top of five boards, two crossed pairs of legs, three rails
table.box([0, TOP - 0.015, 0], [TX, 0.015, TZ], { py: R.top, ny: R.top, pz: R.edge, nz: R.edge, px: R.edge.sub(0, 0, 0.5, 1), nx: R.edge.sub(0, 0, 0.5, 1) }, { shade: { ny: 0.55 } });
for (const x of [-0.5, 0.5]) for (const s of [-1, 1]) table.tube([[x + s * 0.012, 0, s * 0.27], [x + s * 0.012, TOP - 0.03, -s * 0.24]], 0.02, 4, R.leg, { open: true, twist: Math.PI / 4 });
for (const [y, z] of [[(TOP - 0.03) / 2, 0.012], [0.1, 0.23], [0.1, -0.23]]) table.tube([[-0.5, y, z], [0.5, y, z]], 0.014, 4, R.leg, { open: true, twist: Math.PI / 4 });

// ---- on it: the measuring board with its stop
within(kit, compose(move([-0.14, TOP, 0.13]), rotY(rad(-3))), (p) => {
  p.box([0, 0.011, 0], [0.37, 0.011, 0.085], { py: R.ruler, pz: R.edge, nz: R.edge, px: R.stop, nx: R.stop });
  p.box([-0.36, 0.045, 0], [0.012, 0.045, 0.085], R.stop);
});
// the balance: a foot, a pillar, a beam, and two pans hung from its ends
within(kit, compose(move([0.37, TOP, -0.1]), rotY(rad(14))), (p) => {
  p.lathe([[0.075, 0], [0.065, 0.014], [0.018, 0.026], [0.014, 0.25], [0.024, 0.262], [0, 0.275]], 6, R.brass);
  within(p, compose(move([0, 0.245, 0]), rotZ(rad(7))), (q) => {
    q.box([0, 0, 0], [0.16, 0.007, 0.007], R.brass);
    for (const s of [-1, 1]) within(q, compose(move([s * 0.155, 0, 0]), rotZ(rad(-7))), (h) => {
      h.tube([[0, 0, 0], [0, -0.075, 0]], 0.004, 3, R.iron, { open: true });
      for (const a of [20, 140, 260]) h.tube([[0, -0.075, 0], [0.058 * Math.cos(rad(a)), -0.136, -0.058 * Math.sin(rad(a))]], 0.0035, 3, R.iron, { open: true });      // three chains
      h.lathe([[0, -0.15], [0.03, -0.15], [0.062, -0.135]], 6, R.pan); h.lathe([[0.062, -0.135], [0.03, -0.146], [0, -0.146]], 6, R.pan, { shade: () => 0.8 });
    });
  });
});
// three specimen jars
[[-0.43, -0.17, 0.045, 0.15, R.jarA], [-0.31, -0.2, 0.038, 0.115, R.jarB], [-0.19, -0.15, 0.05, 0.17, R.jarC]].forEach(([x, z, r, h, rect], i) =>
  within(kit, compose(move([x, TOP, z]), rotY(rad(70 * i))), (p) => p.lathe([[0, 0], [r, 0], [r, h * 0.76], [r * 0.7, h * 0.84], [r * 0.74, h], [0, h + 0.004]], 6, rect, { v: [0, 0.02, 0.76, 0.84, 0.94, 1] })));
// the notebook and a pencil
within(kit, compose(move([0.07, TOP, -0.11]), rotY(rad(-16))), (p) => {
  p.box([0, 0.014, 0], [0.085, 0.014, 0.115], { py: R.cover, pz: R.pages, nz: R.pages, px: R.pages, nx: R.cover.sub(0, 0, 0.2, 1) });
  p.tube([[-0.05, 0.034, -0.07], [0.06, 0.034, 0.06]], 0.005, 3, R.pencil);
});

// ---- the theodolite: three legs, a head, a levelled plate with its circle, two standards, the telescope and its circle
within(theo, compose(move(THEO), rotY(rad(-28))), (p) => {
  const HEAD = 1.1, AXIS = 1.305;
  for (const a of [90, 210, 330]) { const d = [Math.cos(rad(a)), -Math.sin(rad(a))]; p.tube([[0.5 * d[0], 0, 0.5 * d[1]], [0.06 * d[0], HEAD, 0.06 * d[1]]], [0.017, 0.026], 4, R.tripod, { twist: Math.PI / 4 }); }
  p.lathe([[0.05, HEAD - 0.06], [0.095, HEAD - 0.02], [0.095, HEAD + 0.012], [0.045, HEAD + 0.02], [0.04, HEAD + 0.05], [0.09, HEAD + 0.058], [0.09, HEAD + 0.074]], 8, R.brass);
  disc(p, R.dial, 0.09, 8, move([0, HEAD + 0.074, 0]));
  for (const s of [-1, 1]) p.box([s * 0.056, (HEAD + 0.074 + AXIS + 0.03) / 2, 0], [0.01, (AXIS + 0.03 - HEAD - 0.074) / 2, 0.028], R.brass, { warp: (q) => [q[0], q[1], q[2] * (q[1] > AXIS ? 0.55 : 1)] });
  within(p, compose(move([0, AXIS, 0]), rotX(rad(84))), (t) => {                                    // the telescope, looking along +Z and a little up
    t.lathe([[0, -0.15], [0.017, -0.15], [0.02, -0.10], [0.027, -0.085], [0.027, 0.115], [0.036, 0.135], [0.036, 0.165]], 8, R.scope);
    disc(t, R.lens, 0.036, 8, move([0, 0.165, 0]));
  });
  p.tube([[-0.085, AXIS, 0], [0.07, AXIS, 0]], 0.009, 4, R.iron, { open: true });
  disc(p, R.dialV, 0.07, 8, compose(move([-0.086, AXIS, 0]), rotZ(rad(90)))); disc(p, R.dialV, 0.07, 8, compose(move([-0.08, AXIS, 0]), rotZ(rad(-90))));
  p.tube([[0, HEAD - 0.06, 0], [0, 0.33, 0]], 0.003, 3, R.iron, { open: true });                   // the plumb line and its bob
  p.lathe([[0, 0.24], [0.026, 0.31], [0.012, 0.335], [0, 0.335]], 6, R.brass);
});

await emit(m, R, ATLAS, args);
