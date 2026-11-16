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
/** Seven hours, for what comes late: the Puffin, Mister Hollis, the Listener. */
let longRuns: SimReport[] | null = null;
const long = () => (longRuns ??= SEEDS.map((seed) => simulate({ seed, skill: 0.7, minutes: 420 })));
/** Jobs that wait on the price of the Puffin: they have a test of their own. */
const LATE = ['Fitted Out', 'A Gentleman on the Road'];
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
      band('aboard: Biscuit', 40, 75);             // the first deckhand, a few minutes after
      band('bought Gullwing Rod', 40, 85);
      band('done: The Drowned Bell', 55, 95);
      band('RANG THE BELL', 60, 100);
      // The Fen: the lamp comes with the first Turning, and Dr. Calloway's jobs fill the hour and a bit after.
      band('echo: The Fog Lamp', 60, 100);
      band('reached Mossglass Fen', 63, 106);
      band('done: The Tape Runs Out', 78, 125);
      band('done: A Boat in the Reeds', 85, 140);  // the Puffin found, and Pell told
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
      const story = r.marks.filter((m) => (m.what.startsWith('done:') || m.what.startsWith('took:')) && !LATE.some((x) => m.what.endsWith(x)));
      expect(story.filter((m) => m.what.startsWith('done:')).length).toBe(QUESTS.length - LATE.length);
      const first = story.filter((m) => m.t < (r.rings[0]?.t ?? Infinity));
      // The longest haul is A Full Stall (6,000 coins from the Teeth), with the cat's job done early in it.
      for (let i = 1; i < first.length; i++) expect((first[i].t - first[i - 1].t) / 60, `${first[i - 1].what} → ${first[i].what}`).toBeLessThan(45);
      // In the Fen the longest wait is for the dark (the Glowbelly), and a Turning may fall in the middle of a job.
      const fen = story.filter((m) => m.t >= (when(r, 'reached Mossglass Fen') ?? Infinity) * 60);
      expect(fen.length).toBeGreaterThan(8);
      for (let i = 1; i < fen.length; i++) expect((fen[i].t - fen[i - 1].t) / 60, `${fen[i - 1].what} → ${fen[i].what}`).toBeLessThan(50);
    }
  }, 120000);

  it('with the story told the journal can be filled: the Mossglass page, and the Listener for a keeper who sits up for it', () => {
    // Nine fish make the page (the uncanny one is not asked for); nobody is still short of it at four hours.
    for (const r of play(0.7)) expect(when(r, 'journal page: The Mossglass page') ?? Infinity, 'the Mossglass page').toBeLessThan(240);
    // The Listener keeps the small hours at one place. Most keepers who sit up for it have it inside seven hours.
    const got = long().map((r) => when(r, 'first The Listener')).filter((m) => m !== null && m !== undefined);
    expect(got.length, `keepers of ${SEEDS.length} with the Listener: ${got.map((m) => m!.toFixed(0)).join(', ')}`).toBeGreaterThanOrEqual(3);
  }, 240000);

  it('pots earn a fair share while the game runs, and never more than the rod', () => {
    for (const r of play(0.7)) {
      const from = Math.ceil((when(r, 'done: Lanterns in the Water') ?? 0) * 60 / BUCKET_S) + 1;
      const b = r.buckets.slice(from).filter(Boolean);
      const coins = b.reduce((a, x) => a + x.coins, 0), pot = b.reduce((a, x) => a + x.pot, 0);
      expect(pot / coins).toBeGreaterThan(0.08);
      expect(pot / coins).toBeLessThan(0.35);
    }
  });

  it('the Puffin is a thing to save for after the Fen has been seen, and Mister Hollis comes aboard as soon as she floats', () => {
    const rs = long();
    const afloat = at(rs, 'bought The Puffin'), found = at(rs, 'done: A Boat in the Reeds'), page = at(rs, 'journal page: The Mossglass page');
    // Found in the second hour, afloat in the fourth: after the Fenwood Rod, and about when the Mossglass page is done.
    expect(afloat, `the Puffin afloat at minute ${afloat.toFixed(0)}`).toBeGreaterThan(170);
    expect(afloat, `the Puffin afloat at minute ${afloat.toFixed(0)}`).toBeLessThan(270);
    expect(afloat - found, 'minutes between finding her and floating her').toBeGreaterThan(60);
    expect(afloat, 'not long before the journal page, at the earliest').toBeGreaterThan(page - 30);
    for (const r of rs) {
      const boat = when(r, 'bought The Puffin'), rod = when(r, 'bought Fenwood Rod'), hollis = when(r, 'aboard: Mister Hollis');
      expect(boat, 'every keeper floats her inside seven hours').not.toBeNull();
      expect(boat!).toBeGreaterThan(rod!);
      // The gentleman has been waiting for a berth since the Glowbelly: he is aboard within a quarter of an hour.
      expect(hollis, 'Mister Hollis aboard').not.toBeNull();
      expect(hollis! - boat!).toBeLessThan(15);
      expect(hollis! - boat!).toBeGreaterThanOrEqual(0);
      expect(r.marks.filter((m) => m.what.startsWith('done:')).length, 'every job done').toBe(QUESTS.length);
      expect(r.state.boats.owned).toEqual(['skiff', 'puffin']);
      expect(r.state.crew.hired.sort()).toEqual(['biscuit', 'hollis']);
    }
  }, 240000);

  it('a crew earns a little while the game runs: never much beside the rod, and with the pots never more than a third', () => {
    for (const r of long()) {
      const from = Math.ceil((when(r, 'aboard: Biscuit') ?? 0) * 60 / BUCKET_S) + 1;
      const b = r.buckets.slice(from).filter(Boolean);
      const coins = b.reduce((a, x) => a + x.coins, 0), pot = b.reduce((a, x) => a + x.pot, 0), crew = b.reduce((a, x) => a + x.crew, 0);
      expect(crew / coins, `crew share ${(100 * crew / coins).toFixed(1)}%`).toBeGreaterThan(0.02);
      expect(crew / coins, `crew share ${(100 * crew / coins).toFixed(1)}%`).toBeLessThan(0.1);
      expect((crew + pot) / coins, 'crew and pots together').toBeLessThan(0.35);
      // Both of them pull their weight: neither is a passenger.
      const t = r.state.crew.tally;
      expect(t.biscuit.fish).toBeGreaterThan(100);
      expect(t.biscuit.eaten).toBe(Math.floor((t.biscuit.fish + t.biscuit.eaten) / 4));
      expect(t.hollis.fish).toBeGreaterThan(20);
      expect(t.hollis.coins / t.hollis.fish, 'a fish of his is worth a good deal more than one of hers').toBeGreaterThan(1.5 * t.biscuit.coins / t.biscuit.fish);
    }
    // In Hearthbay, where she first signs on, the cat is a help that shows: a few coins in every hundred.
    for (const r of play(0.7)) {
      const a = Math.ceil((when(r, 'aboard: Biscuit') ?? 0) * 60 / BUCKET_S), z = Math.floor((when(r, 'RANG THE BELL') ?? 0) * 60 / BUCKET_S);
      const b = r.buckets.slice(a, z + 1).filter(Boolean);
      const share = b.reduce((x, y) => x + y.crew, 0) / Math.max(1, b.reduce((x, y) => x + y.coins, 0));
      expect(share, `the cat's share before the first Turning: ${(100 * share).toFixed(1)}%`).toBeGreaterThan(0.02);
      expect(share).toBeLessThan(0.15);
    }
  }, 240000);

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
