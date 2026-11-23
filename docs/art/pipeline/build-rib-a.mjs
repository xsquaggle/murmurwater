// build-rib-a.mjs : one of the great ribs of Saltbone Reach, built in code (no generation job).
// Usage: node build-rib-a.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A curved tusk of weathered bone standing out of the sea: 13 m above the water, 1.6 m thick at the foot, its blunt tip
// leaning 7 m out over the channel toward +X. Origin at the waterline in the middle of the foot; 2.5 m below it.
// Cream bone, cracked and pitted, grey-green between the tides with weed and limpets, orange lichen high up (see rib.mjs).
import { cli } from './kit.mjs';
import { rib } from './rib.mjs';

await rib({ name: 'rib-a', seed: 23, atlas: [1024, 1024], cols: 2, wide: 440, high: 13, over: 7, turn: 104, belly: 0.5, foot: 0.73, tip: 0.27, rings: 24, limpets: 9, painted: 26, tide: 1.25, lichen: { lo: 6.5, hi: 9.5, amount: 0.17 } }, cli());
