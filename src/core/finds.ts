/**
 * Things fished up that are not fish: crates, sea chests and relics. Whether a cast comes down over one (the
 * dice are counted in the save), what it is, and what is in it once it is aboard. The haul itself is in
 * core/fishing.ts; the numbers are src/data/finds.json.
 */
import findsJson from '../data/finds.json';
import { BAITS_BY_ID, REGIONS, REGIONS_BY_ID } from './content';
import { PERFECT_HOOK_VALUE, RHYTHM, earn, fmt } from './economy';
import { typicalFish, type FindKind, type FindOffer, type FishingContext, type SpotInfo } from './fishing';
import { LURES_BY_ID, WEARABLES_BY_ID, grantLure, grantWearable } from './gear';
import { RELICS_BY_ID, relicsHere } from './relics';
import { Rng } from './rng';
import type { GameState } from './state';

interface BaitRoll { id: string; n: [number, number]; w: number }
export interface BoxDef {
  name: string; heft: number;
  /** The least and most coins in it, whoever hauls it. */ coins: [number, number];
  /** And at least this many times what a fish of that cast would have fetched this keeper: so it is never the worse thing to bring up. */ times: [number, number];
  bait: BaitRoll[]; lines: string[];
}
export interface ChestBoxDef extends BoxDef {
  /** The only waters a chest comes up in. */ zones: string[]; pearls: number;
  /** Gear sold nowhere: the first chest of a region holds a piece, later ones may (`gearChance`) until all is found. */
  gear?: { lures?: string[]; wearables?: string[] }; gearChance: number;
}
export const FINDS = findsJson as unknown as {
  /** Fish landed, over all time, before anything else comes up. */ after: number;
  /** Waits after a find in which nothing can come up. */ gap: number;
  /** The chance after the gap, what each dry wait adds to it, and where it stops. */ base: number; ramp: number; cap: number;
  /** In chest water, how many finds in one are a chest. */ chestShare: number;
  /** A relic in its water at its hour: the chance each cast, what each miss adds, and its weight beside a crate's. */
  relic: { chance: number; pity: number; heft: number; name: string };
  regions: Record<string, { crate: BoxDef; chest: ChestBoxDef }>;
};

/** Where a float has landed, as the dice need it. */
export interface Water { region: string; zone: string | null; hour: number }

/** The chance that the next wait brings up a crate or a chest. `mult` is gear (stats().finds). */
export function findChance(s: GameState, mult = 1): number {
  if (s.lifetime.catches < FINDS.after) return 0;
  const dry = s.finds.dry;
  return dry < FINDS.gap ? 0 : Math.min(FINDS.cap, (FINDS.base + FINDS.ramp * (dry - FINDS.gap)) * mult);
}

/**
 * The dice for a cast, by the save's seed and its count of casts (`salt` keeps what is on the bottom apart from
 * what is in it). `ahead` is 1 for the cast that is in the water and has not been counted yet.
 */
function dice(s: GameState, salt: number, ahead = 0): Rng {
  return new Rng((Math.imul(s.seed ^ 0x51ed27, 0x9e3779b1) + Math.imul(s.finds.casts + ahead, 0x85ebca6b) + Math.imul(salt + 1, 0xc2b2ae35)) >>> 0);
}

/** Are the dice thrown at all yet, in this water? Not until a dozen fish have been landed. */
function live(s: GameState, region: string): boolean { return !!FINDS.regions[region] && s.lifetime.catches >= FINDS.after; }

/**
 * A float has landed: is there something on the bottom here that is not a fish? This only looks. The dice go by
 * the save's seed and its count of casts, and the count does not move until the cast is used (`countCast`), so
 * casting again, here or anywhere, or loading the game again, meets the same throw. Returns what the line will
 * meet at the end of the wait, or null for a fish as usual. `worth` is what a fish from this cast would fetch the
 * keeper (see withFinds): a crate or a chest carries it, to be opened by.
 */
export function peekFind(s: GameState, w: Water, mult = 1, worth = 0): FindOffer | null {
  const def = FINDS.regions[w.region];
  if (!def || !live(s, w.region)) return null;
  // Three throws, always in this order and always all three, so that no water moves another's dice.
  const rng = dice(s, 0, 1), forRelic = rng.next(), forBox = rng.next(), forChest = rng.next();
  // A relic of this water, at its hour: a chance of its own, growing with every cast here that is not it.
  const relic = relicsHere(s, w.region, w.zone, w.hour)[0];
  if (relic && forRelic < FINDS.relic.chance + FINDS.relic.pity * (s.finds.near[relic.id] ?? 0)) return { id: relic.id, kind: 'relic', heft: def.crate.heft * FINDS.relic.heft };
  if (!(forBox < findChance(s, mult))) return null;
  return offerOf(!!w.zone && def.chest.zones.includes(w.zone) && forChest < FINDS.chestShare ? 'chest' : 'crate', w.region, worth);
}

/**
 * The cast is used: a fish was hooked on it, or what lay there has come up, or has gone with a broken line.
 * `offer` is what `peekFind` said of it. Only now does the count of casts move on, and with it the dice.
 */
