/**
 * Lantern Pots in the world: the floats that mark them, setting one in the water, hauling it, taking it up
 * again, and running their clocks for as long as the game is open. The rules are core/pots.ts; this is the
 * glue to the game.
 */
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Game } from './game';
import { assets } from '../render/assets';
import { buildPotFloat, createPropMaterial } from '../render/props';
import { canPlacePot, haulPot, placePot, potKnows, potRolled, potsInHand, takeUpPot, tickPots } from '../core/pots';
import { REGIONS_BY_ID, zoneAt, type RegionContent } from '../core/content';
import { hullDistance } from '../core/landing';
import { fmt } from '../core/economy';
import type { PotState } from '../core/state';

/** How close a pot has to be to haul it: from the shore or the dock (it comes in on its line), and from the boat. */
const REACH = { foot: 7.2, aboard: 3.4 };
/** Seconds the pot key is held to take an empty pot out of the water. */
const TAKE_UP_HOLD = 0.6;

interface Float { root: Group; setGlow: (v: number) => void; ph: number; flare: number; fish: number; knows: number; knowsAge: number }

export class PotField {
  private floats = new Map<number, Float>();
  private region: RegionContent;
  private scanT = 0;
  /** The pot in reach, if there is one: a press of the pot key hauls it; held, it takes an empty one up. */
  near: PotState | null = null;
  /** Where the pot key would set a pot down right now; null when there is no pot in hand or no water in reach. */
  spot: { x: number; z: number } | null = null;
  private fullTold = new Set<number>();
  private v = new Vector3();
  private warm = new Color('#FFE2A0');
  private white = new Color('#E8FFF4');
  private static geo: ReturnType<typeof buildPotFloat> | null = null;

  constructor(private g: Game) {
    this.region = g.world.region as RegionContent;
    // A pot that was full when the game was closed says so once, not as news.
    for (const p of g.state.pots.placed) if (p.fish.length >= g.stats.potCapacity) this.fullTold.add(p.id);
  }

  /** The game has moved to another region: its own pots show, the others keep their clocks unseen. */
  enterRegion() { this.region = this.g.world.region as RegionContent; this.near = null; this.spot = null; }

  private here(): PotState[] { const r = this.g.state.world.region; return this.g.state.pots.placed.filter((p) => p.region === r); }

