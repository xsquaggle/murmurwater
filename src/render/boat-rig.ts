/**
 * The player's boat in the world: the hull riding the same waves the water draws, a scrap of lug sail that
 * fills with speed, the stern lantern, and the wake it leaves.
 *
 * The mast and sail are procedural (flat-shaded, palette colours, like the dock and the lighthouse); the
 * cloth is moved every frame, which a baked model could not do.
 */
import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial,
  AdditiveBlending, MeshStandardMaterial, Object3D, PointLight, ShaderChunk, Shape, ShapeGeometry, Sprite, SpriteMaterial, Vector3, BoxGeometry,
} from 'three';
import { haloTexture } from './sea-road';
import { Builder } from './builder';
import { buildRowboat, createPropMaterial } from './props';
import { assets } from './assets';
import { PALETTE } from './palette';
import type { BoatState } from '../core/boat';
import type { Fx } from './fx';
import { WAKE_N as WATER_WAKE_N, type Water } from './water';

type WaveY = (x: number, z: number) => number;
const C = (h: string) => new Color(h);
/** Track samples kept: enough for the wake's whole life at top speed. */
const WAKE_N = WATER_WAKE_N;
const REST_RING = new Color(0.42, 0.46, 0.45), _ring = new Color();

/** Hull outline at the gunwale, as [z, half-width] from stern to bow (measured from the skiff model). */
const OUTLINE: [number, number][] = [[-1.86, 0.5], [-1.5, 0.74], [-1.0, 1.0], [-0.5, 1.06], [0, 1.08], [0.5, 1.07], [1.0, 0.92], [1.5, 0.68], [1.86, 0.34]];

/** The most any one lamp may light a sail or its spars by (see where the sloop's cloth is given its own materials). */
const NEAR_LAMP = 1.3;

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
  return asHullMask(new Mesh(g));
}

