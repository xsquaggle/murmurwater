/**
 * What a storm looks like in a region that has them (core/weather.ts): rain driven across the camera, bolts of
 * lightning going into the sea with a flash, the licks of pale fire that stand round struck water (the water's
 * own shader draws the ring on the surface), and in the eye of a storm shafts of gold light coming down through
 * the cloud onto the swell.
 *
 * Nothing here decides anything: the game says where a bolt goes in and which water is struck, and this draws it.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, LineSegments,
  Mesh, MeshBasicMaterial, PerspectiveCamera, PointLight, Points, PointsMaterial, SRGBColorSpace, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { STRUCK, type Weather } from '../core/weather';
import type { Lighting } from './daycycle';

/** How many struck waters can be drawn at once (the water shader has as many places for them): as many as there can be. */
export const STRUCK_N = STRUCK.most;
/** The radius of the ring of struck water as drawn, m (the rule's own radius is STRUCK.radius). */
export const STRUCK_RING = 6.4;
const LICKS = 12;
const RAIN_BOX = 64, RAIN_HIGH = 34, RAIN_FALL = 24, RAIN_WIND = 7;
const BOLT_LIFE = 0.42;
const RAIN_BY_DAY = new Color('#B8C6D2'), RAIN_BY_NIGHT = new Color('#2E3746');

/** A struck water as the scene draws it: where, and how lit it still is (0..1). */
export interface StruckDraw { x: number; z: number; strength: number; seed: number }

