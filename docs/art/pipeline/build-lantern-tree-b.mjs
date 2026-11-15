// build-lantern-tree-b.mjs : the small lantern tree of Mossglass Fen, leaning and half dead, built in code (no generation job).
// Usage: node build-lantern-tree-b.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// 8 m tall, leaning toward +X: a bleached trunk broken off at the top, two pads of leaves still living on the side it
// leans to, three bare boughs, and a few ribbons of moss. Origin at the waterline under the trunk; 1.5 m below it.
import { cli } from './kit.mjs';
import { lanternTree } from './lantern-tree.mjs';

await lanternTree({
  name: 'lantern-tree-b', seed: 77, sides: 8, foot: -1.5, twist: -0.015, dead: 0.55, snag: true,
  trunk: [[-0.28, -1.50, 0.00, 0.74, 1.00], [-0.14, -0.60, 0.00, 0.68, 0.86], [0.00, 0.25, 0.00, 0.58, 0.60], [0.20, 1.20, 0.03, 0.48, 0.32], [0.50, 2.50, 0.06, 0.41, 0.12],
    [0.84, 3.80, 0.04, 0.36, 0.02], [1.12, 5.00, -0.02, 0.30, 0], [1.30, 6.00, -0.06, 0.23, 0], [1.38, 6.70, -0.05, 0.17, 0]],
  pads: [
    { at: [2.55, 7.26, 0.55], r: 1.45, h: 0.74, from: 4.9, moss: 8, len: [1.0, 2.4], tilt: [8, 10] },
    { at: [1.20, 5.75, -1.75], r: 1.05, h: 0.50, from: 3.9, moss: 4, len: [0.8, 1.8], tilt: [9, 80] },
  ],
  bare: [
    { from: 4.3, toward: 185, reach: 2.2, rise: 1.5, r: 0.18, twig: 0.5, moss: 2 },
    { from: 5.6, toward: 120, reach: 1.5, rise: 1.3, r: 0.15, twig: 0.45 },
    { from: 3.2, toward: 265, reach: 1.3, rise: 0.5, r: 0.16, twig: 0, moss: 1 },
  ],
  roots: [[170, 1.9, 1.2, 0.23], [20, 1.5, 0.9, 0.19], [280, 1.7, 1.05, 0.2]],
  knees: [[-2.1, 0.9, 0.5, 0.26], [1.7, -1.4, 0.65, 0.28], [0.9, 2.0, 0.35, 0.22]],
}, cli());
