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
/**
 * The first two waters, as the game was before Saltbone Reach: a keeper who is never offered the whale-road.
 * The bands below were set on these hours, and a keeper who sails on at the end of the fourth hour would take
 * the Fen's last hours out from under them. The Reach has a keeper and bands of its own further down.
 */
const HOME = { without: ['hb-14-whale-road'] };
/** Four hours of play: Hearthbay, the first Turning, and the Fen's story. */
const play = (skill: number) => { let r = runs.get(skill); if (!r) { r = SEEDS.map((seed) => simulate({ seed, skill, minutes: 240, ...HOME })); runs.set(skill, r); } return r; };
/** Seven hours, for what comes late: the Puffin, Mister Hollis, the Listener. */
let longRuns: SimReport[] | null = null;
const long = () => (longRuns ??= SEEDS.map((seed) => simulate({ seed, skill: 0.7, minutes: 420, ...HOME })));
/** Seven hours with nothing held back: over the whale-road in the fourth hour, and Captain Oake's jobs. */
let reachRuns: SimReport[] | null = null;
const onward = () => (reachRuns ??= SEEDS.map((seed) => simulate({ seed, skill: 0.7, minutes: 420 })));
/** Jobs that wait on the price of the Puffin: they have a test of their own. */
const LATE = ['Fitted Out', 'A Gentleman on the Road'];
/** The jobs of Saltbone Reach, from Pell's word of the whale-road on. */
const REACH_JOBS = QUESTS.filter((q) => q.id === 'hb-14-whale-road' || q.id.startsWith('reach-'));
/** Every job of the first two waters. */
const HOME_JOBS = QUESTS.length - REACH_JOBS.length;
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
      expect(story.filter((m) => m.what.startsWith('done:')).length).toBe(HOME_JOBS - LATE.length);
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
      expect(r.marks.filter((m) => m.what.startsWith('done:')).length, 'every job of the first two waters done').toBe(HOME_JOBS);
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

  it('things come up beside the fishing: one in a dozen casts or so, for a small share of the coins, and they are landed', () => {
    for (const r of play(0.7)) {
      const perFind = r.totals.casts / r.totals.finds;
      expect(perFind, 'casts to a find').toBeGreaterThan(7);
      expect(perFind, 'casts to a find').toBeLessThan(16);
      const share = r.totals.findCoins / r.totals.coins;
      expect(share, `coins out of crates and chests: ${(100 * share).toFixed(1)}%`).toBeGreaterThan(0.03);
      expect(share).toBeLessThan(0.14);
      expect(r.totals.hauling / r.totals.fishing, 'time spent hauling').toBeLessThan(0.05);
      expect(r.totals.haulSnaps).toBeLessThanOrEqual(1);
      expect(r.state.finds.crates).toBeGreaterThan(r.state.finds.chests);
      // The first relic comes up within a night or two of the first rumour.
      expect(when(r, 'relic:')!, 'the first relic fished up').toBeLessThan(45);
    }
    // A clumsy keeper lands nearly all of them too: a haul asks for patience, not quick hands.
    for (const r of play(0.4)) expect(r.totals.haulSnaps, 'lines broken on a haul by a clumsy keeper').toBeLessThanOrEqual(3);
  }, 120000);

  it('a keeper who meets finds earns no less than one who never does', () => {
    const none = SEEDS.map((seed) => simulate({ seed, skill: 0.7, minutes: 240, noFinds: true, ...HOME }));
    const mean = (rs: SimReport[]) => rs.reduce((a, r) => a + r.totals.coins, 0) / rs.length;
    // A crate is reckoned from the fish it came up instead of, and the relics the rumours lead to give their
    // gifts, so the keeper who meets finds is ahead: by about a fifth over these seeds. (Seed by seed the two
    // differ far more than that, either way, which is why it is the mean that is held, and held above one.)
    // Much more than that and finds would be the game, not a change of pace in it.
    expect(mean(play(0.7)) / mean(none)).toBeGreaterThan(1);
    expect(mean(play(0.7)) / mean(none)).toBeLessThan(1.45);
  }, 240000);

  it('the relics are found by following what is said of them: most in four hours, all but one or so in seven', () => {
    for (const r of play(0.7)) expect(r.state.relics.length, 'relics in four hours').toBeGreaterThanOrEqual(8);
    for (const r of long()) {
      expect(r.state.relics.length, 'relics in seven hours').toBeGreaterThanOrEqual(11);
      // Following rumours is an errand now and then, not the game.
      expect(r.totals.hunting / (420 * 60), 'share of the time spent after rumours').toBeLessThan(0.1);
      // Pearls: three from jobs, the rest out of sea chests; every one of them set beside something.
      expect(r.state.moonpearls).toBeGreaterThanOrEqual(4);
      expect(r.state.moonpearls).toBeLessThanOrEqual(16);
      expect(Object.values(r.state.pearls).reduce((a, b) => a + b, 0)).toBe(Math.min(r.state.moonpearls, 2 * r.state.relics.length));
    }
    expect(median(long().map((r) => r.state.relics.length))).toBe(12);
  }, 240000);

  it('a second tide is quicker than the first', () => {
    const ratios: number[] = [];
    for (const r of play(0.7)) {
      const [a, b] = r.rings;
      // It is rung again sooner than it was first rung, by every keeper,
      expect(b.t - a.t, 'the second tide, against the first').toBeLessThan(a.t);
      ratios.push((b.t - a.t) / a.t);
      // and long before that the second tide has earned everything the first one did. (How long a keeper then
      // stays out is her own affair: one who has crossed to the Fen saves for the Fenwood Rod before she rings.)
      expect(a.matched, 'no second tide ever earned what the first did').toBeDefined();
      expect(a.matched!, 'time to earn the first tide\'s coins again').toBeLessThan(a.t * 0.6);
    }
    expect(median(ratios), 'the usual second tide').toBeLessThan(0.8);
  }, 120000);

  it('skill pays, but a clumsy keeper is not locked out', () => {
    const slow = at(play(0.4), 'RANG THE BELL'), quick = at(play(0.7), 'RANG THE BELL');
    expect(slow).toBeLessThan(quick * 1.35);
    // Whoever is best with a rod is never behind. (Between a clumsy and a practised keeper the simulator's
    // totals differ by less than they differ from seed to seed, so the comparison is with the best.)
    // The mean, not the median: with five seeds apiece the middle one of each moves by more than the two differ.
    const best = play(0.95);
    const mean = (rs: SimReport[], what: string) => rs.reduce((a, r) => a + (when(r, what) ?? Infinity), 0) / rs.length;
    expect(Number.isFinite(mean(best, 'RANG THE BELL')), 'every one of the best keepers rings the Bell').toBe(true);
    expect(mean(best, 'RANG THE BELL')).toBeLessThanOrEqual(mean(play(0.4), 'RANG THE BELL'));
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
    // And the Reach's best (a storm at night, or the Long Swell at noon) a few times the Fen's.
    const on = pays.get('saltbone-reach')! / pays.get('mossglass-fen')!;
    expect(on, `the Reach's best water pays ${on.toFixed(1)} times the Fen's`).toBeGreaterThan(1.6);
    expect(on).toBeLessThan(6);
  }, 240000);
});

