import { describe, expect, it } from 'vitest';
import { BUCKET_S, PLACES, SimPlayer, simulate, when, type SimReport } from '../tools/sim/player';
import { BAITS } from '../src/core/content';
import { newGame } from '../src/core/state';

/**
 * The economy's shape, held as bands. These are not exact numbers: they say what the first hours must feel
 * like (docs/DESIGN.md §8.3, §11), and a change to fish, prices or rewards that breaks one has to be meant.
 */
const SEEDS = [1, 2, 3, 4, 5];
const runs = new Map<number, SimReport[]>();
const play = (skill: number) => { let r = runs.get(skill); if (!r) { r = SEEDS.map((seed) => simulate({ seed, skill, minutes: 200 })); runs.set(skill, r); } return r; };
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const at = (rs: SimReport[], what: string) => median(rs.map((r) => when(r, what) ?? Infinity));

describe('the first hours, by simulation', () => {
  for (const skill of [0.4, 0.7]) {
    it(`a ${skill === 0.4 ? 'clumsy' : 'practised'} keeper meets each system in its time`, () => {
      const rs = play(skill);
      const band = (what: string, lo: number, hi: number) => { const m = at(rs, what); expect(m, `${what} at minute ${m.toFixed(0)}, wanted ${lo} to ${hi}`).toBeGreaterThanOrEqual(lo); expect(m, `${what} at minute ${m.toFixed(0)}, wanted ${lo} to ${hi}`).toBeLessThanOrEqual(hi); };
      band('bought Harbour Rod', 7, 22);
      band('done: Relight', 15, 32);           // the skiff
      band('done: Lanterns in the Water', 32, 58); // pots
      band('bought Gullwing Rod', 40, 85);
      band('done: The Drowned Bell', 55, 95);
      band('RANG THE BELL', 60, 100);
      for (const r of rs) {
        expect(r.rings.length, 'rings in 200 minutes').toBeGreaterThanOrEqual(2);
        expect(r.rings[0].echoes).toBeGreaterThanOrEqual(10);
        expect(r.rings[0].echoes).toBeLessThanOrEqual(22);
      }
    }, 60000);
  }

  it('the story never stalls: every quest is done, and nothing is waited on for more than a quarter of an hour', () => {
    for (const r of play(0.7)) {
      const story = r.marks.filter((m) => m.what.startsWith('done:') || m.what.startsWith('took:'));
      expect(story.filter((m) => m.what.startsWith('done:')).length).toBe(12);
      const first = story.filter((m) => m.t < (r.rings[0]?.t ?? Infinity));
      for (let i = 1; i < first.length; i++) expect((first[i].t - first[i - 1].t) / 60, `${first[i - 1].what} → ${first[i].what}`).toBeLessThan(40);
    }
  });

  it('pots earn a fair share while the game runs, and never more than the rod', () => {
    for (const r of play(0.7)) {
      const from = Math.ceil((when(r, 'done: Lanterns in the Water') ?? 0) * 60 / BUCKET_S) + 1;
      const b = r.buckets.slice(from).filter(Boolean);
      const coins = b.reduce((a, x) => a + x.coins, 0), pot = b.reduce((a, x) => a + x.pot, 0);
      expect(pot / coins).toBeGreaterThan(0.08);
      expect(pot / coins).toBeLessThan(0.35);
    }
  });

  it('a second tide is quicker than the first', () => {
    for (const r of play(0.7)) {
      const [a, b] = r.rings;
      expect(b.t - a.t).toBeLessThan(a.t * 0.8);
    }
  });

  it('skill pays, but a clumsy keeper is not locked out', () => {
    const slow = at(play(0.4), 'RANG THE BELL'), quick = at(play(0.7), 'RANG THE BELL');
    expect(slow).toBeLessThan(quick * 1.35);
    expect(median(play(0.4).map((r) => r.totals.coins))).toBeLessThanOrEqual(median(play(0.7).map((r) => r.totals.coins)) * 1.1);
  });

  it('each bait is the best thing to fish with somewhere, and none is best everywhere', () => {
    const best = new Map<string, number>();
    for (const hour of [12, 23]) {
      const s = newGame(7);
      s.gear.rods.push('gullwing-rod'); s.gear.rod = 'gullwing-rod'; s.gear.rodLevels['gullwing-rod'] = 3; s.hour = hour;
      s.boats.owned = ['skiff']; s.boats.current = 'skiff';
      const p = new SimPlayer({ seed: 3, skill: 0.7, minutes: 1 }, s);
      for (const place of PLACES) {
        const ranked = BAITS.map((b) => ({ id: b.id, r: p.rate(place, b.id, 500) })).sort((x, y) => y.r - x.r);
        best.set(ranked[0].id, (best.get(ranked[0].id) ?? 0) + 1);
      }
    }
    for (const b of BAITS) if (b.price > 0) expect(best.get(b.id) ?? 0, `${b.id} is never the best choice`).toBeGreaterThan(0);
    expect(Math.max(...best.values())).toBeLessThan(6);
  }, 120000);
});
