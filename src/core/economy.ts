/** Catch valuation, the hold, the journal, selling. Pure functions over GameState. */
import { fish, RARITIES } from './content';
import { STRANGE_TRAITS, type CatchResult } from './fishing';
import { stats } from './gear';
import type { CatchItem, GameState } from './state';

/** Rhythm: each catch in a row without a snap adds a stack; the cap comes from gear (stats().rhythmCap, 10 to start). */
export const RHYTHM = { perStack: 0.05, decayAfter: 60 };

export function traitMult(trait: string | null): number {
  return trait ? STRANGE_TRAITS.find((t) => t.id === trait)?.mult ?? 1 : 1;
}

export function rhythmMult(s: GameState, cap = stats(s).rhythmCap): number { return 1 + Math.min(cap, s.rhythm) * RHYTHM.perStack; }

export function catchValue(s: GameState, c: CatchResult, st = stats(s)): number {
  const f = fish(c.fishId);
  const v = f.baseValue * c.sizeFactor * traitMult(c.trait) * rhythmMult(s, st.rhythmCap) * st.value * (c.perfectHook ? 1.1 : 1);
  return Math.max(1, Math.round(v));
}

export interface AddResult { item: CatchItem | null; firstCatch: boolean; newRecord: boolean; holdFull: boolean }

/** Records a landed catch: journal, rhythm, stats, and the hold (if there is room). */
export function addCatch(s: GameState, c: CatchResult, st = stats(s)): AddResult {
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
  s.rhythm = Math.min(st.rhythmCap, s.rhythm + 1);
  const value = catchValue(s, c, st);
  if (s.hold.length >= st.hold) return { item: null, firstCatch, newRecord, holdFull: true };
  const item: CatchItem = { uid: s.nextUid++, fishId: c.fishId, weight: c.weight, trait: c.trait, value, perfect: c.perfectHook };
  s.hold.push(item);
  return { item, firstCatch, newRecord, holdFull: false };
}

export function breakRhythm(s: GameState) { s.rhythm = 0; }

/** Coins that were earned (sales, rewards, finds): they count toward the tide's total and the lifetime's. */
export function earn(s: GameState, coins: number) { s.coins += coins; s.lifetime.coins += coins; s.run.coins += coins; }

/** Sells the hold and everything hauled from the pots. */
export function sellAll(s: GameState): number {
  const total = s.hold.reduce((a, c) => a + c.value, 0) + s.pots.hold.reduce((a, c) => a + c.value, 0);
  s.hold = []; s.pots.hold = [];
  earn(s, total);
  return total;
}

export function sellItem(s: GameState, uid: number): number {
  const i = s.hold.findIndex((c) => c.uid === uid);
  if (i < 0) return 0;
  const [c] = s.hold.splice(i, 1);
  earn(s, c.value);
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
