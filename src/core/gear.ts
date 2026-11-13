/**
 * Gear and what it adds up to. `stats()` folds the rod and its tuning, the lure, wearables and their sets,
 * relics and Echo upgrades into the numbers the game plays with; the shop functions spend coins.
 * Pure functions over GameState: the game, the screens and the economy simulator all go through here.
 */
import gearJson from '../data/gear.json';
import echoesJson from '../data/echoes.json';
import relicsJson from '../data/relics.json';
import boatsJson from '../data/boats.json';
import { BAITS_BY_ID, FISH, RODS_BY_ID, bait, rod, type RodDef } from './content';
import type { FishingContext } from './fishing';
import type { GameState } from './state';

export type StatKey =
  | 'power' | 'control' | 'reach' | 'grace' | 'luck' | 'biteSpeed' | 'biteWindow' | 'strange' | 'value' | 'size'
  | 'hold' | 'rhythmCap' | 'potSpeed' | 'potSlots' | 'tuneCost';
export type Effect = Partial<Record<StatKey, number>>;
/** A condition on an effect: the hour of the day, or whether the player is in a boat. */
export type When = 'night' | 'day' | 'afloat' | 'ashore';
export type Slot = 'hat' | 'coat' | 'boots' | 'charm';
export const SLOTS: Slot[] = ['hat', 'coat', 'boots', 'charm'];

export interface LureDef { id: string; name: string; price?: number; when?: When; effect: Effect; blurb: string; desc: string }
export interface WearableDef { id: string; name: string; slot: Slot; set?: string; price?: number; effect: Effect; blurb: string; desc: string }
export interface SetDef { id: string; name: string; bonuses: { pieces: number; effect: Effect; blurb: string }[] }
export interface CollectionDef { id: string; name: string; region: string; skipRarity?: string; rewards: { wearables?: string[]; lures?: string[]; relics?: string[] }; text: string }
export interface EchoDef { id: string; name: string; blurb: string; desc: string; cost: number[]; effect?: Effect; startCoins?: number[] }
export interface PotUpgradeDef { name: string; blurb: string; max: number; base: number; growth: number; per: number }
export type PotUpgrade = 'speed' | 'size' | 'quality';

export const TUNING = gearJson.tuning;
export const CREEL = gearJson.creel;
export const LURES = gearJson.lures as LureDef[];
export const WEARABLES = gearJson.wearables as WearableDef[];
export const SETS = gearJson.sets as SetDef[];
export const COLLECTIONS = gearJson.collections as CollectionDef[];
export const POTS = gearJson.pots as { interval: number; capacity: number; value: number; rarityFalloff: number; maxOwned: number; prices: number[]; upgrades: Record<PotUpgrade, PotUpgradeDef> };
export const ECHO_UPGRADES = echoesJson.upgrades as EchoDef[];
export const LURES_BY_ID = new Map(LURES.map((l) => [l.id, l]));
export const WEARABLES_BY_ID = new Map(WEARABLES.map((w) => [w.id, w]));
export const ECHOES_BY_ID = new Map(ECHO_UPGRADES.map((u) => [u.id, u]));
const RELIC_EFFECTS = new Map((relicsJson.relics as { id: string; effect: Effect }[]).map((r) => [r.id, r.effect]));
const BOAT_HOLD = new Map((boatsJson.boats as { id: string; hold: number }[]).map((b) => [b.id, b.hold]));

export const RHYTHM_CAP = 10;

export interface Env { hour?: number; afloat?: boolean }
export function isNight(hour: number): boolean { return hour >= 18.5 || hour < 5.5; }
function applies(when: When | undefined, env: Env): boolean {
  switch (when) {
    case undefined: return true;
    case 'night': return env.hour !== undefined && isNight(env.hour);
    case 'day': return env.hour !== undefined && !isNight(env.hour);
    case 'afloat': return !!env.afloat;
    case 'ashore': return !env.afloat;
  }
}

export interface Stats {
  /** The equipped rod with its tuning and every bonus folded in. */
  rod: RodDef;
  /** Multiplies the bait's bite speed. */ biteSpeed: number;
  /** Rarity luck on top of the rod's own. */ luck: number;
  /** Multiplies every fish's bite window. */ biteWindow: number;
  /** Chance that a landed fish is Strange. */ strange: number;
  /** Multiplies what fish sell for. */ value: number;
  /** 0..0.6: how far the size roll is pushed toward heavy. */ size: number;
  /** Slots in the hold. */ hold: number;
  /** How many catches Rhythm counts. */ rhythmCap: number;
  /** Multiplies how fast Lantern Pots fill. */ potSpeed: number;
  /** How many fish one pot holds. */ potCapacity: number;
  /** Multiplies the value of a fish from a pot (before `value`). */ potValue: number;
  /** How many pots can be in the water. */ potCount: number;
  /** Multiplies rod tuning prices. */ tuneCost: number;
}

