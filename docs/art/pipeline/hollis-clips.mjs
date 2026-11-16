// hollis-clips.mjs : Mister Hollis's clips, for author-anim.mjs.
// Ashore the body's sway is the library idle (carried over as `base_idle` by borrow-clips.mjs while the clips are baked,
// and dropped afterwards); his head, his arms and the things he carries are authored here. His right hand never lets go
// of the carpet bag when he stands; aboard it lies on his knees. The bag and the watch have joints of their own.
//   idle  two rounds of the sway: he looks up the road and down it for the packet, takes out his watch, reads it, puts it away
//   talk  one round: small, exact gestures with his left hand, and once he touches the brim of his hat
//   wave  once: the left hand goes up beside his hat and moves three times, no more than is polite
//   sit   aboard, a loop: on a bench 0.465 m above his origin, hips toward his own -X (the bow, when the node faces
//         port), chest and head turned to +Z (out over the side), the bag on his knees under his right hand, his left
//         hand out over the rail with the line in it, lifting it a little now and then
//   pull  aboard, once, 2 s, from the pose of `sit` and back to it: he draws the line in, two heaves of the left hand
//         with the right taking up the slack between them, and lifts what is on it inboard (it is up from 1.6 s to 1.76 s)
// The node `LineHand` is in his left fist where the line runs through it.
export default (c) => {
  const { vec3, quat } = c.math, TAU = 2 * Math.PI, D = c.existing.get('base_idle').duration;
  const sm = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const win = (u, a, b, c0, d) => sm((u - a) / (b - a)) * (1 - sm((u - c0) / (d - c0)));       // 0, up between a and b, 1 until c0, down by d
  const mixv = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const rot = (q, v) => Array.from(vec3.transformQuat(vec3.create(), v, q)), sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const base = (t) => ({ base: { clip: 'base_idle', t } });
  const RH = c.J('RightHand'), LH = c.J('LeftHand'), WATCH = c.J('Watch');
  /** Where a thing held in a closed mitten is: the middle of the fist. */
  const fist = (pose, side) => { const H = c.HAND[side], i = side === 'Right' ? RH : LH; return sum(Array.from(pose.X[i]), rot(pose.D[i], sum(mul(Array.from(H.f0), 0.060), mul(Array.from(H.n0), 0.036)))); };

  // ---- the bag, carried: it hangs from his right fist, its long way fore and aft, and swings a very little
  const CARRY = { pos: [-0.345, 0.975, 0.012], fingers: [0.04, -1, 0.02], palm: [1, 0.04, 0], pole: [-0.8, -0.2, -0.6], twistShare: 0.5 };
  const carried = (t) => ({ rHand: CARRY, rGrip: 1, extra: { Bag: { pos: (p) => fist(p, 'Right'), rot: [1.6 * Math.sin(TAU * t / 3.0), 0, 1.2 * Math.sin(TAU * t / 3.0 + 1.3)] } } });

  // ---- idle
  const TO_POCKET = { pos: [0.085, 1.335, 0.165], fingers: [-0.86, 0.36, -0.36], palm: [-0.2, 0.1, -0.97], pole: [0.8, -0.55, -0.2], twistShare: 0.6 };
  const READ = { pos: [0.125, 1.285, 0.285], fingers: [-0.80, 0.30, 0.52], palm: [-0.16, 0.86, -0.48], pole: [0.75, -0.65, -0.1], twistShare: 0.6 };
  const idle = (t) => {
    const u = t / (2 * D);
    const along = 30 * win(u, 0.03, 0.10, 0.20, 0.27) - 24 * win(u, 0.27, 0.34, 0.40, 0.46), peer = win(u, 0.05, 0.12, 0.19, 0.25);         // up the road, and down it
    const reach = win(u, 0.50, 0.57, 0.86, 0.93), out = win(u, 0.585, 0.65, 0.79, 0.855), held = win(u, 0.572, 0.59, 0.85, 0.868);              // hand to the breast; watch out and up; the watch in the hand
    const read = win(u, 0.63, 0.68, 0.77, 0.81), tick = Math.sin(TAU * 6 * u);
    const A = { ...base(t), ...carried(t), head: [-3 + 4 * peer + 20 * read, along * (1 - reach) + 8 * read, 2 * Math.sin(TAU * 2 * u) * (1 - read) - 4 * read], spine: [2 * peer + 3 * read, 0.3 * along * (1 - reach), 0] };
    const hand = { ...TO_POCKET, pos: mixv(TO_POCKET.pos, READ.pos, out), fingers: mixv(TO_POCKET.fingers, READ.fingers, out), palm: mixv(TO_POCKET.palm, READ.palm, out), pole: mixv(TO_POCKET.pole, READ.pole, out) };
    const watch = { pos: (p) => mixv(Array.from(p.X[WATCH]), sum(Array.from(p.palm('Left')), mul(rot(p.D[LH], Array.from(c.HAND.Left.n0)), 0.006)), held), rot: [-62 * held, 180 * held, 0] };       // face up and a little toward him, twelve away from him
    const B = { ...A, lHand: hand, lGrip: 0.25 * out, lShoulder: [0, 0, 5], extra: { ...A.extra, Watch: watch } };
    return reach < 1e-3 ? A : c.blend(A, B, reach);
  };

  // ---- talk
  const GEST = (k, beat) => ({ pos: [0.165 + 0.02 * k, 1.20 + 0.035 * k + beat, 0.27 + 0.03 * k], fingers: [-0.25, 0.45 + 0.2 * k, 0.86], palm: [-0.55, 0.75, -0.35], pole: [0.8, -0.6, -0.1], twistShare: 0.6 });
  const BRIM = { pos: [0.188, 1.710, 0.250], fingers: [-0.25, 0.93, -0.27], palm: [-0.35, -0.25, -0.90], pole: [0.9, -0.3, -0.2], twistShare: 0.6 };
  const talk = (t) => {
    const u = t / D, up = win(u, 0.04, 0.14, 0.86, 0.96), hat = win(u, 0.54, 0.64, 0.72, 0.82), k = win(u, 0.20, 0.26, 0.34, 0.40) + win(u, 0.40, 0.44, 0.48, 0.52);
    const beat = 0.012 * Math.sin(TAU * 5 * u) * up * (1 - hat), nod = 3 * Math.sin(TAU * 3 * u) * up * (1 - hat);
    const A = { ...base(t), ...carried(t), head: [nod + 9 * hat - 2 * up, 5 * Math.sin(TAU * u) * (1 - hat), 2 * Math.sin(TAU * 2 * u) * (1 - hat)], spine: [2 * up + 4 * hat, 2 * Math.sin(TAU * u), 0] };
    const g = GEST(k, beat), hand = { ...g, pos: mixv(g.pos, BRIM.pos, hat), fingers: mixv(g.fingers, BRIM.fingers, hat), palm: mixv(g.palm, BRIM.palm, hat), pole: mixv(g.pole, BRIM.pole, hat) };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: hand, lGrip: 0.3 * hat, lShoulder: [0, 0, 5 + 6 * hat] }, up);
  };

  // ---- wave
  const WAVE = 2.8, HI = (sw) => ({ pos: [0.385 + 0.035 * sw, 1.745, 0.12], fingers: [0.16 + 0.42 * sw, 0.97, 0.10], palm: [-0.12, 0, 1], pole: [0.8, -0.55, -0.25], twistShare: 0.6 });
  const wave = (t) => {
    const u = t / WAVE, up = win(u, 0.03, 0.26, 0.72, 0.96), sw = Math.sin(TAU * 3 * (u - 0.26) / 0.46) * win(u, 0.24, 0.32, 0.66, 0.74);
    const A = { ...base(t), ...carried(t), head: [5 * up * win(u, 0.30, 0.45, 0.55, 0.70) - 2 * up, 0, 5 * up - 1.5 * sw], spine: [1 * up, 3 * up, 2.5 * up], hips: { pos: [0, 0.003 * up, 0] } };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: HI(sw), lShoulder: [0, 0, 9] }, up);
  };

  // ---- aboard: on the bench, facing the bow, the line over the side to port (his +Z)
  // The game hangs its line from `LineHand` to the water, and in `pull` it hangs the catch 0.12 m under that node from
  // the clip's start until 1.7 s. So the left fist is where the catch is: it never goes back out once it has come in.
  const SEAT = { hips: [0.03, -0.434, 0.010], lFoot: [-0.565, 0, 0.062], rFoot: [-0.325, 0.006, -0.092], bag: [-0.225, 1.012, -0.005], line: [-0.070, 0.985, 0.465] };
  const ON_BAG = { pos: [SEAT.bag[0] + 0.058, SEAT.bag[1] + 0.052, SEAT.bag[2] - 0.004], fingers: [-1, -0.05, 0.05], palm: [0, -1, 0], pole: [0.2, -1, -0.35], twistShare: 0.6 };
  const seated = (o) => {                                                             // o: { sway, lean (toward the side), turn (more toward the side), look, line (the left wrist), right (the right hand, or none = on the bag) }
    const s = o.sway || 0, lean = 0.3 + (o.lean || 0), turn = o.turn || 0;
    return {
      lockShoulders: true,
      hips: { pos: [SEAT.hips[0], SEAT.hips[1] + 0.003 * s, SEAT.hips[2] + 0.012 * lean], rot: [-3, -90, 0.8 * s] },
      spine: [5 + 2 * lean, 40 + 16 * turn, -1.5 * s - 9 * lean],
      head: [(o.look ? o.look[0] : 0) + 4 * lean, 26 + (o.look ? o.look[1] : 0), 0],
      lFoot: { pos: SEAT.lFoot, rot: [0, -82, 0], pole: [-0.25, 1, 0.12] }, rFoot: { pos: SEAT.rFoot, rot: [0, -98, 0], pole: [-0.25, 1, -0.12] },
      lHand: { space: 'world', pos: o.line, fingers: [-0.10, 0, 1], palm: [-1, 0, -0.1], pole: [-0.74, -0.51, -0.43], twistShare: 0.6 }, lGrip: 1,       // the fist's hole stands plumb, so what hangs from `LineHand` hangs plumb
      rHand: { space: 'world', ...(o.right || ON_BAG) }, rGrip: 1,
      extra: { Bag: { pos: [SEAT.bag[0], SEAT.bag[1] + 0.002 * s, SEAT.bag[2]], rot: [0, 0, -4] } },
    };
  };
  const SIT = 8.0;
  const sit = (t) => {
    const u = t / SIT, s = Math.sin(TAU * u), jig = win(u, 0.30, 0.36, 0.38, 0.46) + win(u, 0.46, 0.52, 0.54, 0.64), ahead = win(u, 0.70, 0.78, 0.86, 0.95);          // twice he lifts the line a hand's breadth; once he looks ahead
    return seated({ sway: s, look: [3 - 2 * jig + 2 * ahead, -52 * ahead + 3 * Math.sin(TAU * 2 * u)], line: [SEAT.line[0], SEAT.line[1] + 0.055 * jig + 0.004 * s, SEAT.line[2] - 0.02 * jig] });
  };
  // pull: the left fist brings the line up and in by two heaves and a lift, giving a little between them; between the
  // heaves the right hand leaves the bag, takes the slack by the left fist and draws it back toward the bag.
  const PULL = 2.0, path = (keys, u) => { if (u <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) return mixv(keys[i - 1][1], keys[i][1], sm((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]))); return keys[keys.length - 1][1]; };
  const L_KEYS = [[0.00, SEAT.line], [0.05, SEAT.line], [0.24, [-0.090, 1.060, 0.395]], [0.38, [-0.086, 1.040, 0.410]], [0.56, [-0.115, 1.110, 0.325]], [0.66, [-0.111, 1.092, 0.340]], [0.80, [-0.150, 1.195, 0.235]], [0.88, [-0.150, 1.190, 0.235]], [1.00, SEAT.line]];
  const R_TAKE = [-0.215, 1.045, 0.290], R_BACK = [-0.235, 1.075, 0.120];
  const R_KEYS = [[0.00, ON_BAG.pos], [0.06, ON_BAG.pos], [0.24, R_TAKE], [0.38, R_BACK], [0.56, [R_TAKE[0], R_TAKE[1] + 0.05, R_TAKE[2] - 0.05]], [0.68, R_BACK], [0.86, ON_BAG.pos], [1.00, ON_BAG.pos]];
  const pull = (t) => {
    const u = t / PULL, on = win(u, 0.0, 0.10, 0.86, 1.0), lift = win(u, 0.66, 0.80, 0.88, 1.0), work = win(u, 0.06, 0.20, 0.70, 0.86);       // work: how far the right hand is from its place on the bag
    const heave = win(u, 0.05, 0.24, 0.30, 0.38) + win(u, 0.38, 0.56, 0.60, 0.66);
    const o = { sway: 0, lean: 0.7 * on * (1 - 0.7 * heave) * (1 - lift), turn: on * (1 - 0.4 * lift), look: [3 + 5 * on - 9 * lift, 6 * on], line: path(L_KEYS, u) };
    if (work < 1e-3) return seated(o);
    const right = { pos: path(R_KEYS, u), fingers: mixv(ON_BAG.fingers, [-0.20, -0.10, 0.97], work), palm: mixv(ON_BAG.palm, [0.95, -0.25, 0.2], work), pole: mixv(ON_BAG.pole, [-0.1, -0.9, -0.45], work), twistShare: 0.6 };
    return seated({ ...o, right });
  };

  // ---- the node in his left fist: +Y the way the line runs up through it, +Z the way his knuckles point
  const HL = c.HAND.Left, zf = vec3.normalize(vec3.create(), HL.f0), yf = vec3.scale(vec3.create(), vec3.normalize(vec3.create(), HL.curl), -1), xf = vec3.cross(vec3.create(), yf, zf);
  const lineRot = quat.conjugate(quat.create(), quat.setAxes(quat.create(), vec3.scale(vec3.create(), zf, -1), xf, yf));      // setAxes gives the turn from the world to the axes: the node wants the other way
  return { rodSocket: false, moving: ['Bag', 'Watch'],
    clips: [{ name: 'idle', duration: 2 * D, pose: idle }, { name: 'talk', duration: D, pose: talk }, { name: 'wave', duration: WAVE, pose: wave }, { name: 'sit', duration: SIT, pose: sit }, { name: 'pull', duration: PULL, pose: pull }],
    sockets: [{ name: 'LineHand', joint: 'LeftHand', spec: {}, origin: (pose) => fist(pose, 'Left'), rot: lineRot }] };
};
