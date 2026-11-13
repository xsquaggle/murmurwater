import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newGame, type GameState } from '../src/core/state';
import {
  CREEL, ECHO_UPGRADES, LURES, POTS, TUNING, WEARABLES, bonuses, buyCreel, buyLure, buyPot, buyRod, buyWearable, claimCollections, creelNext,
  equipLure, fishingContext, potPrice, potUpgradeCost, spendBait, stats, tuneCost, tuneRod, upgradePots, validateGear, wear,
} from '../src/core/gear';
import { FISH, rod } from '../src/core/content';
import { addCatch, catchValue, sellAll } from '../src/core/economy';
import { canPlacePot, haulPot, placePot, potInterval, potTable, potsInHand, potsWaiting, takeUpPot, tickPots } from '../src/core/pots';
import { BELL_FLAG, buyEcho, canRing, echoCost, echoesFor, ringBell, startCoins, turnings } from '../src/core/bell';
import { deserialize, serialize } from '../src/core/save';

const rich = (coins = 1e6): GameState => { const s = newGame(5); s.coins = coins; return s; };
const know = (s: GameState, ...ids: string[]) => { for (const id of ids) s.journal[id] = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 }; };
const c = (over = {}) => ({ fishId: 'butterperch', weight: 0.8, sizeFactor: 1, trait: null, perfectHook: false, cleanCast: false, fightTime: 5, ...over });

