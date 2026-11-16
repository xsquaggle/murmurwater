/**
 * Typed access to the JSON content in src/data. All content is validated once at load;
 * tests call validateContent() so broken data fails CI, not the player.
 */
import type { GroveDef } from './flora';
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
  /** The journal's riddle for a fish that `requires` something, shown until that has happened. */ hint?: string;
}
export interface RodDef {
  id: string; name: string; tier: number; rarity: string; price: number;
  reach: number; power: number; control: number; luck: number; grace: number; desc: string;
  /** A flag the shelf waits for before it stocks this (`reached:<region>`: the keeper has been there). */ from?: string;
}
export interface BaitDef {
  id: string; name: string; price: number; biteSpeed: number; affinity: Record<string, number>; rarityBoost?: number; /** What it is for, in a few words (the shop). */ blurb: string; desc: string;
  /** A flag the shelf waits for before it stocks this. */ from?: string;
}
export interface ZoneDef { id: string; name: string; x: number; z: number; r: number; priority: number; /** For the journal: "off the dock", "in the Sump". */ hint?: string }
/**
 * A spot in the world the player can interact with (quest targets, stalls, the ferry). One with a `prompt` is
 * something to look at: doing so shows its `text` a line at a time, sets `flag` if it has one, and counts as a visit.
 * `dark`: the lines are read with the eyes shut, over a darkened screen.
 */
export interface PlaceDef {
  id: string; name: string; x: number; z: number; r: number; prompt?: string; text?: string[]; flag?: string; dark?: boolean;
  /** Looked at from a boat lying within `r` of it, not on foot (it stands in the water). */ fromBoat?: boolean;
}
/** Something standing in the world: `model` names a builder in render/props (which uses the made model when there is one); `block` is the radius the player walks round. */
export interface PropDef { model: string; x: number; z: number; yaw: number; block?: number; /** A flag: once it is set the thing is gone. */ until?: string }
/** Where an NPC stands; an NPC can have one spot per island (Pell follows the ferry). */
export interface NpcSpot { npc: string; island: string; x: number; z: number; yaw: number }
/** An ambient animal that wanders within `r` of (x, z). */
export interface CritterDef { id: string; kind: 'cat'; island: string; x: number; z: number; r: number }
/**
 * Somebody met from the water: they stand at (x, z), on the sea, and a boat lying still within `r` of them can
 * hail them. They are there until they have signed on as a deckhand (an NPC and a deckhand share an id).
 */
export interface HailDef { npc: string; x: number; z: number; yaw: number; r: number }
export interface FerryPoint { x: number; z: number; yaw: number; boat: [number, number, number] }
/**
 * A place that goes on the chart when the player first comes within `r` of it (r 0 = known from the start).
 * `coins` is the finder's reward; `note` is the line written beside it on the chart.
 */
export interface ChartPlace { id: string; name: string; kind: 'island' | 'rocks' | 'bar'; x: number; z: number; r: number; coins?: number; note?: string }
/** Somewhere to leave a boat: a fast-travel point once its chart place is found. */
export interface MooringDef { id: string; name: string; place: string; x: number; z: number; heading: number }
/** A sea chest waiting where a boat can reach it: opened once, and it stays open. */
export interface ChestDef { id: string; x: number; z: number; yaw: number; coins: number; items?: Record<string, number>; lures?: string[]; wearables?: string[]; text: string }
export interface RegionContent extends RegionDef {
  zones: ZoneDef[]; places?: PlaceDef[]; npcSpots?: NpcSpot[]; critters?: CritterDef[]; ferry?: Record<string, FerryPoint>;
  chart?: ChartPlace[]; moorings?: MooringDef[]; chests?: ChestDef[];
  /** People met from a boat. */
  hails?: HailDef[];
  /** What turns a boat back at the edge of the region (shown while the sea murmurs). */
  edgeHint?: string;
  /** A line under the region's name when the player sails into it. */
  tagline?: string;
  /** Stands of drowned trees (see flora.ts). */
  groves?: GroveDef[];
  /** Still, shallow water where lilies lie: [x, z, radius]. */
  lilies?: [number, number, number][];
  props?: PropDef[];
}

/**
 * A sea-road: the one way through the Murmur Fog between two regions, for a boat that carries a fog lamp.
 * `a` lies inside the first region of `between` and `b` inside the second; the road is the straight line
 * between them, `halfWidth` to either side.
 */
export interface RoadDef { id: string; name: string; between: [string, string]; a: [number, number]; b: [number, number]; halfWidth: number }

