/**
 * Procedural props for the islands: lighthouse, cottages, dock, trees, rocks, lanterns, boats.
 * All flat-shaded, vertex-coloured from the palette, merged per prop.
 */
import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PointLight, SphereGeometry, TorusGeometry, Vector3,
  BufferGeometry, Quaternion, Euler,
} from 'three';
import { Builder } from './builder';
import { PALETTE } from './palette';
import type { Heightfield } from '../core/world';
import { Rng } from '../core/rng';
import { DOCK } from '../core/dock';

const C = (h: string) => new Color(h);

/** Shared material for all props; supports a per-vertex emissive weight (windows, lamps). */
export function createPropMaterial() {
  const uniforms = { uGlow: { value: 0.2 } };
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float emissive;\nvarying float vEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissive = emissive;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmissive;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vEmissive * (0.25 + 2.6 * uGlow);');
  };
  return mat;
}

// ---------------------------------------------------------------- lighthouse
export function buildLighthouse(seed = 3) {
  const b = new Builder(seed, 0.04);
  const cream = C(PALETTE.bone), coral = C(PALETTE.coral), slate = C(PALETTE.slate), violet = C('#4A3A63');
  // Rock plinth
  b.add(Builder.wobble(new CylinderGeometry(6.2, 7.4, 2.6, 9, 1), 0.5, 2), C('#6B7079'), { pos: [0, 0.6, 0] });
  b.add(new CylinderGeometry(4.9, 5.2, 0.8, 10), C('#8A8E92'), { pos: [0, 2.2, 0] });
  // Tower bands, tapered
  const bands = 5, bandH = 3.9, r0 = 4.3, r1 = 3.0;
  for (let i = 0; i < bands; i++) {
    const ra = r0 + (r1 - r0) * (i / bands), rb = r0 + (r1 - r0) * ((i + 1) / bands);
    b.add(new CylinderGeometry(rb, ra, bandH, 10, 1), i % 2 === 0 ? cream : coral, { pos: [0, 2.6 + bandH * (i + 0.5), 0] });
  }
  const topY = 2.6 + bands * bandH;
  // Door + windows
  b.add(new BoxGeometry(1.5, 2.4, 0.6), C(PALETTE.driftwood), { pos: [0, 3.8, 4.15] });
  b.add(new BoxGeometry(1.9, 0.3, 0.8), slate, { pos: [0, 5.1, 4.1] });
  for (let i = 0; i < 4; i++) {
    const a = 0.9 + i * 1.7, y = 7.5 + i * 3.6;
    const r = r0 + (r1 - r0) * ((y - 2.6) / (bands * bandH)) + 0.02;
    b.add(new BoxGeometry(0.75, 1.15, 0.3), C(PALETTE.wick), { pos: [Math.sin(a) * r, y, Math.cos(a) * r], rot: [0, a, 0] }, { emissive: 0.6 });
  }
  // Gallery deck + railing
  b.add(new CylinderGeometry(4.4, 3.4, 0.7, 12), slate, { pos: [0, topY + 0.35, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add(new BoxGeometry(0.1, 1.0, 0.1), C('#3A3442'), { pos: [Math.sin(a) * 4.1, topY + 1.2, Math.cos(a) * 4.1] });
  }
  b.add(new TorusGeometry(4.1, 0.08, 3, 24), C('#3A3442'), { pos: [0, topY + 1.7, 0], rot: [Math.PI / 2, 0, 0] });
  // Lamp room frame (glass is a separate mesh so it can be lit)
  b.add(new CylinderGeometry(2.7, 2.7, 0.4, 8), violet, { pos: [0, topY + 0.9, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(new BoxGeometry(0.16, 2.8, 0.16), violet, { pos: [Math.sin(a) * 2.45, topY + 2.4, Math.cos(a) * 2.45] });
  }
  b.add(new CylinderGeometry(2.9, 2.7, 0.35, 8), violet, { pos: [0, topY + 3.9, 0] });
  b.add(new ConeGeometry(2.9, 2.6, 8), violet, { pos: [0, topY + 5.35, 0] });
  b.add(new SphereGeometry(0.35, 6, 4), C(PALETTE.lantern), { pos: [0, topY + 6.8, 0] });
  // Weathervane fish
  b.add(new BoxGeometry(0.06, 1.0, 0.06), C('#3A3442'), { pos: [0, topY + 7.3, 0] });
  b.add(new ConeGeometry(0.28, 1.1, 4), C(PALETTE.lantern), { pos: [0.35, topY + 7.8, 0], rot: [0, 0, Math.PI / 2] });
  b.add(new ConeGeometry(0.3, 0.45, 3), C(PALETTE.lantern), { pos: [-0.38, topY + 7.8, 0], rot: [0, 0, -Math.PI / 2] });
  const group = new Group();
  const body = new Mesh(b.build(), createPropMaterial());
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const glassMat = new MeshStandardMaterial({ color: C('#3B3550'), emissive: C(PALETTE.wick), emissiveIntensity: 0.05, roughness: 0.15, metalness: 0.1, flatShading: true });
  const glass = new Mesh(new CylinderGeometry(2.35, 2.35, 2.6, 8), glassMat);
  glass.position.y = topY + 2.4;
  group.add(glass);
  group.rotation.z = 0.022; // the slight lean
  return { group, glassMat, lampY: topY + 2.4, body };
}

// ---------------------------------------------------------------- cottages
const WALLS = ['#F2E3C6', '#EAD6B4', '#DCC9A6', '#A9CFC6', '#EBC0A6', '#E7DDC8'];
const ROOFS = ['#E86F6F', '#5B4A7A', '#4C6B78', '#C25F55', '#6F8F4E', '#7A6390'];

export function buildCottage(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.05);
  const w = rng.range(4.6, 6.4), d = rng.range(4.0, 5.4), h = rng.range(2.8, 3.6);
  const wall = C(rng.pick(WALLS)), roof = C(rng.pick(ROOFS));
  // Stone footing, deep enough to meet the ground on the downhill side of a slope.
  b.add(new BoxGeometry(w + 0.4, 2.6, d + 0.4), C('#7C7F86'), { pos: [0, -0.95, 0] });
  b.add(Builder.wobble(new BoxGeometry(w, h, d, 2, 2, 2), 0.08, seed), wall, { pos: [0, h / 2 + 0.3, 0] });
  // Gable roof as a 3-sided prism, with overhang
  const roofH = rng.range(1.8, 2.6);
  const prism = new CylinderGeometry(1, 1, 1, 3, 1);
  // Prism axis along X, apex up: local X→depth, Y→length, Z→height (see builder notes).
  const roofRot: [number, number, number] = [-Math.PI / 2, 0, -Math.PI / 2];
  const sx = (d + 1.0) / 1.732, sz = roofH / 1.5;
  b.add(prism, roof.clone().multiplyScalar(0.6), { pos: [0, h + 0.15 + 0.5 * sz, 0], rot: roofRot, scale: [sx * 1.04, w + 1.0, sz * 1.02] });
  b.add(prism, roof, { pos: [0, h + 0.32 + 0.5 * sz, 0], rot: roofRot, scale: [sx, w + 0.9, sz] });
  // Timber corner posts and a beam under the eaves
  const timber = C('#6E5440');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new BoxGeometry(0.28, h, 0.28), timber, { pos: [sx * (w / 2 - 0.05), h / 2 + 0.3, sz * (d / 2 - 0.05)] });
  b.add(new BoxGeometry(w + 0.2, 0.26, 0.3), timber, { pos: [0, h + 0.2, d / 2 + 0.02] });
  // Chimney
  const cx = rng.range(-w * 0.3, w * 0.3);
  b.add(new BoxGeometry(0.7, roofH + 0.6, 0.7), C('#8A7F78'), { pos: [cx, h + 0.3 + (roofH + 0.6) / 2, -d * 0.18] });
  b.add(new BoxGeometry(0.85, 0.25, 0.85), C('#5C5560'), { pos: [cx, h + 0.95 + roofH, -d * 0.18] });
  // Door, windows (emissive), flower box
  b.add(new BoxGeometry(1.0, 1.8, 0.15), C(rng.pick(['#8A6A4F', '#5B4A7A', '#4C6B78', '#C25F55'])), { pos: [rng.range(-w * 0.25, w * 0.25), 1.2, d / 2 + 0.05] });
  const winCol = C(PALETTE.wick);
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(1.05, 1.05, 0.1), C('#5A4636'), { pos: [side * w * 0.3, h * 0.62 + 0.3, d / 2 + 0.03] });
    b.add(new BoxGeometry(0.85, 0.85, 0.12), winCol, { pos: [side * w * 0.3, h * 0.62 + 0.3, d / 2 + 0.06] }, { emissive: 1 });
    b.add(new BoxGeometry(0.08, 0.85, 0.14), C('#5A4636'), { pos: [side * w * 0.3, h * 0.62 + 0.3, d / 2 + 0.08] });
    b.add(new BoxGeometry(1.05, 0.14, 0.25), C('#6E5A48'), { pos: [side * w * 0.3, h * 0.62 - 0.2, d / 2 + 0.12] });
    b.add(new BoxGeometry(0.12, 0.85, 0.85), winCol, { pos: [side * (w / 2 + 0.06), h * 0.6 + 0.3, rng.range(-d * 0.2, d * 0.2)] }, { emissive: 1 });
  }
  b.add(new BoxGeometry(1.1, 0.3, 0.3), C(PALETTE.coral), { pos: [-w * 0.3, h * 0.62 - 0.05, d / 2 + 0.2] });
  return b.build();
}

