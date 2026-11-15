// build-lantern-tree-a.mjs : the big lantern tree of Mossglass Fen, built in code (no generation job).
// Usage: node build-lantern-tree-a.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A drowned tree 11 m tall with a crown 7 m across: a buttressed trunk, four roots, five knees, five pads of leaves and
// about a hundred ribbons of hanging moss. Origin at the waterline under the trunk; the roots go on 1.5 m below it.
import { cli } from './kit.mjs';
import { lanternTree } from './lantern-tree.mjs';

await lanternTree({
  name: 'lantern-tree-a', seed: 41, sides: 10, foot: -1.5, twist: 0.012,
  trunk: [[-0.05, -1.50, 0.00, 0.86, 1.00], [-0.03, -0.60, 0.00, 0.80, 0.86], [0.00, 0.25, 0.00, 0.70, 0.62], [0.08, 1.20, 0.04, 0.60, 0.34], [0.26, 2.50, 0.12, 0.52, 0.13],
    [0.42, 4.00, 0.10, 0.47, 0.03], [0.36, 5.50, -0.04, 0.43, 0], [0.18, 7.00, -0.14, 0.37, 0], [0.12, 8.50, -0.10, 0.29, 0], [0.20, 9.85, -0.05, 0.17, 0]],
  pads: [
    { at: [0.20, 9.95, -0.05], r: 2.35, h: 1.05, sides: 10, moss: 30, len: [1.6, 3.4], tilt: [3, 40] },
    { at: [2.01, 8.35, -0.90], r: 1.50, h: 0.72, from: 5.6, moss: 16, len: [1.2, 2.8], tilt: [5, 25] },
    { at: [-1.62, 7.55, -1.10], r: 1.40, h: 0.66, from: 5.0, moss: 15, len: [1.2, 2.6], tilt: [6, 150] },
    { at: [-0.06, 8.90, 1.83], r: 1.55, h: 0.72, from: 6.2, moss: 16, len: [1.2, 2.8], tilt: [4, 262] },
    { at: [2.12, 6.45, 1.30], r: 1.10, h: 0.52, from: 4.2, moss: 11, len: [1.0, 2.2], tilt: [7, 325] },
  ],
  boughMoss: 5,
  roots: [[8, 1.95, 1.25, 0.24], [128, 1.7, 1.0, 0.2], [205, 2.1, 1.35, 0.25], [292, 1.65, 0.95, 0.19]],
  knees: [[2.3, 0.7, 0.55, 0.26], [-1.2, 2.1, 0.75, 0.30], [-2.4, -0.6, 0.4, 0.24], [0.5, -2.3, 0.62, 0.28], [1.5, 1.9, 0.3, 0.22]],
}, cli());
