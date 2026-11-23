import { describe, expect, it } from 'vitest';
import { FishingSession, HAUL, NO_INPUT, typicalFish, type FindOffer, type FishingEvent } from '../src/core/fishing';
import { FINDS, countCast, findChance, fishWorth, lootLines, offerOf, peekFind, relicOffer, rollFind, takeFind, validateFinds, withFinds } from '../src/core/finds';
import { PEARLS, RELICS, RELICS_BY_ID, giftText, liftPearl, met, newRumours, pearlsFree, relicGift, relicsHere, setPearl, shelf, shelfOpen, validateRelics } from '../src/core/relics';
import { QUESTS } from '../src/core/quests';
import { CREW } from '../src/core/crew';
import { REGIONS, REGIONS_BY_ID, rod } from '../src/core/content';
import { COLLECTIONS, fishingContext, stats, validateGear } from '../src/core/gear';
import { RHYTHM, catchValue } from '../src/core/economy';
import { newGame, type GameState } from '../src/core/state';
import { Rng } from '../src/core/rng';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { basket } from '../src/core/crew';
import { SimPlayer } from '../tools/sim/player';
import { ctx, playHaul, skilledFightInput, skilledHaulInput } from './helpers';

const DT = 1 / 60;
/** A keeper who has landed enough fish for things to start coming up. */
const keeper = (seed = 7) => { const s = newGame(seed); s.lifetime.catches = FINDS.after; return s; };
const day = { region: 'hearthbay', zone: 'hb-open', hour: 12 };

describe('the data', () => {
  it('validates', () => {
    expect(validateFinds()).toEqual([]);
    const flags = new Set(REGIONS.map((r) => `reached:${r.id}`).concat(QUESTS.flatMap((q) => [...(q.rewards.flags ?? []), ...(q.gives?.flags ?? [])]), REGIONS.flatMap((r) => (r.places ?? []).flatMap((p) => (p.flag ? [p.flag] : [])))));
    expect(validateRelics((id) => { const r = REGIONS_BY_ID.get(id); return r ? new Set(r.zones.map((z) => z.id)) : null; }, flags, new Set(QUESTS.map((q) => q.id)), new Set(CREW.map((c) => c.id)))).toEqual([]);
    expect(validateGear()).toEqual([]);
  });
  it('every relic is come by somehow: fished up, or given by a job or a journal page', () => {
    const given = new Set(QUESTS.flatMap((q) => q.rewards.relics ?? []).concat(COLLECTIONS.flatMap((c) => c.rewards.relics ?? [])));
    for (const r of RELICS) expect(!!r.where || given.has(r.id), r.id).toBe(true);
    // And none both ways: a relic in the water is not also handed over.
    for (const r of RELICS) expect(!!r.where && given.has(r.id), r.id).toBe(false);
    expect(RELICS.filter((r) => r.where).length).toBe(8);
    expect(given.size).toBe(4);
  });
});

describe('what a cast comes down over', () => {
  it('nothing but fish until a dozen have been landed, and those casts are not counted', () => {
    const s = newGame(3);
    for (let i = 0; i < 500; i++) expect(rollFind(s, day)).toBeNull();
    expect(s.finds.casts).toBe(0);
    expect(findChance(s)).toBe(0);
  });

  it('a find about every dozen waits, never straight after another, and never a long drought', () => {
    const s = keeper();
    const gaps: number[] = [];
    let since = 0;
    for (let i = 0; i < 40000; i++) {
      since++;
      if (rollFind(s, day)) { gaps.push(since); since = 0; }
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(10);
    expect(mean).toBeLessThan(15);
    expect(Math.min(...gaps)).toBeGreaterThan(FINDS.gap);
    expect(Math.max(...gaps)).toBeLessThan(60);
    expect(s.finds.casts).toBe(40000);
  });

  it('the dice go by the save: the same cast of the same save comes down over the same thing', () => {
    const a = keeper(11), b = keeper(11), c = keeper(12);
    const seq = (s: GameState) => Array.from({ length: 400 }, () => rollFind(s, day)?.id ?? '-').join(' ');
    const sa = seq(a);
    expect(seq(b)).toBe(sa);
    expect(seq(c)).not.toBe(sa);
    // A reload: the save as it stood two hundred casts in throws the same dice from there on.
    const d = keeper(11);
    for (let i = 0; i < 200; i++) rollFind(d, day);
    const copy: GameState = JSON.parse(JSON.stringify(d));
    expect(seq(copy)).toBe(seq(d));
  });

  it('chests come up only in chest water, about one find in three there', () => {
    const count = (zone: string, region = 'hearthbay') => {
      const s = keeper(5); let crates = 0, chests = 0;
      for (let i = 0; i < 30000; i++) { const f = rollFind(s, { region, zone, hour: 12 }); if (f?.kind === 'chest') chests++; else if (f?.kind === 'crate') crates++; }
      return { crates, chests };
    };
    expect(count('hb-open').chests).toBe(0);
    expect(count('hb-dock').chests).toBe(0);
    const teeth = count('hb-teeth'), share = teeth.chests / (teeth.chests + teeth.crates);
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.35);
    expect(count('fen-sump', 'mossglass-fen').chests).toBeGreaterThan(0);
    expect(count('fen-glass', 'mossglass-fen').chests).toBe(0);
  });

  it('gear that finds things more often does', () => {
    const run = (mult: number) => { const s = keeper(9); let n = 0; for (let i = 0; i < 20000; i++) if (rollFind(s, day, mult)) n++; return n; };
    expect(run(1.3)).toBeGreaterThan(run(1) * 1.1);
    const s = keeper();
    s.gear.wearables.push('dowsers-bob'); s.gear.worn.charm = 'dowsers-bob';
    expect(stats(s).finds).toBeCloseTo(1.3);
  });
});

