/**
 * The player as the generated, rigged model (public/models/characters/player.glb).
 *
 * The body plays the model's clips (idle, walk, run); fishing is layered on procedurally so the rod
 * can answer the fight in real time: the rod's grip follows a sprung pose target, two-bone IK puts the
 * right hand on the grip and (while fighting) the left hand on the reel, and the spine twists and leans
 * into the cast and against a running fish.
 */
import { AnimationAction, AnimationMixer, Group, LoopRepeat, Object3D, Quaternion, Vector3 } from 'three';
import { RodRig, type PlayerAvatar, type Pose } from './avatar';
import { assets } from './assets';

const UP = new Vector3(0, 1, 0);
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _t = new Vector3(), _d = new Vector3(), _p = new Vector3(), _e = new Vector3();
const _q = new Quaternion(), _wq = new Quaternion(), _pq = new Quaternion();

/** Rotates a bone so that its world-space direction `from` turns to `to` (both world vectors). */
function aimBone(bone: Object3D, from: Vector3, to: Vector3) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  bone.getWorldQuaternion(_wq);
  bone.parent!.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}

/** Rotates a bone about a world axis by `angle` (keeps its children attached). */
function turnBone(bone: Object3D, axis: Vector3, angle: number) {
  if (Math.abs(angle) < 1e-5) return;
  _q.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_wq);
  bone.parent!.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}

/**
 * Analytic two-bone IK: bends upper→lower→end so `end` reaches `target`, with the elbow pushed toward `pole`
 * (a world direction). weight 0..1 blends from the animated pose.
 */
export function twoBoneIK(upper: Object3D, lower: Object3D, end: Object3D, target: Vector3, pole: Vector3, weight = 1) {
  if (weight <= 0) return;
  upper.getWorldPosition(_a); lower.getWorldPosition(_b); end.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(_c).lerp(target, weight);
  _d.copy(_t).sub(_a);
  const dist = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, _d.length()));
  _d.setLength(dist);
  const dir = _d.clone().normalize();
  _p.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0).addScaledVector(dir, dir.y);
  _p.normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _e.copy(_a).addScaledVector(dir, l1 * cosA).addScaledVector(_p, l1 * sinA); // desired elbow
  aimBone(upper, _b.clone().sub(_a), _e.clone().sub(_a));
  lower.getWorldPosition(_b); end.getWorldPosition(_c);
  aimBone(lower, _c.clone().sub(_b), _a.clone().add(_d).sub(_b));
}

/** A critically-damped-ish spring for a Vector3. */
class SpringV3 {
  readonly v = new Vector3(); readonly vel = new Vector3();
  constructor(x = 0, y = 0, z = 0) { this.v.set(x, y, z); }
  step(target: Vector3, dt: number, k: number, damp: number) {
    _t.copy(target).sub(this.v).multiplyScalar(k).addScaledVector(this.vel, -damp);
    this.vel.addScaledVector(_t, dt);
    this.v.addScaledVector(this.vel, dt);
  }
}

interface PoseTarget { grip: Vector3; lean: number; yaw: number; bend: number; spineTwist: number; spineLean: number; leftOnReel: number }

export class ModelAvatar implements PlayerAvatar {
  readonly root = new Group();
  readonly rod = new RodRig();
  private model: Group;
  private mixer: AnimationMixer;
  private actions: Record<string, AnimationAction> = {};
  private bones: Record<string, Object3D> = {};
  private t = 0;
  private grip = new SpringV3(-0.2, 0.88, 0.08);
  private lean = 0.35; private leanV = 0;
  private yaw = 0; private bend = 0;
  private twist = 0; private spineLean = 0; private side = 0;
  private leftW = 0; private rightW = 1;
  private crank = 0;
  private held: Object3D | null = null;
  private holdT = 0;
  private locoW = { idle: 1, walk: 0, run: 0 };

  static available(): boolean { return assets.has('player'); }

