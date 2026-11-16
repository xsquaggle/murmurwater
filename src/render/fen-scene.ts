/**
 * What grows in Mossglass Fen: reed beds on every shoal, the drowned trees of the grove with moss that is lit
 * after dark, lilies on the still water, and the small lights that drift over the reeds at night.
 *
 * Reeds come at two scales. Everywhere there is a bed stand chunky sheaves, placed once (one draw call). Round
 * the player, finer clumps are dealt out from a pool as they move, so the beds have blades to look at up close
 * without the whole fen paying for them.
 *
 * Models (`props/reeds-a`, `lantern-tree-a` …) are used when they are in the library; until then each thing
 * is built here from a few plain shapes.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, Material, Matrix4, Mesh, MeshStandardMaterial, Points, PointsMaterial, Quaternion, Vector3,
} from 'three';
import { assets } from './assets';
import { haloTexture } from './sea-road';
import type { TreeSpot } from '../core/flora';

type HeightAt = (x: number, z: number) => number;
const hash = (a: number, b: number, seed = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** A bed of reeds stands where the ground is within this band of the water's surface. */
const BED_LOW = -0.55, BED_HIGH = 0.12;
/** Sheaves: one per cell of this many metres, on every bed. */
const SHEAF_CELL = 4.2;
/** Clumps: dealt out within this many metres of the player, one per cell. */
const CLUMP_RANGE = 58, CLUMP_CELL = 1.9, CLUMP_MAX = 1800;
const GLOW = new Color('#7FF0D0');

/** Makes a material sway whatever it draws: more toward the top (uv.y), each instance on its own beat. */
function swaying(mat: MeshStandardMaterial, time: { value: number }, amount: number): MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 mwAt = instanceMatrix[3].xyz;
        #else
          vec3 mwAt = modelMatrix[3].xyz;
        #endif
        float mwPh = mwAt.x * 0.31 + mwAt.z * 0.47;
        float mwK = uv.y * uv.y * ${amount.toFixed(3)};
        transformed.x += (sin(uSwayTime * 1.15 + mwPh) + 0.4 * sin(uSwayTime * 2.7 + mwPh * 1.9)) * mwK;
        transformed.z += cos(uSwayTime * 0.85 + mwPh * 1.3) * mwK * 0.7;`);
    // Thin leaves let the light through: lit mostly as if they faced the sky, so a bed seen against the sun
    // is not a row of black blades.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize(mix(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, 0.72));`);
  };
  mat.customProgramCacheKey = () => `sway-${amount}`;
  return mat;
}

/** A blade or sheaf: a tapered strip standing at (x, z), bent a little, coloured dark at the foot and pale at the tip. */
function strip(out: { pos: number[]; col: number[]; uv: number[] }, x: number, z: number, yaw: number, h: number, w0: number, w1: number, lean: number, foot: Color, tip: Color, below = 0.5) {
  const c = Math.cos(yaw), s = Math.sin(yaw), segs = 2;
  const at = (t: number, side: number): [number, number, number] => {
    const w = (w0 + (w1 - w0) * t) * side * 0.5, off = lean * t * t;
    return [x + c * w - s * off, -below + (h + below) * t, z + s * w + c * off];
  };
  const col = (t: number) => _c.copy(foot).lerp(tip, Math.max(0, (t * (h + below) - below) / h));
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs, t1 = (k + 1) / segs;
    const quad = [at(t0, -1), at(t0, 1), at(t1, 1), at(t0, -1), at(t1, 1), at(t1, -1)], ts = [t0, t0, t1, t0, t1, t1];
    for (let i = 0; i < 6; i++) {
      out.pos.push(...quad[i]);
      const cc = col(ts[i]); out.col.push(cc.r, cc.g, cc.b);
      // v runs 0 at the waterline to 1 at the tip: what is under the water does not sway.
      out.uv.push(i % 2, Math.max(0, (ts[i] * (h + below) - below) / h));
    }
  }
}
function toGeometry(o: { pos: number[]; col: number[]; uv: number[] }): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(o.pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(o.col), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(o.uv), 2));
  g.computeVertexNormals();
  return g;
}

