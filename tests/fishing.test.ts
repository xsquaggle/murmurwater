import { describe, expect, it } from 'vitest';
import { FishingSession, NO_INPUT, FEEL } from '../src/core/fishing';
import { Rng } from '../src/core/rng';
import { FISH, fish } from '../src/core/content';
import { ctx, playFight } from './helpers';

const DT = 1 / 60;
const run = (s: FishingSession, secs: number, inp = NO_INPUT) => { for (let i = 0; i < secs * 60; i++) s.update(DT, inp); };

describe('cast', () => {
  it('charging then releasing in the sweet spot gives a clean cast', () => {
    const s = new FishingSession(ctx(), new Rng(1));
    s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
    expect(s.phase).toBe('charging');
    while (s.power < 0.88) s.update(DT, { ...NO_INPUT, primary: true });
    s.update(DT, { ...NO_INPUT, primary: false, primaryReleased: true });
    expect(s.phase).toBe('casting');
    expect(s.cleanCast).toBe(true);
    expect(s.castDistance).toBeGreaterThan(14);
  });
  it('a tap is not a cast', () => {
    const s = new FishingSession(ctx(), new Rng(1));
    s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
    s.update(DT, { ...NO_INPUT, primaryReleased: true });
    expect(s.phase).toBe('idle');
  });
});

function castAndWaitForBite(seed: number) {
  const s = new FishingSession(ctx(), new Rng(seed));
  s.update(DT, { ...NO_INPUT, primary: true, primaryPressed: true });
  while (s.power < 0.7) s.update(DT, { ...NO_INPUT, primary: true });
  s.update(DT, { ...NO_INPUT, primaryReleased: true });
  for (let i = 0; i < 60 * 40 && s.phase !== 'bite'; i++) s.update(DT, NO_INPUT);
  return s;
}

describe('bite and hook', () => {
  it('a bite always comes within the max wait', () => {
    for (let seed = 1; seed < 40; seed++) expect(castAndWaitForBite(seed).phase).toBe('bite');
  });
  it('hooking immediately is perfect; missing the window returns to waiting', () => {
    const s = castAndWaitForBite(3);
    s.update(DT, { ...NO_INPUT, primaryPressed: true, primary: true });
    expect(s.phase).toBe('fighting');
    expect(s.fight!.perfect).toBe(true);
    const s2 = castAndWaitForBite(4);
    run(s2, 2.5);
    expect(['waiting', 'bite']).toContain(s2.phase);
    expect(s2.events.some((e) => e.type === 'missed')).toBe(true);
  });
  it('pressing during the wait is penalised, not a hook', () => {
    const s = new FishingSession(ctx(), new Rng(9));
    (s as any).startWait(false);
    s.update(DT, { ...NO_INPUT, primaryPressed: true, primary: true });
    expect(s.phase).toBe('waiting');
    expect(s.events.some((e) => e.type === 'tooEarly')).toBe(true);
  });
});

describe('fight', () => {
  it('a skilled player lands every Hearthbay fish with the starter rod most of the time', () => {
    for (const f of FISH) {
      let wins = 0, total = 0, times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const r = playFight(f, { seed });
        total++;
        if (r.phase === 'landed') { wins++; times.push(r.time); }
      }
      const rate = wins / total;
      // Rarer fish are harder with the starter rod; commons must be near-certain.
      const floor = f.rarity === 'common' ? 0.95 : f.rarity === 'uncommon' ? 0.85 : f.rarity === 'rare' ? 0.6 : 0.25;
      expect(rate, `${f.id} win rate ${rate}`).toBeGreaterThanOrEqual(floor);
    }
  });
  it('mashing the reel snaps the line on strong fish', () => {
    const r = playFight(fish('moss-eel'), { seed: 2, policy: 'mash' });
    expect(r.phase).toBe('lost');
    expect((r.ev as any).reason).toBe('snap');
  });
  it('doing nothing loses the fish to slack', () => {
    const r = playFight(fish('butterperch'), { seed: 2, policy: 'idle' });
    expect(r.phase).toBe('lost');
    expect((r.ev as any).reason).toBe('slack');
  });
  it('common fights are short, legendary fights are long', () => {
    const c = playFight(fish('butterperch'), { seed: 5 });
    expect(c.time).toBeGreaterThan(2);
    expect(c.time).toBeLessThan(14);
    const times: number[] = [];
    for (let seed = 1; seed < 20; seed++) { const r = playFight(fish('hollow-lantern'), { seed, rodId: 'gullwing-rod' }); if (r.phase === 'landed') times.push(r.time); }
    expect(times.length).toBeGreaterThan(5);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeGreaterThan(12);
  });
  it('FEEL constants are sane', () => { expect(FEEL.sweetSpot[0]).toBeLessThan(FEEL.sweetSpot[1]); });
});

import { playFightHuman } from './helpers';
describe('difficulty curve (human-like player, skill 0.7)', () => {
  const rate = (id: string, rodId: string) => {
    let w = 0; for (let seed = 1; seed <= 40; seed++) if (playFightHuman(fish(id), { seed, rodId }).phase === 'landed') w++;
    return w / 40;
  };
  it('commons are near-certain with the starter rod', () => { expect(rate('kettle-carp', 'driftwood-rod')).toBeGreaterThanOrEqual(0.97); });
  it('legendaries need better gear', () => {
    expect(rate('hollow-lantern', 'driftwood-rod')).toBeLessThan(0.7);
    expect(rate('hollow-lantern', 'gullwing-rod')).toBeGreaterThan(0.85);
  });
});
