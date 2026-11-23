/**
 * The player's boat: putting it in the water, boarding and stepping ashore, the helm, finding places for
 * the chart, the murmur at the edge of the region, and fast travel between moorings.
 *
 * The handling itself is core/boat.ts (pure, tested); this file is the glue to the game.
 */
import { Vector3 } from 'three';
import type { Game } from './game';
import { makeBoatRig, type BoatRig } from '../render/boat-rig';
import { assets, freeOwn } from '../render/assets';
import { clearance, fogAt, nearestFloat, newBoat, stepBoat, type BoatEnv, type BoatState } from '../core/boat';
import { LANDING, boatEnv, hullDistance, landingSpot } from '../core/landing';
import { BOATS_BY_ID, type BoatDef } from '../core/quests';
import { earn } from '../core/economy';
import { roadTooRough, roadsOpen, type ChartPlace, type MooringDef, type RegionContent } from '../core/content';
import { hasFogLamp } from '../core/gear';

interface Hop { from: Vector3; to: Vector3; t: number; dur: number; rise: number; toBoat: boolean; done: () => void }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Sailing {
  rig: BoatRig | null = null;
  boat: BoatState = newBoat(0, 0, 0);
  /** The player is in the boat. */
  aboard = false;
  /** 0..1: how hard the murmur at the edge of the region is pushing back. */
  murmur = 0;
  /** 0..1: how deep in the Murmur Fog she is, whether or not a sea-road is letting her through it. */
  fog = 0;
  /** 0..1: how open the sea-road is where she lies (0 off the road, or with no fog lamp aboard). */
  road = 0;
  /** Speed made good over the ground, m/s: what the helm shows. In the murmur she sails hard and gets nowhere. */
  made = 0;
  /** The helm as last read (for the sail, the sound and the bots). */
  throttle = 0; rudder = 0;
  /** 0..1: on their feet amidships (0, to fish) or seated at the tiller (1). */
  seat = 1;
  def: BoatDef | null = null;
  env: BoatEnv;
  private region: RegionContent;
  private hop: Hop | null = null;
  private landing: { x: number; y: number; z: number } | null = null;
  private landingT = 0; private scanT = 0; private murmurTold = 0; private slowTold = 0; private reedT = 0;
  private stand = new Vector3();
  /** How long she has lain still with no call for way, s: after a moment the sail comes down. */
  private restT = 99;

  constructor(private g: Game) {
    this.region = g.world.region as RegionContent;
    this.env = this.seaHere();
    this.launch();
  }

  /** The sea of the region the game is in: its bed and rocks, and its sea-roads if she carries the Fog Lamp. */
  private seaHere(): BoatEnv {
    const g = this.g;
    // (A road with a rougher sea on it opens only to a boat with hull enough: the whale-road wants the Puffin.)
    return boatEnv(g.world.hf, g.world.rocks, (x, z) => (hasFogLamp(g.state) ? roadsOpen(g.state.world.region, x, z, this.def?.hull ?? 0) : 0));
  }

  /** The region has changed under her (see Game.enterRegion): a new sea, the same boat, still under way. */
  enterRegion() {
    const g = this.g, w = g.world;
    this.region = w.region as RegionContent;
    this.env = this.seaHere();
    this.landing = null; this.landingT = 0.5;
    // The new region comes with a ferry boat of its own; the player's is already in the scene.
    if (this.rig) { w.ferryHeld = true; w.ferryBoat.removeFromParent(); freeOwn(w.ferryBoat); }
    this.store();
  }

  get owned() { return this.def !== null; }
  /** Stepping between the boat and the shore: nothing else may move the player. */
  get busy() { return this.hop !== null; }
  /** The player's position is the boat's business right now. */
  get riding() { return this.aboard || this.busy; }
  /** 0..1 of top speed. */
  get pace() { return this.def ? Math.min(1, Math.abs(this.boat.speed) / this.def.speed) : 0; }

