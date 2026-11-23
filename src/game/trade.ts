/**
 * Every button on the shelf and in the satchel that changes the keeper's gear: buying, tuning, putting things on,
 * spending Echoes. One entry point, so each of them gets its sound, its line of news, a fresh look at what the
 * gear adds up to, and a save. The rules themselves are core/gear.ts and core/bell.ts.
 */
import type { Game } from './game';
import { RODS_BY_ID } from '../core/content';
import {
  ECHOES_BY_ID, LURES_BY_ID, POTS, WEARABLES_BY_ID, buyBait, buyCreel, buyLure, buyPot, buyRod, buyWearable, creelNext, equipLure, tuneRod, upgradePots, wear,
  type PotUpgrade,
} from '../core/gear';
import { buyEcho, echoRank } from '../core/bell';
import { liftPearl, setPearl } from '../core/relics';
import { QUESTS_BY_ID, newlyReady, readySet, readyText } from '../core/quests';

export type GearAction =
  | { type: 'buyRod' | 'equipRod' | 'tune' | 'equipBait' | 'buyLure' | 'buyWearable' | 'wear' | 'buyEcho' | 'setPearl' | 'liftPearl'; id: string }
  | { type: 'buyBait'; id: string; n: number }
  | { type: 'equipLure'; id: string | null }
  | { type: 'buyCreel' | 'buyPot' }
  | { type: 'potUpgrade'; k: PotUpgrade };

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => ROMAN[n] ?? String(n);

/** Does it, if it can be done. Returns whether anything changed. */
export function trade(g: Game, a: GearAction): boolean {
  const s = g.state, before = readySet(s);
  let ok = false, said = '', coins = 0;
  switch (a.type) {
    case 'buyRod': ok = buyRod(s, a.id); said = `Bought the ${RODS_BY_ID.get(a.id)?.name}`; coins = 6; break;
    case 'equipRod': ok = s.gear.rods.includes(a.id) && s.gear.rod !== a.id; if (ok) s.gear.rod = a.id; break;
    case 'tune': ok = tuneRod(s, a.id); said = `${RODS_BY_ID.get(a.id)?.name}: tuned to +${s.gear.rodLevels[a.id]}`; coins = 3; break;
    case 'buyBait': ok = buyBait(s, a.id, a.n); coins = 2; break;
    case 'equipBait': ok = (s.gear.baits[a.id] ?? 0) > 0 && s.gear.bait !== a.id; if (ok) s.gear.bait = a.id; break;
    case 'buyLure': ok = buyLure(s, a.id); said = `Bought the ${LURES_BY_ID.get(a.id)?.name}`; coins = 4; break;
    case 'equipLure': ok = s.gear.lure !== a.id && equipLure(s, a.id); break;
    case 'buyWearable': ok = buyWearable(s, a.id); said = `Bought the ${WEARABLES_BY_ID.get(a.id)?.name}`; coins = 4; break;
    case 'wear': ok = wear(s, a.id); break;
    case 'buyCreel': { const n = creelNext(s); ok = buyCreel(s); said = n ? `${n.name}: your hold is bigger, and fish keep better` : ''; coins = 5; break; }
    case 'buyPot': ok = buyPot(s); said = 'Another Lantern Pot for the water'; coins = 5; break;
    case 'potUpgrade': ok = upgradePots(s, a.k); said = `${POTS.upgrades[a.k].name}: ${POTS.upgrades[a.k].blurb.toLowerCase()}`; coins = 3; break;
    // A pearl beside a relic, or out again: nothing is spent either way.
    case 'setPearl': ok = setPearl(s, a.id); break;
    case 'liftPearl': ok = liftPearl(s, a.id); break;
    case 'buyEcho': {
      const u = ECHOES_BY_ID.get(a.id);
      ok = buyEcho(s, a.id);
      said = u?.thing ? `${u.name} is on the bow of your boat` : `${u?.name} ${roman(echoRank(s, a.id))}`;
      break;
    }
  }
  if (!ok) return false;
  g.refreshSession();
  if (a.type === 'buyEcho') g.audio.echoBuy(); else if (a.type === 'setPearl') g.audio.pearlSet(); else if (a.type === 'liftPearl') g.audio.pearlLift(); else if (coins) g.audio.coin(coins);
  if (said) g.hud.toast(said, 'gold');
  // Owning the thing can be what a job was waiting for.
  for (const id of newlyReady(s, before)) { const q = QUESTS_BY_ID.get(id)!; g.hud.toast(readyText(q), 'gold'); }
  void g.save();
  return true;
}
