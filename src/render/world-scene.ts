/** Assembles a region's 3D scene: sky, water, terrain, landmarks, scatter, lighting, time of day. */
import {
  Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, Vector3,
} from 'three';
import { Heightfield, type RegionDef } from '../core/world';
import { createSky, createSkyUniforms, type SkyUniforms } from './sky';
import { Water } from './water';
import { buildTerrain } from './terrain';
import { addLanternLight, buildArch, buildDock, buildLighthouse, buildRowboat, createPropMaterial, scatterIsland } from './props';
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

  constructor(readonly region: RegionDef, profile: QualityProfile) {
    this.hf = new Heightfield(region);
    const s = this.scene;
    s.fog = new FogExp2(new Color(), 0.001);
    s.add(createSky(this.sky));

    const terrain = buildTerrain(this.hf, 4);
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

    const boat = new Mesh(buildRowboat(), createPropMaterial());
    const bp = dock.endPoint.clone().add(new Vector3(0, 0, 4.4));
    boat.position.set(bp.x - 8, 0.45, bp.z);
    boat.rotation.y = 0.3;
    boat.castShadow = true;
    this.propMats.push(boat.material as MeshStandardMaterial);
    s.add(boat);
    this.boat = boat;

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
  private boat: Mesh;

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

    this.boat.position.y = 0.42 + Math.sin(this.time * 1.3) * 0.08;
    this.boat.rotation.z = Math.sin(this.time * 1.1) * 0.04;
  }

  /** Deck height if (x, z) is on the dock, else null. */
  dockDeckAt(x: number, z: number): number | null {
    const dx = x - this.dockStart.x, dz = z - this.dockStart.z;
    const fx = Math.sin(this.dockYaw), fz = Math.cos(this.dockYaw);
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along < -1 || along > this.dockLength + 5) return null;
    const half = along > this.dockLength ? 3.5 : 1.35;
    return side <= half ? this.deckY + 0.07 : null;
  }

  get light(): Lighting { return this.lighting; }
}