describe('gear', () => {
  it('data is valid', () => { expect(validateGear()).toEqual([]); });

  it('a new keeper has the plain numbers', () => {
    const st = stats(newGame(1));
    expect(st.rod).toEqual(rod('driftwood-rod'));
    expect(st).toMatchObject({ biteSpeed: 1, luck: 0, biteWindow: 1, strange: 0.03, value: 1, size: 0, hold: CREEL.base, rhythmCap: 10, potCount: 0, tuneCost: 1 });
  });

  it('tuning makes the rod better, costs more each time and stops at the top', () => {
    const s = rich();
    const costs: number[] = [];
    for (let i = 0; i < TUNING.maxLevel; i++) { costs.push(tuneCost(s, 'driftwood-rod')!); expect(tuneRod(s, 'driftwood-rod')).toBe(true); }
    expect(costs.every((x, i) => i === 0 || x > costs[i - 1])).toBe(true);
    expect(tuneCost(s, 'driftwood-rod')).toBeNull();
    expect(tuneRod(s, 'driftwood-rod')).toBe(false);
    const st = stats(s), base = rod('driftwood-rod');
    expect(st.rod.power).toBeCloseTo(base.power * (1 + TUNING.perLevel.power * 10));
    expect(st.rod.luck).toBeCloseTo(base.luck + TUNING.perLevel.luck * 10);
    expect(tuneCost(s, 'gullwing-rod')).toBeNull(); // not owned
    const poor = newGame(1);
    expect(tuneRod(poor, 'driftwood-rod')).toBe(false);
    expect(poor.gear.rodLevels['driftwood-rod']).toBe(0);
  });

  it('the creel grows the hold and what fish sell for', () => {
    const s = rich();
    const before = catchValue(s, c());
    for (const lvl of CREEL.levels) { expect(creelNext(s)!.slots).toBe(lvl.slots); expect(buyCreel(s)).toBe(true); expect(stats(s).hold).toBe(lvl.slots); }
    expect(creelNext(s)).toBeNull();
    expect(buyCreel(s)).toBe(false);
    expect(catchValue(s, c())).toBeGreaterThan(before);
    expect(stats(s).value).toBeCloseTo(1 + CREEL.levels[CREEL.levels.length - 1].value);
  });

  it('a boat adds its hold', () => {
    const s = newGame(1);
    s.boats.owned = ['skiff']; s.boats.current = 'skiff';
    expect(stats(s).hold).toBe(CREEL.base + 4);
  });

  it('lures are bought once, one is on the line, and some only work at night', () => {
    const s = rich();
    expect(buyLure(s, 'brass-spinner')).toBe(true);
    expect(buyLure(s, 'brass-spinner')).toBe(false);
    expect(buyLure(s, 'tin-minnow')).toBe(false); // found, not sold
    expect(s.gear.lure).toBe('brass-spinner');
    expect(stats(s).size).toBeCloseTo(0.18);
    expect(buyLure(s, 'moth-lure')).toBe(true);
    expect(equipLure(s, 'moth-lure')).toBe(true);
    expect(stats(s, { hour: 12 }).biteSpeed).toBe(1);
    expect(stats(s, { hour: 23 }).biteSpeed).toBeCloseTo(1.3);
    expect(fishingContext(s, { hour: 23 }, () => ({ zoneId: null, depth: 1, hotspot: false })).bait.biteSpeed).toBeCloseTo(1.3);
    expect(equipLure(s, 'tin-minnow')).toBe(false);
    expect(equipLure(s, null)).toBe(true);
    expect(stats(s, { hour: 23 }).biteSpeed).toBe(1);
  });

  it('wearables go in their slots and a set pays for its pieces', () => {
    const s = rich();
    expect(buyWearable(s, 'wool-cap')).toBe(true);
    expect(s.gear.worn.hat).toBe('wool-cap');
    expect(stats(s).biteSpeed).toBeCloseTo(1.05);
    for (const id of ['keepers-souwester', 'keepers-oilskin', 'keepers-boots', 'keepers-whistle']) s.gear.wearables.push(id);
    expect(wear(s, 'keepers-souwester')).toBe(true);
    expect(s.gear.worn.hat).toBe('keepers-souwester');
    expect(bonuses(s).value ?? 0).toBe(0); // one piece: no set bonus
    wear(s, 'keepers-boots');
    expect(bonuses(s).value).toBeCloseTo(0.05);
    wear(s, 'keepers-oilskin'); wear(s, 'keepers-whistle');
    const st = stats(s);
    expect(st.rhythmCap).toBe(12);
    expect(st.value).toBeCloseTo(1 + 0.05 + 0.08);
    expect(st.luck).toBeCloseTo(0.05 + 0.08);
    wear(s, 'keepers-boots'); // off again
    expect(s.gear.worn.boots).toBeNull();
    expect(stats(s).rhythmCap).toBe(10);
    expect(wear(s, 'tar-boots')).toBe(false); // not owned
  });

  it('every priced thing can be bought and every stat it names is real', () => {
    const s = rich();
    for (const l of LURES) if (l.price !== undefined) expect(buyLure(s, l.id), l.id).toBe(true);
    for (const w of WEARABLES) if (w.price !== undefined) expect(buyWearable(s, w.id), w.id).toBe(true);
    expect(buyRod(s, 'harbour-rod')).toBe(true);
    expect(s.gear.rod).toBe('harbour-rod');
    expect(buyRod(s, 'harbour-rod')).toBe(false);
  });

  it('bait is used up a hook at a time and falls back to breadcrumbs', () => {
    const s = newGame(1);
    expect(spendBait(s)).toBeNull(); // breadcrumbs never run out
    s.gear.baits.sandworm = 2; s.gear.bait = 'sandworm';
    expect(spendBait(s)).toBeNull();
    expect(spendBait(s)).toBe('sandworm');
    expect(s.gear.bait).toBe('breadcrumb');
    expect(s.gear.baits.sandworm).toBeUndefined();
  });

  it('a full journal page hands over its reward once', () => {
    const s = newGame(1);
    know(s, ...FISH.filter((f) => f.region === 'hearthbay' && f.rarity !== 'uncanny').slice(1).map((f) => f.id));
    expect(claimCollections(s)).toEqual([]);
    know(s, FISH[0].id);
    expect(claimCollections(s).map((x) => x.id)).toEqual(['hearthbay-page']);
    expect(s.gear.wearables).toContain('keepers-oilskin');
    expect(s.gear.worn.coat).toBe('keepers-oilskin');
    expect(claimCollections(s)).toEqual([]);
  });
});

