// build-struck-ring.mjs : struck water on Saltbone Reach, built in code (no generation job).
// Usage: node build-struck-ring.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// Not a thing but a mark: where lightning has struck the sea, a flat ring 7 m across lies on the water, a thin band
// of pale light, and twelve short licks of pale fire stand round it, each 0.6-1.0 m high, all leaning the same way
// round (anticlockwise seen from above), as if the ring were turning. Everything glows: the one material `main` has
// its texture for its glow map. Origin at the middle of the ring on the water; the licks go 5 cm under it.
import { Model, pack, cli, emit, within, rotY, move, compose, scale, rad, rng } from './kit.mjs';

const args = cli(), ATLAS = [256, 256], rnd = rng(12);
const RR = 3.5, N = 12;
const R = pack(...ATLAS, {
  fire: [96, 200, { mat: 'glow', colour: '#E4F6FF', dark: '#6FAED6', tip: 0, pale: 0.7, tile_x: true }],
  band: [128, 24, { mat: 'glow', colour: '#D2EEFF', dark: '#7DB6DA', along: 'x', pale: 0.5, tip: 0 }],
});
const m = new Model('struck-ring');
m.material('main', { kind: 'texture', roughness: 0.4, emissive: [1, 1, 1], glow: true });
const p = m.part('ring', { crease: 60 });

// ---- the band on the water: 24 quads, facing up
for (let i = 0; i < 24; i++) {
  const a0 = 2 * Math.PI * i / 24, a1 = 2 * Math.PI * (i + 1) / 24, at = (r, a) => [r * Math.cos(a), 0.01, -r * Math.sin(a)];
  p.quad([at(RR + 0.08, a0), R.band.at(i / 24, 0)], [at(RR + 0.08, a1), R.band.at((i + 1) / 24, 0)], [at(RR - 0.08, a1), R.band.at((i + 1) / 24, 1)], [at(RR - 0.08, a0), R.band.at(i / 24, 1)]);
}
// ---- the licks: flattened three-sided tongues on a bent path, leaning along the ring
for (let k = 0; k < N; k++) {
  const a = 2 * Math.PI * (k + 0.3 * (rnd() - 0.5)) / N, h = 0.6 + 0.4 * rnd(), lean = 0.35 + 0.2 * rnd();
  within(p, compose(move([RR * Math.cos(a), 0, -RR * Math.sin(a)]), rotY(a), scale([0.35, 1, 1])), (q) =>
    q.tube([[0, -0.05, 0], [0, 0.45 * h, -0.35 * lean * h], [0, h, -lean * h]], [0.3, 0.17, 0.0], 3, R.fire, { open: true, twist: rnd() }));
}

await emit(m, R, ATLAS, args);
