/**
 * Fish for the 3D views: the generated model of a species (scaled to its length and weight) with a
 * vertex-shader swim (a travelling wave that grows toward the tail), or the stand-in when a model is missing.
 */
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { assets } from './assets';
import { placeholderFish } from './avatar';
import { fish as fishDef } from '../core/content';

const STANDIN_COLORS: Record<string, string> = {
  butterperch: '#E8B24A', 'pebble-goby': '#8C8A86', 'kettle-carp': '#3FA7A0', 'coral-snapper': '#E86F6F', lampjaw: '#2F6E7A',
  'moss-eel': '#6F8F4E', 'twofold-flounder': '#B9BFC6', 'hollow-lantern': '#E9DCC0', manyeye: '#6A4C8C',
};

export interface FishObject {
  readonly obj: Group;
  /** t: seconds; swim: 0 (still, held) .. 1 (fighting hard). */
  animate(t: number, swim: number): void;
  dispose(): void;
}

/** Shared swim uniforms per material (all instances of a species share one material). */
const swimUniforms = new WeakMap<MeshStandardMaterial, { uSwimT: { value: number }; uSwimAmp: { value: number } }>();

function addSwim(mat: MeshStandardMaterial, eel: boolean) {
  if (swimUniforms.has(mat)) return swimUniforms.get(mat)!;
  const u = { uSwimT: { value: 0 }, uSwimAmp: { value: 0 } };
  swimUniforms.set(mat, u);
  const freq = eel ? 9.0 : 6.0, tail = eel ? 1.0 : 0.0;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSwimT = u.uSwimT; sh.uniforms.uSwimAmp = u.uSwimAmp;
    sh.vertexShader = 'uniform float uSwimT;\nuniform float uSwimAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      // Models are 1 m nose (+Z) to tail (-Z). The head barely moves; the tail sweeps.
      float tailW = mix(smoothstep(0.25, -0.5, position.z), 1.0, ${tail.toFixed(1)});
      transformed.x += sin(position.z * ${freq.toFixed(1)} - uSwimT) * uSwimAmp * (0.04 + tailW * 0.16);`);
  };
  mat.customProgramCacheKey = () => `swim-${eel ? 'eel' : 'fish'}`;
  return u;
}

export function makeFish(id: string, weight?: number): FishObject {
  const def = fishDef(id);
  const avgW = (def.weight[0] + def.weight[1]) / 2;
  const sizeK = weight ? Math.cbrt(weight / avgW) : 1;
  const len = def.length * Math.max(0.7, Math.min(1.4, sizeK));
  const model = assets.instance(`fish:${id}`);
  if (!model) {
    const g = placeholderFish(STANDIN_COLORS[id] ?? '#8C8A86', len);
    return { obj: g, animate: () => {}, dispose: () => {} };
  }
  const root = new Group();
  model.scale.setScalar(len);
  root.add(model);
  const mats: { mat: MeshStandardMaterial; u: ReturnType<typeof addSwim> }[] = [];
  model.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (m.isMesh) { const mat = m.material as MeshStandardMaterial; mats.push({ mat, u: addSwim(mat, id === 'moss-eel') }); }
  });
  const glowBase = mats.map(({ mat }) => mat.emissiveIntensity);
  let phase = 0, lastT = 0;
  return {
    obj: root,
    animate(t, swim) {
      const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      phase += dt * (5 + swim * 9);
      mats.forEach(({ mat, u }, i) => {
        u.uSwimT.value = phase; u.uSwimAmp.value = 0.25 + swim * 0.9;
        if (mat.emissiveMap) mat.emissiveIntensity = glowBase[i] * (0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1));
      });
    },
    dispose() { root.removeFromParent(); },
  };
}
