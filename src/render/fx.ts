/**
 * Lightweight effects: soft particles (splashes, spray, sparkles) and expanding ripple rings.
 * One draw call each, fixed-size pools, no per-frame allocation.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, NormalBlending, Points, RingGeometry,
  ShaderMaterial, Vector3, InstancedMesh, Object3D, MeshBasicMaterial, DoubleSide, Group,
} from 'three';

const MAX_P = 1500;

export class Particles {
  readonly points: Points;
  private pos = new Float32Array(MAX_P * 3);
  private vel = new Float32Array(MAX_P * 3);
  private col = new Float32Array(MAX_P * 3);
  private life = new Float32Array(MAX_P);
  private maxLife = new Float32Array(MAX_P);
  private size = new Float32Array(MAX_P);
  private alpha = new Float32Array(MAX_P);
  private grav = new Float32Array(MAX_P);
  private next = 0;
  private geo: BufferGeometry;

  constructor(additive = false) {
    this.geo = new BufferGeometry();
    const mk = (a: Float32Array, n: number) => { const b = new BufferAttribute(a, n); b.setUsage(DynamicDrawUsage); return b; };
    this.geo.setAttribute('position', mk(this.pos, 3));
    this.geo.setAttribute('color', mk(this.col, 3));
    this.geo.setAttribute('size', mk(this.size, 1));
    this.geo.setAttribute('alpha', mk(this.alpha, 1));
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending,
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 420.0 / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.2, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.points = new Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  emit(p: Vector3, v: Vector3, color: Color, life: number, size: number, gravity = 9.8) {
    const i = this.next; this.next = (this.next + 1) % MAX_P;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = gravity;
  }

  private tmpV = new Vector3();
  /** Radial burst, e.g. a splash. */
  burst(at: Vector3, count: number, color: Color, speed: number, up: number, life = 0.8, size = 0.14, gravity = 9.8) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random();
      this.tmpV.set(Math.cos(a) * speed * r, up * (0.6 + Math.random() * 0.6), Math.sin(a) * speed * r);
      this.emit(at, this.tmpV, color, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), gravity);
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_P; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5) * 0.9;
    }
    for (const n of ['position', 'alpha'] as const) (this.geo.getAttribute(n) as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('color') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('size') as BufferAttribute).needsUpdate = true;
  }
}

const MAX_R = 48;
export class Ripples {
  readonly mesh: InstancedMesh;
  private t = new Float32Array(MAX_R).fill(-1);
  private dur = new Float32Array(MAX_R);
  private scale = new Float32Array(MAX_R);
  private p: Vector3[] = Array.from({ length: MAX_R }, () => new Vector3());
  private next = 0;
  private dummy = new Object3D();
  private c = new Color();
  private mat: MeshBasicMaterial;
  constructor() {
    const g = new RingGeometry(0.82, 1, 40, 1);
    g.rotateX(-Math.PI / 2);
    this.mat = new MeshBasicMaterial({ color: new Color('#E8FFF4'), transparent: true, opacity: 0.4, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    this.mesh = new InstancedMesh(g, this.mat, MAX_R);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.count = MAX_R;
    for (let i = 0; i < MAX_R; i++) { this.dummy.scale.setScalar(0.0001); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); }
    this.mesh.instanceColor = new BufferAttribute(new Float32Array(MAX_R * 3).fill(1), 3) as any;
  }
  spawn(at: Vector3, size = 1.5, duration = 1.2) {
    const i = this.next; this.next = (this.next + 1) % MAX_R;
    this.p[i].copy(at); this.t[i] = 0; this.dur[i] = duration; this.scale[i] = size;
  }
  update(dt: number, waterY: (x: number, z: number) => number) {
    for (let i = 0; i < MAX_R; i++) {
      if (this.t[i] < 0) continue;
      this.t[i] += dt;
      const k = this.t[i] / this.dur[i];
      if (k >= 1) { this.t[i] = -1; this.dummy.scale.setScalar(0.0001); }
      else {
        const s = 0.2 + this.scale[i] * (1 - Math.pow(1 - k, 2.2));
        this.dummy.position.set(this.p[i].x, waterY(this.p[i].x, this.p[i].z) + 0.04, this.p[i].z);
        this.dummy.scale.set(s, 1, s);
        const fade = 1 - k;
        this.mesh.setColorAt(i, this.c.setRGB(fade, fade, fade));
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Fx {
  readonly group = new Group();
  readonly spray = new Particles(false);
  readonly glow = new Particles(true);
  readonly ripples = new Ripples();
  constructor() { this.group.add(this.spray.points, this.glow.points, this.ripples.mesh); }
  update(dt: number, waterY: (x: number, z: number) => number) { this.spray.update(dt); this.glow.update(dt); this.ripples.update(dt, waterY); }
}

