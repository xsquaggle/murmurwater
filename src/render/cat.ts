/**
 * Biscuit, the harbour cat: wanders between walkable spots near home, idles, and sits for a while.
 * Walking and sitting are two separate sculpts (biscuit.glb, biscuit-sit.glb), swapped when she sits.
 * Without the models there is no cat (no stand-in: she is ambient, not needed for play).
 */
import { AnimationAction, AnimationMixer, Group, LoopRepeat, Vector3 } from 'three';
import { assets } from './assets';
import { Rng } from '../core/rng';

type GroundAt = (x: number, z: number) => number | null;
const WALK_SPEED = 0.34; // m/s; the walk clip covers 0.24 m/s at 1×
const TURN_RATE = 2.4;

export class Cat {
  readonly root = new Group();
  private standing: Group;
  private sitting: Group | null;
  private mixers: AnimationMixer[] = [];
  private walk: AnimationAction | null = null;
  private idle: AnimationAction | null = null;
  private state: 'idle' | 'walk' | 'sit' = 'idle';
  private timer = 2;
  private target = new Vector3();
  private yaw = 0;
  private walkW = 0;
  private rng: Rng;

  static available(): boolean { return assets.has('biscuit'); }

  constructor(private home: Vector3, private radius: number, private groundAt: GroundAt, seed = 7) {
    this.rng = new Rng(seed);
    this.standing = assets.instance('biscuit')!;
    this.root.add(this.standing);
    const m = new AnimationMixer(this.standing); this.mixers.push(m);
    for (const c of assets.clips('biscuit')) {
      const a = m.clipAction(c); a.setLoop(LoopRepeat, Infinity); a.play();
      if (c.name === 'walk') this.walk = a; else if (c.name === 'idle') this.idle = a;
    }
    this.walk?.setEffectiveWeight(0); this.idle?.setEffectiveWeight(1);
    this.sitting = assets.instance('biscuitSit');
    if (this.sitting) {
      this.sitting.visible = false; this.root.add(this.sitting);
      const sm = new AnimationMixer(this.sitting); this.mixers.push(sm);
      for (const c of assets.clips('biscuitSit')) { const a = sm.clipAction(c); a.setLoop(LoopRepeat, Infinity); a.play(); }
    }
    this.root.position.copy(home);
    this.root.position.y = groundAt(home.x, home.z) ?? home.y;
  }

  private walkable(x: number, z: number): boolean { return this.groundAt(x, z) !== null; }

  private pickTarget(): boolean {
    const p = this.root.position;
    for (let k = 0; k < 10; k++) {
      const a = this.rng.next() * Math.PI * 2, r = Math.sqrt(this.rng.next()) * this.radius;
      const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 1.2) continue;
      let ok = true;
      for (let i = 1; i <= 6 && ok; i++) ok = this.walkable(p.x + (x - p.x) * i / 6, p.z + (z - p.z) * i / 6);
      if (ok) { this.target.set(x, 0, z); return true; }
    }
    return false;
  }

  private setSitting(on: boolean) {
    if (!this.sitting) return;
    this.sitting.visible = on; this.standing.visible = !on;
  }

  update(dt: number, player: Vector3 | null) {
    const p = this.root.position;
    this.timer -= dt;
    if (this.state !== 'walk' && this.timer <= 0) {
      if (this.state === 'sit') this.setSitting(false);
      if (this.pickTarget()) this.state = 'walk';
      else { this.state = 'idle'; this.timer = 2; }
    }
    if (this.state === 'walk') {
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      let dy = Math.atan2(dx, dz) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), TURN_RATE * dt);
      // Pause politely if the player is right in the way.
      const blocked = !!player && Math.hypot(player.x - p.x, player.z - p.z) < 0.8;
      const go = Math.abs(dy) < 0.7 && !blocked ? WALK_SPEED : 0;
      const nx = p.x + Math.sin(this.yaw) * go * dt, nz = p.z + Math.cos(this.yaw) * go * dt;
      if (go > 0 && this.walkable(nx, nz)) { p.x = nx; p.z = nz; }
      else if (go > 0) this.timer = 0; // edge of the walkable ground: pick somewhere else
      this.walkW += ((go > 0 ? 1 : 0) - this.walkW) * Math.min(1, dt * 6);
      if (dist < 0.25 || (go > 0 && this.timer === 0)) {
        if (this.sitting && this.rng.next() < 0.45) { this.state = 'sit'; this.setSitting(true); this.timer = 10 + this.rng.next() * 18; }
        else { this.state = 'idle'; this.timer = 2.5 + this.rng.next() * 6; }
      }
    } else this.walkW += (0 - this.walkW) * Math.min(1, dt * 6);
    this.walk?.setEffectiveWeight(this.walkW);
    this.walk?.setEffectiveTimeScale(WALK_SPEED / 0.24);
    this.idle?.setEffectiveWeight(1 - this.walkW);
    const y = this.groundAt(p.x, p.z);
    if (y !== null) p.y += (y - p.y) * Math.min(1, dt * 10);
    this.root.rotation.y = this.yaw;
    for (const m of this.mixers) m.update(dt);
  }
}