/** Makes a lid over a hull into its mask: it writes depth and nothing else (a model brings its own lid, `HullMask`). */
export function asHullMask(m: Mesh): Mesh {
  m.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: DoubleSide });
  m.renderOrder = 4;
  m.castShadow = false; m.receiveShadow = false;
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

  update(dt: number, b: BoatState, water: Water | null, stern = 1.55) {
    // The stern, where the water closes behind the hull.
    const sx = b.x - Math.sin(b.heading) * stern, sz = b.z - Math.cos(b.heading) * stern;
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

// ------------------------------------------------------------------ how a boat is fitted

/** A place aboard, in the hull's own frame: [to port, up, forward]. */
export type Spot = readonly [number, number, number];
/** Somewhere a deckhand sits: where, and which way they face (0 is toward the bow, a quarter turn is out to port). */
export interface Berth { at: Spot; yaw: number }

/**
 * Where things go in one boat. A model with named places (docs/briefs/crew-assets.md) is read for them; the
 * skiff, which has none, and the stand-ins are set down by hand.
 */
export interface BoatFit {
  /** How far her origin rides above the water under her (the skiff's is at her keel, the Puffin's on her waterline). */
  sink: number;
  /** The player on their feet to fish, and seated at the tiller: their origin is on the sole. */
  stand: Spot; seat: Spot;
  /** The tiller bar, pivoted at the rudder head, and how far it swings for full helm (radians). */
  tiller: Object3D | null; tillerSwing: number;
  /** The foot of the mast, of the sewn stand-in rig, the stem head (the Fog Lamp's crook stands on it) and the stern lantern's flame. */
  mast: Spot; sewn: Spot; stem: Spot; lantern: Spot;
  /** Berths for the crew, the senior hand's first. */
  crew: Berth[];
  /** Metres from her middle to the stem, to the stern and to her side, at the waterline. */
  bow: number; stern: number; side: number;
  /** A model's lamp panes (`Glass`), turned up after dark. */
  glass: MeshStandardMaterial[];
  /**
   * Where the stern lantern's light is cast from, as an offset from the flame (out from the centre line, up,
   * forward), how bright (1 is the skiff's) and how fast it falls away with distance. The Puffin's lantern hangs a
   * hand's breadth from her furled boom: cast from the flame itself it burns a white patch into the sail's roll
   * and leaves the cockpit dark, so hers is cast from further off and falls away more slowly.
   */
  lampOff: Spot; lampGain: number; lampDecay: number;
}

function skiffFit(isModel: boolean): BoatFit {
  let tiller: Mesh | null = null;
  if (isModel) {
    const b = new Builder(47, 0.03);
    b.add(new CylinderGeometry(0.02, 0.03, 0.82, 6), C(PALETTE.driftwood), { pos: [0, 0, 0.41], rot: [Math.PI / 2, 0, 0] });
    b.add(new CylinderGeometry(0.04, 0.045, 0.14, 6), C('#6E5440'), { pos: [0, -0.03, 0] });
    tiller = new Mesh(b.build(), createPropMaterial());
    tiller.position.set(0, 1.26, -1.93);
    tiller.castShadow = true;
  }
  // The skiff's floorboards are 0.64 m above her keel and her thwarts 1.10 m. Standing and seated, the player's
  // origin is on the boards; the seated clip perches them on the stern thwart with the tiller hand 0.26 m to
  // starboard of the origin, on the centre line. The cat has the starboard half of the middle thwart (its top is
  // 1.09 m above the keel; the oar blades lie on the port half), where her eyes clear the gunwale.
  return {
    sink: isModel ? -0.3 : 0.42,
    stand: isModel ? [0, 0.636, -0.3] : [0, -0.2, -0.3],
    seat: isModel ? [0.257, 0.636, -1.1] : [0, -0.2, -0.9],
    tiller, tillerSwing: -0.12,
    mast: [0, isModel ? 0.66 : 0.1, 0.95], sewn: [0, isModel ? 0.2 : -0.25, 1.05],
    stem: [0, isModel ? 1.6 : 0.55, isModel ? 1.95 : 1.8],
    lantern: [0.25, isModel ? 1.85 : 0.9, -1.75],
    crew: [{ at: isModel ? [-0.56, 1.09, 0.5] : [-0.4, -0.11, 0.3], yaw: -Math.PI / 2 }],
    lampOff: [0, 0, 0], lampGain: 1, lampDecay: 1.6,
    bow: 1.8, stern: 1.55, side: 0.9, glass: [],
  };
}

/** The Puffin before her model is made: the stand-in rowboat let out to her size. */
const PUFFIN_STANDIN: Omit<BoatFit, 'tiller' | 'glass'> = {
  // Her tiller node carries the rudder too. The swing is kept small: the seated keeper's hand stays where the clip
  // put it, and past forty degrees the bar would meet the crab pot on the stern sheets.
  sink: 0.5, stand: [0, -0.2, -0.6], seat: [0.26, -0.2, -1.5], tillerSwing: -0.16,
  mast: [0, -0.2, 0.95], sewn: [0, -0.3, 0.95], stem: [0, 0.15, 2.5], lantern: [0.3, 0.9, -2.3],
  crew: [{ at: [-0.3, -0.12, 1.5], yaw: -Math.PI / 2 }, { at: [0.5, -0.2, -0.2], yaw: Math.PI / 2 }],
  bow: 2.6, stern: 2.45, side: 0.95,
  lampOff: [0.2, -0.3, -0.15], lampGain: 0.34, lampDecay: 1,
};

/** Reads a hull model's named places. `hull` must be untouched: at the origin, facing +Z, not yet in a scene. */
function socketFit(hull: Object3D, like: Omit<BoatFit, 'tiller' | 'glass'>): BoatFit {
  hull.updateMatrixWorld(true);
  const node = (name: string) => hull.getObjectByName(name) ?? null;
  const at = (name: string, or: Spot): Spot => { const n = node(name); if (!n) return or; n.getWorldPosition(_p); return [_p.x, _p.y, _p.z]; };
  const berth = (name: string, or: Berth): Berth => { const n = node(name); if (!n) return or; n.getWorldDirection(_v); return { at: at(name, or.at), yaw: Math.atan2(_v.x, _v.z) }; };
  const glass = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  hull.traverse((o) => {
    const m = o as Mesh, mat = m.material as MeshStandardMaterial;
    if (!m.isMesh || mat?.name !== 'Glass') return;
    if (!glass.has(mat)) glass.set(mat, mat.clone());
    m.material = glass.get(mat)!;
  });
  const mask = node('HullMask') as Mesh | null;
  if (mask?.isMesh) asHullMask(mask);
  return {
    // Her origin is on her waterline, so she is not sunk by hand.
    sink: node('Helm') ? 0 : like.sink,
    stand: at('Stand', like.stand), seat: at('Helm', like.seat),
    tiller: node('Tiller'), tillerSwing: like.tillerSwing,
    mast: at('MastStep', like.mast), sewn: at('MastStep', like.sewn), stem: at('BowStem', like.stem), lantern: at('Lantern', like.lantern),
    crew: like.crew.map((b, i) => berth(`Crew${i + 1}`, b)),
    bow: like.bow, stern: like.stern, side: like.side, glass: [...glass.values()], lampOff: like.lampOff, lampGain: like.lampGain, lampDecay: like.lampDecay,
  };
}

/**
 * Builds a boat for the water: her hull (the model, or a stand-in), how she is fitted, and her sails. `ferry` is
 * the skiff the world already has lying at the landing (Pell's ferry becomes the player's first boat).
 */
export function makeBoatRig(id: string, ferry?: { hull: Object3D; isModel: boolean }): BoatRig {
  const shadows = (o: Object3D) => { o.traverse((m) => { if ((m as Mesh).isMesh && m.name !== 'hull-mask') (m as Mesh).castShadow = true; }); return o; };
  if (id === 'puffin') {
    const model = assets.instance('puffin');
    if (model) return new BoatRig(id, model, socketFit(model, PUFFIN_STANDIN), true, assets.instance('puffinRig'), 1.5);
    const hull = new Mesh(buildRowboat(31), createPropMaterial());
    hull.scale.set(1.05, 1.15, 1.12);
    return new BoatRig(id, shadows(hull), { ...PUFFIN_STANDIN, tiller: null, glass: [] }, false, assets.instance('puffinRig'), 1.5);
  }
  const model = ferry ? (ferry.isModel ? ferry.hull : null) : assets.instance('skiff');
  const hull = model ?? ferry?.hull ?? new Mesh(buildRowboat(), createPropMaterial());
  // Her floor is below the waterline: the mask keeps the sea from showing inside her.
  if (model && !hull.getObjectByName('hull-mask')) hull.add(buildHullMask());
  return new BoatRig(id, shadows(hull), skiffFit(!!model), !!model, assets.instance('sailRig'));
}

// ------------------------------------------------------------------ the rig

export interface RigFrame { time: number; waveY: WaveY; /** 0 (day) .. 1 (night) */ night: number; /** the helm: −1..1 each */ throttle: number; rudder: number; /** the sea the wake is drawn on */ water: Water | null; /** the sail should be down on the boom: she is left, or lies still */ furl: boolean; /** 0..1: how thick the Murmur Fog is round her */ fog?: number }

const morphed = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.morphTargetInfluences?.length) { m.frustumCulled = false; out.push(m); } });
  return out;
};

