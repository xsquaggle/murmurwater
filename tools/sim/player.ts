/**
 * The economy simulator's player: a headless keeper who plays the real rules (the fishing state machine, the
 * hold, quests, the shop, pots, the Bell) with human-ish hands and a sensible head, and writes down when
 * things happen. Nothing here invents an economy of its own: every coin comes through src/core.
 *
 * What is modelled, not played: walking, sailing and talking are time costs from the places table.
 */
import { Rng, hashString } from '../../src/core/rng';
import { FishingSession, NO_INPUT, type FishingInput } from '../../src/core/fishing';
import { DAY_LENGTH_S, newGame, type GameState } from '../../src/core/state';
import { addCatch, breakRhythm, earn, sellAll, RHYTHM } from '../../src/core/economy';
import {
  BAITS, FISH, REGIONS_BY_ID, RODS, bait as baitDef, fish as fishDef, inHours, type FishDef,
} from '../../src/core/content';
import {
  LURES, WEARABLES, buyBait, buyCreel, buyLure, buyPot, buyRod, buyWearable, claimCollections, creelNext, fishingContext,
  grantLure, grantWearable, isNight, potPrice, potUpgradeCost, spendBait, stats, tuneCost, tuneRod, upgradePots, type PotUpgrade, type Stats,
} from '../../src/core/gear';
import {
  NPCS, QUESTS, accept, acceptBoard, npcOffer, objectiveProgress, objectiveTarget, onQuestEvent, questStatus, tickBoard, turnIn,
  type ObjectiveDef, type QuestDef,
} from '../../src/core/quests';
import { haulPot, placePot, potsInHand, tickPots } from '../../src/core/pots';
import { BELL_FLAG, buyEcho, echoCost, echoesFor, ringBell } from '../../src/core/bell';
import { ECHO_UPGRADES } from '../../src/core/gear';
import { humanFightPolicy } from '../../tests/helpers';

/** Somewhere to fish. `trip` is the seconds it takes to get there from Mara's stall (and back again). */
export interface Place { id: string; name: string; needsBoat: boolean; afloat: boolean; trip: number; zone: (castDistance: number) => string; chart?: string }
export const PLACES: Place[] = [
  { id: 'dock', name: 'the dock', needsBoat: false, afloat: false, trip: 8, zone: (d) => (d > 16 ? 'hb-bay' : 'hb-dock') },
  { id: 'open', name: 'open water', needsBoat: true, afloat: true, trip: 24, zone: () => 'hb-open' },
  { id: 'teeth', name: 'the Teeth', needsBoat: true, afloat: true, trip: 58, zone: () => 'hb-teeth', chart: 'the-teeth' },
];
/** Seconds for the things that are not fishing. */
export const COSTS = {
  sell: 4, talk: 14, board: 5, buy: 4, aim: 0.6, landed: 2.0, lost: 1.6, pot: 6,
  /** Errands, there and back: the ferry and the lighthouse stair, a sail to a place and a walk on it. */
  visit: { 'lighthouse-lamp': 150, 'keepers-kettle': 115, 'drowned-bell': 110 } as Record<string, number>,
  /** A look at Pip's Bar and its chest on the way home, once the skiff is there. */
  explore: 95, ring: 75, echoes: 20,
};

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
}
export interface Mark { t: number; what: string }
export interface Bucket { coins: number; pot: number; catches: number; lost: number }
export interface SimReport {
  marks: Mark[]; buckets: Bucket[]; state: GameState;
  totals: { casts: number; catches: number; snaps: number; slack: number; missed: number; coins: number; potCoins: number; fishing: number; away: number };
  /** Seconds of play at each ringing of the Bell, and what it gave. */
  rings: { t: number; echoes: number; coins: number }[];
}

export const BUCKET_S = 600;
interface Wish { name: string; price: number; buy: () => boolean; /** the next rod */ goal?: boolean; /** a job asks for it */ asked?: boolean; /** tinkering */ small?: boolean }