// ---------------------------------------------------------------- vegetation & rocks
export function buildPine(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.06);
  const tiers = rng.int(3, 4);
  const hgt = rng.range(5.5, 8.5);
  b.add(new CylinderGeometry(0.22, 0.32, hgt * 0.35, 5), C(PALETTE.driftwood), { pos: [0, hgt * 0.17, 0] });
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1 - t * 0.65) * rng.range(1.7, 2.2);
    const y = hgt * (0.28 + t * 0.62);
    const col = C(PALETTE.pine).lerp(C(PALETTE.moss), 0.15 + t * 0.35);
    b.add(Builder.wobble(new ConeGeometry(r, hgt * 0.42, 7, 1), 0.12, seed + i), col, { pos: [0, y, 0], rot: [0, rng.range(0, 6), 0] });
  }
  return b.build();
}

export function buildRoundTree(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.07);
  const hgt = rng.range(3.5, 5.5);
  b.add(new CylinderGeometry(0.22, 0.34, hgt, 5), C(PALETTE.driftwood), { pos: [0, hgt / 2, 0], rot: [rng.range(-0.08, 0.08), 0, rng.range(-0.08, 0.08)] });
  const blobs = rng.int(2, 4);
  for (let i = 0; i < blobs; i++) {
    const r = rng.range(1.3, 2.1);
    const col = C(PALETTE.moss).lerp(C('#9DBA66'), rng.range(0, 0.5));
    b.add(Builder.wobble(new IcosahedronGeometry(r, 0), 0.25, seed * 7 + i), col, { pos: [rng.range(-1, 1), hgt + rng.range(-0.3, 1.0), rng.range(-1, 1)] });
  }
  return b.build();
}

