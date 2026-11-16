// The tester's start: `npm run tester-save` writes src/data/tester/fen.json.
// It is a save the simulator's keeper really played, with the real rules, up to the newest slice: she has rung
// the Bell once, bought the Fog Lamp, and Pell has just sent her down the old sea-road. The game offers it from
// the title screen (F8) so the Fen can be tried without the hour and a quarter of play before it; nothing done
// in it is saved. tests/tester.test.ts fails when the file no longer matches what the rules give.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SimPlayer } from './sim/player';
import { hasFogLamp } from '../src/core/gear';
import { QUESTS, handsInTo, questStatus } from '../src/core/quests';
import { serialize } from '../src/core/save';
import type { GameState } from '../src/core/state';

export const TESTER_FILE = fileURLToPath(new URL('../src/data/tester/fen.json', import.meta.url));

/** Plays seed 1 at a practised hand until the road job is in hand, and stops on the dock. */
export function testerKeeper(): GameState {
  const p = new SimPlayer({ seed: 1, skill: 0.7, minutes: 600 });
  for (let i = 0; i < 400 && questStatus(p.s, 'hb-12-road') !== 'active'; i++) {
    if (p.s.world.region !== 'hearthbay') throw new Error('the keeper crossed before the save was taken');
    if (hasFogLamp(p.s)) p.townBusiness(); else p.outing();
  }
  const s = p.s;
  if (questStatus(s, 'hb-12-road') !== 'active' || !hasFogLamp(s) || s.world.region !== 'hearthbay') throw new Error('the keeper never got as far as the road job');
  // What the game itself notes down as things happen (town.ts), which the simulator's keeper never does: who
  // has been spoken to, and the kettle gone from its stones. A new flag set outside src/core belongs here too.
  const spoken = new Set<string>();
  for (const q of QUESTS) {
    if (s.quests.done.includes(q.id)) { spoken.add(q.giver); spoken.add(handsInTo(q)); }
    else if (s.quests.active[q.id]) spoken.add(q.giver);
  }
  for (const flag of [...[...spoken].map((id) => `met-${id}`), ...(s.relics.includes('keepers-kettle') ? ['kettle-taken'] : [])]) if (!s.flags.includes(flag)) s.flags.push(flag);
  // A morning to set out in, ashore on the home island.
  s.hour = 8.5;
  s.world.onBoat = false;
  return s;
}

/** The file's text: the same for the same rules, whenever it is made. */
export function testerSaveText(): string {
  return JSON.stringify(JSON.parse(serialize(testerKeeper(), new Date('2026-11-16T00:00:00Z'))), null, 1) + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = testerSaveText();
  writeFileSync(TESTER_FILE, text);
  const s = JSON.parse(text).state;
  console.log(`wrote ${TESTER_FILE}: ${text.length} bytes, ${(s.playTime / 60).toFixed(0)} minutes played, ${s.coins} coins, ${s.echoes} Echoes left, rod ${s.gear.rod}, ${Object.keys(s.journal).length} fish in the journal`);
}
