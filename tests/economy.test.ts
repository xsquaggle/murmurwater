import { describe, expect, it } from 'vitest';
import { addCatch, catchValue, fmt, sellAll } from '../src/core/economy';
import { newGame } from '../src/core/state';

const c = (over = {}) => ({ fishId: 'butterperch', weight: 0.8, sizeFactor: 1, trait: null, perfectHook: false, cleanCast: false, fightTime: 5, ...over });

describe('economy', () => {
  it('values scale with traits, rhythm and perfect hooks', () => {
    const s = newGame(1);
    const base = catchValue(s, c());
    expect(catchValue(s, c({ trait: 'inverted' }))).toBeGreaterThan(base * 7);
    expect(catchValue(s, c({ perfectHook: true }))).toBeGreaterThanOrEqual(base);
    s.rhythm = 10;
    expect(catchValue(s, c())).toBeGreaterThan(base);
  });
  it('fills the hold, records the journal, sells', () => {
    const s = newGame(1);
    const r = addCatch(s, c());
    expect(r.firstCatch).toBe(true);
    expect(s.hold.length).toBe(1);
    expect(addCatch(s, c({ weight: 1.2 })).newRecord).toBe(true);
    s.holdCapacity = 2;
    expect(addCatch(s, c()).holdFull).toBe(true);
    const total = sellAll(s);
    expect(total).toBeGreaterThan(0);
    expect(s.coins).toBe(total);
    expect(s.hold.length).toBe(0);
    expect(s.journal['butterperch'].caught).toBe(3);
  });
  it('formats numbers', () => {
    expect(fmt(950)).toBe('950'); expect(fmt(1234)).toBe('1.23K'); expect(fmt(12_345_678)).toBe('12.3M');
  });
});