function add(acc: Effect, e: Effect | undefined, n = 1) {
  if (e) for (const k of Object.keys(e) as StatKey[]) acc[k] = (acc[k] ?? 0) + e[k]! * n;
}

/** Every bonus in force, summed by stat. */
export function bonuses(s: GameState, env: Env = {}): Effect {
  const acc: Effect = {};
  for (const id of s.relics) add(acc, RELIC_EFFECTS.get(id));
  const lure = s.gear.lure ? LURES_BY_ID.get(s.gear.lure) : undefined;
  if (lure && applies(lure.when, env)) add(acc, lure.effect);
  for (const set of SETS) {
    const n = setPieces(s, set.id);
    for (const b of set.bonuses) if (n >= b.pieces) add(acc, b.effect);
  }
  for (const slot of SLOTS) { const id = s.gear.worn[slot]; if (id) add(acc, WEARABLES_BY_ID.get(id)?.effect); }
  for (const u of ECHO_UPGRADES) { const rank = s.echoUpgrades[u.id] ?? 0; if (rank) add(acc, u.effect, rank); }
  return acc;
}

/** How many pieces of a set are being worn. */
export function setPieces(s: GameState, setId: string): number {
  let n = 0;
  for (const slot of SLOTS) { const id = s.gear.worn[slot]; if (id && WEARABLES_BY_ID.get(id)?.set === setId) n++; }
  return n;
}

/** The creel as it is now: its slots, and how much better kept fish sell. */
export function creel(s: GameState): { slots: number; value: number; name: string } {
  const lvl = Math.min(s.gear.creel, CREEL.levels.length);
  return lvl > 0 ? CREEL.levels[lvl - 1] : { slots: CREEL.base, value: 0, name: "Aunt's Basket" };
}

export function stats(s: GameState, env: Env = {}): Stats {
  const b = bonuses(s, env);
  const base = rod(s.gear.rod), lvl = s.gear.rodLevels[base.id] ?? 0, t = TUNING.perLevel;
  const boat = s.boats.current ? BOAT_HOLD.get(s.boats.current) ?? 0 : 0;
  const up = s.pots.levels, kept = creel(s);
  return {
    rod: {
      ...base,
      power: base.power * (1 + t.power * lvl + (b.power ?? 0)),
      control: base.control * (1 + t.control * lvl + (b.control ?? 0)),
      reach: base.reach * (1 + t.reach * lvl + (b.reach ?? 0)),
      grace: base.grace * (1 + t.grace * lvl + (b.grace ?? 0)),
      luck: base.luck + t.luck * lvl,
    },
    biteSpeed: 1 + (b.biteSpeed ?? 0),
    luck: b.luck ?? 0,
    biteWindow: 1 + (b.biteWindow ?? 0),
    strange: 0.03 + (b.strange ?? 0),
    value: 1 + (b.value ?? 0) + kept.value,
    size: Math.min(0.6, b.size ?? 0),
    hold: kept.slots + (b.hold ?? 0) + boat,
    rhythmCap: RHYTHM_CAP + (b.rhythmCap ?? 0),
    potSpeed: 1 + (b.potSpeed ?? 0) + POTS.upgrades.speed.per * up.speed,
    potCapacity: POTS.capacity + POTS.upgrades.size.per * up.size,
    potValue: POTS.value * (1 + POTS.upgrades.quality.per * up.quality),
    potCount: s.pots.owned + (b.potSlots ?? 0),
    tuneCost: Math.max(0.2, 1 + (b.tuneCost ?? 0)),
  };
}

/** What a fishing session plays with, for the player's gear here and now. */
export function fishingContext(s: GameState, env: Env & { hour: number }, spot: FishingContext['spot'], st = stats(s, env)): FishingContext {
  const b = bait(s.gear.bait);
  return {
    rod: st.rod, bait: st.biteSpeed !== 1 ? { ...b, biteSpeed: b.biteSpeed * st.biteSpeed } : b, hour: env.hour,
    luck: st.luck, biteWindowMult: st.biteWindow, strangeChance: st.strange, size: st.size,
    flags: new Set(s.flags), region: s.world.region, spot,
  };
}

// ---------------------------------------------------------------- spending

