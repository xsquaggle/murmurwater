/**
 * Quests: the authored story chain (src/data/quests.json) and the rotating notice board.
 * Pure functions over GameState so the bot, tests and the game all share one rule set.
 *
 * Story quests are offered by an NPC, accepted in dialogue and handed in to the same NPC.
 * Board quests are generated from templates on a play-time timer (no offline progress) and
 * pay out as soon as they are complete.
 */
import questsJson from '../data/quests.json';
import npcsJson from '../data/npcs.json';
import relicsJson from '../data/relics.json';
import boatsJson from '../data/boats.json';
import { BAITS_BY_ID, FISH, FISH_BY_ID, RARITIES, RODS_BY_ID, fish, inHours } from './content';
import { Rng, hashString } from './rng';
import type { GameState } from './state';

export type ObjectiveType = 'catch' | 'sell' | 'earn' | 'perfect' | 'own' | 'visit';
export interface ObjectiveDef {
  type: ObjectiveType; label: string; count?: number;
  /** catch: a specific species, a minimum rarity, a minimum weight, a strange trait. */
  fish?: string; rarity?: string; minWeight?: number; strange?: boolean;
  /** own: a rod, bait or boat id. */ item?: string;
  /** visit: a place id from the region's places. */ place?: string;
  /** Where to go for it, as [x, z], when it is not a place (a fishing ground): for the compass and the chart. */ at?: [number, number];
}
export interface Rewards {
  coins?: number; moonpearls?: number; items?: Record<string, number>; rods?: string[];
  flags?: string[]; relics?: string[]; boats?: string[];
}
export interface QuestDef {
  id: string; chain: 'main' | 'side'; giver: string; title: string; summary: string;
  requires: string[]; requiresFlags?: string[];
  intro: string[]; objectives: ObjectiveDef[]; outro: string[]; rewards: Rewards;
  /** Short line the giver says while the quest is in progress. */ reminder?: string;
}
export interface NpcDef { id: string; name: string; role: string; region: string; voice: string; barks: string[] }
export interface RelicDef { id: string; name: string; effect: { luck?: number; value?: number; biteSpeed?: number }; lore: string }
/** speed m/s, turn rad/s, accel 1/s, draft/length/beam m (see core/boat.ts); hull and lamp are the ratings that open rougher and foggier seas. */
export interface BoatDef { id: string; name: string; speed: number; turn: number; accel: number; draft: number; length: number; beam: number; hull: number; lamp: number; hold: number; price: number; desc: string }

export const QUESTS: QuestDef[] = questsJson.quests as QuestDef[];
export const NPCS: NpcDef[] = npcsJson.npcs as NpcDef[];
export const RELICS: RelicDef[] = relicsJson.relics as RelicDef[];
export const BOATS: BoatDef[] = boatsJson.boats as BoatDef[];
export const QUESTS_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const NPCS_BY_ID = new Map(NPCS.map((n) => [n.id, n]));
export const RELICS_BY_ID = new Map(RELICS.map((r) => [r.id, r]));
export const BOATS_BY_ID = new Map(BOATS.map((b) => [b.id, b]));

export function npc(id: string): NpcDef { const n = NPCS_BY_ID.get(id); if (!n) throw new Error(`Unknown npc ${id}`); return n; }

export type QuestEvent =
  | { type: 'catch'; fishId: string; weight: number; trait: string | null; perfect: boolean }
  | { type: 'sell'; count: number; coins: number }
  | { type: 'visit'; place: string };

// ---------------------------------------------------------------- story quests

export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';

export function questStatus(s: GameState, id: string): QuestStatus {
  const q = QUESTS_BY_ID.get(id);
  if (!q) return 'locked';
  if (s.quests.done.includes(id)) return 'done';
  if (s.quests.active[id]) return isComplete(s, q) ? 'ready' : 'active';
  if (q.requires.every((r) => s.quests.done.includes(r)) && (q.requiresFlags ?? []).every((f) => s.flags.includes(f))) return 'available';
  return 'locked';
}