export function buildRock(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.08);
  const col = C(PALETTE.slate).lerp(C('#8D8A86'), rng.range(0, 0.5));
  b.add(Builder.wobble(new DodecahedronGeometry(1, 0), 0.3, seed), col, { scale: [rng.range(0.9, 1.6), rng.range(0.6, 1.1), rng.range(0.9, 1.5)], rot: [0, rng.range(0, 6), 0] });
  return b.build();
}

export function buildGrassTuft(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.1);
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, Math.PI * 2);
    b.add(new ConeGeometry(0.09, rng.range(0.5, 0.9), 3), C('#88A85A').lerp(C(PALETTE.moss), rng.next()), { pos: [Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18], rot: [rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)] });
  }
  return b.build();
}

export function buildHeather(seed: number): BufferGeometry {
  const rng = new Rng(seed);
  const b = new Builder(seed, 0.12);
  b.add(Builder.wobble(new IcosahedronGeometry(0.55, 0), 0.12, seed), C('#55704A'), { pos: [0, 0.1, 0], scale: [1.3, 0.55, 1.3] });
  const n = rng.int(7, 11);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(0, 0.6);
    const col = C(PALETTE.heather).lerp(C('#B98AD6'), rng.next() * 0.7);
    b.add(new ConeGeometry(0.12, rng.range(0.5, 0.95), 4), col, { pos: [Math.cos(a) * r, 0.45, Math.sin(a) * r], rot: [rng.range(-0.25, 0.25), 0, rng.range(-0.25, 0.25)] });
  }
  return b.build();
}

