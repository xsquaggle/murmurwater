import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { newGame, SAVE_VERSION, type GameState } from '../src/core/state';
import {
  CREW, CREW_BY_ID, FOG_ENOUGH, aboard, ashore, basket, basketFull, basketSize, berthFor, berthIn, berths, crewKnows, crewProgress, crewTable, hire, isAboard, signedOn, spotting,
  crewKit, crewOdds, tickCrew, validateCrew, working, type CrewEnv,
} from '../src/core/crew';
import { MAX_FRAME, frameTime } from '../src/core/clock';
import { FISH, RARITIES, fish } from '../src/core/content';
import { boatOnOffer, buyBoat, stats, takeBoat } from '../src/core/gear';
import { sellAll } from '../src/core/economy';
import { BELL_FLAG, echoesFor, ringBell, unsoldValue } from '../src/core/bell';
import { BOATS_BY_ID, QUESTS_BY_ID, accept, count, currentGoal, describeRewards, objectiveProgress, questStatus, turnIn } from '../src/core/quests';
import { deserialize, serialize } from '../src/core/save';

const know = (s: GameState, ...ids: string[]) => { for (const id of ids) s.journal[id] = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 }; };
const withSkiff = (seed = 5): GameState => { const s = newGame(seed); s.boats.owned = ['skiff']; s.boats.current = 'skiff'; return s; };
const withPuffin = (seed = 5): GameState => { const s = withSkiff(seed); s.boats.owned.push('puffin'); s.boats.current = 'puffin'; return s; };
const bay = (over: Partial<CrewEnv> = {}): CrewEnv => ({ region: 'hearthbay', zone: 'hb-bay', hour: 12, fog: 0, still: true, ...over });
const fen = (over: Partial<CrewEnv> = {}): CrewEnv => ({ region: 'mossglass-fen', zone: 'fen-grove', hour: 23, fog: 0, still: true, ...over });
const BISCUIT = CREW_BY_ID.get('biscuit')!, HOLLIS = CREW_BY_ID.get('hollis')!;
const SKIFF_BASKET = BOATS_BY_ID.get('skiff')!.crewHold, PUFFIN_BASKET = BOATS_BY_ID.get('puffin')!.crewHold;
/** Lets `secs` of play go by in one-second steps, emptying the basket as it fills. Returns everything caught. */
const run = (s: GameState, secs: number, env: CrewEnv, empty = true) => {
  const got = [];
  for (let t = 0; t < secs; t++) { got.push(...tickCrew(s, 1, env, crewKit(stats(s)))); if (empty && basket(s).full) s.crew.hold = []; }
  return got;
};