/** Metres between one light of a sea-road and the next on the same side, and how far inside the road's edge each line stands. */
export const ROAD_LIGHTS = { spacing: 44, inset: 12 };
/**
 * Where the lights of a sea-road stand: two staggered lines of them, alternating sides, numbered from end `a`.
 * (The scene leaves one out where its spar would stand in the ground.)
 */
export function roadLights(r: RoadDef): { i: number; x: number; z: number; along: number }[] {
  const vx = r.b[0] - r.a[0], vz = r.b[1] - r.a[1], L = Math.hypot(vx, vz), ux = vx / L, uz = vz / L;
  const off = r.halfWidth - ROAD_LIGHTS.inset, n = Math.floor(L / (ROAD_LIGHTS.spacing / 2));
  const out: { i: number; x: number; z: number; along: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const side = i % 2 ? 1 : -1, t = (i / n) * L;
    out.push({ i, x: r.a[0] + ux * t + uz * off * side, z: r.a[1] + uz * t - ux * off * side, along: i / n });
  }
  return out;
}

export const FISH: FishDef[] = fishJson.fish as FishDef[];
export const RODS: RodDef[] = rodsJson.rods as RodDef[];
export const BAITS: BaitDef[] = baitsJson.baits as unknown as BaitDef[];
export const REGIONS: RegionContent[] = regionsJson.regions as unknown as RegionContent[];
export const ROADS: RoadDef[] = ((regionsJson as { roads?: unknown }).roads ?? []) as RoadDef[];

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
export const FISH_BY_ID = byId(FISH);
export const RODS_BY_ID = byId(RODS);
export const BAITS_BY_ID = byId(BAITS);
export const REGIONS_BY_ID = byId(REGIONS);

export function fish(id: string): FishDef { const f = FISH_BY_ID.get(id); if (!f) throw new Error(`Unknown fish ${id}`); return f; }
export function rod(id: string): RodDef { const r = RODS_BY_ID.get(id); if (!r) throw new Error(`Unknown rod ${id}`); return r; }
export function bait(id: string): BaitDef { const b = BAITS_BY_ID.get(id); if (!b) throw new Error(`Unknown bait ${id}`); return b; }

/** A region's open water: its widest, lowest-priority zone. */
export function openZone(region: RegionContent): ZoneDef | null {
  let open: ZoneDef | null = null;
  for (const zn of region.zones) if (!open || zn.priority < open.priority || (zn.priority === open.priority && zn.r > open.r)) open = zn;
  return open;
}

/**
 * The highest-priority zone containing (x, z) in a region. Past every zone's rim (a sea-road runs out beyond
 * the region's edge) the water is still the region's open water: never "no zone", which the fishing rules
 * would read as every fish of the region.
 */
export function zoneAt(region: RegionContent, x: number, z: number): ZoneDef | null {
  let best: ZoneDef | null = null;
  for (const zn of region.zones) {
    if (Math.hypot(x - zn.x, z - zn.z) <= zn.r && (!best || zn.priority > best.priority)) best = zn;
  }
  return best ?? openZone(region);
}

/**
 * The journal's line for a fish not yet caught: its home water (the first zone it is listed in) and when it is
 * about. A fish that waits on something keeps its own riddle until that thing has happened.
 */
export function fishHint(f: FishDef, flags: readonly string[]): string {
  if (f.requires && !flags.includes(f.requires)) return f.hint ?? 'Something is waiting.';
  const zone = REGIONS_BY_ID.get(f.region)?.zones.find((z) => z.id === f.zones[0]);
  const hr = (h: number) => (h % 24 === 0 ? 'midnight' : h === 12 ? 'noon' : `${h}:00`);
  const time = f.hours ? (f.hours[0] > f.hours[1] ? ' after dark' : ` between ${hr(f.hours[0])} and ${hr(f.hours[1])}`) : '';
  return `Bites ${zone?.hint ?? 'in open water'}${time}`;
}

/** Is this on the shelf yet? Goods from further waters wait until the keeper has been there. */
export function onShelf(flags: readonly string[], item: { from?: string }): boolean { return !item.from || flags.includes(item.from); }

/** The chart place an island belongs to. */
export function placeOfIsland(i: { id: string; place?: string }): string { return i.place ?? i.id; }

/** The sea-roads that leave a region. */
export function roadsOf(region: string): RoadDef[] { return ROADS.filter((r) => r.between.includes(region)); }

/** Where (x, z) lies on a road: `along` 0 at a to 1 at b (not clamped), `off` metres to the side. */
export function roadPoint(r: RoadDef, x: number, z: number): { along: number; off: number } {
  const vx = r.b[0] - r.a[0], vz = r.b[1] - r.a[1], L2 = vx * vx + vz * vz;
  const along = ((x - r.a[0]) * vx + (z - r.a[1]) * vz) / L2;
  return { along, off: Math.abs((x - r.a[0]) * vz - (z - r.a[1]) * vx) / Math.sqrt(L2) };
}

