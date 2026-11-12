/**
 * TEMPORARY procedural player avatar + rod. Replaced by the generated, rigged model (public/models/characters/player.glb)
 * when the asset thread delivers it; the rod rig (segments + tip) stays and attaches to the model's hand bone.
 */
import { BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { PALETTE } from './palette';

const mat = (hex: string, rough = 0.8) => new MeshStandardMaterial({ color: new Color(hex), roughness: rough, flatShading: true });

export type Pose = 'idle' | 'walk' | 'charge' | 'cast' | 'wait' | 'fight' | 'cheer';

export class Avatar implements PlayerAvatar {
  readonly root = new Group();
  private body = new Group();
  private legL: Object3D; private legR: Object3D;
  private armR = new Group();
  private armL: Object3D;
  readonly rod = new RodRig();
  private t = 0;
  // Animation targets (smoothed)
  private pitch = 0.6; private pitchV = 0;
  private yaw = 0; private bend = 0;
  private walkPhase = 0;

  constructor() {
    const coat = mat('#E3A93A'), coatDark = mat('#C98E2A'), boots = mat('#3E8C86'), skin = mat('#EBC09A'), beanie = mat('#3FA7A0'), pants = mat('#4A4A5A');
    // Legs
    const leg = (x: number) => {
      const g = new Group();
      const l = new Mesh(new CylinderGeometry(0.1, 0.09, 0.5, 6), pants); l.position.y = -0.25; g.add(l);
      const b = new Mesh(new CylinderGeometry(0.12, 0.13, 0.32, 7), boots); b.position.y = -0.55; g.add(b);
      const f = new Mesh(new BoxGeometry(0.22, 0.1, 0.32), boots); f.position.set(0, -0.69, 0.05); g.add(f);
      g.position.set(x, 0.72, 0);
      this.body.add(g);
      return g;
    };
    this.legL = leg(-0.12); this.legR = leg(0.12);
    // Raincoat body: flared cone + toggles
    const torso = new Mesh(new CylinderGeometry(0.24, 0.38, 0.78, 8), coat); torso.position.y = 1.05; this.body.add(torso);
    const hem = new Mesh(new CylinderGeometry(0.39, 0.4, 0.06, 8), coatDark); hem.position.y = 0.67; this.body.add(hem);
    for (let i = 0; i < 3; i++) { const tg = new Mesh(new BoxGeometry(0.1, 0.035, 0.04), mat(PALETTE.bone)); tg.position.set(0, 0.92 + i * 0.15, 0.3 - i * 0.02); this.body.add(tg); }
    const collar = new Mesh(new CylinderGeometry(0.2, 0.26, 0.12, 8), coatDark); collar.position.y = 1.47; this.body.add(collar);
    // Bag strap + bag
    const bag = new Mesh(new BoxGeometry(0.26, 0.22, 0.1), mat('#7A5A3E')); bag.position.set(-0.32, 0.9, 0.08); bag.rotation.z = 0.1; this.body.add(bag);
    // Head
    const head = new Mesh(new SphereGeometry(0.24, 10, 8), skin); head.position.y = 1.72; this.body.add(head);
    const hair = new Mesh(new SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('#4A3428')); hair.position.y = 1.74; hair.rotation.x = 0.25; this.body.add(hair);
    const hat = new Mesh(new SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), beanie); hat.position.y = 1.78; this.body.add(hat);
    const cuff = new Mesh(new CylinderGeometry(0.265, 0.27, 0.08, 10), mat('#348F89')); cuff.position.y = 1.79; this.body.add(cuff);
    const pom = new Mesh(new SphereGeometry(0.06, 6, 5), beanie); pom.position.y = 2.04; this.body.add(pom);
    for (const x of [-0.08, 0.08]) { const e = new Mesh(new SphereGeometry(0.025, 5, 4), mat('#2A2030')); e.position.set(x, 1.74, 0.22); this.body.add(e); }
    // Arms
    const arm = (g: Group, x: number) => {
      const a = new Mesh(new CapsuleGeometry(0.075, 0.42, 3, 6), coat); a.position.y = -0.25; g.add(a);
      const h = new Mesh(new SphereGeometry(0.075, 6, 5), skin); h.position.y = -0.52; g.add(h);
      g.position.set(x, 1.42, 0);
      this.body.add(g);
    };
    const armL = new Group(); arm(armL, -0.3); this.armL = armL;
    arm(this.armR, 0.3);
    // Rod (shared rig): hangs off the right hand.
    this.rod.pivot.position.set(0, -0.5, 0.05);
    this.armR.add(this.rod.pivot);
    this.root.add(this.body);
    this.root.traverse((o) => { if ((o as Mesh).isMesh) { (o as Mesh).castShadow = true; } });
  }

  /** dt step; pose and inputs from game state. lateral: -1..1 fish side during a fight; tension 0..1; power 0..1 */
  update(dt: number, pose: Pose, speed: number, opts: { power?: number; tension?: number; lateral?: number; reeling?: boolean } = {}) {
    this.t += dt;
    let pitch = 0.55, yaw = 0, bend = 0.05, armL = 0.3;
    switch (pose) {
      case 'walk': case 'idle': pitch = 0.35; bend = 0.04; break;
      case 'charge': pitch = -0.3 - 1.45 * (opts.power ?? 0); bend = -0.12 * (opts.power ?? 0); armL = 0.6; break;
      case 'cast': pitch = 1.25; bend = 0.25; armL = 0.5; break;
      case 'wait': pitch = 0.95 + Math.sin(this.t * 1.3) * 0.03; bend = 0.08; break;
      case 'fight': {
        const ten = opts.tension ?? 0.3;
        pitch = 0.45 + 0.3 * ten + (opts.reeling ? Math.sin(this.t * 22) * 0.02 : 0);
        yaw = (opts.lateral ?? 0) * 0.5;
        bend = 0.15 + 0.55 * ten;
        armL = 0.9;
        break;
      }
      case 'cheer': pitch = -0.4; bend = 0; armL = -2.4; break;
    }
    // Springy follow: the cast whips forward faster than it winds back.
    const k = pose === 'cast' ? 380 : 90, damp = pose === 'cast' ? 20 : 16;
    const acc = (pitch - this.pitch) * k - this.pitchV * damp;
    this.pitchV += acc * dt; this.pitch += this.pitchV * dt;
    this.yaw += (yaw - this.yaw) * Math.min(1, dt * 8);
    this.bend += (bend - this.bend) * Math.min(1, dt * 10);
    // Arm holds the rod out in front; pitch tilts the whole arm+rod.
    this.armR.rotation.set(-this.pitch - 0.2, this.yaw, -0.15);
    this.armL.rotation.x += (-armL - this.armL.rotation.x) * Math.min(1, dt * 8);
    this.rod.setBend(this.bend, this.yaw);
    // Walk cycle
    this.walkPhase += dt * speed * 4.2;
    const sw = speed > 0.1 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.body.position.y = speed > 0.1 ? Math.abs(Math.cos(this.walkPhase)) * 0.05 : Math.sin(this.t * 2) * 0.008;
    if (pose === 'cheer') this.body.position.y = Math.abs(Math.sin(this.t * 8)) * 0.15;
  }

  tipWorld(out = new Vector3()): Vector3 { return this.rod.tip.getWorldPosition(out); }
  holdFish(_fish: Object3D | null) { /* the stand-in avatar doesn't present catches */ }
}