export function buildArch(seed = 4): BufferGeometry {
  const b = new Builder(seed, 0.08);
  const rockC = (c: Vector3) => C(PALETTE.slate).lerp(C('#8C7C74'), Math.max(0, Math.min(1, c.y / 22))).lerp(C('#3E4450'), c.y < 1 ? 0.5 : 0);
  b.add(Builder.wobble(new TorusGeometry(10, 3.4, 6, 10, Math.PI), 1.1, seed), rockC, { pos: [0, 0, 0], scale: [1, 1.25, 1] });
  b.add(Builder.wobble(new CylinderGeometry(4.2, 5.6, 8, 7), 1.0, seed + 1), rockC, { pos: [-10, -2, 0] });
  b.add(Builder.wobble(new CylinderGeometry(3.8, 5.2, 8, 7), 1.0, seed + 2), rockC, { pos: [10, -2, 0] });
  b.add(Builder.wobble(new IcosahedronGeometry(3.4, 0), 0.8, seed + 3), C('#4F7A45'), { pos: [-3, 13.2, 0], scale: [1.4, 0.45, 1.1] });
  return b.build();
}

// ---------------------------------------------------------------- dock, lanterns, boats
export function buildLanternPost(): BufferGeometry {
  const b = new Builder(5, 0.03);
  b.add(new CylinderGeometry(0.1, 0.13, 2.6, 5), C('#3A3442'), { pos: [0, 1.3, 0] });
  b.add(new BoxGeometry(0.8, 0.08, 0.08), C('#3A3442'), { pos: [0.35, 2.55, 0] });
  b.add(new CylinderGeometry(0.2, 0.26, 0.45, 6), C(PALETTE.wick), { pos: [0.68, 2.25, 0] }, { emissive: 1.6 });
  b.add(new ConeGeometry(0.3, 0.25, 6), C('#3A3442'), { pos: [0.68, 2.58, 0] });
  return b.build();
}

export function buildRowboat(seed = 9): BufferGeometry {
  const b = new Builder(seed, 0.04);
  const hull = new SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  b.add(hull, C('#4C6B78'), { scale: [0.95, 0.55, 2.4] });
  b.add(new CylinderGeometry(0.92, 0.92, 0.12, 8, 1, true), C(PALETTE.bone), { pos: [0, -0.02, 0], scale: [1, 1, 2.5] });
  b.add(new BoxGeometry(1.6, 0.08, 0.35), C(PALETTE.driftwood), { pos: [0, -0.15, 0.3] });
  b.add(new BoxGeometry(1.3, 0.08, 0.35), C(PALETTE.driftwood), { pos: [0, -0.15, -1.1] });
  b.add(new BoxGeometry(0.06, 0.06, 2.4), C(PALETTE.driftwood), { pos: [0.5, 0.0, 0], rot: [0, 0.1, 0.2] });
  return b.build();
}

export interface DockBuild { group: Group; lanternPositions: Vector3[]; endPoint: Vector3; deckY: number }
/** The dock's first metres widen into a landing where the stall and notice board stand. */
export const LANDING = DOCK.landing, LANDING_HALF = DOCK.landingHalf;