describe('a relic in its water at its hour', () => {
  const cove = (hour: number) => ({ region: 'hearthbay', zone: 'hb-bay', hour });
  /** A keeper who has done Wick's drawing job: the spectacles have been spoken of. */
  const told = (seed = 7) => { const s = keeper(seed); s.quests.done.push('hb-04-drawing'); return s; };

  it('comes up in about three casts and never takes more than eleven', () => {
    let total = 0, worst = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = told(seed);
      let n = 0, got: FindOffer | null = null;
      while (!got || got.kind !== 'relic') { n++; got = rollFind(s, cove(23)); expect(n).toBeLessThan(12); }
      expect(got.id).toBe('isoldes-spectacles');
      total += n; worst = Math.max(worst, n);
    }
    expect(total / 400).toBeGreaterThan(2);
    expect(total / 400).toBeLessThan(4);
    expect(worst).toBeLessThanOrEqual(11);
  });

  it('does not come up before anybody has spoken of it', () => {
    // A new keeper with a dozen fish and no jobs done, in Lantern Cove at night: the water has only fish and crates.
    const s = keeper(4);
    expect(shelf(s).find((p) => p.relic.id === 'isoldes-spectacles')!.state).toBe('empty');
    expect(relicsHere(s, 'hearthbay', 'hb-bay', 23)).toEqual([]);
    for (let i = 0; i < 3000; i++) expect(rollFind(s, cove(23))?.kind).not.toBe('relic');
    s.quests.done.push('hb-04-drawing');
    expect(shelf(s).find((p) => p.relic.id === 'isoldes-spectacles')!.state).toBe('rumour');
    expect(relicsHere(s, 'hearthbay', 'hb-bay', 23).map((r) => r.id)).toEqual(['isoldes-spectacles']);
    // It holds for every relic in the water: where one lies, its rumour is due.
    const all = newGame(2);
    all.world.discovered = REGIONS.map((r) => r.id);
    for (const r of RELICS.filter((x) => x.where)) {
      const zone = r.where!.zones[0], hour = r.where!.hours?.[0] ?? 12;
      const w = newGame(2); w.world.discovered = all.world.discovered;
      if (r.where!.needs) { const n = r.where!.needs; if (n.startsWith('quest:')) w.quests.done.push(n.slice(6)); else if (n.startsWith('crew:')) w.crew.hired.push(n.slice(5)); else w.flags.push(n); }
      if (relicsHere(w, r.region, zone, hour).some((x) => x.id === r.id)) expect(shelf(w).find((p) => p.relic.id === r.id)!.state, r.id).toBe('rumour');
    }
  });

  it('does not come up by day, in other water, before its story, or twice', () => {
    const s = told(4);
    for (let i = 0; i < 3000; i++) expect(rollFind(s, cove(12))?.kind).not.toBe('relic');
    for (let i = 0; i < 3000; i++) expect(rollFind(s, { region: 'hearthbay', zone: 'hb-dock', hour: 23 })?.kind).not.toBe('relic');
    // The cork float waits on the pots; the tide table on a Turning.
    for (let i = 0; i < 3000; i++) expect(rollFind(s, { region: 'hearthbay', zone: 'hb-teeth', hour: 12 })?.kind).not.toBe('relic');
    s.flags.push('pots-open');
    expect(relicsHere(s, 'hearthbay', 'hb-teeth', 12).map((r) => r.id)).toEqual(['cork-float']);
    expect(relicsHere(s, 'hearthbay', 'hb-open', 12)).toEqual([]);
    s.flags.push('tide-turned');
    expect(relicsHere(s, 'hearthbay', 'hb-open', 12).map((r) => r.id)).toEqual(['tide-table']);
    // Found once: it is on the Shelf, and the water has no more of it.
    const loot = takeFind(s, relicOffer('cork-float')!)!;
    expect(loot.relic).toBe('cork-float');
    expect(s.relics).toContain('cork-float');
    expect(relicsHere(s, 'hearthbay', 'hb-teeth', 12)).toEqual([]);
    expect(takeFind(s, relicOffer('cork-float')!)).toBeNull();
    for (let i = 0; i < 3000; i++) expect(rollFind(s, { region: 'hearthbay', zone: 'hb-teeth', hour: 12 })?.id).not.toBe('cork-float');
  });

  it('the casts that missed it are remembered, and forgotten when it is found', () => {
    const s = told(21);
    let n = 0;
    while (rollFind(s, cove(22))?.kind !== 'relic') n++;
    expect(s.finds.near['isoldes-spectacles'] ?? 0).toBe(n);
    takeFind(s, relicOffer('isoldes-spectacles')!);
    expect(s.finds.near['isoldes-spectacles']).toBeUndefined();
  });

  it('what a relic waits on: a job done, a hand signed on, a flag', () => {
    const s = newGame(1);
    expect(met(s, undefined)).toBe(true);
    expect(met(s, 'quest:fen-05-sump')).toBe(false);
    s.quests.done.push('fen-05-sump');
    expect(met(s, 'quest:fen-05-sump')).toBe(true);
    expect(met(s, 'crew:hollis')).toBe(false);
    s.crew.hired.push('hollis');
    expect(met(s, 'crew:hollis')).toBe(true);
    expect(met(s, 'reached:mossglass-fen')).toBe(false);
    s.flags.push('reached:mossglass-fen');
    expect(met(s, 'reached:mossglass-fen')).toBe(true);
  });
});