export class SimPlayer {
  s: GameState;
  rng: Rng;
  st: Stats;
  marks: Mark[] = [];
  buckets: Bucket[] = [];
  rings: { t: number; echoes: number; coins: number }[] = [];
  totals = { casts: 0, catches: 0, snaps: 0, slack: 0, missed: 0, coins: 0, potCoins: 0, fishing: 0, away: 0 };
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
    this.st = stats(this.s, { hour: this.s.hour });
  }

  private mark(what: string) { if (!this.trial) this.marks.push({ t: this.s.playTime, what }); }
  private bucket(): Bucket { const i = Math.floor(this.s.playTime / BUCKET_S); return (this.buckets[i] ??= { coins: 0, pot: 0, catches: 0, lost: 0 }); }
  private refresh(afloat = false) { this.st = stats(this.s, { hour: this.s.hour, afloat }); }

  /** Lets `dt` seconds of play go by. `busy` is fishing or sailing: Rhythm holds while the keeper is at it. */
  pass(dt: number, busy = false) {
    const s = this.s;
    if (this.trial) { s.playTime += dt; return; }
    dt *= 1 + (this.opts.dawdle ?? 0.2);
    s.playTime += dt;
    s.hour = (s.hour + (dt * 24) / DAY_LENGTH_S) % 24;
    if (busy) { this.idle = 0; this.totals.fishing += dt; } else { this.idle += dt; this.totals.away += dt; if (this.idle > RHYTHM.decayAfter) s.rhythm = 0; }
    this.acc += dt;
    if (this.acc >= 1) { tickBoard(s, this.acc); tickPots(s, this.acc, s.hour, this.st); this.acc = 0; }
  }

  // ------------------------------------------------------------------ one cast

  /** One cast, from the press to a fish in the hold or a fish gone. */
  cast(place: Place) {
    const s = this.s, dt = 1 / 60, skill = this.opts.skill;
    this.refresh(place.afloat);
    const session = new FishingSession(
      fishingContext(s, { hour: s.hour, afloat: place.afloat }, (d) => ({ zoneId: place.zone(d), depth: 5, hotspot: false, distance: d }), this.st),
      new Rng(this.castSeed++));
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
            if (res.item) onQuestEvent(s, { type: 'catch', fishId: e.catch.fishId, weight: e.catch.weight, trait: e.catch.trait, perfect: e.catch.perfectHook });
          }
        } else if (e.type === 'lost') {
          if (e.reason === 'snap') { s.lifetime.snaps++; this.totals.snaps++; breakRhythm(s); }
          else if (e.reason === 'slack') { this.totals.slack++; breakRhythm(s); }
          if (!this.trial) this.bucket().lost++;
        }
      }
      if (session.phase === 'landed') { this.pass(COSTS.landed, true); break; }
      if (session.phase === 'lost') { this.pass(COSTS.lost, true); break; }
    }
  }

  // ------------------------------------------------------------------ judgement

  private places(): Place[] { return PLACES.filter((p) => !p.needsBoat || this.s.boats.owned.length > 0); }

  /** Coins a second this place pays with this bait and today's gear, sell trips and bait included. Measured by fishing it. */
  rate(place: Place, baitId: string, casts = 36): number {
    const s = this.s, lvl = s.gear.rodLevels[s.gear.rod] ?? 0;
    const key = [place.id, baitId, s.gear.rod, lvl >> 1, s.gear.lure, isNight(s.hour), s.gear.creel, Object.keys(s.journal).length >> 1, s.flags.includes('hb-lighthouse-lit'), Math.floor(s.hour / 3), s.echoes ? JSON.stringify(s.echoUpgrades) : ''].join('|');
    const hit = this.rates.get(key);
    if (hit !== undefined && casts <= 36) return hit;
    const t = new SimPlayer({ ...this.opts, seed: hashString(key) % 100000 }, structuredClone(s));
    t.trial = true;
    t.s.hold = []; t.s.gear.bait = baitId; t.s.gear.baits[baitId] = Infinity;
    t.s.quests = { active: {}, done: [...s.quests.done], board: { quests: [], timer: 1e9, serial: 0 } };
    const t0 = t.s.playTime;
    let coins = 0, trips = 0;
    const empty = () => { coins += t.s.hold.reduce((a, c) => a + c.value, 0); trips += t.s.hold.length / t.st.hold; t.s.hold = []; };
    for (let i = 0; i < casts; i++) { t.cast(place); if (t.s.hold.length >= t.st.hold) empty(); }
    empty();
    const secs = t.s.playTime - t0 + trips * (2 * place.trip + COSTS.sell);
    const r = (coins - t.hooks * baitDef(baitId).price) / secs;
    this.rates.set(key, r);
    return r;
  }

  /** The baits worth thinking about: the free one, anything in the tin, anything on the stall the purse can stand. */
  private baitChoices(): string[] {
    const s = this.s;
    return BAITS.filter((b) => b.price === 0 || (s.gear.baits[b.id] ?? 0) >= 8 || (s.flags.includes('shop-open') && b.price * 20 <= s.coins * 0.5)).map((b) => b.id);
  }

  /** Where to fish and with what: the best coins a second, unless a job wants a particular fish. */
  private plan(): { place: Place; bait: string; want: FishDef | null } {
    const s = this.s, places = this.places();
    const want = this.wantedFish();
    let pool = places;
    if (want) {
      const can = places.filter((p) => want.zones.includes(p.zone(20)) || want.zones.includes(p.zone(5)));
      const at = this.wantedAt();
      if (at) pool = places.filter((p) => p.id === at); else if (can.length && inHours(s.hour, want.hours)) pool = can;
    }
    let best = { place: pool[0], bait: 'breadcrumb', r: -Infinity };
    for (const p of pool) for (const b of this.baitChoices()) {
      let r = this.rate(p, b);
      if (want && inHours(s.hour, want.hours)) r *= baitDef(b).affinity[want.id] ?? 1; // a job fish is worth leaning toward
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
    return o ? fishDef(o.o.fish!) : null;
  }
  private wantedAt(): string | null {
    const o = this.activeObjectives().find((x) => x.o.type === 'catch' && x.o.at);
    return o ? 'teeth' : null;
  }

  // ------------------------------------------------------------------ town

  private sell() {
    const s = this.s;
    if (!s.hold.length && !s.pots.hold.length) return;
    const n = s.hold.length + s.pots.hold.length, pot = s.pots.hold.reduce((a, c) => a + c.value, 0);
    const total = sellAll(s);
    this.totals.coins += total; this.totals.potCoins += pot;
    const b = this.bucket(); b.coins += total; b.pot += pot;
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
        const offer = npcOffer(s, n.id);
        if (offer.kind === 'turnIn') { turnIn(s, offer.quest.id); this.mark(`done: ${offer.quest.title}`); this.pass(COSTS.talk); again = any = true; }
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
    const next = RODS.filter((r) => r.price > 0 && !s.gear.rods.includes(r.id) && r.tier > tier).sort((a, b) => a.price - b.price)[0];
    const asked = this.activeObjectives().some((x) => x.o.type === 'own' && x.o.item === next?.id);
    if (next) out.push({ name: next.name, price: next.price, buy: () => buyRod(s, next.id), goal: true, asked });
    const creel = creelNext(s);
    if (creel) out.push({ name: creel.name, price: creel.price, buy: () => buyCreel(s) });
    for (const l of LURES) if (l.price !== undefined && !s.gear.lures.includes(l.id)) out.push({ name: l.name, price: l.price, buy: () => buyLure(s, l.id) });
    for (const w of WEARABLES) if (w.price !== undefined && !s.gear.wearables.includes(w.id) && !s.gear.worn[w.slot]) out.push({ name: w.name, price: w.price, buy: () => buyWearable(s, w.id) });
    if (s.flags.includes('pots-open') && !this.opts.noPots) {
      const p = potPrice(s);
      if (p !== null) out.push({ name: 'another Lantern Pot', price: p, buy: () => buyPot(s) });
      for (const k of ['speed', 'size', 'quality'] as PotUpgrade[]) { const c = potUpgradeCost(s, k); if (c !== null) out.push({ name: `pots: ${k} ${s.pots.levels[k] + 1}`, price: c, buy: () => upgradePots(s, k), small: true }); }
    }
    const tune = tuneCost(s, s.gear.rod);
    if (tune !== null) out.push({ name: `tune ${s.gear.rod} to ${(s.gear.rodLevels[s.gear.rod] ?? 0) + 1}`, price: tune, buy: () => tuneRod(s, s.gear.rod), small: true });
    return out.sort((a, b) => a.price - b.price);
  }

  private shop() {
    const s = this.s;
    for (let bought = true; bought;) {
      bought = false;
      const list = this.wishlist();
      const goal = list.find((w) => w.goal);
      for (const w of list) {
        // With a better rod still to buy, do not pour coins into the one in hand, and keep other things modest.
        const limit = w.goal ? s.coins : goal ? Math.min(s.coins, goal.price * (goal.asked || w.small ? 0.1 : 0.35)) : w.small ? s.coins * 0.6 : s.coins;
        if (w.price > limit) continue;
        if (w.buy()) { this.mark(`bought ${w.name} (${w.price})`); this.pass(COSTS.buy); this.rates.clear(); bought = true; break; }
      }
    }
    this.refresh();
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
  }

  /** Visits a quest's place if one is waiting. Returns true if an errand was run. */
  private errand(): boolean {
    const s = this.s;
    const v = this.activeObjectives().find((x) => x.o.type === 'visit');
    if (v) {
      const place = v.o.place!;
      this.pass(COSTS.visit[place] ?? 120, place !== 'lighthouse-lamp');
      if (place === 'lighthouse-lamp') { this.chart('gull-point'); if (!s.flags.includes('lamp-lit')) s.flags.push('lamp-lit'); }
      if (place === 'keepers-kettle') this.chart('kettle-isle');
      if (place === 'drowned-bell') this.chart('drowned-belfry');
      onQuestEvent(s, { type: 'visit', place });
      this.mark(`visited ${place}`);
      return true;
    }
    if (!this.explored && s.boats.owned.length) {
      this.explored = true;
      this.pass(COSTS.explore, true);
      this.chart('pips-bar');
      for (const c of this.region().chests ?? []) {
        if (s.flags.includes(`chest:${c.id}`)) continue;
        s.flags.push(`chest:${c.id}`);
        earn(s, c.coins); this.totals.coins += c.coins; this.bucket().coins += c.coins;
        for (const [id, n] of Object.entries(c.items ?? {})) s.gear.baits[id] = (s.gear.baits[id] ?? 0) + n;
        for (const id of c.lures ?? []) grantLure(s, id);
        for (const id of c.wearables ?? []) grantWearable(s, id);
        this.mark(`opened ${c.id}`);
      }
      return true;
    }
    return false;
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
    }
    this.pass(COSTS.ring, true);
    const coins = s.run.coins;
    const t = ringBell(s);
    if (!t) return false;
    onQuestEvent(s, { type: 'ring' });
    this.lastGain = t.echoes;
    this.rings.push({ t: s.playTime, echoes: t.echoes, coins: coins + t.sold });
    this.totals.coins += t.sold; this.bucket().coins += t.sold;
    this.mark(`RANG THE BELL: ${t.echoes} Echoes from ${coins + t.sold} coins`);
    // Spend the Echoes: cheapest first, in the tree's own order.
    for (let bought = true; bought;) {
      bought = false;
      const pick = ECHO_UPGRADES.map((u) => ({ u, c: echoCost(s, u.id) })).filter((x) => x.c !== null && x.c <= s.echoes && !(this.opts.noPots && x.u.effect?.potSlots)).sort((a, b) => a.c! - b.c!)[0];
      if (pick && buyEcho(s, pick.u.id)) { this.mark(`echo: ${pick.u.name} ${s.echoUpgrades[pick.u.id]}`); bought = true; }
    }
    this.pass(COSTS.echoes);
    this.rates.clear(); this.refresh();
    return true;
  }

  // ------------------------------------------------------------------ the day

  /** One outing: town business, then out to fish until the hold is full or a job is done, then home. */
  outing() {
    const s = this.s;
    this.sell();
    this.talk();
    this.shop();
    this.talk(); // a job that wanted something bought is handed in on the spot
    if (this.ring()) return;
    if (this.errand()) return;
    const plan = this.plan();
    this.stock(plan.bait);
    const place = plan.place;
    this.pass(place.trip, place.afloat);
    if (place.chart) this.chart(place.chart);
    // Pots go in beside the fishing, and come up when it is time to go.
    if (!this.opts.noPots) while (potsInHand(s) > 0) {
      const n = s.pots.placed.length;
      if (!placePot(s, place.zone(8), n * 6, s.pots.nextId * 6)) break;
      this.pass(COSTS.pot, true);
    }
    const ready = () => QUESTS.filter((q) => q.chain === 'main' && questStatus(s, q.id) === 'ready').length;
    const before = ready(), until = s.playTime + 12 * 60;
    // Home early when the hold would pay for the next thing wanted (and is worth the walk).
    const next = this.wishlist().find((w) => w.price > s.coins && w.price >= 100);
    const least = place.trip > 20 ? Math.max(6, this.st.hold * 0.6) : 6; // nobody sails home from the Teeth with six fish
    const worth = () => !!next && s.hold.length >= least && s.coins + s.hold.reduce((a, c) => a + c.value, 0) >= next.price;
    const toSell = () => worth() || this.activeObjectives().some((x) => x.o.type === 'sell' && s.hold.length >= objectiveTarget(x.o) - objectiveProgress(s, x.q, x.q.objectives.indexOf(x.o)));
    while (s.hold.length < this.st.hold && ready() === before && !toSell() && s.playTime < until && s.playTime < this.opts.minutes * 60) {
      if (plan.want && !inHours(s.hour, plan.want.hours) !== !inHours(s.hour - 0.01, plan.want.hours)) break;
      this.cast(place);
      this.haul(true);
    }
    this.haul(false);
    this.pass(place.trip, place.afloat);
  }

  /** Brings the pots up: the full ones while fishing beside them, all of them before going home. */
  private haul(fullOnly: boolean) {
    const s = this.s;
    for (const p of s.pots.placed) {
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
void FISH;
