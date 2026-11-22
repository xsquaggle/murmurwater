/**
 * The hands as they are seen aboard: Biscuit on her thwart or the cuddy roof, Mister Hollis on the side bench with
 * his hand line over the rail. Each is the made model when the library has it and a TEMPORARY stand-in when it
 * has not, and each shows what the rules (core/crew.ts) say they are doing: watching, hooking one out, eating,
 * fishing, thinned out by daylight.
 */
import {
  AnimationAction, AnimationMixer, Box3, BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Line, LineBasicMaterial, LoopOnce,
  LoopRepeat, Material, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { assets } from './assets';

const flat = (hex: string, rough = 0.85) => new MeshStandardMaterial({ color: new Color(hex), roughness: rough, flatShading: true });

// ------------------------------------------------------------------ Mister Hollis

/**
 * Stand-in for Mister Hollis, used only if models/characters/hollis.glb is not in the build: a tall narrow gentleman in an oilskin and sou'wester, mittens, a muffler and a carpet bag, with fog and two
 * small warm lights where a face would be. Origin at his feet, facing +Z. `seated` puts him on a seat 0.465 m
 * above his origin with the bag on his knees and one hand out for the line. `hand` is where the line leaves it.
 */
export function hollisStandIn(seated = false): { group: Group; body: Group; hand: Object3D } {
  const g = new Group(), body = new Group();
  g.add(body);
  const coat = flat('#6F8A7C'), dark = flat('#3E4A48'), wool = flat('#8C7FA6'), mitt = flat('#B5604E'), bagM = flat('#7A4E3A'), hat = flat('#587064');
  const fog = new MeshStandardMaterial({ color: new Color('#C9C2DC'), roughness: 1, flatShading: true, transparent: true, opacity: 0.82, emissive: new Color('#8C7FA6'), emissiveIntensity: 0.25 });
  fog.name = 'Fog';
  const glass = new MeshStandardMaterial({ color: new Color('#FFD9A0'), emissive: new Color('#FFD9A0'), emissiveIntensity: 2.4, roughness: 0.4 });
  glass.name = 'Glass';
  const add = (m: Mesh, x: number, y: number, z: number, parent: Object3D = body) => { m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  // The seat takes 0.4 m off his height; everything from the hips up is the same man.
  const hip = seated ? 0.5 : 0.9;
  if (seated) {
    for (const x of [-0.1, 0.1]) {
      add(new Mesh(new CylinderGeometry(0.075, 0.075, 0.44, 6), coat), x, 0.5, 0.2).rotation.x = Math.PI / 2;
      add(new Mesh(new CylinderGeometry(0.06, 0.07, 0.46, 6), dark), x, 0.25, 0.42);
    }
  } else for (const x of [-0.1, 0.1]) add(new Mesh(new CylinderGeometry(0.07, 0.08, 0.5, 6), dark), x, 0.25, 0);
  // The oilskin: long, buttoned, narrow at the shoulder.
  const skirt = seated ? 0.24 : 0.62;
  add(new Mesh(new CylinderGeometry(0.2, 0.3, skirt, 8), coat), 0, hip - skirt / 2 + 0.06, 0);
  add(new Mesh(new CylinderGeometry(0.17, 0.2, 0.62, 8), coat), 0, hip + 0.36, 0);
  for (let i = 0; i < 4; i++) add(new Mesh(new SphereGeometry(0.022, 5, 4), flat('#C9A24A', 0.5)), 0, hip + 0.12 + i * 0.14, 0.19);
  add(new Mesh(new TorusGeometry(0.15, 0.06, 5, 10), wool), 0, hip + 0.7, 0).rotation.x = Math.PI / 2;
  add(new Mesh(new BoxGeometry(0.1, 0.34, 0.04), wool), 0.09, hip + 0.52, 0.17);
  // Where a face would be: fog, and in it two small warm lights.
  const head = new Group();
  body.add(head);
  add(new Mesh(new SphereGeometry(0.19, 10, 8), fog), 0, hip + 0.9, 0, head);
  for (const x of [-0.065, 0.065]) add(new Mesh(new SphereGeometry(0.022, 6, 5), glass), x, hip + 0.92, 0.15, head);
  // The sou'wester: a round crown, and a brim that runs long down the back of the neck.
  add(new Mesh(new SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hat), 0, hip + 0.98, 0, head);
  const brim = add(new Mesh(new CylinderGeometry(0.3, 0.36, 0.04, 12), hat), 0, hip + 0.97, -0.07, head);
  brim.rotation.x = 0.26; brim.scale.z = 1.25;
  // Arms: the left keeps the bag, the right is free for the line (seated) or hangs (standing).
  const arm = (x: number, out: number, fwd: number) => {
    const a = add(new Mesh(new CapsuleGeometry(0.055, 0.5, 3, 6), coat), x, hip + 0.36, fwd * 0.5);
    a.rotation.set(-fwd * 1.1, 0, out);
    return add(new Mesh(new SphereGeometry(0.075, 7, 5), mitt), x + Math.sin(out) * 0.3, hip + 0.36 - Math.cos(fwd * 1.1) * 0.3, fwd * 0.5 + Math.sin(fwd * 1.1) * 0.3);
  };
  const bag = new Group();
  bag.add(new Mesh(new BoxGeometry(0.4, 0.26, 0.17), bagM));
  const clasp = new Mesh(new BoxGeometry(0.42, 0.05, 0.19), flat('#C9A24A', 0.5)); clasp.position.y = 0.12; bag.add(clasp);
  const handle = new Mesh(new TorusGeometry(0.08, 0.016, 4, 8, Math.PI), dark); handle.position.y = 0.15; bag.add(handle);
  bag.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
  let hand: Object3D;
  if (seated) {
    arm(-0.24, 0.1, 0.55);
    // His line hand is out over the rail, to his left as he sits (the berth looks out over the side, and he sits
    // along the bench with his knees toward the bow), and he watches the line.
    hand = arm(0.3, 0.7, 0.35);
    bag.position.set(-0.03, 0.7, 0.24); bag.rotation.y = 0.12;
    head.rotation.y = 1.0;
    g.rotation.y = -Math.PI / 2;
  } else {
    hand = arm(0.25, -0.1, 0.05);
    arm(-0.25, 0.1, 0.05);
    bag.position.set(-0.3, hip - 0.36, 0.03); bag.rotation.y = Math.PI / 2;
  }
  body.add(bag);
  return { group: g, body, hand };
}

/** A 4 x 4 ordered dither, by the pixel: 16 even steps from 1/32 to 31/32. */
const BAYER = `
float hollisBayer(vec2 p) {
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 i = ivec2(mod(p, 4.0));
  return (m[i.x + i.y * 4] + 0.5) / 16.0;
}`;
/**
 * How he thins (`uThin` 0 = all there, 1 = thinned out by daylight): what faces the eye goes first and his edges
 * last, so that what is left of him is his outline, in the colour of fog. Nothing is blended: each pixel of him is
 * there or is not, so he is drawn with everything solid, in front of what is behind him and behind what is in
 * front, and the boat's well (whose lid hides the sea from it) holds him like anybody else.
 */
const THIN = `
if (uThin > 0.004) {
  float hRim = 1.0 - abs(dot(normalize(vViewPosition), normal));
  float hThere = mix(1.0, clamp(pow(hRim, 2.2) * 2.2, 0.05, 1.0), uThin);
  if (hThere < hollisBayer(gl_FragCoord.xy)) discard;
  const vec3 hFog = vec3(0.546, 0.497, 0.686);
  diffuseColor.rgb = mix(diffuseColor.rgb, hFog, 0.5 * uThin);
  totalEmissiveRadiance += hFog * 0.2 * uThin;
}`;

/**
 * Makes a figure of Mister Hollis (model or stand-in) into fog: its materials become its own, the `Fog` of the
 * face is made soft, and the returned function sets how much of him there is, 0 (an outline by daylight) to 1.
 */
export function dressHollis(root: Object3D): (presence: number) => void {
  const mats: { m: MeshStandardMaterial; base: number; kind: 'main' | 'fog' | 'glass'; glow: number }[] = [];
  const own = new Map<Material, MeshStandardMaterial>();
  const thin = { value: 0 };
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const swap = (src: Material) => {
      let m = own.get(src);
      if (!m) {
        m = (src as MeshStandardMaterial).clone();
        const kind = src.name === 'Fog' ? 'fog' : src.name === 'Glass' ? 'glass' : 'main';
        if (kind === 'fog') { m.transparent = true; m.opacity = Math.min(m.opacity, 0.82); m.depthWrite = false; if (m.emissive.getHex() === 0) { m.emissive = new Color('#8C7FA6'); m.emissiveIntensity = 0.25; } }
        if (kind === 'glass' && m.emissive.getHex() === 0) m.emissive = new Color('#FFD9A0');
        if (kind === 'main') {
          m.onBeforeCompile = (shader) => {
            shader.uniforms.uThin = thin;
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', `#include <common>\nuniform float uThin;${BAYER}`)
              .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${THIN}`);
          };
          m.customProgramCacheKey = () => 'hollis-thin';
        }
        own.set(src, m);
        mats.push({ m, base: m.opacity, kind, glow: kind === 'glass' ? Math.max(2.2, m.emissiveIntensity) : m.emissiveIntensity });
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    mesh.userData.castWhenThick = mesh.castShadow;
    // The fog of his face is blended, and the sea is drawn late (render order 5): his face is drawn after it.
    if ((Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((m) => m.transparent)) mesh.renderOrder = 5.5;
  });
  let was = -1;
  return (presence: number) => {
    const p = Math.min(1, Math.max(0, presence));
    if (Math.abs(p - was) < 0.004) return;
    was = p;
    thin.value = 1 - p;
    for (const x of mats) {
      // His lights are the last of him to go.
      if (x.kind === 'fog') x.m.opacity = x.base * (0.35 + 0.65 * p);
      else if (x.kind === 'glass') x.m.emissiveIntensity = x.glow * (0.5 + 0.5 * p);
    }
    // An outline casts no shadow.
    root.traverse((o) => { const mesh = o as Mesh; if (mesh.isMesh && mesh.userData.castWhenThick !== undefined) mesh.castShadow = mesh.userData.castWhenThick && p > 0.6; });
  };
}

/** Mister Hollis in his berth: seated, the bag on his knees, a hand line over the rail when there is enough of him to hold one. */
export class HollisAboard {
  readonly root = new Group();
  private mixer: AnimationMixer | null = null;
  private sit: AnimationAction | null = null; private pullAct: AnimationAction | null = null;
  private body: Group | null = null;
  private hand: Object3D;
  private setPresence: (p: number) => void;
  private presence = 1;
  private line: Line;
  private lineMat = new LineBasicMaterial({ color: new Color('#E8E2D0'), transparent: true, opacity: 0 });
  private pullT = 9; private t = Math.random() * 10;
  private held: { obj: Object3D; animate(t: number, swim: number): void; dispose(): void } | null = null;
  /** How far out from his fist the line goes into the water: the made figure's fist is out over the rail. */
  private reach = 0.3;
  private v = new Vector3(); private box = new Box3();

  constructor() {
    const model = assets.instance('npc:hollis');
    let fig: Object3D;
    if (model) {
      fig = model;
      this.mixer = new AnimationMixer(model);
      for (const clip of assets.clips('npc:hollis')) {
        const a = this.mixer.clipAction(clip);
        if (clip.name === 'sit') { a.setLoop(LoopRepeat, Infinity); a.play(); this.sit = a; }
        else if (clip.name === 'pull') { a.setLoop(LoopOnce, 1); a.clampWhenFinished = false; this.pullAct = a; }
      }
      this.hand = model.getObjectByName('LineHand') ?? model;
    } else {
      const s = hollisStandIn(true);
      fig = s.group; this.body = s.body; this.hand = s.hand; this.reach = 0.75;
    }
    this.root.add(fig);
    this.setPresence = dressHollis(fig);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
    this.line = new Line(geo, this.lineMat);
    this.line.frustumCulled = false;
    this.root.add(this.line);
  }

  /**
   * A fish on his line: he draws it in hand over hand and holds it up inboard for a moment. `fish` hangs under his
   * fist by its mouth, flapping, and no bigger than a gentleman can hold up in one mitten.
   */
  pull(fish: { obj: Object3D; animate(t: number, swim: number): void; dispose(): void } | null) {
    this.pullT = 0;
    this.dropHeld();
    if (fish) {
      const len = this.box.setFromObject(fish.obj).getSize(this.v).z;
      if (len > 0.36) fish.obj.scale.multiplyScalar(0.36 / len);
      this.held = fish; this.hand.add(fish.obj);
      fish.obj.position.set(0, -0.14, 0); fish.obj.rotation.set(-Math.PI / 2, 0, 0);
    }
    if (this.pullAct) { this.pullAct.reset().play(); }
  }
  private dropHeld() { this.held?.dispose(); this.held = null; }

  /**
   * `thick`: 0 (thinned out by daylight) .. 1 (all there). `fishing`: his line is over the side. `waterY`: the
   * water's height where the line goes in, in the berth's own frame.
   */
  update(dt: number, thick: number, fishing: boolean, waterY: number) {
    this.t += dt; this.pullT += dt;
    this.presence += (thick - this.presence) * Math.min(1, dt * 0.9);
    this.setPresence(this.presence);
    if (this.mixer) {
      if (this.pullAct && this.sit) { const w = this.pullT < this.pullAct.getClip().duration ? 1 : 0; this.pullAct.setEffectiveWeight(w); this.sit.setEffectiveWeight(1 - w); }
      this.mixer.update(dt);
    } else if (this.body) {
      // The stand-in breathes, and leans back on a pull.
      const k = this.pullT < 1.6 ? Math.sin((this.pullT / 1.6) * Math.PI) : 0;
      this.body.rotation.x = -0.16 * k + 0.012 * Math.sin(this.t * 1.1);
      this.body.position.y = 0.01 * Math.sin(this.t * 1.4);
    }
    // The fish is on his line until he has held it up inboard (1.60 to 1.76 s of his `pull`), and then it is in the basket.
    if (this.held && this.pullT > 1.72) this.dropHeld();
    this.held?.animate(this.t, 0.8);
    // The line: from his hand out over the rail and down to the water, a little slack, twitching now and then.
    // While a fish hangs from his fist the line is in with it.
    const show = fishing && this.presence > 0.5 && !this.held ? 1 : 0;
    this.lineMat.opacity += (show * 0.85 - this.lineMat.opacity) * Math.min(1, dt * 3);
    this.line.visible = this.lineMat.opacity > 0.02;
    if (this.line.visible) {
      this.root.updateMatrixWorld();
      const h = this.root.worldToLocal(this.hand.getWorldPosition(this.v));
      const p = this.line.geometry.getAttribute('position') as BufferAttribute;
      const twitch = 0.02 * Math.sin(this.t * 2.3) * Math.sin(this.t * 0.7);
      p.setXYZ(0, h.x, h.y, h.z);
      p.setXYZ(1, h.x + (this.reach > 0.5 ? -0.4 * h.x : -0.06) + twitch, waterY, Math.max(this.reach > 0.5 ? 1.05 : 0, h.z + this.reach));
      p.needsUpdate = true;
    }
  }
  /** Where his line meets the water, in the berth's frame: [x, z]. */
  lineEnd(): [number, number] { const p = this.line.geometry.getAttribute('position') as BufferAttribute; return [p.getX(1), p.getZ(1)]; }
}

// ------------------------------------------------------------------ Biscuit

/** TEMPORARY stand-in for the cat (only if neither of her models is in the build): a loaf with ears and a tail. */
function catStandIn(): Group {
  const g = new Group(), fur = flat('#E7A865'), cream = flat('#F2E3C6');
  const add = (m: Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new Mesh(new SphereGeometry(0.13, 8, 6), fur), 0, 0.13, -0.02).scale.set(0.85, 0.95, 1.15);
  add(new Mesh(new SphereGeometry(0.085, 8, 6), fur), 0, 0.27, 0.1);
  add(new Mesh(new SphereGeometry(0.05, 6, 5), cream), 0, 0.14, 0.09);
  for (const x of [-0.05, 0.05]) add(new Mesh(new ConeGeometry(0.03, 0.06, 4), fur), x, 0.35, 0.09);
  add(new Mesh(new CapsuleGeometry(0.018, 0.2, 3, 5), fur), 0.1, 0.05, -0.12).rotation.set(Math.PI / 2, 0, 0.9);
  return g;
}

/**
 * Biscuit in her berth. She sits and watches the water; leans to it when a bite is coming to the keeper's float
 * (`watch`, on the sitting sculpt); is up on her feet with a paw over the side when she hooks one out (`swat`, on
 * the standing one); and puts her head down to every fourth (`eat`). A build without those clips tips and bobs
 * her whole body instead.
 */
export class CatAboard {
  readonly root = new Group();
  private pose = new Group();
  private sitting: Object3D; private standing: Object3D | null = null;
  private mixers: AnimationMixer[] = [];
  private clip: Record<string, AnimationAction> = {};
  private t = Math.random() * 10;
  private swatT = 9; private eatT = 9; private watch = 0;
  private meal: { obj: Object3D; dispose(): void } | null = null; private mealSize = 1;
  private box = new Box3(); private v = new Vector3();

  constructor() {
    this.root.add(this.pose);
    const sit = assets.instance('biscuitSit'), stand = assets.instance('biscuit');
    this.sitting = sit ?? stand ?? catStandIn();
    this.pose.add(this.sitting);
    const play = (model: Object3D, key: string) => {
      const m = new AnimationMixer(model); this.mixers.push(m);
      for (const c of assets.clips(key)) {
        const a = m.clipAction(c);
        if (c.name === 'swat' || c.name === 'eat') { a.setLoop(LoopOnce, 1); a.setEffectiveWeight(0); }
        else { a.setLoop(LoopRepeat, Infinity); a.play(); a.setEffectiveWeight(c.name === 'walk' || c.name === 'watch' ? 0 : 1); }
        this.clip[c.name] = a;
      }
    };
    if (sit) play(sit, 'biscuitSit'); else if (stand) play(stand, 'biscuit');
    if (sit && stand) { this.standing = stand; stand.visible = false; this.pose.add(stand); play(stand, 'biscuit'); }
  }

  /** She hooks one out: up, a paw over the side, and back. */
  swat() { this.swatT = 0; this.clip.swat?.reset().play(); }
  /** One for her: `fish` lies on the boards under her nose, and there is less of it as she goes. */
  eat(fish?: { obj: Object3D; dispose(): void }) {
    this.eatT = 0; this.clip.eat?.reset().play();
    this.meal?.dispose(); this.meal = null;
    if (!fish) return;
    const len = this.box.setFromObject(fish.obj).getSize(this.v).z;
    if (len > 0.2) fish.obj.scale.multiplyScalar(0.2 / len);
    this.mealSize = fish.obj.scale.x;
    fish.obj.position.set(0.01, 0.02, 0.2); fish.obj.rotation.set(0, 1.1, Math.PI / 2);
    this.root.add(fish.obj); this.meal = fish;
  }
  get busy() { return this.swatT < 1 || this.eatT < 2.5; }

  /** `watching`: 0..1, how near a bite is to the keeper's float (she knows before the float does). */
  update(dt: number, watching: number) {
    this.t += dt; this.swatT += dt; this.eatT += dt;
    this.watch += (watching - this.watch) * Math.min(1, dt * 5);
    const swat = this.swatT < 1 ? Math.sin(this.swatT * Math.PI) : 0;
    const eat = this.eatT < 2.5 ? Math.min(1, this.eatT * 4, (2.5 - this.eatT) * 3) : 0;
    if (this.meal) {
      // Whole until her first tug at it, gone by the time her head comes up.
      this.meal.obj.scale.setScalar(Math.max(0.001, this.mealSize * Math.min(1, Math.max(0, 1 - (this.eatT - 1.1) / 1.0))));
      if (this.eatT > 2.1) { this.meal.dispose(); this.meal = null; }
    }
    const made = { swat: !!this.clip.swat, eat: !!this.clip.eat, watch: !!this.clip.watch };
    // On her feet for the swat (the standing sculpt), sitting otherwise.
    if (this.standing) { const up = swat > 0.05; this.standing.visible = up; this.sitting.visible = !up; }
    // `watch` and `eat` turn the same joints: she stops watching to eat.
    if (made.watch) this.clip.watch.setEffectiveWeight(this.watch * (1 - eat));
    if (made.swat) this.clip.swat.setEffectiveWeight(swat > 0 ? 1 : 0);
    if (made.eat) this.clip.eat.setEffectiveWeight(eat);
    // Where she has no clip for it, the whole cat is tipped: toward the water to watch and to swat (she faces
    // over the side), head down and working at it to eat.
    const lean = (made.watch ? 0 : 0.2 * this.watch) + (made.swat ? 0 : 0.55 * swat) + (made.eat ? 0 : 0.38 * eat);
    this.pose.rotation.x = lean + (made.eat ? 0 : 0.05 * eat * Math.sin(this.t * 19)) + (made.watch ? 0 : 0.012 * this.watch * Math.sin(this.t * 9));
    this.pose.position.set(0, made.swat ? 0 : 0.03 * swat, (made.swat ? 0 : 0.1 * swat) + (made.watch ? 0 : 0.03 * this.watch));
    for (const m of this.mixers) m.update(dt);
  }
}