describe('what is in it', () => {
  it('a crate: coins that count as earned, and a handful of a bait of that water', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = keeper(seed);
      s.finds.casts = seed * 3;
      const before = { coins: s.coins, life: s.lifetime.coins, run: s.run.coins };
      const loot = takeFind(s, offerOf('crate', 'hearthbay'))!;
      const [lo, hi] = FINDS.regions.hearthbay.crate.coins;
      expect(loot.coins).toBeGreaterThanOrEqual(lo);
      expect(loot.coins).toBeLessThanOrEqual(hi);
      expect(s.coins - before.coins).toBe(loot.coins);
      expect(s.lifetime.coins - before.life).toBe(loot.coins);
      expect(s.run.coins - before.run).toBe(loot.coins);
      const baits = Object.entries(loot.baits);
      expect(baits.length).toBe(1);
      expect(s.gear.baits[baits[0][0]]).toBe(baits[0][1]);
      expect(loot.pearls).toBe(0);
      expect(FINDS.regions.hearthbay.crate.lines).toContain(loot.text);
      expect(s.finds.crates).toBe(1);
      expect(lootLines(loot).length).toBe(2);
    }
  });

  it('a crate is never opened for less than the fish that cast would have brought the best of hands', () => {
    // A late keeper (the finds tester's start: the Puffin, good tackle, relics), with Rhythm up, in three waters.
    for (const [zone, hour] of [['hb-teeth', 12], ['hb-bay', 22], ['hb-dock', 12]] as [string, number][]) {
      const s = deserialize(readFileSync(join(__dirname, '..', 'src', 'data', 'tester', 'finds.json'), 'utf8'));
      s.rhythm = 9; s.hour = hour;
      const afloat = zone === 'hb-teeth', st = stats(s, { hour, afloat });
      const spot = { zoneId: zone, depth: 5, hotspot: false };
      const c = fishingContext(s, { hour, afloat }, () => spot, st);
      const worth = fishWorth(c, spot, s, st);
      expect(worth).toBeGreaterThan(typicalFish(c, spot) * st.value); // more than the plain average: a good hand's
      // What that cast really brings a hand that casts clean, strikes at once and lands it, as the game values it.
      let sum = 0, n = 0;
      for (let seed = 1; seed <= 600; seed++) {
        const f = new FishingSession(c, new Rng(seed));
        f.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
        while (f.phase === 'charging') f.update(DT, f.power >= 0.88 ? { ...NO_INPUT, primaryReleased: true } : { ...NO_INPUT, primary: true });
        for (let i = 0; i < 60 * 300 && f.phase !== 'landed' && f.phase !== 'lost' && f.phase !== 'idle'; i++) {
          if (f.phase === 'bite') f.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
          else if (f.phase === 'fighting') f.update(DT, skilledFightInput(f));
          else f.update(DT, NO_INPUT);
        }
        if (!f.lastCatch) continue;
        const t = structuredClone(s); t.rhythm = Math.min(st.rhythmCap, t.rhythm + 1); // as addCatch counts it
        sum += catchValue(t, f.lastCatch, st); n++;
      }
      expect(n).toBeGreaterThan(500);
      const mean = sum / n;
      // The reckoning is the mean of that hand, to within what six hundred fish can say (Strange ones swing it).
      expect(worth / mean, `${zone}: worth ${worth.toFixed(0)}, fish ${mean.toFixed(0)}`).toBeGreaterThan(0.93);
      expect(worth / mean, `${zone}: worth ${worth.toFixed(0)}, fish ${mean.toFixed(0)}`).toBeLessThan(1.12);
      // And no crate holds less than it, a chest never less than twice it.
      for (let i = 0; i < 300; i++) {
        const k = structuredClone(s); k.finds.casts = i;
        expect(takeFind(k, offerOf('crate', 'hearthbay', worth))!.coins).toBeGreaterThanOrEqual(Math.round(worth));
        expect(takeFind(k, offerOf('chest', 'hearthbay', worth))!.coins).toBeGreaterThanOrEqual(Math.round(2 * worth));
      }
    }
    // Where the fish are worth next to nothing, a crate still has its own coins in it.
    const poor = keeper(3);
    for (let i = 0; i < 100; i++) { poor.finds.casts = i; expect(takeFind(poor, offerOf('crate', 'hearthbay', 0))!.coins).toBeGreaterThanOrEqual(FINDS.regions.hearthbay.crate.coins[0]); }
  });

  it('a sea chest: a Moonpearl, and the first of a water holds a piece of gear sold nowhere', () => {
    const s = keeper(2);
    const first = takeFind(s, offerOf('chest', 'hearthbay'))!;
    expect(first.pearls).toBe(1);
    expect(s.moonpearls).toBe(1);
    expect(first.lures).toEqual(['mirror-spoon']);
    expect(s.gear.lures).toContain('mirror-spoon');
    expect(lootLines(first)).toContain('Mirror Spoon');
    s.finds.casts++;
    const second = takeFind(s, offerOf('chest', 'hearthbay'))!;
    expect(second.lures).toEqual([]);
    expect(s.moonpearls).toBe(2);
    expect(s.finds.chests).toBe(2);
    const fen = takeFind(s, offerOf('chest', 'mossglass-fen'))!;
    expect(fen.wearables).toEqual(['dowsers-bob']);
    expect(s.gear.worn.charm).toBe('dowsers-bob');
  });
});

