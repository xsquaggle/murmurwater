/**
 * The lights of a sea-road: two staggered lines of iron spars standing out of the sea through the Murmur Fog,
 * each with a caged lamp. They are dead until a boat that carries the Fog Lamp comes near; then they light
 * one after another ahead of her and go out again behind.
 *
 * Both regions a road joins build the same lights in the same places, so nothing moves when the game changes
 * region half way along it.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DynamicDrawUsage, Euler, Group, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, OctahedronGeometry, Points, PointsMaterial, Quaternion, Vector3,
} from 'three';
import { assets } from './assets';
import { roadLights, type RoadDef } from '../core/content';

/** A light is fully lit within NEAR metres of the lamp and dark beyond FAR. */
const NEAR = 85, FAR = 185;
const CYAN = new Color('#7FF0E0');

interface Post { x: number; z: number; yaw: number; ph: number; lit: number; told: boolean }

/** A soft round glow, for lights that must show through fog. */
export function haloTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.18, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/**
 * Makes a `Glass` material answer to its instance colour: the green channel runs from 0.25 (a dead pane, dull
 * under daylight) to 1 (lit), and the glow follows it.
 */
function litByInstance(src: MeshStandardMaterial): MeshStandardMaterial {
  const m = src.clone();
  m.emissiveIntensity = 1;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 3.2 * smoothstep(0.25, 1.0, vColor.g);');
  };
  m.customProgramCacheKey = () => 'sea-road-glass';
  return m;
}

export class SeaRoadLights {
  readonly root = new Group();
  private posts: Post[] = [];
  private body: InstancedMesh;
  private glass: InstancedMesh;
  private halo: Points;
  private haloPos: Float32Array;
  private haloCol: Float32Array;
  /** Where the middle of the lamp's glass is, in the model's own frame. */
  private readonly lampAt: Vector3;
  /** Set to the index of a light when it comes alight; the game plays its note and clears this. */
  lit: number | null = null;

