/** Assembles a region's 3D scene: sky, water, terrain, landmarks, scatter, lighting, time of day. */
import {
  Object3D, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, Vector3,
} from 'three';
import { Heightfield, type RegionDef } from '../core/world';
import { createSky, createSkyUniforms, type SkyUniforms } from './sky';
import { Water } from './water';
import { buildTerrain } from './terrain';
import { addLanternLight, buildArch, buildDock, buildLighthouse, buildNoticeBoard, buildRowboat, buildStall, createPropMaterial, scatterIsland, LANDING, LANDING_HALF } from './props';
import { assets } from './assets';
import { waveHeight, CALM_WAVES } from '../core/waves';
import type { RegionContent } from '../core/content';
import { sample, type Lighting } from './daycycle';
import type { QualityProfile } from './renderer';

export class WorldScene {
  readonly scene = new Scene();
  readonly sky: SkyUniforms = createSkyUniforms();
  readonly hf: Heightfield;
  readonly water: Water;
  readonly key: DirectionalLight;
  readonly hemi: HemisphereLight;
  private lighting: Lighting = sample(17.5);
  private terrainMat: MeshStandardMaterial;
  private propMats: MeshStandardMaterial[] = [];
  private lanterns: PointLight[] = [];
  private lighthouseGlass: MeshStandardMaterial;
  lighthouseLit = false;
  readonly dockEnd: Vector3;
  readonly deckY: number;
  readonly spawn: Vector3;
  time = 0;
  readonly dockStart: Vector3;
  private dockYaw: number;
  private dockLength: number;
  hour = 17.6;

  /** Pell's ferry (the generated skiff, or the stand-in rowboat). */
  readonly ferryBoat: Object3D;
  private ferryBeached = false;
  /** Houses and big props the player can't walk through: [x, z, radius]. */
  readonly blockers: [number, number, number][] = [];

  constructor(readonly region: RegionDef, profile: QualityProfile) {
    this.hf = new Heightfield(region);
    const s = this.scene;
    s.fog = new FogExp2(new Color(), 0.001);
    s.add(createSky(this.sky));

    const terrain = buildTerrain(this.hf, profile.terrainCell);
    this.terrainMat = terrain.material;
    s.add(terrain.mesh);

    this.water = new Water({ heightTex: terrain.heightTex, heightBounds: terrain.heightBounds, sky: this.sky, segments: profile.waterSegments });
    s.add(this.water.mesh);

    const L = region.landmarks;
    const lh = buildLighthouse();
    const lhY = this.hf.height(L.lighthouse.x, L.lighthouse.z);
    lh.group.position.set(L.lighthouse.x, lhY - 0.6, L.lighthouse.z);
    s.add(lh.group);
    this.lighthouseGlass = lh.glassMat;
    this.propMats.push(lh.body.material as MeshStandardMaterial);

    const dock = buildDock(this.hf, { x: L.dock.x, z: L.dock.z }, L.dock.rot ?? 0, L.dock.length ?? 30);
    s.add(dock.group);
    dock.group.traverse((o) => { if ((o as Mesh).isMesh) this.propMats.push((o as Mesh).material as MeshStandardMaterial); });
    this.dockEnd = dock.endPoint;
    this.dockStart = new Vector3(L.dock.x, dock.deckY, L.dock.z);
    this.dockYaw = L.dock.rot ?? 0;
    this.dockLength = L.dock.length ?? 30;
    this.deckY = dock.deckY;
    for (const p of dock.lanternPositions) this.lanterns.push(addLanternLight(s, p, 7, 18));

    // Harbour: the stall and notice board on the landing, generated crates and tackle along the dock.
    const dir = new Vector3(Math.sin(this.dockYaw), 0, Math.cos(this.dockYaw));
    const side = new Vector3(dir.z, 0, -dir.x);
    const at = (t: number, sd: number) => new Vector3(L.dock.x, this.deckY + 0.07, L.dock.z).addScaledVector(dir, t).addScaledVector(side, sd);
    const facing = (v: Vector3) => Math.atan2(v.x, v.z);
    const stall = new Mesh(buildStall(), createPropMaterial());
    stall.position.copy(at(3.2, 3.2)); stall.rotation.y = facing(side.clone().negate());
    const board = new Mesh(buildNoticeBoard(), createPropMaterial());
    board.position.copy(at(3.0, -3.75)); board.rotation.y = facing(side);
    for (const m of [stall, board]) { m.castShadow = true; m.receiveShadow = true; this.propMats.push(m.material as MeshStandardMaterial); s.add(m); }
    const place = (key: string, p: Vector3, rot: number, scale = 1) => {
      const o = assets.instance(key); if (!o) return;
      o.position.copy(p); o.rotation.y = rot; o.scale.setScalar(scale); s.add(o);
    };
    place('crate', at(this.dockLength - 1.5, 0.95), this.dockYaw + 0.3);
    place('crate', at(this.dockLength - 1.2, 0.95).add(new Vector3(0, 0.6, 0)), this.dockYaw + 0.9, 0.8);
    place('barrel', at(this.dockLength + 3.6, -3.0), 0.4);
    place('tackleBox', at(this.dockLength - 6, -0.85), this.dockYaw + 1.2);
    place('crate', at(5.7, 3.35), this.dockYaw - 0.2);
    place('barrel', at(5.9, -3.5), 1.1);

    const skiff = assets.instance('skiff');
    const boat = skiff ?? new Mesh(buildRowboat(), createPropMaterial());
    if (!skiff) this.propMats.push((boat as Mesh).material as MeshStandardMaterial);
    boat.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
    s.add(boat);
    this.ferryBoat = boat;
    this.boat = boat;
    this.placeFerry('hearthbay');

    const village = new Vector3(L.dock.x + 40, 0, L.dock.z);
    const scatter = scatterIsland(this.hf, { villageCenter: village, villageRadius: 55, avoid: [new Vector3(L.lighthouse.x, 0, L.lighthouse.z), new Vector3(L.dock.x, 0, L.dock.z)], seed: 5 });
    s.add(scatter.group);
    scatter.group.traverse((o) => { if ((o as Mesh).isMesh) this.propMats.push((o as Mesh).material as MeshStandardMaterial); });

    const arch = new Mesh(buildArch(), createPropMaterial());
    arch.position.set(-318, -1.5, 232);
    arch.rotation.y = 0.9;
    arch.castShadow = true; arch.receiveShadow = true;
    this.propMats.push(arch.material as MeshStandardMaterial);
    s.add(arch);

    this.spawn = new Vector3(L.spawn.x, this.deckY, L.spawn.z);

    this.hemi = new HemisphereLight(0xffffff, 0x000000, 1);
    s.add(this.hemi);
    this.key = new DirectionalLight(0xffffff, 2);
    this.key.castShadow = profile.shadows;
    this.key.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
    const sc = this.key.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 900;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.6;
    s.add(this.key);
    s.add(this.key.target);
  }
  private boat: Object3D;
  private boatBase = new Vector3();
  private boatYaw = 0;