/** Casts, and plays on until the float has gone under. */
function castOver(s: FishingSession) {
  s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
  while (s.power < 0.7) s.update(DT, { ...NO_INPUT, primary: true });
  s.update(DT, { ...NO_INPUT, primaryReleased: true });
  const seen: FishingEvent[] = [];
  for (let i = 0; i < 60 * 40 && s.phase !== 'bite'; i++) { s.update(DT, NO_INPUT); seen.push(...s.events.splice(0)); }
  return seen;
}
const crate: FindOffer = { id: 'crate:hearthbay', kind: 'crate', heft: 1.3 };

describe('a find on the line', () => {
  it('nothing nibbles, the cat is not fooled, and the float is drawn under at the end of the wait', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = new FishingSession(ctx({ find: () => crate }), new Rng(seed));
      s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
      while (s.power < 0.7) s.update(DT, { ...NO_INPUT, primary: true });
      s.update(DT, { ...NO_INPUT, primaryReleased: true });
      while (s.phase === 'casting') s.update(DT, NO_INPUT);
      expect(s.finding).toBe(crate);
      expect(s.biteIn).toBe(Infinity);
      expect(s.nextTug).toBeGreaterThan(1);
      const seen: FishingEvent[] = [];
      for (let i = 0; i < 60 * 40 && s.phase !== 'bite'; i++) { s.update(DT, NO_INPUT); seen.push(...s.events.splice(0)); }
      expect(seen.some((e) => e.type === 'nibble')).toBe(false);
      expect(seen.some((e) => e.type === 'bite')).toBe(false);
      const drag = seen.find((e) => e.type === 'drag');
      expect(drag && drag.type === 'drag' && drag.find).toBe(crate);
      expect(drag && drag.type === 'drag' && drag.window).toBeCloseTo(HAUL.window);
      expect(s.biteIn).toBe(Infinity);
    }
  });

  it('the place is asked about once a cast, as the float lands', () => {
    let asked = 0;
    const s = new FishingSession(ctx({ find: () => { asked++; return null; } }), new Rng(3));
    castOver(s);
    expect(asked).toBe(1);
    // A fish that is missed is waited for again, and nothing new has sunk there meanwhile.
    for (let i = 0; i < 60 * 30 && s.phase === 'bite'; i++) s.update(DT, NO_INPUT);
    castOver(s);
    expect(asked).toBe(1);
  });

  it('not struck in time, it is still down there and draws the float under again within a few seconds', () => {
    const s = new FishingSession(ctx({ find: () => crate }), new Rng(5));
    castOver(s);
    let t = 0;
    while (s.phase === 'bite') { s.update(DT, NO_INPUT); t += DT; }
    expect(t).toBeGreaterThan(HAUL.window - 0.05);
    expect(s.events.some((e) => e.type === 'slipped')).toBe(true);
    expect(s.finding).toBe(crate);
    t = 0;
    while (s.phase === 'waiting') { s.update(DT, NO_INPUT); t += DT; }
    expect(s.phase).toBe('bite');
    expect(t).toBeGreaterThan(HAUL.again[0] - 0.05);
    expect(t).toBeLessThan(HAUL.again[1] + 0.05);
  });

  it('striking it starts the haul and uses no bait: there is no hook, and no fish', () => {
    const s = new FishingSession(ctx({ find: () => crate }), new Rng(5));
    castOver(s);
    s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
    expect(s.phase).toBe('hauling');
    expect(s.fight).toBeNull();
    expect(s.haul!.find).toBe(crate);
    expect(s.onLine).toBe(s.haul);
    expect(s.events.some((e) => e.type === 'hook')).toBe(false);
    expect(s.events.some((e) => e.type === 'haul')).toBe(true);
    expect(s.finding).toBeNull();
  });

  it('reeling it in after a missed strike, or letting it go mid-haul, leaves nothing on the line', () => {
    const a = new FishingSession(ctx({ find: () => crate }), new Rng(6));
    castOver(a);
    a.update(DT, { ...NO_INPUT, cancel: true });
    expect(a.phase).toBe('idle');
    expect(a.finding).toBeNull();
    const b = new FishingSession(ctx({ find: () => crate }), new Rng(6));
    castOver(b);
    b.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
    b.events.length = 0;
    b.update(DT, { ...NO_INPUT, cancel: true });
    expect(b.phase).toBe('lost');
    expect(b.haul).toBeNull();
    const lost = b.events.find((e) => e.type === 'lost');
    expect(lost && lost.type === 'lost' && lost.reason).toBe('cancel');
    expect(lost && lost.type === 'lost' && lost.find).toBe(crate);
  });
});

