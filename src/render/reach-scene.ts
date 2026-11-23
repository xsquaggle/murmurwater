/**
 * What stands in Saltbone Reach: the Ribs, eighteen great curved bones in two facing rows over a channel (two
 * kinds, one of them broken off with a gull's nest in the break); vertebrae lying awash and half buried on the
 * beaches; and cushions of sea-thrift on the slate, swaying a little in the wind. One draw call for each kind.
 *
 * The delivered models (`props/rib-a`, `rib-b`, `vertebra`, `sea-thrift`) are used when they are in the library;
 * until then each is built here from a few plain shapes, of the same size and facing.
 */
import {
  BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, type Mesh, MeshStandardMaterial, Object3D,
  Quaternion, SphereGeometry, Vector3,
} from 'three';
import { Builder } from './builder';
import { createPropMaterial } from './props';
import { modelParts, swaying } from './fen-scene';
import { boneSpots, ribSpots, type BoneSpot, type RibSpot } from '../core/flora';
import type { Heightfield } from '../core/world';
import type { RegionContent } from '../core/content';

type HeightAt = (x: number, z: number) => number;
const hash = (a: number, b: number, seed = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };

/** Where on a great rib (in its own frame) the rib mark is let in: head height, on the face toward the channel. */
/** The cold light bone has by night, and how much of it at full dark. */
const BONE_BY_NIGHT = '#9DB0DC', BONE_GLOW = 0.22;
export const RIB_MARK_AT = new Vector3(0.55, 1.7, 0);

