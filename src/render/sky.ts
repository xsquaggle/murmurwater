import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Color, Vector3 } from 'three';
import { NOISE_GLSL, SKY_FN_GLSL, SKY_UNIFORMS_GLSL } from './shaders/common.glsl';

/** Uniforms shared between sky, water and anything that needs the sky. One object, many materials. */
export function createSkyUniforms() {
  return {
    uSunDir: { value: new Vector3(0, 1, 0) },
    uMoonDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color(1, 1, 1) },
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uCloudCover: { value: 0.35 },
  };
}
export type SkyUniforms = ReturnType<typeof createSkyUniforms>;

export function createSky(uniforms: SkyUniforms): Mesh {
  const mat = new ShaderMaterial({
    uniforms,
    side: BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
        gl_Position = p.xyww; // pin to far plane
      }`,
    fragmentShader: /* glsl */ `
      ${SKY_UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${SKY_FN_GLSL}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(vDir, 0.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(5000, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