export function countCast(s: GameState, w: Water, offer: FindOffer | null): void {
  if (!live(s, w.region)) return;
  s.finds.casts++;
  if (offer?.kind === 'relic') return; // taken (takeFind forgets the misses) or still down there
  const relic = relicsHere(s, w.region, w.zone, w.hour)[0];
  if (relic) s.finds.near[relic.id] = (s.finds.near[relic.id] ?? 0) + 1;
  if (offer) s.finds.dry = 0; else s.finds.dry++;
}

/** Looks and counts in one go: a cast that is used whatever it meets (the tests' and the simulator's shorthand). */
export function rollFind(s: GameState, w: Water, mult = 1, worth = 0): FindOffer | null {
  const offer = peekFind(s, w, mult, worth);
  countCast(s, w, offer);
  return offer;
}

/** A crate or a chest of a region, as the line meets it. */
export function offerOf(kind: 'crate' | 'chest', region: string, worth = 0): FindOffer {
  return { id: `${kind}:${region}`, kind, heft: FINDS.regions[region][kind].heft, worth };
}
/** A relic as the line meets it (for a relic the game knows lies here). */
export function relicOffer(id: string): FindOffer | null {
  const r = RELICS_BY_ID.get(id), def = r && FINDS.regions[r.region];
  return r && def ? { id, kind: 'relic', heft: def.crate.heft * FINDS.relic.heft } : null;
}
/** What a thing on the line is called before it is opened. */
export function findName(offer: FindOffer): string {
  if (offer.kind === 'relic') return FINDS.relic.name;
  return FINDS.regions[offer.id.slice(offer.id.indexOf(':') + 1)]?.[offer.kind].name ?? 'Something heavy';
}

/** What was in it. */
export interface Loot {
  kind: FindKind; /** What came up, and a line about it. */ name: string; text: string;
  coins: number; baits: Record<string, number>; pearls: number; lures: string[]; wearables: string[]; relic: string | null;
}

/**
 * The thing is aboard: opens it, puts what is in it into the save, and says what that was. Null if the save
 * could not have hooked it (a relic already on the Shelf, a water with no table).
 */
export function takeFind(s: GameState, offer: FindOffer): Loot | null {
  const loot: Loot = { kind: offer.kind, name: '', text: '', coins: 0, baits: {}, pearls: 0, lures: [], wearables: [], relic: null };
  if (offer.kind === 'relic') {
    const r = RELICS_BY_ID.get(offer.id);
    if (!r || s.relics.includes(r.id)) return null;
    s.relics.push(r.id);
    delete s.finds.near[r.id];
    loot.name = r.name; loot.text = r.lore; loot.relic = r.id;
    return loot;
  }
  const region = offer.id.slice(offer.id.indexOf(':') + 1), def = FINDS.regions[region];
  if (!def) return null;
  const chest = offer.kind === 'chest', box = chest ? def.chest : def.crate, rng = dice(s, chest ? 2 : 1);
  loot.name = box.name; loot.text = rng.pick(box.lines);
  loot.coins = Math.max(rng.int(box.coins[0], box.coins[1]), Math.round((offer.worth ?? 0) * rng.range(box.times[0], box.times[1])));
  earn(s, loot.coins);
  if (box.bait.length) {
    const b = rng.weighted(box.bait, (x) => x.w), n = rng.int(b.n[0], b.n[1]);
    s.gear.baits[b.id] = (s.gear.baits[b.id] ?? 0) + n;
    loot.baits[b.id] = n;
  }
  if (chest) {
    const c = def.chest;
    loot.pearls = c.pearls; s.moonpearls += c.pearls;
    const lures = c.gear?.lures ?? [], wear = c.gear?.wearables ?? [];
    const missing = [...lures.filter((id) => !s.gear.lures.includes(id)), ...wear.filter((id) => !s.gear.wearables.includes(id))];
    // The first chest of a water always holds a piece; after that it is a matter of luck until the list is done.
    const none = missing.length === lures.length + wear.length;
    if (missing.length && (none || rng.chance(c.gearChance))) {
      const id = missing[0];
      if (lures.includes(id)) { grantLure(s, id); loot.lures.push(id); } else { grantWearable(s, id); loot.wearables.push(id); }
    }
    s.finds.chests++;
  } else s.finds.crates++;
  return loot;
}

/** What was in it, as a list for the card. */
export function lootLines(loot: Loot): string[] {
  const out: string[] = [];
  if (loot.coins) out.push(`◉ ${fmt(loot.coins)}`);
  for (const [id, n] of Object.entries(loot.baits)) out.push(`${n} ${BAITS_BY_ID.get(id)?.name ?? id}`);
  if (loot.pearls) out.push(`${loot.pearls} Moonpearl${loot.pearls > 1 ? 's' : ''}`);
  for (const id of loot.lures) out.push(LURES_BY_ID.get(id)?.name ?? id);
  for (const id of loot.wearables) out.push(WEARABLES_BY_ID.get(id)?.name ?? id);
  return out;
}

// ---------------------------------------------------------------- validation

