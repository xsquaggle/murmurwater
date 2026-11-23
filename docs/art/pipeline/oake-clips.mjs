// oake-clips.mjs : Captain Oake's clips, for author-anim.mjs.
// The body's sway is the library idle (carried over as `base_idle` by borrow-clips.mjs while the clips are baked, and
// dropped afterwards); her head, her arms and her pipe are authored here. At rest both her hands are in the pockets of her
// coat (the slits at her sides), the pipe in the right corner of her mouth; she rolls a little on her feet, slowly, as if
// the quay might move under her.
//   idle  two rounds of the sway (12 s): she takes her right hand out, takes the pipe from her mouth, holds it in front
//         of her and looks up at the sky for a while, then puts it back and her hand back in her pocket
//   talk  one round (6 s): the pipe stays in; her left hand comes out and goes with what she says, open, palm up, a slow
//         beat and once out toward the sea; her head nods
//   wave  once (3.2 s): the left hand comes up beside her head, palm out, and goes slowly across and back twice
// The pipe has a joint of its own (`Pipe`, its origin the end of the stem); in her hand it goes where the hand goes.
export default (c) => {
  const { vec3, quat } = c.math, TAU = 2 * Math.PI, D = c.existing.get('base_idle').duration;
  const sm = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const win = (u, a, b, c0, d) => sm((u - a) / (b - a)) * (1 - sm((u - c0) / (d - c0)));       // 0, up between a and b, 1 until c0, down by d
  const rot = (q, v) => Array.from(vec3.transformQuat(vec3.create(), v, q)), sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const nrm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const base = (t) => ({ base: { clip: 'base_idle', t } });
  const RH = c.J('RightHand'), PJ = c.J('Pipe'), PIPE = Array.from(c.P[PJ]);
  /** Where the middle of a closed hand is, from the hand joint. */
  const fistOff = (side) => { const H = c.HAND[side]; return sum(mul(Array.from(H.f0), 0.058), mul(Array.from(H.n0), H.surf + 0.018)); };

  // ---- her hands at rest: in the pockets of her coat, the wrists in the slits, the elbows out a little
  const POCKET = (side) => { const s = side === 'Left' ? 1 : -1; return { pos: [s * 0.190, 0.800, 0.112], fingers: [-s * 0.30, -0.82, -0.48], palm: [-s * 0.72, 0.05, -0.69], pole: [s * 0.9, -0.15, -0.45], twistShare: 0.6 }; };
  const sway = (t) => ({ hips: { pos: [0.010 * Math.sin(TAU * t / 6.03), 0.002 * Math.sin(TAU * 2 * t / 6.03), 0], rot: [0, 0, 1.2 * Math.sin(TAU * t / 6.03 + 0.4)] } });   // she rolls with a quay that does not move
  const rest = (t) => ({ ...base(t), ...sway(t), lHand: POCKET('Left'), rHand: POCKET('Right'), lGrip: 0.35, rGrip: 0.35 });

  // ---- the pipe: at the mouth her right hand closes round the bowl, thumb up along it
  const STEM = nrm([-0.30, -0.42, 0.86]), BOWL = nrm([-0.10, 1, 0.22]), HK = 1.12, BOWLC = sum(sum(PIPE, mul(STEM, 0.075 * HK)), mul(BOWL, 0.016 * HK));
  const HOLDF = nrm([0.25, 0.10, 0.96]), HOLDP = nrm([0.96, 0.0, -0.25]);
  const holding = (fc, pole, F = HOLDF, P = HOLDP) => { const H = c.HAND.Right, off = sum(mul(F, 0.058), mul(P, H.surf + 0.018)); return { pos: sum(fc, mul(off, -1)), fingers: F, palm: P, pole, twistShare: 0.6 }; };
  // at her chest the hand rolls over so the pipe lies in the palm, its stem rising past the thumb (a closed hand thumb up reads as a thumbs-up)
  const CUPF = nrm([0.30, 0.05, 0.95]), CUPP = (() => { const p = [0.35, 0.93, -0.10], d = p[0] * CUPF[0] + p[1] * CUPF[1] + p[2] * CUPF[2]; return nrm(sum(p, mul(CUPF, -d))); })();
  const MOUTH = holding(sum(BOWLC, [-0.004, -0.004, 0.004]), [-0.55, -0.75, -0.25]), HOLD = holding([-0.115, 0.905, 0.255], [-0.75, -0.55, -0.35], CUPF, CUPP);
  // how the pipe lies in the hand: measured once, with the hand at her mouth and the pipe still in it
  const probe = c.solve({ ...rest(0), rHand: MOUTH, rGrip: 0.8 }), qRel = quat.multiply(quat.create(), quat.conjugate(quat.create(), probe.D[RH]), probe.D[PJ]);
  const oRel = rot(quat.conjugate(quat.create(), probe.D[RH]), vec3.sub(vec3.create(), probe.X[PJ], probe.X[RH]));
  const pipe = (held) => ({ Pipe: {
    pos: (p) => { const inHand = sum(Array.from(p.X[RH]), rot(p.D[RH], oRel)); return Array.from(p.X[PJ]).map((v, i) => v + (inHand[i] - v) * held); },
    rot: (p) => { const inHand = quat.multiply(quat.create(), p.D[RH], qRel); return Array.from(quat.normalize(quat.create(), quat.slerp(quat.create(), p.D[PJ], inHand, held))); } } });

  // ---- idle
  const R_KEYS = [[0.00, POCKET('Right')], [0.09, POCKET('Right')], [0.17, MOUTH], [0.195, MOUTH], [0.27, HOLD], [0.69, HOLD], [0.765, MOUTH], [0.79, MOUTH], [0.88, POCKET('Right')], [1.00, POCKET('Right')]];
  const path = (keys, u) => c.keys(keys.map(([t, spec]) => ({ t, spec })), u);
  const idle = (t) => {
    const u = t / (2 * D), held = win(u, 0.172, 0.19, 0.77, 0.788), sky = win(u, 0.27, 0.36, 0.60, 0.69), out = win(u, 0.09, 0.12, 0.86, 0.89);
    const seaward = 14 * Math.sin(TAU * (u - 0.02) / 0.5) * (1 - win(u, 0.08, 0.14, 0.82, 0.90)), hm = win(u, 0.615, 0.63, 0.645, 0.665);              // looks along the sea before and after; a small nod at the end of the look
    return { ...rest(t), rHand: path(R_KEYS, u), rGrip: 0.35 + 0.5 * out,
      head: [-26 * sky + 5 * hm + 3 * win(u, 0.14, 0.17, 0.19, 0.24), seaward + 8 * sky, 3 * sky], spine: [-4 * sky, 0.3 * seaward, 0], extra: pipe(held) };
  };

  // ---- talk
  const GEST = (k, beat, sea) => ({ pos: [0.205 + 0.03 * k + 0.06 * sea, 0.80 + 0.03 * k + beat + 0.05 * sea, 0.222 + 0.03 * k + 0.01 * sea], fingers: nrm([-0.15 + 0.6 * sea, 0.10 + 0.25 * sea, 0.98]), palm: nrm([-0.25 * (1 - sea), 0.95 - 0.9 * sea, -0.10 - 0.2 * sea]), pole: [0.9, -0.4, -0.2], twistShare: 0.6 });
  const talk = (t) => {
    const u = t / D, up = win(u, 0.04, 0.16, 0.84, 0.96), sea = win(u, 0.52, 0.60, 0.68, 0.76), k = win(u, 0.20, 0.26, 0.34, 0.42);
    const beat = 0.016 * Math.sin(TAU * 4 * u) * up * (1 - sea), nod = 3.5 * Math.sin(TAU * 2 * u) * up;
    const A = { ...rest(t), head: [nod - 1 * up, 7 * Math.sin(TAU * u) * (1 - sea) + 12 * sea, 2.5 * Math.sin(TAU * u + 1)], spine: [2.5 * up + 1.5 * k, 2 * Math.sin(TAU * u) + 4 * sea, 0], extra: pipe(0) };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: GEST(k, beat, sea), lGrip: 0.12, lShoulder: [0, 0, 3] }, up);
  };

  // ---- wave
  const WAVE = 3.2, HI = (sw) => ({ pos: [0.330 + 0.05 * sw, 1.22, 0.11], fingers: nrm([0.10 + 0.40 * sw, 0.98, 0.08]), palm: [-0.10, 0, 1], pole: [0.85, -0.5, -0.25], twistShare: 0.6 });
  const wave = (t) => {
    const u = t / WAVE, up = win(u, 0.04, 0.28, 0.72, 0.96), sw = Math.sin(TAU * 2 * (u - 0.28) / 0.44) * win(u, 0.26, 0.34, 0.64, 0.72);
    const A = { ...rest(t), head: [-3 * up + 4 * win(u, 0.30, 0.40, 0.50, 0.62), 4 * up, 4 * up - 1.5 * sw], spine: [-1 * up, 3 * up, 2 * up], extra: pipe(0) };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: HI(sw), lGrip: 0, lShoulder: [0, 0, 8] }, up);
  };
  return { rodSocket: false, moving: ['Pipe'], clips: [{ name: 'idle', duration: 2 * D, pose: idle }, { name: 'talk', duration: D, pose: talk }, { name: 'wave', duration: WAVE, pose: wave }], sockets: [] };
};
