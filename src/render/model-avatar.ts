/**
 * The player as the generated, rigged model (public/models/characters/player.glb).
 *
 * Away from the water the body plays the authored rod-carrying clips and the rod sits in the hand's
 * RodSocket. While fishing the rod is placed procedurally so it can answer the fight in real time: its
 * grip follows a sprung pose target, two-bone IK brings the right fist onto the grip (turned so the socket
 * lines up with the rod) and, while fighting, the left hand onto the reel crank; the spine twists and leans
 * into the cast and against a running fish, over the authored fishing stance and lean clips.
 * A landed fish is shown with the authored show_catch clip, sitting in the CatchSocket between the palms.
 */
import { AnimationAction, AnimationMixer, Euler, Group, LoopOnce, LoopRepeat, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { RodRig, type PlayerAvatar, type Pose } from './avatar';
import { assets } from './assets';

const UP = new Vector3(0, 1, 0);
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _t = new Vector3(), _d = new Vector3(), _p = new Vector3(), _e = new Vector3();
const _q = new Quaternion(), _wq = new Quaternion(), _pq = new Quaternion(), _hq = new Quaternion(), _sq = new Quaternion();
const _m = new Matrix4(), _sp = new Vector3(), _ss = new Vector3(), _eu = new Euler(0, 0, 0, 'YXZ');

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

/** leftOnReel / leftOnButt: how much the left hand is on the reel crank or on the rod's butt (two-handed cast). */
interface PoseTarget { grip: Vector3; lean: number; yaw: number; roll: number; bend: number; spineTwist: number; spineLean: number; leftOnReel: number; leftOnButt: number }

/** How long the forward whip lasts before the body relaxes into the waiting stance. */
const FOLLOW_THROUGH = 0.24;

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
  private buttW = 0; private roll = 0;
  /** Rod flex: a lightly damped spring dragged by the rod's swing, so the tip lags a whip and recoils after it. */
  private flex = 0; private flexV = 0;
  private castT = 99; private lastPose: Pose = 'idle';
  private crank = 0;
  private held: Object3D | null = null;
  private holdT = 0;
  /** Body clip weights, eased toward their targets each frame (they always sum to about 1). */
  private w: Record<string, number> = {};
  /** 0 = rod in the hand socket (walking about), 1 = rod placed procedurally (fishing). */
  private fishW = 0;
  private rodSocket: Object3D | null = null;
  private catchSocket: Object3D | null = null;
  /** Clip names for each role, preferring the authored rod clips when the model has them. */
  private clip: { idle: string; walk: string; run: string; wait: string; leanL?: string; leanR?: string; show?: string; charge?: string; cast?: string; sit?: string };
  /** 0..1: seated at a boat's tiller (the rod is stowed and the right hand is on the bar). */
  private sitW = 0;
  /**
   * The mixer's output for the bones edited procedurally. three's mixer only writes a bone when its
   * animated value changes, so without restoring this each frame the IK and spine edits would pile up
   * on static or slow clips.
   */
  private animQ = new Map<Object3D, Quaternion>();

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
    const has = (n: string) => (this.actions[n] ? n : undefined);
    const idle = has('rod_idle') ?? 'idle';
    this.clip = {
      idle, walk: has('rod_walk') ?? 'walk', run: has('rod_run') ?? 'run', wait: has('rod_wait') ?? idle,
      leanL: has('rod_lean_left'), leanR: has('rod_lean_right'), show: has('show_catch'),
      charge: has('rod_charge'), cast: has('rod_cast'), sit: has('boat_sit'),
    };
    // One-shots hold their last frame; the charge clip is scrubbed by cast power, never played.
    for (const n of [this.clip.show, this.clip.cast, this.clip.charge]) if (n) { const a = this.actions[n]; a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; }
    for (const n of new Set(Object.values(this.clip))) {
      const a = n ? this.actions[n] : undefined;
      if (a && n !== this.clip.show) { a.play(); a.setEffectiveWeight(n === idle ? 1 : 0); }
      if (n) this.w[n] = n === idle ? 1 : 0;
    }
    if (this.clip.charge) this.actions[this.clip.charge].setEffectiveTimeScale(0);
    for (const n of ['Spine01', 'Spine', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand']) {
      const b = this.bones[n]; if (b) this.animQ.set(b, b.quaternion.clone());
    }
    this.rodSocket = this.model.getObjectByName('RodSocket') ?? null;
    this.catchSocket = this.model.getObjectByName('CatchSocket') ?? null;
    this.root.add(this.rod.pivot);
    this.rod.pivot.rotation.order = 'YXZ';
  }

  private target(pose: Pose, o: { power?: number; tension?: number; lateral?: number; reeling?: boolean }): PoseTarget {
    const p = o.power ?? 0, ten = o.tension ?? 0, lat = o.lateral ?? 0;
    const wait: PoseTarget = { grip: new Vector3(-0.15, 1.0, 0.3), lean: 0.92 + Math.sin(this.t * 1.3) * 0.03, yaw: 0, roll: 0, bend: 0.08, spineTwist: 0.05, spineLean: 0.04, leftOnReel: 0.6, leftOnButt: 0 };
    switch (pose) {
      case 'charge': {
        // Wind-up for a two-handed overhead cast: hands rise in front of the right shoulder, the rod tips
        // back past vertical and out to the side, the shoulders coil; it trembles as it nears full power.
        const e = p * p * (3 - 2 * p);
        const tremble = Math.sin(this.t * 43) * 0.012 * p * p;
        return {
          grip: new Vector3(-0.2 - 0.02 * e, 1.02 + 0.3 * e, 0.22 - 0.12 * e), lean: 0.5 - 1.75 * e + tremble, yaw: 0, roll: 0.3 * e,
          bend: -0.1 * e, spineTwist: -0.55 * e, spineLean: -0.16 * e, leftOnReel: 0, leftOnButt: Math.min(1, p * 4),
        };
      }
      case 'cast':
        // The throw: punch the grip forward and down while the left hand pulls the butt in, then relax.
        if (this.castT < FOLLOW_THROUGH) return { grip: new Vector3(-0.12, 1.13, 0.47), lean: 1.14, yaw: 0, roll: 0.04, bend: 0.1, spineTwist: 0.38, spineLean: 0.32, leftOnReel: 0, leftOnButt: 1 };
        return { ...wait, leftOnReel: 0.6 * Math.min(1, (this.castT - FOLLOW_THROUGH) * 4), leftOnButt: Math.max(0, 1 - (this.castT - FOLLOW_THROUGH) * 5) };
      case 'wait': return wait;
      case 'fight': return {
        grip: new Vector3(-0.08 + lat * 0.06, 1.04 + ten * 0.06, 0.27), lean: 0.6 - 0.25 * ten + (o.reeling ? Math.sin(this.t * 22) * 0.02 : 0),
        yaw: lat * 0.45, roll: 0, bend: 0.15 + 0.6 * ten, spineTwist: lat * 0.18, spineLean: -0.1 - 0.12 * ten, leftOnReel: 1, leftOnButt: 0,
      };
      case 'cheer': return { grip: new Vector3(-0.24, 0.86, 0.02), lean: 0.2, yaw: 0, roll: 0, bend: 0, spineTwist: 0, spineLean: -0.05, leftOnReel: 0, leftOnButt: 0 };
      default: return { grip: new Vector3(-0.22, 0.87, 0.07), lean: 0.32, yaw: 0, roll: 0, bend: 0.04, spineTwist: 0, spineLean: 0, leftOnReel: 0, leftOnButt: 0 };
    }
  }

  update(dt: number, pose: Pose, speed: number, opts: { power?: number; tension?: number; lateral?: number; reeling?: boolean } = {}) {
    this.t += dt;
    if (pose === 'cast' && this.lastPose !== 'cast') {
      this.castT = 0;
      if (this.clip.cast) this.actions[this.clip.cast].reset().play();
    }
    this.castT += dt;
    this.lastPose = pose;
    // ---- body clips: locomotion by ground speed; the fishing stance (and lean against a run) while fishing;
    // the wind-up scrubbed by cast power and the throw played once; show_catch while holding a fish up.
    const fishing = pose === 'charge' || pose === 'cast' || pose === 'wait' || pose === 'fight';
    const C = this.clip;
    const want: Record<string, number> = {};
    for (const n of Object.keys(this.w)) want[n] = 0;
    const showing = !!(this.held && C.show && this.catchSocket);
    const sitting = pose === 'sit' && !!C.sit;
    this.sitW += ((sitting ? 1 : 0) - this.sitW) * Math.min(1, dt * 8);
    if (showing) want[C.show!] = 1;
    else if (sitting) want[C.sit!] = 1;
    else if (fishing) {
      const lat = pose === 'fight' ? Math.max(-1, Math.min(1, opts.lateral ?? 0)) : 0;
      const lean = Math.abs(lat) * 0.75;
      // Lean away from the fish: a run to the left (+lateral) is fought by leaning right.
      const leanClip = lat > 0 ? C.leanR : C.leanL;
      if (pose === 'charge' && C.charge) {
        const a = this.actions[C.charge];
        a.time = Math.max(0, Math.min(0.999, opts.power ?? 0)) * a.getClip().duration;
        want[C.charge] = 1;
      } else if (pose === 'cast' && C.cast && this.castT < this.actions[C.cast].getClip().duration - 0.08) want[C.cast] = 1;
      else if (leanClip && lean > 0) { want[leanClip] = lean; want[C.wait] = (want[C.wait] ?? 0) + 1 - lean; }
      else want[C.wait] = 1;
    } else {
      const s = speed;
      let walk = s >= 0.3 && s < 3.4 ? 1 : 0, run = s >= 3.4 ? 1 : 0;
      if (s >= 2.2 && s < 3.4) { const k = (s - 2.2) / 1.2; walk = 1 - k; run = k; }
      want[C.walk] = (want[C.walk] ?? 0) + walk; want[C.run] = (want[C.run] ?? 0) + run; want[C.idle] = (want[C.idle] ?? 0) + (s < 0.3 ? 1 : 0);
      // In-place clips: playback speed matches ground speed (walk ≈ 0.6 m/s, run ≈ 3.1 m/s at 1×).
      this.actions[C.walk]?.setEffectiveTimeScale(Math.max(0.6, Math.min(3.2, s / 0.6)));
      this.actions[C.run]?.setEffectiveTimeScale(Math.max(0.6, Math.min(1.6, s / 3.1)));
    }
    const rate = Math.min(1, dt * (showing ? 12 : pose === 'cast' ? 22 : pose === 'charge' ? 12 : 8));
    for (const n of Object.keys(this.w)) {
      this.w[n] += (want[n] - this.w[n]) * rate;
      this.actions[n]?.setEffectiveWeight(this.w[n]);
    }
    this.fishW += ((fishing ? 1 : 0) - this.fishW) * Math.min(1, dt * 7);
    for (const [b, q] of this.animQ) b.quaternion.copy(q);
    this.mixer.update(dt);
    for (const [b, q] of this.animQ) q.copy(b.quaternion);
    this.model.updateMatrixWorld(true);

    // ---- rod pose: sprung grip position and rod lean. The throw is a much stiffer spring than the
    // wind-up, so the rod whips forward, overshoots a little and settles. Stepped at ≥120 Hz so the stiff
    // springs stay stable at low frame rates.
    const tg = this.target(pose, opts);
    const whip = pose === 'cast' && this.castT < FOLLOW_THROUGH + 0.1;
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.grip.step(tg.grip, h, whip ? 460 : 120, whip ? 28 : 20);
      const k = whip ? 480 : 90, damp = whip ? 25 : 16;
      this.leanV += ((tg.lean - this.lean) * k - this.leanV * damp) * h; this.lean += this.leanV * h;
      // The tip lags the swing (flex opposes the rod's angular velocity) and rings once the swing stops.
      this.flexV += ((-this.leanV * 0.017 - this.flex) * 260 - this.flexV * 9) * h; this.flex += this.flexV * h;
    }
    this.flex = Math.max(-0.5, Math.min(0.5, this.flex));
    const quick = pose === 'cast' ? 20 : 8;
    this.yaw += (tg.yaw - this.yaw) * Math.min(1, dt * 8);
    this.roll += (tg.roll - this.roll) * Math.min(1, dt * quick);
    this.bend += (tg.bend - this.bend) * Math.min(1, dt * 10);
    this.side += ((opts.lateral ?? 0) * (pose === 'fight' ? 1 : 0) - this.side) * Math.min(1, dt * 6);
    this.twist += (tg.spineTwist - this.twist) * Math.min(1, dt * (pose === 'cast' ? 18 : 7));
    this.spineLean += (tg.spineLean - this.spineLean) * Math.min(1, dt * (pose === 'cast' ? 16 : 7));
    const leftWant = Math.max(tg.leftOnReel, tg.leftOnButt);
    this.leftW += (leftWant - this.leftW) * Math.min(1, dt * (pose === 'charge' || pose === 'cast' ? 12 : 6));
    this.buttW += ((leftWant > 0 ? tg.leftOnButt / leftWant : 0) - this.buttW) * Math.min(1, dt * 8);
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

    // ---- rod placement in body space: the hand's socket when walking about, the sprung target when fishing.
    this.rod.pivot.visible = !this.held && this.sitW < 0.5;
    _eu.set(this.lean, this.yaw, this.roll);
    const procQ = _q.setFromEuler(_eu).clone();
    const fw = this.rodSocket ? this.fishW : 1;
    if (this.rodSocket && fw < 0.999) {
      this.root.updateMatrixWorld(true);
      _m.copy(this.root.matrixWorld).invert().multiply(this.rodSocket.matrixWorld).decompose(_sp, _sq, _ss);
      this.rod.pivot.position.lerpVectors(_sp, this.grip.v, fw);
      this.rod.pivot.quaternion.slerpQuaternions(_sq, procQ, fw);
    } else {
      this.rod.pivot.position.copy(this.grip.v);
      this.rod.pivot.quaternion.copy(procQ);
    }
    this.rod.setBend((this.bend + this.flex) * fw, this.side * fw);
    this.root.updateMatrixWorld(true);
    const B = this.bones;
    if (this.held) this.placeHeld(dt);
    else if (B.RightArm && B.RightForeArm && B.RightHand) {
      const w = this.rightW * fw;
      if (this.rodSocket && w > 0.001) {
        // Where the wrist must be, and how the fist must turn, for the socket to land on the rod's grip.
        const hand = B.RightHand, sock = this.rodSocket;
        this.rod.pivot.getWorldQuaternion(_hq).multiply(_sq.copy(sock.quaternion).invert());
        hand.getWorldScale(_ss);
        const wrist = this.rod.pivot.getWorldPosition(new Vector3()).sub(_sp.copy(sock.position).multiply(_ss).applyQuaternion(_hq));
        twoBoneIK(B.RightArm, B.RightForeArm, hand, wrist, this.rootDir(-1, -0.7, -0.4), w);
        hand.getWorldQuaternion(_wq).slerp(_hq, w);
        hand.parent!.getWorldQuaternion(_pq);
        hand.quaternion.copy(_pq.invert().multiply(_wq));
        hand.updateMatrixWorld(true);
      } else if (!this.rodSocket) {
        twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, this.rod.pivot.localToWorld(_c.set(0, 0.02, 0)).clone(), this.rootDir(-1, -0.7, -0.4), this.rightW);
      }
    }
    if (!this.held && this.leftW * fw > 0.01 && B.LeftArm && B.LeftForeArm && B.LeftHand) {
      if (opts.reeling && pose === 'fight') this.crank += dt * 13;
      // The left hand: on the reel crank, or gripping the rod's butt for a two-handed cast.
      const rh = this.rod.reelHandle;
      const local = _d.set(rh.x + 0.02, rh.y + Math.sin(this.crank) * 0.035, Math.cos(this.crank) * 0.035).lerp(this.rod.butt, this.buttW);
      const target = this.rod.pivot.localToWorld(local.clone());
      twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, target, this.rootDir(1, -0.8, -0.3), this.leftW * fw);
    }
  }

  /** The caught fish: in the CatchSocket under show_catch, or held up by two-hand IK without it. */
  private placeHeld(dt: number) {
    const held = this.held!, B = this.bones;
    this.holdT += dt;
    const wiggle = Math.sin(this.t * 9) * 0.12 * (1 - Math.min(1, this.holdT / 2));
    if (this.clip.show && this.catchSocket) {
      held.position.set(0, 0, 0);
      held.rotation.set(0, 0, wiggle);
      return;
    }
    const lift = Math.min(1, this.holdT * 3);
    const center = this.root.localToWorld(new Vector3(0, 1.05 + 0.18 * lift, 0.32));
    held.position.copy(center);
    held.quaternion.copy(this.root.getWorldQuaternion(_wq)).multiply(_q.setFromAxisAngle(UP, Math.PI / 2));
    held.rotateZ(wiggle);
    if (B.RightArm && B.RightForeArm && B.RightHand) twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, this.root.localToWorld(new Vector3(-0.11, 1.07 + 0.18 * lift, 0.3)), this.rootDir(-1, -0.6, -0.2));
    if (B.LeftArm && B.LeftForeArm && B.LeftHand) twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, this.root.localToWorld(new Vector3(0.11, 1.07 + 0.18 * lift, 0.3)), this.rootDir(1, -0.6, -0.2));
  }

  /** A direction in the avatar's local frame, as a world vector. */
  private rootDir(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).normalize().applyQuaternion(this.root.getWorldQuaternion(_wq));
  }

  tipWorld(out = new Vector3()): Vector3 { return this.rod.tip.getWorldPosition(out); }
  get rodOut(): boolean { return !this.held && this.sitW < 0.5; }

  holdFish(fish: Object3D | null) {
    if (this.held && this.held !== fish) {
      if (this.held.userData.socketScale) { this.held.scale.multiplyScalar(this.held.userData.socketScale); delete this.held.userData.socketScale; }
      this.held.removeFromParent();
    }
    this.held = fish;
    this.holdT = 0;
    if (!fish) return;
    const show = this.clip.show ? this.actions[this.clip.show] : undefined;
    if (show && this.catchSocket) {
      // Parent to the socket, undoing any scale the skeleton applies so the fish keeps its size.
      this.catchSocket.getWorldScale(_ss);
      fish.userData.socketScale = _ss.x;
      fish.scale.divideScalar(_ss.x);
      this.catchSocket.add(fish);
      show.reset().play();
    } else this.root.parent?.add(fish);
  }
}
