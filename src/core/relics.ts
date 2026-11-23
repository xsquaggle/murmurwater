/**
 * Relics: what they are, where the unfound ones lie and what is said of them, the Keeper's Shelf they stand on,
 * and the Moonpearls set beside them. Pure functions over GameState; the data is src/data/relics.json.
 */
import relicsJson from '../data/relics.json';
import { REGIONS_BY_ID, inHours } from './content';
import type { Effect, StatKey } from './gear';
import type { GameState } from './state';

export interface RelicDef {
  id: string; name: string; /** The water it belongs to: its place on the Shelf shows once that water is reached. */ region: string;
  effect: Effect; lore: string;
  /** What is said of it before it is found. `after`: what must have happened before anybody says it (see `met`). */
  hint: { text: string; after?: string };
  /**
   * Fished up: the zones it lies in, the hours it comes to a line, and what must have happened first.
   * A relic without this is given (a job, a journal page), not found.
   */
  where?: { zones: string[]; hours?: [number, number]; needs?: string };
}

export const RELICS = relicsJson.relics as RelicDef[];
export const RELICS_BY_ID = new Map(RELICS.map((r) => [r.id, r]));
/** How many pearls a relic takes, and how much of its gift each one adds again. */
export const PEARLS = relicsJson.pearls as { hollows: number; each: number };

/**
 * Has this happened in the save? `quest:<id>` is a job handed in, `crew:<id>` a hand signed on; anything else is
 * a story flag (`reached:<region>` among them). Nothing asked is always met.
 */
export function met(s: GameState, need: string | undefined): boolean {
  if (!need) return true;
  if (need.startsWith('quest:')) return s.quests.done.includes(need.slice(6));
  if (need.startsWith('crew:')) return s.crew.hired.includes(need.slice(5));
  return s.flags.includes(need);
}

/** The unfound relics that would come to a line here and now, in the order of the data. */
export function relicsHere(s: GameState, region: string, zone: string | null, hour: number): RelicDef[] {
  if (!zone) return [];
  return RELICS.filter((r) => r.where && r.region === region && !s.relics.includes(r.id) && r.where.zones.includes(zone) && inHours(hour, r.where.hours) && met(s, r.where.needs));
}

// ---------------------------------------------------------------- the Shelf

export type ShelfPlace = { relic: RelicDef; /** found: it stands there. rumour: something is said of it. empty: nothing is known yet. */ state: 'found' | 'rumour' | 'empty' };

/** Every place on the Shelf, for the waters the keeper has reached, in the order of the data. */
export function shelf(s: GameState): ShelfPlace[] {
  return RELICS.filter((r) => s.world.discovered.includes(r.region) || s.relics.includes(r.id))
    .map((relic) => ({ relic, state: s.relics.includes(relic.id) ? 'found' : met(s, relic.hint.after) ? 'rumour' : 'empty' }));
}

const told = (id: string) => `rumour:${id}`;
/** Is there anything to put on the Shelf's page yet: a relic, or a rumour of one to fish for? */
export function shelfOpen(s: GameState): boolean { return s.relics.length > 0 || RELICS.some((r) => r.where && s.flags.includes(told(r.id))); }

/**
 * Rumours of fished-up relics whose time has come and that have not been passed on: each is marked as told
 * and returned, to be said once. (What is said of a relic that is given, not found, is simply on the Shelf.)
 */