describe('lantern pots', () => {
  const withPot = () => { const s = newGame(9); s.pots.owned = 1; know(s, 'butterperch', 'pebble-goby', 'coral-snapper'); return s; };

  it('fill on play time only, stop when full, and are hauled into their own hold', () => {
    const s = withPot();
    const st = stats(s);
    expect(placePot(s, 'hb-dock', -120, 30)).not.toBeNull();
    expect(potsInHand(s)).toBe(0);
    expect(tickPots(s, potInterval(st) - 1, 12)).toBe(0);
    expect(tickPots(s, 2, 12)).toBe(1);
    // No clock but the one the game runs: saving, waiting and loading adds nothing.
    const later = deserialize(serialize(s));
    expect(later.pots.placed[0].fish.length).toBe(1);
    expect(tickPots(later, 0, 12)).toBe(0);
    expect(tickPots(s, 3600, 12)).toBe(st.potCapacity - 1);
    expect(potsWaiting(s)).toEqual({ fish: st.potCapacity, room: st.potCapacity });
    expect(tickPots(s, 3600, 12)).toBe(0);
    const got = haulPot(s, s.pots.placed[0].id);
    expect(got.length).toBe(st.potCapacity);
    expect(s.hold.length).toBe(0);
    expect(s.pots.hold.length).toBe(st.potCapacity);
    const total = sellAll(s);
    expect(total).toBe(got.reduce((a, x) => a + x.value, 0));
    expect(s.pots.hold.length).toBe(0);
  });

  it('only trap fish the journal knows, of their zone, at their hour, and never the Uncanny', () => {
    const s = withPot();
    know(s, 'lampjaw', 'manyeye', 'twofold-flounder');
    s.flags.push('hb-lighthouse-lit');
    const pot = placePot(s, 'hb-dock', -120, 30)!;
    expect(potTable(s, pot, 12).map((f) => f.id).sort()).toEqual(['butterperch', 'coral-snapper', 'pebble-goby']);
    expect(potTable(s, pot, 23).map((f) => f.id)).toContain('lampjaw');
    const empty = newGame(3); empty.pots.owned = 1;
    placePot(empty, 'hb-dock', 0, 0);
    expect(tickPots(empty, 10000, 12)).toBe(0); // nothing in the journal, nothing in the pot
  });

  it('pot fish are worth less than the same fish on a line', () => {
    const s = withPot();
    placePot(s, 'hb-dock', -120, 30);
    tickPots(s, 100000, 12);
    for (const f of s.pots.placed[0].fish) expect(f.value).toBeLessThanOrEqual(Math.ceil(catchValue(s, c({ fishId: f.fishId, sizeFactor: 1.35 })) * POTS.value));
  });

  it('cannot be stacked, can be taken up, and more can be bought once Mara sells them', () => {
    const s = withPot(); s.coins = 1e6;
    placePot(s, 'hb-dock', 0, 0);
    expect(canPlacePot(s, 0, 0)).toBe(false);
    expect(potPrice(s)).toBe(POTS.prices[0]);
    expect(buyPot(s)).toBe(true);
    expect(canPlacePot(s, 1, 1)).toBe(false); // too close to the first
    expect(placePot(s, 'hb-dock', 20, 0)).not.toBeNull();
    while (potPrice(s) !== null) expect(buyPot(s)).toBe(true);
    expect(s.pots.owned).toBe(POTS.maxOwned);
    tickPots(s, 500, 12);
    const id = s.pots.placed[0].id, had = s.pots.placed[0].fish.length;
    expect(takeUpPot(s, id)).toBe(true);
    expect(s.pots.hold.length).toBe(had);
    expect(potsInHand(s)).toBe(2);
    const none = newGame(1);
    expect(potPrice(none)).toBeNull(); // the first pot is a gift
    expect(upgradePots(none, 'speed')).toBe(false);
  });

  it('upgrades make them faster, deeper and better paid', () => {
    const s = withPot(); s.coins = 1e6;
    const a = stats(s);
    for (const k of ['speed', 'size', 'quality'] as const) { expect(potUpgradeCost(s, k)).toBeGreaterThan(0); expect(upgradePots(s, k)).toBe(true); }
    const b = stats(s);
    expect(potInterval(b)).toBeLessThan(potInterval(a));
    expect(b.potCapacity).toBe(a.potCapacity + 1);
    expect(b.potValue).toBeGreaterThan(a.potValue);
    for (const k of ['speed', 'size', 'quality'] as const) { while (potUpgradeCost(s, k) !== null) upgradePots(s, k); expect(s.pots.levels[k]).toBe(POTS.upgrades[k].max); }
  });
});

