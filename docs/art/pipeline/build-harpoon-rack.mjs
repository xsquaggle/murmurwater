// build-harpoon-rack.mjs : Captain Oake's harpoon rack at Tryworks Landing, built in code (no generation job).
// Usage: node build-harpoon-rack.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// Two posts 2 m apart over all, propped from behind, with a trough rail low down and a rail at chest height; standing in
// it, points up, six harpoons (oiled shafts, iron shanks, the toggle heads bound up in sailcloth) and in the middle two
// lances, taller, their long blades bound the same way. Each bundle is tied with tarred twine. She keeps them clean and
// has not thrown one since. 2.4 m to the top of the lances. Faces +Z. Origin on the ground under the middle of the
// rack; the posts go 0.15 m into it. One material, `main`.
import { Model, pack, cli, emit, within, move, compose, rad, rng, add, sub, mul, norm } from './kit.mjs';
import { aim } from './fish.mjs';

const args = cli(), ATLAS = [512, 512], rnd = rng(83);
const PX = 0.92, PH = 1.78, LO = 0.30, HI = 1.55, RZ = 0.02;                                     // posts' middles, their tops; the trough's top, the rail's middle height and depth
const R = pack(...ATLAS, {
  post: [80, 300, { mat: 'wood', tone: 'drift', along: 'y', weather: 0.75, edge: 0.3, ao: { bottom: 0.4 } }],
  rail: [300, 40, { mat: 'wood', tone: 'drift', along: 'x', weather: 0.6, edge: 0.4 }],
  trough: [300, 60, { mat: 'wood', planks: 2, tone: 'grey', along: 'x', weather: 0.6, nails: 2, edge: 0.3 }],
  shaft: [24, 320, { mat: 'wood', tone: 'oiled', along: 'y', weather: 0.15, tile_x: true }],
  shank: [24, 160, { mat: 'iron', rust: 0.18, tile_x: true }],
  head: [96, 160, { mat: 'wrapped', turns: 5, ties: [0.2, 0.62], soft: 0 }],
  blade: [96, 200, { mat: 'wrapped', turns: 7, ties: [0.16, 0.5, 0.8], colour: '#D2C6A2', soft: 0 }],
  cap: [40, 40, { mat: 'wood', tone: 'drift', weather: 0.5 }],
});
const m = new Model('harpoon-rack');
m.material('main', { kind: 'texture', roughness: 0.85 });
const frame = m.part('frame', { crease: 40 }), irons = m.part('irons', { crease: 50 });

// ---- the frame: two posts with caps, a brace behind each, the trough in front low down, the rail at chest height
const side = { pz: R.post, nz: R.post, px: R.post, nx: R.post };
for (const sx of [-1, 1]) {
  frame.box([sx * PX, (PH - 0.15) / 2, -0.06], [0.05, (PH + 0.15) / 2, 0.05], side, { shade: { nz: 0.8 } });
  within(frame, compose(move([sx * PX, 0, -0.06]), (p) => [p[0] * Math.SQRT1_2 - p[2] * Math.SQRT1_2, p[1], p[0] * Math.SQRT1_2 + p[2] * Math.SQRT1_2]), (p) => p.lathe([[0.075, PH], [0.075, PH + 0.03], [0.03, PH + 0.08], [0, PH + 0.09]], 4, R.cap));
  within(frame, move([sx * PX, 0, -0.06]), (p) => p.tube([[0, 1.05, -0.04], [0, -0.1, -0.68]], 0.04, 4, R.post.sub(0, 0, 0.5, 1), { open: true, twist: Math.PI / 4 }));
}
frame.box([0, LO - 0.07, 0.09], [PX + 0.08, 0.07, 0.12], { py: R.trough, pz: R.trough.sub(0, 0, 1, 0.45), nz: R.trough.sub(0, 0, 1, 0.45), px: R.rail.sub(0, 0, 0.1, 1), nx: R.rail.sub(0, 0, 0.1, 1), ny: R.trough }, { shade: { ny: 0.5, nz: 0.8 } });
frame.box([0, HI, RZ], [PX + 0.08, 0.05, 0.03], { pz: R.rail, py: R.rail, ny: R.rail, nz: R.rail, px: R.rail.sub(0, 0, 0.1, 1), nx: R.rail.sub(0, 0, 0.1, 1) }, { shade: { ny: 0.6, nz: 0.8 } });

// ---- the irons: [x, lance?]; a shaft from the trough to the rail and on, an iron shank, the bound head; each leans a little back on the rail
const KIT = [[-0.83, 0], [-0.6, 0], [-0.37, 0], [-0.12, 1], [0.12, 1], [0.37, 0], [0.6, 0], [0.83, 0]];
for (const [x, lance] of KIT) {
  const foot = [x, LO, 0.13], rest = [x, HI, RZ + 0.03 + 0.024], d = norm(sub(rest, foot)), at = (s) => add(foot, mul(d, s)), j = 0.015 * (rnd() - 0.5);
  const S = lance ? [1.06, 1.68, 2.10] : [1.15, 1.62, 1.94];                                         // where the wood ends, the iron ends (the bundle's foot), the bundle's top, measured along the iron from its butt
  const turn = rnd() * 6, q = (s) => add(at(s), [j * s, 0, 0]);
  irons.tube([q(0), q(S[0])], [0.024, 0.021], 4, R.shaft, { open: true, twist: turn });
  irons.tube([q(S[0] - 0.02), q(S[1] - 0.04)], lance ? 0.012 : 0.013, 3, R.shank, { open: true, twist: turn });
  const L = lance ? (2.40 - q(S[1] - 0.05)[1]) / d[1] : S[2] - S[1], wr = lance ? 0.04 : 0.05, r = lance ? R.blade : R.head;     // the lances' bundles reach 2.4 m
  const prof = lance ? [[0, 0], [wr * 0.8, 0.07], [wr, 0.35], [wr * 0.55, 0.78], [0, 1]] : [[0, 0], [wr, 0.12], [wr * 1.05, 0.62], [0, 1]];
  within(irons, aim(q(S[1] - 0.05), d, [0, 0, 1]), (p) => p.lathe(prof.map(([rr, t]) => [rr, t * L]), 5, r, { v: prof.map(([, t]) => t), wobble: (i, k) => 1 + 0.08 * ((k * 3 + i) % 3 - 1) * (i > 0 && i < prof.length - 1 ? 1 : 0) }));
}

await emit(m, R, ATLAS, args);
