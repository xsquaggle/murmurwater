/**
 * The player's boat in the world: the hull riding the same waves the water draws, a scrap of lug sail that
 * fills with speed, the stern lantern, and the wake it leaves.
 *
 * The mast and sail are procedural (flat-shaded, palette colours, like the dock and the lighthouse); the
 * cloth is moved every frame, which a baked model could not do.
 */
import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial,
  Object3D, PointLight, Shape, ShapeGeometry, Vector3, BoxGeometry,
} from 'three';
import { Builder } from './builder';
import { createPropMaterial } from './props';
import { PALETTE } from './palette';
import type { BoatState } from '../core/boat';
import type { Fx } from './fx';
import { WAKE_N as WATER_WAKE_N, type Water } from './water';

type WaveY = (x: number, z: number) => number;
const C = (h: string) => new Color(h);
/** Track samples kept: enough for the wake's whole life at top speed. */
const WAKE_N = WATER_WAKE_N;
const REST_RING = new Color(0.42, 0.46, 0.45);

/** Hull outline at the gunwale, as [z, half-width] from stern to bow (measured from the skiff model). */
const OUTLINE: [number, number][] = [[-1.86, 0.5], [-1.5, 0.74], [-1.0, 1.0], [-0.5, 1.06], [0, 1.08], [0.5, 1.07], [1.0, 0.92], [1.5, 0.68], [1.86, 0.34]];

/**
 * An invisible lid just under the gunwale that writes depth only. It is drawn after the hull and before the
 * water, so the sea is never seen "inside" the boat even though the floor sits below the waterline.
 */
export function buildHullMask(y = 1.22): Mesh {
  const s = new Shape();
  OUTLINE.forEach(([z, w], i) => (i === 0 ? s.moveTo(w, z) : s.lineTo(w, z)));
  [...OUTLINE].reverse().forEach(([z, w]) => s.lineTo(-w, z));
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(Math.PI / 2); // shape (x, y) → (x, 0, z)
  g.translate(0, y, 0);
  const m = new Mesh(g, new MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: DoubleSide }));
  m.renderOrder = 4;
  m.name = 'hull-mask';
  return m;
}

// ------------------------------------------------------------------ sail

const SAIL_N = 10;
/** Sail corners in the sail's own frame: x = out from the mast along the boom, y = up. A standing lug. */
const SAIL = { tack: [-0.28, 0], clew: [1.75, 0.08], throat: [-0.42, 1.55], peak: [1.45, 2.3] } as const;

