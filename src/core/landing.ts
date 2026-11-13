/**
 * Where a person can stand, and how they get between a boat and the shore. Pure, shared by the game,
 * the bots and the content tests (every mooring must have somewhere to step off).
 */
import { dockDeckAt } from './dock';
import type { BoatEnv } from './boat';
import type { Heightfield } from './world';

/**
 * The sea a boat sails on in a region: depth from the seabed, the dock and any rocks ([x, z, radius]) as
 * solids, and the region's edge for the murmur.
 */
export function boatEnv(hf: Heightfield, rocks: readonly (readonly [number, number, number])[] = []): BoatEnv {
  const dock = hf.region.landmarks.dock;
  return {
    depth: (x, z) => hf.depth(x, z),
    solid: (x, z) => {
      if (dockDeckAt(dock, x, z) !== null) return true;
      for (let i = 0; i < rocks.length; i++) { const r = rocks[i], dx = x - r[0], dz = z - r[1]; if (dx * dx + dz * dz < r[2] * r[2]) return true; }
      return false;
    },
    centre: hf.region.center, radius: hf.region.radius,
  };
}

/** Ground height for walking at (x, z): the dock deck or dry, gentle land; null where you can't walk. */
export function walkableHeight(hf: Heightfield, x: number, z: number): number | null {
  const deck = dockDeckAt(hf.region.landmarks.dock, x, z);
  const h = hf.height(x, z);
  if (deck !== null) return Math.max(deck, h);
  if (h < 0.15) return null;
  if (hf.normal(x, z, 0.8)[1] < 0.62) return null;
  return h;
}

export const LANDING = {
  /** How far from the hull a person can step or wade between a boat and the shore, m. */ reach: 6.4,
  /** Boarding reaches this much further than landing, so the spot she put you ashore on is always in reach. */ slack: 0.6,
  /** The highest bank they can climb onto from the boat, m above the water. */ maxStep: 2.6,
};

/** A boat's place on the water. */
export interface BoatPose { x: number; z: number; heading: number }

/** Half the length and half the beam of the hull a person steps to and from, m. */
const HULL = { half: 1.8, side: 0.75 };

/** How far (x, z) is from the hull of a boat: 0 when alongside. Forward is (sin h, cos h). */
export function hullDistance(boat: BoatPose, x: number, z: number): number {
  const s = Math.sin(boat.heading), c = Math.cos(boat.heading);
  const dx = x - boat.x, dz = z - boat.z;
  const along = Math.max(-HULL.half, Math.min(HULL.half, dx * s + dz * c));
  return Math.max(0, Math.hypot(dx - s * along, dz - c * along) - HULL.side);
}

/**
 * The nearest place to stand ashore from a floating boat: the closest walkable spot within reach of the
 * hull that is not a cliff top. Null in open water. `clear` says whether a spot is free of people and
 * props; a spot that is not is used only when there is no other.
 *
 * Boarding reaches further than this does (by LANDING.slack), so wherever she can put someone ashore
 * she can be boarded again from the same spot. Nothing may land a person further off than that.
 */
export function landingSpot(ground: (x: number, z: number) => number | null, boat: BoatPose, clear?: (x: number, z: number) => boolean, reach = LANDING.reach): { x: number; y: number; z: number } | null {
  const ok = (x: number, z: number): number | null => {
    if (hullDistance(boat, x, z) > reach) return null;
    const y = ground(x, z);
    return y === null || y > LANDING.maxStep ? null : y;
  };
  let spare: { x: number; y: number; z: number } | null = null;
  const far = reach + HULL.half + HULL.side;
  for (let r = 1.2; r <= far + 1e-6; r += 0.45) {
    const n = Math.max(12, Math.round(r * 5));
    let best: { x: number; y: number; z: number } | null = null;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = boat.x + Math.sin(a) * r, z = boat.z + Math.cos(a) * r;
      const y = ok(x, z);
      if (y === null) continue;
      if (clear && !clear(x, z)) { if (!spare) spare = { x, y, z }; continue; }
      // Prefer the lowest spot on the ring: the beach, not the bank behind it.
      if (!best || y < best.y) best = { x, y, z };
    }
    if (best) {
      // Step a little further in, so the player is not left standing on the very edge.
      const dx = best.x - boat.x, dz = best.z - boat.z, d = Math.hypot(dx, dz);
      const ix = best.x + (dx / d) * 0.6, iz = best.z + (dz / d) * 0.6, iy = ok(ix, iz);
      return iy !== null && (!clear || clear(ix, iz)) ? { x: ix, y: iy, z: iz } : best;
    }
  }
  return spare;
}
