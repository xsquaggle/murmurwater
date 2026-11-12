/**
 * Typed access to the JSON content in src/data. All content is validated once at load;
 * tests call validateContent() so broken data fails CI, not the player.
 */
import fishJson from '../data/fish.json';
import rodsJson from '../data/rods.json';
import baitsJson from '../data/baits.json';
import regionsJson from '../data/regions.json';
import type { RegionDef } from './world';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'uncanny'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface FightStats { strength: number; stamina: number; temper: number; thrash: number }
export interface FishDef {
  id: string; name: string; rarity: Rarity; region: string; zones: string[];
  baseValue: number; weight: [number, number]; /** typical nose-to-tail length in metres (models are scaled to it) */ length: number; fight: FightStats; biteWindow: number;
  hours?: [number, number]; requires?: string; lore: string;
}
export interface RodDef {
  id: string; name: string; tier: number; rarity: string; price: number;
  reach: number; power: number; control: number; luck: number; grace: number; desc: string;
}
export interface BaitDef {
  id: string; name: string; price: number; biteSpeed: number; affinity: Record<string, number>; rarityBoost?: number; desc: string;
}
export interface ZoneDef { id: string; name: string; x: number; z: number; r: number; priority: number }
/** A spot in the world the player can interact with (quest targets, stalls, the ferry). */
export interface PlaceDef { id: string; name: string; x: number; z: number; r: number }
/** Where an NPC stands; an NPC can have one spot per island (Pell follows the ferry). */
export interface NpcSpot { npc: string; island: string; x: number; z: number; yaw: number }
export interface FerryPoint { x: number; z: number; yaw: number; boat: [number, number, number] }
export interface RegionContent extends RegionDef {
  zones: ZoneDef[]; places?: PlaceDef[]; npcSpots?: NpcSpot[]; ferry?: Record<string, FerryPoint>;
}

export const FISH: FishDef[] = fishJson.fish as FishDef[];
export const RODS: RodDef[] = rodsJson.rods as RodDef[];
export const BAITS: BaitDef[] = baitsJson.baits as BaitDef[];
export const REGIONS: RegionContent[] = regionsJson.regions as unknown as RegionContent[];

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
export const FISH_BY_ID = byId(FISH);
export const RODS_BY_ID = byId(RODS);
export const BAITS_BY_ID = byId(BAITS);
export const REGIONS_BY_ID = byId(REGIONS);

export function fish(id: string): FishDef { const f = FISH_BY_ID.get(id); if (!f) throw new Error(`Unknown fish ${id}`); return f; }
export function rod(id: string): RodDef { const r = RODS_BY_ID.get(id); if (!r) throw new Error(`Unknown rod ${id}`); return r; }
export function bait(id: string): BaitDef { const b = BAITS_BY_ID.get(id); if (!b) throw new Error(`Unknown bait ${id}`); return b; }

/** The highest-priority zone containing (x, z) in a region, or null if none. */
export function zoneAt(region: RegionContent, x: number, z: number): ZoneDef | null {
  let best: ZoneDef | null = null;
  for (const zn of region.zones) {
    if (Math.hypot(x - zn.x, z - zn.z) <= zn.r && (!best || zn.priority > best.priority)) best = zn;
  }
  return best;
}

/** Returns a list of problems; empty means valid. */
export function validateContent(): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const zoneIds = new Set(REGIONS.flatMap((r) => r.zones.map((z) => z.id)));
  for (const f of FISH) {
    if (ids.has(f.id)) errs.push(`duplicate id ${f.id}`);
    ids.add(f.id);
    if (!RARITIES.includes(f.rarity)) errs.push(`${f.id}: bad rarity ${f.rarity}`);
    if (!REGIONS_BY_ID.has(f.region)) errs.push(`${f.id}: unknown region ${f.region}`);
    for (const z of f.zones) if (!zoneIds.has(z)) errs.push(`${f.id}: unknown zone ${z}`);
    if (!(f.weight[0] > 0 && f.weight[1] > f.weight[0])) errs.push(`${f.id}: bad weight range`);
    if (f.baseValue <= 0) errs.push(`${f.id}: baseValue must be > 0`);
    if (!(f.length > 0.05 && f.length < 5)) errs.push(`${f.id}: length out of range`);
    if (f.biteWindow < 0.3 || f.biteWindow > 2) errs.push(`${f.id}: biteWindow out of range`);
    for (const k of ['strength', 'stamina', 'temper', 'thrash'] as const) if (typeof f.fight[k] !== 'number') errs.push(`${f.id}: fight.${k} missing`);
    if (f.hours && (f.hours[0] < 0 || f.hours[0] > 24 || f.hours[1] < 0 || f.hours[1] > 24)) errs.push(`${f.id}: bad hours`);
  }
  for (const r of RODS) { if (r.reach <= 0 || r.power <= 0 || r.control <= 0) errs.push(`rod ${r.id}: stats must be > 0`); }
  for (const b of BAITS) { for (const k of Object.keys(b.affinity)) if (!FISH_BY_ID.has(k)) errs.push(`bait ${b.id}: unknown fish ${k}`); }
  for (const r of REGIONS) {
    if (!r.zones.length) errs.push(`region ${r.id}: no zones`);
    const islands = new Set(r.islands.map((i) => i.id));
    for (const sp of r.npcSpots ?? []) if (!islands.has(sp.island)) errs.push(`region ${r.id}: npc ${sp.npc} on unknown island ${sp.island}`);
    for (const k of Object.keys(r.ferry ?? {})) if (!islands.has(k)) errs.push(`region ${r.id}: ferry to unknown island ${k}`);
  }
  return errs;
}

/** True when the hour falls inside [start, end), wrapping past midnight. */
export function inHours(h: number, range?: [number, number]): boolean {
  if (!range) return true;
  const [a, b] = range;
  return a <= b ? h >= a && h < b : h >= a || h < b;
}
