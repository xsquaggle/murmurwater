/**
 * Presents a FishingSession in 3D: the lure, the line, the hooked fish, splashes and ripples.
 *
 * The lure hangs from the rod tip on a short length of line (a little pendulum, so it swings as the rod
 * moves). A cast slings it: for the first WHIP seconds it is still on that line while the rod whips
 * forward, then it leaves the tip on a ballistic arc with the line paying out behind it along the path
 * it has flown, and lands with a splash scaled to the throw. While charging, a dashed arc and a ring on
 * the water show where it will land.
 */
import {
  AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry,
  SphereGeometry, CylinderGeometry, Vector2, Vector3,
} from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { FishingSession } from '../core/fishing';
import type { Fx } from './fx';
import { makeFish, type FishObject } from './fish-models';
import { PALETTE } from './palette';

const LINE_PTS = 28;
const ARC_PTS = 24;
/** Seconds after release during which the lure is still slung from the tip (the rod's forward whip). */
export const WHIP = 0.11;
/** Length of line between the rod tip and the dangling lure. */
const DANGLE = 0.5;
const UP = new Vector3(0, 1, 0);
const _v = new Vector3(), _w = new Vector3(), _n = new Vector3();
const WHITE = new Color(PALETTE.bone), GOLD = new Color(PALETTE.lantern), FOAM = new Color(PALETTE.seafoam), CORAL = new Color(PALETTE.coral);
const LINE_COL = new Color(0xf2ecdc), _col = new Color();
/** Seconds for the lure to zip back to the rod when the line is reeled in. */
const RETRIEVE = 0.3;
/** How far the line in flight hangs back along the path the lure has flown (1) rather than a straight chord (0). */
const SLACK_START = 0.8, SLACK_END = 0.22;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface AimInfo { target: Vector3; power: number; sweet: boolean }

export class FishingView {
  readonly group = new Group();
  private bobber = new Group();
  private line: Line2;
  private lineGeo = new LineGeometry();
  private lineMat: LineMaterial;
  private linePos = new Float32Array(LINE_PTS * 3);
  private arc: Line2;
  private arcGeo = new LineGeometry();
  private arcMat: LineMaterial;
  private arcPos = new Float32Array(ARC_PTS * 3);
  private ring: Mesh; private ringMat: MeshBasicMaterial;
  private aimPos = new Vector3(); private aimFrom = new Vector3(); private aimShown = 0; private arcShown = 0;
  private aimFresh = false; private aimPower = 0; private aimSweet = 0; private aimIsSweet = false;
  private fishObj: FishObject | null = null;
  private fishId: string | null = null;
  private t = 0;
  private bobberY = 0; private bobberV = 0;
  private fishPos = new Vector3();
  private lateral = 0;
  private jump = -1;
  readonly target = new Vector3();
  readonly bobberPos = new Vector3();
  /** 0..1 through the lure's flight (0 while it is still on the rod). */
  flightK = 0;
  private castFrom = new Vector3();
  private castT = 0; private castDur = 1; private castPower = 0; private castClean = false;
  /** Far casts get a slightly larger float so it still reads from the dock. */
  private grow = 1;
  private launched = false;
  private apex = 2;
  // Dangling lure (position-based pendulum from the rod tip).
  private lure = new Vector3(); private lureV = new Vector3(); private lureReady = false;
  private lastTip = new Vector3();
  private lastFlight = new Vector3();
  /** Set while the rod is put away (a catch is being shown): no lure, no line. */
  lureHidden = false;
  private retrieve = -1; private retrieveFrom = new Vector3();
  private bow = 0; private bowV = 0;      // line bow above (+) / sag below (−) the chord, as a fraction of its length
  private surfaced = true;
  private later: { at: number; run: () => void }[] = [];
  private dir = new Vector3(0, 0, 1);
  private side = new Vector3(1, 0, 0);
  private wasPhase = 'idle';
  private wakeTimer = 0;

