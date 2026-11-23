/**
 * The economy simulator's player: a headless keeper who plays the real rules (the fishing state machine, the
 * hold, quests, the shop, pots, the Bell) with human-ish hands and a sensible head, and writes down when
 * things happen. Nothing here invents an economy of its own: every coin comes through src/core.
 *
 * What is modelled, not played: walking, sailing and talking are time costs from the places table. The keeper
 * is in one region at a time; crossing to another is a time cost too, and she goes where a job sends her or,
 * with no job to follow, where the fishing pays best.
 */
import { Rng, hashString } from '../../src/core/rng';
import { FishingSession, NO_INPUT, type FishingInput } from '../../src/core/fishing';
import { DAY_LENGTH_S, newGame, type GameState } from '../../src/core/state';
import { addCatch, breakRhythm, earn, sellAll, RHYTHM } from '../../src/core/economy';
import {
  BAITS, FISH, RARITIES, REGIONS, REGIONS_BY_ID, RODS, bait as baitDef, fish as fishDef, inHours, onShelf, regionAt, regionOfNpc, regionOfPlace, roadToward, zoneAt, type ChestDef, type FishDef,
} from '../../src/core/content';
import { inWeather, weatherAt } from '../../src/core/weather';
import {
  LURES, WEARABLES, boatOnOffer, buyBait, buyBoat, buyCreel, buyLure, buyPot, buyRod, buyWearable, claimCollections, creelNext, fishingContext,
  grantLure, grantWearable, hasFogLamp, isNight, potPrice, potUpgradeCost, spendBait, stats, tuneCost, tuneRod, upgradePots, type PotUpgrade, type Stats,
} from '../../src/core/gear';
import {
  BOATS, BOATS_BY_ID, NPCS, QUESTS, accept, acceptBoard, arriveIn, handsInTo, npcOffer, objectiveProgress, objectiveTarget, onQuestEvent, questStatus, tickBoard, turnIn,
  type ObjectiveDef, type QuestDef,
} from '../../src/core/quests';
import { haulPot, placePot, potsInHand, takeUpPot, tickPots } from '../../src/core/pots';
import { CREW_BY_ID, crewKit, tickCrew } from '../../src/core/crew';
import { BELL_FLAG, buyEcho, echoCost, echoesFor, ringBell } from '../../src/core/bell';
import { ECHO_UPGRADES } from '../../src/core/gear';
import { FINDS, findName, takeFind, withFinds } from '../../src/core/finds';
import { RELICS, RELICS_BY_ID, liftPearl, met, pearlsFree, setPearl, type RelicDef } from '../../src/core/relics';
import { humanFightPolicy, humanHaulPolicy } from '../../tests/helpers';

/** Somewhere to fish. `trip` is the seconds it takes to get there from where the region's catch is sold (and back again). */
export interface Place { id: string; name: string; region: string; needsBoat: boolean; afloat: boolean; trip: number; zone: (castDistance: number) => string; chart?: string }
const HB = 'hearthbay', FEN = 'mossglass-fen', REACH = 'saltbone-reach';
export const PLACES: Place[] = [
  { id: 'dock', name: 'the dock', region: HB, needsBoat: false, afloat: false, trip: 8, zone: (d) => (d > 16 ? 'hb-bay' : 'hb-dock') },
  { id: 'open', name: 'open water', region: HB, needsBoat: true, afloat: true, trip: 24, zone: () => 'hb-open' },
  { id: 'teeth', name: 'the Teeth', region: HB, needsBoat: true, afloat: true, trip: 58, zone: () => 'hb-teeth', chart: 'the-teeth' },
  // Mossglass Fen, from the packet box on Sedge Landing: 7 m/s under sail, and the reed beds to go round.
  { id: 'jetty', name: 'the Sedge Landing jetty', region: FEN, needsBoat: false, afloat: false, trip: 8, zone: () => 'fen-landing', chart: 'sedge-landing' },
  { id: 'fen', name: 'the open fen', region: FEN, needsBoat: true, afloat: true, trip: 22, zone: () => 'fen-open' },
  { id: 'glass', name: 'Glasswater', region: FEN, needsBoat: true, afloat: true, trip: 45, zone: () => 'fen-glass', chart: 'glasswater' },
  { id: 'reeds', name: 'the Reed Maze', region: FEN, needsBoat: true, afloat: true, trip: 55, zone: () => 'fen-reeds', chart: 'reed-maze' },
  { id: 'sump', name: 'the Sump', region: FEN, needsBoat: true, afloat: true, trip: 70, zone: () => 'fen-sump', chart: 'the-sump' },
  { id: 'grove', name: 'the Standing Trees', region: FEN, needsBoat: true, afloat: true, trip: 85, zone: () => 'fen-grove', chart: 'standing-trees' },
  { id: 'post', name: 'the Listening Post', region: FEN, needsBoat: true, afloat: true, trip: 118, zone: () => 'fen-post', chart: 'listening-post' },
  // Saltbone Reach, from the packet box on Tryworks Landing: deep water and nothing to go round.
  { id: 'quay', name: 'the Tryworks quay', region: REACH, needsBoat: false, afloat: false, trip: 8, zone: () => 'reach-landing', chart: 'tryworks-landing' },
  { id: 'reach', name: 'the open Reach', region: REACH, needsBoat: true, afloat: true, trip: 22, zone: () => 'reach-open' },
  { id: 'ribs', name: 'the Ribs', region: REACH, needsBoat: true, afloat: true, trip: 62, zone: () => 'reach-ribs', chart: 'the-ribs' },
  { id: 'swell', name: 'the Long Swell', region: REACH, needsBoat: true, afloat: true, trip: 72, zone: () => 'reach-swell' },
  { id: 'kettles', name: 'the Kettles', region: REACH, needsBoat: true, afloat: true, trip: 76, zone: () => 'reach-kettles', chart: 'the-kettles' },
  { id: 'jaw', name: 'the Jaw', region: REACH, needsBoat: true, afloat: true, trip: 92, zone: () => 'reach-jaw', chart: 'the-jaw' },
  { id: 'anvil', name: 'the Anvil', region: REACH, needsBoat: true, afloat: true, trip: 102, zone: () => 'reach-anvil', chart: 'the-anvil' },
  { id: 'tally', name: 'the Tally Stone', region: REACH, needsBoat: true, afloat: true, trip: 128, zone: () => 'reach-tally', chart: 'tally-stone' },
];
/** Seconds for the things that are not fishing. */
export const COSTS = {
  sell: 4, talk: 14, board: 5, buy: 4, aim: 0.6, landed: 2.0, lost: 1.6, pot: 6,
  /** Errands, there and back: the ferry and the lighthouse stair, a sail to a place and a walk on it. */
  visit: { 'lighthouse-lamp': 150, 'keepers-kettle': 115, 'drowned-bell': 110, 'survey-stake': 125, 'ear-trumpet': 250, 'puffin-wreck': 150, 'rib-mark': 135, 'tally-stone': 275 } as Record<string, number>,
  /** Out along the sea-road from the landing to somebody who waits by a light, and back. */
  hail: 85,
  /** A look at Pip's Bar and its chest on the way home, once the skiff is there. */
  explore: 95, ring: 75, echoes: 20,
  /** Between regions: the first time by the sea-road, lamp lit, from one landing to the other; after that the chart does it. */
  cross: 150, fastTravel: 12,
};
/** The chart place a quest's place lies at (reaching the one puts the other on the chart). */
const CHART_OF: Record<string, string> = { 'lighthouse-lamp': 'gull-point', 'keepers-kettle': 'kettle-isle', 'drowned-bell': 'drowned-belfry', 'survey-stake': 'reed-maze', 'ear-trumpet': 'listening-post', 'puffin-wreck': 'reed-maze', 'rib-mark': 'the-ribs', 'tally-stone': 'tally-stone' };
/** The speed the places table's sailing times were reckoned at (the skiff's). */
const TABLE_SPEED = 7;

