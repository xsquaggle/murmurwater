// build-packet-box.mjs : Mara's packet box at Sedge Landing, built in code (no generation job).
// Usage: node build-packet-box.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-packet-box.py)
// A stout sea crate 0.9 x 0.6 x 0.6 m on four short legs, iron-strapped, with rope handles, a hasp and padlock, a brass
// scale pan on its lid and "M.T." and a fish stencilled on the front (+Z); a pole 1.8 m tall clipped to its +X end
// carries a pennant in the red and cream of Mara's stall. Origin on the ground under the middle of the crate.
// One material, `main`. The pennant is a child node `Pennant` with its origin on the pole's axis at the middle of
// the hoist; it flies toward +X and turns about its own Y.
import { Model, pack, cli, emit, within, move, rad } from './kit.mjs';

const args = cli(); const ATLAS = [1024, 512];
const LEG = 0.11, BODY = 0.51, LID = 0.09, HX = 0.45, HZ = 0.30, TOP = LEG + BODY + LID;       // the crate is 0.6 m tall on legs of 0.11 m
const POLE = [HX + 0.035, -0.19], HOIST = [1.46, 1.74], FLY = 0.62;
const R = pack(...ATLAS, {
  front: [400, 228, { mat: 'wood', planks: 4, along: 'x', tone: 'drift', weather: 0.5, nails: 0, ao: { top: 0.25, bottom: 0.3 } }],
  back: [288, 164, { mat: 'wood', planks: 4, along: 'x', tone: 'drift', weather: 0.65, ao: { top: 0.25, bottom: 0.3 } }],
  end: [192, 164, { mat: 'wood', planks: 4, along: 'x', tone: 'drift', weather: 0.6, ao: { top: 0.25, bottom: 0.3 } }],
  lid: [288, 196, { mat: 'wood', planks: 5, along: 'x', tone: 'drift', weather: 0.75, nails: 2, edge: 0.4 }],
  lidEdge: [288, 28, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.4, edge: 0.3 }],
  batten: [36, 164, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.5, edge: 0.4 }],
  strap: [36, 200, { mat: 'iron', rust: 0.35, edge: 0.3 }], leg: [48, 56, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.3, light: 0.85 }],
  rope: [128, 36, { mat: 'rope', pitch: 32 }], brass: [72, 72, { mat: 'brass', patina: 0.25 }], pan: [128, 72, { mat: 'brass', patina: 0.15, tile_x: true }],
  pole: [28, 300, { mat: 'wood', tone: 'pale', along: 'y', weather: 0.5, tile_x: true }],
  pennant: [200, 100, { mat: 'cloth', stripes: ['#C8473D', '#F2E3C6'], n: 7, along: 'y', worn: 0.35 }],
});

const m = new Model('packet-box');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.node('Pennant', [POLE[0], (HOIST[0] + HOIST[1]) / 2, POLE[1]]);
const box = m.part('crate', { crease: 40 }), fit = m.part('fittings', { crease: 35 }), flag = m.part('pennant', { node: 'Pennant', crease: 60 });

