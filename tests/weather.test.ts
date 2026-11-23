import { describe, expect, it } from 'vitest';
import { FISH, ROADS, REGIONS, fish, rod, roadOpen, roadTooRough, roadsOpen, validateContent } from '../src/core/content';
import { ROUGH, FishingSession, NO_INPUT, fishTable } from '../src/core/fishing';
import { STORM, STRUCK, hoursOf, inWeather, nextStorm, sayHour, stormsOf, weatherAt } from '../src/core/weather';
import { stats } from '../src/core/gear';
import { newGame, type GameState } from '../src/core/state';
import { placePot, potInterval, potRolled, potTable, tickPots } from '../src/core/pots';
import { CREW_BY_ID, crewTable, sheltering, working, type CrewEnv } from '../src/core/crew';
import { QUESTS_BY_ID, accept, objectiveProgress, onQuestEvent } from '../src/core/quests';
import { RELICS_BY_ID, relicsHere } from '../src/core/relics';
import { BOATS_BY_ID } from '../src/core/quests';
import { Rng } from '../src/core/rng';
import { almanacLine } from '../src/game/storms';
import { ctx } from './helpers';

const REACH = 'saltbone-reach';
const names = (hour: number, zone: string, flags: string[] = [], struck = false) =>
  fishTable(ctx({ region: REACH, hour, flags: new Set(flags) }), { zoneId: zone, depth: 5, hotspot: false, struck }).map((x) => x.fish.id).sort();
const know = (s: GameState, ...ids: string[]) => { for (const id of ids) s.journal[id] = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 }; };

