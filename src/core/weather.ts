/**
 * Weather that keeps hours. A region may have storms (content: `storms`), each of which blows at the same hours
 * of every day. So the weather is a function of the region and the hour and nothing else: nothing is saved, and
 * loading a game or waiting with the game shut cannot change it. Pure.
 */
import { REGIONS_BY_ID, inHours, type StormDef, type WeatherNeed } from './content';

export interface Weather {
  /** The storm that is on, or null in fair weather. */
  storm: StormDef | null;
  /** 0..1: how hard it blows now (the storm's strength, eased in and out at its ends and let down in its eye). */
  power: number;
  /** 0..1: how hard it rains. */
  rain: number;
  /** Lightning is coming down. */
  thunder: boolean;
  /** 0..1: how far into the calm of the eye. */
  eye: number;
}

/** Hours a storm takes to come up and to blow out, and the eye to open and to close. */
export const STORM = { ramp: 0.35, eyeRamp: 0.2, eyePower: 0.08, dryRain: 0.12 };

/**
 * Struck water: where lightning has gone into the sea, a cast gets a quick bite and the dice are thrown with a
 * great deal of luck. `every` is the seconds between bolts near the keeper, `life` how long the water stays lit,
 * `radius` how near a float must land, `near` how far from the keeper a bolt comes down.
 */
export const STRUCK = { every: [10, 18] as [number, number], life: 30, radius: 7, near: [13, 34] as [number, number], luck: 1.2, wait: 0.3 };

const FAIR: Weather = { storm: null, power: 0, rain: 0, thunder: false, eye: 0 };
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** Hours from `a` on to `b`, going forward round the clock. */
const ahead = (a: number, b: number) => (((b - a) % 24) + 24) % 24;

export function stormsOf(region: string): StormDef[] { return REGIONS_BY_ID.get(region)?.storms ?? []; }

/** The weather of `region` at `hour`. */
export function weatherAt(region: string, hour: number): Weather {
  for (const st of stormsOf(region)) {
    if (!inHours(hour, st.hours)) continue;
    const into = ahead(st.hours[0], hour), left = ahead(hour, st.hours[1]);
    let power = st.strength * smooth(Math.min(into, left) / STORM.ramp), eye = 0;
    if (st.eye && inHours(hour, st.eye)) {
      eye = smooth(Math.min(ahead(st.eye[0], hour), ahead(hour, st.eye[1])) / STORM.eyeRamp);
      power *= 1 - eye * (1 - STORM.eyePower);
    }
    return { storm: st, power, rain: power * (st.dry ? STORM.dryRain : 1), thunder: !!st.thunder && eye < 0.5 && power > 0.25 * st.strength, eye };
  }
  return FAIR;
}

/**
 * Is the weather of `region` at `hour` what something waits for? A storm counts from its first hour to its last,
 * its eye apart; thunder is a storm that has lightning; the eye is the eye. Nothing waited for is always met.
 */
export function inWeather(region: string, hour: number, need?: WeatherNeed): boolean {
  if (!need) return true;
  for (const st of stormsOf(region)) {
    if (!inHours(hour, st.hours)) continue;
    const eye = !!st.eye && inHours(hour, st.eye);
    return need === 'eye' ? eye : !eye && (need === 'storm' || !!st.thunder);
  }
  return false;
}

/** The next storm to come up in `region` after `hour`, and in how many hours; null where there are none. */
export function nextStorm(region: string, hour: number): { storm: StormDef; inHours: number } | null {
  let best: { storm: StormDef; inHours: number } | null = null;
  for (const st of stormsOf(region)) {
    if (inHours(hour, st.hours)) continue;
    const d = ahead(hour, st.hours[0]);
    if (!best || d < best.inHours) best = { storm: st, inHours: d };
  }
  return best;
}

/** How many hours of a day are spent in weather of a kind, in `region` (for the journal and the simulator). */
export function hoursOf(region: string, need: WeatherNeed): number {
  let h = 0;
  for (let i = 0; i < 24 * 20; i++) if (inWeather(region, i / 20, need)) h += 1 / 20;
  return h;
}

/** A clock hour said the way the almanac says it: "half past five in the morning". */
export function sayHour(h: number): string {
  const whole = Math.floor(h + 1e-6) % 24, half = h - Math.floor(h + 1e-6) > 0.25;
  const names = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  const part = whole < 5 ? 'at night' : whole < 12 ? 'in the morning' : whole < 17 ? 'in the afternoon' : whole < 21 ? 'in the evening' : 'at night';
  if (!half && whole === 0) return 'midnight';
  if (!half && whole === 12) return 'noon';
  return `${half ? 'half past ' : ''}${names[whole % 12]} ${part}`;
}
