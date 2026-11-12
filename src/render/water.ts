/**
 * Hero water: Gerstner waves, depth-tinted colour from the seabed heightmap, banded shoreline foam,
 * sky reflection (with the uncanny second moon), stylized sun glint and distance fog.
 */
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, Mesh, ShaderMaterial, Texture, Vector2, Vector3, Vector4,
} from 'three';
import { NOISE_GLSL, SKY_FN_GLSL, SKY_UNIFORMS_GLSL } from './shaders/common.glsl';
import type { SkyUniforms } from './sky';
import { CALM_WAVES, packWaves, type Wave } from '../core/waves';
import { PALETTE } from './palette';

export interface WaterOptions {
  heightTex: DataTexture | Texture;
  heightBounds: Vector4; // minX, minZ, sizeX, sizeZ
  sky: SkyUniforms;
  segments: number;      // grid resolution (quality setting)
  waves?: Wave[];
}

/** A square grid whose vertices are densely packed near the centre (camera) and sparse far away. */
function makeWaterGeometry(segments: number, halfSize: number): BufferGeometry {
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const warp = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 3.0) * halfSize;
  let p = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (i / segments) * 2 - 1, v = (j / segments) * 2 - 1;
      pos[p++] = warp(u); pos[p++] = 0; pos[p++] = warp(v);
    }
  }
  const idx = new Uint32Array(segments * segments * 6);
  let q = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

export class Water {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private snap = 2;

