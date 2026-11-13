/**
 * The Drowned Bell: the prestige. Ringing it turns the tide: the catch is sold, what the keeper has earned comes
 * back as Echoes, and the islands forget what coins bought (tuning, the creel, bait, pot upgrades, boat parts, the
 * board). Things, the journal, the chart, relics and the story stay. Echoes buy permanent upgrades.
 */
import echoesJson from '../data/echoes.json';
import { sellAll } from './economy';
import { ECHOES_BY_ID } from './gear';
import { START, type GameState } from './state';

export const BELL = echoesJson.bell;
/** Set once the player has been shown the Bell; nothing about Echoes appears before it. */
export const BELL_FLAG = 'bell-found';

/** Coins the catch still on hand would add to this tide if sold now (ringing sells it first). */
function unsold(s: GameState): number {
  const sum = (a: number, c: { value: number }) => a + c.value;
  return s.hold.reduce(sum, 0) + s.pots.hold.reduce(sum, 0) + s.pots.placed.reduce((a, p) => a + p.fish.reduce(sum, 0), 0);
}

/**
 * Echoes the Bell would give right now. Echoes follow everything the keeper has ever earned, not one tide:
 * the Bell pays out the part of that total not yet paid. So ringing early or late changes when Echoes arrive,
 * never how many there are to have, and each one asks for more of the sea than the last.
 */
export function echoesFor(s: GameState): number {
  return Math.max(0, Math.floor(BELL.k * Math.pow(s.lifetime.coins + unsold(s), BELL.power)) - s.lifetime.echoes);
}

/** How many times the Bell has been rung. */
export function turnings(s: GameState): number { return s.run.number - 1; }

export function canRing(s: GameState): boolean { return s.flags.includes(BELL_FLAG) && echoesFor(s) >= 1; }

export function startCoins(s: GameState): number {
  const u = ECHOES_BY_ID.get('deep-pockets'), rank = s.echoUpgrades['deep-pockets'] ?? 0;
  return rank > 0 ? u?.startCoins?.[rank - 1] ?? 0 : 0;
}

export interface Turning { echoes: number; sold: number; turning: number }

/** Rings the Bell. Returns what the tide gave, or null if it cannot be rung yet. */
export function ringBell(s: GameState): Turning | null {
  if (!canRing(s)) return null;
  for (const p of s.pots.placed) s.pots.hold.push(...p.fish);
  const sold = sellAll(s);
  const echoes = echoesFor(s);
  s.echoes += echoes; s.lifetime.echoes += echoes;
  // What the islands forget.
  s.coins = startCoins(s);
  for (const id of Object.keys(s.gear.rodLevels)) s.gear.rodLevels[id] = 0;
  s.gear.baits = { breadcrumb: Infinity }; s.gear.bait = 'breadcrumb';
  s.gear.creel = 0;
  s.pots.placed = []; s.pots.hold = []; s.pots.levels = { speed: 0, size: 0, quality: 0 };
  s.boats.upgrades = {}; s.boats.at = null;
  s.quests.board = { quests: [], timer: 0, serial: s.quests.board.serial };
  s.rhythm = 0;
  s.run = { number: s.run.number + 1, coins: 0, startedAt: s.playTime };
  // The keeper wakes on the Hearthbay dock at first light.
  s.hour = BELL.dawn;
  s.world.region = START.region; s.world.pos = [...START.pos]; s.world.yaw = START.yaw; s.world.onBoat = false;
  return { echoes, sold, turning: s.run.number - 1 };
}

export function echoRank(s: GameState, id: string): number { return s.echoUpgrades[id] ?? 0; }
/** The price in Echoes of the next rank, or null at the top. */
export function echoCost(s: GameState, id: string): number | null {
  const u = ECHOES_BY_ID.get(id);
  return u ? u.cost[echoRank(s, id)] ?? null : null;
}
export function buyEcho(s: GameState, id: string): boolean {
  const c = echoCost(s, id);
  if (c === null || s.echoes < c) return false;
  s.echoes -= c;
  s.echoUpgrades[id] = echoRank(s, id) + 1;
  return true;
}
