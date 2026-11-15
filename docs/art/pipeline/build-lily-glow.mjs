// build-lily-glow.mjs : lily pads with two closed buds for Mossglass Fen, built in code (no generation job).
// Usage: node build-lily-glow.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// Six pads lying on the water and two buds standing 0.3 m high between them; 1.6 m across.
// Origin at the waterline in the middle, +Y up, metres. Two materials: `main` (the pads) and `Glow` (the buds: pale
// lilac by day in the base colour, their own glow map for the dark).
import { Model, pack, cli, emit, within, rotX, rotY, move, compose, rad, rng } from './kit.mjs';

const args = cli(); const ATLAS = [512, 256]; const rnd = rng(5);
const R = pack(...ATLAS, {
  padA: [200, 200, { mat: 'lilypad', tone: ['#2C5638', '#4A7F45', '#84AC5C'] }], padB: [200, 200, { mat: 'lilypad', tone: ['#2A5440', '#467A52', '#7FA868'] }],
  bud: [72, 180, { mat: 'bud', tile_x: true, glow: { mat: 'glow', colour: '#9FF5E6', dark: '#1E5A55', pale: 0.4, soft: 2 } }],
});
const m = new Model('lily-glow');
m.material('main', { kind: 'texture', roughness: 0.75 });
m.material('Glow', { kind: 'texture', roughness: 0.7, emissive: [1, 1, 1], glow: true });
const pads = m.part('pads', { crease: 12 }), buds = m.part('buds', { material: 'Glow', crease: 40 });

// ---- pads: a fan of eight wedges with a notch cut out, a little dished, the rim lifting here and there
const K = 1.12, SEG = 8;
[[-0.36, -0.14, 0.36, 200], [0.34, -0.36, 0.30, 70], [0.42, 0.22, 0.26, 330], [-0.10, 0.46, 0.24, 120], [-0.55, 0.36, 0.16, 20], [0.08, 0.02, 0.11, 250]].forEach(([x, z, r, notch], n) => {
  const rect = n % 2 ? R.padB : R.padA, y0 = 0.012 + 0.003 * n, gap = 18 + 14 * rnd(), c = [x * K, y0 - 0.004, z * K];
  const rim = (j) => { const a = rad(notch + gap / 2 + (360 - gap) * j / SEG), k = (j === 0 || j === SEG ? 0.94 : 0.95 + 0.1 * rnd()) * r * K, lift = (j === 0 || j === SEG ? 0.014 : 0.012 * rnd());
    return [[c[0] + k * Math.cos(a), y0 + lift, c[2] - k * Math.sin(a)], rect.at(0.5 + 0.47 * Math.cos(a) * k / (r * K * 1.05), 0.5 + 0.47 * Math.sin(a) * k / (r * K * 1.05)), 1]; };
  const pts = Array.from({ length: SEG + 1 }, (_, j) => rim(j));
  for (let j = 0; j < SEG; j++) pads.tri(pts[j], pts[j + 1], [c, rect.at(0.5, 0.5), 0.9]);
});

// ---- buds: closed, on a short stalk out of the water, leaning a little
const BUD = [[0.020, -0.06], [0.025, 0.02], [0.070, 0.11], [0.060, 0.20], [0, 0.32]];
[[0.0, -0.50, 16, 40], [0.12, 0.30, 22, 205]].forEach(([x, z, tilt, toward]) =>
  within(buds, compose(move([x * K, 0, z * K]), rotY(rad(toward)), rotX(rad(tilt)), rotY(rnd() * 6.28)), (p) => p.lathe(BUD, 5, R.bud, { v: [0, 0.12, 0.42, 0.7, 1] })));

await emit(m, R, ATLAS, args, { quality: 88 });
