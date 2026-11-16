/** Assembles a region's 3D scene: sky, water, terrain, landmarks, scatter, lighting, time of day. */
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, FogExp2, Group, HemisphereLight, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, PointLight, Scene, ShaderMaterial, Texture, Vector3,
} from 'three';
import { Heightfield, type RegionDef } from '../core/world';
import { createSky, createSkyUniforms, type SkyUniforms } from './sky';
import { Water } from './water';
import { buildTerrain } from './terrain';
import { addLanternLight, buildArch, buildBellPost, buildBelfry, buildBuoy, buildDock, buildKettleCamp, buildLighthouse, buildNoticeBoard, buildRowboat, buildStall, createPropMaterial, scatterIsland } from './props';
import { assets } from './assets';
import { buildHullMask } from './boat-rig';
import { dockDeckAt } from '../core/dock';
import { waveHeight, CALM_WAVES } from '../core/waves';
import { SeaRoadLights } from './sea-road';
import { lookOf } from './looks';
import { FenDressing } from './fen-scene';
import { groveTrees } from '../core/flora';
import { buildProp } from './fen-props';
import { roadsOf } from '../core/content';
import type { RegionContent } from '../core/content';
import { GRADES, sample, type Grade, type Lighting } from './daycycle';
import type { QualityProfile } from './renderer';

/** The Murmur Fog by day. */
const MURK = new Color('#B4A6CE');

export class WorldScene {
  /** The scene everything is drawn in. It outlives a region: the player, the boat and the people are added to it by their owners. */
  readonly scene: Scene;
  /** Everything this region put into the scene, so that leaving the region takes all of it out again. */
  readonly root = new Group();
  /** How much of the usual swell this region's water has (1 = Hearthbay). */
  readonly swell: number;
  /** The height of the sea's surface at (x, z) now. */
  waveY(x: number, z: number): number { return waveHeight(CALM_WAVES, x, z, this.time, 0.36 * this.swell); }
  /** Reeds, drowned trees and lilies, in a region that has them. */
  fen: FenDressing | null = null;
  /** The lights of the sea-roads that leave this region, if any. */
  seaRoad: SeaRoadLights | null = null;
  /** Where the boat that carries the Fog Lamp is (the game sets it); null when there is none. */
  lampAt: { x: number; z: number } | null = null;
  readonly sky: SkyUniforms = createSkyUniforms();
  readonly hf: Heightfield;
  readonly water: Water;
  readonly key: DirectionalLight;
  readonly hemi: HemisphereLight;
  private lighting: Lighting = sample(17.5);
  private terrainMat: MeshStandardMaterial;
  private propMats: MeshStandardMaterial[] = [];
  private lanterns: PointLight[] = [];
  private lighthouseGlass: MeshStandardMaterial | null = null;
  lighthouseLit = false;
  /** 0..1: how lit the lanterns and windows are (they come on at dusk). */
  glow = 0;
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
  /** Lamps and lit windows of delivered props, and pennants that stir. */
  private glassMats: MeshStandardMaterial[] = [];
  private pennants: Object3D[] = [];
  private vanes: Object3D[] = [];
  /** The Drowned Bell, where the region has one: the part that swings, how long since it was struck, and how hard. */
  private bell: { pivot: Object3D; t: number; amp: number } | null = null;
  private bellMat: MeshStandardMaterial | null = null;
  private belfryStone: MeshStandardMaterial | null = null;
  private bellRope: { seg: Mesh; socket: Object3D; to: Vector3; lay: (m: Mesh, p: Vector3, q: Vector3) => void } | null = null;
  private bellV = new Vector3();
  /** Where the bell hangs, for the camera and for sparks. */
  readonly bellPos = new Vector3();

