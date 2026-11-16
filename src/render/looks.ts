/**
 * What a region looks like beyond its light (see daycycle's GRADES for that): the colours of its ground and
 * sea bed, of its water, and how lively the sea is. Chosen by the region's `grade`; Hearthbay ("amber") is the
 * default everything else is a change from. Hues come from docs/ART_BIBLE.md.
 */
import { Color } from 'three';
import { PALETTE } from './palette';

export interface TerrainLook {
  sand: string; wetSand: string; seaSand: string; deepFloor: string;
  moss: string; mossLight: string; pine: string;
  rock: string; rockDark: string; rockWarm: string; rockLight: string;
  /** The top of a reed bed (a shoal just under the water), or null where the region has none. */
  reedBed: string | null;
}
export interface WaterLook {
  deep: string; mid: string; shallow: string; foam: string;
  /** How much of the usual swell there is (1 = Hearthbay). */
  swell: number;
  /** How much foam laps the shores (1 = a sea beach, near 0 = a marsh). */
  shoreFoam: number;
  /** How fast the water hides what is under it, per metre (lower = clearer). */
  murk: number;
}
export interface RegionLook { terrain: TerrainLook; water: WaterLook }

/** Two hues mixed as the renderer mixes them (in linear light). */
const mix = (a: string, b: string, t: number) => '#' + new Color(a).lerp(new Color(b), t).getHexString();

const AMBER: RegionLook = {
  terrain: {
    sand: mix(PALETTE.bone, '#E2C796', 0.55), wetSand: '#C9AE82', seaSand: '#B8A27C', deepFloor: mix(PALETTE.murmur, PALETTE.abyss, 0.4),
    moss: mix(PALETTE.moss, '#5E9A48', 0.45), mossLight: '#94BC5C', pine: PALETTE.pine,
    rock: PALETTE.slate, rockDark: '#4A505E', rockWarm: '#7A7068', rockLight: '#8E8A86', reedBed: null,
  },
  water: { deep: PALETTE.abyss, mid: PALETTE.murmur, shallow: PALETTE.lagoon, foam: PALETTE.seafoam, swell: 1, shoreFoam: 1, murk: 0.45 },
};

/** Mossglass Fen: peat and mud for sand, an olive silt bed, and still water like green bottle glass. */
const MOSS: RegionLook = {
  terrain: {
    sand: '#9C8A62', wetSand: '#6F6247', seaSand: '#7F8A58', deepFloor: '#17382F',
    moss: '#4F8A4A', mossLight: '#9DBB5A', pine: '#2C5740',
    rock: '#5F6B60', rockDark: '#414C47', rockWarm: '#6F6A58', rockLight: '#84897A', reedBed: '#6C7A3E',
  },
  water: { deep: '#06231F', mid: '#2C8566', shallow: '#8EDDB0', foam: '#DDF3D6', swell: 0.4, shoreFoam: 0.12, murk: 0.2 },
};

const LOOKS: Record<string, RegionLook> = { amber: AMBER, moss: MOSS };
export function lookOf(grade: string): RegionLook { return LOOKS[grade] ?? AMBER; }