class Sail {
  readonly mesh: Mesh;
  private pos: Float32Array;
  private geo = new BufferGeometry();
  constructor() {
    const n = SAIL_N + 1;
    this.pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const em = new Float32Array(n * n);
    const cloth = C(PALETTE.bone), seam = C('#CDB993'), patchA = C(PALETTE.coral), patchB = C('#B7A6C9');
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / SAIL_N, v = j / SAIL_N, k = (j * n + i) * 3;
      // Panels sewn across, two patches, a darker foot where it is furled wet.
      let c = cloth;
      if (j % 3 === 0 && j > 0 && j < SAIL_N) c = seam;
      if (u > 0.5 && u < 0.82 && v > 0.52 && v < 0.78) c = patchA;
      if (u > 0.12 && u < 0.36 && v > 0.16 && v < 0.36) c = patchB;
      const shade = 0.92 + 0.08 * Math.sin(i * 12.9 + j * 78.2);
      col[k] = c.r * shade; col[k + 1] = c.g * shade; col[k + 2] = c.b * shade;
    }
    const idx: number[] = [];
    for (let j = 0; j < SAIL_N; j++) for (let i = 0; i < SAIL_N; i++) {
      const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
      idx.push(a, b, d, a, d, c2);
    }
    const p = new BufferAttribute(this.pos, 3); p.setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', p);
    this.geo.setAttribute('color', new BufferAttribute(col, 3));
    this.geo.setAttribute('emissive', new BufferAttribute(em, 1));
    this.geo.setIndex(idx);
    const mat = createPropMaterial();
    mat.side = DoubleSide; mat.roughness = 0.95;
    this.mesh = new Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.shape(0, 0, 1);
  }

  /** fill 0..1 = how full the sail draws; side ±1 = which way it bellies; t = time for the flutter. */
  shape(fill: number, t: number, side: number) {
    const n = SAIL_N + 1, P = this.pos;
    const { tack, clew, throat, peak } = SAIL;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / SAIL_N, v = j / SAIL_N, k = (j * n + i) * 3;
      const bx = tack[0] + (clew[0] - tack[0]) * u, by = tack[1] + (clew[1] - tack[1]) * u;
      const tx = throat[0] + (peak[0] - throat[0]) * u, ty = throat[1] + (peak[1] - throat[1]) * u;
      const belly = Math.sin(Math.PI * Math.min(1, u * 1.15)) * Math.sin(Math.PI * (0.12 + 0.82 * v));
      // Slack cloth hangs and shivers; a drawing sail holds one clean curve.
      const flutter = (1 - fill) * 0.05 * Math.sin(t * 6.3 + u * 7 + v * 3) * u + fill * 0.012 * Math.sin(t * 11 + v * 9) * u * u;
      P[k] = bx + (tx - bx) * v;
      P[k + 1] = by + (ty - by) * v - (1 - fill) * 0.05 * Math.sin(Math.PI * u) * (1 - v);
      P[k + 2] = side * (0.1 + 0.42 * fill) * belly + flutter;
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

function buildSpars(): BufferGeometry {
  const b = new Builder(41, 0.05);
  const wood = C(PALETTE.driftwood), dark = C('#6E5440'), rope = C('#C9B48E');
  // Mast, stepped through the forward thwart; a brass cap; the yard and the boom lie in the sail's plane.
  b.add(new CylinderGeometry(0.045, 0.065, 3.1, 6), wood, { pos: [0, 1.55, 0] });
  b.add(new CylinderGeometry(0.06, 0.06, 0.1, 6), C(PALETTE.lantern), { pos: [0, 3.13, 0] });
  b.add(new BoxGeometry(0.2, 0.08, 0.2), dark, { pos: [0, 0.06, 0] });
  // Stays to the gunwales.
  for (const sx of [-1, 1]) b.add(new CylinderGeometry(0.012, 0.012, 2.75, 3), rope, { pos: [sx * 0.42, 1.7, -0.25], rot: [0.19, 0, sx * 0.31] });
  return b.build();
}

function buildYardAndBoom(): BufferGeometry {
  const b = new Builder(43, 0.05);
  const wood = C('#9C7A58');
  const { tack, clew, throat, peak } = SAIL;
  const spar = (a: readonly [number, number], c: readonly [number, number], r: number) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], len = Math.hypot(dx, dy) + 0.3;
    b.add(new CylinderGeometry(r, r * 1.15, len, 5), wood, { pos: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0], rot: [0, 0, Math.atan2(dy, dx) - Math.PI / 2] });
  };
  spar(tack, clew, 0.035); spar(throat, peak, 0.03);
  return b.build();
}

// ------------------------------------------------------------------ wake

/**
 * The track the boat leaves. Each sample remembers where the stern was and how hard she was going; the
 * water draws them as foam on its own surface (see water.ts `wakeFoam`), so the wake rides the waves and is
 * never hidden by them. A turn leaves a curved track and a stop lets it melt away.
 */
export class Wake {
  private x = new Float32Array(WAKE_N); private z = new Float32Array(WAKE_N);
  private age = new Float32Array(WAKE_N).fill(99); private power = new Float32Array(WAKE_N);
  private head = 0; private lastX = 0; private lastZ = 0; private started = false; private now = 0;
  static readonly LIFE = 5;
  /** Metres between samples. */
  static readonly STEP = 0.85;

  /** Forget the track (after a teleport). */
  reset() { this.age.fill(99); this.started = false; this.now = 0; }

  /** How wide the wake has spread, to each side, at a given age (0..1) and power. */
  static half(t: number, power: number) { return 0.5 + 3.3 * Math.pow(t, 0.7) * (0.45 + 0.55 * power); }

