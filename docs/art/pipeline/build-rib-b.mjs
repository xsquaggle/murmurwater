// build-rib-b.mjs : a broken rib of Saltbone Reach, built in code (no generation job).
// Usage: node build-rib-b.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// The same kind as rib-a, broken off at two thirds: 8 m above the water to the tallest shard of a jagged end, a gull's
// nest with two eggs in the break. Origin at the waterline in the middle of the foot; 2.5 m below it. It leans toward +X.
import { cli } from './kit.mjs';
import { rib } from './rib.mjs';

await rib({ name: 'rib-b', seed: 41, atlas: [512, 1024], cols: 1, wide: 400, high: 11.6, over: 6.2, turn: 100, belly: 0.45, foot: 0.73, tip: 0.27, rings: 9, limpets: 8, painted: 20, tide: 1.25, lichen: { lo: 4.6, hi: 6.6, amount: 0.15 }, broken: { at: 6.9, top: 8 } }, cli());
