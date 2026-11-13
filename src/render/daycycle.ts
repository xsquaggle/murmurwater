/**
 * Time of day: a 24-hour clock mapped onto lighting/sky keyframes.
 * One in-game day lasts DAY_LENGTH_S real seconds.
 */
import { Color, Vector3 } from 'three';
import { DAY_LENGTH_S } from '../core/state';

export { DAY_LENGTH_S };

interface Key {
  h: number;
  sun: string; sunI: number;
  zenith: string; horizon: string; fog: string;
  hemiSky: string; hemiGround: string; hemiI: number;
  fogDensity: number; exposure: number;
}

// Hand-tuned against the art bible: warm key / cool fill at every hour.
const KEYS: Key[] = [
  { h: 0, sun: '#8FA6D9', sunI: 0.7, zenith: '#060A1E', horizon: '#1E2552', fog: '#182048', hemiSky: '#3A4282', hemiGround: '#16343E', hemiI: 0.8, fogDensity: 0.0010, exposure: 1.1 },
  { h: 4.6, sun: '#8FA6D9', sunI: 0.6, zenith: '#0C1232', horizon: '#3A3466', fog: '#2A2752', hemiSky: '#46468A', hemiGround: '#16343E', hemiI: 0.75, fogDensity: 0.0011, exposure: 1.1 },
  { h: 5.8, sun: '#FF9A6B', sunI: 1.4, zenith: '#3A3E84', horizon: '#F69A7A', fog: '#C98A92', hemiSky: '#8078B8', hemiGround: '#3B4A52', hemiI: 0.7, fogDensity: 0.0010, exposure: 1.0 },
  { h: 7.5, sun: '#FFE0B8', sunI: 2.4, zenith: '#3F7CC4', horizon: '#C4DDE6', fog: '#AFCBD6', hemiSky: '#A6CBEA', hemiGround: '#4E6A5A', hemiI: 1.05, fogDensity: 0.0006, exposure: 0.95 },
  { h: 13, sun: '#FFF2DA', sunI: 2.8, zenith: '#2C74C0', horizon: '#C2E2EC', fog: '#B0D6E0', hemiSky: '#B4DAF2', hemiGround: '#5A7460', hemiI: 1.1, fogDensity: 0.0005, exposure: 0.9 },
  { h: 16.2, sun: '#FFC888', sunI: 2.7, zenith: '#4F65AE', horizon: '#F6C796', fog: '#DDB794', hemiSky: '#A8BCE4', hemiGround: '#6A6656', hemiI: 1.1, fogDensity: 0.0006, exposure: 0.95 },
  { h: 17.5, sun: '#FFA552', sunI: 2.7, zenith: '#4A3C86', horizon: '#FF9A60', fog: '#D88A74', hemiSky: '#A08CC8', hemiGround: '#5A4858', hemiI: 1.15, fogDensity: 0.0008, exposure: 1.0 },
  { h: 18.6, sun: '#FF7446', sunI: 1.7, zenith: '#2F255C', horizon: '#F2765C', fog: '#9A5C78', hemiSky: '#7E6CB0', hemiGround: '#4A4262', hemiI: 1.05, fogDensity: 0.0010, exposure: 1.05 },
  { h: 19.5, sun: '#C8607A', sunI: 0.8, zenith: '#1C1946', horizon: '#844C78', fog: '#4C3460', hemiSky: '#56509A', hemiGround: '#2E2C4C', hemiI: 0.95, fogDensity: 0.0011, exposure: 1.1 },
  { h: 20.6, sun: '#8FA6D9', sunI: 0.7, zenith: '#0E1338', horizon: '#3E3468', fog: '#2E2852', hemiSky: '#424690', hemiGround: '#1A3242', hemiI: 0.8, fogDensity: 0.0011, exposure: 1.1 },
  { h: 24, sun: '#8FA6D9', sunI: 0.7, zenith: '#060A1E', horizon: '#1E2552', fog: '#182048', hemiSky: '#3A4282', hemiGround: '#16343E', hemiI: 0.8, fogDensity: 0.0010, exposure: 1.1 },
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