describe('the haul', () => {
  // Every weight there is, on the rods a keeper has when they first meet it.
  const meets: [string, number][] = [
    ['driftwood-rod', 1.3], ['driftwood-rod', 1.3 * FINDS.relic.heft], ['harbour-rod', 1.7], ['gullwing-rod', 2.3], ['gullwing-rod', 3.0], ['fenwood-rod', 3.0],
  ];

  it('a careful hand brings up everything, on the rod they have when they meet it', () => {
    for (const [rodId, heft] of meets) for (let seed = 1; seed <= 60; seed++) {
      const r = playHaul(heft, { seed, rodId });
      expect(r.phase, `${rodId} ${heft} seed ${seed}`).toBe('landed');
      expect(r.snags).toBe(0);
      expect(r.time).toBeLessThan(22);
    }
  });

  it('an ordinary hand brings it up too, and is caught on the bottom now and then', () => {
    let snags = 0, hauls = 0;
    for (const [rodId, heft] of meets) for (const skill of [0.3, 0.7]) for (let seed = 1; seed <= 60; seed++) {
      const r = playHaul(heft, { seed, rodId, policy: 'human', skill });
      expect(r.phase, `${rodId} ${heft} skill ${skill} seed ${seed}`).toBe('landed');
      snags += r.snags; hauls++;
    }
    expect(snags / hauls).toBeGreaterThan(0.05);
    expect(snags / hauls).toBeLessThan(1);
  });

  it('reeling without a pause breaks the line every time', () => {
    for (const [rodId, heft] of meets) for (let seed = 1; seed <= 20; seed++) {
      const r = playHaul(heft, { seed, rodId, policy: 'mash' });
      expect(r.phase).toBe('lost');
      expect(r.ev && r.ev.type === 'lost' && r.ev.reason).toBe('snap');
    }
  });

  it('nothing is lost by resting: it settles back to where it lay and waits', () => {
    const s = new FishingSession(ctx(), new Rng(1));
    (s as any).castDistance = 14;
    (s as any).startHaul(crate);
    for (let i = 0; i < 60 * 4; i++) s.update(DT, { ...NO_INPUT, primary: s.haul!.tension < 0.7 && !s.haul!.warned });
    const near = s.haul!.distance;
    expect(near).toBeLessThan(12);
    for (let i = 0; i < 60 * 120; i++) s.update(DT, NO_INPUT);
    expect(s.phase).toBe('hauling');
    expect(s.haul!.distance).toBe(14);
    expect(s.haul!.tension).toBe(0);
  });

  it('the knock comes before it catches; letting go eases it over, reeling on catches it fast until the reel is let alone', () => {
    const fresh = () => { const s = new FishingSession(ctx({ rod: rod('gullwing-rod') }), new Rng(2)); (s as any).castDistance = 24; (s as any).startHaul(crate); return s; };
    const until = (s: FishingSession, type: FishingEvent['type'], inp: () => typeof NO_INPUT) => {
      let t = 0;
      for (let i = 0; i < 60 * 30; i++) { s.update(DT, inp()); t += DT; if (s.events.some((e) => e.type === type)) { s.events.length = 0; return t; } s.events.length = 0; if (s.phase !== 'hauling') break; }
      return -1;
    };
    const pump = (s: FishingSession) => () => ({ ...NO_INPUT, primary: s.haul!.tension < 0.7 });
    // Eased over.
    const a = fresh();
    expect(until(a, 'snagWarn', pump(a))).toBeGreaterThan(1);
    expect(a.haul!.warned).toBe(true);
    const wait = until(a, 'eased', () => NO_INPUT);
    expect(wait).toBeGreaterThan(HAUL.snagWarn - 0.05);
    expect(wait).toBeLessThan(HAUL.snagWarn + 0.05);
    expect(a.haul!.snag).toBe(false);
    // Reeled into.
    const b = fresh();
    until(b, 'snagWarn', pump(b));
    const before = b.haul!.tension;
    expect(until(b, 'snag', () => ({ ...NO_INPUT, primary: true }))).toBeGreaterThan(0);
    expect(b.haul!.snag).toBe(true);
    expect(b.haul!.tension).toBeGreaterThan(before + HAUL.snagJolt - 0.01);
    const d = b.haul!.distance;
    b.update(DT, { ...NO_INPUT, primary: true });
    expect(b.haul!.distance).toBe(d);
    const free = until(b, 'free', () => NO_INPUT);
    expect(free).toBeGreaterThan(HAUL.snagFree - 0.05);
    expect(free).toBeLessThan(HAUL.snagFree + 0.05);
    expect(b.haul!.snag).toBe(false);
  });

  it('there is no snag in the last few metres', () => {
    const s = new FishingSession(ctx(), new Rng(4));
    (s as any).castDistance = HAUL.clearWater;
    (s as any).startHaul(crate);
    for (let i = 0; i < 60 * 60 && s.phase === 'hauling'; i++) s.update(DT, { ...NO_INPUT, primary: s.haul!.tension < 0.7 });
    expect(s.phase).toBe('landed');
    expect(s.events.some((e) => e.type === 'snagWarn')).toBe(false);
    const found = s.events.find((e) => e.type === 'found');
    expect(found && found.type === 'found' && found.find).toBe(crate);
    expect(s.lastFind).toBe(crate);
  });
});

