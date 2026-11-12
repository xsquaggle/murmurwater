/**
 * Time of day: a 24-hour clock mapped onto lighting/sky keyframes.
 * One in-game day lasts DAY_LENGTH_S real seconds.
 */
import { Color, Vector3 } from 'three';

export const DAY_LENGTH_S = 24 * 60;

interface Key {
  h: number;
  sun: string; sunI: number;
  zenith: string; horizon: string; fog: string;
  hemiSky: string; hemiGround: string; hemiI: number;
  fogDensity: number; exposure: number;
}

// Hand-tuned against the art bible: warm key / cool fill at every hour.
const KEYS: Key[] = [
  { h: 0, sun: '#8FA6D9', sunI: 0.45, zenith: '#070B1E', horizon: '#232A52', fog: '#1B2246', hemiSky: '#2B3266', hemiGround: '#0B2E36', hemiI: 0.55, fogDensity: 0.0011, exposure: 1.1 },
  { h: 4.6, sun: '#8FA6D9', sunI: 0.35, zenith: '#0E1430', horizon: '#3A3462', fog: '#2C2852', hemiSky: '#3A3a70', hemiGround: '#0B2E36', hemiI: 0.5, fogDensity: 0.0012, exposure: 1.1 },
  { h: 5.8, sun: '#FF9A6B', sunI: 1.3, zenith: '#33467F', horizon: '#F2A07E', fog: '#C9928F', hemiSky: '#7C83B8', hemiGround: '#3B4A52', hemiI: 0.7, fogDensity: 0.0012, exposure: 1.0 },
  { h: 8, sun: '#FFE6C2', sunI: 2.4, zenith: '#3E86C6', horizon: '#BFE0EA', fog: '#A8CDD6', hemiSky: '#A9D2EE', hemiGround: '#4E6A5A', hemiI: 0.85, fogDensity: 0.0008, exposure: 0.95 },
  { h: 13, sun: '#FFF4E0', sunI: 2.8, zenith: '#2F7FC4', horizon: '#CDE8EE', fog: '#B2D9DF', hemiSky: '#B8DDF2', hemiGround: '#5A7460', hemiI: 0.9, fogDensity: 0.0007, exposure: 0.9 },
  { h: 16.5, sun: '#FFC888', sunI: 2.6, zenith: '#4472B0', horizon: '#F6CFA0', fog: '#E3C49E', hemiSky: '#9EB6DA', hemiGround: '#5E5A4E', hemiI: 0.8, fogDensity: 0.0009, exposure: 0.95 },
  { h: 18.2, sun: '#FFA052', sunI: 2.5, zenith: '#3E4F8E', horizon: '#FFB878', fog: '#E9A57E', hemiSky: '#8C86B8', hemiGround: '#4B3E4E', hemiI: 0.75, fogDensity: 0.0011, exposure: 1.0 },
  { h: 19.3, sun: '#FF6E4A', sunI: 1.3, zenith: '#2A2B60', horizon: '#E07A6E', fog: '#8C6488', hemiSky: '#6A5C98', hemiGround: '#2E2A44', hemiI: 0.65, fogDensity: 0.0013, exposure: 1.05 },
  { h: 20.6, sun: '#8FA6D9', sunI: 0.45, zenith: '#11163A', horizon: '#46396C', fog: '#352A55', hemiSky: '#3A3a74', hemiGround: '#0F2A38', hemiI: 0.55, fogDensity: 0.0012, exposure: 1.1 },
  { h: 24, sun: '#8FA6D9', sunI: 0.45, zenith: '#070B1E', horizon: '#232A52', fog: '#1B2246', hemiSky: '#2B3266', hemiGround: '#0B2E36', hemiI: 0.55, fogDensity: 0.0011, exposure: 1.1 },
];

export interface Lighting {
  hour: number;
  sunDir: Vector3;      // direction TO the sun
  moonDir: Vector3;     // direction TO the moon
  keyDir: Vector3;      // whichever is the key light
  keyColor: Color; keyIntensity: number;
  zenith: Color; horizon: Color; fog: Color; fogDensity: number;
  hemiSky: Color; hemiGround: Color; hemiIntensity: number;
  night: number;        // 0 day … 1 night
  exposure: number;
}

const tmpA = new Color(), tmpB = new Color();
function lerpColor(out: Color, a: string, b: string, t: number) {
  tmpA.set(a); tmpB.set(b);
  return out.copy(tmpA).lerp(tmpB, t);
}

export function sunDirection(hour: number, out = new Vector3()): Vector3 {
  const phase = ((hour - 6) / 12) * Math.PI; // 0 sunrise (east), π sunset (west)
  const elev = Math.sin(phase);
  return out.set(Math.cos(phase), elev * 0.92, 0.38).normalize();
}

export function sample(hour: number, out?: Lighting): Lighting {
  hour = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t0 = (hour - a.h) / (b.h - a.h);
  const t = t0 * t0 * (3 - 2 * t0);
  const o: Lighting = out ?? {
    hour, sunDir: new Vector3(), moonDir: new Vector3(), keyDir: new Vector3(),
    keyColor: new Color(), keyIntensity: 1, zenith: new Color(), horizon: new Color(), fog: new Color(),
    fogDensity: 0.001, hemiSky: new Color(), hemiGround: new Color(), hemiIntensity: 1, night: 0, exposure: 1,
  };
  o.hour = hour;
  sunDirection(hour, o.sunDir);
  // Moon trails the sun by ~11 hours, so it rises shortly after dusk.
  sunDirection(hour + 11.2, o.moonDir);
  o.moonDir.y = Math.abs(o.moonDir.y) * 0.8 + 0.12; o.moonDir.normalize();
  o.night = 1 - Math.min(1, Math.max(0, (o.sunDir.y + 0.08) / 0.22));
  o.keyDir.copy(o.night > 0.5 ? o.moonDir : o.sunDir);
  if (o.keyDir.y < 0.06) { o.keyDir.y = 0.06; o.keyDir.normalize(); }
  lerpColor(o.keyColor, a.sun, b.sun, t);
  o.keyIntensity = a.sunI + (b.sunI - a.sunI) * t;
  lerpColor(o.zenith, a.zenith, b.zenith, t);
  lerpColor(o.horizon, a.horizon, b.horizon, t);
  lerpColor(o.fog, a.fog, b.fog, t);
  lerpColor(o.hemiSky, a.hemiSky, b.hemiSky, t);
  lerpColor(o.hemiGround, a.hemiGround, b.hemiGround, t);
  o.hemiIntensity = a.hemiI + (b.hemiI - a.hemiI) * t;
  o.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * t;
  o.exposure = a.exposure + (b.exposure - a.exposure) * t;
  return o;
}