  constructor(private fx: Fx, private waveY: (x: number, z: number) => number, private floorY: (x: number, z: number) => number = waveY) {
    const red = new MeshStandardMaterial({ color: new Color(PALETTE.coral), roughness: 0.4, flatShading: true });
    const white = new MeshStandardMaterial({ color: new Color(PALETTE.bone), roughness: 0.4, flatShading: true });
    const top = new Mesh(new SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bot = new Mesh(new SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const stick = new Mesh(new CylinderGeometry(0.012, 0.012, 0.22, 4), red); stick.position.y = 0.15;
    this.bobber.add(top, bot, stick);
    this.bobber.traverse((o) => { o.castShadow = true; });
    this.bobber.visible = false;
    this.group.add(this.bobber);
    this.lineGeo.setPositions(this.linePos);
    this.lineMat = new LineMaterial({ color: 0xf2ecdc, linewidth: 1.6, transparent: true, opacity: 0.85, worldUnits: false });
    this.line = new Line2(this.lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.group.add(this.line);
    // Aim preview: a dashed arc from the rod tip and a ring where the lure will land.
    this.arcGeo.setPositions(this.arcPos);
    this.arcMat = new LineMaterial({ color: 0xf2ecdc, linewidth: 2.2, transparent: true, opacity: 0, worldUnits: false, dashed: true, dashSize: 0.35, gapSize: 0.45, depthWrite: false });
    this.arc = new Line2(this.arcGeo, this.arcMat);
    this.arc.frustumCulled = false; this.arc.visible = false; this.arc.renderOrder = 7;
    this.group.add(this.arc);
    const rg = new RingGeometry(0.78, 1, 48, 1); rg.rotateX(-Math.PI / 2);
    this.ringMat = new MeshBasicMaterial({ color: WHITE.clone(), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    this.ring = new Mesh(rg, this.ringMat);
    const dot = new Mesh(new RingGeometry(0, 0.16, 20, 1).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.add(dot);
    this.ring.visible = false; this.ring.renderOrder = 7; this.ring.frustumCulled = false;
    this.group.add(this.ring);
  }

  setResolution(w: number, h: number) { this.lineMat.resolution = new Vector2(w, h); this.arcMat.resolution = new Vector2(w, h); }

  /**
   * Where the cast being charged would land. Call every frame while charging; the marker fades out when
   * the calls stop, and stays on the water during the flight so the lure can hit it.
   */
  aim(info: AimInfo, origin: Vector3) {
    this.aimPos.copy(info.target); this.aimPower = info.power; this.aimIsSweet = info.sweet;
    this.aimFrom.copy(origin);
    this.aimFresh = true;
  }

  /** Called when a cast is released: the lure is slung from the tip toward the aim direction. */
  beginCast(origin: Vector3, yaw: number, distance: number, flight: number, power = 0.6, clean = false) {
    this.dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.side.set(this.dir.z, 0, -this.dir.x);
    this.target.copy(origin).addScaledVector(this.dir, distance);
    this.target.y = 0;
    this.aimPos.copy(this.target);
    this.castT = 0; this.castDur = flight; this.castPower = power; this.castClean = clean;
    this.grow = 1 + 0.5 * clamp01((distance - 10) / 18);
    this.launched = false; this.flightK = 0;
    this.bobber.visible = true;
  }

  update(dt: number, s: FishingSession, tip: Vector3, player: Vector3) {
    this.t += dt;
    const phase = s.phase;
    if (phase !== this.wasPhase) this.onPhase(this.wasPhase, phase, s);
    this.wasPhase = phase;
    while (this.later.length && this.later[0].at <= this.t) this.later.shift()!.run();
    const wy = this.waveY(this.target.x, this.target.z);

    let end = this.bobberPos;
    let line: 'short' | 'flight' | 'water' | 'fish' = 'short';
    let tension = 0;
    switch (phase) {
      case 'idle': case 'charging': case 'landed': case 'lost':
        this.clearFish();
        this.dangle(dt, tip);
        break;
      case 'casting': {
        this.castT += dt;
        if (!this.launched && this.castT >= WHIP) this.launch(tip);
        if (!this.launched) { this.dangle(dt, tip); break; }
        const k = clamp01((this.castT - WHIP) / Math.max(0.05, this.castDur - WHIP));
        this.flightK = k;
        this.flightPos(k, end, wy);
        // The stick trails behind and the float stretches along its path while it is moving fast.
        this.flightPos(Math.max(0, k - 0.04), _v, wy);
        _n.copy(_v).sub(end);
        if (_n.lengthSq() > 1e-8) this.bobber.quaternion.setFromUnitVectors(UP, _n.normalize());
        const stretch = 1 + 0.55 * (1 - k);
        const g = 1 + (this.grow - 1) * k;
        this.bobber.scale.set(g / Math.sqrt(stretch), g * stretch, g / Math.sqrt(stretch));
        this.bobber.position.copy(end);
        this.trail(dt, end, k);
        this.lure.copy(end);
        line = 'flight';
        break;
      }
      case 'waiting': case 'bite': {
        // Spring-damped bobbing on the waves; the landing plunges it, nibbles and bites kick it down.
        const k = 140, damp = 9;
        const restY = phase === 'bite' ? -0.32 + Math.sin(this.t * 30) * 0.05 : 0;
        this.bobberV += ((restY - this.bobberY) * k - this.bobberV * damp) * dt;
        this.bobberY += this.bobberV * dt;
        end.set(this.target.x + (phase === 'bite' ? Math.sin(this.t * 17) * 0.06 : 0), wy + this.bobberY, this.target.z);
        if (!this.surfaced && this.bobberY > -0.03 && this.bobberV > 0) {
          // It pops back up through the surface.
          this.surfaced = true;
          _v.set(end.x, wy + 0.05, end.z);
          this.fx.ripples.spawn(_v, 1.1, 0.9);
          this.fx.spray.burst(_v, 7, FOAM, 0.9, 1.5, 0.45, 0.09);
        }
        this.bobber.position.copy(end);
        this.bobber.scale.setScalar(this.grow);
        this.bobber.rotation.set(Math.sin(this.t * 1.3) * 0.05, 0, Math.sin(this.t * 1.7) * 0.08 + this.bobberV * 0.02);
        // The line settles from its bow in the air onto the water; a bite pulls it nearly straight.
        const rest = phase === 'bite' ? -0.012 : -0.045;
        this.bowV += ((rest - this.bow) * (phase === 'bite' ? 90 : 26) - this.bowV * (phase === 'bite' ? 14 : 6)) * dt;
        this.bow += this.bowV * dt;
        this.lure.copy(end);
        line = 'water';
        break;
      }
      case 'fighting': {
        const fs = s.fight!;
        this.lateral += ((fs.run || 0) * 0.45 - this.lateral * 0.25) * dt * 2.2;
        this.lateral = Math.max(-1, Math.min(1, this.lateral));
        const d = Math.max(1, fs.distance);
        this.fishPos.copy(player).addScaledVector(this.dir, d).addScaledVector(this.side, this.lateral * Math.min(8, d * 0.4));
        let fy = this.waveY(this.fishPos.x, this.fishPos.z) - 0.35;
        if (fs.thrash > 0 && this.jump < 0) this.jump = 0;
        if (this.jump >= 0) {
          this.jump += dt / 0.75;
          fy += Math.sin(Math.min(1, this.jump) * Math.PI) * 1.6;
          if (this.jump >= 1) { this.jump = -1; this.splash(this.fishPos, 1.2); }
        }
        this.fishPos.y = fy;
        this.ensureFish(fs.fish.id);
        const fo = this.fishObj!.obj;
        this.fishObj!.animate(this.t, Math.min(1, 0.35 + (fs.run !== 0 ? 0.5 : 0) + (this.jump >= 0 ? 0.4 : 0)));
        fo.position.copy(this.fishPos);
        fo.lookAt(this.fishPos.x - this.dir.x - this.side.x * this.lateral, fy + (this.jump >= 0 ? Math.cos(this.jump * Math.PI) * 0.8 : 0), this.fishPos.z - this.dir.z - this.side.z * this.lateral);
        fo.rotation.z += Math.sin(this.t * 14) * 0.25;
        end = this.fishPos;
        this.lure.copy(end);
        tension = fs.tension;
        this.bow = -0.1 * (1 - tension);
        this.wakeTimer -= dt;
        if (this.wakeTimer <= 0) {
          this.wakeTimer = fs.run !== 0 ? 0.08 : 0.22;
          const p = this.fishPos.clone(); p.y = this.waveY(p.x, p.z);
          this.fx.ripples.spawn(p, fs.run !== 0 ? 1.4 : 0.8, 0.9);
          this.fx.spray.burst(p, fs.run !== 0 ? 6 : 2, FOAM, 1.2, 1.6, 0.6, 0.12);
        }
        line = 'fish';
        break;
      }
    }
    const show = !this.lureHidden;
    this.bobber.visible = show && phase !== 'fighting';
    this.line.visible = show;
    if (!show) this.lureReady = false;
    else if (line === 'flight') this.flightLine(tip, this.flightK, wy);
    else this.hangLine(tip, end, line === 'short' ? 0 : -this.bow, tension, line === 'water');
    _col.copy(LINE_COL);
    // The line warms toward amber, then coral, as tension climbs.
    if (tension > 0) _col.lerp(GOLD, Math.min(1, tension * 1.2)).lerp(CORAL, Math.max(0, (tension - 0.8) * 4));
    this.lineMat.color.copy(_col);
    this.updateAim(dt, phase);
    this.lastTip.copy(tip);
  }

  // ---- the lure on its short line ----

  /** The lure hanging from the tip (or zipping back to it after the line is reeled in). */
  private dangle(dt: number, tip: Vector3) {
    if (this.retrieve >= 0) {
      this.retrieve += dt / RETRIEVE;
      const k = Math.min(1, this.retrieve), e = k * k * (3 - 2 * k);
      _v.set(tip.x, tip.y - DANGLE, tip.z);
      this.lure.lerpVectors(this.retrieveFrom, _v, e);
      this.lure.y += Math.sin(k * Math.PI) * 0.35;
      if (k < 0.45) {
        // It skips across the surface on the way in.
        _w.set(this.lure.x, this.waveY(this.lure.x, this.lure.z) + 0.04, this.lure.z);
        this.fx.spray.burst(_w, 2, FOAM, 0.7, 1.2, 0.35, 0.08);
        if (Math.random() < dt * 20) this.fx.ripples.spawn(_w, 0.6, 0.6);
      }
      if (k >= 1) {
        this.retrieve = -1;
        // Arrives with some speed left, so it swings under the tip before it settles.
        this.lureV.copy(_v).sub(this.retrieveFrom).setY(0).normalize().multiplyScalar(2.2);
        this.lastTip.copy(tip); this.lureReady = true;
      }
    } else this.swing(dt, tip);
    this.bobberPos.copy(this.lure);
    this.bobber.position.copy(this.lure);
    this.bobber.scale.set(1, 1, 1);
    _n.copy(tip).sub(this.lure);
    if (_n.lengthSq() > 1e-6) this.bobber.quaternion.setFromUnitVectors(UP, _n.normalize());
  }

  /** A pendulum on a string: gravity, a little air drag, and the string going taut against the moving tip. */
  private swing(dt: number, tip: Vector3) {
    if (!this.lureReady || this.lure.distanceToSquared(tip) > 9) {
      this.lure.set(tip.x, tip.y - DANGLE, tip.z); this.lureV.set(0, 0, 0); this.lastTip.copy(tip); this.lureReady = true;
    }
    if (dt <= 1e-6) return;
    const steps = Math.max(1, Math.min(10, Math.ceil(dt * 120)));
    const h = dt / steps;
    for (let i = 1; i <= steps; i++) {
      _w.lerpVectors(this.lastTip, tip, i / steps);
      this.lureV.y -= 9.8 * h;
      this.lureV.multiplyScalar(1 - Math.min(1, 1.2 * h));
      _v.copy(this.lure).addScaledVector(this.lureV, h);
      _n.copy(_v).sub(_w);
      const d = _n.length();
      if (d > DANGLE) _v.copy(_w).addScaledVector(_n, DANGLE / d);
      this.lureV.copy(_v).sub(this.lure).divideScalar(h);
      this.lure.copy(_v);
    }
    const fy = this.floorY(this.lure.x, this.lure.z) + 0.1;
    if (this.lure.y < fy) { this.lure.y = fy; if (this.lureV.y < 0) this.lureV.y = 0; this.lureV.multiplyScalar(0.8); }
  }

  // ---- the throw ----

  /** The lure leaves the tip. */
  private launch(tip: Vector3) {
    this.launched = true;
    this.retrieve = -1;
    this.castFrom.copy(this.lure);
    this.lastFlight.copy(this.lure);
    const dist = Math.hypot(this.target.x - this.castFrom.x, this.target.z - this.castFrom.z);
    this.apex = 0.9 + dist * 0.1 + this.castPower * 0.5;
    // A flick of light and a few drops off the tip as the line lets go.
    const c = this.castClean ? GOLD : WHITE;
    this.fx.glow.burst(tip, 6 + Math.round(8 * this.castPower), c, 1.6, 0.6, 0.28, 0.1, 0);
    for (let i = 0; i < 5 + Math.round(6 * this.castPower); i++) {
      _v.copy(this.dir).multiplyScalar(3 + Math.random() * 5).addScaledVector(this.side, (Math.random() - 0.5) * 2.4);
      _v.y = 1 + Math.random() * 2.5;
      this.fx.spray.emit(tip, _v, FOAM, 0.35 + Math.random() * 0.3, 0.05 + Math.random() * 0.04, 9.8);
    }
  }

  /** Lure position `k` (0..1) of the way through its flight: fast off the rod, slowing, on a high arc. */
  private flightPos(k: number, out: Vector3, wy: number): Vector3 {
    const u = 0.35 * k + 0.65 * (1 - Math.pow(1 - k, 1.6));
    out.x = this.castFrom.x + (this.target.x - this.castFrom.x) * u;
    out.z = this.castFrom.z + (this.target.z - this.castFrom.z) * u;
    out.y = this.castFrom.y * (1 - k) + wy * k + 4 * this.apex * k * (1 - k);
    return out;
  }

  /** A streak of light (gold on a clean cast) and the odd drop shed along the lure's path. */
  private trail(dt: number, at: Vector3, k: number) {
    const n = Math.max(1, Math.min(8, Math.ceil(dt * 100)));
    const c = this.castClean ? GOLD : WHITE;
    for (let i = 1; i <= n; i++) {
      _w.lerpVectors(this.lastFlight, at, i / n);
      _v.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
      this.fx.glow.emit(_w, _v, c, 0.3 + Math.random() * 0.14, (this.castClean ? 0.15 : 0.11) * (1 - 0.4 * k), 0);
      if (Math.random() < 0.25) {
        _v.set((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
        this.fx.spray.emit(_w, _v, FOAM, 0.4, 0.05, 6);
      }
    }
    this.lastFlight.copy(at);
  }

  /** The lure meets the water. */
  private land() {
    // Far casts splash a little bigger than life so they still read from the dock.
    const size = (0.55 + 0.75 * this.castPower) * this.grow;
    const p = new Vector3(this.target.x, this.waveY(this.target.x, this.target.z) + 0.05, this.target.z);
    // A crown thrown outward (more of it along the line of the throw), a column straight up, widening rings.
    this.fx.spray.burst(p, Math.round(20 * size), FOAM, 2.3 * size, 2.5 * size, 0.8, 0.15 * size);
    this.fx.spray.burst(p, Math.round(9 * size), WHITE, 0.4, 5 * size, 0.9, 0.19 * size);
    for (let i = 0; i < Math.round(10 * size); i++) {
      _v.copy(this.dir).multiplyScalar((1.5 + Math.random() * 3) * size).addScaledVector(this.side, (Math.random() - 0.5) * 1.6);
      _v.y = (1.2 + Math.random() * 2) * size;
      this.fx.spray.emit(p, _v, FOAM, 0.5 + Math.random() * 0.4, 0.12 * size, 9.8);
    }
    this.fx.ripples.spawn(p, 1.2 * size, 0.9);
    this.after(0.1, () => this.fx.ripples.spawn(p, 2.1 * size, 1.3));
    this.after(0.28, () => this.fx.ripples.spawn(p, 3.0 * size, 1.8));
    if (this.castClean) {
      // A clean cast lands with a ring of gold.
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 + Math.random() * 0.2, sp = 3.4 + Math.random() * 1.2;
        _v.set(Math.cos(a) * sp, 0.5 + Math.random() * 0.6, Math.sin(a) * sp);
        this.fx.glow.emit(p, _v, GOLD, 0.5 + Math.random() * 0.25, 0.13, 2.5);
      }
      this.fx.ripples.spawn(p, 3.6, 1.2, GOLD);
    }
    // The float plunges, then pops back up; the line is still in the air and settles after it.
    this.bobberY = -0.12 - 0.42 * size; this.bobberV = -2.2 * size; this.surfaced = false;
    const len = Math.max(1, this.lastTip.distanceTo(p));
    this.bow = (SLACK_END * this.apex) / len; this.bowV = 0;
    this.flightK = 0;
  }

  /** Reeled in or thrown off: the lure comes back to the rod. */
  private startRetrieve(from: Vector3) {
    this.retrieve = 0;
    this.retrieveFrom.copy(from);
    this.lure.copy(from);
    this.lureReady = true;
  }

  private after(delay: number, run: () => void) {
    this.later.push({ at: this.t + delay, run });
    this.later.sort((a, b) => a.at - b.at);
  }

  // ---- the line ----

  /** In flight the line pays out along the path the lure has flown, pulling straighter as it goes, with a ripple running down it. */
  private flightLine(tip: Vector3, k: number, wy: number) {
    const slack = SLACK_START + (SLACK_END - SLACK_START) * k;
    const amp = 0.16 * (1 - k) * (0.4 + 0.6 * this.castPower);
    const ox = tip.x - this.castFrom.x, oy = tip.y - this.castFrom.y, oz = tip.z - this.castFrom.z;
    const b = this.bobberPos;
    for (let i = 0; i < LINE_PTS; i++) {
      const t = i / (LINE_PTS - 1);
      this.flightPos(k * t, _v, wy);
      _v.x += ox * (1 - t); _v.y += oy * (1 - t); _v.z += oz * (1 - t);
      _w.lerpVectors(tip, b, t).lerp(_v, slack);
      const s = Math.sin(t * Math.PI);
      _w.y += Math.sin(t * 16 - this.t * 34) * amp * s;
      _w.addScaledVector(this.side, Math.sin(t * 11 - this.t * 27) * amp * 0.7 * s);
      this.linePos[i * 3] = _w.x; this.linePos[i * 3 + 1] = _w.y; this.linePos[i * 3 + 2] = _w.z;
    }
    this.lineGeo.setPositions(this.linePos);
  }

  /** A line hanging between two points: `sag` (fraction of its length) below the chord, or bowed above it when negative. */
  private hangLine(a: Vector3, b: Vector3, sag: number, tension: number, onWater: boolean) {
    const len = a.distanceTo(b);
    const hum = tension > 0.75 ? (tension - 0.75) * 0.08 : 0;
    for (let i = 0; i < LINE_PTS; i++) {
      const t = i / (LINE_PTS - 1);
      const s = Math.sin(t * Math.PI);
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      let y = a.y + (b.y - a.y) * t - s * sag * len + Math.sin(this.t * 90 + t * 20) * hum * s;
      // Slack line lies on the water rather than sinking through it.
      if (onWater && t > 0.05 && t < 0.97) y = Math.max(y, this.waveY(x, z) + 0.03);
      this.linePos[i * 3] = x; this.linePos[i * 3 + 1] = y; this.linePos[i * 3 + 2] = z;
    }
    this.lineGeo.setPositions(this.linePos);
  }

  // ---- aim marker ----

  private updateAim(dt: number, phase: string) {
    const charging = phase === 'charging' && this.aimFresh;
    const ringOn = charging || (phase === 'casting' && this.aimShown > 0.02);
    this.aimFresh = false;
    this.aimShown += ((ringOn ? 1 : 0) - this.aimShown) * Math.min(1, dt * (ringOn ? 10 : 9));
    this.arcShown += ((charging ? 1 : 0) - this.arcShown) * Math.min(1, dt * (charging ? 8 : 16));
    this.aimSweet += ((this.aimIsSweet ? 1 : 0) - this.aimSweet) * Math.min(1, dt * 14);
    const on = this.aimShown > 0.01;
    this.ring.visible = on;
    this.arc.visible = this.arcShown > 0.01;
    if (!on) return;
    const sw = this.aimSweet;
    const wy = this.waveY(this.aimPos.x, this.aimPos.z);
    this.ring.position.set(this.aimPos.x, wy + 0.07, this.aimPos.z);
    // The ring tightens as the lure comes down on it, and breathes faster in the sweet spot.
    _w.copy(this.aimPos).sub(this.aimFrom).setY(0);
    const far = 1 + 0.6 * clamp01((_w.length() - 8) / 18);
    const r = (0.7 + 0.1 * sw + Math.sin(this.t * (6 + 8 * sw)) * (0.04 + 0.03 * sw)) * far * (phase === 'casting' ? 1.25 - 0.45 * this.flightK : 1) * (0.6 + 0.4 * this.aimShown);
    this.ring.scale.set(r, 1, r);
    this.ringMat.color.copy(WHITE).lerp(GOLD, sw);
    this.ringMat.opacity = this.aimShown * (0.55 + 0.35 * sw);
    if (!this.arc.visible) return;
    // Dashed arc from where the rod will let go to the marker, dashes running toward the water.
    _w.copy(this.aimPos).sub(this.aimFrom).setY(0);
    const dist = _w.length();
    _w.normalize();
    const x0 = this.aimFrom.x + _w.x * 0.9, y0 = this.aimFrom.y + 2.5, z0 = this.aimFrom.z + _w.z * 0.9;
    const apex = 0.9 + dist * 0.1 + this.aimPower * 0.5;
    for (let i = 0; i < ARC_PTS; i++) {
      const k = i / (ARC_PTS - 1);
      const u = 0.35 * k + 0.65 * (1 - Math.pow(1 - k, 1.6));
      this.arcPos[i * 3] = x0 + (this.aimPos.x - x0) * u;
      this.arcPos[i * 3 + 1] = y0 * (1 - k) + (wy + 0.1) * k + 4 * apex * k * (1 - k);
      this.arcPos[i * 3 + 2] = z0 + (this.aimPos.z - z0) * u;
    }
    this.arcGeo.setPositions(this.arcPos);
    this.arc.computeLineDistances();
    this.arcMat.color.copy(WHITE).lerp(GOLD, sw);
    this.arcMat.opacity = this.arcShown * (0.22 + 0.3 * sw) * Math.min(1, this.aimPower * 4);
    this.arcMat.dashOffset = -this.t * 2.4;
  }

  private onPhase(from: string, to: string, s: FishingSession) {
    if (to === 'waiting' && from === 'casting') this.land();
    if (to === 'bite') { this.splash(this.target, 0.9); }
    if (to === 'landed') { this.splash(this.fishPos, 1.0); this.clearFish(); this.lureReady = false; this.retrieve = -1; }
    if (to === 'lost') { this.clearFish(); this.startRetrieve(this.fishPos); }
    if (to === 'fighting') { this.lateral = 0; this.jump = -1; this.ensureFish(s.fight!.fish.id); }
    if (to === 'idle' && (from === 'waiting' || from === 'bite' || from === 'casting')) this.startRetrieve(this.bobberPos);
  }

  /** The hooked fish's position while fighting. */
  get hooked(): Vector3 | null { return this.fishObj ? this.fishPos : null; }

  nibble() {
    this.bobberV -= 2.2; this.bowV += 0.05;
    this.fx.ripples.spawn(this.target, 0.7, 0.8);
  }

  splash(at: Vector3, size: number) {
    const p = at.clone(); p.y = this.waveY(p.x, p.z) + 0.05;
    this.fx.spray.burst(p, Math.round(18 * size), FOAM, 1.6 * size, 3.2 * size, 0.9, 0.16 * size);
    this.fx.ripples.spawn(p, 1.6 * size, 1.3);
    this.fx.ripples.spawn(p, 0.9 * size, 0.9);
  }

  private ensureFish(id: string) {
    if (this.fishId === id && this.fishObj) return;
    this.clearFish();
    this.fishObj = makeFish(id);
    this.fishObj.obj.scale.setScalar(1.6); // read clearly at casting distance
    this.fishId = id;
    this.group.add(this.fishObj.obj);
  }
  private clearFish() { if (this.fishObj) { this.fishObj.dispose(); this.fishObj = null; this.fishId = null; } }
}
