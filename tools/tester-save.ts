// The tester's starts: `npm run tester-save` writes src/data/tester/<id>.json, one for each of the last slices.
// Each is a save the simulator's keeper really played, with the real rules, up to the doorstep of a slice:
//   finds (v0.6.0, things fished up): everything before it is done (the Puffin afloat, the cat and Mister Hollis
//        aboard) by a keeper for whom nothing ever came up but fish; she stands on the home dock at nightfall
//        with four relics, three pearls never set, and every rumour still to hear;
//   crew (v0.5.0, hands aboard): the cat is signed on, the Fen is known, the wreck of the Puffin has been found
//        and Pell has named his price, the gentleman on the road is waiting for a berth, and the price of the
//        refit is in the purse, unspent;
//   fen  (v0.4.0, Mossglass Fen): she has rung the Bell once, bought the Fog Lamp, and Pell has just sent her
//        down the old sea-road.
// The game offers them from the title screen (F8, newest first) so the new things can be tried without the
// hours of play before them; nothing done in them is saved. tests/tester.test.ts fails when a file no longer
// matches what the rules give.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SimPlayer } from './sim/player';
import { hasFogLamp } from '../src/core/gear';
import { isAboard } from '../src/core/crew';
import { BOATS_BY_ID, QUESTS, handsInTo, questStatus } from '../src/core/quests';
import { serialize } from '../src/core/save';
import type { GameState } from '../src/core/state';

/** The starts, newest first. */
export const TESTER_STARTS = ['finds', 'crew', 'fen'] as const;
export type TesterStart = (typeof TESTER_STARTS)[number];
export const testerFile = (id: TesterStart) => fileURLToPath(new URL(`../src/data/tester/${id}.json`, import.meta.url));

/** The boat the newest slice is about. */
const BOAT = 'puffin';

/**
 * Seed 1 at a practised hand, in a sea with nothing on the bottom but fish, played until the Puffin floats and
 * both hands are aboard: on the home dock as the dark comes down, when the first of the relics can be fished for.
 */
function findsKeeper(): GameState {
  const p = new SimPlayer({ seed: 1, skill: 0.7, minutes: 1200, noFinds: true });
  const there = () => p.s.boats.current === BOAT && isAboard(p.s, 'biscuit') && isAboard(p.s, 'hollis');
  for (let i = 0; i < 3000 && !there(); i++) p.outing();
  if (!there()) throw new Error('the keeper never had the Puffin afloat with both hands aboard');
  // Home, and Pell told that she floats (his pearl is the third).
  p.home();
  p.townBusiness();
  const s = p.s;
  if (!there() || s.world.region !== 'hearthbay' || s.finds.casts || s.relics.length !== 4 || Object.keys(s.pearls).length) throw new Error('the keeper is not on the home dock with nothing found');
  // Nightfall: the spectacles lie in the cove beside the dock from now until morning.
  s.hour = 20.25;
  return s;
}

/** Seed 1 at a practised hand, played until the Puffin can be paid for: on the home dock, the coins unspent. */
function crewKeeper(): GameState {
  const p = new SimPlayer({ seed: 1, skill: 0.7, minutes: 900, noBoat: true });
  const price = BOATS_BY_ID.get(BOAT)!.price;
  const there = () => questStatus(p.s, 'hb-13-refit') === 'active' && questStatus(p.s, 'fen-s1-gentleman') === 'active' && isAboard(p.s, 'biscuit') && p.s.coins >= price;
  for (let i = 0; i < 2000 && !there(); i++) p.outing();
  if (!there()) throw new Error('the keeper never had the price of the Puffin in hand');
  p.home();
  const s = p.s;
  if (!there() || !hasFogLamp(s) || s.world.region !== 'hearthbay' || s.boats.owned.includes(BOAT)) throw new Error('the keeper is not on the home dock with the price of the Puffin');
  // Late in the afternoon: time to see Pell about the boat, and dusk (when the gentleman fishes) not long after.
  s.hour = 16.5;
  return s;
}

/** Seed 1 at a practised hand, played until the road job is in hand: on the home dock, the Fen not yet seen. */
function fenKeeper(): GameState {
  const p = new SimPlayer({ seed: 1, skill: 0.7, minutes: 600 });
  for (let i = 0; i < 400 && questStatus(p.s, 'hb-12-road') !== 'active'; i++) {
    if (p.s.world.region !== 'hearthbay') throw new Error('the keeper crossed before the save was taken');
    if (hasFogLamp(p.s)) p.townBusiness(); else p.outing();
  }
  const s = p.s;
  if (questStatus(s, 'hb-12-road') !== 'active' || !hasFogLamp(s) || s.world.region !== 'hearthbay') throw new Error('the keeper never got as far as the road job');
  // A morning to set out in.
  s.hour = 8.5;
  return s;
}

/** The keeper of one start, ashore on the home island. */
export function testerKeeper(id: TesterStart): GameState {
  const s = id === 'finds' ? findsKeeper() : id === 'crew' ? crewKeeper() : fenKeeper();
  // What the game itself notes down as things happen (town.ts), which the simulator's keeper never does: who
  // has been spoken to, and the kettle gone from its stones. A new flag set outside src/core belongs here too.
  const spoken = new Set<string>();
  for (const q of QUESTS) {
    if (s.quests.done.includes(q.id)) { spoken.add(q.giver); spoken.add(handsInTo(q)); }
    else if (s.quests.active[q.id]) spoken.add(q.giver);
  }
  for (const flag of [...[...spoken].map((id) => `met-${id}`), ...(s.relics.includes('keepers-kettle') ? ['kettle-taken'] : [])]) if (!s.flags.includes(flag)) s.flags.push(flag);
  s.world.onBoat = false;
  return s;
}

/** A file's text: the same for the same rules, whenever it is made. */
export function testerSaveText(id: TesterStart): string {
  return JSON.stringify(JSON.parse(serialize(testerKeeper(id), new Date('2026-11-16T00:00:00Z'))), null, 1) + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const id of TESTER_STARTS) {
    const text = testerSaveText(id);
    writeFileSync(testerFile(id), text);
    const s = JSON.parse(text).state;
    console.log(`wrote ${testerFile(id)}: ${text.length} bytes, ${(s.playTime / 60).toFixed(0)} minutes played, ${s.coins} coins, ${s.echoes} Echoes left, rod ${s.gear.rod}, ${Object.keys(s.journal).length} fish in the journal`);
  }
}
