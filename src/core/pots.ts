/**
 * Lantern Pots: traps left in the water that catch fish on their own while the game is running.
 * A pot only knows the fish in the journal (it copies what the player has shown it), its fish are small and
 * sell for less, and it stops when it is full, so it has to be hauled. Nothing here reads a wall clock:
 * a pot's timer moves only when `tickPots` is called from the running game, so nothing is earned while closed.
 */
import { FISH, RARITIES, inHours, type FishDef } from './content';
import { RARITY_WEIGHT } from './fishing';
import { POTS, stats, type Stats } from './gear';
import { earn } from './economy';
import { Rng, hashString } from './rng';
import type { CatchItem, GameState, PotState } from './state';

/** Seconds a pot takes to trap one fish. */
export function potInterval(st: Stats): number { return POTS.interval / st.potSpeed; }

/** Pots owned (and granted by Echoes) that are not in the water. */
export function potsInHand(s: GameState, st = stats(s)): number { return Math.max(0, st.potCount - s.pots.placed.length); }

/** Minimum distance between two pots, so they cannot be stacked on one spot. */
export const POT_SPACING = 4;

export function canPlacePot(s: GameState, x: number, z: number, st = stats(s)): boolean {
  return potsInHand(s, st) > 0 && s.pots.placed.every((p) => p.region !== s.world.region || Math.hypot(p.x - x, p.z - z) >= POT_SPACING);
}

export function placePot(s: GameState, zone: string | null, x: number, z: number): PotState | null {
  if (!canPlacePot(s, x, z)) return null;
  const pot: PotState = { id: s.pots.nextId++, region: s.world.region, zone, x, z, fish: [], t: 0, n: 0 };
  s.pots.placed.push(pot);
  return pot;
}

/** What a pot can trap where it sits: fish of its zone that are in the journal, at this hour, never the Uncanny. */
export function potTable(s: GameState, pot: PotState, hour: number): FishDef[] {
  return FISH.filter((f) => f.region === pot.region && (!pot.zone || f.zones.includes(pot.zone)) && f.rarity !== 'uncanny'
    && !!s.journal[f.id] && inHours(hour, f.hours) && (!f.requires || s.flags.includes(f.requires)));
}

function trap(s: GameState, pot: PotState, hour: number, st: Stats): CatchItem | null {
  const table = potTable(s, pot, hour);
  const rng = new Rng(hashString(`${s.seed}:pot:${pot.id}:${pot.n++}`));
  if (!table.length) return null;
  const f = rng.weighted(table, (x) => RARITY_WEIGHT[x.rarity] * Math.pow(POTS.rarityFalloff, RARITIES.indexOf(x.rarity)));
  const r = Math.pow(rng.next(), 2.4); // pot fish run small
  const weight = Math.round((f.weight[0] + (f.weight[1] - f.weight[0]) * r) * 100) / 100;
  const value = Math.max(1, Math.round(f.baseValue * (0.75 + 0.6 * r) * st.potValue * st.value));
  return { uid: s.nextUid++, fishId: f.id, weight, trait: null, value, perfect: false };
}

/** Runs every pot's clock by `dt` seconds of play. Returns how many fish were trapped. */
export function tickPots(s: GameState, dt: number, hour: number, st = stats(s)): number {
  if (!s.pots.placed.length) return 0;
  const every = potInterval(st);
  let n = 0;
  for (const pot of s.pots.placed) {
    if (pot.fish.length >= st.potCapacity) { pot.t = 0; continue; }
    pot.t += dt;
    while (pot.t >= every && pot.fish.length < st.potCapacity) {
      pot.t -= every;
      const c = trap(s, pot, hour, st);
      if (c) { pot.fish.push(c); n++; }
    }
  }
  return n;
}

/** Empties a pot into the pot hold. Returns what came up. */
export function haulPot(s: GameState, id: number): CatchItem[] {
  const pot = s.pots.placed.find((p) => p.id === id);
  if (!pot) return [];
  const got = pot.fish;
  pot.fish = [];
  s.pots.hold.push(...got);
  return got;
}

/** Takes a pot out of the water (hauling it first). */
export function takeUpPot(s: GameState, id: number): boolean {
  const i = s.pots.placed.findIndex((p) => p.id === id);
  if (i < 0) return false;
  haulPot(s, id);
  s.pots.placed.splice(i, 1);
  return true;
}

/** Fish waiting in the pots, and room for how many. */
export function potsWaiting(s: GameState, st = stats(s)): { fish: number; room: number } {
  return { fish: s.pots.placed.reduce((a, p) => a + p.fish.length, 0), room: s.pots.placed.length * st.potCapacity };
}

/** Sells what has been hauled without touching the hand-caught hold. */
export function sellPotHold(s: GameState): number {
  const total = s.pots.hold.reduce((a, c) => a + c.value, 0);
  s.pots.hold = [];
  earn(s, total);
  return total;
}