describe('through a real session against a save', () => {
  const open = { zoneId: 'hb-open', depth: 5, hotspot: false };
  const over = (s: GameState, seed: number) => new FishingSession(withFinds(ctx({ spot: () => open }), s), new Rng(seed));
  const strike = (f: FishingSession) => f.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
  const haulUp = (f: FishingSession) => { for (let i = 0; i < 60 * 90 && f.phase === 'hauling'; i++) f.update(DT, skilledHaulInput(f)); };
  /** A keeper whose next cast into open water meets a crate. */
  const crateNext = (seed = 31) => {
    const s = keeper(seed);
    for (let i = 0; i < 400 && !peekFind(s, day); i++) countCast(s, day, null);
    expect(peekFind(s, day)?.kind).toBe('crate');
    return s;
  };

  it('a cast is counted when it is used: a fish hooked, or the thing brought aboard', () => {
    const s = keeper(31);
    let crates = 0, fish = 0;
    for (let cast = 0; cast < 400 && crates < 3; cast++) {
      const f = over(s, 1000 + cast);
      castOver(f);
      const before = s.finds.casts;
      strike(f);
      if (f.phase === 'fighting') { fish++; expect(s.finds.casts).toBe(before + 1); continue; }
      expect(f.phase).toBe('hauling');
      expect(s.finds.casts).toBe(before); // not until it is aboard
      haulUp(f);
      expect(f.phase).toBe('landed');
      expect(s.finds.casts).toBe(before + 1);
      const loot = takeFind(s, f.lastFind!)!;
      expect(loot.kind).toBe('crate');
      crates++;
    }
    expect(crates).toBe(3);
    expect(fish).toBeGreaterThan(15);
    expect(s.finds.casts).toBe(crates + fish);
    expect(s.finds.crates).toBe(3);
  });

  it('casting and reeling straight back in throws no dice, and neither does a bite that is missed', () => {
    const s = keeper(8), before = structuredClone(s.finds);
    const seen = new Set<string>();
    for (let cast = 0; cast < 300; cast++) {
      const f = over(s, 50 + cast);
      f.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
      while (f.power < 0.7) f.update(DT, { ...NO_INPUT, primary: true });
      f.update(DT, { ...NO_INPUT, primaryReleased: true });
      while (f.phase === 'casting') f.update(DT, NO_INPUT);
      seen.add(f.finding?.id ?? 'fish');
      f.update(DT, { ...NO_INPUT, cancel: true });
      expect(f.phase).toBe('idle');
    }
    expect(s.finds).toEqual(before);
    expect(seen.size).toBe(1); // every one of those casts came down over the same thing
    // A fish that bites and is not struck: the float is still in, and nothing has been thrown.
    const f = over(s, 9);
    castOver(f);
    expect(f.finding).toBeNull();
    for (let i = 0; i < 60 * 20 && f.phase === 'bite'; i++) f.update(DT, NO_INPUT);
    f.update(DT, { ...NO_INPUT, cancel: true });
    expect(s.finds).toEqual(before);
  });

  it('a find that is left, let go of, or in the water when the game is shut is still there', () => {
    const s = crateNext(), before = structuredClone(s.finds);
    // Seen and reeled past.
    let f = over(s, 1); castOver(f);
    expect(f.finding?.kind).toBe('crate');
    f.update(DT, { ...NO_INPUT, cancel: true });
    expect(s.finds).toEqual(before);
    // Struck, and let go of half way up.
    f = over(s, 2); castOver(f); strike(f);
    for (let i = 0; i < 120; i++) f.update(DT, skilledHaulInput(f));
    expect(f.phase).toBe('hauling');
    // The game is shut here: the save as it would be written, loaded again, meets the same crate.
    const loaded = deserialize(serialize(s));
    expect(loaded.finds).toEqual(before);
    const g = over(loaded, 77); castOver(g);
    expect(g.finding?.kind).toBe('crate');
    f.update(DT, { ...NO_INPUT, cancel: true });
    expect(f.phase).toBe('lost');
    expect(s.finds).toEqual(before);
    // And then brought up: now the cast is used, the crate is opened once, and the water is quiet for a while.
    f = over(s, 3); castOver(f); strike(f); haulUp(f);
    expect(f.phase).toBe('landed');
    expect(s.finds.casts).toBe(before.casts + 1);
    expect(s.finds.dry).toBe(0);
    expect(takeFind(s, f.lastFind!)!.kind).toBe('crate');
    expect(peekFind(s, day)).toBeNull();
    f = over(s, 4); castOver(f);
    expect(f.finding).toBeNull();
  });

  it('a crate goes with a broken line; a relic does not', () => {
    const s = crateNext(12), before = structuredClone(s.finds);
    let f = over(s, 1); castOver(f); strike(f);
    for (let i = 0; i < 60 * 60 && f.phase === 'hauling'; i++) f.update(DT, { ...NO_INPUT, primary: true });
    expect(f.lostReason).toBe('snap');
    expect(s.finds.casts).toBe(before.casts + 1);
    expect(s.finds.dry).toBe(0);
    expect(s.finds.crates).toBe(0);
    // The spectacles, spoken of, in Lantern Cove at night.
    const r = keeper(5); r.quests.done.push('hb-04-drawing');
    const cove = { zoneId: 'hb-bay', depth: 5, hotspot: false }, night = { region: 'hearthbay', zone: 'hb-bay', hour: 23 };
    for (let i = 0; i < 12 && peekFind(r, night)?.kind !== 'relic'; i++) countCast(r, night, peekFind(r, night));
    expect(peekFind(r, night)?.kind).toBe('relic');
    const was = structuredClone(r.finds);
    const relicCast = (seed: number) => new FishingSession(withFinds(ctx({ spot: () => cove, hour: 23 }), r), new Rng(seed));
    f = relicCast(1); castOver(f); strike(f);
    expect(f.haul!.find.id).toBe('isoldes-spectacles');
    for (let i = 0; i < 60 * 60 && f.phase === 'hauling'; i++) f.update(DT, { ...NO_INPUT, primary: true });
    expect(f.lostReason).toBe('snap');
    expect(r.finds).toEqual(was);
    f = relicCast(2); castOver(f);
    expect(f.finding?.id).toBe('isoldes-spectacles');
    strike(f); haulUp(f);
    expect(f.phase).toBe('landed');
    expect(takeFind(r, f.lastFind!)!.relic).toBe('isoldes-spectacles');
    expect(r.finds.near['isoldes-spectacles']).toBeUndefined();
  });

  it('no water moves another water\'s dice: where the float lands changes what is met only as the place itself does', () => {
    let relics = 0, boxes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = keeper(seed); s.quests.done.push('hb-04-drawing');
      for (let i = 0; i < 60; i++) {
        const dock = peekFind(s, { region: 'hearthbay', zone: 'hb-dock', hour: 23 });
        const cove = peekFind(s, { region: 'hearthbay', zone: 'hb-bay', hour: 23 });
        const teeth = peekFind(s, { region: 'hearthbay', zone: 'hb-teeth', hour: 23 });
        // A box at the dock is a box at the Teeth (a crate or a chest there), and in the cove unless the relic comes instead.
        expect(!!teeth).toBe(!!dock);
        if (teeth) { boxes++; expect(dock!.kind).toBe('crate'); }
        if (cove?.kind === 'relic') relics++; else expect(!!cove).toBe(!!dock);
        countCast(s, { region: 'hearthbay', zone: 'hb-dock', hour: 23 }, dock);
      }
    }
    expect(relics).toBeGreaterThan(100);
    expect(boxes).toBeGreaterThan(100);
  });
});

