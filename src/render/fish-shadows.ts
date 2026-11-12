/**
 * Fish shadows: dark shapes under the surface, drawn by the water shader (so reflections and glints stay
 * on top of them and they ride the waves for free).
 *
 * A handful roam the water around the player, keeping off the shore and bolting from splashes. When a line
 * is out, one more (the biter) rises near the float and circles in on it: it darts in for each nibble,
 * backs off, and takes the float for the bite, so a bite can be seen coming. While a fish is hooked the
 * biter's shadow follows it through the fight.
 */
import { Vector4 } from 'three';
import { Rng } from '../core/rng';

/** Shadows the water shader draws (the last one is the biter). */
export const SHADOW_N = 14;
const AMBIENT = SHADOW_N - 1;
/** Shadows live within this distance of the player; beyond it they fade out and turn up somewhere else. */
const FIELD_R = 40;
/** Ambient fish keep this far from the float, so the one that comes close is the one that will bite. */
const KEEP_OFF = 3.4;

interface Shade {
  x: number; z: number; yaw: number;
  len: number;
  /** How deep it swims, 0..1: deeper shadows are fainter and softer. */
  deep: number;
  phase: number; speed: number; cruise: number;
  /** Current and wanted visibility, 0..1. */
  alpha: number; want: number;
  turn: number; wanderT: number;
  flee: number; fleeYaw: number;
}

export interface ShadowInput {
  /** Centre of the field (the player). */
  cx: number; cz: number;
  /** The float, while it sits on the water. */
  lure: { x: number; z: number } | null;
  /** Seconds until the next nibble or the bite (Infinity when nothing is due). */
  nextTug: number;
  /** The float has been taken and is waiting to be struck. */
  biting: boolean;
  /** The hooked fish, while fighting. */
  fish: { x: number; z: number; len: number } | null;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How far from the float the biter holds, `t` seconds before it next touches it. */
export function stalkRadius(t: number): number {
  if (t < 0.5) return 1.6 * Math.pow(Math.max(0, t) / 0.5, 1.5); // the lunge
  if (t < 2) return 1.6;                                          // hanging close, looking at it
  return Math.min(8, 1.6 + 0.85 * (t - 2));                       // circling in
}

export class FishShadows {
  private fish: Shade[] = [];
  private rng: Rng;
  private t = 0;
  private mode: 'off' | 'stalk' | 'fight' | 'leave' = 'off';
  private orbit = 0; private orbitDir = 1;
  private recoil = 0; private spooked = 0;

  constructor(private depth: (x: number, z: number) => number, seed = 1) {
    this.rng = new Rng(seed ^ 0x5eaf00d);
    for (let i = 0; i < SHADOW_N; i++) {
      this.fish.push({ x: 0, z: 0, yaw: 0, len: 1, deep: 0, phase: this.rng.range(0, 6), speed: 0, cruise: 0.6, alpha: 0, want: 0, turn: 0, wanderT: this.rng.range(0, 0.5), flee: 0, fleeYaw: 0 });
    }
  }

  /** The biter (for tests and bots). */
  get biter(): Readonly<Shade> & { mode: string } { return { ...this.fish[AMBIENT], mode: this.mode }; }
  /** Visible roaming shadows (for tests and bots). */
  get roaming(): number { return this.fish.slice(0, AMBIENT).filter((f) => f.want > 0).length; }

  /** A splash at (x, z): everything within `radius` bolts away from it. */
  scatter(x: number, z: number, radius: number) {
    for (let i = 0; i < AMBIENT; i++) {
      const f = this.fish[i];
      const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
      if (d < radius) { f.flee = 0.7 + 0.5 * (1 - d / radius); f.fleeYaw = Math.atan2(dx, dz) + this.rng.range(-0.4, 0.4); }
    }
  }
  /** The biter has just bumped the float: it backs off before it comes again. */
  nibble() { this.recoil = 0.9; }
  /** Struck too early, or the bite was missed: the biter bolts. */
  spook() { this.spooked = 0.9; this.recoil = Math.max(this.recoil, 0.9); }