/** Grip, reel and three tapering segments that bend under load; `tip` is where the line leaves the rod. The rod points along +Y. */
export class RodRig {
  readonly pivot = new Group();
  readonly tip = new Object3D();
  /** Where the left hand cranks, in pivot space. */
  readonly reelHandle = new Vector3(0.085, 0.12, 0);
  private segs: Group[] = [];
  constructor() {
    const cork = new Mesh(new CylinderGeometry(0.03, 0.035, 0.35, 6), mat('#B88B5A')); cork.position.y = 0.05; this.pivot.add(cork);
    const reel = new Mesh(new CylinderGeometry(0.06, 0.06, 0.05, 8), mat('#5C6670', 0.4)); reel.rotation.z = Math.PI / 2; reel.position.set(0.06, 0.12, 0); this.pivot.add(reel);
    let parent: Object3D = this.pivot;
    const lens = [0.75, 0.75, 0.7];
    const radii = [0.022, 0.016, 0.011, 0.006];
    let y = 0.22;
    lens.forEach((len, i) => {
      const g = new Group(); g.position.y = y; parent.add(g);
      const m = new Mesh(new CylinderGeometry(radii[i + 1], radii[i], len, 5), mat(i === 0 ? PALETTE.driftwood : '#9A7A5A', 0.5));
      m.position.y = len / 2; g.add(m);
      const ring = new Mesh(new SphereGeometry(0.014, 4, 3), mat('#D9D2C0', 0.3)); ring.position.y = len; g.add(ring);
      this.segs.push(g); parent = g; y = len;
    });
    this.tip.position.y = lens[2];
    parent.add(this.tip);
    this.pivot.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
  }
  /** bend: forward curl (positive = tip pulled toward the line); side: sideways curl from a running fish. */
  setBend(bend: number, side: number) {
    this.segs.forEach((s, i) => { s.rotation.x = bend * (0.5 + i * 0.5); s.rotation.z = -side * 0.15 * i; });
  }
}

/** What the game needs from a player avatar (the generated model or the stand-in). */
export interface PlayerAvatar {
  readonly root: Group;
  update(dt: number, pose: Pose, speed: number, opts?: { power?: number; tension?: number; lateral?: number; reeling?: boolean }): void;
  tipWorld(out?: Vector3): Vector3;
  /** Show a caught fish in the player's hands (null to put it away). */
  holdFish(fish: Object3D | null): void;
}

/** TEMPORARY procedural fish used until the generated GLBs arrive. Built from a fish's palette colour. */
export function placeholderFish(color: string, length = 0.5): Group {
  const g = new Group();
  const m = mat(color, 0.5);
  const body = new Mesh(new SphereGeometry(0.5, 8, 6), m);
  body.scale.set(0.35, 0.55, 1); g.add(body);
  const tail = new Mesh(new ConeGeometry(0.28, 0.4, 4), m); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.6; tail.scale.set(0.3, 1, 1); g.add(tail);
  const fin = new Mesh(new ConeGeometry(0.15, 0.3, 3), m); fin.position.set(0, 0.32, 0); g.add(fin);
  for (const x of [-0.16, 0.16]) { const e = new Mesh(new SphereGeometry(0.05, 5, 4), mat('#1E1A26')); e.position.set(x, 0.08, 0.35); g.add(e); }
  g.scale.setScalar(length);
  return g;
}