describe('storms that keep hours', () => {
  it('the Reach has three, at the same hours of every day, and the older waters have none', () => {
    expect(validateContent()).toEqual([]);
    expect(stormsOf(REACH).map((s) => [s.name, ...s.hours])).toEqual([['Old Margit', 5.5, 7.5], ['the Deacon', 14, 18.5], ['Little Wren', 22.5, 1]]);
    for (const r of REGIONS) if (r.id !== REACH) { expect(stormsOf(r.id)).toEqual([]); for (let h = 0; h < 24; h += 0.5) expect(weatherAt(r.id, h).power).toBe(0); }
    // Fair weather between them; each blows at its own strength at its height.
    for (const h of [2, 4, 9, 12, 13.5, 20, 22]) expect(weatherAt(REACH, h)).toMatchObject({ storm: null, power: 0, rain: 0, thunder: false });
    expect(weatherAt(REACH, 6.5)).toMatchObject({ power: 0.7, thunder: false });
    expect(weatherAt(REACH, 14.75).power).toBe(1);
    expect(weatherAt(REACH, 23.75).power).toBeCloseTo(0.6, 5);
  });

  it('a storm comes up and blows out by degrees, and is let down in its eye', () => {
    // Coming up: nothing on the stroke, all of it a third of an hour in.
    expect(weatherAt(REACH, 14).power).toBe(0);
    expect(weatherAt(REACH, 14 + STORM.ramp / 2).power).toBeCloseTo(0.5, 5);
    expect(weatherAt(REACH, 14 + STORM.ramp).power).toBe(1);
    expect(weatherAt(REACH, 18.5 - STORM.ramp / 2).power).toBeCloseTo(0.5, 5);
    // It never jumps: no step of a minute of the clock moves it by more than a little.
    let last = weatherAt(REACH, 0).power;
    for (let h = 0; h <= 24; h += 1 / 60) { const p = weatherAt(REACH, h % 24).power; expect(Math.abs(p - last)).toBeLessThan(0.12); last = p; }
    // The Deacon's eye: nearly still, no rain to speak of, no lightning.
    const eye = weatherAt(REACH, 16.25);
    expect(eye.storm?.id).toBe('deacon');
    expect(eye.eye).toBe(1);
    expect(eye.power).toBeCloseTo(STORM.eyePower, 5);
    expect(eye.thunder).toBe(false);
    // Lightning before the eye and after it, and none in Old Margit at all.
    expect(weatherAt(REACH, 15).thunder).toBe(true);
    expect(weatherAt(REACH, 17.8).thunder).toBe(true);
    expect(weatherAt(REACH, 6.5).thunder).toBe(false);
    // Little Wren is a dry storm: lightning, wind, and hardly any rain.
    const wren = weatherAt(REACH, 23.75);
    expect(wren.thunder).toBe(true);
    expect(wren.rain).toBeCloseTo(wren.power * STORM.dryRain, 5);
  });

  it('what waits on the weather is met in it: a storm, lightning, the eye', () => {
    expect(inWeather(REACH, 12)).toBe(true); // nothing waited for
    expect([6, 15, 16.25, 23, 12].map((h) => inWeather(REACH, h, 'storm'))).toEqual([true, true, false, true, false]);
    expect([6, 15, 16.25, 23, 12].map((h) => inWeather(REACH, h, 'thunder'))).toEqual([false, true, false, true, false]);
    expect([6, 15, 16.25, 23, 12].map((h) => inWeather(REACH, h, 'eye'))).toEqual([false, false, true, false, false]);
    expect(inWeather('hearthbay', 15, 'storm')).toBe(false);
    // A day has seven and a half hours of storm, five and a half of them with lightning, and an hour and a half of eye.
    expect(hoursOf(REACH, 'storm')).toBeCloseTo(7.5, 0);
    expect(hoursOf(REACH, 'thunder')).toBeCloseTo(5.5, 0);
    expect(hoursOf(REACH, 'eye')).toBeCloseTo(1.5, 0);
  });

  it('the almanac knows what is coming and says the hour in words', () => {
    expect(nextStorm(REACH, 8)).toMatchObject({ storm: { id: 'deacon' }, inHours: 6 });
    expect(nextStorm(REACH, 20)!.storm.id).toBe('wren');
    expect(nextStorm(REACH, 2)).toMatchObject({ storm: { id: 'margit' }, inHours: 3.5 });
    // In a storm it is the one after that is next.
    expect(nextStorm(REACH, 15)!.storm.id).toBe('wren');
    expect(nextStorm(REACH, 23.5)!.storm.id).toBe('margit');
    expect(nextStorm('hearthbay', 8)).toBeNull();
    expect([5.5, 14, 22.5, 12, 0, 18.5, 1].map(sayHour)).toEqual(['half past five in the morning', 'two in the afternoon', 'half past ten at night', 'noon', 'midnight', 'half past six in the evening', 'one at night']);
  });

  it('one rule at every edge: what is said, what stops, what bites and where the bolts fall change at the same moment', () => {
    // A fresh review found a few seconds at every edge where the lightning had stopped and its fish still bit,
    // and where the hands were fishing in the eye under bolts. The weather's own word and what waits on it must agree.
    for (let i = 0; i < 24 * 400; i++) {
      const h = i / 400, w = weatherAt(REACH, h);
      expect(w.thunder, `thunder at ${h}`).toBe(inWeather(REACH, h, 'thunder'));
      expect(w.inEye, `the eye at ${h}`).toBe(inWeather(REACH, h, 'eye'));
      expect(!!w.storm && !w.inEye, `a storm at ${h}`).toBe(inWeather(REACH, h, 'storm'));
      // The Thunderback is in the water exactly while bolts can fall, the Lull exactly while the eye is over.
      expect(names(h, 'reach-anvil').includes('thunderback'), `the Thunderback at ${h}`).toBe(w.thunder);
      expect(potRolled(REACH, h), `the pots at ${h}`).toBe(!!w.storm && !w.inEye);
    }
    // The look of it is eased (so it lags the rule by a few seconds), and never the other way about.
    expect(weatherAt(REACH, 14.01)).toMatchObject({ thunder: true });
    expect(weatherAt(REACH, 14.01).power).toBeLessThan(0.05);
    expect(weatherAt(REACH, 15.51)).toMatchObject({ thunder: false, inEye: true });
    expect(weatherAt(REACH, 15.51).eye).toBeLessThan(0.1);
  });

  it('the almanac\'s line on the screen says what is on and what is next, all round the clock', () => {
    const line = (h: number) => almanacLine(REACH, h);
    expect(line(2)).toEqual({ text: 'Fair · Old Margit in 4 min', kind: 'fair' });
    expect(line(5.2)).toEqual({ text: 'Fair · Old Margit in under a minute', kind: 'fair' });
    expect(line(6)).toEqual({ text: 'Old Margit · blows out in 2 min', kind: 'storm' });
    expect(line(10)).toEqual({ text: 'Fair · the Deacon in 4 min', kind: 'fair' });
    expect(line(14.2)).toEqual({ text: 'The Deacon · the eye in 1 min', kind: 'storm' });
    // The eye is on the line from the moment the pots and the hands fish again, and off it the moment they stop.
    expect(line(15.49)!.kind).toBe('storm');
    expect(line(15.5)).toEqual({ text: 'Eye of the Deacon · closes in 2 min', kind: 'eye' });
    expect(line(16.99)).toEqual({ text: 'Eye of the Deacon · closes in under a minute', kind: 'eye' });
    expect(line(17)).toEqual({ text: 'The Deacon · blows out in 2 min', kind: 'storm' });
    expect(line(18.49)!.text).toBe('The Deacon · blows out in under a minute');
    expect(line(18.5)).toEqual({ text: 'Fair · Little Wren in 4 min', kind: 'fair' });
    // Across midnight.
    expect(line(23.5)).toEqual({ text: 'Little Wren · blows out in 2 min', kind: 'storm' });
    expect(line(0.5)).toEqual({ text: 'Little Wren · blows out in under a minute', kind: 'storm' });
    expect(line(1)).toEqual({ text: 'Fair · Old Margit in 5 min', kind: 'fair' });
    // Every hour of the day has a line in the Reach, and a water without storms has none.
    for (let i = 0; i < 24 * 20; i++) expect(line(i / 20), `at ${i / 20}`).not.toBeNull();
    expect(almanacLine('hearthbay', 12)).toBeNull();
    expect(almanacLine('mossglass-fen', 15)).toBeNull();
  });
});