const hash = (a: number, b: number, s = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

/** How big a lick is drawn (a point's size; about 0.52 of it is its height in metres), and how far its middle stands over the water. */
const LICK_SIZE = 4.4, LICK_UP = 1.0;

/** A flame for the licks: white at its foot, blue up its length, drawn to a point; narrow, in a square. */
function flameTexture(): CanvasTexture {
  const n = 128;
  const hard = document.createElement('canvas'); hard.width = hard.height = n;
  const g = hard.getContext('2d')!;
  g.beginPath(); g.moveTo(64, 6); g.bezierCurveTo(70, 52, 90, 88, 64, 122); g.bezierCurveTo(38, 88, 58, 52, 64, 6); g.closePath(); g.clip();
  const grad = g.createRadialGradient(64, 104, 2, 64, 92, 92);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.2, 'rgba(200,232,255,1)');
  grad.addColorStop(0.55, 'rgba(120,180,255,.8)'); grad.addColorStop(1, 'rgba(110,130,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, n, n);
  // Softened, so the edge of it does not show as a cut.
  const c = document.createElement('canvas'); c.width = c.height = n;
  const s = c.getContext('2d')!;
  s.filter = 'blur(2.5px)'; s.drawImage(hard, 0, 0);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

export class StormFx {
  readonly root = new Group();
  /** Lit water for the water's shader: (x, z, strength, seed) for each place. */
  readonly struck = Array.from({ length: STRUCK_N }, () => new Vector4());
  /** 0..1: how bright the last flash still is (the scene lights everything by it). */
  flash = 0;
  private flashT = 9;
  private flashAmp = 0;
  private rain: LineSegments;
  private rainMat: ShaderMaterial;
  private bolts: { mesh: Mesh; t: number }[] = [];
  private boltMat = new MeshBasicMaterial({ color: new Color(2.4, 2.6, 3.2), transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  private boltLight = new PointLight(new Color('#CFE0FF'), 0, 520, 1.2);
  private shafts: Mesh[] = [];
  private shaftMat: ShaderMaterial;
  private licks: Points;
  private lickPos = new Float32Array(STRUCK_N * LICKS * 3);
  private lickCol = new Float32Array(STRUCK_N * LICKS * 4);
  private time = 0;

  constructor(quality: 'low' | 'medium' | 'high' | 'ultra') {
    // ---- rain: short streaks in a box that goes with the camera, each falling through it again and again
    const n = quality === 'low' ? 1400 : quality === 'medium' ? 2600 : 4000;
    const seeds = new Float32Array(n * 2 * 4);
    for (let i = 0; i < n; i++) for (let e = 0; e < 2; e++) {
      const o = (i * 2 + e) * 4;
      seeds[o] = hash(i, 1, 7); seeds[o + 1] = hash(i, 2, 7); seeds[o + 2] = hash(i, 3, 7); seeds[o + 3] = e;
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(new Float32Array(n * 2 * 3), 3));
    rg.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    this.rainMat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new Vector3() }, uRain: { value: 0 }, uColor: { value: new Color('#B8C6D2') } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime; uniform vec3 uCam;
        varying float vFade;
        void main() {
          vec3 box = vec3(${RAIN_BOX.toFixed(1)}, ${RAIN_HIGH.toFixed(1)}, ${RAIN_BOX.toFixed(1)});
          vec3 vel = vec3(${RAIN_WIND.toFixed(1)}, -${RAIN_FALL.toFixed(1)}, 2.0);
          // Each drop falls at its own pace, a little, so the sheet does not move as one.
          vec3 p = aSeed.xyz * box + vel * uTime * (0.85 + 0.3 * aSeed.y);
          p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
          p -= vel * 0.032 * aSeed.w;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = length(mv.xyz);
          vFade = smoothstep(1.2, 4.0, d) * (1.0 - smoothstep(20.0, 31.0, d));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uRain; uniform vec3 uColor;
        varying float vFade;
        void main() { gl_FragColor = vec4(uColor, 0.42 * uRain * vFade); }`,
    });
    this.rain = new LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false; this.rain.renderOrder = 9; this.rain.visible = false;
    this.root.add(this.rain);

    // ---- the flash of a bolt, where it went in
    this.root.add(this.boltLight);

    // ---- shafts of gold light in the eye
    this.shaftMat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
      uniforms: { uColor: { value: new Color('#FFD9A0') }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vSeed;
        void main() {
          vAlong = uv.y;
          vSeed = modelMatrix[3].x * 0.013 + modelMatrix[3].z * 0.007;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalMatrix * normal; vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
        varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vSeed;
        void main() {
          float rim = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
          // Brightest low down where it lights the swell, gone into the cloud above; it breathes slowly.
          float along = smoothstep(0.0, 0.06, vAlong) * (1.0 - smoothstep(0.45, 1.0, vAlong));
          float breathe = 0.75 + 0.25 * sin(uTime * 0.35 + vSeed * 40.0);
          gl_FragColor = vec4(uColor, uOpacity * rim * along * breathe);
        }`,
    });
    const shaftGeo = new CylinderGeometry(9, 13, 190, 16, 1, true);
    shaftGeo.translate(0, 95, 0);
    for (let i = 0; i < 7; i++) { const m = new Mesh(shaftGeo, this.shaftMat); m.renderOrder = 7; m.visible = false; m.frustumCulled = false; this.shafts.push(m); this.root.add(m); }

    // ---- the licks of pale fire round struck water
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(this.lickPos, 3).setUsage(DynamicDrawUsage));
    lg.setAttribute('color', new BufferAttribute(this.lickCol, 4).setUsage(DynamicDrawUsage));
    this.licks = new Points(lg, new PointsMaterial({ map: flameTexture(), size: LICK_SIZE, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    this.licks.frustumCulled = false; this.licks.renderOrder = 8;
    this.root.add(this.licks);
  }

  /** A bolt goes into the sea at (x, z), whose surface is at `y`. `near` 0..1: how close to the keeper (the flash is brighter). */
  bolt(x: number, y: number, z: number, near = 1) {
    // A jagged path down from the cloud, wandering less as it nears the water, and a fork or two off it.
    const top = new Vector3(x + (hash(x, z, 1) - 0.5) * 40, 150, z + (hash(z, x, 2) - 0.5) * 40), foot = new Vector3(x, y, z);
    const path = (from: Vector3, to: Vector3, steps: number, wander: number, seed: number): Vector3[] => {
      const pts = [from.clone()];
      for (let i = 1; i < steps; i++) {
        const t = i / steps, p = from.clone().lerp(to, t), w = wander * (1 - t * 0.7);
        p.x += (hash(i, seed, 3) - 0.5) * w; p.z += (hash(i, seed, 4) - 0.5) * w; p.y += (hash(i, seed, 5) - 0.5) * w * 0.3;
        pts.push(p);
      }
      pts.push(to.clone());
      return pts;
    };
    const main = path(top, foot, 16, 18, x * 0.1 + z);
    const strands: [Vector3[], number][] = [[main, 1.1]];
    for (const k of [5, 9]) {
      const from = main[k], end = from.clone().add(new Vector3((hash(k, x, 6) - 0.5) * 50, -(25 + hash(k, z, 7) * 30), (hash(k, z, 8) - 0.5) * 50));
      strands.push([path(from, end, 6, 10, k + x), 0.5]);
    }
    // Two crossed ribbons for every length, so the bolt has width from any side.
    const pos: number[] = [];
    for (const [pts, w] of strands) for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const [ox, oz] of [[w, 0], [0, w]]) {
        pos.push(a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz, b.x + ox, b.y, b.z + oz, a.x - ox, a.y, a.z - oz, b.x + ox, b.y, b.z + oz, b.x - ox, b.y, b.z - oz);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    const mesh = new Mesh(g, this.boltMat);
    mesh.frustumCulled = false; mesh.renderOrder = 9;
    this.root.add(mesh);
    this.bolts.push({ mesh, t: 0 });
    this.boltLight.position.set(x, y + 25, z);
    this.flashT = 0; this.flashAmp = 0.45 + 0.55 * near;
  }

  /** Every frame, with the weather, the light as the clock and the region have it, and the sea's surface. */
  update(dt: number, camera: PerspectiveCamera, focus: Vector3, w: Weather, lt: Lighting, struck: readonly StruckDraw[], waveY: (x: number, z: number) => number) {
    this.time += dt;
    const t = this.time;
    // Rain.
    this.rain.visible = w.rain > 0.01;
    if (this.rain.visible) {
      const u = this.rainMat.uniforms;
      u.uTime.value = t; (u.uCam.value as Vector3).copy(camera.position); u.uRain.value = Math.min(1, w.rain * 1.15);
      (u.uColor.value as Color).copy(RAIN_BY_DAY).lerp(RAIN_BY_NIGHT, lt.night * 0.75);
    }
    // Bolts: a flicker, a second stroke down the same path, then gone.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt;
      const k = b.t < 0.07 ? 1 : b.t < 0.12 ? 0.15 : b.t < 0.2 ? 0.85 : Math.max(0, 1 - (b.t - 0.2) / (BOLT_LIFE - 0.2));
      b.mesh.visible = k > 0.02;
      if (b.t > BOLT_LIFE) { this.root.remove(b.mesh); b.mesh.geometry.dispose(); this.bolts.splice(i, 1); }
    }
    this.boltMat.opacity = this.bolts.length ? 1 : 0;
    this.flashT += dt;
    const ft = this.flashT, flick = ft < 0.07 ? 1 : ft < 0.12 ? 0.25 : ft < 0.2 ? 0.8 : Math.exp(-(ft - 0.2) * 9);
    this.flash = ft > 1.2 ? 0 : this.flashAmp * flick;
    this.boltLight.intensity = 9000 * this.flash;

    // Gold shafts in the eye, by day: fixed to the sea in a loose grid round the keeper.
    const gold = w.eye * (1 - lt.night) * Math.min(1, lt.keyDir.y * 4 + 0.2);
    const cell = 170, ci = Math.floor(focus.x / cell), cj = Math.floor(focus.z / cell);
    let k = 0;
    for (let j = -1; j <= 1 && k < this.shafts.length; j++) for (let i = -1; i <= 1 && k < this.shafts.length; i++) {
      if (hash(ci + i, cj + j, 21) < 0.3) continue;
      const m = this.shafts[k++];
      const x = (ci + i + 0.15 + 0.7 * hash(ci + i, cj + j, 22)) * cell, z = (cj + j + 0.15 + 0.7 * hash(ci + i, cj + j, 23)) * cell;
      m.position.set(x, -2, z);
      // Leaning down from the sun.
      m.rotation.set(Math.atan2(lt.keyDir.z, lt.keyDir.y) * 0.6, 0, -Math.atan2(lt.keyDir.x, lt.keyDir.y) * 0.6);
      m.scale.setScalar(0.8 + 0.5 * hash(ci + i, cj + j, 24));
      m.visible = gold > 0.01;
    }
    for (; k < this.shafts.length; k++) this.shafts[k].visible = false;
    this.shaftMat.uniforms.uOpacity.value = 0.2 * gold;
    this.shaftMat.uniforms.uTime.value = t;

    // Struck water: the water shader draws the ring; the licks stand up round it and flicker.
    for (let r = 0; r < STRUCK_N; r++) {
      const s = struck[r], v = this.struck[r];
      if (s) v.set(s.x, s.z, s.strength, s.seed); else v.set(0, 0, 0, 0);
      for (let i = 0; i < LICKS; i++) {
        const o = (r * LICKS + i) * 3, c = (r * LICKS + i) * 4;
        if (!s || s.strength < 0.01) { this.lickCol[c + 3] = 0; continue; }
        // Each stands over one of the twelve bright places the water's shader draws on the ring.
        const a = (i / LICKS) * Math.PI * 2 + (Math.PI / 2 - s.seed) / LICKS;
        const x = s.x + Math.cos(a) * STRUCK_RING, z = s.z + Math.sin(a) * STRUCK_RING;
        const f = 0.55 + 0.45 * Math.sin(t * (5.3 + hash(i, r, 31) * 3) + i * 1.7) * Math.sin(t * 2.1 + i);
        this.lickPos[o] = x; this.lickPos[o + 1] = waveY(x, z) + LICK_UP + 0.22 * f; this.lickPos[o + 2] = z;
        // Brighter than white, so the bloom takes it; it dies down as the water does.
        this.lickCol[c] = this.lickCol[c + 1] = this.lickCol[c + 2] = 1.3;
        this.lickCol[c + 3] = Math.min(1, s.strength * 1.4) * (0.5 + 0.5 * f);
      }
    }
    this.licks.geometry.attributes.position.needsUpdate = true; this.licks.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    for (const b of this.bolts) b.mesh.geometry.dispose();
    this.bolts.length = 0;
  }
}
