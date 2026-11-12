/**
 * NPCs in the world: the generated, rigged model when it exists (models/characters/<id>.glb),
 * otherwise a TEMPORARY procedural stand-in with the character's silhouette and colours.
 */
import {
  AnimationAction, AnimationMixer, BoxGeometry, LoopOnce, Object3D, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, LoopRepeat, Mesh,
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

/**
 * An NPC: the model's idle loop at rest (or `sit` on a seat when it has one and the player is away),
 * a crossfade into `talk` while talking, a `wave` when the player walks up after a while away,
 * and an occasional `idle_look`. Stand-ins just bob.
 */
export class NpcFigure {
  /** Stays at the NPC's spot; holds the seat (if any) and the turning figure. */
  readonly root = new Group();
  private fig = new Group();
  private mixer: AnimationMixer | null = null;
  private acts: Record<string, AnimationAction> = {};
  private w: Record<string, number> = {};
  private oneShot: { name: string; until: number } | null = null;
  private body: Group | null = null;
  private seat: Group | null = null;
  private sitW = 0;
  /** Clip names for each role (Wick's sketchbook versions replace the plain ones). */
  private role = { idle: 'idle', talk: 'talk', look: 'idle_look' };
  private heldBook: Object3D | null = null;
  private groundBook: Object3D | null = null;
  private t = Math.random() * 10;
  private nextLook = 8 + Math.random() * 10;
  private awayFor = 999;
  private wasNear = false;
  private yaw: number;
  /** Height above the root for the name/marker label. */
  labelHeight: number;

  constructor(readonly id: string, public restYaw: number) {
    this.yaw = restYaw;
    this.root.add(this.fig);
    const model = assets.instance(`npc:${id}`);
    if (model) {
      this.fig.add(model);
      this.mixer = new AnimationMixer(model);
      for (const clip of assets.clips(`npc:${id}`)) {
        const a = this.mixer.clipAction(clip);
        if (clip.name === 'wave' || clip.name === 'idle_look') a.setLoop(LoopOnce, 1);
        else { a.setLoop(LoopRepeat, Infinity); a.play(); }
        a.setEffectiveWeight(0);
        this.acts[clip.name] = a; this.w[clip.name] = 0;
      }
      if (!this.acts.idle) { const first = Object.keys(this.acts)[0]; if (first) this.acts.idle = this.acts[first]; }
      // Holding a sketchbook: the book_* clips with the book in BookSocket.
      const bookSocket = model.getObjectByName('BookSocket');
      if (this.acts.book_idle && bookSocket && assets.has('sketchbook')) {
        this.role = { idle: 'book_idle', talk: this.acts.book_talk ? 'book_talk' : 'talk', look: this.acts.book_idle_look ? 'book_idle_look' : 'idle_look' };
        this.heldBook = assets.instance('sketchbook')!;
        bookSocket.add(this.heldBook);
      }
      for (const n of ['wave', 'book_idle_look']) if (this.acts[n]) { this.acts[n].stop(); this.acts[n].setLoop(LoopOnce, 1); }
      // A sitter gets an upturned tackle box for a seat, with the sketchbook put down beside it.
      if (this.acts.sit && assets.has('tackleBox')) {
        this.seat = new Group();
        const box = assets.instance('tackleBox')!; this.seat.add(box);
        const book = assets.instance('sketchbook');
        if (book) { book.rotation.set(-Math.PI / 2, 0, 0.5); book.position.set(0.36, 0.03, 0.12); this.seat.add(book); this.groundBook = book; }
        this.root.add(this.seat);
      }
      this.labelHeight = (LOOKS[id]?.height ?? 1.7) + 0.45;
    } else {
      const s = standIn(id);
      this.body = s.userData.body as Group;
      this.fig.add(s);
      this.labelHeight = (LOOKS[id]?.height ?? 1.7) + 0.5;
    }
  }

  private play(name: string) {
    const a = this.acts[name]; if (!a) return;
    a.reset().play();
    this.oneShot = { name, until: this.t + a.getClip().duration - 0.35 };
  }

  /** player: where to look when they're close; talking: gesture. */
  update(dt: number, player: Vector3 | null, talking: boolean) {
    this.t += dt;
    let d2 = Infinity;
    if (player) { const dx = player.x - this.root.position.x, dz = player.z - this.root.position.z; d2 = dx * dx + dz * dz; }
    const near = d2 < 64;
    // Sitters stay seated until the player is close, and face their rest direction while seated.
    const sitting = !!this.seat && !talking && d2 > 4.5 * 4.5;
    this.sitW += ((sitting ? 1 : 0) - this.sitW) * Math.min(1, dt * 3);
    let want = this.restYaw;
    if (near && this.sitW < 0.5 && player) want = Math.atan2(player.x - this.root.position.x, player.z - this.root.position.z);
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 3);
    this.fig.rotation.y = this.yaw;
    if (this.seat) {
      // Seated on the box; standing a step in front of it.
      this.seat.rotation.y = this.restYaw;
      const f = 0.42 * (1 - this.sitW);
      this.fig.position.set(Math.sin(this.restYaw) * f, 0.04 * this.sitW, Math.cos(this.restYaw) * f);
    }
    if (this.mixer) {
      // A wave when the player walks up after a while away; a look around now and then when alone.
      if (near && !this.wasNear && this.awayFor > 20 && !talking && this.acts.wave) this.play('wave');
      this.awayFor = near ? 0 : this.awayFor + dt;
      this.wasNear = near;
      if (!near && !sitting && this.t > this.nextLook && this.acts[this.role.look] && !this.oneShot) { this.play(this.role.look); this.nextLook = this.t + 12 + Math.random() * 10; }
      if (this.oneShot && (this.t > this.oneShot.until || talking || sitting)) this.oneShot = null;
      const target: Record<string, number> = {};
      const base = talking && this.acts[this.role.talk] ? this.role.talk : this.role.idle;
      if (this.oneShot) target[this.oneShot.name] = 1;
      else if (this.seat && this.sitW > 0.02 && !talking) { target.sit = this.sitW; target[this.role.idle] = 1 - this.sitW; }
      else target[base] = 1;
      // The book is in hand unless seated (then it lies beside the seat).
      const inHand = !this.seat || this.sitW < 0.5;
      if (this.heldBook) this.heldBook.visible = inHand;
      if (this.groundBook) this.groundBook.visible = !this.heldBook || !inHand;
      const rate = Math.min(1, dt * 5);
      for (const n of Object.keys(this.acts)) {
        this.w[n] += ((target[n] ?? 0) - this.w[n]) * rate;
        this.acts[n].setEffectiveWeight(this.w[n]);
      }
      this.mixer.update(dt);
    } else if (this.body) {
      this.body.position.y = Math.sin(this.t * 2) * 0.012 + (talking ? Math.abs(Math.sin(this.t * 7)) * 0.025 : 0);
      this.body.rotation.z = talking ? Math.sin(this.t * 3.1) * 0.04 : 0;
    }
  }
}
