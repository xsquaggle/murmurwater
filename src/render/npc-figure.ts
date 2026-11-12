/**
 * NPCs in the world: the generated, rigged model when it exists (models/characters/<id>.glb),
 * otherwise a TEMPORARY procedural stand-in with the character's silhouette and colours.
 */
import {
  AnimationAction, AnimationMixer, BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, LoopRepeat, Mesh,
  MeshStandardMaterial, SphereGeometry, Vector3,
} from 'three';
import { assets } from './assets';

const mat = (hex: string, rough = 0.85) => new MeshStandardMaterial({ color: new Color(hex), roughness: rough, flatShading: true });

interface Look { height: number; width: number; coat: string; trim: string; skin: string; hair: string; hat?: 'scarf' | 'brim' | 'none'; beard?: boolean; stoop?: number; prop?: 'book' }
const LOOKS: Record<string, Look> = {
  mara: { height: 1.62, width: 1.18, coat: '#C25F55', trim: '#F2E3C6', skin: '#D9A27E', hair: '#5A3A2C', hat: 'scarf' },
  pell: { height: 1.86, width: 0.9, coat: '#4C5A66', trim: '#2F3A44', skin: '#E3B796', hair: '#E9E4DA', hat: 'brim', beard: true, stoop: 0.16 },
  wick: { height: 1.2, width: 0.85, coat: '#E86F6F', trim: '#F2E3C6', skin: '#C98E6A', hair: '#2E2420', hat: 'none', prop: 'book' },
};

function standIn(id: string): Group {
  const L = LOOKS[id] ?? LOOKS.mara;
  const g = new Group();
  const k = L.height / 1.7;
  const body = new Group();
  g.add(body);
  const coat = mat(L.coat), trim = mat(L.trim), skin = mat(L.skin), hair = mat(L.hair);
  for (const x of [-0.11, 0.11]) { const leg = new Mesh(new CylinderGeometry(0.09, 0.08, 0.55, 6), mat('#3E3A44')); leg.position.set(x, 0.3, 0); body.add(leg); }
  const torso = new Mesh(new CylinderGeometry(0.22 * L.width, 0.36 * L.width, 0.8, 8), coat); torso.position.y = 0.95; body.add(torso);
  const apron = new Mesh(new BoxGeometry(0.34 * L.width, 0.55, 0.04), trim); apron.position.set(0, 0.86, 0.27 * L.width); apron.rotation.x = -0.18; body.add(apron);
  for (const x of [-1, 1]) { const arm = new Mesh(new CapsuleGeometry(0.07, 0.42, 3, 6), coat); arm.position.set(x * 0.3 * L.width, 1.06, 0.02); arm.rotation.z = x * 0.18; body.add(arm); }
  const head = new Mesh(new SphereGeometry(0.25, 10, 8), skin); head.position.y = 1.58; body.add(head);
  const hairM = new Mesh(new SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hairM.position.y = 1.6; hairM.rotation.x = -0.25; body.add(hairM);
  for (const x of [-0.08, 0.08]) { const e = new Mesh(new SphereGeometry(0.026, 5, 4), mat('#2A2030')); e.position.set(x, 1.61, 0.23); body.add(e); }
  if (L.hat === 'scarf') { const sc = new Mesh(new SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), mat('#3FA7A0')); sc.position.y = 1.62; sc.rotation.x = -0.35; body.add(sc); }
  if (L.hat === 'brim') {
    const brim = new Mesh(new CylinderGeometry(0.42, 0.42, 0.03, 12), mat('#6E5440')); brim.position.y = 1.78; body.add(brim);
    const crown = new Mesh(new CylinderGeometry(0.2, 0.24, 0.2, 10), mat('#6E5440')); crown.position.y = 1.88; body.add(crown);
  }
  if (L.beard) { const b = new Mesh(new ConeGeometry(0.16, 0.34, 7), hair); b.position.set(0, 1.38, 0.13); b.rotation.x = Math.PI + 0.25; body.add(b); }
  if (L.prop === 'book') { const bk = new Mesh(new BoxGeometry(0.3, 0.22, 0.04), mat('#F2E3C6')); bk.position.set(0.05, 1.0, 0.32); bk.rotation.x = -0.6; body.add(bk); }
  body.rotation.x = L.stoop ?? 0;
  g.scale.setScalar(k);
  g.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = true; });
  g.userData.body = body;
  return g;
}

export class NpcFigure {
  readonly root = new Group();
  private mixer: AnimationMixer | null = null;
  private idle: AnimationAction | null = null;
  private talk: AnimationAction | null = null;
  private body: Group | null = null;
  private t = Math.random() * 10;
  private yaw: number;
  /** Height above the root for the name/marker label. */
  readonly labelHeight: number;

  constructor(readonly id: string, public restYaw: number) {
    this.yaw = restYaw;
    const model = assets.instance(`npc:${id}`);
    if (model) {
      this.root.add(model);
      this.mixer = new AnimationMixer(model);
      const clips = assets.clips(`npc:${id}`);
      const find = (n: string) => clips.find((c) => c.name === n) ?? null;
      const idle = find('idle') ?? clips[0] ?? null;
      if (idle) { this.idle = this.mixer.clipAction(idle); this.idle.setLoop(LoopRepeat, Infinity).play(); }
      const talk = find('talk');
      if (talk) { this.talk = this.mixer.clipAction(talk); this.talk.setLoop(LoopRepeat, Infinity).play(); this.talk.setEffectiveWeight(0); }
      this.labelHeight = (LOOKS[id]?.height ?? 1.7) + 0.45;
    } else {
      const s = standIn(id);
      this.body = s.userData.body as Group;
      this.root.add(s);
      this.labelHeight = (LOOKS[id]?.height ?? 1.7) + 0.5;
    }
  }

  /** player: where to look when they're close; talking: gesture. */
  update(dt: number, player: Vector3 | null, talking: boolean) {
    this.t += dt;
    let want = this.restYaw;
    if (player) {
      const dx = player.x - this.root.position.x, dz = player.z - this.root.position.z;
      if (dx * dx + dz * dz < 64) want = Math.atan2(dx, dz);
    }
    let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 3);
    this.root.rotation.y = this.yaw;
    if (this.mixer) {
      if (this.talk) {
        const w = this.talk.getEffectiveWeight() + ((talking ? 1 : 0) - this.talk.getEffectiveWeight()) * Math.min(1, dt * 5);
        this.talk.setEffectiveWeight(w); this.idle?.setEffectiveWeight(1 - w);
      }
      this.mixer.update(dt);
    } else if (this.body) {
      this.body.position.y = Math.sin(this.t * 2) * 0.012 + (talking ? Math.abs(Math.sin(this.t * 7)) * 0.025 : 0);
      this.body.rotation.z = talking ? Math.sin(this.t * 3.1) * 0.04 : 0;
    }
  }
}