/**
 * 0..1: how far a road lifts the murmur at (x, z). 1 down the middle, falling away over the outer third of its
 * width, and nothing beyond its ends.
 */
export function roadOpen(r: RoadDef, x: number, z: number): number {
  const p = roadPoint(r, x, z);
  if (p.along < 0 || p.along > 1 || p.off >= r.halfWidth) return 0;
  const t = Math.min(1, (r.halfWidth - p.off) / (r.halfWidth * 0.34));
  return t * t * (3 - 2 * t);
}

/** How far the roads out of `region` lift the murmur at (x, z). */
export function roadsOpen(region: string, x: number, z: number): number {
  let best = 0;
  for (const r of ROADS) if (r.between.includes(region)) best = Math.max(best, roadOpen(r, x, z));
  return best;
}

/**
 * The region the sea-road under (x, z) leads to from `region`, or null off the roads: where she is bound.
 * Given a heading, only a boat pointing along the road toward that region is bound for it (one that has just
 * come through, or has turned for home, is not).
 */
export function regionAhead(region: string, x: number, z: number, heading?: number): string | null {
  for (const r of ROADS) {
    const i = r.between.indexOf(region);
    if (i < 0) continue;
    const p = roadPoint(r, x, z);
    if (p.off > r.halfWidth * 1.5 || p.along < -0.05 || p.along > 1.05) continue;
    if (heading !== undefined) {
      const toward = i === 0 ? 1 : -1;
      if ((Math.sin(heading) * (r.b[0] - r.a[0]) + Math.cos(heading) * (r.b[1] - r.a[1])) * toward <= 0) continue;
    }
    return r.between[1 - i];
  }
  return null;
}

/**
 * How far past half way (as a share of the road) a boat must be before the region changes. A little, so that
 * a boat turning about on the line does not change waters with every yard: coming back, she must cross it by
 * as much again.
 */
export const SWAP_BAND = 0.015;

/**
 * The region a boat on a sea-road has crossed into, or null while it is still in `region`: the change is made
 * just past half way along the road (`SWAP_BAND`), in the thick of the fog.
 */
export function regionAcross(region: string, x: number, z: number): string | null {
  for (const r of ROADS) {
    const i = r.between.indexOf(region);
    if (i < 0) continue;
    const p = roadPoint(r, x, z);
    if (p.off > r.halfWidth || p.along < 0 || p.along > 1) continue;
    if (i === 0 ? p.along > 0.5 + SWAP_BAND : p.along < 0.5 - SWAP_BAND) return r.between[1 - i];
  }
  return null;
}

/**
 * 0..1: how near (x, z) is to the middle of a crossing, where the fog is at its thickest and the game changes
 * region. It rises over the last fourteenth of the road before half way and falls again after.
 */
export function crossingAt(region: string, x: number, z: number): number {
  let best = 0;
  for (const r of ROADS) {
    if (!r.between.includes(region)) continue;
    const p = roadPoint(r, x, z);
    if (p.off > r.halfWidth) continue;
    const t = Math.min(1, Math.max(0, 1 - Math.abs(p.along - 0.5) / 0.07));
    best = Math.max(best, t * t * (3 - 2 * t));
  }
  return best;
}

/** The region whose waters (x, z) lies in, or null out in the fog between them. */
export function regionAt(x: number, z: number): string | null {
  for (const r of REGIONS) if (Math.hypot(x - r.center[0], z - r.center[1]) <= r.radius) return r.id;
  return null;
}
/** The region an NPC stands in (the first that has a spot for them). */
export function regionOfNpc(id: string): string | null { return REGIONS.find((r) => (r.npcSpots ?? []).some((n) => n.npc === id) || (r.hails ?? []).some((n) => n.npc === id))?.id ?? null; }
/** The region a named place lies in: somewhere to look at, or a place on the chart. */
export function regionOfPlace(id: string): string | null {
  return REGIONS.find((r) => (r.places ?? []).some((p) => p.id === id) || (r.chart ?? []).some((c) => c.id === id))?.id ?? null;
}
/** The region a mooring lies in, with the mooring. */
export function findMooring(id: string): { region: RegionContent; mooring: MooringDef } | null {
  for (const region of REGIONS) { const mooring = (region.moorings ?? []).find((m) => m.id === id); if (mooring) return { region, mooring }; }
  return null;
}