  constructor(opts: WaterOptions) {
    const waves = packWaves(opts.waves ?? CALM_WAVES).map((w) => new Vector4(...w));
    const c = (h: string) => new Color(h);
    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        ...opts.sky,
        uWaves: { value: waves },
        uSeaState: { value: 0.6 },
        uHeightTex: { value: opts.heightTex },
        uHeightBounds: { value: opts.heightBounds },
        uCamPos: { value: new Vector3() },
        uFogColor: { value: new Color() },
        uFogDensity: { value: 0.001 },
        uKeyDir: { value: new Vector3(0, 1, 0) },
        uKeyColor: { value: new Color(1, 1, 1) },
        uKeyIntensity: { value: 1 },
        uAmbient: { value: new Color(0.3, 0.3, 0.4) },
        uDeep: { value: c(PALETTE.abyss) },
        uMid: { value: c(PALETTE.murmur) },
        uShallow: { value: c(PALETTE.lagoon) },
        uFoam: { value: c(PALETTE.seafoam) },
        uDetail: { value: 1 },
        uWindOffset: { value: new Vector2() },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec4 uWaves[6];
        uniform float uSeaState;
        uniform sampler2D uHeightTex;
        uniform vec4 uHeightBounds;
        uniform vec3 uCamPos;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;
        varying float vDepth;
        float seabed(vec2 xz) {
          vec2 uv = (xz - uHeightBounds.xy) / uHeightBounds.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -40.0;
          return texture2D(uHeightTex, uv).r;
        }
        void main() {
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          float dist = length(p.xz - uCamPos.xz);
          float depth = max(0.0, -seabed(p.xz));
          float fade = (1.0 - smoothstep(180.0, 1400.0, dist)) * smoothstep(0.0, 5.0, depth) * uSeaState;
          vec3 disp = vec3(0.0);
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          for (int i = 0; i < 6; i++) {
            vec4 w = uWaves[i];
            float k = 6.2831853 / w.w;
            float c = sqrt(9.8 / k);
            vec2 d = w.xy;
            float f = k * (dot(d, p.xz) - c * uTime);
            // Per-wave LOD: short waves fade out with distance so the sparse far grid never aliases.
            float lod = 1.0 - smoothstep(w.w * 3.0, w.w * 8.0, dist);
            float a = w.z / k * fade * lod;
            float st = w.z * fade * lod;
            disp.x += d.x * a * cos(f);
            disp.z += d.y * a * cos(f);
            disp.y += a * sin(f);
            tangent += vec3(-d.x * d.x * st * sin(f), d.x * st * cos(f), -d.x * d.y * st * sin(f));
            binormal += vec3(-d.x * d.y * st * sin(f), d.y * st * cos(f), -d.y * d.y * st * sin(f));
          }
          p += disp;
          vNormal = normalize(cross(binormal, tangent));
          vCrest = disp.y;
          vDepth = depth;
          vWorld = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${SKY_UNIFORMS_GLSL}
        ${NOISE_GLSL}
        ${SKY_FN_GLSL}
        uniform sampler2D uHeightTex;
        uniform vec4 uHeightBounds;
        uniform vec3 uCamPos;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform vec3 uKeyDir;
        uniform vec3 uKeyColor;
        uniform float uKeyIntensity;
        uniform vec3 uAmbient;
        uniform vec3 uDeep, uMid, uShallow, uFoam;
        uniform float uDetail;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;
        varying float vDepth;

        float seabedF(vec2 xz) {
          vec2 uv = (xz - uHeightBounds.xy) / uHeightBounds.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -40.0;
          return texture2D(uHeightTex, uv).r;
        }
        // Cheap animated ripple normal from two scrolling noise layers.
        vec3 detailNormal(vec2 xz) {
          vec2 e = vec2(0.15, 0.0);
          vec2 a = xz * 0.35 + vec2(uTime * 0.11, uTime * 0.07);
          vec2 b = xz * 0.9 + vec2(-uTime * 0.17, uTime * 0.13);
          float h0 = mw_vnoise(a) + 0.5 * mw_vnoise(b);
          float hx = mw_vnoise(a + e.xy) + 0.5 * mw_vnoise(b + e.xy * 2.5);
          float hz = mw_vnoise(a + e.yx) + 0.5 * mw_vnoise(b + e.yx * 2.5);
          return normalize(vec3((h0 - hx) * 1.6, 1.0, (h0 - hz) * 1.6));
        }
        void main() {
          vec3 V = uCamPos - vWorld;
          float dist = length(V);
          V /= dist;
          float depth = max(0.0, -seabedF(vWorld.xz) + vWorld.y * 0.3);
          float detailFade = (1.0 - smoothstep(40.0, 420.0, dist)) * uDetail;
          vec3 dn = detailNormal(vWorld.xz);
          vec3 N = normalize(vNormal + vec3(dn.x, 0.0, dn.z) * detailFade * 0.3);
          // High-frequency glitter normal, used only for sparkles.
          vec2 gp = vWorld.xz * 3.1 + vec2(uTime * 0.6, -uTime * 0.45);
          vec3 Ng = normalize(N + vec3(mw_vnoise(gp) - 0.5, 0.0, mw_vnoise(gp + 7.3) - 0.5) * 0.9 * detailFade);

          // Body colour by depth (banded slightly for the stylized look).
          float dq = depth;
          vec3 body = mix(uShallow, uMid, smoothstep(0.5, 4.5, dq));
          body = mix(body, uDeep, smoothstep(4.0, 16.0, dq));

          // Lighting: wrap diffuse + ambient, subsurface glow on crests facing the light.
          float ndl = dot(N, uKeyDir);
          float wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0);
          vec3 lit = body * (uAmbient * 1.15 + uKeyColor * uKeyIntensity * wrap * 0.38);
          float sss = pow(clamp(dot(V, -uKeyDir) * 0.5 + 0.5, 0.0, 1.0), 3.0) * clamp(vCrest * 1.4 + 0.25, 0.0, 1.0);
          lit += uShallow * uKeyColor * sss * 0.35 * uKeyIntensity * (1.0 - uNight * 0.7);

          // Sky reflection with fresnel.
          vec3 Nr = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.7));
          vec3 R = reflect(-V, Nr);
          R.y = abs(R.y);
          vec3 refl = skyColor(R, 1.0);
          vec3 Nf = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.45));
          float fres = 0.03 + 0.97 * pow(1.0 - clamp(dot(Nf, V), 0.0, 1.0), 5.0);
          fres = clamp(fres, 0.0, 0.85);
          vec3 col = mix(lit, refl, fres);

          // Stylized glint: sharp sparkles where ripple normals align with the key light.
          vec3 H = normalize(uKeyDir + V);
          float spec = pow(max(dot(Ng, H), 0.0), 1400.0);
          float sparkle = smoothstep(0.3, 0.7, spec);
          col += uKeyColor * sparkle * (3.5 * (1.0 - uNight) + 1.2 * uNight) * uKeyIntensity * 0.5;
          float sheen = pow(max(dot(R, uKeyDir), 0.0), 60.0);
          col += uKeyColor * sheen * 0.35 * uKeyIntensity;

          // Shoreline foam: animated bands that lap in toward the beach.
          float n = mw_vnoise(vWorld.xz * 0.12 + uTime * 0.05);
          float shore = 1.0 - smoothstep(0.0, 2.6, depth);
          float bands = step(0.55, fract(depth * 0.9 - uTime * 0.22 + n * 0.6)) * shore * shore;
          float edge = 1.0 - smoothstep(0.05, 0.45 + 0.25 * n, depth);
          float foam = max(bands * 0.85, edge);
          // Crest foam on the tallest waves.
          float streak = smoothstep(0.62, 0.8, mw_vnoise(vWorld.xz * vec2(0.9, 0.35) + uTime * 0.3));
          float crest = smoothstep(0.55, 0.8, vCrest) * streak * (1.0 - smoothstep(30.0, 90.0, dist));
          foam = max(foam, crest * 0.6);
          vec3 foamCol = uFoam * (uAmbient * 0.9 + uKeyColor * uKeyIntensity * 0.4 * wrap + 0.15);
          col = mix(col, foamCol, clamp(foam, 0.0, 1.0));

          // Transparency in the shallows lets the seabed (with caustics) show through.
          float alpha = clamp(1.0 - exp(-depth * 0.45), 0.25, 1.0);
          alpha = max(alpha, foam);
          alpha = mix(alpha, 1.0, smoothstep(30.0, 140.0, dist) * 0.8 + fres * 0.5);

          // Distance fog matched to scene fog.
          float fogF = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
          col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
          alpha = mix(alpha, 1.0, fogF);

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(makeWaterGeometry(opts.segments, 4200), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  update(camPos: Vector3) {
    // Snap to a coarse step so the dense centre follows the camera without visible swimming.
    this.mesh.position.set(Math.round(camPos.x / this.snap) * this.snap, 0, Math.round(camPos.z / this.snap) * this.snap);
    this.mesh.updateMatrixWorld();
    (this.material.uniforms.uCamPos.value as Vector3).copy(camPos);
  }
}