  constructor(readonly region: RegionDef, profile: QualityProfile, scene: Scene = new Scene()) {
    this.hf = new Heightfield(region);
    this.scene = scene;
    this.grade = GRADES[region.grade] ?? null;
    const s = this.root;
    scene.add(s);
    scene.fog = new FogExp2(new Color(), 0.001);
    s.add(createSky(this.sky));

    const look = lookOf(region.grade);
    this.swell = look.water.swell;
    const terrain = buildTerrain(this.hf, profile.terrainCell, look.terrain);
    this.terrainMat = terrain.material;
    this.heightTex = terrain.heightTex;
    s.add(terrain.mesh);

    this.water = new Water({ heightTex: terrain.heightTex, heightBounds: terrain.heightBounds, sky: this.sky, segments: profile.waterSegments, look: look.water });
    s.add(this.water.mesh);

    const roads = roadsOf(region.id);
    if (roads.length) { this.seaRoad = new SeaRoadLights(roads, (x, z) => this.hf.height(x, z)); s.add(this.seaRoad.root); }

    // A region with reed beds is a fen: reeds on every shoal, drowned trees in its groves, lilies on its still water.
    if (region.shoals) {
      const rcx = region as RegionContent, trees = groveTrees(rcx, this.hf), dock = region.landmarks.dock;
      for (const t of trees) this.rocks.push([t.x, t.z, t.r]);
      const clear: [number, number, number][] = (rcx.moorings ?? []).map((m) => [m.x, m.z, 9]);
      if (dock) clear.push([dock.x + Math.sin(dock.rot ?? 0) * (dock.length ?? 30) / 2, dock.z + Math.cos(dock.rot ?? 0) * (dock.length ?? 30) / 2, (dock.length ?? 30) / 2 + 7]);
      this.fen = new FenDressing({ center: region.center, within: region.shoals.within, heightAt: terrain.heightAt, trees, lilies: rcx.lilies ?? [], clear });
      s.add(this.fen.root);
    }

    const L = region.landmarks;
    const rc = region as RegionContent;
    if (L.lighthouse) {
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
    }

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
    if (region.id === 'hearthbay') {
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
    }

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
    // Until the player has a boat of their own she is Pell's ferry, and lies at a ferry landing.
    boat.visible = !!rc.ferry;
    this.placeFerry(Object.keys(rc.ferry ?? {})[0] ?? '');

    if (region.id === 'hearthbay') {
    const village = new Vector3(L.dock.x + 40, 0, L.dock.z);
    const scatter = scatterIsland(this.hf, { villageCenter: village, villageRadius: 55, avoid: [new Vector3(L.lighthouse.x, 0, L.lighthouse.z), new Vector3(L.dock.x, 0, L.dock.z)], seed: 5 });
    s.add(scatter.group);
    for (const h of scatter.houses) this.blockers.push([h.x, h.z, 3.4]);
    // Shore boulders: boats go around them, and so do feet, except where someone has to stand or land.
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
    }

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

    // The things the region's data stands about: a hut, a box, a board (see fen-props.ts).
    for (const p of rc.props ?? []) {
      const built = buildProp(p.model);
      if (!built) continue;
      const o = built.object;
      // On the ground, or on the deck where there is one, and never under the waterline (a thing on piles stands in the shallows).
      o.position.set(p.x, Math.max(0, this.hf.height(p.x, p.z), dockDeckAt(L.dock, p.x, p.z) ?? 0), p.z); o.rotation.y = p.yaw;
      s.add(o); o.updateMatrixWorld(true);
      this.propMats.push(...built.mats); this.glassMats.push(...built.glass);
      if (built.pennant) { built.pennant.userData.rest = built.pennant.rotation.y; this.pennants.push(built.pennant); }
      if (built.vane) { built.vane.userData.rest = built.vane.rotation.y; this.vanes.push(built.vane); }
      if (built.lamp) this.lanterns.push(addLanternLight(s, o.localToWorld(built.lamp.clone()), 7, 16));
      if (p.block) this.blockers.push([p.x, p.z, p.block]);
    }

    // The Drowned Belfry: a church tower standing in the sea off its shoal, leaning a little, the bell still hung.
    const bf = L.belfry;
    if (bf) {
      const g = new Group();
      const model = assets.instance('belfry');
      let pivot: Object3D | null = null, socket: Object3D | null = null, size = 1;
      // Where the rope leaves the tower, in the tower's own space: the stand-in lets it go from under the bell stage.
      let lead: Vector3 | null = null;
      if (model) {
        // The delivered tower. It has its own lean (toward its +X), the bell hangs plumb on a headstock that lies
        // along Z, and the tip of the clapper is marked for the rope. A little larger than drawn, so it reads from
        // the sea as the landmark it is.
        size = 1.55;
        model.scale.setScalar(size);
        // Its stone gets a material of its own, with a little light of its own by day: the faces the sun has left
        // would otherwise go as black as the weed on them.
        let stone: MeshStandardMaterial | null = null;
        model.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.castShadow = true; m.receiveShadow = true;
          if (!stone) { stone = (m.material as MeshStandardMaterial).clone(); stone.emissive = new Color('#FFFFFF'); stone.emissiveMap = stone.map; stone.emissiveIntensity = 0; }
          m.material = stone;
        });
        this.belfryStone = stone;
        g.add(model);
        pivot = model.getObjectByName('Bell') ?? null;
        socket = model.getObjectByName('RopeSocket') ?? null;
        // The bell gets a material of its own: it keeps a little of the sea's light after dark, and flares when struck.
        const bm = pivot as Mesh | null;
        if (bm?.isMesh) {
          const m = (bm.material as MeshStandardMaterial).clone();
          m.emissive = new Color('#6FE6D2'); m.emissiveMap = m.map; m.emissiveIntensity = 0;
          bm.material = m; this.bellMat = m;
        }
        // Over the sill of the opening that faces the shoal (the tower's +Z), a hand above the stone.
        lead = new Vector3(0.25, 2.27, 1.66);
        g.rotation.set(0, bf.rot ?? 0, 0);
      } else {
        const built = buildBelfry();
        const tower = new Mesh(built.tower, createPropMaterial()), bell = new Mesh(built.bell, createPropMaterial());
        for (const m of [tower, bell]) { m.castShadow = true; m.receiveShadow = true; this.propMats.push(m.material as MeshStandardMaterial); }
        bell.position.set(...built.bellAt);
        g.add(tower, bell);
        pivot = bell;
        g.rotation.set(-0.035, bf.rot ?? 0, 0.05, 'YXZ');
      }
      g.position.set(bf.x, 0, bf.z);
      s.add(g);
      g.updateMatrixWorld(true);
      this.blockers.push([bf.x, bf.z, model ? 2.3 * size + 0.15 : 2.6]);
      this.rocks.push([bf.x, bf.z, model ? 2.3 * size + 0.45 : 2.9]);
      if (pivot) { this.bell = { pivot, t: 99, amp: 0 }; pivot.getWorldPosition(this.bellPos); this.bellPos.y -= model ? 0.6 * size : 0.7; }
      // The rope comes ashore to a post on the shoal, where a keeper can reach it.
      const at = rc.places?.find((p) => p.id === 'drowned-bell');
      if (at) {
        const dx = bf.x - at.x, dz = bf.z - at.z, d = Math.hypot(dx, dz) || 1;
        const px = at.x + (dx / d) * 1.1, pz = at.z + (dz / d) * 1.1;
        const post = new Mesh(buildBellPost(), createPropMaterial());
        post.position.set(px, this.hf.height(px, pz) - 0.25, pz); post.rotation.y = 0.8; post.castShadow = true;
        this.propMats.push(post.material as MeshStandardMaterial);
        s.add(post);
        this.blockers.push([px, pz, 0.3]);
        const ropeMat = new MeshStandardMaterial({ color: new Color('#B9A27C'), roughness: 0.95, flatShading: true });
        const length = () => { const geo = new CylinderGeometry(0.022, 0.022, 1, 5, 1); geo.rotateX(Math.PI / 2); const m = new Mesh(geo, ropeMat); s.add(m); return m; };
        const lay = (m: Mesh, p: Vector3, q: Vector3) => { m.position.copy(p).lerp(q, 0.5); m.scale.z = Math.max(0.01, p.distanceTo(q)); m.lookAt(q); };
        // From the tower to the post in two lengths with a sag between them.
        const a = lead ? model!.localToWorld(lead.clone()) : new Vector3(-0.95, 6.83, 0).applyMatrix4(g.matrixWorld);
        const b = new Vector3(px, post.position.y + 1.0, pz);
        const mid = a.clone().lerp(b, 0.55); mid.y -= lead ? 0.55 : 0.9;
        lay(length(), a, mid); lay(length(), mid, b);
        // Inside the tower the rope runs from the clapper to the sill, and goes with the bell when it swings.
        if (socket) { const seg = length(); this.bellRope = { seg, socket, to: a, lay }; lay(seg, socket.getWorldPosition(new Vector3()), a); }
      }
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
  private heightTex: Texture;
  /** What this region does to the light of the day (the Fen's green haze); null leaves it as the clock has it. */
  private grade: Grade | null;
  /** Turns the pocket lantern down (in the boat, where the sail and the stern lamp are an arm's length away). */
  pocketScale = 1;
  /** 0..1: how far into the Murmur Fog at the region's edge the player is. Set by the game each frame. */
  murk = 0;
  private murkNow = 0;
  private murkColor = new Color();
  private lampLight: PointLight | null = null;
  private beams = new Group();
  private beamMat: ShaderMaterial | null = null;
  private boatBase = new Vector3();
  private boatYaw = 0;

