/**
 * Tiny procedural modelling kit: add primitives with a palette colour and a transform,
 * get back one merged, flat-shaded, vertex-coloured geometry (one draw call per prop).
 */
import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Xform { pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] | number }

const m = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), s = new Vector3();

export function xformMatrix(x: Xform, out = new Matrix4()): Matrix4 {
  const p = x.pos ?? [0, 0, 0];
  const r = x.rot ?? [0, 0, 0];
  const sc = x.scale ?? 1;
  e.set(r[0], r[1], r[2]);
  q.setFromEuler(e);
  v.set(p[0], p[1], p[2]);
  if (typeof sc === 'number') s.set(sc, sc, sc); else s.set(sc[0], sc[1], sc[2]);
  return out.compose(v, q, s);
}

export class Builder {
  private parts: BufferGeometry[] = [];
  private rnd: () => number;
  constructor(seed = 1, private jitter = 0.05) {
    let t = seed >>> 0;
    this.rnd = () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  random() { return this.rnd(); }

  /** Add a geometry; colour may be a function of the face centroid (local, after transform). */
  add(geo: BufferGeometry, color: Color | string | ((c: Vector3, n: Vector3) => Color), x: Xform = {}, opts: { jitter?: number; emissive?: number } = {}): this {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(xformMatrix(x, m));
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const pos = g.getAttribute('position') as BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const em = new Float32Array(pos.count);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), cen = new Vector3(), n = new Vector3();
    const base = typeof color === 'string' ? new Color(color) : color;
    const jit = opts.jitter ?? this.jitter;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const col = typeof base === 'function' ? base(cen, n) : base;
      const k = 1 + (this.rnd() * 2 - 1) * jit;
      for (let t = 0; t < 3; t++) {
        cols[(i + t) * 3] = col.r * k; cols[(i + t) * 3 + 1] = col.g * k; cols[(i + t) * 3 + 2] = col.b * k;
        em[i + t] = opts.emissive ?? 0;
      }
    }
    g.setAttribute('color', new BufferAttribute(cols, 3));
    g.setAttribute('emissive', new BufferAttribute(em, 1));
    this.parts.push(g);
    return this;
  }

  /** Displace every vertex randomly (shared positions move together so faces stay closed). */
  static wobble(geo: BufferGeometry, amount: number, seed = 1): BufferGeometry {
    const g = geo.clone();
    const pos = g.getAttribute('position') as BufferAttribute;
    const h = (x: number, y: number, z: number) => { const s2 = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453; return s2 - Math.floor(s2) - 0.5; };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setXYZ(i, x + h(x, y, z) * amount, y + h(y, z, x) * amount, z + h(z, x, y) * amount);
    }
    return g;
  }

  build(): BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