function pay(s: GameState, price: number): boolean {
  if (!(price >= 0) || s.coins < price) return false;
  s.coins -= price;
  return true;
}
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function buyRod(s: GameState, id: string): boolean {
  const r = RODS_BY_ID.get(id);
  if (!r || s.gear.rods.includes(id) || !pay(s, r.price)) return false;
  s.gear.rods.push(id); s.gear.rodLevels[id] = 0; s.gear.rod = id;
  return true;
}

export function buyBait(s: GameState, id: string, n: number): boolean {
  const b = BAITS_BY_ID.get(id);
  if (!b || n <= 0 || !pay(s, b.price * n)) return false;
  s.gear.baits[id] = (s.gear.baits[id] ?? 0) + n;
  return true;
}

/** Uses up one of the bait on the hook (when a fish takes it). Returns the bait's id if that was the last of it. */
export function spendBait(s: GameState): string | null {
  const id = s.gear.bait, have = s.gear.baits[id] ?? 0;
  if (!isFinite(have)) return null;
  s.gear.baits[id] = Math.max(0, have - 1);
  if (s.gear.baits[id] > 0) return null;
  delete s.gear.baits[id];
  s.gear.bait = 'breadcrumb';
  return id;
}

/** The price of the next tuning level for a rod, or null when it is as good as it gets. */
export function tuneCost(s: GameState, rodId: string, st = stats(s)): number | null {
  const r = RODS_BY_ID.get(rodId), lvl = s.gear.rodLevels[rodId] ?? 0;
  if (!r || !s.gear.rods.includes(rodId) || lvl >= TUNING.maxLevel) return null;
  return round5(Math.max(TUNING.costFloor, r.price * TUNING.costShare) * Math.pow(TUNING.costGrowth, lvl) * st.tuneCost);
}
export function tuneRod(s: GameState, rodId: string): boolean {
  const c = tuneCost(s, rodId);
  if (c === null || !pay(s, c)) return false;
  s.gear.rodLevels[rodId] = (s.gear.rodLevels[rodId] ?? 0) + 1;
  return true;
}

export function creelNext(s: GameState): { slots: number; value: number; price: number; name: string } | null { return CREEL.levels[s.gear.creel] ?? null; }
export function buyCreel(s: GameState): boolean {
  const n = creelNext(s);
  if (!n || !pay(s, n.price)) return false;
  s.gear.creel++;
  return true;
}

export function buyLure(s: GameState, id: string): boolean {
  const l = LURES_BY_ID.get(id);
  if (!l || l.price === undefined || s.gear.lures.includes(id) || !pay(s, l.price)) return false;
  s.gear.lures.push(id); s.gear.lure ??= id;
  return true;
}
export function equipLure(s: GameState, id: string | null): boolean {
  if (id !== null && !s.gear.lures.includes(id)) return false;
  s.gear.lure = id;
  return true;
}

export function buyWearable(s: GameState, id: string): boolean {
  const w = WEARABLES_BY_ID.get(id);
  if (!w || w.price === undefined || s.gear.wearables.includes(id) || !pay(s, w.price)) return false;
  s.gear.wearables.push(id);
  if (!s.gear.worn[w.slot]) s.gear.worn[w.slot] = id;
  return true;
}
/** Puts a wearable on, or takes it off if it is already worn. */
export function wear(s: GameState, id: string): boolean {
  const w = WEARABLES_BY_ID.get(id);
  if (!w || !s.gear.wearables.includes(id)) return false;
  s.gear.worn[w.slot] = s.gear.worn[w.slot] === id ? null : id;
  return true;
}
/** Adds a found lure or wearable; a wearable goes straight on if its slot is bare. */
export function grantLure(s: GameState, id: string) { if (LURES_BY_ID.has(id) && !s.gear.lures.includes(id)) { s.gear.lures.push(id); s.gear.lure ??= id; } }
export function grantWearable(s: GameState, id: string) {
  const w = WEARABLES_BY_ID.get(id);
  if (!w || s.gear.wearables.includes(id)) return;
  s.gear.wearables.push(id);
  if (!s.gear.worn[w.slot]) s.gear.worn[w.slot] = id;
}

/** The price of the next Lantern Pot, or null when no more can be bought. */
export function potPrice(s: GameState): number | null {
  if (s.pots.owned < 1 || s.pots.owned >= POTS.maxOwned) return null; // the first pot is a gift, not a purchase
  return POTS.prices[s.pots.owned - 1] ?? null;
}
export function buyPot(s: GameState): boolean {
  const p = potPrice(s);
  if (p === null || !pay(s, p)) return false;
  s.pots.owned++;
  return true;
}
export function potUpgradeCost(s: GameState, k: PotUpgrade): number | null {
  const u = POTS.upgrades[k], lvl = s.pots.levels[k];
  return lvl >= u.max ? null : round5(u.base * Math.pow(u.growth, lvl));
}
export function upgradePots(s: GameState, k: PotUpgrade): boolean {
  const c = potUpgradeCost(s, k);
  if (c === null || s.pots.owned < 1 || !pay(s, c)) return false;
  s.pots.levels[k]++;
  return true;
}