  /** Takes up the clock, the waves and the fog where the region just left had them, so nothing jumps at a crossing. */
  carryFrom(old: WorldScene) {
    this.time = old.time; this.hour = old.hour; this.murk = old.murk; this.murkNow = old.murkNow; this.pocketScale = old.pocketScale;
    this.lampAt = old.lampAt;
    if (old.seaRoad) this.seaRoad?.carryFrom(old.seaRoad);
  }

  /** Strikes the bell: it swings and settles (the sound is the game's business). */
  tollBell(strength = 1) { if (this.bell) { this.bell.t = 0; this.bell.amp = 0.42 * strength; } }

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
    this.grade?.(lt);
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
    // They stay lit through the long shadows of early morning and come on through the late afternoon, by degrees
    // rather than on the stroke of the hour.
    const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    const early = 1 - ramp(6.8, 8.2, lt.hour), late = ramp(16.6, 17.4, lt.hour);
    const glow = this.glow = Math.min(1, Math.max(0, (lt.night - 0.05) * 1.6 + 0.35 * Math.max(early, late)));
    for (const m of this.propMats) { const un = m.userData.uniforms; if (un) un.uGlow.value = glow; }
    this.lanterns.forEach((l, i) => {
      const flick = 0.85 + 0.15 * Math.sin(this.time * 9.1 + i * 2.3) * Math.sin(this.time * 3.7 + i);
      l.intensity = (1.5 + 9 * glow) * flick;
    });
    for (const m of this.glassMats) m.emissiveIntensity = 0.12 + 2.6 * glow * (0.9 + 0.1 * Math.sin(this.time * 7.3));
    this.pennants.forEach((p, i) => { p.rotation.y = (p.userData.rest as number) + 0.3 * Math.sin(this.time * 1.7 + i) + 0.1 * Math.sin(this.time * 4.3 + i * 2); });
    for (const v of this.vanes) v.rotation.y = (v.userData.rest as number) + 0.7 * Math.sin(this.time * 0.19) + 0.07 * Math.sin(this.time * 2.3);
    if (this.lighthouseGlass) this.lighthouseGlass.emissiveIntensity = this.lighthouseLit ? 4 : 0.06 + 0.04 * Math.sin(this.time * 0.7);
    // The pocket lantern is kept up a while after sunrise: the dock lies in the island's shadow for the first hour.
    const dark = Math.min(1, Math.max(0, lt.night * 1.4 + Math.max(0.25 * ramp(17.8, 18.4, lt.hour), 0.4 * (1 - ramp(6.4, 7.7, lt.hour)))));
    if (this.lampLight && this.beamMat) {
      this.lampLight.intensity = this.lighthouseLit ? 60 + 240 * dark : 0;
      this.beams.visible = this.lighthouseLit && dark > 0.02;
      this.beams.rotation.y = this.time * 0.35;
      this.beamMat.uniforms.uOpacity.value = 0.08 + 0.34 * dark;
    }
    this.pocket.position.set(focus.x, focus.y + 2.3, focus.z);
    this.pocket.intensity = 22 * dark * this.pocketScale;