// ---- the crate: body, lid with a little overhang, four legs
const MIDY = LEG + BODY / 2;
box.box([0, MIDY, 0], [HX, BODY / 2, HZ], { pz: R.front, nz: R.back, px: R.end, nx: R.end, ny: R.leg }, { shade: { ny: 0.6 } });
box.box([0, LEG + BODY + LID / 2, 0], [HX + 0.018, LID / 2, HZ + 0.018], { py: R.lid, ny: R.lidEdge, pz: R.lidEdge, nz: R.lidEdge, px: R.lidEdge.sub(0, 0, 0.66, 1), nx: R.lidEdge.sub(0, 0, 0.66, 1) }, { shade: { ny: 0.6 } });
for (const sx of [-1, 1]) for (const sz of [-1, 1]) box.box([sx * (HX - 0.07), LEG / 2, sz * (HZ - 0.07)], [0.05, LEG / 2, 0.05], { pz: R.leg, nz: R.leg, px: R.leg, nx: R.leg });
// battens down the corners of the front and back, and two on each end
const bat = { pz: R.batten, px: R.batten.sub(0, 0, 0.3, 1), nx: R.batten.sub(0, 0, 0.3, 1) };
for (const sz of [1, -1]) within(box, (p) => [p[0] * sz, p[1], p[2] * sz], (b) => { for (const sx of [-1, 1]) b.box([sx * (HX - 0.03), MIDY, HZ + 0.007], [0.03, BODY / 2, 0.007], bat); });
for (const sx of [1, -1]) within(box, (p) => [p[2] * sx, p[1], -p[0] * sx], (b) => { for (const sz of [-1, 1]) b.box([sz * (HZ - 0.03), MIDY, HX + 0.007], [0.03, BODY / 2, 0.007], bat); });
// two iron straps: up the front, over the lid, down the back
for (const x of [-0.31, 0.31]) {
  const st = { pz: R.strap, px: R.strap.sub(0, 0, 0.25, 1), nx: R.strap.sub(0, 0, 0.25, 1) };
  for (const sz of [1, -1]) within(fit, (p) => [p[0] * sz, p[1], p[2] * sz], (b) => b.box([x * sz, LEG + (BODY + LID) / 2, HZ + 0.02], [0.026, (BODY + LID) / 2, 0.006], st));
  fit.box([x, TOP + 0.005, 0], [0.026, 0.005, HZ + 0.026], { py: R.strap, px: R.strap.sub(0, 0, 0.25, 1), nx: R.strap.sub(0, 0, 0.25, 1) });
}
// hasp and padlock
fit.box([0, LEG + BODY + 0.01, HZ + 0.024], [0.026, 0.06, 0.006], R.brass); fit.box([0, LEG + BODY - 0.085, HZ + 0.02], [0.034, 0.036, 0.014], R.brass);
// rope handles on the ends
for (const sx of [-1, 1]) fit.tube([[-0.13, 0.50, -0.01], [-0.125, 0.455, 0.045], [-0.085, 0.405, 0.068], [0, 0.385, 0.078], [0.085, 0.405, 0.068], [0.125, 0.455, 0.045], [0.13, 0.50, -0.01]].map(([z, y, o]) => [sx * (HX + o), y, z]), 0.019, 4, R.rope, { open: true, lay: 1 });

// ---- the scale pan on the lid: a foot, a stem and a shallow dish
within(fit, move([-0.19, TOP, 0.02]), (p) => {
  p.lathe([[0.075, 0], [0.06, 0.018], [0.022, 0.03], [0.022, 0.075], [0.07, 0.085], [0.185, 0.13]], 8, R.pan);
  p.lathe([[0.185, 0.13], [0.175, 0.135], [0.07, 0.098], [0, 0.094]], 8, R.pan, { shade: (i) => (i < 2 ? 1 : 0.8) });
});

// ---- the pole, its two clips, its brass ball, and the pennant
fit.tube([[POLE[0], 0, POLE[1]], [POLE[0], 1.8, POLE[1]]], [0.024, 0.017], 6, R.pole, { open: true });
within(fit, move([POLE[0], 1.8, POLE[1]]), (p) => p.lathe([[0.017, -0.01], [0.036, 0.03], [0.026, 0.062], [0, 0.072]], 6, R.brass));
for (const y of [0.24, 0.52]) fit.box([POLE[0] - 0.012, y, POLE[1]], [0.036, 0.02, 0.034], { px: R.strap.sub(0, 0, 1, 0.2), pz: R.strap.sub(0, 0, 1, 0.2), nz: R.strap.sub(0, 0, 1, 0.2), py: R.strap.sub(0, 0, 1, 0.2), ny: R.strap.sub(0, 0, 1, 0.2) });
{ const N = 5, y0 = HOIST[0], y1 = HOIST[1], mid = (y0 + y1) / 2;                                       // a long pennant, both faces, with a wave in it
  const P = (i, top) => { const t = i / N, half = (y1 - y0) / 2 * (1 - 0.82 * t), droop = -0.10 * t * t; return [POLE[0] + 0.02 + FLY * t, mid + droop + (top ? half : -half), POLE[1] + 0.045 * Math.sin(t * 5.2) * t]; };
  const C = (i, top) => [P(i, top), R.pennant.at(i / N, top ? 0.5 + 0.5 * (1 - 0.82 * i / N) : 0.5 - 0.5 * (1 - 0.82 * i / N))];
  for (let i = 0; i < N; i++) { flag.quad(C(i, 0), C(i + 1, 0), C(i + 1, 1), C(i, 1)); flag.quad(C(i, 1), C(i + 1, 1), C(i + 1, 0), C(i, 0)); } }

await emit(m, R, ATLAS, args, { extra: { front: { x: [-HX, HX], y: [LEG, LEG + BODY] } } });
