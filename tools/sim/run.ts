// The economy simulator. `npm run sim -- [--minutes 180] [--seeds 5] [--skills 0.4,0.7,0.95] [--log] [--rates] [--first 10] [--nopots]`
// Plays whole sessions with the real rules (see player.ts) and prints when things happen and what the sea pays.
import { BUCKET_S, PLACES, SimPlayer, simulate, when, type SimReport } from './player';
import { BAITS } from '../../src/core/content';
import { newGame } from '../../src/core/state';

const arg = (name: string, d: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const has = (name: string) => process.argv.includes(`--${name}`);
const minutes = Number(arg('minutes', '180')), seeds = Number(arg('seeds', '5'));
const skills = arg('skills', '0.4,0.7,0.95').split(',').map(Number);
const first = Number(arg('first', '8')), patience = Number(arg('patience', '6'));
const median = (xs: number[]) => { const a = xs.filter((x) => isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const mm = (m: number | null) => (m === null || !isFinite(m) ? '   -' : m.toFixed(0).padStart(4));

export const KEY_MARKS: [string, string][] = [
  ['bought Harbour Rod', 'Harbour Rod'], ['done: Relight', 'lamp lit, skiff'], ['took: Lanterns', 'pot job taken'], ['done: Lanterns', 'pots open'],
  ['bought Gullwing Rod', 'Gullwing Rod'], ['done: A Kettle', 'kettle'], ['done: What Bites', 'flounder'], ['done: A Full Stall', 'full stall'], ['done: The Drowned Bell', 'Bell found'],
  ['RANG THE BELL', 'first ringing'], ['done: The Turning', 'the Turning told'], ['journal page', 'Hearthbay page'],
];

if (has('rates')) {
  // What each place pays with each bait, for a few kits. A bait should be the best choice somewhere.
  for (const kit of [{ rod: 'driftwood-rod', lvl: 0 }, { rod: 'harbour-rod', lvl: 2 }, { rod: 'gullwing-rod', lvl: 3 }, { rod: 'gullwing-rod', lvl: 10 }]) {
    for (const hour of [12, 22]) {
      const s = newGame(7);
      s.gear.rods.push(kit.rod); s.gear.rod = kit.rod; s.gear.rodLevels[kit.rod] = kit.lvl; s.hour = hour;
      s.boats.owned = ['skiff']; s.boats.current = 'skiff'; s.flags.push('hb-lighthouse-lit');
      for (const f of ['butterperch', 'pebble-goby', 'kettle-carp', 'coral-snapper', 'lampjaw', 'moss-eel', 'twofold-flounder', 'hollow-lantern']) s.journal[f] = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 };
      const p = new SimPlayer({ seed: 3, skill: 0.7, minutes: 1 }, s);
      console.log(`\n${kit.rod} +${kit.lvl}, ${hour}:00, skill 0.7: coins a minute`);
      console.log(''.padEnd(10) + BAITS.map((b) => b.id.padStart(13)).join(''));
      for (const place of PLACES) console.log(place.id.padEnd(10) + BAITS.map((b) => (p.rate(place, b.id, 600) * 60).toFixed(1).padStart(13)).join(''));
    }
  }
  process.exit(0);
}

for (const skill of skills) {
  const runs: SimReport[] = [];
  for (let seed = 1; seed <= seeds; seed++) runs.push(simulate({ seed, skill, minutes, firstRing: first, patience, noPots: has('nopots') }));
  console.log(`\n=== skill ${skill}, ${seeds} seeds, ${minutes} minutes ===`);
  console.log('minute of (median / earliest / latest):');
  for (const [key, label] of KEY_MARKS) {
    const ts = runs.map((r) => when(r, key) ?? Infinity);
    console.log(`  ${label.padEnd(18)} ${mm(median(ts))} ${mm(Math.min(...ts))} ${mm(Math.max(...ts.filter(isFinite)))}`);
  }
  console.log('coins a minute by ten minutes (median), and the share from pots:');
  const n = Math.ceil((minutes * 60) / BUCKET_S);
  let line = '  ', share = '  ';
  for (let i = 0; i < n; i++) {
    line += String(Math.round(median(runs.map((r) => (r.buckets[i]?.coins ?? 0) / (BUCKET_S / 60))))).padStart(5);
    share += `${Math.round(median(runs.map((r) => (r.buckets[i]?.coins ? (100 * r.buckets[i].pot) / r.buckets[i].coins : 0))))}%`.padStart(5);
  }
  console.log(line); console.log(share);
  const t = runs.map((r) => r.totals);
  console.log(`catches ${median(t.map((x) => x.catches))}, snaps ${median(t.map((x) => x.snaps))}, slack ${median(t.map((x) => x.slack))}, missed bites ${median(t.map((x) => x.missed))}, away from the water ${Math.round(median(t.map((x) => (100 * x.away) / (x.away + x.fishing))))}%`);
  console.log(`ringings: ${runs.map((r) => r.rings.map((x) => `${(x.t / 60).toFixed(0)}m +${x.echoes}`).join(', ') || 'none').join(' | ')}`);
  if (has('log')) for (const m of runs[0].marks) console.log(`  ${(m.t / 60).toFixed(1).padStart(6)}  ${m.what}`);
}