    this.seaRoad?.update(dt, this.time, this.lampAt, (x, z) => this.waveY(x, z));
    this.fen?.update(dt, focus, lt.night);
    for (const bu of this.buoys) {
      bu.obj.position.set(bu.x, this.waveY(bu.x, bu.z) + 0.02, bu.z);
      bu.obj.rotation.set(Math.sin(this.time * 1.1 + bu.ph) * 0.09, bu.ph, Math.sin(this.time * 0.8 + bu.ph * 2) * 0.09);
    }
    if (this.bell) {
      // Struck, it swings and dies away; left alone it still stirs a little, as if something had just let go of it.
      const bl = this.bell; bl.t += dt;
      bl.pivot.rotation.z = bl.amp * Math.exp(-bl.t * 0.55) * Math.sin(bl.t * 3.4) + 0.018 * Math.sin(this.time * 0.6);
      if (this.bellRope) { const r = this.bellRope; r.lay(r.seg, r.socket.getWorldPosition(this.bellV), r.to); }
      if (this.bellMat) this.bellMat.emissiveIntensity = 0.05 + 0.55 * this.glow + 2.2 * (bl.amp / 0.42) * Math.exp(-bl.t * 0.9);
      if (this.belfryStone) this.belfryStone.emissiveIntensity = 0.03 + 0.2 * (1 - this.glow);
    }
    if (this.ferryHeld || !this.boat.visible) return;
    const b = this.boatBase;
    const isModel = this.ferryIsModel;
    if (this.ferryBeached) this.boat.position.set(b.x, b.y, b.z);
    else this.boat.position.set(b.x, this.waveY(b.x, b.z) + (isModel ? -0.32 : 0.42) + Math.sin(this.time * 1.3) * 0.04, b.z);
    this.boat.rotation.set(this.ferryBeached ? 0.04 : Math.sin(this.time * 0.9) * 0.025, this.boatYaw, this.ferryBeached ? 0.09 : Math.sin(this.time * 1.1) * 0.04, 'YXZ');
  }

  /**
   * Takes this region out of the scene and frees what it built. Models from the library are shared with
   * every other copy of them and are left alone.
   */
  dispose() {
    this.scene.remove(this.root);
    const shared = assets.shared, done = new Set<object>();
    const free = (o: { dispose(): void } | null | undefined) => { if (o && !shared.has(o) && !done.has(o)) { done.add(o); o.dispose(); } };
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.geometry || !m.material) return;
      if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose();
      free(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (!mat || shared.has(mat)) continue;
        for (const v of Object.values(mat)) if (v && (v as Texture).isTexture) free(v as Texture);
        free(mat);
      }
    });
    free(this.heightTex);
    for (const l of [this.key]) l.shadow.map?.dispose();
  }

  /** Deck height if (x, z) is on the dock, else null. */
  dockDeckAt(x: number, z: number): number | null { return dockDeckAt(this.region.landmarks.dock, x, z); }

  get light(): Lighting { return this.lighting; }
}