/** Progress for one objective, 0..count. `own` objectives are read live from the state. */
export function objectiveProgress(s: GameState, q: QuestDef, i: number): number {
  const o = q.objectives[i];
  if (o.type === 'own') return owns(s, o.item!) ? 1 : 0;
  return Math.min(objectiveTarget(o), s.quests.active[q.id]?.[i] ?? (s.quests.done.includes(q.id) ? objectiveTarget(o) : 0));
}
export function objectiveTarget(o: ObjectiveDef): number { return o.type === 'own' || o.type === 'visit' ? 1 : o.count ?? 1; }
export function isComplete(s: GameState, q: QuestDef): boolean {
  return q.objectives.every((o, i) => objectiveProgress(s, q, i) >= objectiveTarget(o));
}

export function owns(s: GameState, item: string): boolean {
  return s.gear.rods.includes(item) || (s.gear.baits[item] ?? 0) > 0 || s.boats.owned.includes(item);
}

export function accept(s: GameState, id: string): boolean {
  if (questStatus(s, id) !== 'available') return false;
  s.quests.active[id] = {};
  return true;
}

/** Hands in a ready quest: grants rewards and marks it done. Returns the rewards, or null. */
export function turnIn(s: GameState, id: string): Rewards | null {
  if (questStatus(s, id) !== 'ready') return null;
  const q = QUESTS_BY_ID.get(id)!;
  delete s.quests.active[id];
  s.quests.done.push(id);
  applyRewards(s, q.rewards);
  return q.rewards;
}

export function applyRewards(s: GameState, r: Rewards) {
  if (r.coins) { s.coins += r.coins; s.lifetime.coins += r.coins; s.run.coins += r.coins; }
  if (r.moonpearls) s.moonpearls += r.moonpearls;
  for (const [id, n] of Object.entries(r.items ?? {})) s.gear.baits[id] = (s.gear.baits[id] ?? 0) + n;
  for (const id of r.rods ?? []) if (!s.gear.rods.includes(id)) { s.gear.rods.push(id); s.gear.rodLevels[id] = 0; }
  for (const f of r.flags ?? []) if (!s.flags.includes(f)) s.flags.push(f);
  for (const id of r.relics ?? []) if (!s.relics.includes(id)) s.relics.push(id);
  for (const id of r.boats ?? []) if (!s.boats.owned.includes(id)) { s.boats.owned.push(id); s.boats.current ??= id; }
}

export function describeRewards(r: Rewards): string[] {
  const out: string[] = [];
  if (r.coins) out.push(`◉ ${r.coins}`);
  if (r.moonpearls) out.push(`${r.moonpearls} Moonpearl${r.moonpearls > 1 ? 's' : ''}`);
  for (const [id, n] of Object.entries(r.items ?? {})) out.push(`${n} × ${BAITS_BY_ID.get(id)?.name ?? id}`);
  for (const id of r.rods ?? []) out.push(RODS_BY_ID.get(id)?.name ?? id);
  for (const id of r.relics ?? []) out.push(`Relic: ${RELICS_BY_ID.get(id)?.name ?? id}`);
  for (const id of r.boats ?? []) out.push(`Boat: ${BOATS_BY_ID.get(id)?.name ?? id}`);
  return out;
}

function matchesCatch(o: ObjectiveDef, ev: Extract<QuestEvent, { type: 'catch' }>): boolean {
  if (o.fish && o.fish !== ev.fishId) return false;
  if (o.rarity && RARITIES.indexOf(fish(ev.fishId).rarity) < RARITIES.indexOf(o.rarity as (typeof RARITIES)[number])) return false;
  if (o.minWeight && ev.weight < o.minWeight) return false;
  if (o.strange && !ev.trait) return false;
  return true;
}

