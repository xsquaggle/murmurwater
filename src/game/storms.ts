/**
 * The storms of a region as the keeper meets them (the rules are core/weather.ts): she is told when one comes
 * up, when its eye comes over and when it has blown out; while there is lightning a bolt comes down into the sea
 * within a cast or two of her every ten to eighteen seconds and leaves the water there struck for half a minute;
 * the first fish hooked in struck water puts it out. Bolts also go into the Anvil, and far off for the look of it.
 *
 * Nothing here is saved: the weather is a function of the hour, and struck water lasts less than a minute.
 */
import { Rng } from '../core/rng';
import { STRUCK, nextStorm, sayHour, weatherAt, type Weather } from '../core/weather';
import { REGIONS_BY_ID, type RegionContent } from '../core/content';
import type { StruckDraw } from '../render/storm-fx';
import type { Game } from './game';

/** A struck water: where, how long it has been lit, and whether a hooked fish has put it out (it fades fast then). */
interface Struck { x: number; z: number; age: number; out: number; seed: number }
/** How long a struck water takes to go out once a fish has been hooked in it, s. */
const QUENCH = 1.4;

export class Storms {
  readonly struck: Struck[] = [];
  private rng = new Rng(0x5a17);
  private nextBolt = 4;
  private nextFar = 6;
  private nextAnvil = 12;
  /** What the keeper was last told about: a storm's id (with "-eye" in its eye), '' in fair weather; null before the first look. */
  private told: string | null = null;
  private toldStruck = false;
  /** How many bolts have come down near the keeper (for the bots). */
  bolts = 0;
  /** The weather here and now, as the rules have it (the game's clock, not the sky's). */
  weather: Weather = weatherAt('', 0);

  constructor(private g: Game) {}

  /** Is the water at (x, z) struck (lit, and not put out)? */
  struckAt(x: number, z: number): boolean { return this.nearest(x, z) >= 0; }
  private nearest(x: number, z: number): number {
    let best = -1, bd = STRUCK.radius;
    this.struck.forEach((s, i) => { const d = Math.hypot(s.x - x, s.z - z); if (s.out < 0 && s.age < STRUCK.life && d <= bd) { bd = d; best = i; } });
    return best;
  }
  /** A fish has been hooked at (x, z), or something heavy struck there: the struck water it came out of goes out. */
  quench(x: number, z: number) { const i = this.nearest(x, z); if (i >= 0) this.struck[i].out = 0; }
  /** Puts struck water at (x, z) at once (bots and pictures). */
  strike(x: number, z: number) { this.bolt(x, z); this.redraw(); }

  /** Forgets the last region's storms (on crossing into another). */
  enterRegion() { this.struck.length = 0; this.drawn.length = 0; this.told = null; }

  step(dt: number) {
    const g = this.g, s = g.state, region = s.world.region;
    const w = this.weather = weatherAt(region, s.hour);
    for (let i = this.struck.length - 1; i >= 0; i--) {
      const st = this.struck[i];
      st.age += dt;
      if (st.out >= 0) st.out += dt;
      if (st.age > STRUCK.life || st.out > QUENCH) this.struck.splice(i, 1);
    }
    // (Nothing is said to somebody who is still at the title card: it is told when she is there.)
    if (!g.behindTitle) this.tell(w);
    if (w.thunder) {
      // Near the keeper: oftener for a keeper who wears what draws it.
      this.nextBolt -= dt * g.stats.strikes;
      if (this.nextBolt <= 0) { this.nextBolt = this.rng.range(...STRUCK.every); this.boltNear(); }
      this.nextFar -= dt;
      if (this.nextFar <= 0) { this.nextFar = this.rng.range(5, 11); this.boltFar(); }
      this.nextAnvil -= dt;
      if (this.nextAnvil <= 0) { this.nextAnvil = this.rng.range(22, 40); this.boltAnvil(); }
    } else {
      // The first bolt of a storm comes soon after its lightning starts.
      this.nextBolt = Math.min(this.nextBolt, this.rng.range(3, 7));
    }
    this.redraw();
  }

  /** What the renderer draws for each struck water: lit at once, dimming over its last third, quickly when put out. */
  draw(): readonly StruckDraw[] { return this.drawn; }
  private drawn: StruckDraw[] = [];
  /** Works out what is drawn, once a step (the same few objects are used again, so nothing is thrown away). */
  private redraw() {
    const n = this.struck.length;
    while (this.drawn.length < n) this.drawn.push({ x: 0, z: 0, seed: 0, strength: 0 });
    this.drawn.length = n;
    for (let i = 0; i < n; i++) {
      const st = this.struck[i], d = this.drawn[i];
      const fadeIn = Math.min(1, st.age / 0.6), fadeOut = Math.min(1, (STRUCK.life - st.age) / (STRUCK.life / 3));
      d.x = st.x; d.z = st.z; d.seed = st.seed;
      d.strength = fadeIn * Math.max(0, fadeOut) * (st.out >= 0 ? Math.max(0, 1 - st.out / QUENCH) : 1);
    }
  }

  /** 0..1: how near the keeper's float or boat is to struck water (the sound of it). */
  closeness(): number {
    const g = this.g, at = g.session.phase === 'waiting' || g.session.phase === 'bite' ? g.view.target : g.keeperAt();
    let best = 0;
    for (const d of this.drawn) best = Math.max(best, d.strength * Math.max(0, 1 - Math.hypot(d.x - at.x, d.z - at.z) / 30));
    return best;
  }