export class BoatRig {
  /** World-space group: placed at the boat, turned to its heading, rocked by the waves. */
  readonly root = new Group();
  readonly wake = new Wake();
  /** The sewn-in-code sail, used only when the generated rig is missing. */
  private sail: Sail | null = null;
  /** Whatever swings about the mast: the skiff's whole generated rig, a sloop's mainsail on its boom, or the stand-in's sail and yard. */
  private sailGroup: Object3D = new Group();
  private sailRest = 0;
  /** The generated sails that swing: morph target 0 bellies the cloth toward +X (port), 1 furls it. */
  private cloth: Mesh[] = [];
  /** A sloop's jib, on its stay: the same two morph targets, and it does not swing. */
  private jib: Mesh[] = [];
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
  private tillerRest = 0;
  private clothGlow: MeshStandardMaterial[] = [];
  private berths: (Group | undefined)[] = [];
  /** The Fog Lamp on the bow stem, once she carries one: its glass, its light and the glow round it. */
  private fogLamp: Object3D | null = null;
  private fogGlass: MeshStandardMaterial[] = [];
  private fogLight = new PointLight(C('#BFF6FF'), 0, 34, 1.3);
  private fogHalo: Sprite | null = null;
  /** 0 (dead) .. 1 (burning): the Fog Lamp lights itself as the fog closes in. */
  fogLit = 0;
  /** Set when the Fog Lamp lights itself; the game plays the sound and clears it. */
  fogLampLit = false;