  /**
   * Puts the player's boat in the water: where the save left it, or at the nearest mooring the first
   * time. Safe to call again; does nothing without a boat.
   */
  launch() {
    const g = this.g, s = g.state;
    const def = s.boats.current ? BOATS_BY_ID.get(s.boats.current) ?? null : null;
    if (!def) { s.world.onBoat = false; return; }
    this.def = def;
    let at = s.boats.at;
    // A place out past the fog is no place to be left: she goes back to a mooring.
    if (at && Math.hypot(at.x - this.region.center[0], at.z - this.region.center[1]) > this.region.radius) at = null;
    if (!at || clearance(this.env, def, at.x, at.z, at.heading) < 0) {
      // The first time, she lies at the mooring nearest the player (the skiff is the ferry Pell rowed them in).
      const ms = [...(this.region.moorings ?? [])].sort((a, b) => Math.hypot(a.x - g.pos.x, a.z - g.pos.z) - Math.hypot(b.x - g.pos.x, b.z - g.pos.z));
      const from = at ?? (ms[0] ? { x: ms[0].x, z: ms[0].z, heading: ms[0].heading } : { x: g.pos.x, z: g.pos.z, heading: 0 });
      at = nearestFloat(this.env, def, from.x, from.z, from.heading) ?? from;
    }
    this.boat = newBoat(at.x, at.z, at.heading);
    s.boats.at = { x: at.x, z: at.z, heading: at.heading };
    if (!this.rig || this.rig.boatId !== def.id) this.fitOut(def.id);
    this.rig!.wake.reset();
    this.aboard = s.world.onBoat;
    if (this.aboard) { this.rig!.personAt(this.boat, g.pos, this.seat); g.yaw = this.boat.heading; }
  }

  /** Puts the hull of the boat she has now in the scene, in place of whichever was there. */
  private fitOut(id: string) {
    const g = this.g, w = g.world;
    // The first skiff is the ferry Pell rowed the player about in. Any other boat is built, and the ferry put away.
    const ferry = !this.rig && id === 'skiff' && !w.ferryHeld ? { hull: w.ferryBoat, isModel: w.ferryIsModel } : undefined;
    if (this.rig) { (g.hands as Game['hands'] | undefined)?.unship(); this.rig.root.removeFromParent(); freeOwn(this.rig.root); }
    if (!ferry && !w.ferryHeld) { w.ferryBoat.removeFromParent(); freeOwn(w.ferryBoat); }
    w.ferryHeld = true;
    this.rig = makeBoatRig(id, ferry);
    w.scene.add(this.rig.root);
  }

  /** Writes the boat into the save state. */
  store() {
    const s = this.g.state;
    if (!this.def) return;
    s.boats.at = { x: this.boat.x, z: this.boat.z, heading: this.boat.heading };
    // Mid-step counts as arrived: a save made in the air must not come back standing on the water.
    s.world.onBoat = this.hop ? this.hop.toBoat : this.aboard;
  }
  /** Where the player will be standing when a step ashore now under way is done; null otherwise. */
  get steppingTo(): Vector3 | null { return this.hop && !this.hop.toBoat ? this.hop.to : null; }

  // ------------------------------------------------------------------ fixed step
  /**
   * `helm`: the player may steer (not fishing, no menu). `fishing`: a line is out, so she is held still.
   * `sit`: the rod is put away, so the player sits down at the tiller.
   */
  step(dt: number, helm: boolean, fishing: boolean, sit: boolean) {
    const g = this.g, inp = g.input;
    this.murmurTold -= dt; this.slowTold -= dt;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.4; this.scan(); }
    if (!this.def || !this.rig) return;

    if (this.hop) { this.stepHop(dt); return; }

