// Prints fight win rates and durations per fish × rod for a human-ish player. `npx tsx tools/sim/fight-stats.ts [skill]`
import { FISH } from '../../src/core/content';
import { playFightHuman } from '../../tests/helpers';
const skill = Number(process.argv[2] ?? 0.7);
for (const rodId of ['driftwood-rod', 'harbour-rod', 'gullwing-rod']) {
  console.log(`\n${rodId} (skill ${skill})`);
  for (const f of FISH) {
    let win = 0; const t: number[] = []; const why: Record<string, number> = {};
    const N = 60;
    for (let seed = 1; seed <= N; seed++) {
      const r = playFightHuman(f, { seed, rodId, skill });
      if (r.phase === 'landed') { win++; t.push(r.time); } else { const k = (r.ev as any)?.reason ?? 'timeout'; why[k] = (why[k] ?? 0) + 1; }
    }
    const avg = t.length ? (t.reduce((a, b) => a + b, 0) / t.length).toFixed(1) : '-';
    console.log(`${f.id.padEnd(18)} ${f.rarity.padEnd(10)} win ${String(Math.round((win / N) * 100)).padStart(3)}%  avg ${avg}s  ${JSON.stringify(why)}`);
  }
}