/** How much an event advances an objective (0 if it doesn't apply). */
function advanceBy(o: ObjectiveDef, ev: QuestEvent): number {
  switch (o.type) {
    case 'catch': return ev.type === 'catch' && matchesCatch(o, ev) ? 1 : 0;
    case 'perfect': return ev.type === 'catch' && ev.perfect ? 1 : 0;
    case 'sell': return ev.type === 'sell' ? ev.count : 0;
    case 'earn': return ev.type === 'sell' ? ev.coins : 0;
    case 'visit': return ev.type === 'visit' && ev.place === o.place ? 1 : 0;
    default: return 0;
  }
}

export interface QuestUpdate { advanced: string[]; ready: string[]; boardDone: BoardQuest[] }

/** Feeds a gameplay event to every active story quest and accepted board quest. */
export function onQuestEvent(s: GameState, ev: QuestEvent): QuestUpdate {
  const out: QuestUpdate = { advanced: [], ready: [], boardDone: [] };
  for (const id of Object.keys(s.quests.active)) {
    const q = QUESTS_BY_ID.get(id);
    if (!q) continue;
    const was = isComplete(s, q);
    let moved = false;
    q.objectives.forEach((o, i) => {
      const n = advanceBy(o, ev);
      if (n > 0) {
        const cur = s.quests.active[id][i] ?? 0;
        const next = Math.min(objectiveTarget(o), cur + n);
        if (next !== cur) { s.quests.active[id][i] = next; moved = true; }
      }
    });
    if (moved) out.advanced.push(id);
    if (!was && isComplete(s, q)) out.ready.push(id);
  }
  for (const b of s.quests.board.quests) {
    if (!b.accepted || b.done) continue;
    const n = advanceBy(b.objective, ev);
    if (n <= 0) continue;
    b.progress = Math.min(objectiveTarget(b.objective), b.progress + n);
    if (b.progress >= objectiveTarget(b.objective)) {
      b.done = true;
      applyRewards(s, b.reward);
      out.boardDone.push(b);
    }
  }
  return out;
}

/** Story quests that just became ready because of a state change (e.g. buying the rod an `own` objective wants). */
export function newlyReady(s: GameState, before: Set<string>): string[] {
  return Object.keys(s.quests.active).filter((id) => !before.has(id) && questStatus(s, id) === 'ready');
}
export function readySet(s: GameState): Set<string> {
  return new Set(Object.keys(s.quests.active).filter((id) => questStatus(s, id) === 'ready'));
}

/** What an NPC has for the player right now, in priority order: hand-in, new offer, in-progress, nothing. */
export type NpcOffer =
  | { kind: 'turnIn'; quest: QuestDef }
  | { kind: 'offer'; quest: QuestDef }
  | { kind: 'active'; quest: QuestDef }
  | { kind: 'none' };
export function npcOffer(s: GameState, npcId: string): NpcOffer {
  const mine = QUESTS.filter((q) => q.giver === npcId);
  const turn = mine.find((q) => questStatus(s, q.id) === 'ready');
  if (turn) return { kind: 'turnIn', quest: turn };
  const offer = mine.find((q) => questStatus(s, q.id) === 'available');
  if (offer) return { kind: 'offer', quest: offer };
  const act = mine.find((q) => questStatus(s, q.id) === 'active');
  if (act) return { kind: 'active', quest: act };
  return { kind: 'none' };
}

/** The onboarding goal line: always one clear next step from the story chain. */
export interface Goal { text: string; npc?: string; place?: string; at?: [number, number] }
export function currentGoal(s: GameState): Goal {
  // 1. Anything ready to hand in (main chain first).
  const story = [...QUESTS].sort((a, b) => (a.chain === b.chain ? 0 : a.chain === 'main' ? -1 : 1));
  for (const q of story) if (questStatus(s, q.id) === 'ready') return { text: `Return to ${npc(q.giver).name}: ${q.title}`, npc: q.giver };
  // 2. The first active main quest's first unfinished objective.
  for (const q of story) {
    if (questStatus(s, q.id) !== 'active') continue;
    const i = q.objectives.findIndex((o, k) => objectiveProgress(s, q, k) < objectiveTarget(o));
    const o = q.objectives[i];
    const t = objectiveTarget(o);
    const prog = t > 1 ? ` (${objectiveProgress(s, q, i)}/${t})` : '';
    return { text: `${q.title}: ${o.label}${prog}`, place: o.place, at: o.at };
  }
  // 3. A new story quest waiting with someone.
  for (const q of story) if (questStatus(s, q.id) === 'available') return { text: `Talk to ${npc(q.giver).name}`, npc: q.giver };
  // 4. Postgame of this slice: the journal.
  const regionFish = FISH.filter((f) => f.region === s.world.region);
  const found = regionFish.filter((f) => s.journal[f.id]).length;
  return { text: `Fill the journal: ${found}/${regionFish.length} ${s.world.region === 'hearthbay' ? 'Hearthbay' : ''} fish found`.replace('  ', ' ') };
}