describe('Moonpearls are set, not spent', () => {
  it('a pearl beside a relic adds half its gift again, two double it, and a third has no hollow', () => {
    const s = newGame(1);
    s.relics.push('wicks-drawing');
    s.moonpearls = 3;
    expect(stats(s).luck).toBeCloseTo(0.03);
    expect(setPearl(s, 'wicks-drawing')).toBe(true);
    expect(relicGift(s, 'wicks-drawing')).toBeCloseTo(1 + PEARLS.each);
    expect(stats(s).luck).toBeCloseTo(0.045);
    expect(setPearl(s, 'wicks-drawing')).toBe(true);
    expect(stats(s).luck).toBeCloseTo(0.06);
    expect(setPearl(s, 'wicks-drawing')).toBe(false);
    expect(pearlsFree(s)).toBe(1);
    expect(s.moonpearls).toBe(3);
  });

  it('a pearl is lifted and set elsewhere for nothing; none can be set that the keeper has not got, or beside a relic they have not got', () => {
    const s = newGame(1);
    s.relics.push('wicks-drawing', 'keepers-kettle');
    expect(setPearl(s, 'wicks-drawing')).toBe(false);
    s.moonpearls = 1;
    expect(setPearl(s, 'calloway-tape')).toBe(false);
    expect(setPearl(s, 'wicks-drawing')).toBe(true);
    expect(setPearl(s, 'keepers-kettle')).toBe(false);
    expect(liftPearl(s, 'keepers-kettle')).toBe(false);
    expect(liftPearl(s, 'wicks-drawing')).toBe(true);
    expect(s.pearls).toEqual({});
    expect(setPearl(s, 'keepers-kettle')).toBe(true);
    expect(stats(s).luck).toBeCloseTo(0.03);
    expect(stats(s).biteSpeed).toBeCloseTo(1 + 0.06 * 1.5);
    expect(s.moonpearls).toBe(1);
    expect(pearlsFree(s)).toBe(0);
  });

  it('a gift reads as what it does', () => {
    expect(giftText(RELICS_BY_ID.get('wicks-drawing')!.effect)).toBe('Rarer fish (3% luck)');
    expect(giftText(RELICS_BY_ID.get('wicks-drawing')!.effect, 1.5)).toBe('Rarer fish (4.5% luck)');
    // One more catch counted by Rhythm is one more step of what Rhythm pays, and half a pearl's worth reads as half.
    expect(giftText(RELICS_BY_ID.get('tide-table')!.effect)).toBe(`Rhythm builds ${RHYTHM.perStack * 100}% higher`);
    expect(giftText(RELICS_BY_ID.get('tide-table')!.effect, 1.5)).toBe('Rhythm builds 7.5% higher');
    expect(giftText(RELICS_BY_ID.get('tide-table')!.effect, 2)).toBe('Rhythm builds 10% higher');
    for (const r of RELICS) expect(giftText(r.effect)).not.toMatch(/undefined|NaN/);
  });
});

describe('the Shelf', () => {
  it('has a place for every relic of the waters reached, and no others', () => {
    const s = newGame(1);
    expect(shelf(s).map((p) => p.relic.region)).toEqual(Array(6).fill('hearthbay'));
    s.world.discovered.push('mossglass-fen');
    expect(shelf(s).length).toBe(RELICS.length);
  });

  it('a place is empty until somebody speaks of it, then a rumour, then the relic', () => {
    const s = newGame(1);
    const at = (id: string) => shelf(s).find((p) => p.relic.id === id)!.state;
    expect(at('wicks-drawing')).toBe('rumour');
    expect(at('isoldes-spectacles')).toBe('empty');
    expect(shelfOpen(s)).toBe(false);
    s.quests.done.push('hb-04-drawing'); s.relics.push('wicks-drawing');
    expect(at('wicks-drawing')).toBe('found');
    expect(at('isoldes-spectacles')).toBe('rumour');
    expect(shelfOpen(s)).toBe(true);
  });

  it('a rumour is passed on once, when its time comes, and not at all for a relic already fished up', () => {
    const s = newGame(1);
    expect(newRumours(s)).toEqual([]);
    s.quests.done.push('hb-04-drawing');
    expect(newRumours(s).map((r) => r.id)).toEqual(['isoldes-spectacles']);
    expect(newRumours(s)).toEqual([]);
    expect(shelfOpen(s)).toBe(true);
    // The cork float comes up before Mara has said a word about it: found needs no rumour.
    s.relics.push('cork-float');
    s.flags.push('pots-open');
    expect(newRumours(s)).toEqual([]);
    s.flags.push('tide-turned');
    expect(newRumours(s).map((r) => r.id)).toEqual(['tide-table']);
  });
});