  constructor() {
    this.model = assets.instance('player')!;
    this.root.add(this.model);
    this.model.traverse((o) => { if ((o as any).isBone) this.bones[o.name] = o; });
    this.mixer = new AnimationMixer(this.model);
    for (const clip of assets.clips('player')) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      this.actions[clip.name] = a;
    }
    for (const n of ['idle', 'walk', 'run']) { const a = this.actions[n]; if (a) { a.play(); a.setEffectiveWeight(n === 'idle' ? 1 : 0); } }
    this.root.add(this.rod.pivot);
    this.rod.pivot.rotation.order = 'YXZ';
  }

  private target(pose: Pose, o: { power?: number; tension?: number; lateral?: number; reeling?: boolean }): PoseTarget {
    const p = o.power ?? 0, ten = o.tension ?? 0, lat = o.lateral ?? 0;
    switch (pose) {
      case 'charge': return { grip: _t.set(-0.19, 1.0 + 0.3 * p, 0.24 - 0.2 * p).clone(), lean: 0.55 - 1.65 * p, yaw: 0, bend: -0.12 * p, spineTwist: -0.45 * p, spineLean: -0.12 * p, leftOnReel: 0 };
      case 'cast': return { grip: new Vector3(-0.16, 1.02, 0.34), lean: 1.2, yaw: 0, bend: 0.25, spineTwist: 0.2, spineLean: 0.16, leftOnReel: 0 };
      case 'wait': return { grip: new Vector3(-0.15, 1.0, 0.3), lean: 0.92 + Math.sin(this.t * 1.3) * 0.03, yaw: 0, bend: 0.08, spineTwist: 0.05, spineLean: 0.04, leftOnReel: 0.6 };
      case 'fight': return {
        grip: new Vector3(-0.08 + lat * 0.06, 1.04 + ten * 0.06, 0.27), lean: 0.6 - 0.25 * ten + (o.reeling ? Math.sin(this.t * 22) * 0.02 : 0),
        yaw: lat * 0.45, bend: 0.15 + 0.6 * ten, spineTwist: lat * 0.18, spineLean: -0.1 - 0.12 * ten, leftOnReel: 1,
      };
      case 'cheer': return { grip: new Vector3(-0.24, 0.86, 0.02), lean: 0.2, yaw: 0, bend: 0, spineTwist: 0, spineLean: -0.05, leftOnReel: 0 };
      default: return { grip: new Vector3(-0.22, 0.87, 0.07), lean: 0.32, yaw: 0, bend: 0.04, spineTwist: 0, spineLean: 0, leftOnReel: 0 };
    }
  }

  update(dt: number, pose: Pose, speed: number, opts: { power?: number; tension?: number; lateral?: number; reeling?: boolean } = {}) {
    this.t += dt;
    // ---- body clips: idle / walk / run blended by ground speed.
    const fishing = pose === 'charge' || pose === 'cast' || pose === 'wait' || pose === 'fight';
    const s = fishing ? 0 : speed;
    const want = { idle: s < 0.3 ? 1 : 0, walk: s >= 0.3 && s < 3.4 ? 1 : 0, run: s >= 3.4 ? 1 : 0 };
    if (s >= 2.2 && s < 3.4) { const k = (s - 2.2) / 1.2; want.walk = 1 - k; want.run = k; }
    for (const n of ['idle', 'walk', 'run'] as const) {
      this.locoW[n] += (want[n] - this.locoW[n]) * Math.min(1, dt * 8);
      this.actions[n]?.setEffectiveWeight(this.locoW[n]);
    }
    // In-place clips: playback speed matches ground speed (walk ≈ 0.6 m/s, run ≈ 3.1 m/s at 1×).
    this.actions.walk?.setEffectiveTimeScale(Math.max(0.6, Math.min(3.2, s / 0.6)));
    this.actions.run?.setEffectiveTimeScale(Math.max(0.6, Math.min(1.6, s / 3.1)));
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);

    // ---- rod pose: sprung grip position and rod lean (the cast whips faster than it winds back).
    const tg = this.target(pose, opts);
    const fast = pose === 'cast';
    this.grip.step(tg.grip, dt, fast ? 420 : 120, fast ? 26 : 20);
    const k = fast ? 380 : 90, damp = fast ? 20 : 16;
    this.leanV += ((tg.lean - this.lean) * k - this.leanV * damp) * dt; this.lean += this.leanV * dt;
    this.yaw += (tg.yaw - this.yaw) * Math.min(1, dt * 8);
    this.bend += (tg.bend - this.bend) * Math.min(1, dt * 10);
    this.side += ((opts.lateral ?? 0) * (pose === 'fight' ? 1 : 0) - this.side) * Math.min(1, dt * 6);
    this.twist += (tg.spineTwist - this.twist) * Math.min(1, dt * 7);
    this.spineLean += (tg.spineLean - this.spineLean) * Math.min(1, dt * 7);
    this.leftW += (tg.leftOnReel - this.leftW) * Math.min(1, dt * 6);
    this.rightW += ((this.held ? 0 : 1) - this.rightW) * Math.min(1, dt * 8);

    // ---- spine: twist about the vertical, lean forward/back about the body's right axis.
    const spine = this.bones.Spine01;
    if (spine) {
      this.root.updateMatrixWorld(true);
      const right = _a.set(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(_pq)).clone();
      turnBone(spine, UP, this.twist * 0.5);
      turnBone(spine, right, this.spineLean * 0.6);
      if (this.bones.Spine) { turnBone(this.bones.Spine, UP, this.twist * 0.5); turnBone(this.bones.Spine, right, this.spineLean * 0.4); }
    }

    // ---- rod placement in body space, then hands onto it.
    this.rod.pivot.visible = !this.held;
    this.rod.pivot.position.copy(this.grip.v);
    this.rod.pivot.rotation.set(this.lean, this.yaw, 0);
    this.rod.setBend(this.bend, this.side);
    this.root.updateMatrixWorld(true);
    const B = this.bones;
    if (B.RightArm && B.RightForeArm && B.RightHand) {
      const target = this.rod.pivot.localToWorld(_c.set(0, 0.02, 0)).clone();
      const pole = this.rootDir(-1, -0.7, -0.4);
      if (this.held) {
        this.holdT += dt;
        const lift = Math.min(1, this.holdT * 3);
        const center = this.root.localToWorld(new Vector3(0, 1.05 + 0.18 * lift, 0.32));
        this.held.position.copy(center);
        this.held.quaternion.copy(this.root.getWorldQuaternion(_wq)).multiply(_q.setFromAxisAngle(UP, Math.PI / 2));
        this.held.rotateZ(Math.sin(this.t * 9) * 0.12 * (1 - Math.min(1, this.holdT / 2)));
        twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, this.root.localToWorld(new Vector3(-0.11, 1.07 + 0.18 * lift, 0.3)), this.rootDir(-1, -0.6, -0.2));
        if (B.LeftArm && B.LeftForeArm && B.LeftHand) twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, this.root.localToWorld(new Vector3(0.11, 1.07 + 0.18 * lift, 0.3)), this.rootDir(1, -0.6, -0.2));
      } else {
        twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, target, pole, this.rightW);
      }
    }
    if (!this.held && this.leftW > 0.01 && B.LeftArm && B.LeftForeArm && B.LeftHand) {
      if (opts.reeling && pose === 'fight') this.crank += dt * 13;
      const h = this.rod.reelHandle;
      const local = _d.set(h.x + 0.02, h.y + Math.sin(this.crank) * 0.035, Math.cos(this.crank) * 0.035);
      const target = this.rod.pivot.localToWorld(local.clone());
      twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, target, this.rootDir(1, -0.8, -0.3), this.leftW);
    }
  }

  /** A direction in the avatar's local frame, as a world vector. */
  private rootDir(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).normalize().applyQuaternion(this.root.getWorldQuaternion(_wq));
  }

  tipWorld(out = new Vector3()): Vector3 { return this.rod.tip.getWorldPosition(out); }

  holdFish(fish: Object3D | null) {
    if (this.held && this.held !== fish) this.held.removeFromParent();
    this.held = fish;
    this.holdT = 0;
    if (fish) this.root.parent?.add(fish);
  }
}