  update(dt: number, inp: ShadowInput, outA: Vector4[], outB: Vector4[], outField: Vector4) {
    this.t += dt;
    for (let i = 0; i < AMBIENT; i++) this.roam(this.fish[i], dt, inp);
    this.stalk(this.fish[AMBIENT], dt, inp);
    for (let i = 0; i < SHADOW_N; i++) {
      const f = this.fish[i];
      const biter = i === AMBIENT;
      // Fade toward the shore, and with swimming depth.
      const vis = f.alpha * smooth(0.6, 1.8, this.depth(f.x, f.z)) * (biter ? 0.92 : 0.72 * (1 - 0.45 * f.deep));
      outA[i].set(f.x, f.z, Math.sin(f.yaw), Math.cos(f.yaw));
      outB[i].set(f.len, f.phase, vis, biter ? 0.035 + 0.1 * (1 - f.alpha) : 0.035 + 0.1 * f.deep);
    }
    const r = FIELD_R + 8;
    outField.set(inp.cx, inp.cz, r * r, 1);
  }

  /** Put a roaming fish somewhere wet near the centre, out of sight until it fades in. */
  private place(f: Shade, cx: number, cz: number): boolean {
    for (let k = 0; k < 6; k++) {
      const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(7, FIELD_R - 6);
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (this.depth(x, z) < 1.8) continue;
      const roll = this.rng.next();
      f.x = x; f.z = z; f.yaw = this.rng.range(0, Math.PI * 2); f.turn = f.yaw;
      // Drawn larger than life so they read from the dock; now and then, something big.
      f.len = roll < 0.72 ? this.rng.range(0.9, 1.4) : roll < 0.95 ? this.rng.range(1.4, 2.0) : this.rng.range(2.6, 3.4);
      f.deep = this.rng.next() * (f.len > 2.5 ? 1 : 0.8);
      f.cruise = this.rng.range(0.35, 1.0) / Math.sqrt(f.len);
      f.speed = f.cruise; f.want = 1; f.flee = 0;
      return true;
    }
    return false;
  }

  private roam(f: Shade, dt: number, inp: ShadowInput) {
    const dc = Math.hypot(f.x - inp.cx, f.z - inp.cz);
    if (f.want > 0 && (dc > FIELD_R || this.depth(f.x, f.z) < 0.7)) f.want = 0;
    f.alpha += (f.want - f.alpha) * Math.min(1, dt * 1.6);
    if (f.want === 0) {
      f.wanderT -= dt;
      if (f.alpha < 0.03 && f.wanderT <= 0) { f.wanderT = 0.3; if (this.place(f, inp.cx, inp.cz)) f.alpha = 0; }
      if (f.want === 0) { f.x += Math.sin(f.yaw) * f.speed * dt; f.z += Math.cos(f.yaw) * f.speed * dt; f.phase += dt * (3 + f.speed * 7); return; }
    }
    f.wanderT -= dt;
    if (f.wanderT <= 0) {
      f.wanderT = this.rng.range(1.5, 5);
      f.turn = f.yaw + this.rng.range(-1.1, 1.1);
      f.cruise = this.rng.range(0.35, 1.0) / Math.sqrt(f.len);
    }
    // The shore: turn toward whichever side is deeper.
    const look = 2.5 + f.len;
    if (this.depth(f.x + Math.sin(f.yaw) * look, f.z + Math.cos(f.yaw) * look) < 1.4) {
      const l = this.depth(f.x + Math.sin(f.yaw + 0.9) * look, f.z + Math.cos(f.yaw + 0.9) * look);
      const r = this.depth(f.x + Math.sin(f.yaw - 0.9) * look, f.z + Math.cos(f.yaw - 0.9) * look);
      f.turn = f.yaw + (l > r ? 1.3 : -1.3); f.wanderT = 0.8;
    }
    // The float belongs to the biter.
    if (inp.lure) {
      const dx = f.x - inp.lure.x, dz = f.z - inp.lure.z;
      if (dx * dx + dz * dz < KEEP_OFF * KEEP_OFF) { f.turn = Math.atan2(dx, dz); f.wanderT = Math.max(f.wanderT, 0.6); }
    }
    let speed = f.cruise, rate = 1.4;
    if (f.flee > 0) { f.flee -= dt; f.turn = f.fleeYaw; speed = f.cruise + 5 * Math.min(1, f.flee / 0.5); rate = 9; }
    const dy = wrap(f.turn - f.yaw);
    f.yaw += Math.max(-rate * dt, Math.min(rate * dt, dy));
    f.speed += (speed - f.speed) * Math.min(1, dt * 5);
    f.x += Math.sin(f.yaw) * f.speed * dt; f.z += Math.cos(f.yaw) * f.speed * dt;
    f.phase += dt * (3 + f.speed * 7);
  }

