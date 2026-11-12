/** The "Lantern Dusk" palette. See docs/ART_BIBLE.md §2. Do not add hues here without updating the bible. */
import { Color } from 'three';

export const PALETTE = {
  abyss: '#0B2E36',
  murmur: '#17595E',
  lagoon: '#3FA7A0',
  seafoam: '#D8F3E6',
  lantern: '#FFB35C',
  wick: '#FFE2A0',
  duskViolet: '#3B2A4F',
  heather: '#7A6390',
  bone: '#F2E3C6',
  slate: '#5C6670',
  moss: '#6F8F4E',
  pine: '#2F4E3A',
  driftwood: '#8A6A4F',
  coral: '#E86F6F',
  wrongCyan: '#7CFFD4',
  dreamViolet: '#B48CFF',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Linear-space Color for a palette entry (three handles sRGB→linear on construction). */
export function pc(key: PaletteKey): Color { return new Color(PALETTE[key]); }

/** Palette colour with a value/hue jitter, for per-face variation. */
export function jitter(c: Color, amount: number, rnd: () => number): Color {
  const out = c.clone();
  const k = 1 + (rnd() * 2 - 1) * amount;
  out.r *= k; out.g *= k; out.b *= k;
  return out;
}
