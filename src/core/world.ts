/**
 * World geometry shared by rendering and game logic: the seabed/land heightfield.
 * Water level is y = 0. Pure and deterministic.
 */
import { Noise2D } from './noise';

export type IslandProfile = 'hill' | 'stack' | 'bar';

export interface IslandDef {
  id: string; name: string;
  x: number; z: number; rx: number; rz: number; rot: number;
  height: number; seed: number; profile: IslandProfile;
}
export interface CarveDef { x: number; z: number; r: number; depth: number }
export interface LandmarkPose { x: number; z: number; rot?: number; facing?: number; length?: number }
export interface RegionDef {
  id: string; name: string; center: [number, number]; radius: number; seaDepth: number; grade: string;
  islands: IslandDef[]; carves: CarveDef[]; landmarks: Record<string, LandmarkPose>;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** Polynomial smooth max. */
const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

export class Heightfield {
  private noise: Noise2D;
  private islandNoise: Noise2D[];
  constructor(public readonly region: RegionDef, seed = 1234) {
    this.noise = new Noise2D(seed);
    this.islandNoise = region.islands.map((i) => new Noise2D(seed * 31 + i.seed));
  }

  /** Terrain height at world (x, z). Negative = below water. */
  height(x: number, z: number): number {
    const r = this.region;
    const n = this.noise;
    let h = -r.seaDepth + n.fbm(x * 0.0035, z * 0.0035, 3) * 5;
    for (let k = 0; k < r.islands.length; k++) {
      const isl = r.islands[k];
      const dx = x - isl.x, dz = z - isl.z;
      const c = Math.cos(isl.rot), s = Math.sin(isl.rot);
      const lx = (dx * c - dz * s) / isl.rx;
      const lz = (dx * s + dz * c) / isl.rz;
      let d = Math.sqrt(lx * lx + lz * lz);
      if (d > 2.2) continue;
      const inoise = this.islandNoise[k];
      // Coastline warp makes the outline irregular.
      d *= 1 + 0.22 * inoise.fbm(x * 0.012, z * 0.012, 3);
      const t = 1 - d; // 1 at centre, 0 at coast, negative offshore
      let ih: number;
      if (isl.profile === 'stack') {
        const shelf = smooth(-1.2, -0.1, t);
        const cliff = smooth(-0.05, 0.12, t);
        ih = -r.seaDepth * (1 - shelf) - 3 * shelf + cliff * (isl.height + 3) * (0.9 + 0.1 * inoise.get(x * 0.2, z * 0.2));
      } else if (isl.profile === 'bar') {
        const shelf = smooth(-1.0, 0.0, t);
        ih = -r.seaDepth * (1 - shelf) - 1.4 * shelf + smooth(0, 0.5, t) * (isl.height + 1.4);
      } else {
        const shelf = smooth(-0.9, -0.02, t); // shallow underwater shelf
        const beach = smooth(-0.04, 0.08, t);
        const hill = Math.pow(smooth(0.04, 1.0, t), 1.25);
        const ridged = 1 - Math.abs(inoise.fbm(x * 0.009, z * 0.009, 4));
        const detail = 0.75 + 0.35 * ridged;
        const terraces = hill * isl.height * detail;
        // Soft terracing gives the low-poly plateaus their character.
        const step = 3.2;
        const terr = Math.floor(terraces / step) * step + smooth(0.55, 1, (terraces / step) % 1) * step;
        const land = 0.6 * terraces + 0.4 * terr;
        ih = -r.seaDepth * (1 - shelf) - 2.2 * shelf + beach * 2.6 + land;
      }
      h = smax(h, ih, 2.5);
    }
    for (const c of r.carves) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz) / c.r;
      if (d < 1) {
        const f = smooth(1, 0.45, d);
        h = h * (1 - f) + Math.min(h, -c.depth) * f;
      }
    }
    return h;
  }

  /** Water depth at (x, z) (0 on land). */
  depth(x: number, z: number): number { return Math.max(0, -this.height(x, z)); }

  /** Approximate surface normal via central differences. */
  normal(x: number, z: number, e = 1): [number, number, number] {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }
}
