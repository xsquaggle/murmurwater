// build-rib-mark.mjs : the mark on the ninth rib of the Ribs, Saltbone Reach, built in code (no generation job).
// Usage: node build-rib-mark.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A brass plate the size of a hand (0.30 x 0.20 m) let into the bone, kept bright: NINE cut deep across it and under
// that, scratched in with a knife, IN FOR NINE, OUT FOR NINE. / COUNT IT YOURSELF. I.F. (Oake's plate said KEEP OFF.)
// Beside it on the right a ring bolt, its ring hanging against the bone, and a frayed end of rope tied to the ring
// hanging 0.4 m down. The plate's face is toward +Z and stands 6 mm proud; the origin is on the bone's surface at the
// plate's middle, so the model sits on a rib with its origin on the surface and +Z out. One material, `main`.
import { Model, pack, cli, emit, within, rotX, move, compose, rad } from './kit.mjs';

const args = cli(), ATLAS = [512, 512];
const R = pack(...ATLAS, {
  plate: [480, 320, { mat: 'ribplate' }],
  edge: [64, 16, { mat: 'brass', patina: 0.6, verdigris: 0.3 }],
  iron: [64, 64, { mat: 'iron', rust: 0.55 }],
  rope: [128, 16, { mat: 'rope', pitch: 16 }],
  fray: [48, 48, { mat: 'fray' }],
});
const m = new Model('rib-mark');
m.material('main', { kind: 'texture', roughness: 0.6 });
const p = m.part('mark', { crease: 40 });

// ---- the plate, let in: only its face and a sliver of its edges stand out of the bone
p.box([0, 0, -0.007], [0.15, 0.1, 0.013], { pz: R.plate, px: R.edge, nx: R.edge, py: R.edge, ny: R.edge }, { shade: { px: 0.8, nx: 0.8, py: 0.95, ny: 0.7 } });
// ---- the ring bolt: a square boss with the eye in it, the ring through the eye hanging against the bone
const EYE = [0.215, 0.025, 0];
within(p, compose(move(EYE), rotX(rad(90))), (q) => q.lathe([[0.02, -0.005], [0.008, 0.028]], 4, R.iron, { shade: (i) => [0.7, 1][i] }));
within(p, compose(move([EYE[0], EYE[1] - 0.05, 0.03]), rotX(rad(78))), (q) => q.torus(0.05, 0.008, 7, 3, R.iron));
// ---- the rope: tied on at the bottom of the ring, hanging, its end come undone
const END = [0.245, -0.33, 0.05];
p.tube([[0.2, -0.07, 0.048], [0.222, -0.16, 0.05], END], 0.011, 3, R.rope, { lay: 1, open: true });
for (const [dx, tip] of [[-0.009, [0.212, -0.405, 0.052]], [0, [0.25, -0.415, 0.066]], [0.009, [0.283, -0.392, 0.044]]]) {
  const a = [END[0] + dx - 0.006, END[1] + 0.004, END[2]], b = [END[0] + dx + 0.006, END[1] - 0.002, END[2]];
  const A = [a, R.fray.at(0.2, 0)], B = [b, R.fray.at(0.8, 0)], T = [tip, R.fray.at(0.5, 1)];
  p.tri(A, B, T).tri(B, A, T);                                                       // each yarn is seen from both sides
}

await emit(m, R, ATLAS, args);