export interface SimOptions {
  seed: number;
  /** 0 = all thumbs, 1 = very good. 0.7 is a practised player. */
  skill: number;
  minutes: number;
  /** Echoes the Bell must offer before the keeper rings it the first time (8); the job itself asks for the ringing. Infinity = never. */
  firstRing?: number;
  /** Time lost to looking about, reading and fumbling, as a share of all time (0.2): the model player is otherwise tireless. */
  dawdle?: number;
  /** Minutes of earning the keeper will put up with for the next thing on the stall before ringing instead (8). */
  patience?: number;
  /** Stop after this many ringings. */
  maxRings?: number;
  /** Leave the pots in the shed (to measure what they add). */
  noPots?: boolean;
  /** Sign nobody on (to measure what a crew adds). */
  noCrew?: boolean;
  /** Save for a boat as usual, but leave the buying of her undone (the tester's start stops with the price in the purse). */
  noBoat?: boolean;
  /** Take what comes up, but go nowhere for a rumour (to measure what following them costs). */
  noHunts?: boolean;
  /** Nothing on the bottom but fish (to measure what finds do to the rest). */
  noFinds?: boolean;
  /**
   * Jobs she is never offered (by id). `['hb-14-whale-road']` keeps her in the first two waters, as the game
   * was before Saltbone Reach: the bands those hours were tuned to are still tested that way.
   */
  without?: string[];
}
export interface Mark { t: number; what: string }
export interface Bucket { coins: number; pot: number; crew: number; catches: number; lost: number; /** Coins out of crates and chests. */ finds: number }
export interface SimReport {
  marks: Mark[]; buckets: Bucket[]; state: GameState;
  totals: { casts: number; catches: number; snaps: number; slack: number; missed: number; coins: number; potCoins: number; crewCoins: number; fishing: number; away: number; finds: number; findCoins: number; hauling: number; haulSnaps: number; /** Outings made for a rumour, and the seconds they took. */ hunts: number; hunting: number; /** Fish out of struck water. */ struck: number };
  /** Seconds of play at each ringing of the Bell, and what it gave. */
  /** Each ringing of the Bell: when, for how many Echoes, on how many coins, and (`matched`) how many seconds into the tide after it the keeper had earned as much again. */
  rings: { t: number; echoes: number; coins: number; matched?: number }[];
}

export const BUCKET_S = 600;
interface Wish { name: string; price: number; buy: () => boolean; /** the next rod */ goal?: boolean; /** a job asks for it */ asked?: boolean; /** tinkering */ small?: boolean; /** a boat: the one thing a keeper saves up for across a whole tide */ boat?: boolean }
/** Minutes of earning away at which a keeper starts saving for a boat in earnest: spending little else, and leaving the Bell alone. */
const SAVE_FOR_BOAT = 20;

export class SimPlayer {
  s: GameState;
  rng: Rng;
  st: Stats;
  marks: Mark[] = [];
  buckets: Bucket[] = [];
  rings: { t: number; echoes: number; coins: number; matched?: number }[] = [];
  totals = { casts: 0, catches: 0, snaps: 0, slack: 0, missed: 0, coins: 0, potCoins: 0, crewCoins: 0, fishing: 0, away: 0, finds: 0, findCoins: 0, hauling: 0, haulSnaps: 0, hunts: 0, hunting: 0, struck: 0 };
  /** The water the boat lies in while she lies still (the crew fish it); null while she is under way. */
  private lying: string | null = null;
  private castSeed: number;
  private idle = 0;
  private acc = 0;
  private lastGain = 0;
  private rates = new Map<string, number>();
  private explored = false;
  /** In a trial (rate measurement) the clock stands still and quests are not touched. */
  private trial = false;
  private hooks = 0;

  constructor(readonly opts: SimOptions, state?: GameState) {
    this.s = state ?? newGame(opts.seed);
    this.rng = new Rng(opts.seed * 2654435761);
    this.castSeed = opts.seed * 7919 + 1;
    this.st = stats(this.s, this.env());
    this.lying = this.mooringZone();
  }

  private mark(what: string) { if (!this.trial) this.marks.push({ t: this.s.playTime, what }); }
  private bucket(): Bucket { const i = Math.floor(this.s.playTime / BUCKET_S); return (this.buckets[i] ??= { coins: 0, pot: 0, crew: 0, catches: 0, lost: 0, finds: 0 }); }
  /** What the gear is asked about: the hour, whether she is afloat, and whether a storm is blowing where she is. */
  private env(afloat = false) { return { hour: this.s.hour, afloat, storm: inWeather(this.s.world.region, this.s.hour, 'storm') }; }
  private refresh(afloat = false) { this.st = stats(this.s, this.env(afloat)); }

