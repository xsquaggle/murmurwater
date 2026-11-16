/**
 * Low-poly terrain from the shared heightfield: the land and the bed under the water (a child of the land's
 * mesh), faceted, coloured per face from the palette, with animated caustics on the underwater parts. Also bakes the seabed
 * heightmap texture the water shader reads for depth colour and foam.
 */
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, ClampToEdgeWrapping,
  Mesh, MeshStandardMaterial, RedFormat, Vector4,
} from 'three';
import { Heightfield } from '../core/world';
import { Noise2D } from '../core/noise';
import { lookOf, type TerrainLook } from './looks';
import { NOISE_GLSL } from './shaders/common.glsl';

export interface TerrainBuild {
  mesh: Mesh;
  heightTex: DataTexture;
  heightBounds: Vector4;
  material: MeshStandardMaterial;
  /** Ground height from the seabed grid: quick, and good to about a metre and a half. */
  heightAt: (x: number, z: number) => number;
}

/**
 * Close-up ground detail, multiplied into the flat facet colour and faded out by ~70 m so distant
 * terrain keeps its clean low-poly read: cobblestones on paved yards, speckle on dirt paths, and a
 * faint grain everywhere above the waterline so big faces don't look like flat paint.
 */
const GROUND_DETAIL_GLSL = /* glsl */ `
vec2 mw_hash22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// x: distance to the nearest cell edge (approx.), y: a random value per cell
vec2 mw_voronoi(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = mw_hash22(n + g);
    vec2 r = g + 0.15 + o * 0.7 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = fract(o.x * 7.13 + o.y * 3.71); } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d2) - sqrt(d1), id);
}
vec3 mw_groundDetail(vec3 wp, vec2 surf, float dist) {
  float fade = 1.0 - smoothstep(22.0, 70.0, dist);
  if (fade <= 0.0 || wp.y < -0.3) return vec3(1.0);
  vec2 p = wp.xz;
  float k = 0.95 + 0.1 * (mw_vnoise(p * 1.3) * 0.6 + mw_vnoise(p * 4.3) * 0.4);
  if (surf.x > 0.01) {
    vec2 v = mw_voronoi(p / 0.46);
    float stone = 0.84 + 0.26 * v.y + 0.06 * mw_vnoise(p * 9.0);
    float c = mix(0.6, stone, smoothstep(0.035, 0.11, v.x));
    k *= mix(1.0, c, surf.x);
  }
  if (surf.y > 0.01) {
    float speck = smoothstep(0.78, 0.86, mw_vnoise(p * 6.5)) * 0.14 - smoothstep(0.8, 0.9, mw_vnoise(p * 5.1 + 7.3)) * 0.1;
    k *= mix(1.0, 0.92 + 0.12 * mw_vnoise(p * 1.9) + speck, surf.y);
  }
  return vec3(mix(1.0, k, fade));
}
`;

/** Faces wholly below this are the bed: drawn, but they throw no shadow. */
const BED_TOP = -0.3;
/** Blocks of this many cells a side are drawn as one fan where the bed is well under water and nearly level. */
const BLOCK = 4, BED_FLAT_TOP = -1.2;
/** How far a block's bed may rise and fall and still be drawn as a fan: more, the deeper it lies. */
const flatEnough = (lo: number, hi: number) => hi - lo < 0.35 + 0.3 * -hi;

const hash2 = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function buildTerrain(hf: Heightfield, cell = 4, look: TerrainLook = lookOf('amber').terrain): TerrainBuild {
  const steps = terrainSteps(hf, cell, look);
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}

/**
 * The same build a little at a time: each `next()` does a row or so of the work (well under a millisecond,
 * but for the last few, which make the meshes), so a region can be made ready over many frames while the
 * boat is still in the fog on her way to it.
 */