describe('deckhands', () => {
  it('data is valid: nobody brings up the best fish, and nobody is worth what the keeper is', () => {
    expect(validateCrew()).toEqual([]);
    expect(CREW.map((c) => c.id)).toEqual(['biscuit', 'hollis']);
    for (const c of CREW) { expect(c.value).toBeLessThanOrEqual(0.7); expect(c.interval).toBeGreaterThanOrEqual(30); }
    // The cat fishes on her own account; Mister Hollis borrows the keeper's luck.
    expect([BISCUIT.luck, HOLLIS.luck]).toEqual([0, 1]);
  });

  it('berths come with the boat: none ashore, one in the skiff, two in the Puffin', () => {
    const s = newGame(1);
    expect(berths(s)).toBe(0); expect(basketSize(s)).toBe(0);
    hire(s, 'biscuit');
    expect(aboard(s)).toEqual([]);
    expect(tickCrew(s, 600, bay(), { value: 1, luck: 0 })).toEqual([]);
    s.boats.owned = ['skiff']; s.boats.current = 'skiff';
    expect(berths(s)).toBe(1); expect(basketSize(s)).toBe(SKIFF_BASKET);
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit']);
    hire(s, 'hollis');
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit']);
    expect(ashore(s).map((c) => c.id)).toEqual(['hollis']);
    expect(berthFor(s, 'hollis')).toBe(false);
    s.boats.owned.push('puffin'); s.boats.current = 'puffin';
    expect(berths(s)).toBe(2); expect(basketSize(s)).toBe(PUFFIN_BASKET);
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit', 'hollis']);
    expect(isAboard(s, 'hollis')).toBe(true);
    // Signing on twice, or somebody who does not exist, does nothing.
    expect(hire(s, 'biscuit')).toBe(false); expect(hire(s, 'nobody')).toBe(false);
    expect(s.crew.hired).toEqual(['biscuit', 'hollis']);
  });

  it('each hand has a berth of their own: the cat her perch, Mister Hollis the bench, whoever else is aboard', () => {
    expect([BISCUIT.berth, HOLLIS.berth]).toEqual([0, 1]);
    // The skiff has the perch and no bench: with no cat at all he is still ashore in her, and his berth in the
    // Puffin is the bench, not the cuddy roof.
    const s = withSkiff();
    hire(s, 'hollis');
    expect(berthIn('skiff', HOLLIS)).toBe(false); expect(berthIn('puffin', HOLLIS)).toBe(true); expect(berthIn(null, BISCUIT)).toBe(false);
    expect(aboard(s)).toEqual([]);
    expect(ashore(s).map((c) => c.id)).toEqual(['hollis']);
    expect(isAboard(s, 'hollis')).toBe(false);
    // Signed on is signed on: he is at the boatyard, not back where he used to wait.
    expect(signedOn(s, 'hollis')).toBe(true); expect(signedOn(s, 'biscuit')).toBe(false);
    know(s, ...FISH.filter((f) => f.region === 'mossglass-fen').map((f) => f.id));
    expect(tickCrew(s, 600, fen(), { value: 1, luck: 0 })).toEqual([]);
    // The cat signing on later changes nothing for him, in either boat.
    hire(s, 'biscuit');
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit']);
    s.boats.owned.push('puffin'); s.boats.current = 'puffin';
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit', 'hollis']);
    // Somebody who has not signed on is not aboard, berth or no berth.
    expect(berthFor(s, 'hollis')).toBe(true);
    s.crew.hired = ['biscuit'];
    expect(isAboard(s, 'hollis')).toBe(false);
  });

  it('a hand whose clock comes due where the journal knows nothing waits half the time again, not the whole of it', () => {
    const s = withSkiff();
    hire(s, 'biscuit'); know(s, 'butterperch');
    run(s, BISCUIT.interval - 1, bay());
    expect(s.crew.clocks.biscuit.t).toBe(BISCUIT.interval - 1);
    // Due, over water she knows nothing of (the zone of a water just left, say): nothing comes up...
    expect(run(s, 1, bay({ zone: 'no-such-zone' }))).toEqual([]);
    expect(s.crew.clocks.biscuit.t).toBe(BISCUIT.interval / 2);
    expect(s.crew.clocks.biscuit.n).toBe(0);
    // ...and back over her own water the fish is half an interval off, not a whole one.
    expect(run(s, BISCUIT.interval / 2 - 1, bay())).toEqual([]);
    expect(run(s, 1, bay()).length).toBe(1);
  });

  it('a hand fishes only while the boat lies still, and only fish the journal knows from the water under her', () => {
    const s = withSkiff();
    hire(s, 'biscuit');
    // Nothing in the journal: nothing to copy.
    expect(run(s, 600, bay())).toEqual([]);
    expect(crewKnows(s, BISCUIT, 'hearthbay', 'hb-bay')).toBe(0);
    know(s, 'butterperch', 'kettle-carp', 'moss-eel', 'twofold-flounder');
    expect(crewKnows(s, BISCUIT, 'hearthbay', 'hb-bay')).toBe(2);
    // Under way: nothing, and the clock does not move.
    expect(run(s, 600, bay({ still: false }))).toEqual([]);
    expect(crewProgress(s, BISCUIT)).toBeLessThanOrEqual(0.5);
    const head = crewProgress(s, BISCUIT) * BISCUIT.interval;
    const got = run(s, 4000, bay());
    expect(got.length).toBe(Math.floor((4000 + head) / BISCUIT.interval));
    // Common and uncommon only: never the eel (rare) though it is known and lives here, never the flounder (not this water).
    expect(new Set(got.map((c) => c.fishId))).toEqual(new Set(['butterperch', 'kettle-carp']));
    for (const c of got) if (c.item) { expect(c.item.trait).toBeNull(); expect(c.item.perfect).toBe(false); }
    // The journal is not written by the crew.
    expect(s.journal.butterperch.caught).toBe(1);
    expect(s.lifetime.catches).toBe(0);
    // With no zone given she fishes the region's open water, never "everywhere".
    expect(crewTable(s, BISCUIT, { region: 'hearthbay', zone: null, hour: 12 }).map((f) => f.id).sort()).toEqual(['butterperch', 'kettle-carp']);
    know(s, 'pebble-goby'); // dock and bay only
    expect(crewTable(s, BISCUIT, { region: 'hearthbay', zone: null, hour: 12 }).map((f) => f.id)).not.toContain('pebble-goby');
    // A fish that keeps hours is brought up only in its hours.
    know(s, 'lampjaw');
    expect(crewTable(s, BISCUIT, bay({ hour: 12 })).map((f) => f.id)).not.toContain('lampjaw');
    expect(crewTable(s, BISCUIT, bay({ hour: 22 })).map((f) => f.id)).toContain('lampjaw');
  });

  it('Biscuit eats every fourth fish, and hers are small and sell for half', () => {
    const s = withSkiff();
    hire(s, 'biscuit'); know(s, 'butterperch', 'kettle-carp', 'coral-snapper');
    const got = run(s, BISCUIT.interval * 400, bay());
    expect(got.length).toBe(400);
    expect(got.filter((c) => c.eaten).length).toBe(100);
    got.forEach((c, i) => { expect(c.eaten, `fish ${i + 1}`).toBe((i + 1) % 4 === 0); expect(c.item === null).toBe(c.eaten); });
    expect(s.crew.tally.biscuit).toMatchObject({ fish: 300, eaten: 100 });
    const kept = got.filter((c) => c.item).map((c) => c.item!);
    expect(s.crew.tally.biscuit.coins).toBe(kept.reduce((a, c) => a + c.value, 0));
    // Worth: never more than half of the best the same fish could fetch by hand, and on average well under half of an ordinary one.
    for (const c of kept) expect(c.value).toBeLessThanOrEqual(Math.max(1, Math.round(fish(c.fishId).baseValue * 1.35 * 0.5)));
    const mean = (id: string) => { const xs = kept.filter((c) => c.fishId === id); return xs.reduce((a, c) => a + c.value, 0) / xs.length; };
    expect(mean('coral-snapper')).toBeLessThan(fish('coral-snapper').baseValue * 0.5);
    // Common fish far more often than uncommon, as on a rod.
    expect(kept.filter((c) => c.fishId === 'coral-snapper').length).toBeLessThan(kept.length * 0.4);
    expect(kept.filter((c) => c.fishId === 'coral-snapper').length).toBeGreaterThan(kept.length * 0.1);
  });

  it('the basket stops them when it is full, and selling empties it', () => {
    const s = withSkiff();
    hire(s, 'biscuit'); know(s, 'butterperch');
    run(s, 3600, bay(), false);
    expect(s.crew.hold.length).toBe(SKIFF_BASKET);
    expect(basket(s)).toMatchObject({ fish: SKIFF_BASKET, room: SKIFF_BASKET, full: true });
    expect(basketFull(s)).toBe(true);
    const n = s.crew.clocks.biscuit.n;
    expect(run(s, 3600, bay(), false)).toEqual([]);
    expect(s.crew.clocks.biscuit.n).toBe(n);
    // Full, she is no more than one fish ahead when there is room again.
    expect(s.crew.clocks.biscuit.t).toBeLessThanOrEqual(BISCUIT.interval);
    const worth = basket(s).value, before = s.coins;
    expect(unsoldValue(s)).toBe(worth);
    expect(sellAll(s)).toBe(worth);
    expect(s.coins).toBe(before + worth);
    expect(s.crew.hold).toEqual([]);
    expect(run(s, BISCUIT.interval + 1, bay(), false).length).toBe(1);
  });

  it('nothing is earned while the game is closed', () => {
    // A save made years ago loads as it was saved (the load reads no clock: this one is long past whenever the test runs).
    const s = withSkiff();
    hire(s, 'biscuit'); know(s, 'butterperch');
    run(s, 100, bay(), false);
    const text = serialize(s, new Date('2020-01-01T00:00:00Z'));
    const back = deserialize(text);
    expect(back.crew).toEqual(s.crew);
    expect(back.playTime).toBe(s.playTime); expect(back.hour).toBe(s.hour); expect(back.coins).toBe(s.coins);
    expect(serialize(back, new Date('2026-11-23T00:00:00Z')).replace(/"savedAt":"[^"]+"/, '')).toBe(text.replace(/"savedAt":"[^"]+"/, ''));
    // The open game's clock: a frame is worth a tenth of a second at most, however long the window was away.
    expect(MAX_FRAME).toBeLessThanOrEqual(0.1);
    for (const away of [0.5, 3600, 7 * 24 * 3600]) expect(frameTime(away)).toBe(MAX_FRAME);
    expect(frameTime(1 / 60)).toBeCloseTo(1 / 60); expect(frameTime(-5)).toBe(0);
    // And nothing that runs the game reads the wall clock, or the hour a save was made: play time comes from frames
    // alone. (The save file's stamp is written in save.ts and read by nobody; a new game's seed is the only other clock.)
    const src = join(__dirname, '..', 'src');
    // The lines that may: the stamp written into a save and onto a file kept aside, and the seed of a new game.
    const allowed: Record<string, RegExp> = {
      'core/save.ts': /^ \* Versioned saves\. Format on disk|^export function serialize\(state: GameState, now = new Date\(\)\)|savedAt: now\.toISOString\(\)|const stamp = Date\.now\(\);$/,
      'core/state.ts': /^export function newGame\(seed = Date\.now\(\) % 1_000_000\)/,
    };
    let read = 0, let_off = 0;
    for (const dir of ['core', 'game']) for (const f of readdirSync(join(src, dir)).filter((n) => n.endsWith('.ts'))) {
      const name = `${dir}/${f}`, ok = allowed[name];
      for (const line of readFileSync(join(src, dir, f), 'utf8').split('\n')) {
        if (ok?.test(line)) { let_off++; continue; }
        expect(line, `${name} reads a clock that runs while the game is closed`).not.toMatch(/savedAt|Date\.now|new Date|toISOString|getTime\(/);
      }
      read++;
    }
    expect(read).toBeGreaterThan(20);
    expect(let_off).toBe(5);
    expect(readFileSync(join(src, 'game', 'game.ts'), 'utf8')).toContain('const dt = frameTime(real);');
  });

  it('Mister Hollis fishes only after dark or in fog, up to epic fish, with rare ones as likely as on a rod', () => {
    const s = withPuffin();
    hire(s, 'hollis');
    know(s, ...FISH.filter((f) => f.region === 'mossglass-fen').map((f) => f.id));
    s.flags.push('fen-heard');
    expect(working(HOLLIS, fen({ hour: 12 }))).toBe(false);
    expect(working(HOLLIS, fen({ hour: 12, fog: FOG_ENOUGH }))).toBe(true);
    expect(working(HOLLIS, fen({ hour: 23 }))).toBe(true);
    expect(working(HOLLIS, fen({ hour: 23, still: false }))).toBe(false);
    expect(run(s, 3000, fen({ hour: 12 }))).toEqual([]);
    expect(s.crew.clocks.hollis?.t ?? 0).toBe(0);
    // By day in the fog he is himself.
    expect(run(s, HOLLIS.interval * 20, fen({ hour: 12, fog: 0.6 })).length).toBe(20);
    // Whatever the water, never a legendary fish and never the Uncanny, though the journal knows them.
    for (const zone of ['fen-glass', 'fen-post', 'fen-sump', 'fen-grove']) for (const hour of [1, 23]) {
      for (const f of crewTable(s, HOLLIS, fen({ zone, hour }))) expect(RARITIES.indexOf(f.rarity), `${f.id} in ${zone}`).toBeLessThanOrEqual(RARITIES.indexOf('epic'));
    }
    expect(crewTable(s, HOLLIS, fen({ zone: 'fen-sump' })).map((f) => f.id)).toContain('bottomless-eel');
    const rareShare = (st: GameState) => {
      const got = run(st, HOLLIS.interval * 600, fen());
      expect(got.length).toBe(600);
      expect(got.every((c) => !c.eaten && c.item)).toBe(true);
      for (const c of got) expect(c.item!.value).toBeLessThanOrEqual(Math.round(fish(c.fishId).baseValue * 1.35 * HOLLIS.value * stats(st).value));
      return got.filter((c) => fish(c.fishId).rarity === 'rare').length / got.length;
    };
    // Among the Standing Trees at night: mudlark (common), tench (uncommon), glowbelly and stilt-gar (rare).
    // With the plain driftwood rod (no luck at all) a rare fish comes as often as the table says: 19 in 105.
    const plain = rareShare(s);
    expect(plain).toBeGreaterThan(0.12);
    expect(plain).toBeLessThan(0.25);
    // He borrows the keeper's luck: with a lucky rod in the boat the rare ones come to him oftener, as they do to her.
    const lucky = structuredClone(s); lucky.crew = { hired: ['hollis'], hold: [], clocks: {}, tally: {} };
    lucky.gear.rods.push('fenwood-rod'); lucky.gear.rod = 'fenwood-rod'; lucky.gear.rodLevels['fenwood-rod'] = 0;
    expect(crewKit(stats(lucky)).luck).toBeGreaterThan(0.5);
    expect(rareShare(lucky)).toBeGreaterThan(plain * 1.5);
    // The cat does not: her odds are the table's whatever the keeper carries.
    const table = crewTable(lucky, HOLLIS, fen());
    expect(table.map(crewOdds(BISCUIT, 2))).toEqual(table.map(crewOdds(BISCUIT, 0)));
    expect(crewOdds(HOLLIS, 1)(fish('glowbelly')) / crewOdds(HOLLIS, 0)(fish('glowbelly'))).toBeCloseTo(4);
  });

  it('two hands share one basket, and each keeps a clock and a tally of their own', () => {
    const s = withPuffin();
    hire(s, 'biscuit'); hire(s, 'hollis');
    know(s, 'reedling', 'mudlark', 'sedge-pike', 'stilt-gar');
    const got = run(s, 190, { region: 'mossglass-fen', zone: 'fen-reeds', hour: 23, fog: 0, still: true }, false);
    const cats = Math.floor(190 / BISCUIT.interval), his = Math.floor(190 / HOLLIS.interval);
    expect(got.filter((c) => c.who === 'biscuit').length).toBe(cats);
    expect(got.filter((c) => c.who === 'hollis').length).toBe(his);
    // The cat's less the ones she ate, and all of Mister Hollis's.
    expect(s.crew.hold.length).toBe(cats - Math.floor(cats / BISCUIT.eatsEvery) + his);
    // Left long enough they fill it between them and stop.
    run(s, 3000, { region: 'mossglass-fen', zone: 'fen-reeds', hour: 23, fog: 0, still: true }, false);
    expect(s.crew.hold.length).toBe(PUFFIN_BASKET);
    expect(s.crew.tally.biscuit.fish + s.crew.tally.hollis.fish).toBe(s.crew.hold.length);
    expect(new Set(s.crew.hold.map((c) => c.uid)).size).toBe(s.crew.hold.length);
  });

  it('with the cat watching the water the keeper has longer to strike, but only from the boat', () => {
    const s = withSkiff();
    const base = stats(s, { afloat: true }).biteWindow;
    hire(s, 'biscuit');
    expect(spotting(s)).toBeCloseTo(0.15);
    expect(stats(s, { afloat: true }).biteWindow).toBeCloseTo(base + 0.15);
    expect(stats(s, { afloat: false }).biteWindow).toBeCloseTo(base);
    // Not aboard, not watching: with no boat in the water she has no berth.
    s.boats.current = null;
    expect(stats(s, { afloat: true }).biteWindow).toBeCloseTo(base);
  });

  it('the Bell sells the basket, counts it toward the Echoes, and leaves the crew and the boats aboard', () => {
    const s = withPuffin();
    s.flags.push(BELL_FLAG); s.lifetime.coins = 40000;
    hire(s, 'biscuit'); hire(s, 'hollis'); know(s, 'butterperch');
    run(s, 300, bay(), false);
    const worth = basket(s).value;
    expect(worth).toBeGreaterThan(0);
    const offered = echoesFor(s);
    const t = ringBell(s)!;
    expect(t.sold).toBe(worth);
    expect(t.echoes).toBe(offered);
    expect(s.crew.hold).toEqual([]);
    expect(s.crew.hired).toEqual(['biscuit', 'hollis']);
    expect(s.boats.owned).toEqual(['skiff', 'puffin']);
    expect(s.boats.current).toBe('puffin');
    expect(s.crew.clocks.biscuit.t).toBe(0);
    expect(s.crew.tally.biscuit.fish).toBeGreaterThan(0);
  });
});

describe('the second boat', () => {
  it('the Puffin is bigger, faster, slower to turn and deeper than the skiff', () => {
    const a = BOATS_BY_ID.get('skiff')!, b = BOATS_BY_ID.get('puffin')!;
    expect(b.speed).toBeGreaterThan(a.speed * 1.25);
    expect(b.turn).toBeLessThan(a.turn);
    expect(b.hold).toBe(a.hold + 10);
    expect(b.draft).toBeGreaterThan(a.draft);
    expect([a.crew, b.crew]).toEqual([1, 2]);
    expect(b.crewHold).toBeGreaterThan(a.crewHold);
  });

  it('she is for sale only once Pell has offered, costs what he said, and the skiff is kept', () => {
    const s = withSkiff();
    s.coins = 1e6;
    expect(boatOnOffer(s, 'puffin')).toBe(false);
    expect(buyBoat(s, 'puffin')).toBe(false);
    s.flags.push('boatyard-open');
    expect(boatOnOffer(s, 'puffin')).toBe(true);
    const price = BOATS_BY_ID.get('puffin')!.price;
    s.coins = price - 1;
    expect(buyBoat(s, 'puffin')).toBe(false);
    s.coins = price + 6000; s.boats.at = { x: 1, z: 2, heading: 0 };
    const hold = stats(s).hold;
    expect(buyBoat(s, 'puffin')).toBe(true);
    expect(s.coins).toBe(6000);
    expect(s.boats.owned).toEqual(['skiff', 'puffin']);
    expect(s.boats.current).toBe('puffin');
    expect(s.boats.at).toBeNull(); // the game puts her at the mooring
    expect(s.flags).toContain('puffin-afloat');
    expect(stats(s).hold).toBe(hold + 10);
    expect(buyBoat(s, 'puffin')).toBe(false);
    expect(boatOnOffer(s, 'skiff')).toBe(false); // never for sale
    // Changing boats: only to one that is owned, and never to the one already under her.
    expect(takeBoat(s, 'puffin')).toBe(false);
    expect(takeBoat(s, 'dinghy')).toBe(false);
    expect(takeBoat(s, 'skiff')).toBe(true);
    expect(s.boats.current).toBe('skiff');
    expect(stats(s).hold).toBe(hold);
  });

  it('a crew basket fuller than the smaller boat holds is kept when the keeper changes down, and simply takes no more', () => {
    const s = withPuffin();
    hire(s, 'biscuit'); know(s, 'butterperch');
    run(s, 3600, bay(), false);
    expect(s.crew.hold.length).toBe(PUFFIN_BASKET);
    takeBoat(s, 'skiff');
    expect(s.crew.hold.length).toBe(PUFFIN_BASKET);
    expect(run(s, 600, bay(), false)).toEqual([]);
    expect(basket(s).full).toBe(true);
  });
});

describe('the jobs that bring them aboard', () => {
  const done = (s: GameState, ...ids: string[]) => { for (const id of ids) if (!s.quests.done.includes(id)) s.quests.done.push(id); };

  it("Wick's job signs the cat on", () => {
    const s = withSkiff();
    done(s, 'hb-01-salt', 'hb-08-teeth');
    expect(questStatus(s, 'hb-s1-cat')).toBe('locked'); // not before the pots
    done(s, 'hb-p1-pots');
    expect(accept(s, 'hb-s1-cat')).toBe(true);
    s.quests.active['hb-s1-cat'] = { 0: 1, 1: 1, 2: 1 };
    const r = turnIn(s, 'hb-s1-cat')!;
    expect(describeRewards(r)).toContain('Aboard: Biscuit');
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit']);
  });

  it('finding the Puffin opens the boatyard, and the refit is done by owning her', () => {
    const s = withSkiff();
    done(s, 'hb-12-road', 'fen-03-tape');
    s.flags.push('reached:mossglass-fen');
    expect(accept(s, 'fen-03b-wreck')).toBe(true);
    expect(currentGoal(s).place).toBe('puffin-wreck');
    s.quests.active['fen-03b-wreck'] = { 0: 1 };
    expect(questStatus(s, 'fen-03b-wreck')).toBe('ready');
    expect(QUESTS_BY_ID.get('fen-03b-wreck')!.receiver).toBe('pell');
    turnIn(s, 'fen-03b-wreck');
    expect(s.flags).toContain('boatyard-open');
    expect(accept(s, 'hb-13-refit')).toBe(true);
    expect(questStatus(s, 'hb-13-refit')).toBe('active');
    s.coins = BOATS_BY_ID.get('puffin')!.price;
    expect(buyBoat(s, 'puffin')).toBe(true);
    expect(questStatus(s, 'hb-13-refit')).toBe('ready');
  });

  it('what Pell asks for her is what she costs', () => {
    const price = BOATS_BY_ID.get('puffin')!.price, words: Record<number, string> = { 40000: 'forty thousand' };
    expect(words[price], 'the price in words (add it here when the price changes)').toBeTruthy();
    const refit = QUESTS_BY_ID.get('hb-13-refit')!, wreck = QUESTS_BY_ID.get('fen-03b-wreck')!;
    expect(refit.objectives[0].label).toContain(count(price));
    expect(refit.summary).toContain(count(price));
    for (const said of [wreck.outro.join(' '), refit.intro.join(' '), refit.reminder!]) expect(said.toLowerCase()).toContain(words[price]);
  });

  it('Mister Hollis comes when there is a berth of his own, and not before', () => {
    const s = withSkiff();
    hire(s, 'biscuit');
    done(s, 'fen-04-glows');
    expect(accept(s, 'fen-s1-gentleman')).toBe(true);
    const q = QUESTS_BY_ID.get('fen-s1-gentleman')!;
    expect(objectiveProgress(s, q, 0)).toBe(0);
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('active');
    expect(turnIn(s, 'fen-s1-gentleman')).toBeNull();
    s.boats.owned.push('puffin'); s.boats.current = 'puffin';
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('ready');
    s.world.region = 'mossglass-fen';
    expect(currentGoal(s).npc).toBe('hollis');
    turnIn(s, 'fen-s1-gentleman');
    expect(aboard(s).map((c) => c.id)).toEqual(['biscuit', 'hollis']);
    // Done is done: the job does not come undone in a boat with no berth for him.
    takeBoat(s, 'skiff');
    expect(objectiveProgress(s, q, 0)).toBe(1);
    expect(isAboard(s, 'hollis')).toBe(false);
  });

  it('a keeper with no cat cannot offer him the skiff either: her one berth is a cat\'s perch', () => {
    const s = withSkiff();
    s.quests.done.push('fen-04-glows');
    accept(s, 'fen-s1-gentleman');
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('active');
    s.boats.owned.push('puffin'); s.boats.current = 'puffin';
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('ready');
    turnIn(s, 'fen-s1-gentleman');
    expect(aboard(s).map((c) => c.id)).toEqual(['hollis']);
  });
});

describe('saves from before the crew', () => {
  it('a v4 save loads with nobody signed on, an empty basket, and everything else as it was', () => {
    const text = readFileSync(join(__dirname, 'fixtures', 'saves', 'v4.json'), 'utf8');
    const old = JSON.parse(text);
    expect(old.version).toBe(4);
    const s = deserialize(text);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.crew).toEqual({ hired: [], hold: [], clocks: {}, tally: {} });
    expect(s.coins).toBe(old.state.coins);
    expect(s.boats.owned).toEqual(old.state.boats.owned);
    expect(s.pots.owned).toBe(old.state.pots.owned);
    expect(Object.keys(s.journal).length).toBe(Object.keys(old.state.journal).length);
    expect(tickCrew(s, 600, bay(), { value: 1, luck: 0 })).toEqual([]);
  });

  it('a save made in Mossglass Fen by v0.4.0 loads as it was left, and the new people can be met from it', () => {
    // Made by the v0.4.0 simulator's keeper (seed 3): 144 minutes in, in the Fen with fish in the hold, three
    // pots, an Echo unspent and Dr. Calloway's fifth job ready to hand in.
    const text = readFileSync(join(__dirname, 'fixtures', 'saves', 'v4-fen.json'), 'utf8');
    const old = JSON.parse(text, (_k, v) => (v === '__inf__' ? Infinity : v)).state;
    expect(JSON.parse(text).version).toBe(4);
    expect(old.world.region).toBe('mossglass-fen');
    expect(old.crew).toBeUndefined();
    const s = deserialize(text);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.crew).toEqual({ hired: [], hold: [], clocks: {}, tally: {} });
    for (const k of ['coins', 'echoes', 'moonpearls', 'playTime', 'hour', 'hold', 'journal', 'gear', 'relics', 'flags', 'lifetime', 'world', 'pots', 'boats'] as const) expect(s[k], k).toEqual(old[k]);
    expect(s.quests.done).toEqual(old.quests.done);
    expect(s.quests.active).toEqual(old.quests.active);
    expect(questStatus(s, 'fen-05-sump')).toBe('ready');
    // One boat, one berth, nobody in it, and nothing earned by nobody.
    expect(berths(s)).toBe(1); expect(aboard(s)).toEqual([]);
    expect(tickCrew(s, 600, fen(), { value: 1, luck: 0 })).toEqual([]);
    // The slice's jobs open from where this keeper stands: the gentleman is Calloway's to mention now, the wreck
    // too, and the cat is Wick's.
    for (const id of ['fen-s1-gentleman', 'fen-03b-wreck', 'hb-s1-cat']) expect(questStatus(s, id), id).toBe('available');
    expect(accept(s, 'fen-s1-gentleman')).toBe(true);
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('active');
  });

  it('a save whose boat in the water was never marked as owned keeps the boat', () => {
    const doc = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'saves', 'v4.json'), 'utf8'));
    const mend = (boats: object, onBoat = true) => { const d = structuredClone(doc); d.state.boats = { upgrades: {}, at: { x: 10, z: 20, heading: 0 }, ...boats }; d.state.world.onBoat = onBoat; return deserialize(JSON.stringify(d)); };
    // The game never wrote this, but a keeper sitting in a boat must not load into the sea beside it.
    let s = mend({ owned: [], current: 'skiff' });
    expect(s.boats.owned).toEqual(['skiff']); expect(s.boats.current).toBe('skiff'); expect(s.world.onBoat).toBe(true); expect(berths(s)).toBe(1);
    // A boat the game has never heard of gives way to one that is owned, or to none.
    s = mend({ owned: ['skiff'], current: 'ark' });
    expect(s.boats.owned).toEqual(['skiff']); expect(s.boats.current).toBe('skiff');
    s = mend({ owned: [], current: 'ark' }, false);
    expect(s.boats.owned).toEqual([]); expect(s.boats.current).toBeNull(); expect(berths(s)).toBe(0);
    // And a save in good order is left alone.
    s = mend({ owned: ['skiff'], current: 'skiff' });
    expect(s.boats.owned).toEqual(['skiff']); expect(s.boats.current).toBe('skiff');
  });
});
