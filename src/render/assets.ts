/**
 * Generated model library (public/models). Every model is loaded once at boot and cloned per use.
 * A missing or broken file never stops the game: callers fall back to the procedural stand-ins.
 */
import { AnimationClip, Group, Material, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import present from 'virtual:model-list';

export const MODEL_PATHS = {
  player: 'models/characters/player.glb',
  skiff: 'models/boats/skiff.glb',
  sailRig: 'models/boats/sail-rig.glb',
  buoy: 'models/props/buoy.glb',
  potFloat: 'models/props/pot-float.glb',
  belfry: 'models/props/belfry.glb',
  fogLamp: 'models/props/fog-lamp.glb',
  seaRoadLight: 'models/props/sea-road-light.glb',
  reedsA: 'models/props/reeds-a.glb',
  reedsB: 'models/props/reeds-b.glb',
  lanternTreeA: 'models/props/lantern-tree-a.glb',
  lanternTreeB: 'models/props/lantern-tree-b.glb',
  lilyGlow: 'models/props/lily-glow.glb',
  chest: 'models/props/chest.glb',
  chestOpen: 'models/props/chest-open.glb',
  crate: 'models/props/crate.glb',
  barrel: 'models/props/barrel.glb',
  tackleBox: 'models/props/tackle-box.glb',
  dockLantern: 'models/props/dock-lantern.glb',
  fishStall: 'models/props/fish-stall.glb',
  noticeBoard: 'models/props/notice-board.glb',
  sketchbook: 'models/props/sketchbook.glb',
  biscuit: 'models/characters/biscuit.glb',
  biscuitSit: 'models/characters/biscuit-sit.glb',
} as const;
/**
 * Models that have been asked for and may not be made yet (docs/briefs): used from the build after they land,
 * with nothing to change here, and not counted as missing meanwhile.
 */
const FEN_FISH = ['reedling', 'mudlark', 'glassfin', 'sedge-pike', 'mossback-tench', 'glowbelly', 'stilt-gar', 'bottomless-eel', 'old-mossglass', 'the-listener'];
export const PENDING_MODELS: Record<string, string> = {
  packetBox: 'models/props/packet-box.glb',
  stiltHut: 'models/props/stilt-hut.glb',
  fieldKit: 'models/props/field-kit.glb',
  listeningPost: 'models/props/listening-post.glb',
  'npc:calloway': 'models/characters/calloway.glb',
  ...Object.fromEntries(FEN_FISH.map((id) => [`fish:${id}`, `models/fish/${id}.glb`])),
};
/** Optional NPC models; each falls back to a procedural stand-in until its file exists. */
export const NPC_MODEL_IDS = ['mara', 'pell', 'wick'];
export const FISH_MODEL_IDS = ['butterperch', 'pebble-goby', 'kettle-carp', 'coral-snapper', 'lampjaw', 'moss-eel', 'twofold-flounder', 'hollow-lantern', 'manyeye'];

interface Entry { scene: Group; clips: AnimationClip[] }

export class Assets {
  private lib = new Map<string, Entry>();
  readonly missing: string[] = [];
  /**
   * Geometry, materials and textures that belong to the library. Copies of a model share them, so a scene
   * that is torn down (a region left behind) must leave these alone.
   */
  readonly shared = new WeakSet<object>();

  /** Loads every known model; resolves when all have loaded or failed. onProgress gets 0..1. */
  async loadAll(onProgress?: (p: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const jobs: [string, string][] = [
      ...Object.entries(MODEL_PATHS),
      ...Object.entries(PENDING_MODELS),
      ...FISH_MODEL_IDS.map((id) => [`fish:${id}`, `models/fish/${id}.glb`] as [string, string]),
      ...NPC_MODEL_IDS.map((id) => [`npc:${id}`, `models/characters/${id}.glb`] as [string, string]),
    ];
    // Only files that were there when the game was built are asked for.
    const there = new Set(present);
    let done = 0;
    await Promise.all(jobs.map(async ([key, url]) => {
      try {
        if (!there.has(url)) throw new Error('not built in');
        const g = await loader.loadAsync(url);
        g.scene.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.castShadow = true; m.receiveShadow = true; if ((m as SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
          this.shared.add(m.geometry);
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            this.shared.add(mat);
            for (const v of Object.values(mat)) if (v && (v as { isTexture?: boolean }).isTexture) this.shared.add(v as object);
          }
        });
        this.lib.set(key, { scene: g.scene, clips: g.animations });
      } catch {
        if (!(key in PENDING_MODELS)) this.missing.push(url);
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
