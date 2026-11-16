// calloway-clips.mjs : Dr. Calloway's own idle and talk, for author-anim.mjs.
// The body's sway is the library idle (carried over as `base_idle` by borrow-clips.mjs while the clips are baked, and
// dropped afterwards); her arms, her head and the way she leans are authored here.
//   idle  two rounds of the sway: she looks about the Fen, then pushes her spectacles up her nose with her left hand
//   talk  one round: both hands come up and show how long the thing was, twice, the second time longer
//   wave  played once when somebody walks up: her right hand goes up beside her hat and waves, four quick strokes
export default (c) => {
  const D = c.existing.get('base_idle').duration, TAU = 2 * Math.PI;
  const sm = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const win = (u, a, b, c0, d) => sm((u - a) / (b - a)) * (1 - sm((u - c0) / (d - c0)));       // 0, up between a and b, 1 until c0, down by d
  const base = (t) => ({ base: { clip: 'base_idle', t } });

  // ---- idle
  const SPECS = (push) => ({ pos: [0.150, 1.318 + 0.022 * push, 0.168], fingers: [-0.30, 0.92, -0.05], palm: [-0.45, -0.1, -0.9], pole: [0.75, -0.6, 0.1], twistShare: 0.6 });
  const idle = (t) => {
    const u = t / (2 * D), up = win(u, 0.56, 0.66, 0.76, 0.88), push = win(u, 0.66, 0.70, 0.74, 0.80);
    const look = (1 - up) * (16 * Math.sin(TAU * u) * win(u, 0.02, 0.10, 0.44, 0.54) + 5 * Math.sin(TAU * 2 * u)), tip = 3 * Math.sin(TAU * 2 * u + 1);
    const A = { ...base(t), head: [-2 + 7 * up - 4 * push, look, tip * (1 - up)], spine: [0, 0.35 * look, 0] };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: SPECS(push), lShoulder: [0, 0, 6] }, up);
  };

  // ---- talk: "it was this long"
  const SHOW = (side, half, lift, beat) => { const s = side === 'Left' ? 1 : -1; return { pos: [s * half, 0.985 + lift + beat, 0.235], fingers: [s * 0.08, 0.30, 0.95], palm: [-s, 0.1, 0.1], pole: [s * 0.75, -0.65, -0.15], twistShare: 0.6 }; };
  const talk = (t) => {
    const u = t / D, up = win(u, 0.04, 0.16, 0.80, 0.94);
    const wide = 0.085 + 0.075 * win(u, 0.16, 0.26, 0.40, 0.48) + 0.150 * win(u, 0.50, 0.62, 0.76, 0.86);            // a hand's breadth, a little fish, a big one
    const beat = 0.012 * Math.sin(TAU * 6 * u) * up, lift = 0.03 * win(u, 0.50, 0.62, 0.76, 0.86);
    const nod = 4 * Math.sin(TAU * 3 * u) * up, lean = 4 * up + 2 * win(u, 0.50, 0.62, 0.76, 0.86);
    const A = { ...base(t), head: [nod - 3 * up, 6 * Math.sin(TAU * u), 3 * Math.sin(TAU * 2 * u)], spine: [lean, 3 * Math.sin(TAU * u), 0], hips: { pos: [0, -0.003 + 0.003 * Math.sin(TAU * 3 * u) * up, 0] } };
    return up < 1e-3 ? A : c.blend(A, { ...A, lHand: SHOW('Left', wide, lift, beat), rHand: SHOW('Right', wide, lift, -beat * 0.6) }, up);
  };

  // ---- wave
  const WAVE = 2.8, rot = (a) => [Math.sin(a), Math.cos(a), 0];
  const HI = (sw, up) => ({ pos: [-0.385 - 0.04 * sw, 1.36 + 0.02 * up, 0.14], fingers: [...rot(-0.15 - 0.5 * sw).slice(0, 2), 0.10], palm: [0.12, 0, 1], pole: [-0.8, -0.55, -0.25], twistShare: 0.6 });
  const wave = (t) => {
    const u = t / WAVE, up = win(u, 0.03, 0.24, 0.72, 0.95), sw = Math.sin(TAU * 4 * (u - 0.24) / 0.48) * win(u, 0.22, 0.30, 0.66, 0.74);
    const A = { ...base(t), head: [-4 * up, 0, -6 * up + 2 * sw], spine: [-2 * up, -4 * up, -3 * up], hips: { pos: [0, 0.004 * up, 0] } };
    return up < 1e-3 ? A : c.blend(A, { ...A, rHand: HI(sw, up), rShoulder: [0, 0, -8] }, up);
  };
  return { rodSocket: false, clips: [{ name: 'idle', duration: 2 * D, pose: idle }, { name: 'talk', duration: D, pose: talk }, { name: 'wave', duration: WAVE, pose: wave }], sockets: [] };
};
