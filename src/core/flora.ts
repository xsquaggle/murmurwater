/**
 * Things that stand where a boat might sail: the drowned trees of a grove, the great ribs of Saltbone Reach and
 * the vertebrae that lie awash about them. Worked out from the region's data alone, so that the game draws
 * them, the boat strikes them and the tests know of them in the same places.
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

/**
 * The Ribs: `pairs` great ribs in two facing rows either side of the line from `a` to `b`, each standing `half`
 * metres off it and leaning in over it. `broken` are the ones (numbered 0.. along the line, even on the left
 * hand going from a to b, odd on the right) that have snapped off short.
 */
export interface RibsDef { a: [number, number]; b: [number, number]; pairs: number; half: number; broken?: number[] }
export interface RibSpot {
  i: number; x: number; z: number;
  /** Turn about the vertical that brings the rib's lean (its own +X) round to face the channel. */
  yaw: number;
  scale: number;
  /** 'a': whole. 'b': broken off at two thirds. */
  kind: 'a' | 'b';
  /** The foot at the waterline, as a radius a hull must keep clear of. */
  r: number;
}

/** Where every rib stands. */
export function ribSpots(region: { ribs?: RibsDef }): RibSpot[] {
  const d = region.ribs;
  if (!d) return [];
  const vx = d.b[0] - d.a[0], vz = d.b[1] - d.a[1], L = Math.hypot(vx, vz), ux = vx / L, uz = vz / L, px = -uz, pz = ux;
  const out: RibSpot[] = [];
  for (let k = 0; k < d.pairs; k++) for (const side of [1, -1]) {
    const i = k * 2 + (side > 0 ? 0 : 1), t = d.pairs > 1 ? k / (d.pairs - 1) : 0.5;
    // Not quite a ruled line: each stands a little off its mark, as things do that have stood in a sea for a long time.
    const along = (hash(i, 1, 61) - 0.5) * 2.4, out2 = (hash(i, 2, 62) - 0.5) * 1.6;
    const x = d.a[0] + vx * t + ux * along + px * side * (d.half + out2), z = d.a[1] + vz * t + uz * along + pz * side * (d.half + out2);
    // Its lean goes toward the line: local +X to (-side * p).
    const yaw = Math.atan2(side * pz, -side * px) + (hash(i, 3, 63) - 0.5) * 0.16;
    const scale = 0.93 + 0.14 * hash(i, 4, 64);
    out.push({ i, x, z, yaw, scale, kind: d.broken?.includes(i) ? 'b' : 'a', r: 0.95 * scale });
  }
  return out;
}

/** A scatter of vertebrae: up to `max` of them, tried at `n` places within `r` of (x, z). */
export interface BonesDef { x: number; z: number; r: number; n: number; max: number; seed: number }
export interface BoneSpot { x: number; z: number; yaw: number; scale: number; /** How far it has sunk into the ground, m. */ sunk: number; r: number }

/**
 * Every vertebra of a region. They lie only where the ground is near the waterline (awash, or on a beach), and
 * never on something else that is there: `keep` is [x, z, radius] of what must be left clear.
 */
export function boneSpots(region: { bones?: BonesDef[]; ribs?: RibsDef }, hf: Heightfield, keep: readonly [number, number, number][] = []): BoneSpot[] {
  const out: BoneSpot[] = [], ribs = ribSpots(region);
  for (const b of region.bones ?? []) {
    let made = 0;
    for (let k = 0; k < b.n && made < b.max; k++) {
      const a = hash(k, 1, b.seed) * Math.PI * 2, d = Math.sqrt(hash(k, 2, b.seed)) * b.r;
      const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, h = hf.height(x, z);
      if (h < -0.85 || h > 0.4) continue;
      if (keep.some((c) => Math.hypot(c[0] - x, c[1] - z) < c[2] + 1.6)) continue;
      if (ribs.some((r) => Math.hypot(r.x - x, r.z - z) < 4) || out.some((o) => Math.hypot(o.x - x, o.z - z) < 5)) continue;
      const scale = 0.8 + 0.45 * hash(k, 3, b.seed);
      // Ashore it has sunk into the shingle; awash it sits on the bed with the water round its waist.
      out.push({ x, z, yaw: hash(k, 4, b.seed) * Math.PI * 2, scale, sunk: h > 0 ? 0.35 + 0.3 * hash(k, 5, b.seed) : 0, r: 1.15 * scale });
      made++;
    }
  }
  return out;
}