export function validateFinds(): string[] {
  const errs: string[] = [];
  const f = FINDS;
  if (!(f.after >= 0) || !(f.gap >= 0) || !(f.base > 0 && f.base < 1) || !(f.ramp >= 0) || !(f.cap >= f.base && f.cap < 1)) errs.push('finds: the chances make no sense');
  if (!(f.chestShare >= 0 && f.chestShare <= 1)) errs.push('finds: chestShare must be a share');
  if (!(f.relic.chance > 0) || !(f.relic.pity > 0) || !(f.relic.heft > 0)) errs.push('finds: a relic must be able to come up, and sooner each cast');
  for (const r of REGIONS) if (!f.regions[r.id]) errs.push(`finds: no table for ${r.id}`);
  for (const [rid, def] of Object.entries(f.regions)) {
    const region = REGIONS_BY_ID.get(rid);
    if (!region) { errs.push(`finds: unknown region ${rid}`); continue; }
    const zones = new Set(region.zones.map((z) => z.id));
    for (const [what, box] of [['crate', def.crate], ['chest', def.chest]] as const) {
      const who = `finds: ${rid} ${what}`;
      if (!box.name || !box.lines?.length) errs.push(`${who}: needs a name and a line`);
      if (!(box.heft > 0)) errs.push(`${who}: needs a weight`);
      if (!(box.coins[0] >= 0 && box.coins[1] >= box.coins[0])) errs.push(`${who}: bad coins`);
      if (!(box.times?.[0] >= 1 && box.times[1] >= box.times[0])) errs.push(`${who}: must be worth at least the fish it came up instead of`);
      for (const b of box.bait) {
        if (!BAITS_BY_ID.has(b.id)) errs.push(`${who}: unknown bait ${b.id}`);
        if (!(b.n[0] >= 1 && b.n[1] >= b.n[0]) || !(b.w > 0)) errs.push(`${who}: bad bait roll ${b.id}`);
      }
    }
    if (!def.chest.zones.length) errs.push(`finds: ${rid} has no chest water`);
    for (const z of def.chest.zones) if (!zones.has(z)) errs.push(`finds: ${rid} chest water ${z} is not a zone`);
    if (!(def.chest.pearls >= 0)) errs.push(`finds: ${rid} chest pearls`);
    for (const id of def.chest.gear?.lures ?? []) { const l = LURES_BY_ID.get(id); if (!l) errs.push(`finds: ${rid} chest holds unknown lure ${id}`); else if (l.price !== undefined) errs.push(`finds: ${id} is sold on a shelf as well`); }
    for (const id of def.chest.gear?.wearables ?? []) { const w = WEARABLES_BY_ID.get(id); if (!w) errs.push(`finds: ${rid} chest holds unknown wearable ${id}`); else if (w.price !== undefined) errs.push(`finds: ${id} is sold on a shelf as well`); }
  }
  return errs;
}

// ---------------------------------------------------------------- on the line

/**
 * What a fish from a cast to this spot would fetch this keeper, reckoned for a good hand (a clean cast, a perfect
 * hook) with the Rhythm the catch would have had. A crate is never opened for less, so a cast that met one is
 * never a worse cast than one that met a fish.
 */
export function fishWorth(ctx: FishingContext, spot: SpotInfo, s: GameState, st: { value: number; rhythmCap: number }): number {
  return typicalFish(ctx, spot, true) * st.value * PERFECT_HOOK_VALUE * (1 + Math.min(st.rhythmCap, s.rhythm + 1) * RHYTHM.perStack);
}

/**
 * Lets a fishing context meet what lies on the bottom. The place is looked at as each float lands, in the water
 * and at the hour the context has then, and the save's dice move on only when the cast is used: a fish hooked,
 * the thing brought up, or a crate or chest gone with a broken line. A cast reeled straight back in, a bite
 * missed, a find let go of or left in a game that was shut mid-haul: none of these is a throw, and the same
 * thing lies there for the next cast. A relic is not lost with the line either. `st` is the keeper's gear
 * (stats()): how often things come up, and what their fish sell for, by which a crate's coins are reckoned.
 * `forced` lets a bot say what the next cast meets (undefined: ask the dice); such a cast is never counted.
 */
export function withFinds(
  ctx: FishingContext, s: GameState,
  st: { finds: number; value: number; rhythmCap: number } = { finds: 1, value: 1, rhythmCap: 0 },
  forced?: () => FindOffer | null | undefined,
): FishingContext {
  let cast: { w: Water; offer: FindOffer | null } | null = null;
  ctx.find = (spot) => {
    cast = null;
    const f = forced?.();
    if (f !== undefined) return f;
    const w = { region: ctx.region, zone: spot.zoneId, hour: ctx.hour };
    cast = { w, offer: peekFind(s, w, st.finds, fishWorth(ctx, spot, s, st)) };
    return cast.offer;
  };
  ctx.spent = (how) => {
    if (!cast || (how === 'snapped' && cast.offer?.kind === 'relic')) return;
    countCast(s, cast.w, cast.offer);
    cast = null;
  };
  return ctx;
}