export function buildDock(hf: Heightfield, start: { x: number; z: number }, yaw: number, length: number): DockBuild {
  const b = new Builder(21, 0.07);
  const dir = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const side = new Vector3(dir.z, 0, -dir.x);
  const deckY = DOCK.deckY;
  const width = DOCK.width;
  const wood = C(PALETTE.driftwood), woodDark = C('#6E5440'), woodLight = C('#A08062');
  const plankStep = 0.5;
  const rng = new Rng(77);
  const plankAt = (t: number, w: number, extraSide = 0) => {
    const p = new Vector3(start.x, 0, start.z).addScaledVector(dir, t).addScaledVector(side, extraSide);
    const col = rng.chance(0.15) ? woodDark : rng.chance(0.2) ? woodLight : wood;
    b.add(new BoxGeometry(w, 0.14, plankStep * 0.86), col, { pos: [p.x, deckY + rng.range(-0.025, 0.025), p.z], rot: [0, yaw, rng.range(-0.02, 0.02)] });
  };
  for (let t = -6; t < length; t += plankStep) plankAt(t, t >= 0 && t < LANDING ? LANDING_HALF * 2 : width);
  // T-shaped end platform
  for (let t = length; t < length + 5; t += plankStep) plankAt(t, width * 2.6);
  // Posts down to the seabed
  const postAt = (t: number, s: number) => {
    const p = new Vector3(start.x, 0, start.z).addScaledVector(dir, t).addScaledVector(side, s);
    const ground = Math.min(hf.height(p.x, p.z), deckY - 0.5);
    const top = deckY + 0.35;
    const hgt = top - ground + 0.5;
    b.add(new CylinderGeometry(0.2, 0.24, hgt, 6), woodDark, { pos: [p.x, ground - 0.5 + hgt / 2, p.z] });
  };
  for (let t = 8; t <= length; t += 4) { postAt(t, width / 2); postAt(t, -width / 2); }
  for (const t of [0.2, 3.2, 6.3]) for (const s of [-LANDING_HALF + 0.2, -1.4, 1.4, LANDING_HALF - 0.2]) postAt(t, s);
  postAt(length + 4.8, width * 1.25); postAt(length + 4.8, -width * 1.25);
  postAt(length + 0.2, width * 1.25); postAt(length + 0.2, -width * 1.25);
  // Side rails (rope look)
  for (const s of [-1, 1]) {
    const p = new Vector3(start.x, 0, start.z).addScaledVector(dir, length / 2).addScaledVector(side, (s * width) / 2);
    b.add(new BoxGeometry(0.08, 0.08, length), C('#C9B48E'), { pos: [p.x, deckY + 0.75, p.z], rot: [0, yaw, 0] });
  }
  // Crates, barrel, net pile near the end
  const prop = (t: number, s: number, geo: BufferGeometry, col: Color, y = 0.35, rot = 0) => {
    const p = new Vector3(start.x, 0, start.z).addScaledVector(dir, t).addScaledVector(side, s);
    b.add(geo, col, { pos: [p.x, deckY + y, p.z], rot: [0, yaw + rot, 0] });
  };
  prop(10, -0.95, Builder.wobble(new IcosahedronGeometry(0.55, 0), 0.15, 3), C('#C9B48E'), 0.3);

  const group = new Group();
  const mesh = new Mesh(b.build(), createPropMaterial());
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  // Lantern posts
  const lanternGeo = buildLanternPost();
  const lanternPositions: Vector3[] = [];
  const lmat = createPropMaterial();
  for (const [t, s] of [[6.6, 1.45], [length * 0.5, -1.45], [length + 4.6, 3.4]] as const) {
    const p = new Vector3(start.x, deckY + 0.07, start.z).addScaledVector(dir, t).addScaledVector(side, s);
    const lp = new Mesh(lanternGeo, lmat);
    lp.position.copy(p);
    lp.rotation.y = yaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
    lp.castShadow = true;
    group.add(lp);
    lp.updateMatrixWorld();
    lanternPositions.push(new Vector3(0.68, 2.25, 0).applyMatrix4(lp.matrixWorld));
  }
  const endPoint = new Vector3(start.x, deckY, start.z).addScaledVector(dir, length + 2.5);
  return { group, lanternPositions, endPoint, deckY };
}

