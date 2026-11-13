/** Assembles a region's 3D scene: sky, water, terrain, landmarks, scatter, lighting, time of day. */
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, FogExp2, Group, HemisphereLight, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, PointLight, Scene, ShaderMaterial, Vector3,
} from 'three';
import { Heightfield, type RegionDef } from '../core/world';
import { createSky, createSkyUniforms, type SkyUniforms } from './sky';
import { Water } from './water';
import { buildTerrain } from './terrain';
import { addLanternLight, buildArch, buildBuoy, buildDock, buildKettleCamp, buildLighthouse, buildNoticeBoard, buildRowboat, buildStall, createPropMaterial, scatterIsland } from './props';
import { assets } from './assets';
import { buildHullMask } from './boat-rig';
import { dockDeckAt } from '../core/dock';
import { waveHeight, CALM_WAVES } from '../core/waves';
import type { RegionContent } from '../core/content';
import { sample, type Lighting } from './daycycle';
import type { QualityProfile } from './renderer';

/** The Murmur Fog by day. */
const MURK = new Color('#B4A6CE');

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
  /** True when the ferry is the generated skiff model (it sits deeper than the stand-in). */
  readonly ferryIsModel: boolean;
  /** Set once the player owns the boat: the game moves it from then on (see game/sailing.ts). */
  ferryHeld = false;
  /** Houses and big props the player can't walk through: [x, z, radius]. */
  readonly blockers: [number, number, number][] = [];
  /** Boulders at the water's edge a hull can't pass: [x, z, radius]. */
  readonly rocks: [number, number, number][] = [];
  /** The keeper's kettle on Kettle Isle (hidden once it has been taken). */
  kettle: Object3D | null = null;
  /** Sea chests by id: the shut one and the open one stand in the same place and one of them shows. */
  readonly chests = new Map<string, { shut: Object3D; open: Object3D }>();
  private buoys: { obj: Object3D; x: number; z: number; ph: number }[] = [];

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
    this.blockers.push([L.lighthouse.x, L.lighthouse.z, 5.6]);
    // Once lit: light spilling over the point, and a slow double beam.
    this.lampLight = new PointLight(new Color('#FFD08A'), 0, 160, 1.4);
    this.lampLight.position.set(0, lh.lampY, 0);
    lh.group.add(this.lampLight);
    const beamGeo = new CylinderGeometry(7, 0.9, 90, 14, 1, true);
    beamGeo.translate(0, 45, 0); beamGeo.rotateX(Math.PI / 2);
    // Soft-edged and fading with distance, so it reads as light in haze rather than a solid cone.
    this.beamMat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
      uniforms: { uColor: { value: new Color('#FFD9A0') }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vAlong; varying vec3 vN; varying vec3 vV;
        void main() {
          vAlong = uv.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalMatrix * normal; vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vAlong; varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
          float along = pow(1.0 - vAlong, 1.5) * smoothstep(0.0, 0.03, vAlong);
          gl_FragColor = vec4(uColor, uOpacity * rim * along);
        }`,
    });
    for (const a of [0, Math.PI]) { const m = new Mesh(beamGeo, this.beamMat); m.rotation.y = a; m.renderOrder = 8; this.beams.add(m); }
    this.beams.position.set(0, lh.lampY, 0); this.beams.visible = false;
    lh.group.add(this.beams);
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
    // The generated stall and board when present, else the TEMPORARY procedural ones.
    const prop = (key: string, build: () => BufferGeometry): Object3D => {
      const o = assets.instance(key);
      if (o) return o;
      const m = new Mesh(build(), createPropMaterial()); this.propMats.push(m.material as MeshStandardMaterial); return m;
    };
    const stall = prop('fishStall', buildStall);
    stall.position.copy(at(3.2, 3.2)); stall.rotation.y = facing(side.clone().negate());
    const board = prop('noticeBoard', buildNoticeBoard);
    board.position.copy(at(3.0, -3.75)); board.rotation.y = facing(side);
    this.blockers.push([stall.position.x, stall.position.z, 1.5], [board.position.x, board.position.z, 0.7]);
    for (const m of [stall, board]) { m.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); s.add(m); }
    const place = (key: string, p: Vector3, rot: number, scale = 1) => {
      const o = assets.instance(key); if (!o) return;
      o.position.copy(p); o.rotation.y = rot; o.scale.setScalar(scale); s.add(o);
      if (p.y < this.deckY + 0.3) this.blockers.push([p.x, p.z, key === 'tackleBox' ? 0.4 : 0.55 * scale]);
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
    // Her floor is below the waterline: the mask keeps the sea from showing inside her.
    if (skiff) boat.add(buildHullMask());
    s.add(boat);
    this.ferryBoat = boat;
    this.ferryIsModel = !!skiff;
    this.boat = boat;
    this.placeFerry('hearthbay');

    const village = new Vector3(L.dock.x + 40, 0, L.dock.z);
    const scatter = scatterIsland(this.hf, { villageCenter: village, villageRadius: 55, avoid: [new Vector3(L.lighthouse.x, 0, L.lighthouse.z), new Vector3(L.dock.x, 0, L.dock.z)], seed: 5 });
    s.add(scatter.group);
    for (const h of scatter.houses) this.blockers.push([h.x, h.z, 3.4]);
    // Shore boulders: boats go around them, and so do feet, except where someone has to stand or land.
    const rc = region as RegionContent;
    const keep = [...(rc.places ?? []), ...(rc.npcSpots ?? []), ...Object.values(rc.ferry ?? {}), ...(rc.moorings ?? []), L.spawn];
    for (const [x, z, sc, y] of scatter.rocks) {
      if (y < 0.6) this.rocks.push([x, z, sc * 1.0]);
      if (y > -0.3 && keep.every((k) => Math.hypot(k.x - x, k.z - z) > sc + 7)) this.blockers.push([x, z, sc * 0.8]);
    }
    scatter.group.traverse((o) => { if ((o as Mesh).isMesh) this.propMats.push((o as Mesh).material as MeshStandardMaterial); });

    const arch = new Mesh(buildArch(), createPropMaterial());
    arch.position.set(-318, -1.5, 232);
    arch.rotation.y = 0.9;
    arch.castShadow = true; arch.receiveShadow = true;
    this.propMats.push(arch.material as MeshStandardMaterial);
    s.add(arch);

    this.spawn = new Vector3(L.spawn.x, this.deckY, L.spawn.z);

    // Mooring buoys (the home dock needs none), and the keeper's camp on Kettle Isle.
    const buoyGeo = buildBuoy(), buoyMat = createPropMaterial();
    this.propMats.push(buoyMat);
    for (const m of (rc.moorings ?? []).slice(1)) {
      const obj = assets.instance('buoy') ?? new Mesh(buoyGeo, buoyMat);
      // Off the boat's quarter, so a moored hull does not sit on it.
      const x = m.x - Math.sin(m.heading) * 2.6 + Math.cos(m.heading) * 2.4, z = m.z - Math.cos(m.heading) * 2.6 - Math.sin(m.heading) * 2.4;
      obj.traverse((o) => { o.castShadow = true; }); s.add(obj);
      this.buoys.push({ obj, x, z, ph: x * 0.37 });
    }
    const camp = rc.places?.find((p) => p.id === 'keepers-kettle');
    if (camp) {
      const built = buildKettleCamp();
      const g = new Group();
      const base = new Mesh(built.camp, createPropMaterial());
      const kettle = new Mesh(built.kettle, createPropMaterial());
      kettle.position.set(0.05, 0.4, -0.05); kettle.rotation.y = 0.7;
      for (const m of [base, kettle]) { m.castShadow = true; m.receiveShadow = true; this.propMats.push(m.material as MeshStandardMaterial); }
      g.add(base, kettle);
      g.position.set(camp.x, this.hf.height(camp.x, camp.z) - 0.04, camp.z); g.rotation.y = 0.5;
      s.add(g);
      this.kettle = kettle;
      this.blockers.push([camp.x, camp.z, 0.8]);
    }
    // Sea chests, half sunk in the sand and a little askew.
    for (const c of rc.chests ?? []) {
      const stand = () => { const m = new Mesh(new BoxGeometry(0.66, 0.42, 0.44), createPropMaterial()); m.geometry.translate(0, 0.21, 0); m.castShadow = true; this.propMats.push(m.material as MeshStandardMaterial); return m as Object3D; };
      const shut = assets.instance('chest') ?? stand(), open = assets.instance('chestOpen') ?? stand();
      for (const o of [shut, open]) {
        o.position.set(c.x, this.hf.height(c.x, c.z) - 0.09, c.z); o.rotation.set(0.07, c.yaw, -0.05); o.scale.setScalar(1.45);
        s.add(o);
      }
      open.visible = false;
      this.chests.set(c.id, { shut, open });
      this.blockers.push([c.x, c.z, 0.6]);
    }

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
    // A pocket lantern: warm light around the player once the sun is down, so the ground never goes black.
    this.pocket = new PointLight(new Color('#FFC98A'), 0, 16, 1.5);
    s.add(this.pocket);
  }
  private boat: Object3D;
  private pocket: PointLight;
  /** Turns the pocket lantern down (in the boat, where the sail and the stern lamp are an arm's length away). */
  pocketScale = 1;
  /** 0..1: how far into the Murmur Fog at the region's edge the player is. Set by the game each frame. */
  murk = 0;
  private murkNow = 0;
  private murkColor = new Color();
  private lampLight: PointLight;
  private beams = new Group();
  private beamMat: ShaderMaterial;
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

    // The Murmur Fog: near the edge of the region the haze closes in, pale violet by day and dark at night.
    this.murkNow += (this.murk - this.murkNow) * Math.min(1, dt * 1.2);
    const mk = this.murkNow < 0.002 ? 0 : this.murkNow;
    const fog = this.scene.fog as FogExp2;
    fog.color.copy(lt.fog);
    if (mk > 0) fog.color.lerp(this.murkColor.copy(MURK).multiplyScalar(1 - 0.84 * lt.night), Math.min(1, mk * 1.7) * 0.8);
    fog.density = lt.fogDensity + 0.03 * Math.pow(mk, 1.6);
    u.uMurk.value.set(fog.color.r, fog.color.g, fog.color.b, Math.min(1, mk * 1.5));

    this.key.color.copy(lt.keyColor);
    this.key.intensity = lt.keyIntensity;
    this.key.position.copy(focus).addScaledVector(lt.keyDir, 400);
    this.key.target.position.copy(focus);
    this.hemi.color.copy(lt.hemiSky);
    this.hemi.groundColor.copy(lt.hemiGround);
    this.hemi.intensity = lt.hemiIntensity;

    const wu = this.water.material.uniforms;
    wu.uFogColor.value.copy(fog.color);
    wu.uFogDensity.value = fog.density;
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
    const dark = Math.min(1, Math.max(0, lt.night * 1.4 + (lt.hour > 18.2 || lt.hour < 6 ? 0.25 : 0)));
    this.lampLight.intensity = this.lighthouseLit ? 60 + 240 * dark : 0;
    this.beams.visible = this.lighthouseLit && dark > 0.02;
    this.beams.rotation.y = this.time * 0.35;
    this.beamMat.uniforms.uOpacity.value = 0.08 + 0.34 * dark;
    this.pocket.position.set(focus.x, focus.y + 2.3, focus.z);
    this.pocket.intensity = 22 * dark * this.pocketScale;

    for (const bu of this.buoys) {
      bu.obj.position.set(bu.x, waveHeight(CALM_WAVES, bu.x, bu.z, this.time, 0.36) + 0.02, bu.z);
      bu.obj.rotation.set(Math.sin(this.time * 1.1 + bu.ph) * 0.09, bu.ph, Math.sin(this.time * 0.8 + bu.ph * 2) * 0.09);
    }
    if (this.ferryHeld) return;
    const b = this.boatBase;
    const isModel = this.ferryIsModel;
    if (this.ferryBeached) this.boat.position.set(b.x, b.y, b.z);
    else this.boat.position.set(b.x, waveHeight(CALM_WAVES, b.x, b.z, this.time, 0.36) + (isModel ? -0.32 : 0.42) + Math.sin(this.time * 1.3) * 0.04, b.z);
    this.boat.rotation.set(this.ferryBeached ? 0.04 : Math.sin(this.time * 0.9) * 0.025, this.boatYaw, this.ferryBeached ? 0.09 : Math.sin(this.time * 1.1) * 0.04, 'YXZ');
  }

  /** Deck height if (x, z) is on the dock, else null. */
  dockDeckAt(x: number, z: number): number | null { return dockDeckAt(this.region.landmarks.dock, x, z); }

  get light(): Lighting { return this.lighting; }
}