describe('what the weather brings to a line', () => {
  it('each of the Reach\'s fish that keeps weather bites in it and at no other time', () => {
    for (const f of FISH) if (f.weather) expect(f.region).toBe(REACH);
    // The Squall Mackerel: any storm, its eye apart.
    expect(names(12, 'reach-open')).not.toContain('squall-mackerel');
    expect(names(6.5, 'reach-open')).toContain('squall-mackerel');
    expect(names(16.25, 'reach-open')).not.toContain('squall-mackerel');
    // The Thunderback: lightning, at the Anvil.
    expect(names(6.5, 'reach-anvil')).not.toContain('thunderback');
    expect(names(15, 'reach-anvil')).toContain('thunderback');
    expect(names(15, 'reach-ribs')).not.toContain('thunderback');
    // The Lull: the eye, at the Tally Stone, once the count has been read.
    expect(names(16.25, 'reach-tally')).not.toContain('the-lull');
    expect(names(16.25, 'reach-tally', ['reach-counted'])).toContain('the-lull');
    expect(names(15, 'reach-tally', ['reach-counted'])).not.toContain('the-lull');
    // Old Greyback keeps noon, on the Long Swell.
    expect(names(12, 'reach-swell')).toContain('old-greyback');
    expect(names(9, 'reach-swell')).not.toContain('old-greyback');
    // In fair weather by day the Ribs still have something worth the sail.
    expect(names(10, 'reach-ribs')).toEqual(['bonefin-herring', 'ribfish', 'thrift-wrasse']);
    expect(fish('ribfish').rarity).toBe('rare');
  });

  it('struck water: a quick bite, a great deal of luck, and the catch is marked', () => {
    const plain = fishTable(ctx({ region: REACH, hour: 15, rod: rod('fenwood-rod') }), { zoneId: 'reach-anvil', depth: 5, hotspot: false });
    const lit = fishTable(ctx({ region: REACH, hour: 15, rod: rod('fenwood-rod') }), { zoneId: 'reach-anvil', depth: 5, hotspot: false, struck: true });
    const share = (t: typeof plain, id: string) => t.find((x) => x.fish.id === id)!.weight / t.reduce((a, x) => a + x.weight, 0);
    expect(share(lit, 'thunderback')).toBeGreaterThan(2 * share(plain, 'thunderback'));
    expect(share(lit, 'slate-pout')).toBeLessThan(share(plain, 'slate-pout'));
    // The wait: the same dice, three tenths of the time.
    const wait = (struck: boolean) => {
      const s = new FishingSession(ctx({ region: REACH, hour: 15, spot: () => ({ zoneId: 'reach-anvil', depth: 5, hotspot: false, struck }) }), new Rng(4));
      s.update(1 / 60, { ...NO_INPUT, primary: true, primaryPressed: true });
      for (let i = 0; i < 600 && s.phase === 'charging'; i++) s.update(1 / 60, s.power >= 0.9 ? { ...NO_INPUT, primaryReleased: true } : { ...NO_INPUT, primary: true });
      for (let i = 0; i < 600 && s.phase === 'casting'; i++) s.update(1 / 60, NO_INPUT);
      expect(s.phase).toBe('waiting');
      return s.biteIn;
    };
    expect(wait(true)).toBeCloseTo(wait(false) * STRUCK.wait, 5);
    // A fish out of struck water says so, and only such a fish counts toward Captain Oake's job.
    const s = newGame(3);
    s.quests.done.push('reach-03-margit');
    expect(accept(s, 'reach-04-lightning')).toBe(true);
    const q = QUESTS_BY_ID.get('reach-04-lightning')!;
    onQuestEvent(s, { type: 'catch', fishId: 'slate-pout', weight: 1, trait: null, perfect: false });
    expect(objectiveProgress(s, q, 0)).toBe(0);
    onQuestEvent(s, { type: 'catch', fishId: 'slate-pout', weight: 1, trait: null, perfect: false, struck: true });
    expect(objectiveProgress(s, q, 0)).toBe(1);
  });

  it('a fish hooked at the height of a storm pulls harder, and no harder in the eye or in fair weather', () => {
    const rough = (hour: number, region = REACH) => {
      const s = new FishingSession(ctx({ region, hour, rod: rod('fenwood-rod') }), new Rng(2));
      (s as unknown as { castDistance: number }).castDistance = 20;
      (s as unknown as { startFight: (f: unknown, p: boolean) => void }).startFight(fish('slate-pout'), false);
      return s.fight!.rough!;
    };
    expect(rough(12)).toBe(1);
    expect(rough(14.75)).toBeCloseTo(1 + ROUGH, 5);
    expect(rough(6.5)).toBeCloseTo(1 + ROUGH * 0.7, 5);
    expect(rough(16.25)).toBeLessThan(1.02);
    expect(rough(14.75, 'hearthbay')).toBe(1);
  });

  it('gear that waits for a storm works in one: the Petrel Feather, and St. Elmo\'s Bead draws the lightning', () => {
    const s = newGame(3);
    s.gear.lures.push('petrel-feather'); s.gear.lure = 'petrel-feather';
    const fair = stats(s, { hour: 12, storm: false }), storm = stats(s, { hour: 15, storm: true });
    expect(storm.biteSpeed).toBeGreaterThan(fair.biteSpeed * 1.3);
    expect(storm.luck).toBeCloseTo(fair.luck + 0.12, 5);
    expect(fair.strikes).toBe(1);
    s.gear.wearables.push('st-elmos-bead'); s.gear.worn.charm = 'st-elmos-bead';
    expect(stats(s, { hour: 15, storm: true }).strikes).toBeCloseTo(1.4, 5);
  });

  it('a relic that lies in weather comes to a line only in it', () => {
    const s = newGame(3);
    const glass = RELICS_BY_ID.get('storm-glass')!;
    expect(glass.where?.weather).toBe('storm');
    s.quests.done.push(...['reach-01-hours', 'reach-02-ribs', 'reach-03-margit']);
    s.flags.push('rumour:storm-glass');
    const here = (hour: number) => relicsHere(s, REACH, 'reach-anvil', hour).map((r) => r.id);
    expect(here(15)).toContain('storm-glass');
    expect(here(12)).not.toContain('storm-glass');
    expect(here(16.25)).not.toContain('storm-glass');
  });
});