describe('the Drowned Bell', () => {
  const ready = () => {
    const s = newGame(11);
    s.flags.push(BELL_FLAG);
    s.lifetime.coins = 10000; s.run.coins = 10000; s.coins = 700; s.playTime = 5000;
    return s;
  };

  it('cannot be rung before it is found or for nothing', () => {
    const s = newGame(1);
    s.lifetime.coins = 10000;
    expect(canRing(s)).toBe(false);
    s.flags.push(BELL_FLAG);
    expect(canRing(s)).toBe(true);
    const poor = newGame(2); poor.flags.push(BELL_FLAG);
    expect(echoesFor(poor)).toBe(0);
    expect(ringBell(poor)).toBeNull();
  });

  it('pays Echoes for everything ever earned, once, however often it is rung', () => {
    const s = ready();
    expect(echoesFor(s)).toBe(15);
    expect(ringBell(s)!.echoes).toBe(15);
    expect(echoesFor(s)).toBe(0); // nothing new earned: nothing more to have
    s.lifetime.coins = 40000;
    expect(echoesFor(s)).toBe(15);
    // Two ringings on the way pay the same in total as one at the end.
    const one = ready(); one.lifetime.coins = 40000;
    expect(ringBell(one)!.echoes).toBe(30);
  });

  it('sells the catch first, then forgets what coins bought and keeps the rest', () => {
    const s = ready();
    s.gear.rods.push('gullwing-rod'); s.gear.rod = 'gullwing-rod'; s.gear.rodLevels = { 'driftwood-rod': 2, 'gullwing-rod': 4 };
    s.gear.baits.sandworm = 30; s.gear.bait = 'sandworm'; s.gear.creel = 3;
    s.gear.lures = ['brass-spinner']; s.gear.lure = 'brass-spinner';
    s.gear.wearables = ['wool-cap']; s.gear.worn.hat = 'wool-cap';
    s.boats = { owned: ['skiff'], current: 'skiff', upgrades: { x: 1 }, at: { x: -300, z: -200, heading: 0 } };
    s.world.onBoat = true; s.world.pos = [-300, 0.2, -200]; s.world.charted.push('the-teeth');
    s.relics.push('keepers-kettle'); s.quests.done.push('hb-01-salt'); s.moonpearls = 2;
    know(s, 'butterperch');
    s.pots.owned = 2; s.pots.levels = { speed: 2, size: 1, quality: 1 };
    placePot(s, 'hb-dock', 0, 0);
    tickPots(s, 1000, 12);
    addCatch(s, c());
    s.rhythm = 7;
    s.quests.board.quests.push({ id: 'b', title: 't', objective: { type: 'sell', count: 5, label: 'x' }, reward: { coins: 5 }, accepted: true, progress: 1, done: false });
    const worth = s.hold[0].value + s.pots.placed[0].fish.reduce((a, x) => a + x.value, 0);
    const offered = echoesFor(s);
    const t = ringBell(s)!;
    expect(t.sold).toBe(worth);
    expect(t.echoes).toBe(offered);
    expect(t.turning).toBe(1);
    expect(turnings(s)).toBe(1);
    expect(s.echoes).toBe(offered);
    // Forgotten.
    expect(s.coins).toBe(0);
    expect(s.gear.rodLevels).toEqual({ 'driftwood-rod': 0, 'gullwing-rod': 0 });
    expect(s.gear.baits).toEqual({ breadcrumb: Infinity });
    expect(s.gear.bait).toBe('breadcrumb');
    expect(s.gear.creel).toBe(0);
    expect(s.pots.placed).toEqual([]); expect(s.pots.hold).toEqual([]); expect(s.pots.levels).toEqual({ speed: 0, size: 0, quality: 0 });
    expect(s.hold).toEqual([]);
    expect(s.boats.upgrades).toEqual({}); expect(s.boats.at).toBeNull();
    expect(s.quests.board.quests).toEqual([]);
    expect(s.rhythm).toBe(0);
    expect(s.run).toEqual({ number: 2, coins: 0, startedAt: 5000 });
    expect(s.world.onBoat).toBe(false);
    expect(s.world.pos).toEqual(newGame(1).world.pos);
    // Kept.
    expect(s.gear.rods).toContain('gullwing-rod'); expect(s.gear.rod).toBe('gullwing-rod');
    expect(s.gear.lures).toEqual(['brass-spinner']); expect(s.gear.worn.hat).toBe('wool-cap');
    expect(s.boats.owned).toEqual(['skiff']); expect(s.pots.owned).toBe(2);
    expect(s.relics).toEqual(['keepers-kettle']); expect(s.quests.done).toEqual(['hb-01-salt']); expect(s.moonpearls).toBe(2);
    expect(s.journal['butterperch'].caught).toBe(2);
    expect(s.world.charted).toContain('the-teeth');
    expect(s.lifetime.coins).toBe(10000 + worth);
  });

  it('Echoes buy ranks that cost more each time and stay through a ringing', () => {
    const s = ready();
    s.echoes = 1000;
    for (const u of ECHO_UPGRADES) {
      for (let i = 0; i < u.cost.length; i++) { expect(echoCost(s, u.id)).toBe(u.cost[i]); expect(buyEcho(s, u.id)).toBe(true); }
      expect(echoCost(s, u.id)).toBeNull();
      expect(buyEcho(s, u.id)).toBe(false);
    }
    const st = stats(s);
    expect(st.value).toBeCloseTo(1 + 10 * 0.15);
    expect(st.rhythmCap).toBe(20);
    expect(st.potCount).toBe(3);
    expect(st.tuneCost).toBeCloseTo(0.6);
    expect(startCoins(s)).toBe(5000);
    s.lifetime.coins = 1e6;
    ringBell(s);
    expect(s.coins).toBe(5000);
    expect(stats(s).value).toBeCloseTo(2.5);
    const broke = ready(); broke.echoes = 0;
    expect(buyEcho(broke, 'tidewise')).toBe(false);
  });
});