// ---------------------------------------------------------------- harbour
/** Mara's fish stall (TEMPORARY until the generated stall model lands). Front faces +Z, origin at the base centre. */
export function buildStall(seed = 31): BufferGeometry {
  const b = new Builder(seed, 0.05);
  const wood = C(PALETTE.driftwood), dark = C('#6E5440');
  b.add(new BoxGeometry(2.6, 0.95, 1.0), wood, { pos: [0, 0.48, 0.05] });
  b.add(new BoxGeometry(2.75, 0.08, 1.15), C('#A08062'), { pos: [0, 0.99, 0.08] });
  for (const x of [-1.25, 1.25]) for (const z of [-0.45, 0.55]) b.add(new BoxGeometry(0.12, 2.5, 0.12), dark, { pos: [x, 1.25, z] });
  // Striped awning sloping toward the front.
  const stripes = 9;
  for (let i = 0; i < stripes; i++) {
    const x = -1.4 + (2.8 / stripes) * (i + 0.5);
    b.add(new BoxGeometry(2.8 / stripes, 0.05, 1.5), C(i % 2 ? PALETTE.bone : PALETTE.coral), { pos: [x, 2.45, 0.2], rot: [0.32, 0, 0] });
    b.add(new BoxGeometry(2.8 / stripes, 0.22, 0.04), C(i % 2 ? PALETTE.bone : PALETTE.coral), { pos: [x, 2.12, 0.92] });
  }
  // Ice trays with fish.
  for (const [x, col] of [[-0.75, '#E8B24A'], [0, '#E86F6F'], [0.75, '#3FA7A0']] as const) {
    b.add(new BoxGeometry(0.62, 0.12, 0.62), C('#DCEFF0'), { pos: [x, 1.08, 0.12] });
    for (let k = 0; k < 3; k++) b.add(new SphereGeometry(0.1, 6, 4), C(col), { pos: [x - 0.16 + k * 0.16, 1.17, 0.1 + (k % 2) * 0.12], scale: [0.6, 0.5, 1.6], rot: [0, 0.3 * k, 0] });
  }
  // Chalk price board and a hanging scale.
  b.add(new BoxGeometry(0.7, 0.5, 0.05), C('#2F3A3A'), { pos: [0.9, 1.75, 0.6], rot: [0.1, 0, 0] });
  b.add(new BoxGeometry(0.6, 0.04, 0.06), C('#E8E2D0'), { pos: [0.9, 1.85, 0.63], rot: [0.1, 0, 0] });
  b.add(new BoxGeometry(0.45, 0.04, 0.06), C('#E8E2D0'), { pos: [0.85, 1.7, 0.64], rot: [0.1, 0, 0] });
  b.add(new CylinderGeometry(0.012, 0.012, 0.5, 4), C('#3A3442'), { pos: [-0.9, 1.95, 0.6] });
  b.add(new CylinderGeometry(0.16, 0.16, 0.06, 10), C(PALETTE.slate), { pos: [-0.9, 1.68, 0.6], rot: [Math.PI / 2, 0, 0] });
  b.add(new CylinderGeometry(0.2, 0.14, 0.08, 8), C('#C9B48E'), { pos: [-0.9, 1.5, 0.6] });
  // Crates stacked at the side.
  b.add(new BoxGeometry(0.6, 0.5, 0.6), C('#9C7A58'), { pos: [-1.65, 0.25, 0.2], rot: [0, 0.2, 0] });
  b.add(new BoxGeometry(0.5, 0.42, 0.5), C('#B08B63'), { pos: [-1.6, 0.71, 0.18], rot: [0, -0.3, 0] });
  return b.build();
}