  private tell(w: Weather) {
    const g = this.g, s = g.state;
    const now = w.storm ? `${w.storm.id}${w.inEye ? '-eye' : ''}` : '';
    if (now === this.told) return;
    const first = this.told === null, was = this.told;
    this.told = now;
    const almanac = s.flags.includes('almanac');
    if (w.storm) {
      const name = almanac ? cap(w.storm.name) : 'A storm';
      if (now.endsWith('-eye')) g.hud.toast(`The eye of ${almanac ? w.storm.name : 'the storm'} is over you. The sea lies down: pots and hands fish again until it closes.`, 'gold', 6500);
      else if (was?.endsWith('-eye')) g.hud.toast(`The eye has closed. ${almanac ? cap(w.storm.name) : 'The storm'} blows again.`, '', 5000);
      else {
        g.hud.toast(`${name} ${first ? 'is blowing' : 'is coming up'}. In a storm the pots take nothing and the hands shelter.`, '', 7000);
        if (w.storm.thunder && !this.toldStruck) g.hud.toast('Where lightning goes into the sea the water is struck for a while. Cast into it.', 'gold', 7000);
        if (w.storm.thunder) this.toldStruck = true;
      }
    } else if (!first && was) {
      const next = nextStorm(s.world.region, s.hour);
      g.hud.toast(`${almanac ? cap(stormNamed(s.world.region, was)) : 'The storm'} has blown out.${almanac && next ? ` Next: ${next.storm.name}, at ${sayHour(next.storm.hours[0])}.` : ''}`, '', 5500);
    }
  }

  /** Where a bolt goes in near the keeper: a cast or two off, in water, and most often where she is looking. */
  private boltNear() {
    const g = this.g, at = g.keeperAt(), [n0, n1] = STRUCK.near;
    for (let k = 0; k < 16; k++) {
      const a = this.rng.chance(0.75) ? g.camYaw + this.rng.range(-1.2, 1.2) : this.rng.range(0, Math.PI * 2);
      // (What draws the lightning draws it nearer as well as oftener: never nearer than the nearest, less far at the farthest.)
      const d = this.rng.range(n0, n0 + (n1 - n0) / Math.max(1, g.stats.strikes)), x = at.x + Math.sin(a) * d, z = at.z + Math.cos(a) * d;
      if (g.world.hf.depth(x, z) < 2 || g.world.rocks.some(([rx, rz, r]) => Math.hypot(rx - x, rz - z) < r + 2)) continue;
      this.bolt(x, z);
      return;
    }
  }
  private bolt(x: number, z: number) {
    const g = this.g, at = g.keeperAt();
    this.struck.push({ x, z, age: 0, out: -1, seed: this.rng.range(0, 6.28) });
    if (this.struck.length > STRUCK.most) this.struck.shift();
    this.bolts++;
    const dist = Math.hypot(x - at.x, z - at.z);
    g.world.storm?.bolt(x, g.waveY(x, z), z, Math.max(0, 1 - dist / 60));
    g.audio.lightning(dist);
  }
  /** A bolt a long way off, for the look of the storm: no struck water out there worth sailing to. */
  private boltFar() {
    const g = this.g, at = g.keeperAt(), a = this.rng.range(0, Math.PI * 2), d = this.rng.range(260, 650);
    const x = at.x + Math.sin(a) * d, z = at.z + Math.cos(a) * d;
    g.world.storm?.bolt(x, 0, z, 0);
    g.audio.thunder(d, d / 343);
  }
  /** The Anvil: every storm hits it, as if to make sure. */
  private boltAnvil() {
    const g = this.g, anvil = (REGIONS_BY_ID.get(g.state.world.region) as RegionContent | undefined)?.islands.find((i) => i.id === 'the-anvil');
    if (!anvil) return;
    const at = g.keeperAt(), d = Math.hypot(anvil.x - at.x, anvil.z - at.z);
    if (d > 900) return;
    g.world.storm?.bolt(anvil.x, g.world.hf.height(anvil.x, anvil.z), anvil.z, Math.max(0, 1 - d / 200));
    g.audio.thunder(d, d / 343);
  }
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
function stormNamed(region: string, told: string): string {
  const id = told.replace(/-eye$/, '');
  return REGIONS_BY_ID.get(region)?.storms?.find((s) => s.id === id)?.name ?? 'the storm';
}

/** The almanac's line for the HUD: the storm that is on and what comes next in it, or how long until the next; null without one. */
export function almanacLine(region: string, hour: number): { text: string; kind: 'fair' | 'storm' | 'eye' } | null {
  const w = weatherAt(region, hour);
  // A game hour is a minute of play.
  const mins = (h: number) => (h < 0.95 ? 'under a minute' : `${Math.round(h)} min`);
  const ahead = (a: number, b: number) => (((b - a) % 24) + 24) % 24;
  if (w.storm) {
    const st = w.storm;
    if (w.inEye && st.eye) return { text: `Eye of ${st.name} · closes in ${mins(ahead(hour, st.eye[1]))}`, kind: 'eye' };
    if (st.eye && ahead(hour, st.eye[0]) < ahead(hour, st.hours[1])) return { text: `${cap(st.name)} · the eye in ${mins(ahead(hour, st.eye[0]))}`, kind: 'storm' };
    return { text: `${cap(st.name)} · blows out in ${mins(ahead(hour, st.hours[1]))}`, kind: 'storm' };
  }
  const next = nextStorm(region, hour);
  if (!next) return null;
  return { text: `Fair · ${next.storm.name} in ${mins(next.inHours)}`, kind: 'fair' };
}