/** A stand of sheaves about four metres across: what a reed bed is made of, seen from any distance. */
function sheafGeometry(seed: number): BufferGeometry {
  const o = { pos: [] as number[], col: [] as number[], uv: [] as number[] };
  const foot = new Color('#4E6A34'), tip = new Color('#B9BE6E'), dry = new Color('#C9B87A');
  for (let i = 0; i < 9; i++) {
    const a = hash(i, seed, 1) * Math.PI * 2, r = Math.sqrt(hash(i, seed, 2)) * 2.3;
    const h = 1.7 + hash(i, seed, 3) * 0.9, yaw = hash(i, seed, 4) * Math.PI;
    const t = hash(i, seed, 5) < 0.3 ? dry : tip;
    // Two strips crossed, so a sheaf has some body from every side.
    strip(o, Math.cos(a) * r, Math.sin(a) * r, yaw, h, 0.62, 0.03, 0.35 * (hash(i, seed, 6) - 0.3), foot, t);
    strip(o, Math.cos(a) * r, Math.sin(a) * r, yaw + 1.4, h * 0.9, 0.5, 0.03, 0.3 * (hash(i, seed, 7) - 0.5), foot, t);
  }
  return toGeometry(o);
}

/** A clump of single blades with a couple of bulrush heads: the stand-in for `props/reeds-a` and `-b`. */
function clumpGeometry(seed: number): BufferGeometry {
  const o = { pos: [] as number[], col: [] as number[], uv: [] as number[] };
  const foot = new Color('#48632F'), tip = new Color('#C3C777'), head = new Color('#5A3B26');
  for (let i = 0; i < 13; i++) {
    const a = hash(i, seed, 11) * Math.PI * 2, r = Math.sqrt(hash(i, seed, 12)) * 0.55;
    const h = 1.5 + hash(i, seed, 13) * 0.75, x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = hash(i, seed, 14) * Math.PI;
    strip(o, x, z, yaw, h, 0.085, 0.012, 0.5 * (hash(i, seed, 15) - 0.35), foot, tip, 0.6);
    if (i < 3) strip(o, x, z, yaw + 1.2, h * 0.86, 0.02, 0.02, 0.1, foot, tip, 0.6);
    if (i < 3) {
      // The head: a short fat strip near the top of its stem, crossed.
      const hy = h * 0.86;
      for (const y2 of [yaw, yaw + 1.57]) {
        const c = Math.cos(y2), s = Math.sin(y2), w = 0.035, off = 0.1;
        const q: [number, number, number][] = [[x - c * w - s * off, hy - 0.26, z - s * w + c * off], [x + c * w - s * off, hy - 0.26, z + s * w + c * off], [x + c * w - s * off, hy, z + s * w + c * off], [x - c * w - s * off, hy - 0.26, z - s * w + c * off], [x + c * w - s * off, hy, z + s * w + c * off], [x - c * w - s * off, hy, z - s * w + c * off]];
        for (const p of q) { o.pos.push(...p); o.col.push(head.r, head.g, head.b); o.uv.push(0, 0.8); }
      }
    }
  }
  return toGeometry(o);
}

/** The geometry and material of a one-material model, or null if it is not in the library. */
function modelParts(key: string): { geo: BufferGeometry; mat: MeshStandardMaterial }[] | null {
  const m = assets.instance(key);
  if (!m) return null;
  const out: { geo: BufferGeometry; mat: MeshStandardMaterial }[] = [];
  m.updateMatrixWorld(true);
  m.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    // Bake the node's own placing into a copy, so instances can be placed as if the mesh were at the origin.
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    out.push({ geo, mat: mesh.material as MeshStandardMaterial });
  });
  return out.length ? out : null;
}

