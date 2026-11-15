// build-reeds-b.mjs : a clump of reeds for Mossglass Fen, built in code (no generation job).
// Usage: node build-reeds-b.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A clump of bulrushes 2.2 m tall: seven bulrushes among twenty blades. 1.2 m across, origin at the waterline, feet 0.6 m below it.
// UV v runs 0 at the foot to 1 at the tip of every blade (see reeds.mjs).
import { cli } from './kit.mjs';
import { reedClump } from './reeds.mjs';

await reedClump({ name: 'reeds-b', seed: 23, tall: 2.2, blades: 18, shorts: 2, rushes: 7, spread: 0.26, dry: 0.45 }, cli());