  /** Moors the ferry at an island's landing (positions come from the region's ferry points). */
  placeFerry(island: string) {
    const f = (this.region as RegionContent).ferry?.[island];
    if (!f) return;
    this.boatBase.set(f.boat[0], 0, f.boat[1]);
    this.boatYaw = f.boat[2];
    const ground = this.hf.height(f.boat[0], f.boat[1]);
    this.ferryBeached = ground > -0.2;
    this.boatBase.y = this.ferryBeached ? ground + 0.05 : 0;
  }

  update(dt: number, camera: PerspectiveCamera, focus: Vector3) {
    this.time += dt;
    const lt = sample(this.hour, this.lighting);
    const u = this.sky;
    u.uTime.value = this.time;
    u.uSunDir.value.copy(lt.sunDir);
    u.uMoonDir.value.copy(lt.moonDir);
    u.uSunColor.value.copy(lt.night > 0.5 ? new Color(0.55, 0.62, 0.85) : lt.keyColor);
    u.uZenith.value.copy(lt.zenith);
    u.uHorizon.value.copy(lt.horizon);
    u.uNight.value = lt.night;

    const fog = this.scene.fog as FogExp2;
    fog.color.copy(lt.fog);
    fog.density = lt.fogDensity;

    this.key.color.copy(lt.keyColor);
    this.key.intensity = lt.keyIntensity;
    this.key.position.copy(focus).addScaledVector(lt.keyDir, 400);
    this.key.target.position.copy(focus);
    this.hemi.color.copy(lt.hemiSky);
    this.hemi.groundColor.copy(lt.hemiGround);
    this.hemi.intensity = lt.hemiIntensity;

    const wu = this.water.material.uniforms;
    wu.uFogColor.value.copy(lt.fog);
    wu.uFogDensity.value = lt.fogDensity;
    wu.uKeyDir.value.copy(lt.keyDir);
    wu.uKeyColor.value.copy(lt.keyColor);
    wu.uKeyIntensity.value = lt.keyIntensity;
    (wu.uAmbient.value as Color).copy(lt.hemiSky).multiplyScalar(lt.hemiIntensity * 0.6).lerp(lt.fog, 0.3);
    this.water.update(camera.position);

    (this.terrainMat.userData.uniforms.uTime as { value: number }).value = this.time;
    (this.terrainMat.userData.uniforms.uCausticStrength as { value: number }).value = 1 - lt.night * 0.85;

    // Lights come on at dusk and flicker like flames.
    const glow = Math.min(1, Math.max(0, (lt.night - 0.05) * 1.6 + (lt.hour > 17 || lt.hour < 7 ? 0.35 : 0)));
    for (const m of this.propMats) { const un = m.userData.uniforms; if (un) un.uGlow.value = glow; }
    this.lanterns.forEach((l, i) => {
      const flick = 0.85 + 0.15 * Math.sin(this.time * 9.1 + i * 2.3) * Math.sin(this.time * 3.7 + i);
      l.intensity = (1.5 + 9 * glow) * flick;
    });
    this.lighthouseGlass.emissiveIntensity = this.lighthouseLit ? 4 : 0.06 + 0.04 * Math.sin(this.time * 0.7);

    const b = this.boatBase;
    const isModel = !(this.boat as Mesh).isMesh;
    if (this.ferryBeached) this.boat.position.set(b.x, b.y, b.z);
    else this.boat.position.set(b.x, waveHeight(CALM_WAVES, b.x, b.z, this.time, 0.36) + (isModel ? -0.32 : 0.42) + Math.sin(this.time * 1.3) * 0.04, b.z);
    this.boat.rotation.set(this.ferryBeached ? 0.04 : Math.sin(this.time * 0.9) * 0.025, this.boatYaw, this.ferryBeached ? 0.09 : Math.sin(this.time * 1.1) * 0.04, 'YXZ');
  }

  /** Deck height if (x, z) is on the dock, else null. */
  dockDeckAt(x: number, z: number): number | null {
    const dx = x - this.dockStart.x, dz = z - this.dockStart.z;
    const fx = Math.sin(this.dockYaw), fz = Math.cos(this.dockYaw);
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along < -6 || along > this.dockLength + 5) return null;
    const half = along > this.dockLength ? 3.5 : along >= 0 && along < LANDING ? LANDING_HALF : 1.35;
    return side <= half ? this.deckY + 0.07 : null;
  }

  get light(): Lighting { return this.lighting; }
}