  /** Lets `dt` seconds of play go by. `busy` is fishing or sailing: Rhythm holds while the keeper is at it. */
  pass(dt: number, busy = false) {
    const s = this.s;
    if (this.trial) { s.playTime += dt; return; }
    dt *= 1 + (this.opts.dawdle ?? 0.2);
    s.playTime += dt;
    s.hour = (s.hour + (dt * 24) / DAY_LENGTH_S) % 24;
    if (busy) { this.idle = 0; this.totals.fishing += dt; } else { this.idle += dt; this.totals.away += dt; if (this.idle > RHYTHM.decayAfter) s.rhythm = 0; }
    const last = this.rings[this.rings.length - 1];
    if (last && last.matched === undefined && s.run.coins >= last.coins) last.matched = s.playTime - last.t;
    this.acc += dt;
    if (this.acc >= 1) {
      tickBoard(s, this.acc); tickPots(s, this.acc, s.hour, this.st);
      // The crew fish while the boat lies still, wherever the keeper is. (She does not go looking for fog to lie in.)
      if (this.lying && s.crew.hired.length) tickCrew(s, this.acc, { region: s.world.region, zone: this.lying, hour: s.hour, fog: 0, still: true }, crewKit(this.st));
      this.acc = 0;
    }
  }

  /** Seconds to sail to a place and back as far as the landing, in the boat she has now. */
  private trip(place: Place): number { const b = this.s.boats.current ? BOATS_BY_ID.get(this.s.boats.current) : null; return place.needsBoat && b ? (place.trip * TABLE_SPEED) / b.speed : place.trip; }
  /** The water at the landing of the region she is in, where the boat lies while the keeper is ashore. */
  private mooringZone(): string | null {
    const r = REGIONS_BY_ID.get(this.s.world.region)!, m = r.moorings?.[0];
    return this.s.boats.current && m ? zoneAt(r, m.x, m.z)?.id ?? null : null;
  }
  /** Sails for `secs` (the crew do nothing under way), and leaves her lying in `then` (null: still under way). */
  private sail(secs: number, then: string | null) { this.lying = null; this.pass(secs, true); this.lying = then; }

  // ------------------------------------------------------------------ one cast

  /** One cast, from the press to a fish in the hold or a fish gone. */
  cast(place: Place) {
    const s = this.s, dt = 1 / 60, skill = this.opts.skill;
    if (s.world.region !== place.region) throw new Error(`the keeper is in ${s.world.region}, not at ${place.name}`);
    this.refresh(place.afloat);
    // While there is lightning a keeper who is looking puts most of her casts into struck water (there are a
    // couple of rings alight within a cast of her at any time; the better the hand, the fewer she lets go by).
    const struck = weatherAt(s.world.region, s.hour).thunder && this.rng.chance(Math.min(0.95, (0.3 + 0.45 * skill) * this.st.strikes));
    const ctx = fishingContext(s, this.env(place.afloat), (d) => ({ zoneId: place.zone(d), depth: 5, hotspot: false, distance: d, struck }), this.st);
    // A trial measures what the fish of a place pay: what lies on the bottom is left out of it.
    const session = new FishingSession(this.trial || this.opts.noFinds ? ctx : withFinds(ctx, s, this.st), new Rng(this.castSeed++));
    this.totals.casts++;
    this.pass(COSTS.aim, true);
    // The charge: a practised hand finds the sweet spot most of the time.
    const target = this.rng.chance(0.2 + 0.7 * skill) ? this.rng.range(0.82, 0.94) : this.rng.range(0.55, 0.79);
    session.update(dt, { ...NO_INPUT, primary: true, primaryPressed: true });
    while (session.phase === 'charging') {
      session.update(dt, session.power >= target ? { ...NO_INPUT, primaryReleased: true } : { ...NO_INPUT, primary: true });
      this.pass(dt, true);
    }
    let react = 0, biteT = 0, fightT = 0;
    let policy: ((s: FishingSession, t: number) => FishingInput) | null = null;
    let haul: ((s: FishingSession, t: number) => FishingInput) | null = null;
    for (let guard = 0; guard < 400000 && session.phase !== 'idle'; guard++) {
      switch (session.phase) {
        case 'casting': { const d = Math.max(dt, (session as unknown as { flight: number }).flight); session.update(d, NO_INPUT); this.pass(d, true); break; }
        case 'waiting': { const d = Math.max(dt, Math.min(0.5, session.nextTug + 1e-6)); session.ctx.hour = s.hour; session.update(d, NO_INPUT); this.pass(d, true); break; }
        case 'bite': {
          if (react === 0) react = 0.2 + 0.3 * (1 - skill) + this.rng.range(0, 0.15);
          biteT += dt;
          session.update(dt, biteT >= react ? { ...NO_INPUT, primary: true, primaryPressed: true } : NO_INPUT);
          this.pass(dt, true);
          if (session.phase !== 'bite') { react = 0; biteT = 0; }
          break;
        }
        case 'fighting': {
          policy ??= humanFightPolicy(this.castSeed * 31 + guard, skill);
          session.update(dt, policy(session, fightT)); fightT += dt; this.pass(dt, true);
          break;
        }
        case 'hauling': {
          haul ??= humanHaulPolicy(this.castSeed * 37 + guard, skill);
          session.update(dt, haul(session, fightT)); fightT += dt; this.pass(dt, true); this.totals.hauling += dt;
          break;
        }
        default: break;
      }
      for (const e of session.events.splice(0)) {
        if (e.type === 'hook') { spendBait(s); this.hooks++; }
        else if (e.type === 'missed') this.totals.missed++;
        else if (e.type === 'landed') {
          const first = !s.journal[e.catch.fishId];
          const res = addCatch(s, e.catch, this.st);
          this.totals.catches++;
          if (!this.trial) {
            this.bucket().catches++;
            if (first) { this.mark(`first ${fishDef(e.catch.fishId).name}`); for (const c of claimCollections(s)) this.mark(`journal page: ${c.name}`); }
            if (e.catch.struck) this.totals.struck++;
            if (res.item) onQuestEvent(s, { type: 'catch', fishId: e.catch.fishId, weight: e.catch.weight, trait: e.catch.trait, perfect: e.catch.perfectHook, struck: e.catch.struck });
          }
        } else if (e.type === 'found') {
          const loot = takeFind(s, e.find);
          if (loot) {
            this.totals.finds++; this.totals.findCoins += loot.coins; this.totals.coins += loot.coins; this.bucket().coins += loot.coins; this.bucket().finds += loot.coins;
            if (loot.relic) { this.mark(`relic: ${loot.name}`); this.refresh(place.afloat); }
            else if (loot.kind === 'chest') this.mark(`sea chest${loot.lures.length || loot.wearables.length ? ` (${[...loot.lures, ...loot.wearables].join(', ')})` : ''}`);
            else if (s.finds.crates === 1) this.mark(`first crate (${findName(e.find)})`);
            this.setPearls();
          }
        } else if (e.type === 'lost') {
          if (e.find && e.reason === 'snap') this.totals.haulSnaps++;
          if (e.reason === 'snap') { s.lifetime.snaps++; this.totals.snaps++; breakRhythm(s); }
          else if (e.reason === 'slack') { this.totals.slack++; breakRhythm(s); }
          if (!this.trial) this.bucket().lost++;
        }
      }
      if (session.phase === 'landed') { this.pass(COSTS.landed, true); break; }
      if (session.phase === 'lost') { this.pass(COSTS.lost, true); break; }
    }
  }

