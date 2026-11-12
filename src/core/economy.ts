/** Catch valuation, the hold, the journal, selling. Pure functions over GameState. */
import { fish, RARITIES } from './content';
import { STRANGE_TRAITS, type CatchResult } from './fishing';
import type { CatchItem, GameState } from './state';

export const RHYTHM = { max: 10, perStack: 0.05, decayAfter: 60 };

export function traitMult(trait: string | null): number {
  return trait ? STRANGE_TRAITS.find((t) => t.id === trait)?.mult ?? 1 : 1;
}

/** Global value multiplier from progression (Echo upgrades, relics, gear) — extended as systems land. */
export function valueMultiplier(s: GameState): number {
  return 1 + (s.echoUpgrades['value'] ?? 0) * 0.1;
}

export function rhythmMult(s: GameState): number { return 1 + Math.min(RHYTHM.max, s.rhythm) * RHYTHM.perStack; }

export function catchValue(s: GameState, c: CatchResult): number {
  const f = fish(c.fishId);
  const v = f.baseValue * c.sizeFactor * traitMult(c.trait) * rhythmMult(s) * valueMultiplier(s) * (c.perfectHook ? 1.1 : 1);
  return Math.max(1, Math.round(v));
}

export interface AddResult { item: CatchItem | null; firstCatch: boolean; newRecord: boolean; holdFull: boolean }

/** Records a landed catch: journal, rhythm, stats, and the hold (if there is room). */
export function addCatch(s: GameState, c: CatchResult): AddResult {
  const j = s.journal[c.fishId];
  const firstCatch = !j;
  const newRecord = !!j && c.weight > j.bestWeight;
  s.journal[c.fishId] = {
    caught: (j?.caught ?? 0) + 1,
    bestWeight: Math.max(j?.bestWeight ?? 0, c.weight),
    traits: c.trait && !(j?.traits ?? []).includes(c.trait) ? [...(j?.traits ?? []), c.trait] : j?.traits ?? [],
    firstAt: j?.firstAt ?? s.playTime,
  };
  s.lifetime.catches++;
  if (c.perfectHook) s.lifetime.perfectHooks++;
  s.rhythm = Math.min(RHYTHM.max, s.rhythm + 1);
  const value = catchValue(s, c);
  if (s.hold.length >= s.holdCapacity) return { item: null, firstCatch, newRecord, holdFull: true };
  const item: CatchItem = { uid: s.nextUid++, fishId: c.fishId, weight: c.weight, trait: c.trait, value, perfect: c.perfectHook };
  s.hold.push(item);
  return { item, firstCatch, newRecord, holdFull: false };
}

export function breakRhythm(s: GameState) { s.rhythm = 0; }

export function sellAll(s: GameState): number {
  const total = s.hold.reduce((a, c) => a + c.value, 0);
  s.hold = [];
  s.coins += total; s.lifetime.coins += total; s.run.coins += total;
  return total;
}

export function sellItem(s: GameState, uid: number): number {
  const i = s.hold.findIndex((c) => c.uid === uid);
  if (i < 0) return 0;
  const [c] = s.hold.splice(i, 1);
  s.coins += c.value; s.lifetime.coins += c.value; s.run.coins += c.value;
  return c.value;
}

export function rarityIndex(fishId: string): number { return RARITIES.indexOf(fish(fishId).rarity); }

/** Short number format: 950, 1.2K, 3.4M, 5.6B. */
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n));
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1; let v = a;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (n < 0 ? '-' : '') + (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString()) + units[u];
}