describe('save version 4', () => {
  it('a v3 save gets a hold from its gear, the pots and the new counters', () => {
    const st = deserialize(readFileSync(join(__dirname, 'fixtures', 'saves', 'v3.json'), 'utf8'));
    expect((st as unknown as { holdCapacity?: number }).holdCapacity).toBeUndefined();
    expect(stats(st).hold).toBe(CREEL.base + 4); // the skiff's hold
    expect(st.pots).toEqual({ owned: 0, placed: [], hold: [], levels: { speed: 0, size: 0, quality: 0 }, nextId: 1 });
    expect(st.gear.creel).toBe(0);
    expect(st.lifetime.echoes).toBe(0);
    expect(st.coins).toBe(1530);
  });
  it('a v4 save keeps its gear, its pots and its Echoes', () => {
    const st = deserialize(readFileSync(join(__dirname, 'fixtures', 'saves', 'v4.json'), 'utf8'));
    expect(st.gear.creel).toBe(2);
    expect(st.gear.worn).toMatchObject({ hat: 'wool-cap', boots: 'keepers-boots' });
    expect(st.pots.placed[0].fish[0].fishId).toBe('butterperch');
    expect(st.pots.levels.quality).toBe(2);
    expect(st.echoUpgrades).toEqual({ tidewise: 2 });
    expect(st.lifetime.echoes).toBe(7);
    expect(st.run.number).toBe(2);
  });
});