/** The village notice board (TEMPORARY until the generated model lands). Front faces +Z. */
export function buildNoticeBoard(seed = 33): BufferGeometry {
  const b = new Builder(seed, 0.05);
  const dark = C('#6E5440');
  for (const x of [-0.75, 0.75]) b.add(new BoxGeometry(0.13, 2.2, 0.13), dark, { pos: [x, 1.1, 0] });
  b.add(new BoxGeometry(1.6, 1.0, 0.08), C(PALETTE.driftwood), { pos: [0, 1.35, 0.04] });
  b.add(new BoxGeometry(1.8, 0.06, 0.6), C(PALETTE.heather), { pos: [0, 2.3, 0.05], rot: [0.35, 0, 0] });
  b.add(new BoxGeometry(1.8, 0.06, 0.6), C(PALETTE.heather), { pos: [0, 2.3, -0.12], rot: [-0.35, 0, 0] });
  const rnd = () => b.random();
  for (let i = 0; i < 7; i++) {
    b.add(new BoxGeometry(0.26 + rnd() * 0.12, 0.3 + rnd() * 0.12, 0.01), C(i % 3 ? PALETTE.bone : '#EAD6B4'), { pos: [-0.6 + (i % 4) * 0.38 + rnd() * 0.06, 1.12 + Math.floor(i / 4) * 0.42 + rnd() * 0.05, 0.095], rot: [0, 0, (rnd() - 0.5) * 0.25] });
  }
  b.add(new BoxGeometry(0.05, 0.05, 0.06), C(PALETTE.coral), { pos: [-0.5, 1.5, 0.11] });
  return b.build();
}

// ---------------------------------------------------------------- scattering
export interface Scatter { group: Group; houses: Vector3[] }

function instanced(geos: BufferGeometry[], mats: Matrix4[][], mat: MeshStandardMaterial, cast = true): InstancedMesh[] {
  return geos.map((g, i) => {
    const im = new InstancedMesh(g, mat, Math.max(1, mats[i].length));
    mats[i].forEach((m, k) => im.setMatrixAt(k, m));
    im.count = mats[i].length;
    im.castShadow = cast; im.receiveShadow = true;
    im.computeBoundingSphere();
    return im;
  });
}