// ---------------------------------------------------------------- notice board

export interface BoardQuest {
  id: string; title: string; objective: ObjectiveDef; reward: Rewards;
  accepted: boolean; progress: number; done: boolean;
}
export const BOARD = { slots: 3, refreshEvery: 8 * 60, unlockFlag: 'board-open' };

export function boardOpen(s: GameState): boolean { return s.flags.includes(BOARD.unlockFlag); }

/** Ticks the board's play-time refresh timer; returns true when the board was refilled. */
export function tickBoard(s: GameState, dt: number): boolean {
  if (!boardOpen(s)) return false;
  const b = s.quests.board;
  b.timer -= dt;
  if (b.timer > 0 && b.quests.length) return false;
  refreshBoard(s);
  return true;
}

/** Replaces every slot that isn't accepted-and-unfinished with a fresh job. */
export function refreshBoard(s: GameState) {
  const b = s.quests.board;
  b.timer = BOARD.refreshEvery;
  const keep = b.quests.filter((q) => q.accepted && !q.done);
  const fresh: BoardQuest[] = [];
  while (keep.length + fresh.length < BOARD.slots) {
    b.serial++;
    fresh.push(generateBoardQuest(s, new Rng(hashString(`${s.seed}:board:${b.serial}`)), `board-${b.serial}`));
  }
  b.quests = [...keep, ...fresh];
}

export function acceptBoard(s: GameState, id: string): boolean {
  const q = s.quests.board.quests.find((x) => x.id === id);
  if (!q || q.accepted) return false;
  q.accepted = true;
  return true;
}

/** Gives a taken job back to the board: progress is lost and the slot is refilled at the next refresh. */
export function abandonBoard(s: GameState, id: string): boolean {
  const q = s.quests.board.quests.find((x) => x.id === id);
  if (!q || !q.accepted || q.done) return false;
  q.accepted = false; q.progress = 0;
  return true;
}

/** Fish the player could plausibly catch now: this region, unlocked, with a reachable zone. */
function catchable(s: GameState) {
  return FISH.filter((f) => f.region === s.world.region && (!f.requires || s.flags.includes(f.requires)) && RARITIES.indexOf(f.rarity) <= 2);
}

