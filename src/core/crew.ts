/**
 * Deckhands: somebody aboard who fishes while the boat lies still. Like a Lantern Pot they bring up only fish
 * the journal already knows, of the water under the boat, with no Strange traits and no Rhythm, and their catch
 * goes into the boat's crew basket, which stops them when it is full. Nothing here reads a wall clock: a hand's
 * clock moves only when `tickCrew` is called from the running game, so nothing is earned while it is closed.
 */
import crewJson from '../data/crew.json';
import boatsJson from '../data/boats.json';
import { FISH, RARITIES, REGIONS_BY_ID, inHours, isNight, openZone, type FishDef, type Rarity } from './content';
import { inWeather } from './weather';
import { RARITY_WEIGHT } from './fishing';
import { Rng, hashString } from './rng';
import type { CatchItem, GameState } from './state';

export interface CrewDef {
  id: string; name: string; /** What they are aboard, for the Crew page. */ role: string;
  /** 'she' or 'he', for what the keeper is told of them. */ pronoun: string;
  /** Which of a boat's berths is theirs, counted from 0 (the cat's perch, then the side bench). A boat with fewer has no place for them, whoever else is or is not aboard. */
  berth: number;
  /** Seconds of still water between fish. */ interval: number;
  /** The best fish they can bring up. */ maxRarity: Rarity;
  /** How fast the odds fall with each step of rarity (1 = as on a rod with no luck). */ rarityFalloff: number;
  /** How much of the keeper's own luck (rod, lure, charms, Echoes) they fish with: 0 none, 1 all of it. */ luck: number;
  /** Their fish's worth as a share of the same fish caught by hand. */ value: number;
  /** How small their fish run: the size roll is raised to this power (a rod's is 1.7). */ sizePow: number;
  /** Eats one fish in this many (0 = never). */ eatsEvery: number;
  /** 'dark': works only after dark, or where the fog lies. */ when?: 'dark';
  /** Watches the water: widens the keeper's bite window by this much while they fish from the boat. */ spots?: number;
  blurb: string; desc: string;
}
export const CREW = crewJson.crew as CrewDef[];
export const CREW_BY_ID = new Map(CREW.map((c) => [c.id, c]));
const BOATS = new Map((boatsJson.boats as { id: string; crew?: number; crewHold?: number }[]).map((b) => [b.id, b]));

/** How thick the fog must lie on the boat (0..1) before it counts as dark for a hand who needs the dark. */
export const FOG_ENOUGH = 0.3;

/** Where the boat lies and how: what a hand needs to know to fish. */
export interface CrewEnv {
  region: string;
  /** The zone under the boat (null = the region's open water). */ zone: string | null;
  hour: number;
  /** 0..1: the fog on the boat. */ fog: number;
  /** She is lying still: at anchor, moored or drifting, not under way. */ still: boolean;
}

/** Berths in a boat of this kind (none in no boat). */
export function berthsOf(boatId: string | null): number { return boatId ? BOATS.get(boatId)?.crew ?? 0 : 0; }
/** Has a boat of this kind a berth of this hand's own? */
export function berthIn(boatId: string | null, def: CrewDef): boolean { return def.berth < berthsOf(boatId); }
/** Berths in the boat the keeper has now (none without a boat). */
export function berths(s: GameState): number { return berthsOf(s.boats.current); }
/** How many fish the boat's crew basket holds. */
export function basketSize(s: GameState): number { return s.boats.current ? BOATS.get(s.boats.current)?.crewHold ?? 0 : 0; }
/** The hands who have signed on, in order of seniority (the cat first). */
export function hired(s: GameState): CrewDef[] { return CREW.filter((c) => s.crew.hired.includes(c.id)); }
/** The hands aboard: those signed on whose own berth this boat has. */
export function aboard(s: GameState): CrewDef[] { const n = berths(s); return hired(s).filter((c) => c.berth < n); }
/** Signed on, and no berth of theirs in this boat: they wait at the boatyard. */
export function ashore(s: GameState): CrewDef[] { const n = berths(s); return hired(s).filter((c) => c.berth >= n); }
/** Has the boat the keeper has now a berth for this hand (signed on or not)? */
export function berthFor(s: GameState, id: string): boolean { const def = CREW_BY_ID.get(id); return !!def && berthIn(s.boats.current, def); }
export function isAboard(s: GameState, id: string): boolean { return s.crew.hired.includes(id) && berthFor(s, id); }
/** Have they signed on? Then they are aboard or at the boatyard, and no longer where they used to wait. */
export function signedOn(s: GameState, id: string): boolean { return s.crew.hired.includes(id); }