export function scatterIsland(hf: Heightfield, opts: { villageCenter: Vector3; villageRadius: number; avoid: Vector3[]; seed: number }): Scatter {
  const rng = new Rng(opts.seed);
  const group = new Group();
  const mat = createPropMaterial();
  const houses: Vector3[] = [];
  const blocked: { p: Vector3; r: number }[] = opts.avoid.map((p) => ({ p, r: 12 }));
  // Keep paths and paved yards clear of houses, trees and boulders.
  const paved = (x: number, z: number, r: number) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([ox, oz]) => hf.surfaceAt(x + ox, z + oz).w > 0.01);
  const free = (p: Vector3, r: number) => blocked.every((b) => b.p.distanceTo(p) > b.r + r) && !paved(p.x, p.z, r);
  const slopeOk = (x: number, z: number, minNy: number) => hf.normal(x, z, 1.5)[1] > minNy;
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), s = new Vector3();
  const place = (x: number, y: number, z: number, yaw: number, sc: number) => { e.set(0, yaw, 0); q.setFromEuler(e); s.setScalar(sc); return m.clone().compose(new Vector3(x, y, z), q, s); };

  // Village: cottages on gentle ground facing roughly toward the bay.
  const cottageMats: Matrix4[][] = [];
  const cottageGeos: BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) { cottageGeos.push(buildCottage(opts.seed * 13 + k)); cottageMats.push([]); }
  for (let tries = 0; tries < 900 && houses.length < 11; tries++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * opts.villageRadius;
    const x = opts.villageCenter.x + Math.cos(a) * r, z = opts.villageCenter.z + Math.sin(a) * r;
    const y = hf.height(x, z);
    if (y < 2.6 || y > 16 || !slopeOk(x, z, 0.9)) continue;
    const p = new Vector3(x, y, z);
    if (!free(p, 6)) continue;
    blocked.push({ p, r: 5.5 });
    houses.push(p);
    const toBay = Math.atan2(opts.villageCenter.x - 60 - x, opts.villageCenter.z - z) + rng.range(-0.5, 0.5);
    cottageMats[houses.length % 4].push(place(x, y - 0.2, z, toBay, 1));
  }
  instanced(cottageGeos, cottageMats, mat).forEach((im) => group.add(im));

  // Trees and rocks over the whole region's land.
  const pineGeos = [0, 1, 2].map((k) => buildPine(opts.seed * 3 + k));
  const roundGeos = [0, 1, 2].map((k) => buildRoundTree(opts.seed * 5 + k));
  const rockGeos = [0, 1, 2, 3].map((k) => buildRock(opts.seed * 11 + k));
  const tuftGeos = [buildGrassTuft(opts.seed), buildHeather(opts.seed + 1), buildHeather(opts.seed + 2)];
  const pineM: Matrix4[][] = [[], [], []], roundM: Matrix4[][] = [[], [], []], rockM: Matrix4[][] = [[], [], [], []], tuftM: Matrix4[][] = [[], [], []];
  const R = hf.region.radius;
  const cx = hf.region.center[0], cz = hf.region.center[1];
  for (let i = 0; i < 26000; i++) {
    const x = cx + rng.range(-R, R), z = cz + rng.range(-R, R);
    const y = hf.height(x, z);
    if (y < -3.5) continue;
    if (y < 1.8) {
      // Chunky shore boulders, some half-submerged and visible through the shallows.
      if (rng.chance(y < 0 ? 0.01 : 0.03)) {
        const p0 = new Vector3(x, y, z);
        if (free(p0, 2)) { blocked.push({ p: p0, r: 2 }); rockM[rng.int(0, 3)].push(place(x, y - 0.4, z, rng.range(0, 6.3), rng.range(1.4, 3.8))); }
      }
      if (y < 0.4) continue;
    }
    const ny = hf.normal(x, z, 1.2)[1];
    const p = new Vector3(x, y, z);
    const nearVillage = p.distanceTo(opts.villageCenter) < opts.villageRadius * 0.8;
    if (y > 2.4 && ny > 0.8) {
      const dens = 0.5 + 0.5 * Math.sin(x * 0.021 + Math.cos(z * 0.017) * 2.0);
      if (rng.chance(0.06 * dens * (nearVillage ? 0.25 : 1)) && free(p, 2.5)) {
        blocked.push({ p, r: 1.6 });
        if (y > 9 || rng.chance(0.45)) pineM[rng.int(0, 2)].push(place(x, y - 0.2, z, rng.range(0, 6.3), rng.range(0.8, 1.3)));
        else roundM[rng.int(0, 2)].push(place(x, y - 0.1, z, rng.range(0, 6.3), rng.range(0.8, 1.25)));
        continue;
      }
      if (rng.chance(0.05) && free(p, 0.5)) tuftM[0].push(place(x, y - 0.05, z, rng.range(0, 6.3), rng.range(0.8, 1.5)));
      const heath = Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.043) + (ny < 0.9 ? 0.4 : 0);
      if (heath > 0.55 && rng.chance(0.09) && free(p, 0.8)) tuftM[rng.int(1, 2)].push(place(x, y - 0.1, z, rng.range(0, 6.3), rng.range(0.8, 1.4)));
    }
    if ((ny < 0.78 && rng.chance(0.06)) || (y < 1.6 && rng.chance(0.012))) {
      if (free(p, 1)) rockM[rng.int(0, 3)].push(place(x, y - 0.3, z, rng.range(0, 6.3), rng.range(0.6, 2.4)));
    }
  }
  [...instanced(pineGeos, pineM, mat), ...instanced(roundGeos, roundM, mat), ...instanced(rockGeos, rockM, mat), ...instanced(tuftGeos, tuftM, mat, false)].forEach((im) => group.add(im));
  return { group, houses };
}

export function addLanternLight(parent: Object3D, pos: Vector3, intensity = 6, distance = 16): PointLight {
  const l = new PointLight(new Color(PALETTE.lantern), intensity, distance, 1.6);
  l.position.copy(pos);
  parent.add(l);
  return l;
}
