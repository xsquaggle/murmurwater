/**
 * Low-poly terrain from the shared heightfield: one faceted mesh per region, coloured per face
 * from the palette, with animated caustics on the underwater parts. Also bakes the seabed
 * heightmap texture the water shader reads for depth colour and foam.
 */
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, ClampToEdgeWrapping,
  Mesh, MeshStandardMaterial, RedFormat, Vector4,
} from 'three';
import { Heightfield } from '../core/world';
import { Noise2D } from '../core/noise';
import { PALETTE } from './palette';
import { NOISE_GLSL } from './shaders/common.glsl';

export interface TerrainBuild {
  mesh: Mesh;
  heightTex: DataTexture;
  heightBounds: Vector4;
  material: MeshStandardMaterial;
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

const hash2 = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function buildTerrain(hf: Heightfield, cell = 4): TerrainBuild {
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
  }

  const sand = new Color(PALETTE.bone).lerp(new Color('#E2C796'), 0.55);
  const wetSand = new Color('#C9AE82');
  const seaSand = new Color('#B8A27C');
  const deepFloor = new Color(PALETTE.murmur).lerp(new Color(PALETTE.abyss), 0.4);
  const moss = new Color(PALETTE.moss).lerp(new Color('#5E9A48'), 0.45);
  const mossLight = new Color('#94BC5C');
  const pine = new Color(PALETTE.pine);
  const rock = new Color(PALETTE.slate);
  const rockDark = new Color('#4A505E');
  const rockWarm = new Color('#7A7068');
  const rockLight = new Color('#8E8A86');
  const cobble = new Color('#A99E8C'), cobbleDark = new Color('#8C8272');
  const dirt = new Color('#A88A66'), dirtLight = new Color('#BFA27A');

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  /** Per face: (cobble weight, dirt weight) for the close-up ground detail in the shader. */
  const surfs: number[] = [];
  const c = new Color();
  const pushTri = (a: number, b: number, d: number) => {
    const ax = vx[a], ay = vy[a], az = vz[a];
    const bx = vx[b], by = vy[b], bz = vz[b];
    const dx = vx[d], dy = vy[d], dz = vz[d];
    if (ay < -18 && by < -18 && dy < -18) return; // hidden under opaque deep water
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
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, cc = a + (n + 1), d = cc + 1;
      if ((i + j) % 2 === 0) { pushTri(a, cc, b); pushTri(b, cc, d); }
      else { pushTri(a, cc, d); pushTri(a, d, b); }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute('aSurf', new BufferAttribute(new Float32Array(surfs), 2));
  geo.computeBoundingSphere();

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
  const mesh = new Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  // Seabed heightmap for the water shader.
  const res = 512;
  const data = new Uint16Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = minX + ((i + 0.5) / res) * half * 2;
      const z = minZ + ((j + 0.5) / res) * half * 2;
      data[j * res + i] = DataUtils.toHalfFloat(hf.height(x, z));
    }
  }
  const heightTex = new DataTexture(data, res, res, RedFormat, HalfFloatType);
  heightTex.magFilter = LinearFilter; heightTex.minFilter = LinearFilter;
  heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping;
  heightTex.needsUpdate = true;

  return { mesh, heightTex, heightBounds: new Vector4(minX, minZ, half * 2, half * 2), material };
}
