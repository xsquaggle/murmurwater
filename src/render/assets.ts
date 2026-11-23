/**
 * Generated model library (public/models). Every model is loaded once at boot and cloned per use.
 * A missing or broken file never stops the game: callers fall back to the procedural stand-ins.
 */
import { AnimationClip, Group, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import present from 'virtual:model-list';

export const MODEL_PATHS = {
  player: 'models/characters/player.glb',
  skiff: 'models/boats/skiff.glb',
  sailRig: 'models/boats/sail-rig.glb',
  puffin: 'models/boats/puffin.glb',
  puffinRig: 'models/boats/puffin-rig.glb',
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
  packetBox: 'models/props/packet-box.glb',
  stiltHut: 'models/props/stilt-hut.glb',
  fieldKit: 'models/props/field-kit.glb',
  listeningPost: 'models/props/listening-post.glb',
  puffinWreck: 'models/props/puffin-wreck.glb',
  ribA: 'models/props/rib-a.glb',
  ribB: 'models/props/rib-b.glb',
  vertebra: 'models/props/vertebra.glb',
  seaThrift: 'models/props/sea-thrift.glb',
  whaleboatHouse: 'models/props/whaleboat-house.glb',
  tryworks: 'models/props/tryworks.glb',
  stormMast: 'models/props/storm-mast.glb',
  harpoonRack: 'models/props/harpoon-rack.glb',
  theJaw: 'models/props/the-jaw.glb',
  tallyStone: 'models/props/tally-stone.glb',
  ribMark: 'models/props/rib-mark.glb',
  struckRing: 'models/props/struck-ring.glb',
} as const;
/**
 * Models that have been asked for and may not be made yet (docs/briefs): used from the build after they land,
 * with nothing to change here, and not counted as missing meanwhile.
 */
export const PENDING_MODELS: Record<string, string> = {};
/** People of a brief who may not be made yet: not counted as missing meanwhile (see PENDING_MODELS). */
const PENDING_KEYS = new Set(['npc:oake']);
/** Optional NPC models; each falls back to a procedural stand-in until its file exists. */
export const NPC_MODEL_IDS = ['mara', 'pell', 'wick', 'calloway', 'hollis', 'oake'];
export const FISH_MODEL_IDS = [
  'butterperch', 'pebble-goby', 'kettle-carp', 'coral-snapper', 'lampjaw', 'moss-eel', 'twofold-flounder', 'hollow-lantern', 'manyeye',
  'reedling', 'mudlark', 'glassfin', 'sedge-pike', 'mossback-tench', 'glowbelly', 'stilt-gar', 'bottomless-eel', 'old-mossglass', 'the-listener',
  'bonefin-herring', 'slate-pout', 'thrift-wrasse', 'ribfish', 'kettle-cod', 'squall-mackerel', 'lantern-ling', 'thunderback', 'old-greyback', 'the-lull',
];

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
        if (!(key in PENDING_MODELS) && !PENDING_KEYS.has(key)) this.missing.push(url);
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

/**
 * Frees what the things under `root` hold on the graphics card for themselves: geometry, materials and their
 * textures, instance tables and skeletons. Models from the library share theirs with every other copy and
 * are left alone. For anything taken out of the scene for good.
 */
export function freeOwn(root: Object3D) {
  const shared = assets.shared, done = new Set<object>();
  const free = (o: { dispose(): void } | null | undefined) => { if (o && !shared.has(o) && !done.has(o)) { done.add(o); o.dispose(); } };
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.geometry || !m.material) return;
    if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose();
    if ((o as SkinnedMesh).isSkinnedMesh) free((o as SkinnedMesh).skeleton);
    free(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat || shared.has(mat)) continue;
      for (const v of Object.values(mat)) if (v && (v as Texture).isTexture) free(v as Texture);
      free(mat);
    }
  });
}