    const steer = this.aboard && helm;
    this.throttle = steer ? (inp.held('forward') ? 1 : 0) - (inp.held('back') ? 1 : 0) : 0;
    this.rudder = steer ? (inp.held('left') ? 1 : 0) - (inp.held('right') ? 1 : 0) : 0;
    // With a line out she is checked quickly, so the float does not drag.
    if (this.aboard && fishing) { this.boat.speed *= Math.exp(-2.4 * dt); this.boat.yawRate *= Math.exp(-3 * dt); }
    this.restT = this.throttle > 0 || this.boat.speed > 0.6 ? 0 : this.restT + dt;
    const h0 = this.boat.heading, x0 = this.boat.x, z0 = this.boat.z;
    const r = stepBoat(this.boat, { throttle: this.throttle, rudder: this.rudder }, this.def, this.env, dt);
    if (dt > 0) this.made += (Math.hypot(this.boat.x - x0, this.boat.z - z0) / dt - this.made) * Math.min(1, dt * 6);
    this.murmur = this.aboard ? r.murmur : 0;
    this.fog = this.aboard ? fogAt(this.env, this.boat.x, this.boat.z) : 0;
    this.road = this.aboard && this.fog > 0 ? this.env.open?.(this.boat.x, this.boat.z) ?? 0 : 0;
    if (r.bump > 0) {
      g.audio.boatBump(r.bump);
      this.rig.splash(this.boat, g.fx, r.bump, (x, z) => g.waveY(x, z));
      if (this.aboard) g.jolt(0.15 + 0.5 * r.bump);
    }
    if (this.aboard) {
      // The view turns with the boat, so holding a rudder key carries the camera round with her.
      g.camYaw += wrap(this.boat.heading - h0);
      this.seat += ((sit ? 1 : 0) - this.seat) * Math.min(1, dt * 7);
      this.rig.personAt(this.boat, g.pos, this.seat);
      if (this.murmur > 0.3 && this.murmurTold <= 0) {
        this.murmurTold = 14;
        const rough = hasFogLamp(g.state) ? roadTooRough(g.state.world.region, this.boat.x, this.boat.z, this.def?.hull ?? 0) : null;
        g.hud.toast(rough ? rough.tooRough ?? `The swell on this road is more than ${this.def?.name ?? 'she'} will take.` : hasFogLamp(g.state) ? 'The fog is too thick here. The Fog Lamp only shows the way along the sea-roads.' : this.region.edgeHint ?? 'The sea murmurs and turns you back.');
      }
      // Somewhere to step off: looked for a few times a second, only when she is nearly still.
      this.landingT -= dt;
      if (this.landingT <= 0) {
        this.landingT = 0.2;
        this.landing = Math.abs(this.boat.speed) < 1.5 ? this.findLanding() : null;
      }
    } else this.landing = null;
    if (this.rig.gybed) { this.rig.gybed = false; if (this.aboard) g.audio.sailFlap(); }
  }

  private stepHop(dt: number) {
    const g = this.g, h = this.hop!;
    h.t += dt;
    const k = Math.min(1, h.t / h.dur), e = k * k * (3 - 2 * k);
    if (h.toBoat) this.rig!.personAt(this.boat, h.to, 0);
    g.pos.lerpVectors(h.from, h.to, e);
    g.pos.y += Math.sin(Math.PI * k) * h.rise;
    const want = Math.atan2(h.to.x - h.from.x, h.to.z - h.from.z);
    g.yaw += wrap(want - g.yaw) * Math.min(1, dt * 14);
    if (k >= 1) { this.hop = null; h.done(); }
  }

  private startHop(to: Vector3, toBoat: boolean, done: () => void) {
    const g = this.g, d = Math.hypot(to.x - g.pos.x, to.z - g.pos.z);
    this.hop = { from: g.pos.clone(), to: to.clone(), t: 0, dur: 0.34 + 0.05 * d, rise: 0.35 + 0.06 * d, toBoat, done };
  }

  // ------------------------------------------------------------------ boarding and landing
  /** How far a point is from the hull (0 when alongside). */
  distanceTo(p: Vector3): number { return hullDistance(this.boat, p.x, p.z); }
  /** Where the player could step off to from where she lies now, clear of people and props if there is such a place. */
  private findLanding() {
    const g = this.g;
    return landingSpot((x, z) => g.groundAt(x, z), this.boat, (x, z) => g.clearOfBodies(x, z, 0.5));
  }
  /**
   * On foot and close enough to climb in. Boarding reaches a little further than landing does, so the
   * spot she put the player ashore on is always one she can be boarded from again.
   */
  get boardable() { return this.owned && !this.riding && this.distanceTo(this.g.pos) < LANDING.reach + LANDING.slack && Math.abs(this.boat.speed) < 0.5; }
  /** Aboard with somewhere to step off. */
  get canLand() { return this.aboard && !this.busy && this.landing !== null; }

  board() {
    if (!this.boardable) return false;
    const g = this.g, s = g.state;
    g.audio.step(g.world.dockDeckAt(g.pos.x, g.pos.z) !== null ? 'wood' : 'sand', true);
    this.startHop(this.rig!.personAt(this.boat, this.stand, 0), true, () => {
      this.aboard = true; s.world.onBoat = true; this.seat = 0;
      g.audio.boatBoard();
      this.boat.speed = 0; this.landingT = 0.6; this.landing = null;
      // Take the helm: face the bow, and bring the view round behind her.
      g.yaw = this.boat.heading; g.camYaw = this.boat.heading;
      void g.save();
    });
    return true;
  }

  stepAshore() {
    if (!this.canLand) return false;
    const g = this.g, s = g.state;
    // She stops where she is, and the place to step to is looked for again from there: the one on offer
    // may be a fifth of a second old.
    this.boat.speed = 0; this.boat.yawRate = 0; this.throttle = 0; this.rudder = 0;
    const l = this.landing = this.findLanding();
    if (!l) return false;
    g.audio.boatBoard();
    this.aboard = false; s.world.onBoat = false; this.murmur = 0; this.fog = 0; this.road = 0;
    this.startHop(this.stand.set(l.x, l.y, l.z), false, () => {
      g.audio.step(g.world.dockDeckAt(g.pos.x, g.pos.z) !== null ? 'wood' : 'sand', true);
      this.store();
      g.town.arrive();
      void g.save();
    });
    return true;
  }

  /** Bots and old saves: put the player aboard at once, wherever the boat is. */
  embark() {
    if (!this.owned) return;
    const g = this.g;
    this.hop = null; this.aboard = true; g.state.world.onBoat = true;
    this.seat = 1; this.rig!.personAt(this.boat, g.pos, this.seat);
    g.yaw = this.boat.heading; g.snapCamera();
  }

  // ------------------------------------------------------------------ the chart
  /** Places not yet on the chart that the player has come within sight of. */
  private scan() {
    const g = this.g, s = g.state;
    for (const c of this.region.chart ?? []) {
      if (c.r <= 0 || s.world.charted.includes(c.id)) continue;
      if (Math.hypot(g.pos.x - c.x, g.pos.z - c.z) < c.r) this.discover(c);
    }
  }

  private discover(c: ChartPlace) {
    const g = this.g, s = g.state;
    s.world.charted.push(c.id);
    const coins = c.coins ?? 0;
    if (coins) earn(s, coins);
    g.audio.discover();
    g.hud.toast(`On the chart: ${c.name}${coins ? ` · ◉ ${coins}` : ''}`, 'gold');
    // Finding a place can be the whole of a job ("sail to the Fen").
    g.town.questEvent({ type: 'visit', place: c.id });
    void g.save();
  }

  /** The known mooring the boat is lying at, if the player is with her: fast travel starts from here. */
  mooredAt(): MooringDef | null {
    if (!this.owned || this.busy) return null;
    if (!this.aboard && this.distanceTo(this.g.pos) > 14) return null;
    const known = this.g.state.world.charted;
    for (const m of this.region.moorings ?? []) if (known.includes(m.place) && Math.hypot(m.x - this.boat.x, m.z - this.boat.z) < 34) return m;
    return null;
  }

  /** Fast travel: the boat and the player arrive at a mooring (the caller fades the screen). */
  moorAt(m: MooringDef) {
    if (!this.owned) return;
    const g = this.g;
    const at = clearance(this.env, this.def!, m.x, m.z, m.heading) >= 0 ? m : nearestFloat(this.env, this.def!, m.x, m.z, m.heading) ?? m;
    this.boat = newBoat(at.x, at.z, at.heading);
    this.rig!.wake.reset();
    this.hop = null; this.aboard = true; g.state.world.onBoat = true; this.landingT = 0;
    this.seat = 1; this.rig!.personAt(this.boat, g.pos, this.seat);
    g.yaw = this.boat.heading; g.snapCamera();
    this.store();
  }

  /** "Let her settle": casting is refused while she has way on. */
  tellSlow() { if (this.slowTold <= 0) { this.slowTold = 4; this.g.hud.toast('Let her settle before you cast'); } }

  // ------------------------------------------------------------------ per frame
  present(dt: number) {
    const g = this.g;
    if (!this.def || !this.rig) return;
    // The sail is down when she is left, and when she has lain still for a moment with nobody asking for way.
    const furl = !this.aboard || this.restT > 1.2;
    this.rig.update(dt, this.boat, { time: g.world.time, waveY: (x, z) => g.waveY(x, z), night: g.world.light.night, throttle: this.throttle, rudder: this.rudder, water: g.world.water, furl, fog: this.fog }, g.fx, this.def.speed);
    // The Fog Lamp goes on the bow as soon as she has one, and lights itself when the fog closes in.
    if (!this.rig.hasFogLamp && hasFogLamp(g.state)) this.rig.shipFogLamp(assets.instance('fogLamp'));
    if (this.rig.fogLampLit) { this.rig.fogLampLit = false; if (this.aboard) g.audio.fogLampLight(); }
    g.world.lampAt = this.rig.hasFogLamp ? this.boat : null;
    const road = g.world.seaRoad;
    if (road && road.lit !== null) {
      const p = road.at(road.lit), d = Math.hypot(p.x - g.pos.x, p.z - g.pos.z);
      if (d < 220) g.audio.roadChime(road.lit, Math.max(0.25, 1 - d / 200));
      road.lit = null;
    }
    // Reeds hiss along the hull when she is pushed through a bed of them, quicker the faster she goes.
    if (this.aboard && g.world.fen && Math.abs(this.boat.speed) > 0.7) {
      this.reedT -= dt * Math.min(2.2, Math.abs(this.boat.speed) / 2.5);
      if (this.reedT <= 0 && g.world.fen.inReeds(this.boat.x, this.boat.z)) { this.reedT = 0.55 + Math.random() * 0.4; g.audio.reedBrush(0.6 + 0.4 * this.pace); }
    }
    if (this.rig.sailMoved) { if (this.aboard) { if (this.rig.sailMoved !== 'up') g.audio.ropeCreak(); else if (this.def.id === 'puffin') g.audio.sloopSail(); else g.audio.sailFlap(); } this.rig.sailMoved = null; }
    // The player rides the boat's rise and fall.
    if (this.aboard && !this.hop) this.rig.personAt(this.boat, g.pos, this.seat);
  }
}