/** Signs a hand on. They go aboard at once if there is a berth. */
export function hire(s: GameState, id: string): boolean {
  if (!CREW_BY_ID.has(id) || s.crew.hired.includes(id)) return false;
  s.crew.hired.push(id);
  return true;
}

/** How much longer a bite can be struck with these hands watching the water (the keeper must be fishing from the boat). */
export function spotting(s: GameState): number { return s.crew.hired.length ? aboard(s).reduce((a, c) => a + (c.spots ?? 0), 0) : 0; }

/** Is it dark enough here for a hand who needs the dark? */
export function darkEnough(env: Pick<CrewEnv, 'hour' | 'fog'>): boolean { return isNight(env.hour) || env.fog >= FOG_ENOUGH; }
/** Would this hand fish here and now (basket room aside)? */
export function working(def: CrewDef, env: CrewEnv): boolean { return env.still && !sheltering(env) && (def.when !== 'dark' || darkEnough(env)); }
/** A storm is blowing over the boat: nobody aboard fishes in it but the keeper (they take it up again in the eye). */
export function sheltering(env: Pick<CrewEnv, 'region' | 'hour'>): boolean { return inWeather(env.region, env.hour, 'storm'); }

/** What a hand can bring up here: fish of the water under the boat that are in the journal, at this hour, up to their limit. */
export function crewTable(s: GameState, def: CrewDef, env: Pick<CrewEnv, 'region' | 'zone' | 'hour'>): FishDef[] {
  const r = REGIONS_BY_ID.get(env.region);
  const zone = env.zone ?? (r ? openZone(r)?.id ?? null : null), top = RARITIES.indexOf(def.maxRarity);
  return FISH.filter((f) => f.region === env.region && (!zone || f.zones.includes(zone)) && RARITIES.indexOf(f.rarity) <= top && f.rarity !== 'uncanny'
    && !!s.journal[f.id] && inHours(env.hour, f.hours) && inWeather(f.region, env.hour, f.weather) && (!f.requires || s.flags.includes(f.requires)));
}
/** How many kinds of fish this hand could ever bring up in this water (any hour): 0 means the journal knows nothing here for them. */
export function crewKnows(s: GameState, def: CrewDef, region: string, at: string | null): number {
  const r = REGIONS_BY_ID.get(region);
  const zone = at ?? (r ? openZone(r)?.id ?? null : null), top = RARITIES.indexOf(def.maxRarity);
  return FISH.filter((f) => f.region === region && (!zone || f.zones.includes(zone)) && RARITIES.indexOf(f.rarity) <= top && f.rarity !== 'uncanny' && !!s.journal[f.id] && (!f.requires || s.flags.includes(f.requires))).length;
}

/** What a hand did: a fish for the basket, or one that went no further than the cat. */
export interface CrewCatch { who: string; fishId: string; item: CatchItem | null; eaten: boolean }

function clockOf(s: GameState, id: string) { return (s.crew.clocks[id] ??= { t: 0, n: 0 }); }
function tallyOf(s: GameState, id: string) { return (s.crew.tally[id] ??= { fish: 0, coins: 0, eaten: 0 }); }

/** What of the keeper's the crew fish with: what fish sell for, and the luck in the rod and the gear (see gear.ts stats()). */
export interface CrewKit { value: number; luck: number }

/** The odds of each fish in a hand's table, as weights: rarity as on a rod, with as much of the keeper's luck as they borrow. */
export function crewOdds(def: CrewDef, luck: number): (f: FishDef) => number {
  const per = def.rarityFalloff * (1 + def.luck * luck);
  return (f) => RARITY_WEIGHT[f.rarity] * Math.pow(per, RARITIES.indexOf(f.rarity));
}

function bringUp(s: GameState, def: CrewDef, env: CrewEnv, kit: CrewKit): CrewCatch | null {
  const table = crewTable(s, def, env);
  if (!table.length) return null;
  const clock = clockOf(s, def.id), tally = tallyOf(s, def.id);
  const rng = new Rng(hashString(`${s.seed}:crew:${def.id}:${clock.n++}`));
  const f = rng.weighted(table, crewOdds(def, kit.luck));
  if (def.eatsEvery > 0 && clock.n % def.eatsEvery === 0) { tally.eaten++; return { who: def.id, fishId: f.id, item: null, eaten: true }; }
  const r = Math.pow(rng.next(), def.sizePow);
  const weight = Math.round((f.weight[0] + (f.weight[1] - f.weight[0]) * r) * 100) / 100;
  const item: CatchItem = { uid: s.nextUid++, fishId: f.id, weight, trait: null, value: Math.max(1, Math.round(f.baseValue * (0.75 + 0.6 * r) * def.value * kit.value)), perfect: false };
  s.crew.hold.push(item);
  tally.fish++; tally.coins += item.value;
  return { who: def.id, fishId: f.id, item, eaten: false };
}