export function generateBoardQuest(s: GameState, rng: Rng, id: string): BoardQuest {
  const pool = catchable(s);
  const kinds = ['species', 'species', 'heavy', 'sell', 'perfect'] as const;
  const kind = rng.pick(kinds);
  const mk = (title: string, objective: ObjectiveDef, coins: number, extra: Rewards = {}): BoardQuest =>
    ({ id, title, objective, reward: { coins: Math.max(10, Math.round(coins / 5) * 5), ...extra }, accepted: false, progress: 0, done: false });
  if (kind === 'species' && pool.length) {
    const f = rng.weighted(pool, (x) => (x.rarity === 'common' ? 3 : x.rarity === 'uncommon' ? 2 : 1));
    const n = f.rarity === 'common' ? rng.int(3, 5) : f.rarity === 'uncommon' ? rng.int(2, 3) : 1;
    const night = f.hours && !inHours(12, f.hours) ? ' (after dark)' : '';
    return mk(`Wanted: ${f.name}`, { type: 'catch', fish: f.id, count: n, label: `Catch ${n} ${f.name}${night}` }, f.baseValue * n * 1.6,
      rng.chance(0.3) ? { items: { sandworm: 5 } } : {});
  }
  if (kind === 'heavy' && pool.length) {
    const f = rng.pick(pool);
    const w = Math.round((f.weight[0] + (f.weight[1] - f.weight[0]) * 0.65) * 10) / 10;
    return mk(`A Big One`, { type: 'catch', fish: f.id, minWeight: w, count: 1, label: `Catch a ${f.name} over ${w} kg` }, f.baseValue * 4);
  }
  if (kind === 'perfect') {
    const n = rng.int(2, 4);
    return mk(`Steady Hands`, { type: 'perfect', count: n, label: `Land ${n} perfect hooks` }, 30 * n);
  }
  const n = rng.int(6, 12);
  const avg = pool.length ? pool.reduce((a, f) => a + f.baseValue, 0) / pool.length : 10;
  return mk(`Market Day`, { type: 'sell', count: n, label: `Sell ${n} fish` }, avg * n * 0.5);
}

// ---------------------------------------------------------------- relics

export function relicBonus(s: GameState, key: keyof RelicDef['effect']): number {
  return s.relics.reduce((a, id) => a + (RELICS_BY_ID.get(id)?.effect[key] ?? 0), 0);
}

// ---------------------------------------------------------------- validation

export function validateQuests(placeIds: Set<string>): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const q of QUESTS) {
    if (ids.has(q.id)) errs.push(`duplicate quest ${q.id}`);
    ids.add(q.id);
    if (!NPCS_BY_ID.has(q.giver)) errs.push(`${q.id}: unknown giver ${q.giver}`);
    if (!q.intro.length || !q.outro.length) errs.push(`${q.id}: needs intro and outro lines`);
    if (!q.objectives.length) errs.push(`${q.id}: no objectives`);
    for (const o of q.objectives) {
      if (!['catch', 'sell', 'earn', 'perfect', 'own', 'visit'].includes(o.type)) errs.push(`${q.id}: bad objective type ${o.type}`);
      if (o.fish && !FISH_BY_ID.has(o.fish)) errs.push(`${q.id}: unknown fish ${o.fish}`);
      if (o.type === 'own' && !(RODS_BY_ID.has(o.item!) || BAITS_BY_ID.has(o.item!) || BOATS_BY_ID.has(o.item!))) errs.push(`${q.id}: unknown item ${o.item}`);
      if (o.type === 'visit' && !placeIds.has(o.place!)) errs.push(`${q.id}: unknown place ${o.place}`);
    }
    const r = q.rewards;
    for (const id of Object.keys(r.items ?? {})) if (!BAITS_BY_ID.has(id)) errs.push(`${q.id}: unknown reward bait ${id}`);
    for (const id of r.rods ?? []) if (!RODS_BY_ID.has(id)) errs.push(`${q.id}: unknown reward rod ${id}`);
    for (const id of r.relics ?? []) if (!RELICS_BY_ID.has(id)) errs.push(`${q.id}: unknown relic ${id}`);
    for (const id of r.boats ?? []) if (!BOATS_BY_ID.has(id)) errs.push(`${q.id}: unknown boat ${id}`);
  }
  for (const q of QUESTS) for (const r of q.requires) if (!ids.has(r)) errs.push(`${q.id}: requires unknown quest ${r}`);
  // Every quest must be reachable from the start (no cycles, no orphans).
  const done = new Set<string>();
  let grew = true;
  while (grew) { grew = false; for (const q of QUESTS) if (!done.has(q.id) && q.requires.every((r) => done.has(r))) { done.add(q.id); grew = true; } }
  for (const q of QUESTS) if (!done.has(q.id)) errs.push(`${q.id}: unreachable (cycle in requires)`);
  for (const n of NPCS) if (!n.barks.length) errs.push(`npc ${n.id}: no barks`);
  return errs;
}
