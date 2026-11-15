// build-reeds-a.mjs : a clump of reeds for Mossglass Fen, built in code (no generation job).
// Usage: node build-reeds-a.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A clump of reeds 1.75 m tall: thirty-six blades and three bulrushes. 1.2 m across, origin at the waterline, feet 0.6 m below it.
// UV v runs 0 at the foot to 1 at the tip of every blade (see reeds.mjs).
import { cli } from './kit.mjs';
import { reedClump } from './reeds.mjs';

await reedClump({ name: 'reeds-a', seed: 9, tall: 1.75, blades: 30, shorts: 6, rushes: 3, spread: 0.3, dry: 0.3 }, cli());
