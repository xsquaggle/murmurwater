/** The dock's walkable deck, shared by the renderer (which builds it) and the game (which walks on it). */
import type { LandmarkPose } from './world';

export const DOCK = { deckY: 1.35, width: 2.8, landing: 6.5, landingHalf: 4.2, endHalf: 3.5, endLength: 5, shoreRun: 6 };

/** Deck height if (x, z) is on the dock, else null. */
export function dockDeckAt(L: LandmarkPose, x: number, z: number): number | null {
  const yaw = L.rot ?? 0, length = L.length ?? 30;
  const dx = x - L.x, dz = z - L.z;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const along = dx * fx + dz * fz;
  const side = Math.abs(dx * fz - dz * fx);
  if (along < -DOCK.shoreRun || along > length + DOCK.endLength) return null;
  const half = along > length ? DOCK.endHalf : along >= 0 && along < DOCK.landing ? DOCK.landingHalf : DOCK.width / 2 - 0.05;
  return side <= half ? DOCK.deckY + 0.07 : null;
}