/**
 * Where to steer from `from` to get to `to`: the near end of the first sea-road on the shortest way there
 * (counted in roads), and the region it leads into. Null if there is no way, or the two are the same.
 */
export function roadToward(from: string, to: string): { road: RoadDef; x: number; z: number; next: string } | null {
  if (from === to) return null;
  // Breadth first from the far end, so each region learns its next step toward `to`.
  const step = new Map<string, RoadDef>(), queue = [to], seen = new Set([to]);
  while (queue.length) {
    const at = queue.shift()!;
    for (const r of ROADS) {
      const i = r.between.indexOf(at);
      if (i < 0) continue;
      const other = r.between[1 - i];
      if (seen.has(other)) continue;
      seen.add(other); step.set(other, r); queue.push(other);
    }
  }
  const road = step.get(from);
  if (!road) return null;
  const i = road.between.indexOf(from), end = i === 0 ? road.a : road.b;
  return { road, x: end[0], z: end[1], next: road.between[1 - i] };
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
  const stocked = (who: string, from?: string) => { if (from && !(from.startsWith('reached:') && REGIONS_BY_ID.has(from.slice(8)))) errs.push(`${who}: stocked from an unknown place (${from})`); };
  for (const r of RODS) { if (r.reach <= 0 || r.power <= 0 || r.control <= 0) errs.push(`rod ${r.id}: stats must be > 0`); stocked(`rod ${r.id}`, r.from); }
  for (const b of BAITS) { for (const k of Object.keys(b.affinity)) if (!FISH_BY_ID.has(k)) errs.push(`bait ${b.id}: unknown fish ${k}`); stocked(`bait ${b.id}`, b.from); }
  for (const r of REGIONS) {
    if (!r.zones.length) errs.push(`region ${r.id}: no zones`);
    const islands = new Set(r.islands.map((i) => i.id));
    for (const sp of r.npcSpots ?? []) if (!islands.has(sp.island)) errs.push(`region ${r.id}: npc ${sp.npc} on unknown island ${sp.island}`);
    for (const c of r.critters ?? []) if (!islands.has(c.island)) errs.push(`region ${r.id}: critter ${c.id} on unknown island ${c.island}`);
    for (const k of Object.keys(r.ferry ?? {})) if (!islands.has(k)) errs.push(`region ${r.id}: ferry to unknown island ${k}`);
    const charted = new Set((r.chart ?? []).map((c) => c.id));
    if (charted.size !== (r.chart ?? []).length) errs.push(`region ${r.id}: duplicate chart place`);
    for (const m of r.moorings ?? []) if (!charted.has(m.place)) errs.push(`region ${r.id}: mooring ${m.id} at unknown chart place ${m.place}`);
    for (const i of r.islands) if (i.place && !charted.has(i.place)) errs.push(`region ${r.id}: island ${i.id} belongs to unknown chart place ${i.place}`);
    const placeIds = (r.places ?? []).map((p) => p.id);
    if (new Set(placeIds).size !== placeIds.length) errs.push(`region ${r.id}: duplicate place`);
    for (const p of r.places ?? []) if (p.prompt && !p.text?.length) errs.push(`region ${r.id}: place ${p.id} has a prompt and nothing to read`);
    for (const c of r.chests ?? []) {
      for (const id of Object.keys(c.items ?? {})) if (!BAITS_BY_ID.has(id)) errs.push(`region ${r.id}: chest ${c.id} holds unknown bait ${id}`);
    }
  }
  const places = REGIONS.flatMap((r) => (r.chart ?? []).map((c) => c.id));
  if (new Set(places).size !== places.length) errs.push('a chart place id is used in two regions');
  for (const road of ROADS) {
    const [a, b] = road.between.map((id) => REGIONS_BY_ID.get(id));
    if (!a || !b) { errs.push(`road ${road.id}: unknown region`); continue; }
    // Each end must lie in clear water inside its own region, short of the fog, so the road can be found and left.
    const inside = (r: RegionContent, p: [number, number]) => Math.hypot(p[0] - r.center[0], p[1] - r.center[1]) < r.radius - 110;
    if (!inside(a, road.a) || !inside(b, road.b)) errs.push(`road ${road.id}: an end lies in the fog or outside its region`);
  }
  return errs;
}

/** After dark: from half past six in the evening to half past five in the morning. */
export function isNight(hour: number): boolean { return hour >= 18.5 || hour < 5.5; }

/** True when the hour falls inside [start, end), wrapping past midnight. */
export function inHours(h: number, range?: [number, number]): boolean {
  if (!range) return true;
  const [a, b] = range;
  return a <= b ? h >= a && h < b : h >= a || h < b;
}