  private stalk(b: Shade, dt: number, inp: ShadowInput) {
    this.recoil = Math.max(0, this.recoil - dt); this.spooked = Math.max(0, this.spooked - dt);
    if (inp.fish) {
      // Hooked: the shadow is the fish.
      const dx = inp.fish.x - b.x, dz = inp.fish.z - b.z, d = Math.hypot(dx, dz);
      if (this.mode !== 'fight') { this.mode = 'fight'; if (d > 4) { b.x = inp.fish.x; b.z = inp.fish.z; } }
      if (d > 0.02) b.yaw += wrap(Math.atan2(dx, dz) - b.yaw) * Math.min(1, dt * 10);
      b.x += dx * Math.min(1, dt * 14); b.z += dz * Math.min(1, dt * 14);
      b.len += (inp.fish.len - b.len) * Math.min(1, dt * 4);
      b.want = 1; b.alpha += (1 - b.alpha) * Math.min(1, dt * 6);
      b.phase += dt * (9 + Math.min(12, (d / Math.max(dt, 1e-3)) * 2));
      return;
    }
    const due = inp.lure && (inp.biting || isFinite(inp.nextTug));
    if (!due || !inp.lure) {
      // Line out of the water: it slips away.
      if (this.mode !== 'off') {
        this.mode = 'leave'; b.want = 0;
        b.speed += (2.6 - b.speed) * Math.min(1, dt * 4);
        b.x += Math.sin(b.yaw) * b.speed * dt; b.z += Math.cos(b.yaw) * b.speed * dt;
        b.phase += dt * (3 + b.speed * 7);
        b.alpha += (0 - b.alpha) * Math.min(1, dt * 3);
        if (b.alpha < 0.02) { this.mode = 'off'; b.alpha = 0; }
      }
      return;
    }
    const lure = inp.lure;
    if (this.mode !== 'stalk') {
      // Rises out of the deep somewhere around the float.
      const r = stalkRadius(inp.nextTug) + 1;
      this.orbit = this.rng.range(0, Math.PI * 2); this.orbitDir = this.rng.chance(0.5) ? 1 : -1;
      for (let k = 0; k < 8 && this.depth(lure.x + Math.sin(this.orbit) * r, lure.z + Math.cos(this.orbit) * r) < 1.2; k++) this.orbit += Math.PI / 4;
      b.x = lure.x + Math.sin(this.orbit) * r; b.z = lure.z + Math.cos(this.orbit) * r;
      b.yaw = this.orbit + Math.PI * (0.5 + 0.1 * this.orbitDir) * this.orbitDir;
      b.len = this.rng.range(1.5, 2.1); b.alpha = 0; b.speed = 0;
      this.mode = 'stalk'; this.recoil = 0; this.spooked = 0;
    }
    b.want = 1; b.alpha += (1 - b.alpha) * Math.min(1, dt * 2.2);
    const lunge = inp.biting || inp.nextTug < 0.5;
    let r = inp.biting ? 0 : stalkRadius(inp.nextTug);
    if (this.recoil > 0 && !lunge) r = Math.max(r, 2.8);
    if (this.spooked > 0 && !lunge) r = Math.max(r, 5.5);
    // Circle while it is out wide; its nose, not its middle, is what reaches the float.
    this.orbit += this.orbitDir * (0.75 / Math.max(1.2, r)) * dt * (lunge ? 0 : 1);
    const reach = r + 0.42 * b.len;
    let qx = lure.x + Math.sin(this.orbit) * reach, qz = lure.z + Math.cos(this.orbit) * reach;
    if (inp.biting) { qx += Math.sin(this.t * 31) * 0.07; qz += Math.cos(this.t * 27) * 0.07; }
    const gain = lunge ? 14 : this.recoil > 0 || this.spooked > 0 ? 6 : 2.2;
    const vmax = lunge ? 10 : this.recoil > 0 || this.spooked > 0 ? 6.5 : 1.7;
    let vx = (qx - b.x) * gain, vz = (qz - b.z) * gain;
    const v = Math.hypot(vx, vz);
    if (v > vmax) { vx *= vmax / v; vz *= vmax / v; }
    b.x += vx * dt; b.z += vz * dt;
    b.speed = Math.min(v, vmax);
    // Swim nose-first; hanging still, or holding the float, it faces the float.
    const face = b.speed > 0.35 && !inp.biting ? Math.atan2(vx, vz) : Math.atan2(lure.x - b.x, lure.z - b.z) + (inp.biting ? Math.sin(this.t * 23) * 0.5 : 0);
    b.yaw += wrap(face - b.yaw) * Math.min(1, dt * (lunge ? 16 : 5));
    b.phase += dt * (inp.biting ? 30 : 3 + b.speed * 7);
  }
}