describe('Saltbone Reach, by simulation', () => {
  const arrived = (r: SimReport) => when(r, 'reached Saltbone Reach');
  /** What was earned from the minute she arrived to the end, and whose it was. */
  const inReach = (r: SimReport) => {
    const b = r.buckets.slice(Math.ceil((arrived(r) ?? 1e9) * 60 / BUCKET_S)).filter(Boolean);
    const coins = b.reduce((a, x) => a + x.coins, 0);
    return { coins, pot: b.reduce((a, x) => a + x.pot, 0) / coins, crew: b.reduce((a, x) => a + x.crew, 0) / coins, perMinute: coins / (420 - arrived(r)!) };
  };

  it('is reached in the fourth hour, as soon as the Puffin floats, and Captain Oake\'s six jobs fill an hour and a half', () => {
    const rs = onward();
    const reach = at(rs, 'reached Saltbone Reach');
    expect(reach, `the Reach reached at minute ${reach.toFixed(0)}`).toBeGreaterThan(190);
    expect(reach).toBeLessThan(265);
    const spans: number[] = [];
    for (const r of rs) {
      const a = arrived(r), boat = when(r, 'bought The Puffin');
      expect(a, 'every keeper crosses inside five hours').not.toBeNull();
      expect(a!).toBeLessThan(300);
      // The whale-road wants the Puffin: nobody is over it before she floats, and nobody waits long after.
      expect(a! - boat!).toBeGreaterThanOrEqual(0);
      expect(a! - boat!).toBeLessThan(20);
      expect(r.marks.filter((m) => m.what.startsWith('done:')).length, 'every job in the game done inside seven hours').toBe(QUESTS.length);
      // Nothing is waited on for an hour: the longest is the lightning, which keeps the Deacon's hours and Little Wren's.
      const story = r.marks.filter((m) => m.t >= a! * 60 && (m.what.startsWith('done:') || m.what.startsWith('took:')) && REACH_JOBS.some((q) => m.what.endsWith(q.title)));
      for (let i = 1; i < story.length; i++) expect((story[i].t - story[i - 1].t) / 60, `${story[i - 1].what} → ${story[i].what}`).toBeLessThan(60);
      spans.push(when(r, 'done: The Count')! - a!);
    }
    expect(median(spans), `minutes from the quay to the count: ${spans.map((x) => x.toFixed(0)).join(', ')}`).toBeGreaterThan(65);
    expect(median(spans)).toBeLessThan(135);
  }, 240000);

  it('its rod is a thing to save for: an hour in at the least, and in every keeper\'s hand before the seventh hour is out', () => {
    const waits: number[] = [];
    for (const r of onward()) {
      const rod = when(r, 'bought Whalebone Rod');
      expect(rod, 'the Whalebone Rod bought').not.toBeNull();
      waits.push(rod! - arrived(r)!);
      expect(rod! - arrived(r)!, 'minutes in the Reach before the Whalebone Rod').toBeGreaterThan(40);
      // She has seen the Fenwood Rod bend double on something first.
      expect(when(r, 'first Thunderback'), 'the Thunderback landed').not.toBeNull();
    }
    expect(median(waits), `minutes in the Reach before its rod: ${waits.map((x) => x.toFixed(0)).join(', ')}`).toBeGreaterThan(55);
    expect(median(waits)).toBeLessThan(115);
  }, 240000);

  it('pays a few times what the Fen does, most of it to the keeper\'s own rod: storms stop the pots and send the hands below', () => {
    const fen = long();
    for (const [i, r] of onward().entries()) {
      const x = inReach(r);
      expect(x.pot, `pots in the Reach: ${(100 * x.pot).toFixed(0)}%`).toBeGreaterThan(0.05);
      expect(x.pot, `pots in the Reach: ${(100 * x.pot).toFixed(0)}%`).toBeLessThan(0.28);
      expect(x.crew, `the crew in the Reach: ${(100 * x.crew).toFixed(0)}%`).toBeGreaterThan(0.03);
      expect(x.crew, `the crew in the Reach: ${(100 * x.crew).toFixed(0)}%`).toBeLessThan(0.11);
      expect(x.pot + x.crew, 'crew and pots together').toBeLessThan(0.33);
      // Against the same keeper kept in the Fen for the same hours: more, and not a different game.
      const a = Math.ceil(arrived(r)! * 60 / BUCKET_S), stayed = fen[i].buckets.slice(a).filter(Boolean).reduce((s, b) => s + b.coins, 0);
      expect(x.coins / stayed, `seed ${SEEDS[i]}: the Reach against staying in the Fen`).toBeGreaterThan(0.9);
      expect(x.coins / stayed).toBeLessThan(4);
    }
    const mean = (rs: SimReport[]) => rs.reduce((a, r) => a + r.totals.coins, 0) / rs.length;
    expect(mean(onward()) / mean(fen), 'seven hours with the Reach against seven without').toBeGreaterThan(1.1);
    expect(mean(onward()) / mean(fen)).toBeLessThan(2.2);
  }, 240000);

  it('lightning is fished for, the storm fish are landed, and the journal page can be filled', () => {
    const rs = onward();
    for (const r of rs) {
      expect(r.totals.struck, 'fish out of struck water in seven hours').toBeGreaterThanOrEqual(8);
      expect(when(r, 'first Squall Mackerel')).not.toBeNull();
      // The Reach's relics: all four that lie in its water are rumoured by the last job but one.
      expect(r.state.relics.length, 'relics in seven hours, with the Reach').toBeGreaterThanOrEqual(13);
    }
    // Old Greyback keeps noon on the Long Swell: most keepers who sit up for him have him, and the page with him.
    const grey = rs.map((r) => when(r, 'first Old Greyback')).filter((m) => m !== null && m !== undefined);
    expect(grey.length, `keepers of ${SEEDS.length} with Old Greyback: ${grey.map((m) => m!.toFixed(0)).join(', ')}`).toBeGreaterThanOrEqual(3);
    expect(rs.filter((r) => when(r, 'journal page: The Saltbone') !== null).length).toBeGreaterThanOrEqual(3);
  }, 240000);
});