describe('saves from before anything came up', () => {
  const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'saves', name), 'utf8');
  const raw = (text: string) => JSON.parse(text, (_k, v) => (v === '__inf__' ? Infinity : v));
  const KEPT = ['seed', 'coins', 'echoes', 'moonpearls', 'playTime', 'hour', 'hold', 'journal', 'gear', 'relics', 'flags', 'lifetime', 'run', 'world', 'pots', 'boats', 'crew', 'quests', 'echoUpgrades', 'rhythm', 'nextUid'] as const;

  it('a v0.5.0 save loads with nothing found, no pearl set, and everything else as it was left', () => {
    // The tester's start that v0.5.0 shipped: made by that version's simulator, written by that version's game.
    const text = fixture('v5.json'), old = raw(text);
    expect(old.version).toBe(5);
    expect(old.state.finds).toBeUndefined();
    expect(old.state.pearls).toBeUndefined();
    const s = deserialize(text);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.finds).toEqual({ casts: 0, dry: 0, crates: 0, chests: 0, near: {} });
    expect(s.pearls).toEqual({});
    for (const k of KEPT) expect(s[k], k).toEqual(old.state[k]);
    // The pearls they were given are theirs to set, and the relics give what they gave.
    expect(s.moonpearls).toBe(2);
    expect(pearlsFree(s)).toBe(2);
    // Wick's Drawing and the Keeper's Kettle, as v0.5.0 counted them: the plain gift, no more and no less.
    expect(s.relics).toEqual(['wicks-drawing', 'keepers-kettle', 'isolde-log-fen', 'calloway-tape']);
    const without = stats({ ...s, relics: [] });
    const gift = (k: 'luck' | 'biteSpeed') => s.relics.reduce((a, id) => a + (RELICS_BY_ID.get(id)!.effect[k] ?? 0), 0);
    expect(gift('luck')).toBeCloseTo(0.07);
    expect(stats(s).luck - without.luck).toBeCloseTo(gift('luck'));
    expect(stats(s).biteSpeed - without.biteSpeed).toBeCloseTo(gift('biteSpeed'));
    // It goes round again without loss.
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('what such a keeper has already earned is said at once: the rumours of both waters, one time', () => {
    const s = deserialize(fixture('v5.json'));
    expect(shelfOpen(s)).toBe(true);
    // Everything but the gentleman's ticket: he has not signed on in this save.
    expect(newRumours(s).map((r) => r.id)).toEqual(['isoldes-spectacles', 'cork-float', 'tide-table', 'packet-ticket', 'fen-light-jar', 'isolde-log-sump', 'stopped-watch']);
    expect(newRumours(s)).toEqual([]);
    expect(shelf(s).filter((p) => p.state === 'found').length).toBe(4);
    expect(shelf(s).find((p) => p.relic.id === 'return-half')!.state).toBe('empty');
    // They have landed their dozen long ago: things come up from the first casts.
    expect(findChance({ ...s, finds: { ...s.finds, dry: FINDS.gap } })).toBeGreaterThan(0);
  });

  it('a save made at sea by v0.5.0, with both hands aboard and every basket part full, is played on with today\'s rules', () => {
    // Made by the v0.5.0 simulator's keeper (seed 3): 239 minutes in, in the Fen aboard the Puffin, with fish in
    // the hold, the pot basket and the crew basket, four pots out and three pearls never used.
    const text = fixture('v5-hands.json'), old = raw(text).state;
    expect(raw(text).version).toBe(5);
    const s = deserialize(text);
    for (const k of KEPT) expect(s[k], k).toEqual(old[k]);
    expect(s.boats.current).toBe('puffin');
    expect(s.crew.hired).toEqual(['biscuit', 'hollis']);
    expect(basket(s).fish).toBe(old.crew.hold.length);
    expect(s.hold.length).toBeGreaterThan(0);
    expect(s.pots.placed.length).toBe(4);
    expect(pearlsFree(s)).toBe(3);
    // An hour and a half more of it: crates come up, relics come up, pearls are set, and nothing that was there is lost.
    const before = { coins: s.lifetime.coins, catches: s.lifetime.catches, relics: [...s.relics] };
    const p = new SimPlayer({ seed: 9, skill: 0.7, minutes: s.playTime / 60 + 90 }, s);
    const r = p.run();
    expect(r.state.version).toBe(SAVE_VERSION);
    expect(r.totals.finds).toBeGreaterThan(4);
    expect(r.state.finds.crates).toBeGreaterThan(2);
    expect(r.state.relics.length).toBeGreaterThan(before.relics.length);
    for (const id of before.relics) expect(r.state.relics).toContain(id);
    expect(r.state.lifetime.coins).toBeGreaterThan(before.coins);
    expect(r.state.lifetime.catches).toBeGreaterThan(before.catches);
    expect(pearlsFree(r.state)).toBe(0);
    expect(Object.values(r.state.pearls).reduce((a, b) => a + b, 0)).toBe(r.state.moonpearls);
    expect(deserialize(serialize(r.state))).toEqual(r.state);
  }, 120000);
});
