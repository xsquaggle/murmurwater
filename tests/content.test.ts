import { describe, expect, it } from 'vitest';
import { validateContent, zoneAt, REGIONS, inHours } from '../src/core/content';

describe('content', () => {
  it('validates', () => { expect(validateContent()).toEqual([]); });
  it('zones resolve by priority', () => {
    const hb = REGIONS[0];
    expect(zoneAt(hb, -100, 22)?.id).toBe('hb-dock');
    expect(zoneAt(hb, -275, 245)?.id).toBe('hb-teeth');
    expect(zoneAt(hb, 300, 300)?.id).toBe('hb-open');
  });
  it('hour ranges wrap midnight', () => {
    expect(inHours(23, [19, 5])).toBe(true);
    expect(inHours(3, [19, 5])).toBe(true);
    expect(inHours(12, [19, 5])).toBe(false);
    expect(inHours(12, [6, 18])).toBe(true);
  });
});