  /**
   * Every pearl she has stands beside a relic: the ones that make fish sell for more first, then the lucky ones,
   * then whatever is left. (A pearl costs nothing to move, so she simply sets them all again.)
   */
  private setPearls() {
    const s = this.s;
    if (!s.moonpearls || !s.relics.length) return;
    const worth = (id: string) => { const e = RELICS_BY_ID.get(id)!.effect; return (e.value ?? 0) * 10 + (e.luck ?? 0) * 6 + (e.rhythmCap ?? 0) * 0.3 + (e.biteSpeed ?? 0) * 4 + (e.strange ?? 0) * 20 + 0.01; };
    for (const id of Object.keys(s.pearls)) while (liftPearl(s, id)) { /* all up */ }
    for (const id of [...s.relics].sort((a, b) => worth(b) - worth(a))) while (pearlsFree(s) > 0 && setPearl(s, id)) { /* set */ }
    this.refresh();
  }

  // ------------------------------------------------------------------ judgement

  private places(region = this.s.world.region): Place[] { return PLACES.filter((p) => p.region === region && (!p.needsBoat || this.s.boats.owned.length > 0)); }

  /** Coins a second this place pays with this bait and today's gear, sell trips and bait included. Measured by fishing it. */
  rate(place: Place, baitId: string, casts = 36): number {
    const s = this.s, lvl = s.gear.rodLevels[s.gear.rod] ?? 0;
    const key = [place.id, baitId, s.gear.rod, lvl >> 1, s.gear.lure, isNight(s.hour), s.gear.creel, s.boats.current, s.crew.hired.length, Object.keys(s.journal).length >> 1, s.flags.includes('hb-lighthouse-lit'), s.flags.includes('fen-heard'), Math.floor(s.hour / 3), s.echoes ? JSON.stringify(s.echoUpgrades) : '', ...this.reachKey(place.region)].join('|');
    const hit = this.rates.get(key);
    if (hit !== undefined && casts <= 36) return hit;
    const t = new SimPlayer({ ...this.opts, seed: hashString(key) % 100000 }, structuredClone(s));
    t.trial = true; t.s.world.region = place.region;
    t.s.hold = []; t.s.gear.bait = baitId; t.s.gear.baits[baitId] = Infinity;
    t.s.quests = { active: {}, done: [...s.quests.done], board: { quests: [], timer: 1e9, serial: 0 } };
    const t0 = t.s.playTime;
    let coins = 0, trips = 0;
    const empty = () => { coins += t.s.hold.reduce((a, c) => a + c.value, 0); trips += t.s.hold.length / t.st.hold; t.s.hold = []; };
    for (let i = 0; i < casts; i++) { t.cast(place); if (t.s.hold.length >= t.st.hold) empty(); }
    empty();
    const secs = t.s.playTime - t0 + trips * (2 * this.trip(place) + COSTS.sell);
    const r = (coins - t.hooks * baitDef(baitId).price) / secs;
    this.rates.set(key, r);
    return r;
  }

  /**
   * What only the Reach adds to a rate's key: the count at the Tally Stone, and the weather. Nothing at all where
   * neither applies, so that a rate measured in the older waters is the same measurement it always was (a trial
   * is seeded by its key, and the bands in tests/sim.test.ts were set on those).
   */
  private reachKey(region: string): string[] { const w = this.weatherKey(region); return [...(this.s.flags.includes('reach-counted') && region === REACH ? ['counted'] : []), ...(w ? [w] : [])]; }
  /** The weather as far as a place's fishing goes: which storm, and whether it is in its eye. */
  private weatherKey(region: string): string { const w = weatherAt(region, this.s.hour); return w.storm ? `${w.storm.id}${w.eye > 0.5 ? '-eye' : ''}` : ''; }

  /** The baits worth thinking about: the free one, anything in the tin, anything on the stall the purse can stand. */
  private baitChoices(): string[] {
    const s = this.s;
    return BAITS.filter((b) => b.price === 0 || (s.gear.baits[b.id] ?? 0) >= 8 || (s.flags.includes('shop-open') && onShelf(s.flags, b) && b.price * 20 <= s.coins * 0.5)).map((b) => b.id);
  }

  /** Where to fish and with what: the best coins a second, unless a job wants a particular fish. */
  private plan(): { place: Place; bait: string; want: FishDef | null } {
    const places = this.places();
    const want = this.wantedFish();
    let pool = places;
    if (want) {
      const can = places.filter((p) => want.zones.includes(p.zone(20)) || want.zones.includes(p.zone(5)));
      const at = this.wantedAt();
      if (at) pool = places.filter((p) => p.id === at); else if (can.length && this.about(want)) pool = can;
    }
    let best = { place: pool[0], bait: 'breadcrumb', r: -Infinity };
    for (const p of pool) for (const b of this.baitChoices()) {
      let r = this.rate(p, b);
      if (want && this.about(want)) r *= baitDef(b).affinity[want.id] ?? 1; // a wanted fish is worth leaning toward
      if (r > best.r * (b === 'breadcrumb' ? 1 : 1.04)) best = { place: p, bait: b, r };
    }
    return { place: best.place, bait: best.bait, want };
  }