/**
 * Runs the clocks of the hands aboard by `dt` seconds of play. `kit` is what of the keeper's they fish with
 * (`crewKit(stats(s))`). A hand's clock stands still while the boat is under way, while it is too light for
 * them, and while the basket is full. Returns what was caught.
 */
export function tickCrew(s: GameState, dt: number, env: CrewEnv, kit: CrewKit): readonly CrewCatch[] {
  if (!s.crew.hired.length) return NOTHING;
  // This runs every step of the game: it makes nothing unless a fish comes up.
  let out: CrewCatch[] | null = null;
  const size = basketSize(s), n = berths(s);
  for (const def of CREW) {
    if (def.berth >= n || !s.crew.hired.includes(def.id)) continue;
    if (!working(def, env) || s.crew.hold.length >= size) continue;
    const clock = clockOf(s, def.id);
    clock.t += dt;
    while (clock.t >= def.interval && s.crew.hold.length < size) {
      const c = bringUp(s, def, env, kit);
      // Nothing they know here: they try again in half the time, and the wait they had done is not thrown away with it.
      if (!c) { clock.t = def.interval * 0.5; break; }
      clock.t -= def.interval;
      (out ??= []).push(c);
    }
    if (s.crew.hold.length >= size) clock.t = Math.min(clock.t, def.interval);
  }
  return out ?? NOTHING;
}
const NOTHING: readonly CrewCatch[] = Object.freeze([]);

/** The keeper's numbers the crew fish with, from `stats()`. */
export function crewKit(st: { value: number; luck: number; rod: { luck: number } }): CrewKit { return { value: st.value, luck: st.luck + st.rod.luck }; }

/** 0..1: how far a hand is toward their next fish. */
export function crewProgress(s: GameState, def: CrewDef): number { return Math.min(1, (s.crew.clocks[def.id]?.t ?? 0) / def.interval); }

/** Is the crew basket full? (Asked every step and every frame: `basket` adds up what is in it.) */
export function basketFull(s: GameState): boolean { const room = basketSize(s); return room > 0 && s.crew.hold.length >= room; }
/** The crew basket: fish in it, room, and what they would fetch. */
export function basket(s: GameState): { fish: number; room: number; value: number; full: boolean } {
  const room = basketSize(s);
  return { fish: s.crew.hold.length, room, value: s.crew.hold.reduce((a, c) => a + c.value, 0), full: room > 0 && s.crew.hold.length >= room };
}

/** What happens to the crew at a Turning: they stay, the basket is sold with the rest, and their clocks start again. */
export function turnCrew(s: GameState) { for (const id of Object.keys(s.crew.clocks)) s.crew.clocks[id].t = 0; }

export function validateCrew(): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const c of CREW) {
    if (ids.has(c.id)) errs.push(`duplicate deckhand ${c.id}`);
    ids.add(c.id);
    if (!RARITIES.includes(c.maxRarity) || c.maxRarity === 'uncanny' || c.maxRarity === 'legendary') errs.push(`deckhand ${c.id}: may not bring up ${c.maxRarity} fish`);
    if (!(c.interval >= 10)) errs.push(`deckhand ${c.id}: interval too short`);
    if (!(c.value > 0 && c.value < 1)) errs.push(`deckhand ${c.id}: a hand's fish must be worth less than the keeper's`);
    if (!(c.rarityFalloff > 0 && c.rarityFalloff <= 1)) errs.push(`deckhand ${c.id}: rarer fish may not be likelier than on a rod`);
    if (!(c.luck >= 0 && c.luck <= 1)) errs.push(`deckhand ${c.id}: borrows between none and all of the keeper's luck`);
    if (!c.blurb || !c.desc || !c.role || !c.pronoun) errs.push(`deckhand ${c.id}: needs a role, a pronoun, a blurb and a description`);
    if (!Number.isInteger(c.berth) || c.berth < 0) errs.push(`deckhand ${c.id}: needs a berth, counted from 0`);
    else if (CREW.some((o) => o !== c && o.berth === c.berth)) errs.push(`deckhand ${c.id}: shares berth ${c.berth} with somebody`);
    else if (![...BOATS.values()].some((b) => (b.crew ?? 0) > c.berth)) errs.push(`deckhand ${c.id}: no boat has berth ${c.berth}`);
  }
  for (const [id, b] of BOATS) {
    if (!((b.crew ?? 0) >= 0 && (b.crewHold ?? 0) >= 0)) errs.push(`boat ${id}: bad crew numbers`);
    if ((b.crew ?? 0) > 0 && !(b.crewHold! > 0)) errs.push(`boat ${id}: berths but no crew basket`);
  }
  return errs;
}