  /**
   * `hull` is the boat's model or its stand-in mesh, `fit` where things go in her, `isModel` whether the hull is
   * the made model. `sailRig` is her generated mast and sails (origin at the mast foot, boom pointing aft); without
   * one a lug sail is sewn in code, `sewn` times the skiff's size.
   */
  constructor(readonly boatId: string, hull: Object3D, readonly fit: BoatFit, readonly isModel: boolean, sailRig: Object3D | null = null, sewn = 1) {
    hull.position.set(0, 0, 0); hull.rotation.set(0, 0, 0);
    if (fit.tiller) { this.tillerRest = fit.tiller.rotation.y; if (!fit.tiller.parent) this.root.add(fit.tiller); }
    this.root.add(hull);
    if (sailRig) {
      // Stepped at the mast foot. The skiff's whole rig turns about its mast; a sloop swings her mainsail on its
      // boom (the node `Main`) and carries a jib that stays on its stay (`Jib`).
      sailRig.position.set(...fit.mast);
      const main = sailRig.getObjectByName('Main'), jib = sailRig.getObjectByName('Jib');
      if (main) {
        this.sailGroup = main; this.sailRest = main.rotation.y; this.cloth = morphed(main); if (jib) this.jib = morphed(jib);
        // Sailcloth lets the day through: seen against the sun it glows its own colour instead of going black.
        for (const m of [...this.cloth, ...this.jib]) {
          const mat = (m.material as MeshStandardMaterial).clone();
          mat.emissiveMap = mat.map; mat.emissive = new Color(1, 1, 1); mat.emissiveIntensity = 0;
          // Canvas and oiled spars are matt: a lantern a yard off must not strike a white streak from them.
          mat.roughness = Math.max(mat.roughness, 0.94); mat.metalness = 0;
          // And the furled boom swings to within a hand of the stern lantern, where a point light is many times
          // brighter than in the cockpit it is there to light: on these, no lamp counts for more than `NEAR_LAMP`.
          mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin.replace(
              'getPointLightInfo( pointLight, geometryPosition, directLight );',
              `getPointLightInfo( pointLight, geometryPosition, directLight );
		directLight.color *= min( 1.0, ${NEAR_LAMP.toFixed(2)} / max( max( directLight.color.r, directLight.color.g ), max( directLight.color.b, 0.0001 ) ) );`));
          };
          mat.customProgramCacheKey = () => 'cloth-near-lamp';
          m.material = mat; this.clothGlow.push(mat);
        }
      }
      else { this.sailGroup = sailRig; this.cloth = morphed(sailRig); }
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
      rig.position.set(...fit.sewn);
      rig.scale.setScalar(sewn);
      rig.add(spars, this.sailGroup);
      this.root.add(rig);
    }
    // The stern lantern (the model has the lamp; this is its light).
    // The offset's first number is away from the centre line, whichever side the lantern hangs.
    this.lamp.position.set(fit.lantern[0] + Math.sign(fit.lantern[0] || 1) * fit.lampOff[0], fit.lantern[1] + fit.lampOff[1], fit.lantern[2] + fit.lampOff[2]);
    this.lamp.decay = fit.lampDecay;
    this.root.add(this.lamp);
  }

  /**
   * Somewhere to put the hand who has berth `i`: a group at their place, facing as they sit, that rides with the
   * hull. Null if she has no such berth.
   */
  berth(i: number): Group | null {
    const b = this.fit.crew[i];
    if (!b) return null;
    let g = this.berths[i];
    if (!g) { g = new Group(); g.position.set(...b.at); g.rotation.y = b.yaw; this.root.add(g); this.berths[i] = g; }
    return g;
  }

  get hasFogLamp() { return this.fogLamp !== null; }
  /**
   * Ships the Fog Lamp on the stem head: `model` is the lamp (origin at the foot of its crook, lantern hanging out
   * toward +Z), or null for a stand-in.
   */
  shipFogLamp(model: Object3D | null) {
    if (this.fogLamp) return;
    const lamp = new Group();
    let glassAt = new Vector3(0, 0.66, 0.28);
    if (model) {
      model.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && (m.material as MeshStandardMaterial).name === 'Glass') { m.material = (m.material as MeshStandardMaterial).clone(); this.fogGlass.push(m.material as MeshStandardMaterial); }
      });
      lamp.add(model);
    } else {
      const post = new Mesh(new CylinderGeometry(0.025, 0.035, 0.8, 6), new MeshStandardMaterial({ color: '#3B3A40', roughness: 0.9, flatShading: true }));
      post.position.y = 0.4;
      const glass = new MeshStandardMaterial({ color: '#E8FBFF', emissive: C('#BFF6FF'), roughness: 0.4, flatShading: true });
      const lantern = new Mesh(new BoxGeometry(0.14, 0.2, 0.14), glass);
      lantern.position.set(0, 0.86, 0);
      this.fogGlass.push(glass);
      lamp.add(post, lantern);
      glassAt = new Vector3(0, 0.86, 0);
    }
    lamp.position.set(...this.fit.stem);
    this.fogLight.position.copy(glassAt);
    this.fogHalo = new Sprite(new SpriteMaterial({ map: haloTexture(), color: C('#BFF6FF'), blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 }));
    this.fogHalo.position.copy(glassAt); this.fogHalo.renderOrder = 6;
    lamp.add(this.fogLight, this.fogHalo);
    this.fogLamp = lamp;
    this.root.add(lamp);
  }

  /** Called every frame. `fx` gets the bow spray. */
  update(dt: number, b: BoatState, f: RigFrame, fx: Fx, topSpeed: number) {
    const s = Math.sin(b.heading), c = Math.cos(b.heading), fit = this.fit;
    const at = (fwd: number, port: number) => f.waveY(b.x + s * fwd + c * port, b.z + c * fwd - s * port);
    const fore = fit.bow - 0.2;
    const bow = at(fore, 0), stern = at(-fore, 0), port = at(0, fit.side), stbd = at(0, -fit.side);
    const frac = Math.min(1, Math.abs(b.speed) / topSpeed);
    const k = Math.min(1, dt * 7);
    // Rides the waves; lifts her bow with speed; leans into a turn.
    const wantPitch = Math.atan2(bow - stern, 2 * fore) + 0.05 * frac * Math.sign(b.speed) + 0.012 * Math.sin(f.time * 1.3);
    const wantRoll = Math.atan2(port - stbd, 2 * fit.side) - b.yawRate * 0.16 * frac + 0.02 * Math.sin(f.time * 0.9);
    this.pitch += (wantPitch - this.pitch) * k; this.roll += (wantRoll - this.roll) * k;
    this.y += ((bow + stern + port + stbd) / 4 + fit.sink + 0.05 * frac - this.y) * Math.min(1, dt * 10);
    this.root.position.set(b.x, this.y, b.z);
    this.root.rotation.set(-this.pitch, b.heading, this.roll, 'YXZ');
    if (fit.tiller) fit.tiller.rotation.y += (this.tillerRest + fit.tillerSwing * f.rudder - fit.tiller.rotation.y) * Math.min(1, dt * 6);

    // Sail: fills as she gathers way; swings to the outside of a sustained turn.
    this.fill += ((b.speed > 0.3 ? Math.min(1, 0.25 + frac) : 0.06) - this.fill) * Math.min(1, dt * 2.2);
    const turning = Math.abs(b.yawRate) > 0.35 ? Math.sign(b.yawRate) : 0;
    this.sideHold = turning !== 0 && turning !== this.side ? this.sideHold + dt : 0;
    if (this.sideHold > 0.9) { this.side = turning; this.sideHold = 0; this.gybed = true; }
    this.swing += (this.side * (0.3 + 0.32 * this.fill) - this.swing) * Math.min(1, dt * 3.5);
    // With the boom out to starboard the cloth bellies to starboard too, away from the wind; slack, it shivers.
    this.belly += (-this.side * (0.1 + 0.9 * this.fill) - this.belly) * Math.min(1, dt * 4);
    // Left alone or lying still, the sail comes down onto the boom (the rig's second morph target), and goes
    // up again as she is sailed. The two targets add, so the belly goes out as the sail comes down.
    const was = this.furl;
    this.furl = Math.min(1, Math.max(0, this.furl + (f.furl ? dt : -dt) / 0.9));
    if (was >= 1 && this.furl < 1) this.sailMoved = 'up'; else if (was <= 0 && this.furl > 0) this.sailMoved = 'down';
    const down = this.furl * this.furl * (3 - 2 * this.furl);
    // Furled, the boom lies along her middle, out of the way of whoever stands in the cockpit.
    this.sailGroup.rotation.y = this.sailRest + this.swing * (this.jib.length ? 1 - down : 1);
    const shiver = (1 - this.fill) * 0.16 * Math.sin(f.time * 6.3);
    for (const m of this.cloth) {
      const w = m.morphTargetInfluences!;
      w[0] = (this.belly + shiver) * (1 - down);
      if (w.length > 1) w[1] = down;
    }
    for (const m of this.jib) {
      const w = m.morphTargetInfluences!;
      w[0] = (this.belly * 0.9 + 0.7 * (1 - this.fill) * 0.16 * Math.sin(f.time * 7.1 + 1.3)) * (1 - down);
      if (w.length > 1) w[1] = down;
    }
    this.sail?.shape(this.fill * (1 - down), f.time, -this.side);

    // Close to the wood it lights, so a little goes a long way.
    this.lamp.intensity = 3.6 * fit.lampGain * Math.max(0, f.night * 1.4 - 0.1);
    for (const g of fit.glass) g.emissiveIntensity = 0.2 + 2.6 * f.night;
    for (const m of this.clothGlow) m.emissiveIntensity = 0.3 * (1 - f.night);
    if (this.fogLamp) {
      // The Fog Lamp lights itself as the fog thickens, and burns low on a clear night.
      const fog = Math.min(1, Math.max(0, ((f.fog ?? 0) - 0.04) / 0.2)), want = Math.max(fog * fog * (3 - 2 * fog), 0.3 * f.night);
      const was = this.fogLit;
      this.fogLit += (want - this.fogLit) * Math.min(1, dt * (want > this.fogLit ? 2.5 : 0.8));
      if (was <= 0.5 && this.fogLit > 0.5) this.fogLampLit = true;
      const flick = 0.93 + 0.07 * Math.sin(f.time * 7.3) * Math.sin(f.time * 2.9), lit = this.fogLit * flick;
      for (const g of this.fogGlass) { g.emissiveIntensity = 0.05 + 3.2 * lit; g.color.setScalar(0.25 + 0.75 * this.fogLit); }
      this.fogLight.intensity = 9 * lit;
      if (this.fogHalo) { (this.fogHalo.material as SpriteMaterial).opacity = 0.85 * lit; this.fogHalo.scale.setScalar(1.2 + 2.6 * lit); }
    }

    // Spray thrown from the bow, more of it the faster she goes; a quiet ring now and then at rest.
    const speed = Math.abs(b.speed);
    if (speed > 2.2) {
      this.sprayT += dt * (6 + 26 * frac);
      while (this.sprayT > 1) {
        this.sprayT -= 1;
        const sideSign = Math.random() < 0.5 ? 1 : -1, fwd = fit.bow - 0.3 + Math.random() * 0.4;
        _p.set(b.x + s * fwd + c * 0.35 * sideSign, bow + 0.15, b.z + c * fwd - s * 0.35 * sideSign);
        const out = (0.8 + Math.random() * 1.6) * sideSign, up = 1.2 + Math.random() * 1.6 * frac;
        _v.set(c * out + s * speed * 0.35, up, -s * out + c * speed * 0.35);
        fx.spray.emit(_p, _v, SPRAY, 0.45 + Math.random() * 0.35, 0.1 + Math.random() * 0.1);
      }
    } else if (speed < 0.3) {
      this.restRing -= dt;
      if (this.restRing <= 0) { this.restRing = 2.4 + Math.random() * 2; fx.ripples.spawn(_p.set(b.x, 0, b.z), fit.bow + 0.9, 2.6, _ring.copy(REST_RING).multiplyScalar(1 - 0.7 * f.night), (fit.side + 0.9) / (fit.bow + 0.9), b.heading); }
    }
    this.wake.update(dt, b, f.water, fit.stern);
  }

  /** A burst of water where the bow struck. */
  splash(b: BoatState, fx: Fx, strength: number, waveY: WaveY) {
    const x = b.x + Math.sin(b.heading) * this.fit.bow, z = b.z + Math.cos(b.heading) * this.fit.bow;
    fx.spray.burst(_p.set(x, waveY(x, z) + 0.1, z), Math.round(10 + 30 * strength), SPRAY, 2 + 3 * strength, 2 + 2 * strength, 0.7, 0.14);
    fx.ripples.spawn(_p, 2.5 + 2 * strength, 1.2);
  }

  /**
   * Where a person is aboard, in world space: `seat` 0 is on their feet in the cockpit (to fish), 1 is seated
   * with a hand on the tiller.
   */
  personAt(b: BoatState, out: Vector3, seat = 0): Vector3 {
    const a = this.fit.stand, t = this.fit.seat;
    const port = a[0] + (t[0] - a[0]) * seat, up = a[1] + (t[1] - a[1]) * seat, fwd = a[2] + (t[2] - a[2]) * seat;
    const s = Math.sin(b.heading), c = Math.cos(b.heading);
    // Pitch lifts and drops whoever is aft of the middle a little; the roll is too small to matter.
    return out.set(b.x + s * fwd + c * port, this.y + up - Math.sin(this.pitch) * fwd, b.z + c * fwd - s * port);
  }

  /** A place aboard in world space (a berth, the lantern), for sounds and splashes beside it. */
  worldOf(at: Spot, out: Vector3): Vector3 {
    this.root.updateMatrixWorld();
    return out.set(at[0], at[1], at[2]).applyMatrix4(this.root.matrixWorld);
  }
}

const SPRAY = new Color('#E6F6F2');
const _p = new Vector3(), _v = new Vector3();
