import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TESTER_FILE, testerSaveText } from '../tools/tester-save';
import { deserialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { hasFogLamp } from '../src/core/gear';
import { currentGoal, questStatus } from '../src/core/quests';
import { regionOfPlace } from '../src/core/content';

/** Numbers to six places, so the last bit of a sum on another machine is not a difference. */
const rounded = (text: string) => JSON.stringify(JSON.parse(text, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));

describe("the tester's start", () => {
  const text = readFileSync(TESTER_FILE, 'utf8');

  it('is the save the rules give today (if not: npm run tester-save)', () => {
    expect(rounded(text)).toBe(rounded(testerSaveText()));
  }, 60000);

  it('loads as a save of this version, on the home dock with the lamp and the road job', () => {
    const s = deserialize(text);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.world.region).toBe('hearthbay');
    expect(s.world.onBoat).toBe(false);
    expect(hasFogLamp(s)).toBe(true);
    expect(s.boats.owned).toContain('skiff');
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
});
