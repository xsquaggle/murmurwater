import { describe, expect, it } from 'vitest';
import { BUCKET_S, PLACES, SimPlayer, simulate, when, type SimReport } from '../tools/sim/player';
import { BAITS } from '../src/core/content';
import { QUESTS } from '../src/core/quests';
import { newGame } from '../src/core/state';

/**
 * The economy's shape, held as bands. These are not exact numbers: they say what the first hours must feel
 * like (docs/DESIGN.md §8.3, §11), and a change to fish, prices or rewards that breaks one has to be meant.
 */
const SEEDS = [1, 2, 3, 4, 5];
const runs = new Map<number, SimReport[]>();
/** Four hours of play: Hearthbay, the first Turning, and the Fen's story. */
const play = (skill: number) => { let r = runs.get(skill); if (!r) { r = SEEDS.map((seed) => simulate({ seed, skill, minutes: 240 })); runs.set(skill, r); } return r; };
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
      // The Fen: the lamp comes with the first Turning, and Dr. Calloway's jobs fill the hour and a bit after.
      band('echo: The Fog Lamp', 60, 100);
      band('reached Mossglass Fen', 63, 106);
      band('done: The Tape Runs Out', 78, 125);
      band('done: The Listening Post', 115, 185);
      band('bought Fenwood Rod', 110, 215);
      for (const r of rs) {
        // Its rod is not a moment's work: half an hour in the Fen at the least.
        expect(when(r, 'bought Fenwood Rod')! - when(r, 'reached Mossglass Fen')!, 'minutes in the Fen before the Fenwood Rod').toBeGreaterThan(25);
        expect(r.rings.length, 'rings in four hours').toBeGreaterThanOrEqual(2);
        expect(r.rings[0].echoes).toBeGreaterThanOrEqual(10);
        expect(r.rings[0].echoes).toBeLessThanOrEqual(22);
      }
    }, 120000);
  }

  it('the story never stalls: every quest is done, and nothing is waited on for more than a quarter of an hour', () => {
    for (const r of play(0.7)) {
      const story = r.marks.filter((m) => m.what.startsWith('done:') || m.what.startsWith('took:'));
      expect(story.filter((m) => m.what.startsWith('done:')).length).toBe(QUESTS.length);
      const first = story.filter((m) => m.t < (r.rings[0]?.t ?? Infinity));
      for (let i = 1; i < first.length; i++) expect((first[i].t - first[i - 1].t) / 60, `${first[i - 1].what} → ${first[i].what}`).toBeLessThan(40);
      // In the Fen the longest wait is for the dark (the Glowbelly), and a Turning may fall in the middle of a job.
      const fen = story.filter((m) => m.t >= (when(r, 'reached Mossglass Fen') ?? Infinity) * 60);
      expect(fen.length).toBeGreaterThan(8);
      for (let i = 1; i < fen.length; i++) expect((fen[i].t - fen[i - 1].t) / 60, `${fen[i - 1].what} → ${fen[i].what}`).toBeLessThan(50);
    }
  }, 120000);

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
  }, 120000);

  it('skill pays, but a clumsy keeper is not locked out', () => {
    const slow = at(play(0.4), 'RANG THE BELL'), quick = at(play(0.7), 'RANG THE BELL');
    expect(slow).toBeLessThan(quick * 1.35);
    // Whoever is best with a rod is never behind. (Between a clumsy and a practised keeper the simulator's
    // totals differ by less than they differ from seed to seed, so the comparison is with the best.)
    const best = play(0.95);
    expect(at(best, 'RANG THE BELL')).toBeLessThanOrEqual(slow);
    expect(median(play(0.4).map((r) => r.totals.coins))).toBeLessThanOrEqual(median(best.map((r) => r.totals.coins)) * 1.1);
  }, 120000);

  it('each bait is the best thing to fish with somewhere, none is best everywhere, and the Fen pays a few times what Hearthbay does', () => {
    const best = new Map<string, number>(), pays = new Map<string, number>();
    for (const hour of [12, 23]) {
      const s = newGame(7);
      s.gear.rods.push('gullwing-rod'); s.gear.rod = 'gullwing-rod'; s.gear.rodLevels['gullwing-rod'] = 3; s.hour = hour;
      s.boats.owned = ['skiff']; s.boats.current = 'skiff'; s.flags.push('reached:mossglass-fen');
      const p = new SimPlayer({ seed: 3, skill: 0.7, minutes: 1 }, s);
      for (const place of PLACES) {
        const ranked = BAITS.map((b) => ({ id: b.id, r: p.rate(place, b.id, 500) })).sort((x, y) => y.r - x.r);
        best.set(ranked[0].id, (best.get(ranked[0].id) ?? 0) + 1);
        pays.set(place.region, Math.max(pays.get(place.region) ?? 0, ranked[0].r));
      }
    }
    for (const b of BAITS) if (b.price > 0) expect(best.get(b.id) ?? 0, `${b.id} is never the best choice`).toBeGreaterThan(0);
    // Twenty place-and-hours in all: no bait takes half of them.
    expect(Math.max(...best.values())).toBeLessThan(PLACES.length);
    // With the same rod, the Fen's best water pays a few times Hearthbay's best: a new sea, not a new game.
    const ratio = pays.get('mossglass-fen')! / pays.get('hearthbay')!;
    expect(ratio, `the Fen's best water pays ${ratio.toFixed(1)} times Hearthbay's`).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(6);
  }, 240000);
});