export function* terrainSteps(hf: Heightfield, cell = 4, look: TerrainLook = lookOf('amber').terrain): Generator<void, TerrainBuild, void> {
  const r = hf.region;
  const half = r.radius;
  const minX = r.center[0] - half, minZ = r.center[1] - half;
  const n = Math.ceil((half * 2) / cell);
  const colNoise = new Noise2D(77);

  // Jittered lattice: low-poly facets that don't read as a grid.
  const vx = new Float32Array((n + 1) * (n + 1));
  const vz = new Float32Array((n + 1) * (n + 1));
  const vy = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const edge = i === 0 || j === 0 || i === n || j === n;
      const jx = edge ? 0 : (hash2(i, j) - 0.5) * cell * 0.62;
      const jz = edge ? 0 : (hash2(j + 91, i + 17) - 0.5) * cell * 0.62;
      const x = minX + i * cell + jx, z = minZ + j * cell + jz;
      vx[k] = x; vz[k] = z; vy[k] = hf.height(x, z);
    }
    yield;
  }
  // Smooth normals from the heightfield; the shader mixes them with the facet normal so faces stay
  // visibly low-poly without the hard light jumps of pure flat shading on big slopes.
  const vn = new Float32Array((n + 1) * (n + 1) * 3);
  const at = (i: number, j: number) => Math.min(n, Math.max(0, j)) * (n + 1) + Math.min(n, Math.max(0, i));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const xa = at(i - 1, j), xb = at(i + 1, j), za = at(i, j - 1), zb = at(i, j + 1);
      const gx = (vy[xb] - vy[xa]) / (vx[xb] - vx[xa]), gz = (vy[zb] - vy[za]) / (vz[zb] - vz[za]);
      const l = Math.hypot(gx, 1, gz);
      vn[k * 3] = -gx / l; vn[k * 3 + 1] = 1 / l; vn[k * 3 + 2] = -gz / l;
    }
    if (j % 32 === 31) yield;
  }

  const sand = new Color(look.sand);
  const wetSand = new Color(look.wetSand);
  const seaSand = new Color(look.seaSand);
  const deepFloor = new Color(look.deepFloor);
  const moss = new Color(look.moss);
  const mossLight = new Color(look.mossLight);
  const pine = new Color(look.pine);
  const rock = new Color(look.rock);
  const rockDark = new Color(look.rockDark);
  const rockWarm = new Color(look.rockWarm);
  const rockLight = new Color(look.rockLight);
  const reedBed = look.reedBed ? new Color(look.reedBed) : null;
  const cobble = new Color('#A99E8C'), cobbleDark = new Color('#8C8272');
  const dirt = new Color('#A88A66'), dirtLight = new Color('#BFA27A');

  // Two meshes of the same stuff: the land, which throws shadows, and the bed under the water, which does not.
  interface Soup { positions: number[]; normals: number[]; colors: number[]; /** Per face: (cobble weight, dirt weight) for the close-up ground detail in the shader. */ surfs: number[] }
  const soup = (): Soup => ({ positions: [], normals: [], colors: [], surfs: [] });
  const land = soup(), bed = soup();
  const c = new Color();
  const pushTri = (a: number, b: number, d: number) => {
    const ax = vx[a], ay = vy[a], az = vz[a];
    const bx = vx[b], by = vy[b], bz = vz[b];
    const dx = vx[d], dy = vy[d], dz = vz[d];
    if (ay < -18 && by < -18 && dy < -18) return; // hidden under opaque deep water
    const { positions, normals, colors, surfs } = ay < BED_TOP && by < BED_TOP && dy < BED_TOP ? bed : land;
    // Face normal
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = dx - ax, wy = dy - ay, wz = dz - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ny < 0) ny = -ny;
    // Classify by a blend of the facet and the smooth surface slope, so small facets on a grassy
    // slope don't flicker between grass and rock.
    ny = ny * 0.4 + ((vn[a * 3 + 1] + vn[b * 3 + 1] + vn[d * 3 + 1]) / 3) * 0.6;
    const cx = (ax + bx + dx) / 3, cy = (ay + by + dy) / 3, cz = (az + bz + dz) / 3;
    const v = colNoise.fbm(cx * 0.02, cz * 0.02, 3);
    const jit = 1 + (hash2(cx, cz) - 0.5) * 0.08;
    if (cy < -0.4) {
      const depth = -cy;
      c.copy(seaSand).lerp(deepFloor, Math.min(1, Math.max(0, (depth - 1.5) / 14)));
      if (ny < 0.75) c.lerp(rockDark, 0.5);
      // The flanks of a reed bed take its colour as they rise to it.
      if (reedBed && depth < 1.6) c.lerp(reedBed, 1 - (depth - 0.4) / 1.2);
    } else if (reedBed && cy < 0.05) {
      // A reed bed: a mat of roots and old stems just under the water, mottled.
      c.copy(reedBed).lerp(wetSand, Math.max(0, v) * 0.5).lerp(pine, Math.max(0, -v) * 0.35);
    } else if (cy < 1.1) {
      c.copy(wetSand).lerp(sand, Math.min(1, (cy + 0.4) / 1.5));
    } else if (cy < 2.4 && ny > 0.82) {
      c.copy(sand).lerp(moss, (cy - 1.1) / 1.3 * (0.6 + 0.4 * v));
    } else {
      c.copy(moss).lerp(mossLight, Math.max(0, v) * 0.9);
      if (v < -0.25) c.lerp(pine, Math.min(1, (-v - 0.25) * 2.2));
      if (cy > 18) c.lerp(mossLight, Math.min(0.4, (cy - 18) / 12));
    }
    if (cy > 0.6 && ny < 0.74) {
      // Rock with sedimentary bands so big cliff faces read as layered stone, not flat paint.
      const band = Math.sin(cy * 1.7 + v * 2.2) * 0.5 + 0.5;
      c.copy(rock).lerp(rockWarm, Math.max(0, v + 0.2) * 0.6).lerp(rockLight, band * 0.35);
      if (ny < 0.55) c.lerp(rockDark, 0.4);
    }
    const surf = hf.surfaceAt(cx, cz);
    const sw = surf.kind && cy > -0.2 ? surf.w : 0;
    for (let t = 0; t < 3; t++) surfs.push(surf.kind === 'cobble' ? sw : 0, surf.kind === 'dirt' ? sw : 0);
    if (surf.kind && cy > -0.2) c.lerp(surf.kind === 'cobble' ? (hash2(cx * 3.1, cz * 1.7) > 0.5 ? cobble : cobbleDark) : (hash2(cx, cz * 2.3) > 0.6 ? dirtLight : dirt), surf.w * 0.92);
    c.multiplyScalar(jit);
    positions.push(ax, ay, az, bx, by, bz, dx, dy, dz);
    for (const k of [a, b, d]) normals.push(vn[k * 3], vn[k * 3 + 1], vn[k * 3 + 2]);
    for (let t = 0; t < 3; t++) colors.push(c.r, c.g, c.b);
  };
  // A flat stretch of bed needs few faces. The lattice is cut into blocks of BLOCK cells a side; a block that
  // is all under water and nearly level is drawn as a fan about its middle, taking in the lattice points along
  // any side it shares with a block drawn in full, so the two meet without a crack.
  const nb = Math.ceil(n / BLOCK);
  const flat = new Uint8Array(nb * nb);
  for (let bj = 0; bj < nb; bj++) for (let bi = 0; bi < nb; bi++) {
    const i0 = bi * BLOCK, j0 = bj * BLOCK;
    if (i0 + BLOCK > n || j0 + BLOCK > n) continue;
    let lo = Infinity, hi = -Infinity;
    for (let j = j0; j <= j0 + BLOCK; j++) for (let i = i0, k = j * (n + 1) + i0; i <= i0 + BLOCK; i++, k++) { const y = vy[k]; if (y < lo) lo = y; if (y > hi) hi = y; }
    if (hi < BED_FLAT_TOP && flatEnough(lo, hi)) flat[bj * nb + bi] = 1;
  }
  const isFlat = (bi: number, bj: number) => bi >= 0 && bj >= 0 && bi < nb && bj < nb && flat[bj * nb + bi] === 1;
  yield;
  const sliver = 0.04 * cell * cell;
  const faceUp = (p: number, q: number, w: number) => (vz[q] - vz[p]) * (vx[w] - vx[p]) - (vx[q] - vx[p]) * (vz[w] - vz[p]) > sliver;
  const ring: number[] = [];
  for (let bj = 0; bj < nb; bj++) for (let bi = 0; bi < nb; bi++) {
    if (bi === 0 && bj > 0) yield;
    const i0 = bi * BLOCK, j0 = bj * BLOCK;
    if (!flat[bj * nb + bi]) {
      for (let j = j0; j < Math.min(n, j0 + BLOCK); j++) for (let i = i0; i < Math.min(n, i0 + BLOCK); i++) {
        const a = j * (n + 1) + i, b = a + 1, cc = a + (n + 1), d = cc + 1;
        // The diagonal alternates like a chequerboard, unless the jitter has left that way a sliver or
        // turned a face over: then the cell is cut the other way.
        let even = (i + j) % 2 === 0;
        if (even ? !(faceUp(a, cc, b) && faceUp(b, cc, d)) : !(faceUp(a, cc, d) && faceUp(a, d, b))) even = !even;
        if (even) { pushTri(a, cc, b); pushTri(b, cc, d); }
        else { pushTri(a, cc, d); pushTri(a, d, b); }
      }
      continue;
    }
    // Round the block: down the west side, along the south, up the east, back along the north.
    const at2 = (i: number, j: number) => j * (n + 1) + i, i1 = i0 + BLOCK, j1 = j0 + BLOCK;
    ring.length = 0;
    const west = !isFlat(bi - 1, bj) && bi > 0, south = !isFlat(bi, bj + 1) && bj < nb - 1, east = !isFlat(bi + 1, bj) && bi < nb - 1, north = !isFlat(bi, bj - 1) && bj > 0;
    for (let s = 0; s < BLOCK; s += west ? 1 : BLOCK) ring.push(at2(i0, j0 + s));
    for (let s = 0; s < BLOCK; s += south ? 1 : BLOCK) ring.push(at2(i0 + s, j1));
    for (let s = 0; s < BLOCK; s += east ? 1 : BLOCK) ring.push(at2(i1, j1 - s));
    for (let s = 0; s < BLOCK; s += north ? 1 : BLOCK) ring.push(at2(i1 - s, j0));
    const mid = at2(i0 + BLOCK / 2, j0 + BLOCK / 2);
    for (let k = 0; k < ring.length; k++) pushTri(mid, ring[k], ring[(k + 1) % ring.length]);
  }
  // Packing a few hundred thousand faces takes a moment for each attribute: one a turn.
  const toGeo = function* (s: Soup): Generator<void, BufferGeometry, void> {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(s.positions), 3)); s.positions = [];
    yield;
    geo.setAttribute('color', new BufferAttribute(new Float32Array(s.colors), 3)); s.colors = [];
    yield;
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(s.normals), 3)); s.normals = [];
    yield;
    geo.setAttribute('aSurf', new BufferAttribute(new Float32Array(s.surfs), 2)); s.surfs = [];
    yield;
    geo.computeBoundingSphere();
    return geo;
  };

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  /** uFacet: 1 = pure flat shading, 0 = smooth. */
  const causticUniforms = { uTime: { value: 0 }, uCausticStrength: { value: 1 }, uFacet: { value: 0.4 } };
  material.userData.uniforms = causticUniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, causticUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMwWorld;\nattribute vec2 aSurf;\nvarying vec2 vMwSurf;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMwWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvMwSurf = aSurf;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMwWorld;\nvarying vec2 vMwSurf;\nuniform float uTime;\nuniform float uCausticStrength;\nuniform float uFacet;\n${NOISE_GLSL}\n${GROUND_DETAIL_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mw_groundDetail(vMwWorld, vMwSurf, length(vMwWorld - cameraPosition));`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec3 mwFace = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        normal = normalize(mix(normal, mwFace, uFacet));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vMwWorld.y < 0.15) {
          float dpt = max(0.0, -vMwWorld.y);
          vec2 p = vMwWorld.xz * 0.38;
          float c1 = 1.0 - abs(mw_vnoise(p + vec2(uTime * 0.21, uTime * 0.13)) * 2.0 - 1.0);
          float c2 = 1.0 - abs(mw_vnoise(p * 1.37 - vec2(uTime * 0.17, -uTime * 0.11)) * 2.0 - 1.0);
          float caus = pow(min(c1, c2), 7.0) * 1.6;
          float k = (1.0 - smoothstep(0.5, 9.0, dpt)) * smoothstep(0.0, 0.4, dpt);
          totalEmissiveRadiance += vec3(0.85, 1.0, 0.92) * caus * k * 0.55 * uCausticStrength;
        }`);
  };
  yield;
  const mesh = new Mesh(yield* toGeo(land), material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  yield;
  if (bed.positions.length) {
    const under = new Mesh(yield* toGeo(bed), material);
    under.receiveShadow = true;
    mesh.add(under);
  }
  yield;

  // Seabed heightmap for the water shader.
  const res = 512;
  const data = new Uint16Array(res * res), heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = minX + ((i + 0.5) / res) * half * 2;
      const z = minZ + ((j + 0.5) / res) * half * 2;
      const h = hf.height(x, z);
      heights[j * res + i] = h;
      data[j * res + i] = DataUtils.toHalfFloat(h);
    }
    if (j % 2 === 1) yield;
  }
  const size = half * 2;
  /** The same grid for the CPU: quick enough to ask thousands of times a frame, good to about a metre and a half. */
  const heightAt = (x: number, z: number) => {
    const fx = Math.min(res - 1.001, Math.max(0, ((x - minX) / size) * res - 0.5)), fz = Math.min(res - 1.001, Math.max(0, ((z - minZ) / size) * res - 0.5));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * res + i;
    return (heights[k] * (1 - tx) + heights[k + 1] * tx) * (1 - tz) + (heights[k + res] * (1 - tx) + heights[k + res + 1] * tx) * tz;
  };
  const heightTex = new DataTexture(data, res, res, RedFormat, HalfFloatType);
  heightTex.magFilter = LinearFilter; heightTex.minFilter = LinearFilter;
  heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping;
  heightTex.needsUpdate = true;

  return { mesh, heightTex, heightBounds: new Vector4(minX, minZ, half * 2, half * 2), material, heightAt };
}