describe('a storm is the keeper\'s own', () => {
  it('pots take nothing while it blows, fish again in the eye, and never trap a fish of the storm', () => {
    const s = newGame(3);
    s.world.region = REACH; s.pots.owned = 1;
    know(s, 'slate-pout', 'kettle-cod', 'squall-mackerel', 'thunderback');
    const pot = placePot(s, 'reach-anvil', 1441, -869)!;
    expect(pot).not.toBeNull();
    const every = potInterval(stats(s));
    expect(potRolled(REACH, 15)).toBe(true);
    expect(potRolled(REACH, 16.25)).toBe(false);
    expect(potRolled('hearthbay', 15)).toBe(false);
    // A whole storm's worth of time at its height: nothing, and the clock has not been run on behind its back.
    expect(tickPots(s, every * 3, 15)).toBe(0);
    expect(pot.fish).toEqual([]);
    expect(tickPots(s, every - 1, 12)).toBe(0);
    expect(tickPots(s, 2, 12)).toBe(1);
    // In the eye it fishes; and nothing that only bites in a storm is ever in a pot's reach.
    expect(tickPots(s, every, 16.25)).toBe(1);
    for (let h = 0; h < 24; h += 0.25) if (!potRolled(REACH, h)) for (const f of potTable(s, pot, h)) expect(f.weather, `${f.id} in a pot at ${h}`).toBeUndefined();
  });

  it('nobody else aboard fishes in it: the hands shelter, and take it up again in the eye', () => {
    const env = (hour: number, region = REACH): CrewEnv => ({ region, zone: 'reach-open', hour, fog: 0, still: true });
    const cat = CREW_BY_ID.get('biscuit')!, hollis = CREW_BY_ID.get('hollis')!;
    expect(working(cat, env(12))).toBe(true);
    expect(working(cat, env(15))).toBe(false);
    expect(working(cat, env(16.25))).toBe(true);
    expect(working(cat, env(6.5))).toBe(false);
    // Mister Hollis fishes after dark: Little Wren takes the first of his night from him.
    expect(working(hollis, env(23.5))).toBe(false);
    expect(working(hollis, env(2))).toBe(true);
    expect(sheltering(env(15))).toBe(true);
    expect(sheltering(env(15, 'hearthbay'))).toBe(false);
    // So nothing of the storm's is ever in a hand's reach either.
    const s = newGame(3);
    know(s, ...FISH.filter((f) => f.region === REACH).map((f) => f.id));
    s.flags.push('reach-counted');
    for (let h = 0; h < 24; h += 0.25) if (!sheltering(env(h))) for (const f of crewTable(s, hollis, env(h))) expect(f.weather === 'storm' || f.weather === 'thunder', `${f.id} at ${h}`).toBe(false);
  });
});

