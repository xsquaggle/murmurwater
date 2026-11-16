/**
 * Things that grow where a boat might sail: the drowned trees of a grove. Worked out from the region's data
 * alone, so that the game draws them, the boat strikes them and the tests know of them in the same places.
 */
import type { Heightfield, RegionDef } from './world';

/** A stand of trees with their feet in the water: a rough disc, `spacing` metres between trunks. */
export interface GroveDef { id: string; x: number; z: number; r: number; spacing: number; seed: number }
export interface TreeSpot {
  x: number; z: number; yaw: number; scale: number;
  /** 'a': tall, in full moss. 'b': smaller, leaning, half dead. */
  kind: 'a' | 'b';
  /** How wide the trunk is at the waterline, as a radius a hull must keep clear of. */
  r: number;
}

const hash = (a: number, b: number, seed: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Every tree of every grove in a region. They stand only in water shallow enough for their roots to reach the bed. */
export function groveTrees(region: RegionDef & { groves?: GroveDef[] }, hf: Heightfield): TreeSpot[] {
  const out: TreeSpot[] = [];
  for (const g of region.groves ?? []) {
    const n = Math.ceil(g.r / g.spacing) + 1, row = g.spacing * 0.866;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      // A hexagonal lattice, each trunk shaken off its point, and a ragged edge.
      const jx = (hash(i, j, g.seed) - 0.5) * g.spacing * 0.62, jz = (hash(j, i, g.seed + 9) - 0.5) * g.spacing * 0.62;
      const lx = (i + (j & 1) * 0.5) * g.spacing + jx, lz = j * row + jz;
      const d = Math.hypot(lx, lz) / g.r, pick = hash(i * 3 + 1, j * 5 + 2, g.seed + 4);
      if (d > 0.78 + 0.22 * pick) continue;
      const x = g.x + lx, z = g.z + lz, h = hf.height(x, z);
      if (h > -0.35 || h < -2.2) continue;
      // Half-dead trees are commoner toward the edge of the grove.
      const kind = hash(i, j, g.seed + 21) < 0.14 + 0.3 * d * d ? 'b' : 'a';
      const scale = kind === 'a' ? 0.82 + 0.36 * hash(i, j, g.seed + 33) : 0.85 + 0.3 * hash(i, j, g.seed + 33);
      out.push({ x, z, yaw: hash(i, j, g.seed + 47) * Math.PI * 2, scale, kind, r: (kind === 'a' ? 1.25 : 0.95) * scale });
    }
  }
  return out;
}