  /** `depth(x, z)`: the height of the sea bed; a light is left out where its spar would stand in the ground. */
  constructor(roads: RoadDef[], depth: (x: number, z: number) => number) {
    // Where they stand is the rules' business (core/content.ts roadLights): somebody waits by one of them.
    for (const r of roads) for (const { i, x, z } of roadLights(r)) {
      if (depth(x, z) > -2.4) continue;
      this.posts.push({ x, z, yaw: ((i * 2.399963) % (Math.PI * 2)), ph: i * 1.618, lit: 0, told: false });
    }
    const n = this.posts.length;
    const model = assets.instance('seaRoadLight');
    let bodyMesh: Mesh | null = null, glassMesh: Mesh | null = null;
    model?.traverse((o) => { const m = o as Mesh; if (m.isMesh) { if ((m.material as MeshStandardMaterial).name === 'Glass') glassMesh = m; else bodyMesh = m; } });
    if (bodyMesh && glassMesh) {
      this.body = new InstancedMesh((bodyMesh as Mesh).geometry, (bodyMesh as Mesh).material as MeshStandardMaterial, n);
      this.glass = new InstancedMesh((glassMesh as Mesh).geometry, litByInstance((glassMesh as Mesh).material as MeshStandardMaterial), n);
      this.lampAt = new Vector3(0.19, 2.73, 0);
    } else {
      // Stand-in: a bare spar and a lump of glass.
      const spar = new CylinderGeometry(0.07, 0.1, 5, 6); spar.translate(0, 0.5, 0);
      const lamp = new OctahedronGeometry(0.24); lamp.translate(0, 2.9, 0);
      this.body = new InstancedMesh(spar, new MeshStandardMaterial({ color: '#3B3A40', roughness: 0.9, flatShading: true }), n);
      this.glass = new InstancedMesh(lamp, litByInstance(new MeshStandardMaterial({ color: '#CFF7F0', emissive: CYAN, roughness: 0.4, flatShading: true })), n);
      this.lampAt = new Vector3(0, 2.9, 0);
    }
    for (const m of [this.body, this.glass]) { m.instanceMatrix.setUsage(DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; }
    const dead = new Color(0.25, 0.25, 0.25);
    for (let i = 0; i < n; i++) this.glass.setColorAt(i, dead);
    this.glass.instanceColor?.setUsage(DynamicDrawUsage);

    this.haloPos = new Float32Array(n * 3); this.haloCol = new Float32Array(n * 3);
    const hg = new BufferGeometry();
    hg.setAttribute('position', new BufferAttribute(this.haloPos, 3).setUsage(DynamicDrawUsage));
    hg.setAttribute('color', new BufferAttribute(this.haloCol, 3).setUsage(DynamicDrawUsage));
    this.halo = new Points(hg, new PointsMaterial({ map: haloTexture(), size: 9, sizeAttenuation: true, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
    this.halo.frustumCulled = false; this.halo.renderOrder = 6;
    this.root.add(this.body, this.glass, this.halo);
    this.place(0, () => 0);
  }

  /** Takes over how lit each light was from the lights of the region just left, so none blinks at the change. */
  carryFrom(old: SeaRoadLights) {
    for (const p of this.posts) {
      const o = old.posts.find((q) => Math.abs(q.x - p.x) < 0.1 && Math.abs(q.z - p.z) < 0.1);
      if (o) { p.lit = o.lit; p.told = o.told; }
    }
  }

  get count() { return this.posts.length; }
  /** How many lights are alight now (for the bots). */
  get alight() { return this.posts.filter((p) => p.lit > 0.5).length; }
  /** Where a light stands. */
  at(i: number): { x: number; z: number } { return this.posts[i]; }

  /**
   * Every frame. `lamp` is where the boat with the Fog Lamp is (null when there is none: every light stays
   * dead). `waveY` is the height of the sea.
   */
  update(dt: number, time: number, lamp: { x: number; z: number } | null, waveY: (x: number, z: number) => number) {
    for (let i = 0; i < this.posts.length; i++) {
      const p = this.posts[i];
      let want = 0;
      if (lamp) { const d = Math.hypot(p.x - lamp.x, p.z - lamp.z), t = Math.min(1, Math.max(0, (FAR - d) / (FAR - NEAR))); want = t * t * (3 - 2 * t); }
      p.lit += (want - p.lit) * Math.min(1, dt * (want > p.lit ? 2.2 : 0.7));
      if (p.lit > 0.5 && !p.told) { p.told = true; this.lit = i; } else if (p.lit < 0.08) p.told = false;
    }
    this.place(time, waveY);
  }

  private place(time: number, waveY: (x: number, z: number) => number) {
    for (let i = 0; i < this.posts.length; i++) {
      const p = this.posts[i];
      // A spar buoy: it rides a little of each wave and nods slowly.
      const y = waveY(p.x, p.z) * 0.55;
      _e.set(0.035 * Math.sin(time * 0.7 + p.ph), p.yaw, 0.035 * Math.sin(time * 0.53 + p.ph * 1.7));
      _q.setFromEuler(_e);
      _m.compose(_v.set(p.x, y, p.z), _q, _one);
      this.body.setMatrixAt(i, _m); this.glass.setMatrixAt(i, _m);
      const flick = 0.9 + 0.1 * Math.sin(time * 3.1 + p.ph * 5);
      const k = 0.25 + 0.75 * p.lit * flick;
      this.glass.setColorAt(i, _c.setRGB(k, k, k));
      _v.copy(this.lampAt).applyMatrix4(_m);
      this.haloPos[i * 3] = _v.x; this.haloPos[i * 3 + 1] = _v.y; this.haloPos[i * 3 + 2] = _v.z;
      const h = p.lit * p.lit * flick * 0.9;
      this.haloCol[i * 3] = CYAN.r * h; this.haloCol[i * 3 + 1] = CYAN.g * h; this.haloCol[i * 3 + 2] = CYAN.b * h;
    }
    this.body.instanceMatrix.needsUpdate = true; this.glass.instanceMatrix.needsUpdate = true;
    if (this.glass.instanceColor) this.glass.instanceColor.needsUpdate = true;
    this.halo.geometry.attributes.position.needsUpdate = true; this.halo.geometry.attributes.color.needsUpdate = true;
  }
}

const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _one = new Vector3(1, 1, 1), _c = new Color(), _e = new Euler();