  // ------------------------------------------------------------------ fixed step
  /** `free`: the rod is put away and nothing else has the player's attention. */
  step(dt: number, free: boolean) {
    const g = this.g, s = g.state, st = g.stats;
    // The pots' clocks run with the game's own, and with nothing else.
    tickPots(s, dt, s.hour, st);
    for (const p of s.pots.placed) {
      const full = p.fish.length >= st.potCapacity;
      // A pot in the other water fills too: say where, so nobody looks round for it here.
      if (full && !this.fullTold.has(p.id)) { this.fullTold.add(p.id); g.hud.toast(p.region === s.world.region ? 'A Lantern Pot is full' : `A Lantern Pot is full, back in ${REGIONS_BY_ID.get(p.region)?.name ?? 'the other water'}`, 'good'); }
      else if (!full) this.fullTold.delete(p.id);
    }
    if (!free) { this.near = null; this.spot = null; return; }
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.15; this.near = this.findNear(); this.spot = this.near?.fish.length ? null : this.findSpot(); }
    // A press hauls or sets. Taking an empty pot out of the water wants the key held, so a second press after a
    // haul (or a press meant to set another pot beside it) never pulls one up by accident.
    if (g.input.wasPressed('pot')) {
      const did = this.act();
      this.holdId = !did && this.near && !this.near.fish.length ? this.near.id : 0;
      this.holdT = 0;
    } else if (this.holdId && g.input.held('pot') && this.near?.id === this.holdId && !this.near.fish.length) {
      this.holdT += dt;
      if (this.holdT >= TAKE_UP_HOLD) { this.takeUp(this.near); this.holdId = 0; }
    } else this.holdId = 0;
  }
  private holdId = 0;
  private holdT = 0;

  private findNear(): PotState | null {
    const g = this.g, sail = g.sailing;
    if (sail.aboard && Math.abs(sail.boat.speed) > 3) return null;
    let best: PotState | null = null, bd = Infinity;
    for (const p of this.here()) {
      const d = sail.aboard ? hullDistance(sail.boat, p.x, p.z) : Math.hypot(p.x - g.pos.x, p.z - g.pos.z);
      if (d < (sail.aboard ? REACH.aboard : REACH.foot) && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Open water in reach to put a pot in: ahead of the player on foot, over the side of the boat when aboard. */
  private findSpot(): { x: number; z: number } | null {
    const g = this.g, s = g.state, st = g.stats, sail = g.sailing, w = g.world;
    if (potsInHand(s, st) <= 0) return null;
    const ok = (x: number, z: number) => w.hf.depth(x, z) >= 0.7 && w.dockDeckAt(x, z) === null && canPlacePot(s, x, z, st)
      && (!sail.owned || hullDistance(sail.boat, x, z) > 0.5);
    if (sail.aboard) {
      if (Math.abs(sail.boat.speed) > 1.2) return null;
      // Over whichever side the player is looking toward, else the other.
      const h = sail.boat.heading, ax = Math.cos(h), az = -Math.sin(h);
      const first = Math.sin(g.camYaw) * ax + Math.cos(g.camYaw) * az >= 0 ? 1 : -1;
      for (const side of [first, -first]) {
        const x = sail.boat.x + ax * side * 2.3, z = sail.boat.z + az * side * 2.3;
        if (ok(x, z)) return { x, z };
      }
      return null;
    }
    // Far enough out to be seen over the edge of whatever the keeper is standing on (a pot dropped at the foot of
    // the dock hides under it): the higher the keeper stands, the further out it lands. And a little to one side,
    // so it is not behind the keeper's own back either.
    const first = Math.min(5.4, 2.2 + 2.6 * Math.max(0, g.pos.y - 0.3));
    const tries: number[] = [];
    for (let d = first; d <= 6.21; d += 0.4) tries.push(d);
    for (let d = first - 0.4; d >= 1.79; d -= 0.4) tries.push(d);
    for (const d of tries) for (const off of [0.45, -0.45, 0]) {
      const x = g.pos.x + Math.sin(g.yaw + off) * d, z = g.pos.z + Math.cos(g.yaw + off) * d;
      if (ok(x, z)) return { x, z };
    }
    return null;
  }

  /**
   * A press of the pot key: haul the pot in reach if it has fish, else set one down if there is one in hand and
   * water to put it in. Returns whether it did either. (An empty pot in reach is taken up by holding the key.)
   */
  act(): boolean {
    const g = this.g, s = g.state, st = g.stats, near = this.near;
    if (near?.fish.length) { this.haul(near); return true; }
    if (potsInHand(s, st) > 0) {
      const at = this.findSpot();
      if (at) { this.set(at.x, at.z); return true; }
      if (near) return false;
      const sail = g.sailing;
      g.hud.toast(sail.aboard ? (Math.abs(sail.boat.speed) > 1.2 ? 'Let her settle before you set a pot' : 'No room for a pot here') : 'Face open water to set a Lantern Pot');
    } else if (!near && st.potCount > 0) g.hud.toast('Every Lantern Pot you have is in the water');
    return false;
  }

  private splash(x: number, z: number, size: number) {
    const g = this.g, y = g.waveY(x, z);
    g.fx.spray.burst(this.v.set(x, y + 0.1, z), Math.round(14 * size), this.white, 1.4 * size, 2.2 * size, 0.7, 0.13);
    g.fx.ripples.spawn(this.v.set(x, 0, z), 1.6 * size, 1.3);
  }

  private set(x: number, z: number) {
    const g = this.g, s = g.state;
    const zone = zoneAt(this.region, x, z);
    const pot = placePot(s, zone?.id ?? null, x, z);
    if (!pot) return;
    g.audio.potSet();
    this.splash(x, z, 1);
    if (potKnows(s, pot.zone) > 0 && potRolled(pot.region, s.hour)) g.hud.toast(`Lantern Pot set${zone ? ` in ${zone.name}` : ''}. Nothing goes in it while the storm blows: it fishes again in the eye, or once the storm has passed.`);
    else if (potKnows(s, pot.zone) > 0) g.hud.toast(`Lantern Pot set${zone ? ` in ${zone.name}` : ''}. It fishes while you do.`, 'good');
    else g.hud.toast('Lantern Pot set, but its light stays dim: nothing in your journal swims here yet.', 'bad');
    this.near = pot; this.spot = null;
    void g.save();
  }

  private haul(pot: PotState) {
    const g = this.g, s = g.state;
    const got = haulPot(s, pot.id);
    if (!got.length) return;
    const worth = got.reduce((a, c) => a + c.value, 0);
    g.audio.potHaul(got.length);
    this.splash(pot.x, pot.z, 1.2);
    g.fx.glow.burst(this.v.set(pot.x, g.waveY(pot.x, pot.z) + 0.5, pot.z), 10 + got.length * 4, this.warm, 1.4, 2, 0.9, 0.12, 2);
    g.hud.toast(`Hauled ${got.length} fish from the pot · ◉ ${fmt(worth)} at the stall`, 'good');
    g.town.questEvent({ type: 'haul', count: got.length });
    void g.save();
  }

  private takeUp(pot: PotState) {
    const g = this.g;
    if (!takeUpPot(g.state, pot.id)) return;
    g.audio.potHaul(0);
    this.splash(pot.x, pot.z, 0.8);
    g.hud.toast('Lantern Pot taken up');
    this.near = null;
    void g.save();
  }

  /** What the pot key would do to the pot in reach, for the prompt. */
  get prompt(): string | null {
    const p = this.near;
    if (!p) return null;
    const rolled = potRolled(p.region, this.g.state.hour) ? ' · in a storm nothing goes in' : '';
    return (p.fish.length ? `Haul the Lantern Pot (${p.fish.length} fish)` : 'Hold to take up the Lantern Pot') + rolled;
  }

  // ------------------------------------------------------------------ per frame
  private make(pot: PotState): Float {
    const root = new Group();
    let setGlow: (v: number) => void;
    const model = assets.instance('potFloat');
    if (model) {
      // The generated float: a little larger than life so it reads from the dock, and each pot's lantern panes get
      // their own material so one can burn brighter than its neighbour (0 is out, 1 is lit, 2 to 3 blooms).
      model.scale.setScalar(1.5);
      root.add(model);
      const glass: MeshStandardMaterial[] = [];
      model.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && (m.material as MeshStandardMaterial).name === 'Glass') { m.material = (m.material as MeshStandardMaterial).clone(); glass.push(m.material as MeshStandardMaterial); }
      });
      setGlow = (v) => { for (const m of glass) m.emissiveIntensity = Math.min(3, 0.15 + 2.6 * v); };
    } else {
      const mat = createPropMaterial();
      const mesh = new Mesh((PotField.geo ??= buildPotFloat()), mat);
      mesh.castShadow = true;
      root.add(mesh);
      setGlow = (v) => { mat.userData.uniforms.uGlow.value = v; };
    }
    root.rotation.y = pot.id * 2.4;
    this.g.world.scene.add(root);
    return { root, setGlow, ph: pot.id * 1.7, flare: 0, fish: pot.fish.length, knows: 1, knowsAge: 99 };
  }

  present(dt: number) {
    const g = this.g, s = g.state, st = g.stats, t = g.world.time;
    const here = this.here();
    for (const [id, f] of this.floats) if (!here.some((p) => p.id === id)) { g.world.scene.remove(f.root); this.floats.delete(id); }
    for (const p of here) {
      let f = this.floats.get(p.id);
      if (!f) { f = this.make(p); this.floats.set(p.id, f); }
      // A fish has found its way in: the lantern flares, and the water says so if the player is near.
      if (p.fish.length > f.fish) {
        f.flare = 1;
        const d = Math.hypot(p.x - g.pos.x, p.z - g.pos.z);
        if (d < 40) { g.fx.ripples.spawn(this.v.set(p.x, 0, p.z), 1.1, 1.2); g.audio.potCatch(1 - d / 45); }
      }
      f.fish = p.fish.length;
      f.flare = Math.max(0, f.flare - dt * 0.9);
      f.knowsAge += dt;
      if (f.knowsAge > 2) { f.knowsAge = 0; f.knows = potKnows(s, p.zone, p.region); }
      const y = g.waveY(p.x, p.z);
      f.root.position.set(p.x, y + 0.02, p.z);
      f.root.rotation.x = Math.sin(t * 1.2 + f.ph) * 0.1; f.root.rotation.z = Math.sin(t * 0.9 + f.ph * 2) * 0.1;
      // Brighter the fuller it is, and brighter after dark; a full pot beats slowly so it can be picked out.
      const fill = Math.min(1, p.fish.length / st.potCapacity), full = fill >= 1;
      const lit = f.knows ? (0.3 + 0.7 * fill) * (0.3 + 0.7 * g.world.glow) : 0.04;
      f.setGlow(lit * (full ? 1 + 0.35 * Math.sin(t * 2.6 + f.ph) : 1) + 0.9 * f.flare);
    }
  }
}
