// Fishing and boat clips for the player. See author-anim.mjs for the spec format.
export default function (c) {
  const { lerp, keys, ease, blend } = c;
  const TAU = Math.PI * 2;
  const body0 = { base: { clip: 'idle', t: 0 } };            // frozen first frame of the mocap idle: the common stance
  const idleAt = (t) => ({ base: { clip: 'idle', t } });      // live mocap idle underneath (breathing, weight shifts)

  // ---- hand poses (chest space) ----
  const L_REST = { pos: c.chestSpace(body0, 'LeftHand'), pole: [0.7, -0.3, -0.6] };   // where the idle leaves the left hand
  const R_IDLE = { pos: [-0.215, 0.90, 0.15], rod: [-0.10, 0.97, 0.20], pole: [-0.5, -0.5, -0.7] };
  const R_WAIT = { pos: [-0.13, 0.93, 0.25], rod: [-0.03, 0.71, 0.70], pole: [-0.6, -0.6, -0.5] };
  const R_LOW  = { pos: [-0.13, 0.94, 0.27], rod: [-0.02, 0.50, 0.866], pole: [-0.6, -0.6, -0.5] };
  const R_BACK = { pos: [-0.26, 1.30, 0.02], rod: [-0.12, 0.50, -0.86], pole: [-0.8, -0.2, 0.5] };
  const R_REEL = { pos: [-0.11, 0.94, 0.215], rod: [0.03, 0.87, 0.50], pole: [-0.6, -0.7, -0.3] };

  const wait = (t) => ({ ...idleAt(t), rHand: R_WAIT, rGrip: 1 });
  const WAIT0 = wait(0);

  const CHARGE0 = { ...body0, rHand: R_LOW, rGrip: 1, spine: [3, 0, 0], hips: { pos: [0, -0.01, 0.01], rot: [0, 0, 0] }, lHand: L_REST, look: [0, 0, 0] };
  const CHARGE1 = { ...body0, rHand: R_BACK, rGrip: 1, spine: [-7, -26, 0], hips: { pos: [0.0, -0.03, -0.035], rot: [0, -10, 0] }, lHand: { pos: [0.20, 1.00, 0.22], pole: [0.6, -0.6, -0.4] }, look: [-2, -6, 0] };

  const CAST_LOW = { ...body0, rGrip: 1, rHand: { pos: [-0.12, 1.01, 0.32], rod: [0.0, 0.22, 0.975], pole: [-0.7, -0.6, -0.2] }, spine: [12, 8, 0], hips: { pos: [0, -0.03, 0.03], rot: [0, 4, 0] }, lHand: { pos: [0.22, 0.95, 0.02], pole: [0.6, -0.5, -0.6] }, look: [2, 0, 0] };
  const reelPose = (phase, extra = {}) => {
    const a = phase * TAU; const pump = Math.sin(a) * 0.5 + 0.5;
    return { ...body0, rGrip: 1, lGrip: 0.7, spine: [-5 - pump * 1.5, 0, 0], hips: { pos: [0, -0.02, -0.015], rot: [0, 0, 0] },
      rHand: { ...R_REEL, pos: [R_REEL.pos[0], R_REEL.pos[1] + pump * 0.008, R_REEL.pos[2]] },
      lHand: { space: 'socket', pos: [0.195, 0.12 + 0.03 * Math.cos(a), 0.03 * Math.sin(a) - 0.02], pole: [0.5, -0.8, -0.3], fingers: [-1, 0.1, 0.1], palm: [0, -0.6, -0.8] }, ...extra };
  };

  // ---- show the catch: both hands lift a fish to chest height ----
  const cup = (y, z, spread = 0.105) => ({
    rHand: { pos: [-spread, y, z], fingers: [0.55, 0.15, 0.82], palm: [0.15, 0.97, -0.15], pole: [-0.6, -0.7, -0.3] },
    lHand: { pos: [spread, y, z], fingers: [-0.55, 0.15, 0.82], palm: [-0.15, 0.97, -0.15], pole: [0.6, -0.7, -0.3] }, rGrip: 0.3, lGrip: 0.3 });
  const CATCH_DIP = { ...body0, ...cup(0.90, 0.22, 0.115), spine: [8, 0, 0], hips: { pos: [0, -0.035, 0.0], rot: [0, 0, 0] }, look: [10, 0, 0] };
  const CATCH_HOLD = { ...body0, ...cup(1.04, 0.21), spine: [-5, 0, 0], hips: { pos: [0, 0, -0.01], rot: [0, 0, 0] }, look: [-6, 0, 0] };
  const carry = (clip, rod, pos) => (t) => ({ base: { clip, t }, rHand: { pos, rod, rodSpace: 'world', pole: [-0.5, -0.5, -0.7] }, rGrip: 1 });

  // ---- boat_sit: seated on a thwart 0.35 m above the origin, right hand back on the tiller ----
  // Built on the bind pose. The tiller hand and both feet stay put (they are on the boat); the body sways over them.
  const SEAT = { hips: [0, -0.30, -0.02], foot: 0.37, tiller: [-0.31, 0.58, -0.26] };
  const boatSit = (t) => {
    const a = TAU * t / 4.0, s = Math.sin(a), s2 = Math.sin(2 * a + 0.6), sl = Math.sin(a - 0.9);
    return {
      lockShoulders: true,
      hips: { pos: [SEAT.hips[0] + 0.006 * s, SEAT.hips[1] + 0.003 * s2, SEAT.hips[2]], rot: [-3, -4, 1.3 * s] },
      spine: [20 + 1.2 * s2, -10 + 1.0 * sl, -2.4 * sl],
      look: [2 + 0.8 * s2, -2 + 2.0 * sl, 0],
      rFoot: { pos: [-0.035, 0, SEAT.foot], pole: [-0.22, 0.5, 1] },
      lFoot: { pos: [0.045, 0, SEAT.foot - 0.03], pole: [0.26, 0.5, 1] },
      rHand: { space: 'world', pos: SEAT.tiller, rod: [0.05, 0.08, 1], rodSpace: 'world', pole: [-0.5, -0.4, -0.8] }, rGrip: 1,
      lHand: { space: 'world', pos: [0.165, 0.635, 0.13], fingers: [-0.18, -0.20, 1], palm: [0.05, -1, -0.1], pole: [0.8, -0.1, -0.6] }, lGrip: 0.18,
    };
  };

  const clips = [
    { name: 'rod_idle', duration: c.existing.get('idle').duration, pose: (t) => ({ ...idleAt(t), rHand: R_IDLE, rGrip: 1 }) },
    { name: 'rod_wait', duration: c.existing.get('idle').duration, pose: wait },
    { name: 'rod_charge', duration: 1.0, pose: (t) => lerp(CHARGE0, CHARGE1, t) },
    { name: 'rod_cast', duration: 0.45, pose: (t) => t <= 0.27 ? keys([
        { t: 0.00, spec: CHARGE1 },
        { t: 0.16, spec: { ...body0, rGrip: 1, rHand: { pos: [-0.20, 1.24, 0.19], rod: [-0.05, 0.94, 0.33], pole: [-0.8, -0.4, 0.2] }, spine: [4, -6, 0], hips: { pos: [0, -0.02, 0.0], rot: [0, -2, 0] }, lHand: { pos: [0.21, 0.98, 0.16], pole: [0.6, -0.6, -0.4] }, look: [0, -2, 0] }, ease: 'in' },
        { t: 0.27, spec: CAST_LOW, ease: 'out' },
      ], t) : blend(CAST_LOW, WAIT0, ease.inOut((t - 0.27) / 0.18)) },
    { name: 'rod_reel', duration: 2.0, pose: (t) => reelPose(t / 0.5) },
    { name: 'rod_lean_left', duration: 1.0, pose: () => reelPose(0, { spine: [-6, 14, -13], hips: { pos: [0.045, -0.03, -0.02], rot: [0, 4, 0] }, rHand: { ...R_REEL, rod: [0.45, 0.80, 0.40] } }) },
    { name: 'rod_lean_right', duration: 1.0, pose: () => reelPose(0, { spine: [-6, -14, 13], hips: { pos: [-0.045, -0.03, -0.02], rot: [0, -4, 0] }, rHand: { ...R_REEL, rod: [-0.45, 0.80, 0.40] } }) },
    { name: 'show_catch', duration: 1.2, pose: (t) => t < 0.30 ? blend(WAIT0, CATCH_DIP, ease.inOut(t / 0.30)) : keys([
        { t: 0.30, spec: CATCH_DIP },
        { t: 0.68, spec: { ...body0, ...cup(1.085, 0.21), spine: [-8, 0, 0], hips: { pos: [0, 0.008, -0.012], rot: [0, 0, 0] }, look: [-9, 0, 0] }, ease: 'inOut' },
        { t: 1.00, spec: CATCH_HOLD, ease: 'inOut' },
        { t: 1.20, spec: CATCH_HOLD },
      ], t) },
    { name: 'rod_walk', duration: c.existing.get('walk').duration, pose: carry('walk', [-0.08, 0.95, 0.30], [-0.215, 0.91, 0.15]) },
    { name: 'rod_run', duration: c.existing.get('run').duration, pose: carry('run', [-0.08, 0.90, 0.42], [-0.215, 0.93, 0.15]) },
    { name: 'boat_sit', duration: 4.0, pose: boatSit },
  ];
  const sockets = [{ name: 'CatchSocket', joint: 'RightHand', spec: CATCH_HOLD, rot: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
    origin: (pose) => { const a = c.palmCentre(pose, 'Right'), b = c.palmCentre(pose, 'Left'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.07, (a[2] + b[2]) / 2 + 0.01]; } }];
  return { clips, sockets };
}
