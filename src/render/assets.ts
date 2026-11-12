/**
 * Generated model library (public/models). Every model is loaded once at boot and cloned per use.
 * A missing or broken file never stops the game: callers fall back to the procedural stand-ins.
 */
import { AnimationClip, Group, Material, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MODEL_PATHS = {
  player: 'models/characters/player.glb',
  skiff: 'models/boats/skiff.glb',
  crate: 'models/props/crate.glb',
  barrel: 'models/props/barrel.glb',
  tackleBox: 'models/props/tackle-box.glb',
  dockLantern: 'models/props/dock-lantern.glb',
} as const;
export const FISH_MODEL_IDS = ['butterperch', 'pebble-goby', 'kettle-carp', 'coral-snapper', 'lampjaw', 'moss-eel', 'twofold-flounder', 'hollow-lantern', 'manyeye'];

interface Entry { scene: Group; clips: AnimationClip[] }

export class Assets {
  private lib = new Map<string, Entry>();
  readonly missing: string[] = [];

  /** Loads every known model; resolves when all have loaded or failed. onProgress gets 0..1. */
  async loadAll(onProgress?: (p: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const jobs: [string, string][] = [
      ...Object.entries(MODEL_PATHS),
      ...FISH_MODEL_IDS.map((id) => [`fish:${id}`, `models/fish/${id}.glb`] as [string, string]),
    ];
    let done = 0;
    await Promise.all(jobs.map(async ([key, url]) => {
      try {
        const g = await loader.loadAsync(url);
        g.scene.traverse((o) => {
          const m = o as Mesh;
          if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if ((m as SkinnedMesh).isSkinnedMesh) m.frustumCulled = false; }
        });
        this.lib.set(key, { scene: g.scene, clips: g.animations });
      } catch {
        this.missing.push(url);
      }
      done++;
      onProgress?.(done / jobs.length);
    }));
    if (this.missing.length) console.info('[assets] using stand-ins for', this.missing);
  }

  has(key: string): boolean { return this.lib.has(key); }

  /** A fresh copy of a model (skinned models get their own skeleton). Materials are shared unless `ownMaterials`. */
  instance(key: string, ownMaterials = false): Group | null {
    const e = this.lib.get(key);
    if (!e) return null;
    const g = cloneSkinned(e.scene) as Group;
    if (ownMaterials) g.traverse((o) => { const m = o as Mesh; if (m.isMesh) m.material = (m.material as Material).clone(); });
    return g;
  }

  clips(key: string): AnimationClip[] { return this.lib.get(key)?.clips ?? []; }

  /** First standard material in a model (for flicker/tint tweaks). */
  static material(root: Object3D): MeshStandardMaterial | null {
    let found: MeshStandardMaterial | null = null;
    root.traverse((o) => { const m = o as Mesh; if (!found && m.isMesh) found = m.material as MeshStandardMaterial; });
    return found;
  }
}

export const assets = new Assets();