describe('the whale-road', () => {
  const road = ROADS.find((r) => r.id === 'hearthbay-reach')!;
  const mid: [number, number] = [(road.a[0] + road.b[0]) / 2, (road.a[1] + road.b[1]) / 2];
  const skiff = BOATS_BY_ID.get('skiff')!.hull, puffin = BOATS_BY_ID.get('puffin')!.hull;

  it('wants a bigger boat than the skiff: open to the Puffin, shut to the skiff, and the skiff is told why', () => {
    expect(road.hull).toBe(2);
    expect([skiff, puffin]).toEqual([1, 2]);
    expect(roadOpen(road, mid[0], mid[1])).toBe(1);
    for (const region of road.between) {
      expect(roadsOpen(region, mid[0], mid[1], puffin)).toBe(1);
      expect(roadsOpen(region, mid[0], mid[1], skiff)).toBe(0);
      expect(roadTooRough(region, mid[0], mid[1], skiff)?.id).toBe('hearthbay-reach');
      expect(roadTooRough(region, mid[0], mid[1], puffin)).toBeNull();
    }
    expect(road.tooRough).toMatch(/bigger boat/);
    // Off the road nobody is told anything.
    expect(roadTooRough('hearthbay', 0, 0, skiff)).toBeNull();
  });

  it('leaves the old sea-road as it was: any boat with the lamp may take it', () => {
    const old = ROADS.find((r) => r.id !== 'hearthbay-reach')!;
    const m: [number, number] = [(old.a[0] + old.b[0]) / 2, (old.a[1] + old.b[1]) / 2];
    expect(old.hull).toBeUndefined();
    expect(roadsOpen('hearthbay', m[0], m[1], skiff)).toBe(1);
    expect(roadTooRough('hearthbay', m[0], m[1], skiff)).toBeNull();
  });
});