/** A drowned tree from plain shapes, as [trunk and crown, hanging moss]: the stand-in for `props/lantern-tree-a`/`-b`. */
function treeGeometry(kind: 'a' | 'b'): [BufferGeometry, BufferGeometry] {
  const tall = kind === 'a' ? 11 : 8, crownR = kind === 'a' ? 3.5 : 2.2;
  const bark = new Color('#5B5246'), barkDark = new Color('#3F3A33'), leaf = new Color(kind === 'a' ? '#3F6B45' : '#5E6A45');
  const parts: BufferGeometry[] = [], moss: BufferGeometry[] = [];
  const paint = (g: BufferGeometry, c: (y: number) => Color) => {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.getAttribute('position'), col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const cc = c(p.getY(i)); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
    ng.setAttribute('color', new BufferAttribute(col, 3)); ng.setAttribute('uv', new BufferAttribute(uv, 2));
    ng.deleteAttribute('normal'); ng.computeVertexNormals();
    return ng;
  };
  // The trunk flares to buttresses at the water and carries on a metre and a half under it.
  const trunk = new CylinderGeometry(0.34, 1.25, tall * 0.42 + 1.5, 7, 3); trunk.translate(0, (tall * 0.42 + 1.5) / 2 - 1.5, 0);
  const upper = new CylinderGeometry(0.2, 0.34, tall * 0.5, 6, 1); upper.translate(0, tall * 0.42 + tall * 0.25, 0);
  if (kind === 'b') { for (const g of [trunk, upper]) { g.rotateZ(0.16); } }
  parts.push(paint(trunk, (y) => _c.copy(barkDark).lerp(bark, smooth(-0.5, 2, y)).clone()), paint(upper, () => bark));
  // Knees: stubs standing out of the water round the foot.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6, knee = new ConeGeometry(0.16, 0.9, 5); knee.translate(Math.cos(a) * 1.7, 0.1, Math.sin(a) * 1.7);
    parts.push(paint(knee, () => barkDark));
  }
  // A flat crown in a few lumps, and boughs out to them.
  const lumps = kind === 'a' ? 5 : 2;
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + 0.3, r = i === 0 ? 0 : crownR * 0.62, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
    const lump = new IcosahedronGeometry(crownR * (i === 0 ? 0.62 : 0.5), 0); lump.scale(1, 0.42, 1); lump.translate(lx + (kind === 'b' ? 1.4 : 0), tall * (0.9 + 0.03 * (i % 3)), lz);
    parts.push(paint(lump, (y) => _c.copy(leaf).multiplyScalar(0.8 + 0.3 * smooth(tall * 0.84, tall, y)).clone()));
    // Strands of moss hanging from under each lump.
    const strands = kind === 'a' ? 3 : 1;
    for (let k = 0; k < strands; k++) {
      const sa = a + k * 2.1, sr = crownR * 0.3, len = 1.6 + 1.8 * hash(i, k, 5);
      const st = new ConeGeometry(0.11, len, 4); st.rotateX(Math.PI); st.translate(lx + Math.cos(sa) * sr + (kind === 'b' ? 1.4 : 0), tall * 0.86 - len / 2, lz + Math.sin(sa) * sr);
      const ng = st.toNonIndexed(), p = ng.getAttribute('position'), uv = new Float32Array(p.count * 2), col = new Float32Array(p.count * 3);
      // v 0 where it hangs from, 1 at the tip that swings.
      for (let q = 0; q < p.count; q++) { uv[q * 2 + 1] = Math.min(1, Math.max(0, (tall * 0.86 - p.getY(q)) / len)); col[q * 3] = 0.42; col[q * 3 + 1] = 0.62; col[q * 3 + 2] = 0.5; }
      ng.setAttribute('uv', new BufferAttribute(uv, 2)); ng.setAttribute('color', new BufferAttribute(col, 3));
      ng.deleteAttribute('normal'); ng.computeVertexNormals();
      moss.push(ng);
    }
  }
  return [merge(parts), merge(moss)];
}
function merge(parts: BufferGeometry[]): BufferGeometry {
  let n = 0; for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    const c = p.getAttribute('position').count;
    pos.set(p.getAttribute('position').array as Float32Array, o * 3); col.set(p.getAttribute('color').array as Float32Array, o * 3); uv.set(p.getAttribute('uv').array as Float32Array, o * 2);
    o += c;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3)); g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Lily pads and two closed buds, as [pads, buds]: the stand-in for `props/lily-glow`. */
