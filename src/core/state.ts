/**
 * The whole persistent game state. Everything here is saved; nothing else is.
 * Changing this shape REQUIRES bumping SAVE_VERSION and adding a migration in save.ts.
 */
import type { BoardQuest } from './quests';

export const SAVE_VERSION = 2;

export interface CatchItem {
  uid: number; fishId: string; weight: number; trait: string | null; value: number; perfect: boolean;
}
export interface JournalEntry { caught: number; bestWeight: number; traits: string[]; firstAt: number }

export interface GameState {
  version: number;
  seed: number;
  playTime: number;           // seconds of play (open-game time only)
  hour: number;               // world clock 0–24
  coins: number;
  moonpearls: number;
  echoes: number;
  lifetime: { coins: number; catches: number; perfectHooks: number; snaps: number };
  run: { number: number; coins: number; startedAt: number };
  nextUid: number;
  hold: CatchItem[];
  holdCapacity: number;
  journal: Record<string, JournalEntry>;
  gear: {
    rods: string[]; rodLevels: Record<string, number>; rod: string;
    baits: Record<string, number>; bait: string;
    lures: string[]; lure: string | null;
    wearables: string[]; worn: { hat: string | null; coat: string | null; boots: string | null; charm: string | null };
  };
  boats: { owned: string[]; current: string | null; upgrades: Record<string, number> };
  world: { region: string; pos: [number, number, number]; yaw: number; discovered: string[]; onBoat: boolean };
  /** active: quest id → objective index → progress. board: the rotating notice-board jobs (v2). */
  quests: { active: Record<string, Record<string, number>>; done: string[]; board: { quests: BoardQuest[]; timer: number; serial: number } };
  flags: string[];
  relics: string[];
  echoUpgrades: Record<string, number>;
  rhythm: number;
}

export function newGame(seed = Date.now() % 1_000_000): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    playTime: 0,
    hour: 16.8,
    coins: 0,
    moonpearls: 0,
    echoes: 0,
    lifetime: { coins: 0, catches: 0, perfectHooks: 0, snaps: 0 },
    run: { number: 1, coins: 0, startedAt: 0 },
    nextUid: 1,
    hold: [],
    holdCapacity: 12,
    journal: {},
    gear: {
      rods: ['driftwood-rod'], rodLevels: { 'driftwood-rod': 0 }, rod: 'driftwood-rod',
      baits: { breadcrumb: Infinity }, bait: 'breadcrumb',
      lures: [], lure: null,
      wearables: [], worn: { hat: null, coat: null, boots: null, charm: null },
    },
    boats: { owned: [], current: null, upgrades: {} },
    world: { region: 'hearthbay', pos: [-118, 1.4, 22], yaw: -Math.PI / 2, discovered: ['hearthbay'], onBoat: false },
    quests: { active: {}, done: [], board: { quests: [], timer: 0, serial: 0 } },
    flags: [],
    relics: [],
    echoUpgrades: {},
    rhythm: 0,
  };
}
