import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TESTER_STARTS, testerFile, testerSaveText } from '../tools/tester-save';
import { deserialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { boatOnOffer, hasFogLamp } from '../src/core/gear';
import { berthFor, isAboard } from '../src/core/crew';
import { BOATS_BY_ID, currentGoal, npcOffer, questStatus } from '../src/core/quests';
import { hullFor, regionOfNpc, regionOfPlace } from '../src/core/content';
import { FINDS, findChance } from '../src/core/finds';
import { newRumours, pearlsFree, relicsHere } from '../src/core/relics';

/** Numbers to six places, so the last bit of a sum on another machine is not a difference. */
const rounded = (text: string) => JSON.stringify(JSON.parse(text, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));

describe("the tester's starts", () => {
  for (const id of TESTER_STARTS) {
    it(`${id}: is the save the rules give today (if not: npm run tester-save)`, () => {
      expect(rounded(readFileSync(testerFile(id), 'utf8'))).toBe(rounded(testerSaveText(id)));
    }, 120000);
  }

  it('reach: loads on the home dock in late morning with the Puffin afloat, both hands aboard and the whale-road job in hand', () => {
    const s = deserialize(readFileSync(testerFile('reach'), 'utf8'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.world.region).toBe('hearthbay');
    expect(s.world.onBoat).toBe(false);
    expect(s.hour).toBeGreaterThan(11);
    expect(s.hour).toBeLessThan(12.5);
    // The Puffin can take the whale-road's swell; the skiff could not.
    expect(s.boats.current).toBe('puffin');
    expect(BOATS_BY_ID.get('puffin')!.hull).toBeGreaterThanOrEqual(hullFor('saltbone-reach'));
    expect(BOATS_BY_ID.get('skiff')!.hull).toBeLessThan(hullFor('saltbone-reach'));
    expect(isAboard(s, 'biscuit')).toBe(true);
    expect(isAboard(s, 'hollis')).toBe(true);
    // The job is in hand and the Reach not yet found; nobody there has been met.
    expect(questStatus(s, 'hb-14-whale-road')).toBe('active');
    expect(s.flags).not.toContain('reached:saltbone-reach');
    expect(s.flags).not.toContain('met-oake');
    expect(s.flags).not.toContain('almanac');
    for (const flag of ['puffin-afloat', 'reached:mossglass-fen', 'met-hollis']) expect(s.flags).toContain(flag);
    // Nobody at home has another job to press on her first, and the goal line speaks of the road.
    expect(npcOffer(s, 'pell').kind).not.toBe('offer');
    expect(currentGoal(s).text).toMatch(/whale-road|Reach|Oake/i);
  });

  it('finds: loads on the home dock at nightfall with everything before it done, nothing found, and every rumour to hear', () => {
    const s = deserialize(readFileSync(testerFile('finds'), 'utf8'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.world.region).toBe('hearthbay');
    expect(s.world.onBoat).toBe(false);
    // The slice before is done: the Puffin floats, and both hands have their berths in her.
    expect(s.boats.current).toBe('puffin');
    expect(isAboard(s, 'biscuit')).toBe(true);
    expect(isAboard(s, 'hollis')).toBe(true);
    for (const id of ['hb-13-refit', 'fen-s1-gentleman', 'fen-06-post']) expect(questStatus(s, id), id).toBe('done');
    // Nothing has ever come up but fish: the four relics that were given, pearls nobody has set, no cast counted.
    expect(s.finds).toEqual({ casts: 0, dry: 0, crates: 0, chests: 0, near: {} });
    expect(s.relics).toEqual(['wicks-drawing', 'keepers-kettle', 'isolde-log-fen', 'calloway-tape']);
    expect(s.pearls).toEqual({});
    expect(pearlsFree(s)).toBe(3);
    expect(s.gear.lures).not.toContain('mirror-spoon');
    expect(s.gear.wearables).not.toContain('dowsers-bob');
    // Every rumour is still to hear, all eight, and the first can be followed where she stands: it is night,
    // and the spectacles lie in the cove beside the dock.
    expect(s.flags.filter((f) => f.startsWith('rumour:'))).toEqual([]);
    expect(newRumours(s).length).toBe(8);
    expect(relicsHere(s, 'hearthbay', 'hb-bay', s.hour).map((r) => r.id)).toEqual(['isoldes-spectacles']);
    expect(findChance({ ...s, finds: { ...s.finds, dry: FINDS.gap } })).toBeGreaterThan(0);
    for (const flag of ['met-mara', 'met-pell', 'met-wick', 'met-calloway', 'met-hollis', 'kettle-taken']) expect(s.flags).toContain(flag);
  });

  it('fen: loads as a save of this version, on the home dock with the lamp and the road job', () => {
    const s = deserialize(readFileSync(testerFile('fen'), 'utf8'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.world.region).toBe('hearthbay');
    expect(s.world.onBoat).toBe(false);
    expect(hasFogLamp(s)).toBe(true);
    expect(s.boats.owned).toEqual(['skiff']);
    expect(questStatus(s, 'hb-11-lamp')).toBe('done');
    expect(questStatus(s, 'hb-12-road')).toBe('active');
    expect(s.flags).not.toContain('reached:mossglass-fen');
    // What only the game notes down: she has met the three of Hearthbay and taken the kettle.
    for (const flag of ['met-mara', 'met-pell', 'met-wick', 'kettle-taken']) expect(s.flags).toContain(flag);
    expect(s.flags).not.toContain('met-calloway');
    // The goal line sends her across: to a place of the other water.
    const goal = currentGoal(s);
    expect(goal.place && regionOfPlace(goal.place)).toBe('mossglass-fen');
  });

  it('crew: loads on the home dock with the cat aboard, the wreck found, the price of the Puffin in hand and a gentleman waiting', () => {
    const s = deserialize(readFileSync(testerFile('crew'), 'utf8'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.world.region).toBe('hearthbay');
    expect(s.world.onBoat).toBe(false);
    expect(hasFogLamp(s)).toBe(true);
    // One boat, one berth, and the cat is in it: the gentleman has to wait for the Puffin.
    expect(s.boats.owned).toEqual(['skiff']);
    expect(s.boats.current).toBe('skiff');
    expect(isAboard(s, 'biscuit')).toBe(true);
    expect(berthFor(s, 'hollis')).toBe(false);
    expect(s.crew.hold).toEqual([]);
    // The wreck is found and Pell will do the work: the boat is on offer and can be paid for at once.
    for (const flag of ['puffin-found', 'boatyard-open', 'reached:mossglass-fen']) expect(s.flags).toContain(flag);
    expect(s.flags).not.toContain('puffin-afloat');
    expect(questStatus(s, 'fen-03b-wreck')).toBe('done');
    expect(questStatus(s, 'hb-13-refit')).toBe('active');
    expect(boatOnOffer(s, 'puffin')).toBe(true);
    expect(s.coins).toBeGreaterThanOrEqual(BOATS_BY_ID.get('puffin')!.price);
    // The gentleman has been spoken of, not yet spoken to: he is out on the road, in the other water.
    expect(questStatus(s, 'fen-s1-gentleman')).toBe('active');
    expect(regionOfNpc('hollis')).toBe('mossglass-fen');
    for (const flag of ['met-mara', 'met-pell', 'met-wick', 'met-calloway', 'kettle-taken']) expect(s.flags).toContain(flag);
    expect(s.flags).not.toContain('met-hollis');
    // Nobody at home has a job to press on her first, and the goal line speaks of the boat.
    expect(npcOffer(s, 'pell').kind).not.toBe('offer');
    expect(currentGoal(s).text).toMatch(/Puffin/);
  });
});