function lilyGeometry(): [BufferGeometry, BufferGeometry] {
  const pads: BufferGeometry[] = [], buds: BufferGeometry[] = [];
  const green = new Color('#4E8F4E'), light = new Color('#79B45A');
  const flat = (g: BufferGeometry, c: Color) => {
    const ng = g.index ? g.toNonIndexed() : g, p = ng.getAttribute('position'), col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    ng.setAttribute('color', new BufferAttribute(col, 3)); ng.setAttribute('uv', new BufferAttribute(new Float32Array(p.count * 2), 2));
    return ng;
  };
  for (let i = 0; i < 6; i++) {
    const a = hash(i, 3, 1) * Math.PI * 2, r = 0.15 + hash(i, 3, 2) * 0.6, s = 0.2 + hash(i, 3, 3) * 0.16;
    // A disc with a notch cut out of it.
    const pad = new CylinderGeometry(s, s, 0.015, 9, 1, false, 0.35, Math.PI * 2 - 0.7); pad.translate(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    pads.push(flat(pad, hash(i, 3, 4) < 0.5 ? green : light));
  }
  for (let i = 0; i < 2; i++) {
    const bud = new ConeGeometry(0.06, 0.2, 5); bud.translate(i ? 0.32 : -0.18, 0.12, i ? -0.2 : 0.26);
    buds.push(flat(bud, new Color('#DFF7EC')));
  }
  return [merge(pads), merge(buds)];
}

export interface FenOptions {
  /** The fen's middle and how far out the reed beds go. */
  center: [number, number]; within: number;
  /** Quick ground height (the terrain's own grid). */
  heightAt: HeightAt;
  trees: TreeSpot[];
  /** Still, shallow water for lilies: [x, z, radius]. */
  lilies: [number, number, number][];
  /** Places to keep clear of reeds and lilies (the jetty, moorings): [x, z, radius]. */
  clear: [number, number, number][];
}

export class FenDressing {
  readonly root = new Group();
  private time = { value: 0 };
  private glowMats: MeshStandardMaterial[] = [];
  private clumps: InstancedMesh[] = [];
  private clumpAt = new Vector3(1e9, 0, 1e9);
  private motes: Points;
  private motePos: Float32Array; private moteCol: Float32Array; private moteSeed: Float32Array;
  /** Counts, for the bots and the frame profile. */
  readonly counts = { sheaves: 0, trees: 0, lilies: 0, clumps: 0 };

  constructor(private o: FenOptions) {
    const isBed = (x: number, z: number) => { const h = o.heightAt(x, z); return h > BED_LOW && h < BED_HIGH; };
    const isClear = (x: number, z: number) => o.clear.some((c) => (x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2]);

    // ---- sheaves on every bed
    const spots: [number, number][] = [];
    const n = Math.ceil((o.within + 20) / SHEAF_CELL);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const x = o.center[0] + (i + hash(i, j, 1) - 0.5) * SHEAF_CELL, z = o.center[1] + (j + hash(j, i, 2) - 0.5) * SHEAF_CELL;
      if (isBed(x, z) && !isClear(x, z)) spots.push([x, z]);
    }
    const sheafMat = swaying(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9, flatShading: true }), this.time, 0.16);
    for (let v = 0; v < 2; v++) {
      const mine = spots.filter((_, k) => k % 2 === v);
      const im = new InstancedMesh(sheafGeometry(v + 1), sheafMat, mine.length);
      mine.forEach(([x, z], k) => {
        const s = 0.8 + 0.5 * hash(x, z, 3);
        _m.compose(_v.set(x, 0, z), _q.setFromAxisAngle(_up, hash(x, z, 4) * Math.PI * 2), _s.set(s, 0.85 + 0.4 * hash(x, z, 5), s));
        im.setMatrixAt(k, _m);
      });
      im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
      this.root.add(im);
    }
    this.counts.sheaves = spots.length;

    // ---- clumps round the player
    const clumpMat = swaying(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9, flatShading: true }), this.time, 0.22);
    for (const [v, key] of [[0, 'reedsA'], [1, 'reedsB']] as const) {
      const parts = modelParts(key);
      const geo = parts ? parts[0].geo : clumpGeometry(v + 7);
      const mat = parts ? swaying(parts[0].mat.clone(), this.time, 0.22) : clumpMat;
      if (parts) mat.side = DoubleSide;
      const im = new InstancedMesh(geo, mat, CLUMP_MAX / 2);
      im.count = 0; im.instanceMatrix.setUsage(DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      this.clumps.push(im); this.root.add(im);
    }

    // ---- the drowned trees
    for (const kind of ['a', 'b'] as const) {
      const mine = o.trees.filter((t) => t.kind === kind);
      if (!mine.length) continue;
      const parts = modelParts(kind === 'a' ? 'lanternTreeA' : 'lanternTreeB');
      let meshes: { geo: BufferGeometry; mat: Material; glow: boolean }[];
      if (parts) {
        meshes = parts.map((p) => {
          const glow = p.mat.name === 'Glow';
          const mat = glow ? swaying(p.mat.clone(), this.time, 0.3) : p.mat;
          if (glow) this.glowMats.push(mat as MeshStandardMaterial);
          return { geo: p.geo, mat, glow };
        });
      } else {
        const [wood, moss] = treeGeometry(kind);
        const mossMat = swaying(new MeshStandardMaterial({ vertexColors: true, emissive: GLOW, emissiveIntensity: 0.1, roughness: 0.8, flatShading: true, side: DoubleSide }), this.time, 0.3);
        this.glowMats.push(mossMat);
        meshes = [{ geo: wood, mat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), glow: false }, { geo: moss, mat: mossMat, glow: true }];
      }
      for (const part of meshes) {
        const im = new InstancedMesh(part.geo, part.mat, mine.length);
        mine.forEach((t, k) => { _m.compose(_v.set(t.x, 0, t.z), _q.setFromAxisAngle(_up, t.yaw), _s.setScalar(t.scale)); im.setMatrixAt(k, _m); });
        im.frustumCulled = false; im.castShadow = !part.glow; im.receiveShadow = !part.glow;
        this.root.add(im);
      }
    }
    this.counts.trees = o.trees.length;

    // ---- lilies on the still water
    const pads: [number, number][] = [];
    for (const [cx, cz, r] of o.lilies) {
      const m = Math.ceil(r / 7);
      for (let j = -m; j <= m; j++) for (let i = -m; i <= m; i++) {
        if (hash(i, j, 31 + cx) > 0.42) continue;
        const x = cx + (i + hash(i, j, 32) - 0.5) * 7, z = cz + (j + hash(j, i, 33) - 0.5) * 7;
        if (Math.hypot(x - cx, z - cz) > r) continue;
        const h = o.heightAt(x, z);
        if (h > -0.5 || h < -3 || isClear(x, z)) continue;
        pads.push([x, z]);
      }
    }
    if (pads.length) {
      const parts = modelParts('lilyGlow');
      let meshes: { geo: BufferGeometry; mat: MeshStandardMaterial; glow: boolean }[];
      if (parts) meshes = parts.map((p) => { const glow = p.mat.name === 'Glow'; const mat = glow ? p.mat.clone() : p.mat; if (glow) this.glowMats.push(mat); return { geo: p.geo, mat, glow }; });
      else {
        const [padGeo, budGeo] = lilyGeometry();
        const budMat = new MeshStandardMaterial({ vertexColors: true, emissive: new Color('#9FF5E6'), emissiveIntensity: 0.1, roughness: 0.6, flatShading: true });
        this.glowMats.push(budMat);
        meshes = [{ geo: padGeo, mat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }), glow: false }, { geo: budGeo, mat: budMat, glow: true }];
      }
      for (const part of meshes) {
        const im = new InstancedMesh(part.geo, part.mat, pads.length);
        pads.forEach(([x, z], k) => { const s = 0.8 + 0.6 * hash(x, z, 34); _m.compose(_v.set(x, 0.01, z), _q.setFromAxisAngle(_up, hash(x, z, 35) * Math.PI * 2), _s.setScalar(s)); im.setMatrixAt(k, _m); });
        im.frustumCulled = false; im.castShadow = false; im.receiveShadow = !part.glow;
        this.root.add(im);
      }
    }
    this.counts.lilies = pads.length;

    // ---- the small lights over the reeds after dark
    const N = 260;
    this.motePos = new Float32Array(N * 3); this.moteCol = new Float32Array(N * 3); this.moteSeed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { this.moteSeed[i * 4] = hash(i, 1, 41); this.moteSeed[i * 4 + 1] = hash(i, 2, 42); this.moteSeed[i * 4 + 2] = hash(i, 3, 43); this.moteSeed[i * 4 + 3] = hash(i, 4, 44); }
    const mg = new BufferGeometry();
    mg.setAttribute('position', new BufferAttribute(this.motePos, 3).setUsage(DynamicDrawUsage));
    mg.setAttribute('color', new BufferAttribute(this.moteCol, 3).setUsage(DynamicDrawUsage));
    this.motes = new Points(mg, new PointsMaterial({ map: haloTexture(), size: 0.5, sizeAttenuation: true, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
    this.motes.frustumCulled = false; this.motes.renderOrder = 6; this.motes.visible = false;
    this.root.add(this.motes);
  }

  /** Deals the fine clumps out again round (x, z): every bed cell within range gets one, the same one each time. */
  private deal(x: number, z: number) {
    const o = this.o, counts = [0, 0];
    const i0 = Math.floor((x - CLUMP_RANGE) / CLUMP_CELL), i1 = Math.ceil((x + CLUMP_RANGE) / CLUMP_CELL);
    const j0 = Math.floor((z - CLUMP_RANGE) / CLUMP_CELL), j1 = Math.ceil((z + CLUMP_RANGE) / CLUMP_CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + hash(i, j, 51)) * CLUMP_CELL, pz = (j + hash(j, i, 52)) * CLUMP_CELL;
      const d = Math.hypot(px - x, pz - z);
      if (d > CLUMP_RANGE) continue;
      const h = o.heightAt(px, pz);
      if (h < BED_LOW || h > BED_HIGH) continue;
      if (o.clear.some((c) => (px - c[0]) ** 2 + (pz - c[1]) ** 2 < c[2] * c[2])) continue;
      const v = hash(i, j, 53) < 0.5 ? 0 : 1;
      if (counts[v] >= CLUMP_MAX / 2) continue;
      // They rise out of the bed toward the edge of the range, so none appears from nothing.
      const grow = smooth(CLUMP_RANGE, CLUMP_RANGE * 0.72, d), s = (0.85 + 0.4 * hash(i, j, 54)) * grow;
      if (s < 0.05) continue;
      _m.compose(_v.set(px, 0, pz), _q.setFromAxisAngle(_up, hash(i, j, 55) * Math.PI * 2), _s.set(s, s, s));
      this.clumps[v].setMatrixAt(counts[v]++, _m);
    }
    for (let v = 0; v < 2; v++) { this.clumps[v].count = counts[v]; this.clumps[v].instanceMatrix.needsUpdate = true; }
    this.counts.clumps = counts[0] + counts[1];
    this.clumpAt.set(x, 0, z);
  }

  /** Every frame. `night` 0 (day) .. 1 (night); `focus` is where the player is. */
  update(dt: number, focus: Vector3, night: number) {
    this.time.value += dt;
    const t = this.time.value;
    if (Math.hypot(focus.x - this.clumpAt.x, focus.z - this.clumpAt.z) > 3.5) this.deal(focus.x, focus.z);
    // The moss and the buds are dull by day and lit after dark, breathing slowly.
    const glow = 0.06 + night * (2.0 + 0.35 * Math.sin(t * 0.7));
    for (const m of this.glowMats) m.emissiveIntensity = glow;
    // Motes: each keeps a place in a block of space that repeats round the player, and drifts about it.
    this.motes.visible = night > 0.05;
    if (this.motes.visible) {
      const B = 90, N = this.moteSeed.length / 4;
      for (let i = 0; i < N; i++) {
        const a = this.moteSeed[i * 4], b = this.moteSeed[i * 4 + 1], c = this.moteSeed[i * 4 + 2], d = this.moteSeed[i * 4 + 3];
        let x = a * B + Math.sin(t * 0.21 + d * 40) * 2.5, z = b * B + Math.cos(t * 0.17 + d * 31) * 2.5;
        x = focus.x + ((((x - focus.x) % B) + B * 1.5) % B) - B / 2; z = focus.z + ((((z - focus.z) % B) + B * 1.5) % B) - B / 2;
        const y = 0.5 + c * 3.2 + Math.sin(t * 0.5 + d * 20) * 0.5;
        this.motePos[i * 3] = x; this.motePos[i * 3 + 1] = y; this.motePos[i * 3 + 2] = z;
        // They keep to the reeds and the trees: out over open water there are none.
        const h = this.o.heightAt(x, z), over = h > -1.6 ? 1 : 0;
        const edge = smooth(B / 2, B / 2 - 12, Math.hypot(x - focus.x, z - focus.z));
        const k = over * edge * night * Math.max(0, Math.sin(t * (0.6 + d) + d * 50)) * 0.9;
        this.moteCol[i * 3] = GLOW.r * k; this.moteCol[i * 3 + 1] = GLOW.g * k; this.moteCol[i * 3 + 2] = GLOW.b * k;
      }
      this.motes.geometry.attributes.position.needsUpdate = true; this.motes.geometry.attributes.color.needsUpdate = true;
    }
  }
}

const _m = new Matrix4(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _up = new Vector3(0, 1, 0), _c = new Color();