  update(dt: number, b: BoatState, water: Water | null) {
    // The stern, where the water closes behind the hull.
    const sx = b.x - Math.sin(b.heading) * 1.55, sz = b.z - Math.cos(b.heading) * 1.55;
    if (!this.started) { this.lastX = sx; this.lastZ = sz; this.started = true; }
    const moved = Math.hypot(sx - this.lastX, sz - this.lastZ);
    const speed = Math.abs(b.speed);
    // What she is throwing up right now eases in and out, so the foam at the stern never pops.
    this.now += (Math.min(1, Math.max(0, speed - 0.5) / 4.5) - this.now) * Math.min(1, dt * 4);
    if (moved > Wake.STEP && speed > 0.5) {
      this.head = (this.head + 1) % WAKE_N;
      const i = this.head;
      this.x[i] = sx; this.z[i] = sz; this.age[i] = 0; this.power[i] = this.now;
      this.lastX = sx; this.lastZ = sz;
    } else if (speed <= 0.5) { this.lastX = sx; this.lastZ = sz; }
    for (let i = 0; i < WAKE_N; i++) this.age[i] += dt;
    if (!water) return;
    // Newest first: the stern itself, then the samples behind it for as long as they live.
    const A = water.wakeA, B = water.wakeB;
    A[0].set(sx, sz, Wake.half(0, this.now), 0); B[0].set(0, this.now);
    let n = 1, minX = sx, maxX = sx, minZ = sz, maxZ = sz;
    for (let k = 0; k < WAKE_N && n < WATER_WAKE_N; k++) {
      const i = (this.head - k + WAKE_N) % WAKE_N;
      if (this.age[i] >= Wake.LIFE) break;
      const t = this.age[i] / Wake.LIFE, half = Wake.half(t, this.power[i]);
      A[n].set(this.x[i], this.z[i], half, 0); B[n].set(t, this.power[i]);
      minX = Math.min(minX, this.x[i] - half); maxX = Math.max(maxX, this.x[i] + half);
      minZ = Math.min(minZ, this.z[i] - half); maxZ = Math.max(maxZ, this.z[i] + half);
      n++;
    }
    const live = n > 1 && (this.now > 0.01 || B[1].y > 0);
    const r = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1;
    water.wakeField.set((minX + maxX) / 2, (minZ + maxZ) / 2, r * r, live ? n : 0);
  }
}

// ------------------------------------------------------------------ the rig

export interface RigFrame { time: number; waveY: WaveY; /** 0 (day) .. 1 (night) */ night: number; /** the helm: −1..1 each */ throttle: number; rudder: number; /** the sea the wake is drawn on */ water: Water | null; /** the sail should be down on the boom: she is left, or lies still */ furl: boolean }

export class BoatRig {
  /** World-space group: placed at the boat, turned to its heading, rocked by the waves. */
  readonly root = new Group();
  readonly wake = new Wake();
  /** The sewn-in-code sail, used only when the generated rig is missing. */
  private sail: Sail | null = null;
  /** Whatever swings about the mast: the generated rig, or the stand-in's sail and yard. */
  private sailGroup: Object3D = new Group();
  /** The generated rig's sail: morph target 0 bellies it toward +X (port). */
  private cloth: Mesh | null = null;
  private belly = 0;
  private lamp = new PointLight(C(PALETTE.lantern), 0, 15, 1.6);
  private pitch = 0; private roll = 0; private y = 0;
  private fill = 0; private side = 1; private swing = 0.5; private sideHold = 0;
  private sprayT = 0; private restRing = 0;
  /** Set when the sail swings across; the game plays the flap and clears it. */
  gybed = false;
  /** 0 (sail set) .. 1 (down on the boom). She starts furled: a boat is found at rest. */
  private furl = 1;
  /** Set when the sail starts up or starts down; the game plays the sound and clears it. */
  sailMoved: 'up' | 'down' | null = null;
  private readonly sink: number;
  /** Where a person is aboard, in the hull's own frame [to port, up, forward]: on their feet amidships, and seated at the tiller. */
  private readonly standSpot: readonly [number, number, number];
  private readonly seatSpot: readonly [number, number, number];
  private tiller: Mesh | null = null;