  private activeObjectives(): { q: QuestDef; o: ObjectiveDef }[] {
    const out: { q: QuestDef; o: ObjectiveDef }[] = [];
    for (const q of QUESTS) {
      if (questStatus(this.s, q.id) !== 'active') continue;
      q.objectives.forEach((o, i) => { if (objectiveProgress(this.s, q, i) < objectiveTarget(o)) out.push({ q, o }); });
    }
    return out;
  }
  private wantedFish(): FishDef | null {
    const o = this.activeObjectives().find((x) => x.o.type === 'catch' && x.o.fish);
    if (o) return fishDef(o.o.fish!);
    // With the story told as far as it goes she fills the journal: the commonest fish of these waters not yet in it that is about now.
    const s = this.s;
    this.hunting = !this.trial && !QUESTS.some((q) => q.chain === 'main' && !this.opts.without?.includes(q.id) && ['active', 'ready', 'available'].includes(questStatus(s, q.id)));
    if (!this.hunting) return null;
    // She does not sit up for a fish that keeps hours while there is still a better rod to earn.
    const rod = this.wishlist().some((w) => w.goal);
    return FISH.filter((f) => f.region === s.world.region && !s.journal[f.id] && this.about(f) && (!f.requires || s.flags.includes(f.requires)) && !(rod && (f.hours || f.weather)))
      .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity))[0] ?? null;
  }
  private hunting = false;
  /** Is this fish about now? For a fish she is after for the journal, also: will it be by the time she is there? */
  private about(f: FishDef): boolean { return this.bites(f, this.s.hour) || (this.hunting && this.bites(f, (this.s.hour + 2.5) % 24)); }
  /** Would this fish bite at `hour`: its own hours, and its weather. */
  private bites(f: FishDef, hour: number): boolean { return inHours(hour, f.hours) && inWeather(f.region, hour, f.weather); }
  /** The place a job names with a spot on the chart: the one whose water that spot lies in. */
  private wantedAt(): string | null {
    const at = this.activeObjectives().find((x) => x.o.type === 'catch' && x.o.at)?.o.at;
    const region = at ? regionAt(at[0], at[1]) : null;
    const zone = region ? zoneAt(REGIONS_BY_ID.get(region)!, at![0], at![1]) : null;
    return zone ? PLACES.find((p) => p.region === region && p.zone(20) === zone.id)?.id ?? null : null;
  }

  // ------------------------------------------------------------------ between regions

  /** Sails to another region, if the boat can: the first time by the sea-road, after that by the chart. */
  private goTo(region: string): boolean {
    const s = this.s, from = s.world.region;
    if (from === region) return true;
    if (!s.boats.owned.length || !hasFogLamp(s) || !this.canCross(from, region)) return false;
    // She does not leave her pots behind in waters she is leaving.
    if (!this.opts.noPots) for (const other of this.places(from)) {
      const there = s.pots.placed.filter((p) => this.potAt.get(p.id) === other);
      if (!there.length) continue;
      this.lying = null; this.pass(this.trip(other), other.afloat);
      for (const p of there) {
        const got = haulPot(s, p.id);
        if (got.length) onQuestEvent(s, { type: 'haul', count: got.length });
        takeUpPot(s, p.id); this.potAt.delete(p.id);
        this.pass(COSTS.pot, true);
      }
      this.pass(this.trip(other), other.afloat); this.lying = this.mooringZone();
    }
    this.sell();
    const first = !s.world.discovered.includes(region);
    this.sail(first ? COSTS.cross : COSTS.fastTravel, null);
    arriveIn(s, region);
    this.lying = this.mooringZone();
    if (first) this.mark(`reached ${REGIONS_BY_ID.get(region)!.name}`);
    // The landing she comes in at goes on the chart as she arrives.
    const landing = REGIONS_BY_ID.get(region)!.moorings?.[0]?.place;
    if (landing) this.chart(landing);
    this.rates.clear();
    return true;
  }

  /** Will every sea-road on the way from one region to another take the boat she is in? */
  private canCross(from: string, to: string): boolean {
    const hull = BOATS_BY_ID.get(this.s.boats.current ?? '')?.hull ?? 0;
    for (let at = from, guard = 0; at !== to && guard < 8; guard++) {
      const step = roadToward(at, to);
      if (!step || hull < (step.road.hull ?? 0)) return false;
      at = step.next;
    }
    return true;
  }

  /** The region a job is pulling the keeper toward, if any: somewhere to go, somebody to tell, a fish that lives there. */
  private jobRegion(): string | null {
    const s = this.s;
    for (const q of QUESTS) {
      const st = questStatus(s, q.id);
      if (st === 'ready') { const r = regionOfNpc(handsInTo(q)); if (r) return r; }
      if (st !== 'active') continue;
      for (let i = 0; i < q.objectives.length; i++) {
        const o = q.objectives[i];
        if (objectiveProgress(s, q, i) >= objectiveTarget(o)) continue;
        if (o.type === 'visit') { const r = regionOfPlace(o.place!) ?? REGIONS.find((x) => (x.chart ?? []).some((c) => c.id === o.place))?.id; if (r) return r; }
        if (o.type === 'catch') { const r = o.region ?? (o.fish ? fishDef(o.fish).region : null); if (r) return r; }
      }
    }
    // Nothing in hand: somebody with a job to give.
    for (const q of QUESTS) if (q.chain === 'main' && !this.opts.without?.includes(q.id) && questStatus(s, q.id) === 'available') { const r = regionOfNpc(q.giver); if (r) return r; }
    return null;
  }

  /** Where to spend this outing: where a job is, else where the fishing pays best (with a little reluctance to move). */
  private chooseRegion() {
    const s = this.s;
    if (!hasFogLamp(s) || !s.boats.owned.length) return;
    const job = this.jobRegion();
    if (job && this.goTo(job)) return;
    let best = s.world.region, br = -Infinity;
    for (const id of s.world.discovered) {
      if (!this.canCross(s.world.region, id)) continue;
      let r = -Infinity;
      for (const p of this.places(id)) for (const b of this.baitChoices()) r = Math.max(r, this.rate(p, b));
      if (id !== s.world.region) r *= 0.9;
      if (r > br) { br = r; best = id; }
    }
    this.goTo(best);
  }

  // ------------------------------------------------------------------ town

  private sell() {
    const s = this.s;
    if (!s.hold.length && !s.pots.hold.length && !s.crew.hold.length) return;
    const n = s.hold.length + s.pots.hold.length + s.crew.hold.length, pot = s.pots.hold.reduce((a, c) => a + c.value, 0), crew = s.crew.hold.reduce((a, c) => a + c.value, 0);
    const total = sellAll(s);
    this.totals.coins += total; this.totals.potCoins += pot; this.totals.crewCoins += crew;
    const b = this.bucket(); b.coins += total; b.pot += pot; b.crew += crew;
    onQuestEvent(s, { type: 'sell', count: n, coins: total });
    this.pass(COSTS.sell);
  }

  /** Hand in what is ready, take what is offered. Returns true if anything changed. */
  private talk(): boolean {
    const s = this.s;
    let any = false;
    for (let again = true; again;) {
      again = false;
      for (const n of NPCS) {
        if (n.region !== s.world.region) continue; // only the people who are here
        const offer = npcOffer(s, n.id);
        // Somebody who signs on is not taken on by a keeper told to sail alone.
        if (this.opts.noCrew && offer.kind !== 'none' && offer.quest.rewards.crew) continue;
        if (offer.kind !== 'none' && this.opts.without?.includes(offer.quest.id)) continue;
        if (offer.kind === 'turnIn') {
          // Somebody who waits out on the sea-road is sailed out to.
          if (this.region().hails?.some((h) => h.npc === n.id)) { this.sail(COSTS.hail / 2, null); this.sail(COSTS.hail / 2, this.mooringZone()); }
          const r = turnIn(s, offer.quest.id); this.mark(`done: ${offer.quest.title}`); this.pass(COSTS.talk); again = any = true;
          for (const id of r?.crew ?? []) { this.mark(`aboard: ${CREW_BY_ID.get(id)!.name}`); this.rates.clear(); }
        }
        else if (offer.kind === 'offer') { accept(s, offer.quest.id); this.mark(`took: ${offer.quest.title}`); this.pass(COSTS.talk); again = any = true; }
      }
    }
    const fresh = s.quests.board.quests.filter((q) => !q.accepted);
    if (fresh.length) { for (const q of fresh) acceptBoard(s, q.id); this.pass(COSTS.board); }
    return any;
  }

  /** What the keeper would like from the stall, cheapest first. */
  private wishlist(): Wish[] {
    const s = this.s, out: Wish[] = [];
    if (!s.flags.includes('shop-open')) return out;
    const tier = RODS.find((r) => r.id === s.gear.rod)!.tier;
    const next = RODS.filter((r) => r.price > 0 && !s.gear.rods.includes(r.id) && r.tier > tier && onShelf(s.flags, r)).sort((a, b) => a.price - b.price)[0];
    const asked = this.activeObjectives().some((x) => x.o.type === 'own' && x.o.item === next?.id);
    if (next) out.push({ name: next.name, price: next.price, buy: () => buyRod(s, next.id), goal: true, asked });
    const creel = creelNext(s);
    if (creel) out.push({ name: creel.name, price: creel.price, buy: () => buyCreel(s) });
    for (const l of LURES) if (l.price !== undefined && !s.gear.lures.includes(l.id) && onShelf(s.flags, l)) out.push({ name: l.name, price: l.price, buy: () => buyLure(s, l.id) });
    for (const w of WEARABLES) if (w.price !== undefined && !s.gear.wearables.includes(w.id) && !s.gear.worn[w.slot] && onShelf(s.flags, w)) out.push({ name: w.name, price: w.price, buy: () => buyWearable(s, w.id) });
    if (s.flags.includes('pots-open') && !this.opts.noPots) {
      const p = potPrice(s);
      if (p !== null) out.push({ name: 'another Lantern Pot', price: p, buy: () => buyPot(s) });
      for (const k of ['speed', 'size', 'quality'] as PotUpgrade[]) { const c = potUpgradeCost(s, k); if (c !== null) out.push({ name: `pots: ${k} ${s.pots.levels[k] + 1}`, price: c, buy: () => upgradePots(s, k), small: true }); }
    }
    for (const b of BOATS) if (boatOnOffer(s, b.id)) out.push({ name: b.name, price: b.price, buy: () => !this.opts.noBoat && buyBoat(s, b.id), boat: true });
    const tune = tuneCost(s, s.gear.rod);
    if (tune !== null) out.push({ name: `tune ${s.gear.rod} to ${(s.gear.rodLevels[s.gear.rod] ?? 0) + 1}`, price: tune, buy: () => tuneRod(s, s.gear.rod), small: true });
    return out.sort((a, b) => a.price - b.price);
  }

  private shop() {
    const s = this.s;
    for (let bought = true; bought;) {
      bought = false;
      const list = this.wishlist();
      const goal = list.find((w) => w.goal), boat = this.savingFor(list);
      for (const w of list) {
        // With a better rod still to buy, do not pour coins into the one in hand, and keep other things modest.
        let limit = w.goal ? s.coins : goal ? Math.min(s.coins, goal.price * (goal.asked || w.small ? 0.1 : 0.35)) : w.small ? s.coins * 0.6 : s.coins;
        // Saving for a boat: nothing else that would set her back much.
        if (boat && w !== boat && !w.goal) limit = Math.min(limit, boat.price * 0.04);
        if (w.price > limit) continue;
        if (w.buy()) { this.mark(`bought ${w.name} (${w.price})`); this.pass(COSTS.buy); this.rates.clear(); bought = true; break; }
      }
    }
    this.refresh();
  }

  /** The boat the keeper is saving for, once it is near enough to be worth going without for. */
  private savingFor(list = this.wishlist()): Wish | null {
    const boat = list.find((w) => w.boat);
    return boat && (boat.price - this.s.coins) / Math.max(1, this.income()) < SAVE_FOR_BOAT ? boat : null;
  }

  private stock(baitId: string) {
    const s = this.s;
    s.gear.bait = 'breadcrumb';
    if (baitId === 'breadcrumb') return;
    const want = Math.ceil(this.st.hold * 1.4), have = s.gear.baits[baitId] ?? 0;
    if (have < want) buyBait(s, baitId, Math.min(want - have, Math.floor(s.coins / Math.max(1, baitDef(baitId).price))));
    if ((s.gear.baits[baitId] ?? 0) > 0) s.gear.bait = baitId;
  }

  // ------------------------------------------------------------------ errands and the Bell

  private region() { return REGIONS_BY_ID.get(this.s.world.region)!; }
  private chart(id: string) {
    const s = this.s, c = this.region().chart?.find((x) => x.id === id);
    if (!c || s.world.charted.includes(id)) return;
    s.world.charted.push(id);
    if (c.coins) { earn(s, c.coins); this.totals.coins += c.coins; this.bucket().coins += c.coins; }
    this.mark(`charted ${c.name}`);
    onQuestEvent(s, { type: 'visit', place: id }); // finding a place can be the whole of a job
    // Past Hearthbay a chest is found when the place it lies at is: a walk along the bar for it.
    if (s.world.region !== HB) for (const chest of this.region().chests ?? []) {
      const near = [...this.region().chart!].sort((a, b) => Math.hypot(a.x - chest.x, a.z - chest.z) - Math.hypot(b.x - chest.x, b.z - chest.z))[0];
      if (near.id === id) { this.pass(45); this.open(chest); }
    }
  }

  /** Visits a quest's place if one is waiting. Returns true if an errand was run. */
  private errand(): boolean {
    const s = this.s;
    const v = this.activeObjectives().find((x) => x.o.type === 'visit' && regionOfPlace(x.o.place!) === s.world.region);
    if (v) {
      const place = v.o.place!, def = this.region().places!.find((p) => p.id === place)!;
      this.lying = def.fromBoat ? null : this.lying; // a place looked at from the boat takes the boat with it
      this.pass(COSTS.visit[place] ?? 120, place !== 'lighthouse-lamp');
      this.lying = this.mooringZone();
      if (place === 'lighthouse-lamp' && !s.flags.includes('lamp-lit')) s.flags.push('lamp-lit');
      if (CHART_OF[place]) this.chart(CHART_OF[place]);
      if (!s.flags.includes(`seen:${place}`)) s.flags.push(`seen:${place}`);
      if (def.flag && !s.flags.includes(def.flag)) { s.flags.push(def.flag); this.rates.clear(); }
      onQuestEvent(s, { type: 'visit', place });
      this.mark(`visited ${place}`);
      return true;
    }
    if (s.world.region === HB && !this.explored && s.boats.owned.length) {
      this.explored = true;
      this.sail(COSTS.explore, this.mooringZone());
      this.chart('pips-bar');
      for (const c of this.region().chests ?? []) this.open(c);
      return true;
    }
    return false;
  }

  private open(c: ChestDef) {
    const s = this.s;
    if (s.flags.includes(`chest:${c.id}`)) return;
    s.flags.push(`chest:${c.id}`);
    earn(s, c.coins); this.totals.coins += c.coins; this.bucket().coins += c.coins;
    for (const [id, n] of Object.entries(c.items ?? {})) s.gear.baits[id] = (s.gear.baits[id] ?? 0) + n;
    for (const id of c.lures ?? []) grantLure(s, id);
    for (const id of c.wearables ?? []) grantWearable(s, id);
    this.mark(`opened ${c.id}`);
  }

  /** Coins a minute over the last ten minutes or so. */
  private income(): number {
    const i = Math.floor(this.s.playTime / BUCKET_S), now = this.buckets[i]?.coins ?? 0, prev = this.buckets[i - 1]?.coins ?? 0;
    const secs = (this.s.playTime % BUCKET_S) + (i > 0 ? BUCKET_S : 0);
    return secs > 120 ? ((now + prev) * 60) / secs : 0;
  }

  /**
   * Ring when the bay has stalled: the cheapest thing still wanted is more than `patience` minutes of earning away
   * (or there is nothing left to want), and the Bell offers at least what it did last time.
   */
  private ring(): boolean {
    const s = this.s;
    if (!s.flags.includes(BELL_FLAG) || this.rings.length >= (this.opts.maxRings ?? Infinity)) return false;
    if (questStatus(s, 'hb-10-turning') === 'available' || questStatus(s, 'hb-10-turning') === 'locked') return false;
    const offer = echoesFor(s);
    if (!this.rings.length) { if (offer < (this.opts.firstRing ?? 8)) return false; }
    else {
      // Later: when the Bell offers enough to buy something, and the tide has had a fair run (or has stalled).
      const next = this.wishlist()[0], income = this.income();
      const stalled = (next ? (next.price - s.coins) / Math.max(1, income) : Infinity) >= (this.opts.patience ?? 6);
      const enough = Math.max(5, Math.ceil(this.lastGain * 0.5));
      if (offer < enough || (!stalled && s.playTime - s.run.startedAt < 20 * 60)) return false;
      // Nobody turns the tide a few minutes short of a new rod.
      const rod = this.wishlist().find((w) => w.goal);
      if (rod && (rod.price - s.coins) / Math.max(1, income) < 2 * (this.opts.patience ?? 6)) return false;
      // Nor with a boat half paid for: the Bell would take the coins and leave the wreck where she lies.
      if (this.savingFor()) return false;
    }
    if (!this.goTo(HB)) return false; // the Bell hangs in Hearthbay
    this.sail(COSTS.ring, this.mooringZone());
    const coins = s.run.coins;
    const t = ringBell(s);
    if (!t) return false;
    onQuestEvent(s, { type: 'ring' });
    this.lastGain = t.echoes;
    this.rings.push({ t: s.playTime, echoes: t.echoes, coins: coins + t.sold });
    this.totals.coins += t.sold; this.bucket().coins += t.sold;
    this.mark(`RANG THE BELL: ${t.echoes} Echoes from ${coins + t.sold} coins`);
    // Spend the Echoes: a thing first (the Fog Lamp is the way on), then cheapest first, in the tree's own order.
    for (let bought = true; bought;) {
      bought = false;
      const pick = ECHO_UPGRADES.map((u) => ({ u, c: echoCost(s, u.id) })).filter((x) => x.c !== null && x.c <= s.echoes && !(this.opts.noPots && x.u.effect?.potSlots)).sort((a, b) => (a.u.thing ? 0 : a.c!) - (b.u.thing ? 0 : b.c!))[0];
      if (pick && buyEcho(s, pick.u.id)) { this.mark(`echo: ${pick.u.name} ${s.echoUpgrades[pick.u.id]}`); bought = true; }
    }
    this.pass(COSTS.echoes);
    this.rates.clear(); this.refresh();
    return true;
  }

  // ------------------------------------------------------------------ the day

  /** What is done ashore before going out: the catch sold, everybody spoken to, the shelf looked over. */
  townBusiness() {
    this.sell();
    this.talk();
    this.shop();
    this.talk(); // a job that wanted something bought is handed in on the spot
  }

  /** Sells what she has and sails for the home dock of Hearthbay, if she is not there. */
  home() { this.sell(); this.goTo(HB); }

  /** One outing: town business, then out to fish until the hold is full or a job is done, then home. */
  outing() {
    const s = this.s;
    this.townBusiness();
    if (pearlsFree(s) > 0 && !this.opts.noFinds) this.setPearls(); // a pearl from a job goes straight to the Shelf
    if (this.ring()) return;
    // A relic somebody has spoken of, in the waters she is in and at this hour: she fishes for that before she
    // thinks of going anywhere else (the morning after a Turning finds her on the home dock at first light).
    const hunt = this.rumoured(), t0 = s.playTime;
    if (hunt) { this.totals.hunts++; this.mark(`after: ${hunt.relic.name}`); }
    const was = s.world.region;
    if (!hunt) this.chooseRegion();
    if (s.world.region !== was) return; // new people to talk to before anything else
    if (this.errand()) return;
    const usual = this.plan();
    const plan = hunt ? { ...usual, place: hunt.place } : usual;
    // Once the relic is up she fishes on where she is if the water there is worth the trip she has made.
    let found: number | null = null;
    const stay = !!hunt && !!usual.place && (hunt.place === usual.place || this.rate(hunt.place, plan.bait) >= 0.6 * this.rate(usual.place, usual.bait));
    this.stock(plan.bait);
    const place = plan.place;
    // A pot can only be hauled from beside it. Pots left full somewhere the keeper is not going today are
    // fetched first: out to them, up, and back.
    if (!this.opts.noPots) for (const other of this.places()) {
      if (other === place) continue;
      const there = s.pots.placed.filter((p) => this.potAt.get(p.id) === other);
      if (!there.length || there.some((p) => p.fish.length < this.st.potCapacity)) continue;
      this.lying = null; this.pass(this.trip(other), other.afloat);
      for (const p of there) {
        const got = haulPot(s, p.id);
        if (got.length) onQuestEvent(s, { type: 'haul', count: got.length });
        takeUpPot(s, p.id); this.potAt.delete(p.id);
        this.pass(COSTS.pot, true);
      }
      this.pass(this.trip(other), other.afloat); this.lying = this.mooringZone();
    }
    // Out to the place: by boat she comes too (and lies there while the keeper fishes); on foot she stays at the landing.
    if (place.needsBoat) this.lying = null;
    this.pass(this.trip(place), place.afloat);
    this.lying = place.needsBoat ? place.zone(8) : this.mooringZone();
    if (place.chart) this.chart(place.chart);
    // Pots go in beside the fishing, and come up when it is time to go.
    if (!this.opts.noPots) while (potsInHand(s) > 0) {
      const n = s.pots.placed.length;
      const pot = placePot(s, place.zone(8), n * 6, s.pots.nextId * 6);
      if (!pot) break;
      this.potAt.set(pot.id, place);
      this.pass(COSTS.pot, true);
    }
    const ready = () => QUESTS.filter((q) => q.chain === 'main' && questStatus(s, q.id) === 'ready').length;
    const before = ready(), until = s.playTime + 12 * 60;
    // Home early when the hold would pay for the next thing wanted (and is worth the walk).
    const next = this.wishlist().find((w) => w.price > s.coins && w.price >= 100);
    const least = this.trip(place) > 20 ? Math.max(6, this.st.hold * 0.6) : 6; // nobody sails home from the Teeth with six fish
    const worth = () => !!next && s.hold.length >= least && s.coins + s.hold.reduce((a, c) => a + c.value, 0) >= next.price;
    const toSell = () => worth() || this.activeObjectives().some((x) => x.o.type === 'sell' && s.hold.length >= objectiveTarget(x.o) - objectiveProgress(s, x.q, x.q.objectives.indexOf(x.o)));
    while (s.hold.length < this.st.hold && ready() === before && !toSell() && s.playTime < until && s.playTime < this.opts.minutes * 60) {
      if (plan.want && this.bites(plan.want, s.hour) !== this.bites(plan.want, (s.hour + 23.99) % 24)) break;
      // The fish she came here for is in the hold (or, hunting for the journal, has gone off the bite): nobody
      // fishes on at the dock for the cat's sake once the cat has her fish.
      if ((this.hunting || plan.want) && this.wantedFish() !== plan.want) break;
      // The relic is up (or its hour has gone by): on with the day.
      if (hunt && !stay && (s.relics.includes(hunt.relic.id) || !inHours(s.hour, hunt.relic.where!.hours) || !inWeather(hunt.relic.region, s.hour, hunt.relic.where!.weather))) break;
      this.cast(place);
      if (hunt && found === null && s.relics.includes(hunt.relic.id)) found = s.playTime;
      this.haul(true, place);
    }
    this.haul(false, place);
    if (place.needsBoat) this.lying = null;
    this.pass(this.trip(place), place.afloat);
    this.lying = this.mooringZone();
    // What the rumour cost: the whole outing if she came home for it, the time until it was up if she fished on.
    if (hunt) this.totals.hunting += (stay && found !== null ? found : s.playTime) - t0;
  }
  /**
   * A relic the keeper has heard of that would come to a line in the water she is in, at the hour she would get
   * there and for a little while after, and the place to fish for it. She does not cross the fog for one: the
   * rumours of another water wait until something else takes her there.
   */
  private rumoured(): { relic: RelicDef; place: Place } | null {
    const s = this.s;
    if (this.opts.noHunts || this.opts.noFinds || s.lifetime.catches < FINDS.after) return null;
    for (const r of RELICS) {
      const w = r.where;
      if (!w || s.relics.includes(r.id) || r.region !== s.world.region || !met(s, r.hint.after) || !met(s, w.needs)) continue;
      const place = this.places().find((p) => w.zones.includes(p.zone(20)) || w.zones.includes(p.zone(5)));
      if (!place) continue;
      const there = (s.hour + this.trip(place) / (DAY_LENGTH_S / 24)) % 24;
      const then = (h: number) => inHours(h, w.hours) && inWeather(r.region, h, w.weather);
      if (then(there) && then((there + 1) % 24)) return { relic: r, place };
    }
    return null;
  }

  /** Where each pot in the water was set. */
  private potAt = new Map<number, Place>();

  /** Brings up the pots set here: the full ones while fishing beside them, all of them before going home. */
  private haul(fullOnly: boolean, place: Place) {
    const s = this.s;
    for (const p of s.pots.placed) {
      if (this.potAt.get(p.id) !== place) continue;
      if (!p.fish.length || (fullOnly && p.fish.length < this.st.potCapacity)) continue;
      const got = haulPot(s, p.id);
      onQuestEvent(s, { type: 'haul', count: got.length });
      this.pass(COSTS.pot, true);
    }
  }

  run(): SimReport {
    const end = this.opts.minutes * 60;
    while (this.s.playTime < end) this.outing();
    return { marks: this.marks, buckets: this.buckets, state: this.s, totals: this.totals, rings: this.rings };
  }
}

export function simulate(opts: SimOptions): SimReport { return new SimPlayer(opts).run(); }

/** The first time a mark containing `what` appears, in minutes, or null. */
export function when(r: SimReport, what: string): number | null {
  const m = r.marks.find((x) => x.what.includes(what));
  return m ? m.t / 60 : null;
}
