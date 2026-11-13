/**
 * The whole persistent game state. Everything here is saved; nothing else is.
 * Changing this shape REQUIRES bumping SAVE_VERSION and adding a migration in save.ts.
 */
import type { BoardQuest } from './quests';

export const SAVE_VERSION = 4;
/** One in-game day lasts this many seconds of play. */
export const DAY_LENGTH_S = 24 * 60;

export interface CatchItem {
  uid: number; fishId: string; weight: number; trait: string | null; value: number; perfect: boolean;
}
export interface JournalEntry { caught: number; bestWeight: number; traits: string[]; firstAt: number }
/** A Lantern Pot in the water: where it sits, what it has trapped, and its clock (n counts its catches, for its dice). */
export interface PotState { id: number; region: string; zone: string | null; x: number; z: number; fish: CatchItem[]; t: number; n: number }

export interface GameState {
  version: number;
  seed: number;
  playTime: number;           // seconds of play (open-game time only)
  hour: number;               // world clock 0–24
  coins: number;
  moonpearls: number;
  echoes: number;
  lifetime: { coins: number; catches: number; perfectHooks: number; snaps: number; echoes: number };
  /** One tide, from one ringing of the Bell to the next. number counts from 1. */
  run: { number: number; coins: number; startedAt: number };
  nextUid: number;
  /** Hand-caught fish waiting to be sold. Its size comes from gear (core/gear.ts stats().hold), not from the save (v4). */
  hold: CatchItem[];
  journal: Record<string, JournalEntry>;
  gear: {
    rods: string[]; rodLevels: Record<string, number>; rod: string;
    baits: Record<string, number>; bait: string;
    lures: string[]; lure: string | null;
    wearables: string[]; worn: { hat: string | null; coat: string | null; boots: string | null; charm: string | null };
    /** How many times the creel has been enlarged (v4). */ creel: number;
  };
  /** Lantern Pots (v4): how many are owned, the ones in the water, the fish hauled from them, and their upgrade levels. */
  pots: { owned: number; placed: PotState[]; hold: CatchItem[]; levels: { speed: number; size: number; quality: number }; nextId: number };
  /** at: where the current boat floats (null until it is first put in the water) (v3). */
  boats: { owned: string[]; current: string | null; upgrades: Record<string, number>; at: { x: number; z: number; heading: number } | null };
  /** discovered: regions reached. charted: places found and marked on the chart (v3). onBoat: the player is aboard. */
  world: { region: string; pos: [number, number, number]; yaw: number; discovered: string[]; charted: string[]; onBoat: boolean };
  /** active: quest id → objective index → progress. board: the rotating notice-board jobs (v2). */
  quests: { active: Record<string, Record<string, number>>; done: string[]; board: { quests: BoardQuest[]; timer: number; serial: number } };
  flags: string[];
  relics: string[];
  echoUpgrades: Record<string, number>;
  rhythm: number;
}

/** Where a new keeper stands, and where the Bell puts them back. */
export const START = { region: 'hearthbay', pos: [-118, 1.4, 22] as [number, number, number], yaw: -Math.PI / 2 };

export function newGame(seed = Date.now() % 1_000_000): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    playTime: 0,
    hour: 6.0,
    coins: 0,
    moonpearls: 0,
    echoes: 0,
    lifetime: { coins: 0, catches: 0, perfectHooks: 0, snaps: 0, echoes: 0 },
    run: { number: 1, coins: 0, startedAt: 0 },
    nextUid: 1,
    hold: [],
    journal: {},
    gear: {
      rods: ['driftwood-rod'], rodLevels: { 'driftwood-rod': 0 }, rod: 'driftwood-rod',
      baits: { breadcrumb: Infinity }, bait: 'breadcrumb',
      lures: [], lure: null,
      wearables: [], worn: { hat: null, coat: null, boots: null, charm: null },
      creel: 0,
    },
    pots: { owned: 0, placed: [], hold: [], levels: { speed: 0, size: 0, quality: 0 }, nextId: 1 },
    boats: { owned: [], current: null, upgrades: {}, at: null },
    world: { region: START.region, pos: [...START.pos], yaw: START.yaw, discovered: ['hearthbay'], charted: ['hearthbay'], onBoat: false },
    quests: { active: {}, done: [], board: { quests: [], timer: 0, serial: 0 } },
    flags: [],
    relics: [],
    echoUpgrades: {},
    rhythm: 0,
  };
}