export function newRumours(s: GameState): RelicDef[] {
  const out: RelicDef[] = [];
  for (const p of shelf(s)) {
    const r = p.relic;
    if (!r.where || s.flags.includes(told(r.id))) continue;
    if (p.state === 'empty') continue;
    s.flags.push(told(r.id));
    // A relic that came up before anybody spoke of it needs no rumour.
    if (p.state === 'rumour') out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- Moonpearls

/** Pearls standing beside relics. They are still the keeper's (`moonpearls` counts them): set, not spent. */
export function pearlsSet(s: GameState): number { let n = 0; for (const id of s.relics) n += s.pearls[id] ?? 0; return n; }
export function pearlsFree(s: GameState): number { return Math.max(0, s.moonpearls - pearlsSet(s)); }
/** How many times over a relic gives its gift: 1, and half again for each pearl beside it. */
export function relicGift(s: GameState, id: string): number { return 1 + PEARLS.each * Math.min(PEARLS.hollows, s.pearls[id] ?? 0); }

/** Sets a free pearl beside a relic the keeper has. */
export function setPearl(s: GameState, id: string): boolean {
  if (!s.relics.includes(id) || !RELICS_BY_ID.has(id) || (s.pearls[id] ?? 0) >= PEARLS.hollows || pearlsFree(s) < 1) return false;
  s.pearls[id] = (s.pearls[id] ?? 0) + 1;
  return true;
}
/** Lifts a pearl out again: it is free to set somewhere else. */
export function liftPearl(s: GameState, id: string): boolean {
  if (!(s.pearls[id] > 0)) return false;
  if (--s.pearls[id] <= 0) delete s.pearls[id];
  return true;
}

// ---------------------------------------------------------------- words

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const GIFT: Record<StatKey, (v: number) => string> = {
  luck: (v) => `Rarer fish (${pct(v)} luck)`,
  value: (v) => `Fish sell for ${pct(v)} more`,
  biteSpeed: (v) => `Bites come ${pct(v)} sooner`,
  biteWindow: (v) => `${pct(v)} longer to strike`,
  strange: (v) => `${pct(v)} more chance of a Strange fish`,
  potSpeed: (v) => `Lantern Pots fill ${pct(v)} faster`,
  rhythmCap: (v) => `${fmtN(v)} more Rhythm ${v === 1 ? 'stack' : 'stacks'}`,
  grace: (v) => `The line bears ${pct(v)} longer before it breaks`,
  power: (v) => `${pct(v)} more reeling power`,
  control: (v) => `${pct(v)} more line control`,
  reach: (v) => `${pct(v)} longer casts`,
  size: (v) => `Bigger fish (${pct(v)})`,
  hold: (v) => `${fmtN(v)} more hold slots`,
  potSlots: (v) => `${fmtN(v)} more Lantern Pots`,
  tuneCost: (v) => `Rod tuning costs ${pct(-v)} less`,
  finds: (v) => `Things come up ${pct(v)} more often`,
};
function fmtN(v: number): string { return String(Math.round(v * 10) / 10); }
/** A relic's gift in words, as it stands with the pearls beside it. */
export function giftText(effect: Effect, times = 1): string {
  return (Object.keys(effect) as StatKey[]).map((k) => GIFT[k]?.(effect[k]! * times) ?? k).join(', ');
}

// ---------------------------------------------------------------- validation

export function validateRelics(zoneIds: (region: string) => Set<string> | null, flags: Set<string>, questIds: Set<string>, crewIds: Set<string>): string[] {
  const errs: string[] = [], ids = new Set<string>();
  const known = (who: string, need?: string) => {
    if (!need) return;
    if (need.startsWith('quest:') ? !questIds.has(need.slice(6)) : need.startsWith('crew:') ? !crewIds.has(need.slice(5)) : !flags.has(need)) errs.push(`relic ${who}: waits on something that never happens (${need})`);
  };
  if (!(PEARLS.hollows >= 1) || !(PEARLS.each > 0)) errs.push('relics: pearls need hollows and a share');
  for (const r of RELICS) {
    if (ids.has(r.id)) errs.push(`duplicate relic ${r.id}`);
    ids.add(r.id);
    if (!r.name || !r.lore || !r.hint?.text) errs.push(`relic ${r.id}: needs a name, a line of lore and a hint`);
    if (!REGIONS_BY_ID.has(r.region)) errs.push(`relic ${r.id}: unknown region ${r.region}`);
    const keys = Object.keys(r.effect ?? {});
    if (!keys.length) errs.push(`relic ${r.id}: gives nothing`);
    for (const k of keys) if (!(k in GIFT)) errs.push(`relic ${r.id}: unknown stat ${k}`);
    known(r.id, r.hint?.after);
    if (r.where) {
      const zones = zoneIds(r.region);
      if (!r.where.zones.length) errs.push(`relic ${r.id}: lies in no water`);
      for (const z of r.where.zones) if (!zones?.has(z)) errs.push(`relic ${r.id}: unknown zone ${z}`);
      if (r.where.hours && r.where.hours.some((h) => !(h >= 0 && h <= 24))) errs.push(`relic ${r.id}: bad hours`);
      known(r.id, r.where.needs);
    }
  }
  return errs;
}