  /**
   * `hull` is the skiff model (or its stand-in mesh); `isModel` says which, for how deep it sits. `sailRig`
   * is the generated mast and sail (origin at the mast foot, sail in its Y-Z plane, boom pointing aft).
   */
  constructor(hull: Object3D, isModel: boolean, sailRig: Object3D | null = null) {
    hull.position.set(0, 0, 0); hull.rotation.set(0, 0, 0);
    this.sink = isModel ? -0.3 : 0.42;
    // The skiff's floorboards are 0.64 m above her keel and her stern thwart 1.10 m. Standing and seated, the
    // player's origin is on the boards; the seated clip perches them on the thwart with the tiller hand 0.26 m
    // to starboard of the origin, on the centre line.
    this.standSpot = isModel ? [0, 0.636, -0.3] : [0, -0.2, -0.3];
    this.seatSpot = isModel ? [0.257, 0.636, -1.1] : [0, -0.2, -0.9];
    if (isModel) {
      const b = new Builder(47, 0.03);
      b.add(new CylinderGeometry(0.02, 0.03, 0.82, 6), C(PALETTE.driftwood), { pos: [0, 0, 0.41], rot: [Math.PI / 2, 0, 0] });
      b.add(new CylinderGeometry(0.04, 0.045, 0.14, 6), C('#6E5440'), { pos: [0, -0.03, 0] });
      this.tiller = new Mesh(b.build(), createPropMaterial());
      this.tiller.position.set(0, 1.26, -1.93);
      this.tiller.castShadow = true;
      this.root.add(this.tiller);
    }
    this.root.add(hull);
    if (isModel && !hull.getObjectByName('hull-mask')) hull.add(buildHullMask());
    if (sailRig) {
      // Stepped on the floor just forward of the middle thwart; the whole rig turns about its mast.
      sailRig.position.set(0, isModel ? 0.66 : 0.1, 0.95);
      sailRig.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.morphTargetInfluences?.length) { this.cloth = m; m.frustumCulled = false; } });
      this.sailGroup = sailRig;
      this.root.add(sailRig);
    } else {
      this.sail = new Sail();
      const spars = new Mesh(buildSpars(), createPropMaterial());
      const yard = new Mesh(buildYardAndBoom(), createPropMaterial());
      for (const m of [spars, yard]) { m.castShadow = true; }
      // The sail's plane runs aft from the mast (its x is the boat's −z) and swings out about the mast.
      const plane = new Group();
      plane.rotation.y = Math.PI / 2;
      plane.add(this.sail.mesh, yard);
      this.sailGroup.add(plane);
      this.sailGroup.position.y = 1.72;
      const rig = new Group();
      rig.position.set(0, isModel ? 0.2 : -0.25, 1.05);
      rig.add(spars, this.sailGroup);
      this.root.add(rig);
    }
    // The stern lantern (the model has the lamp; this is its light).
    this.lamp.position.set(0.25, isModel ? 1.85 : 0.9, -1.75);
    this.root.add(this.lamp);
  }

  /** Called every frame. `fx` gets the bow spray. */
  update(dt: number, b: BoatState, f: RigFrame, fx: Fx, topSpeed: number) {
    const s = Math.sin(b.heading), c = Math.cos(b.heading);
    const at = (fwd: number, port: number) => f.waveY(b.x + s * fwd + c * port, b.z + c * fwd - s * port);
    const bow = at(1.6, 0), stern = at(-1.6, 0), port = at(0, 0.9), stbd = at(0, -0.9);
    const frac = Math.min(1, Math.abs(b.speed) / topSpeed);
    const k = Math.min(1, dt * 7);
    // Rides the waves; lifts her bow with speed; leans into a turn.
    const wantPitch = Math.atan2(bow - stern, 3.2) + 0.05 * frac * Math.sign(b.speed) + 0.012 * Math.sin(f.time * 1.3);
    const wantRoll = Math.atan2(port - stbd, 1.8) - b.yawRate * 0.16 * frac + 0.02 * Math.sin(f.time * 0.9);
    this.pitch += (wantPitch - this.pitch) * k; this.roll += (wantRoll - this.roll) * k;
    this.y += ((bow + stern + port + stbd) / 4 + this.sink + 0.05 * frac - this.y) * Math.min(1, dt * 10);
    this.root.position.set(b.x, this.y, b.z);
    this.root.rotation.set(-this.pitch, b.heading, this.roll, 'YXZ');
    if (this.tiller) this.tiller.rotation.y += (-0.12 * f.rudder - this.tiller.rotation.y) * Math.min(1, dt * 6);

    // Sail: fills as she gathers way; swings to the outside of a sustained turn.
    this.fill += ((b.speed > 0.3 ? Math.min(1, 0.25 + frac) : 0.06) - this.fill) * Math.min(1, dt * 2.2);
    const turning = Math.abs(b.yawRate) > 0.35 ? Math.sign(b.yawRate) : 0;
    this.sideHold = turning !== 0 && turning !== this.side ? this.sideHold + dt : 0;
    if (this.sideHold > 0.9) { this.side = turning; this.sideHold = 0; this.gybed = true; }
    this.swing += (this.side * (0.3 + 0.32 * this.fill) - this.swing) * Math.min(1, dt * 3.5);
    this.sailGroup.rotation.y = this.swing;
    // With the boom out to starboard the cloth bellies to starboard too, away from the wind; slack, it shivers.
    this.belly += (-this.side * (0.1 + 0.9 * this.fill) - this.belly) * Math.min(1, dt * 4);
    // Left alone or lying still, the sail comes down onto the boom (the rig's second morph target), and goes
    // up again as she is sailed. The two targets add, so the belly goes out as the sail comes down.
    const was = this.furl;
    this.furl = Math.min(1, Math.max(0, this.furl + (f.furl ? dt : -dt) / 0.9));
    if (was >= 1 && this.furl < 1) this.sailMoved = 'up'; else if (was <= 0 && this.furl > 0) this.sailMoved = 'down';
    const down = this.furl * this.furl * (3 - 2 * this.furl);
    if (this.cloth) {
      const m = this.cloth.morphTargetInfluences!;
      m[0] = (this.belly + (1 - this.fill) * 0.16 * Math.sin(f.time * 6.3)) * (1 - down);
      if (m.length > 1) m[1] = down;
    }
    this.sail?.shape(this.fill * (1 - down), f.time, -this.side);

    // Close to the wood it lights, so a little goes a long way.
    this.lamp.intensity = 3.6 * Math.max(0, f.night * 1.4 - 0.1);

    // Spray thrown from the bow, more of it the faster she goes; a quiet ring now and then at rest.
    const speed = Math.abs(b.speed);
    if (speed > 2.2) {
      this.sprayT += dt * (6 + 26 * frac);
      while (this.sprayT > 1) {
        this.sprayT -= 1;
        const sideSign = Math.random() < 0.5 ? 1 : -1, fwd = 1.5 + Math.random() * 0.4;
        _p.set(b.x + s * fwd + c * 0.35 * sideSign, bow + 0.15, b.z + c * fwd - s * 0.35 * sideSign);
        const out = (0.8 + Math.random() * 1.6) * sideSign, up = 1.2 + Math.random() * 1.6 * frac;
        _v.set(c * out + s * speed * 0.35, up, -s * out + c * speed * 0.35);
        fx.spray.emit(_p, _v, SPRAY, 0.45 + Math.random() * 0.35, 0.1 + Math.random() * 0.1);
      }
    } else if (speed < 0.3) {
      this.restRing -= dt;
      if (this.restRing <= 0) { this.restRing = 2.4 + Math.random() * 2; fx.ripples.spawn(_p.set(b.x, 0, b.z), 2.7, 2.6, REST_RING); }
    }
    this.wake.update(dt, b, f.water);
  }

  /** A burst of water where the bow struck. */
  splash(b: BoatState, fx: Fx, strength: number, waveY: WaveY) {
    const x = b.x + Math.sin(b.heading) * 1.8, z = b.z + Math.cos(b.heading) * 1.8;
    fx.spray.burst(_p.set(x, waveY(x, z) + 0.1, z), Math.round(10 + 30 * strength), SPRAY, 2 + 3 * strength, 2 + 2 * strength, 0.7, 0.14);
    fx.ripples.spawn(_p, 2.5 + 2 * strength, 1.2);
  }

  /**
   * Where a person is aboard, in world space: `seat` 0 is on their feet amidships (to fish), 1 is seated on
   * the stern thwart with a hand on the tiller.
   */
  personAt(b: BoatState, out: Vector3, seat = 0): Vector3 {
    const a = this.standSpot, t = this.seatSpot;
    const port = a[0] + (t[0] - a[0]) * seat, up = a[1] + (t[1] - a[1]) * seat, fwd = a[2] + (t[2] - a[2]) * seat;
    const s = Math.sin(b.heading), c = Math.cos(b.heading);
    // Pitch lifts and drops whoever is aft of the middle a little; the roll is too small to matter.
    return out.set(b.x + s * fwd + c * port, this.y + up - Math.sin(this.pitch) * fwd, b.z + c * fwd - s * port);
  }
}

const SPRAY = new Color('#E6F6F2');
const _p = new Vector3(), _v = new Vector3();