/** The great rib from plain shapes: a tusk of bone from 2.5 m under the water up 13 m and over 7 m toward +X. */
function ribGeometry(broken: boolean): BufferGeometry {
  const b = new Builder(broken ? 141 : 140, 0.05);
  const bone = new Color('#E6DCC4'), weed = new Color('#6F7A62'), lichen = new Color('#D08A3C');
  const at = (t: number) => { const a = t * Math.PI * 0.42; return new Vector3(7 * (1 - Math.cos(a)) * 0.95 + 0.3 * t, -2.5 + 15.5 * Math.sin(a) - 0.3 * t, 0); };
  const n = broken ? 7 : 10, end = broken ? 0.62 : 1;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * end, t1 = ((i + 1) / n) * end, p = at(t0), q = at(t1), mid = p.clone().lerp(q, 0.5);
    const len = p.distanceTo(q) + 0.3, r0 = 0.8 * (1 - 0.7 * t0), r1 = 0.8 * (1 - 0.7 * t1);
    const tilt = Math.atan2(q.x - p.x, q.y - p.y);
    b.add(new CylinderGeometry(r1, r0, len, 7), (c) => (c.y < 0.3 ? weed : hash(c.x, c.y, 3) > 0.92 && c.y > 6 ? lichen : bone), { pos: [mid.x, mid.y, mid.z], rot: [0, 0, -tilt] });
  }
  if (broken) {
    // The jagged end, and a nest of weed and sticks in the break.
    const top = at(end);
    b.add(new ConeGeometry(0.45, 0.9, 5), bone, { pos: [top.x, top.y + 0.3, 0.1], rot: [0.3, 0, -0.5] });
    b.add(new CylinderGeometry(0.55, 0.4, 0.22, 8), new Color('#8C7A58'), { pos: [top.x - 0.1, top.y + 0.1, 0] });
  } else {
    b.add(new SphereGeometry(0.26, 6, 5), bone, { pos: [at(1).x, at(1).y, 0] });
  }
  return b.build();
}
/** A vertebra from plain shapes: a drum of bone with three stubby wings. */
function vertebraGeometry(): BufferGeometry {
  const b = new Builder(142, 0.06);
  const bone = new Color('#DCD2BA'), weed = new Color('#6A7460');
  const col = (c: Vector3) => (c.y < 0.2 ? weed : bone);
  b.add(Builder.wobble(new CylinderGeometry(0.95, 1.0, 1.6, 9), 0.08, 3), col, { pos: [0, 0.2, 0] });
  for (const [a, l] of [[0, 1.3], [Math.PI, 1.3], [-Math.PI / 2, 1.1]] as const) b.add(new ConeGeometry(0.35, l, 5), col, { pos: [Math.cos(a) * 1.25, 0.5, -Math.sin(a) * 1.25], rot: [0, a, -Math.PI / 2] });
  return b.build();
}
/** A cushion of sea-thrift: a low green dome with pink heads on short stalks (uv.y 0 at the foot, 1 at the heads). */
function thriftGeometry(): BufferGeometry {
  const b = new Builder(143, 0.08);
  b.add(new IcosahedronGeometry(0.33, 0), new Color('#55704A'), { pos: [0, 0.05, 0], scale: [1, 0.45, 1] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + hash(i, 1, 9), r = 0.08 + 0.17 * hash(i, 2, 9);
    b.add(new SphereGeometry(0.05, 5, 4), new Color(i % 3 ? '#E59AB8' : '#F0B8CE'), { pos: [Math.cos(a) * r, 0.24 + 0.05 * hash(i, 3, 9), Math.sin(a) * r] });
  }
  const g = b.build();
  // v by height, so the heads sway and the foot stays put.
  const p = g.getAttribute('position'), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) uv[i * 2 + 1] = Math.min(1, Math.max(0, (p.getY(i) + 0.05) / 0.34));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

export interface ReachOptions {
  region: RegionContent;
  hf: Heightfield;
  /** Quick ground height (the terrain's own grid). */
  heightAt: HeightAt;
  /** Places to keep bones and thrift off (the quay, props, moorings): [x, z, radius]. */
  keep: [number, number, number][];
  /** Fewer cushions of thrift on the lowest setting. */
  sparse: boolean;
}

export class ReachDressing {
  readonly root = new Group();
  readonly ribs: RibSpot[];
  readonly bones: BoneSpot[];
  /** Counts, for the bots and the frame profile. */
  readonly counts = { ribs: 0, bones: 0, thrift: 0 };
  /** Solid things in the water a hull cannot pass: the feet of the ribs, and bones awash. */
  readonly rocks: [number, number, number][] = [];
  /** Things on land a keeper walks round. */
  readonly blockers: [number, number, number][] = [];
  private time = { value: 0 };
  private mats: MeshStandardMaterial[] = [];

  constructor(o: ReachOptions) {
    // ---- the Ribs
    this.ribs = ribSpots(o.region);
    for (const kind of ['a', 'b'] as const) {
      const mine = this.ribs.filter((r) => r.kind === kind);
      if (!mine.length) continue;
      const parts = modelParts(kind === 'a' ? 'ribA' : 'ribB')?.map((p) => ({ geo: p.geo, mat: this.bone(p.mat) })) ?? [{ geo: ribGeometry(kind === 'b'), mat: this.own(createPropMaterial()) }];
      for (const part of parts) {
        const im = new InstancedMesh(part.geo, part.mat, mine.length);
        mine.forEach((r, k) => { _m.compose(_v.set(r.x, 0, r.z), _q.setFromAxisAngle(_up, r.yaw), _s.setScalar(r.scale)); im.setMatrixAt(k, _m); });
        im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
        this.root.add(im);
      }
    }
    for (const r of this.ribs) this.rocks.push([r.x, r.z, r.r]);
    this.counts.ribs = this.ribs.length;

    // ---- vertebrae, awash and on the beaches
    this.bones = boneSpots(o.region, o.hf, o.keep);
    if (this.bones.length) {
      const parts = modelParts('vertebra')?.map((p) => ({ geo: p.geo, mat: this.bone(p.mat) })) ?? [{ geo: vertebraGeometry(), mat: this.own(createPropMaterial()) }];
      for (const part of parts) {
        const im = new InstancedMesh(part.geo, part.mat, this.bones.length);
        this.bones.forEach((b, k) => {
          const h = o.hf.height(b.x, b.z);
          // Ashore it lies in the shingle; awash, on the bed (never floating above the surface it is drawn on).
          _m.compose(_v.set(b.x, Math.min(Math.max(h, -1) - b.sunk, 0.2), b.z), _q.setFromAxisAngle(_up, b.yaw).multiply(_t.setFromAxisAngle(_side, (hash(b.x, b.z, 5) - 0.5) * 0.3)), _s.setScalar(b.scale));
          im.setMatrixAt(k, _m);
        });
        im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
        this.root.add(im);
      }
      for (const b of this.bones) (o.hf.height(b.x, b.z) < 0.15 ? this.rocks : this.blockers).push([b.x, b.z, b.r]);
    }
    this.counts.bones = this.bones.length;

    // ---- sea-thrift on the slate: in drifts on the gentler ground of every island, clear of what stands there
    const spots: [number, number, number][] = [];
    const cell = o.sparse ? 3.4 : 2.4, cap = o.sparse ? 700 : 1500;
    for (const isl of o.region.islands) {
      const half = Math.max(isl.rx, isl.rz) * 1.08;
      for (let z = isl.z - half; z < isl.z + half && spots.length < cap; z += cell) for (let x = isl.x - half; x < isl.x + half && spots.length < cap; x += cell) {
        const px = x + (hash(x, z, 1) - 0.5) * cell, pz = z + (hash(z, x, 2) - 0.5) * cell;
        // Drifts: it grows in patches, thick in some and none in others.
        if (hash(Math.floor(px / 11), Math.floor(pz / 11), 3) < 0.45 || hash(px, pz, 4) < 0.45) continue;
        const h = o.heightAt(px, pz);
        if (h < 0.9 || h > 14) continue;
        const slope = Math.hypot(o.heightAt(px + 1, pz) - o.heightAt(px - 1, pz), o.heightAt(px, pz + 1) - o.heightAt(px, pz - 1)) / 2;
        if (slope > 0.42) continue;
        if (o.hf.surfaceAt(px, pz).w > 0.2) continue;
        if (o.keep.some((c) => (px - c[0]) ** 2 + (pz - c[1]) ** 2 < (c[2] + 0.8) ** 2)) continue;
        spots.push([px, h - 0.04, pz]);
      }
    }
    if (spots.length) {
      const parts = modelParts('seaThrift');
      const geo = parts ? parts[0].geo : thriftGeometry();
      const mat = swaying(parts ? parts[0].mat.clone() : new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), this.time, 0.05);
      mat.side = DoubleSide;
      this.mats.push(mat);
      const im = new InstancedMesh(geo, mat, spots.length);
      spots.forEach(([x, y, z], k) => { const s = 0.7 + 0.7 * hash(x, z, 5); _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(_up, hash(x, z, 6) * Math.PI * 2), _s.set(s, s * (0.8 + 0.4 * hash(x, z, 7)), s)); im.setMatrixAt(k, _m); });
      im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
      this.root.add(im);
    }
    this.counts.thrift = spots.length;
  }

  /** The stand-ins' materials take the dusk glow like every procedural prop (the scene turns them up). */
  readonly propMats: MeshStandardMaterial[] = [];
  private own(m: MeshStandardMaterial): MeshStandardMaterial { this.propMats.push(m); return m; }

  /**
   * Bone takes the moon. With no windows to light it the Reach's night is lit from the sky, and the bones are what
   * stands pale in it: each bone material is given a faint cold light of its own that comes up with the dark
   * (a copy, so the library's own material is as it was made).
   */
  private boneMats: MeshStandardMaterial[] = [];
  private bone(m: MeshStandardMaterial): MeshStandardMaterial {
    const c = m.clone();
    c.emissive = new Color(BONE_BY_NIGHT); c.emissiveMap = c.map; c.emissiveIntensity = 0;
    this.boneMats.push(c);
    return c;
  }
  /** A thing of bone that something else built (the Jaw): its meshes take the moon too. */
  moonlit(obj: Object3D) { obj.traverse((o) => { const mesh = o as Mesh; if (mesh.isMesh && !Array.isArray(mesh.material)) mesh.material = this.bone(mesh.material as MeshStandardMaterial); }); }

  /** The rib nearest (x, z), and where on it, in the world, a thing at `local` in its frame is. */
  ribNear(x: number, z: number, local: Vector3): { rib: RibSpot; at: Vector3; yaw: number } | null {
    let best: RibSpot | null = null, bd = Infinity;
    for (const r of this.ribs) { const d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; best = r; } }
    if (!best) return null;
    const at = local.clone().multiplyScalar(best.scale).applyAxisAngle(_up, best.yaw).add(new Vector3(best.x, 0, best.z));
    return { rib: best, at, yaw: best.yaw };
  }

  /** Puts `obj` on the rib nearest (x, z), at `local` in the rib's frame, its front (+Z) toward the channel. */
  fixToRib(obj: Object3D, x: number, z: number, local = RIB_MARK_AT): boolean {
    const n = this.ribNear(x, z, local);
    if (!n) return false;
    obj.position.copy(n.at); obj.rotation.set(0, n.yaw + Math.PI / 2, 0);
    return true;
  }

  /** `night` 0..1: how dark it is (the bones come up pale as it goes). */
  update(dt: number, night = 0) {
    this.time.value += dt;
    const k = BONE_GLOW * night;
    if (k !== this.boneLit) { this.boneLit = k; for (const m of this.boneMats) m.emissiveIntensity = k; }
  }
  private boneLit = 0;
}

const _m = new Matrix4(), _q = new Quaternion(), _t = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _up = new Vector3(0, 1, 0), _side = new Vector3(1, 0, 0);