// ---------------------------------------------------------------- journal pages

/** Is every fish of the collection's region in the journal? */
export function collectionProgress(s: GameState, c: CollectionDef): { found: number; total: number } {
  const want = FISH.filter((f) => f.region === c.region && f.rarity !== c.skipRarity);
  return { found: want.filter((f) => s.journal[f.id]).length, total: want.length };
}
/** Collections completed just now: marks them and hands over what they give. */
export function claimCollections(s: GameState): CollectionDef[] {
  const out: CollectionDef[] = [];
  for (const c of COLLECTIONS) {
    const flag = `page:${c.id}`;
    if (s.flags.includes(flag)) continue;
    const p = collectionProgress(s, c);
    if (p.found < p.total) continue;
    s.flags.push(flag);
    for (const id of c.rewards.wearables ?? []) grantWearable(s, id);
    for (const id of c.rewards.lures ?? []) grantLure(s, id);
    for (const id of c.rewards.relics ?? []) if (!s.relics.includes(id)) s.relics.push(id);
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- validation

const STAT_KEYS: StatKey[] = ['power', 'control', 'reach', 'grace', 'luck', 'biteSpeed', 'biteWindow', 'strange', 'value', 'size', 'hold', 'rhythmCap', 'potSpeed', 'potSlots', 'tuneCost'];
export function validateGear(): string[] {
  const errs: string[] = [];
  const effect = (who: string, e: Effect | undefined) => { for (const k of Object.keys(e ?? {})) if (!STAT_KEYS.includes(k as StatKey)) errs.push(`${who}: unknown stat ${k}`); };
  const ids = new Set<string>();
  const unique = (id: string) => { if (ids.has(id) || RODS_BY_ID.has(id) || BAITS_BY_ID.has(id)) errs.push(`duplicate gear id ${id}`); ids.add(id); };
  for (const l of LURES) { unique(l.id); effect(l.id, l.effect); if (!l.blurb || !l.desc) errs.push(`${l.id}: needs a blurb and a description`); }
  const sets = new Set(SETS.map((x) => x.id));
  for (const w of WEARABLES) {
    unique(w.id); effect(w.id, w.effect);
    if (!SLOTS.includes(w.slot)) errs.push(`${w.id}: bad slot ${w.slot}`);
    if (w.set && !sets.has(w.set)) errs.push(`${w.id}: unknown set ${w.set}`);
  }
  for (const st of SETS) {
    const pieces = WEARABLES.filter((w) => w.set === st.id);
    for (const b of st.bonuses) { effect(st.id, b.effect); if (b.pieces > pieces.length) errs.push(`set ${st.id}: a ${b.pieces}-piece bonus but only ${pieces.length} pieces`); }
    if (new Set(pieces.map((p) => p.slot)).size !== pieces.length) errs.push(`set ${st.id}: two pieces share a slot`);
  }
  for (const c of COLLECTIONS) {
    for (const id of c.rewards.wearables ?? []) if (!WEARABLES_BY_ID.has(id)) errs.push(`${c.id}: unknown wearable ${id}`);
    for (const id of c.rewards.lures ?? []) if (!LURES_BY_ID.has(id)) errs.push(`${c.id}: unknown lure ${id}`);
    if (!FISH.some((f) => f.region === c.region)) errs.push(`${c.id}: no fish in region ${c.region}`);
  }
  for (const u of ECHO_UPGRADES) {
    effect(u.id, u.effect);
    if (!u.cost.length || u.cost.some((c, i) => c <= 0 || (i > 0 && c < u.cost[i - 1]))) errs.push(`echo ${u.id}: costs must rise`);
    if (u.startCoins && u.startCoins.length !== u.cost.length) errs.push(`echo ${u.id}: one starting purse per rank`);
    if (!u.effect && !u.startCoins) errs.push(`echo ${u.id}: does nothing`);
  }
  if (CREEL.levels.some((l, i) => l.slots <= (i ? CREEL.levels[i - 1].slots : CREEL.base))) errs.push('creel: slots must grow');
  if (POTS.prices.length !== POTS.maxOwned - 1) errs.push('pots: one price for each pot after the first');
  return errs;
}
