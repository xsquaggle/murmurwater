// build-hollis.mjs : Mister Hollis, the gentleman made of fog who waits on the old sea-road, built in code (no generation job).
// Usage: node build-hollis.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg] [--only head,body,limbs,things] [--norig]
// He stands in the rest pose of his own skeleton (hollis-rig.json: the biped's 24 joints, stretched by make-hollis-rig.mjs,
// two for each mitten and one each for his bag and his watch). Front toward +Z (his left is +X), metres, 2.0 m to the top of his sou'wester.
// Three materials: `main` (the atlas), `Fog` (where a face would be) and `Glass` (the two lights in it).
import fs from 'node:fs';
import { Model, pack, emit, cli, rect, add, sub, mul, norm, cross, dot, len, rng, within, move, rotX, rotY, rotZ, scale, compose } from './kit.mjs';
import { frame, ring, loft, limb, lump, ladder, chain, rigid, mixW, ribbon, slab, outward } from './figure.mjs';
import { aim, curve, triToward, quadToward } from './fish.mjs';

const argv = process.argv.slice(2); const oi = argv.indexOf('--only'); const ONLY = oi < 0 ? null : argv.splice(oi, 2)[1].split(',');
const ni = argv.indexOf('--norig'); const NORIG = ni >= 0; if (NORIG) argv.splice(ni, 1);
const want = (k) => !ONLY || ONLY.includes(k);
const args = cli(argv);
const RIG = JSON.parse(fs.readFileSync(new URL('./hollis-rig.json', import.meta.url)));
const J = Object.fromEntries(RIG.joints.map((j) => [j.name, j.at]));
const D = Math.PI / 180, ATLAS = [2048, 2048], NO = rect(0, 0, 1, 1);
const s01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return +(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).toFixed(4); });

// ---- colours (the painter reads them from the layout)
const C = { oil: '#5F8A80', hat: '#587F77', lining: '#8B84A6', fog: '#C3BBD8', light: '#FFD9A0', coral: '#D4685F', cream: '#F2E3C6', wool: '#D9CBA8', boot: '#37323D', sole: '#232027',
  brass: '#C9A24A', leather: '#8A6A4F', trousers: '#403B4B', carpet: '#7A3B34' };

// =====================================================================================================================
// the head: fog, two lights, a sou'wester
const HC = [0, 1.762, 0.0], HR = [0.150, 0.166, 0.150];
/** A point of the fog: lat (-90 under .. 90 crown) and lon (0 front, 90 his left) in degrees; k = how far out. */
const puff = (lat, lon) => { const face = Math.exp(-((lon / 55) ** 2)) * Math.exp(-(((lat + 5) / 45) ** 2));                     // smooth where the lights are, in soft lobes everywhere else
  return 1 + 0.055 * (1 - face) * (Math.cos(4 * lon * D + 0.6) * Math.cos(1.6 * lat * D) + 0.6 * Math.sin(3 * lat * D + 1.0 + 2 * lon * D)); };
const headPt = (lat, lon, k = 1) => { const sl = Math.sin(lat * D), cl = Math.cos(lat * D) ** (lat > 0 ? 0.6 : 1),          // fuller above, to fill his hat
  jaw = sl < 0 ? 1 - 0.08 * (-sl) ** 1.5 : 1, q = k * puff(lat, lon); return add(HC, mul([HR[0] * cl * Math.sin(lon * D) * jaw, HR[1] * sl, HR[2] * cl * Math.cos(lon * D)], q)); };
const HAT = { o: [0, 1.831, -0.006], tilt: 9, r: 0.157 }, HN = [0, Math.cos(HAT.tilt * D), -Math.sin(HAT.tilt * D)], hatXf = aim(HAT.o, HN, [0, 0, 1]);
const CROWN = [[HAT.r, 0.0], [0.160, 0.030], [0.153, 0.074], [0.128, 0.122], [0.078, 0.158], [0, 0.172]];

const head = (m, R) => {
  const fog = m.part('fog', { material: 'Fog', crease: 80, bind: 'Head' }), N = 18, lats = [-80, -64, -48, -32, -16, 0, 16, 32, 48, 64, 80];
  loft(fog, lats.map((la) => Array.from({ length: N }, (_, j) => headPt(la, -180 + 360 * j / N))), NO, { cap: [headPt(-90, 0), headPt(90, 0)] });
  for (const s of [-1, 1]) { const o = headPt(-34, s * 62, 0.80), q = (dx, dy, dz) => add(o, [s * dx, dy, dz]);                                  // side whiskers of fog, curling up at their ends
    limb(fog, [{ c: o, rx: 0.034 }, { c: q(0.034, -0.018, 0.010), rx: 0.034 }, { c: q(0.066, -0.026, 0.015), rx: 0.030 }, { c: q(0.094, -0.022, 0.017), rx: 0.024 }, { c: q(0.116, -0.008, 0.016), rx: 0.017 }, { c: q(0.130, 0.012, 0.013), rx: 0.011 }, { c: q(0.137, 0.032, 0.010), rx: 0.006 }], 8, NO, { cap: [true, q(0.139, 0.046, 0.008)] }); }
  const li = m.part('lights', { material: 'Glass', crease: 80, bind: 'Head' });
  for (const s of [-1, 1]) lump(li, headPt(-9, s * 23, 0.985), [0.0195, 0.0255, 0.012], NO, { lat: 5, lon: 8, lump: 0, xf: rotY(s * 23 * D) });

  const hat = m.part('hat', { crease: 50, bind: 'Head' }), under = m.part('hatunder', { crease: 50, bind: 'Head' });
  within(hat, hatXf, (p) => {
    p.lathe(CROWN, 18, R.crown);
    p.lathe([[0.018, 0.166], [0.022, 0.176], [0.013, 0.185], [0, 0.186]], 7, R.hatButton);
  });
  // the brim: short and turned up in front, long and sloping behind, to shed the rain down his back
  const NB = 22, ext = (a) => { const t = (1 - Math.cos(a)) / 2; return 0.052 + 0.150 * t ** 1.9 + 0.006 * Math.sin(a) ** 2; }, dy = (a) => { const t = (1 - Math.cos(a)) / 2; return 0.046 * (1 - s01((t - 0.03) / 0.33)) - 0.014 * Math.sin(a) ** 2 - 0.105 * s01((t - 0.42) / 0.58); };
  const bp = (j, k, down) => { const a = 2 * Math.PI * j / NB, r0 = HAT.r - 0.002 + ext(a) * k; return hatXf([r0 * Math.sin(a), 0.003 + dy(a) * (k < 1 ? 0.30 * k / 0.5 : 1) - down, r0 * Math.cos(a)]); };
  const row = (k, down) => Array.from({ length: NB }, (_, j) => bp(j, k, down));
  const orient = (part, from, dirOf) => { for (let i = from; i < part.tris.length; i++) { const t = part.tris[i], n = cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p)), mid = mul(add(add(t[0].p, t[1].p), t[2].p), 1 / 3); if (dot(n, dirOf(mid)) < 0) part.tris[i] = [t[0], t[2], t[1]]; } };
  const radial = (p) => { const d = sub(p, HAT.o); return sub(d, mul(HN, dot(d, HN))); };
  let t0 = hat.tris.length; loft(hat, [row(0, 0), row(0.5, 0), row(1, 0)], R.brim, { v: [0, 0.5, 0.94] }); orient(hat, t0, () => HN);
  t0 = hat.tris.length; loft(hat, [row(1, 0), row(1.025, 0.004), row(1, 0.008)], R.brim, { v: [0.94, 0.97, 1] }); orient(hat, t0, radial);
  loft(under, [row(1, 0.008), row(0.5, 0.008), row(0, 0.008)], R.brimUnder, {}); orient(under, 0, () => mul(HN, -1));
  t0 = under.tris.length; within(under, hatXf, (p) => p.lathe([[0.075, 0.150], [0.122, 0.114], [0.147, 0.068], [0.152, 0.010], [0.155, -0.005]], 14, R.hatInside));       // the inside of the crown, for a day when the fog is thin
  orient(under, t0, (p) => mul(radial(p), -1));
};

// =====================================================================================================================
// the trunk: the oilskin's section at every height, and things that lie on it
// [height, half width, front, back, middle z]
const TORSO = curve([[0.44, 0.206, 0.170, 0.174, 0.008], [0.585, 0.196, 0.166, 0.168, 0.012], [0.80, 0.182, 0.152, 0.158, 0.0], [1.00, 0.171, 0.141, 0.150, -0.012], [1.09, 0.161, 0.131, 0.141, -0.016], [1.20, 0.158, 0.128, 0.133, -0.020],
  [1.30, 0.165, 0.131, 0.130, -0.022], [1.37, 0.167, 0.129, 0.128, -0.024], [1.412, 0.150, 0.114, 0.118, -0.026], [1.445, 0.108, 0.086, 0.094, -0.026], [1.475, 0.078, 0.070, 0.074, -0.026]]);
const TY = [0.44, 1.475], TE = 2 / 2.6;
/** A point of the coat at a height and an angle (0 = front, 90 = his left), pushed `off` outward in its level section. */
const torsoAt = (y, deg, off = 0) => {
  const [rx, rf, rb, cz] = TORSO(Math.min(TY[1], Math.max(TY[0], y))), a = deg * D, sn = Math.sin(a), cn = Math.cos(a), rz = cn >= 0 ? rf : rb;
  const nx = Math.sign(sn) * Math.abs(sn) ** (2 - TE) / rx, nz = Math.sign(cn) * Math.abs(cn) ** (2 - TE) / rz, nl = Math.hypot(nx, nz) || 1;
  return [rx * Math.sign(sn) * Math.abs(sn) ** TE + off * nx / nl, y, cz + rz * Math.sign(cn) * Math.abs(cn) ** TE + off * nz / nl];
};
/** The same with the way the cloth really faces there: { p, n }, p pushed `off` along n. */
const onTorso = (y, deg, off = 0) => {
  const y0 = Math.max(TY[0], y - 0.006), y1 = Math.min(TY[1], y + 0.006), n = norm(cross(sub(torsoAt(y, deg + 1.5), torsoAt(y, deg - 1.5)), sub(torsoAt(y1, deg), torsoAt(y0, deg))));
  return { p: add(torsoAt(y, deg), mul(n, off)), n };
};
const torsoRing = (y, N, off = 0) => Array.from({ length: N }, (_, j) => torsoAt(y, -180 + 360 * j / N, off));
/** Surface coordinates about a place on the coat: x metres to the right (seen from outside), y up, z out. */
const surf = (deg0, y0) => { const per = len(sub(torsoAt(y0, deg0 + 0.5), torsoAt(y0, deg0 - 0.5))); return (x, y, z) => onTorso(y0 + y, deg0 + x / per, z).p; };
/** The angle at which the front (or, with back, the back) of the coat has a given x at a height. */
const degOfX = (x, y, back = false) => { const rx = TORSO(y)[0], a = Math.asin(Math.sign(x) * Math.min(1, (Math.abs(x) / rx) ** (1 / TE))) / D; return back ? 180 - a : a; };

const spine = ladder([[1.14, 'Hips'], [1.243, 'Spine02'], [1.347, 'Spine01'], [1.435, 'Spine'], [1.535, 'neck'], [1.61, 'Head']]);
/** The bind of the trunk: the spine by height, the shoulder girdle toward each arm, and the long skirt to the thighs and, below the knee, the shins. */
const torsoBind = (p) => {
  let w = spine(p); const sd = p[0] > 0 ? 'Left' : 'Right';
  const sh = s01((Math.abs(p[0]) - 0.04) / 0.08) * s01((p[1] - 1.30) / 0.09); if (sh > 0) w = mixW(w, [[sd + 'Shoulder', 1]], 0.7 * sh);
  const sk = 0.92 * s01((1.07 - p[1]) / 0.24);
  if (sk > 0) { const t = s01(p[0] / 0.13 + 0.5), kn = s01((0.66 - p[1]) / 0.15); w = mixW(w, [['LeftUpLeg', t * (1 - kn)], ['RightUpLeg', (1 - t) * (1 - kn)], ['LeftLeg', t * kn], ['RightLeg', (1 - t) * kn]], sk); }
  return w;
};
const NT = 20, YS = [0.44, 0.475, 0.52, 0.565, 0.62, 0.68, 0.76, 0.84, 0.92, 1.00, 1.06, 1.12, 1.20, 1.27, 1.33, 1.375, 1.412, 1.432, 1.452, 1.465, 1.475];
const coatV = (() => { let L = 0; const a = [0]; for (let i = 1; i < YS.length; i++) { L += (len(sub(torsoAt(YS[i], 90), torsoAt(YS[i - 1], 90))) + len(sub(torsoAt(YS[i], 0), torsoAt(YS[i - 1], 0)))) / 2; a.push(L); } return a.map((x) => x / L); })();
const vOfY = (y) => { let i = 0; while (i + 2 < YS.length && y > YS[i + 1]) i++; return coatV[i] + (coatV[i + 1] - coatV[i]) * (y - YS[i]) / (YS[i + 1] - YS[i]); };
const BUTTONS = [1.395, 1.295, 1.195, 1.095, 0.985, 0.875, 0.765], FLY = 4.5;                       // heights of the buttons; the angle of the row, a little to his left of the middle
const uOfDeg = (deg) => 0.5 + deg / 360;

const button = (part, r, o, rad0 = 0.0165) => within(part, aim(o.p, o.n), (q) => q.lathe([[rad0, -0.002], [rad0, 0.0045], [rad0 * 0.66, 0.0078], [0, 0.0078]], 8, r));

const body = (m, R) => {
  // the oilskin
  const coat = m.part('coat', { crease: 60, bind: torsoBind });
  loft(coat, YS.map((y) => torsoRing(y, NT)), R.coat, { v: coatV });
  const inside = m.part('inside', { crease: 30, bind: torsoBind });
  loft(inside, [torsoRing(0.44, NT), torsoRing(0.446, NT, -0.012), torsoRing(0.535, NT, -0.022)], R.lining, { flip: true });
  loft(inside, [torsoRing(0.535, NT, -0.022)], R.liningDark, { cap: [[0, 0.535, 0.0], false] });
  loft(inside, [torsoRing(1.475, NT)], R.liningDark, { cap: [false, [0, 1.48, -0.026]] });
  // the collar, standing up round his muffler
  const col = m.part('collar', { crease: 55, bind: torsoBind }), NC = 16, cr = (r0, y, k = 1) => Array.from({ length: NC }, (_, j) => { const a = 2 * Math.PI * j / NC - Math.PI / 2; return [-r0 * Math.cos(a), y + 0.012 * k * Math.cos(a - Math.PI / 2) ** 2 * (Math.sin(a) < 0 ? 1 : -0.4), -0.024 + 0.96 * r0 * Math.sin(a)]; });
  loft(col, [cr(0.088, 1.447, 0), cr(0.100, 1.468, 0.3), cr(0.108, 1.505), cr(0.110, 1.528), cr(0.101, 1.530), cr(0.090, 1.49, 0.3)], R.collar, { v: [0, 0.2, 0.62, 0.8, 0.86, 1] });
  // buttons down the front, a pocket on either side of the skirt, a half belt behind
  const bits = m.part('bits', { crease: 40, bind: torsoBind });
  for (const y of BUTTONS) button(bits, R.button, onTorso(y, FLY, 0));
  const pk = m.part('pockets', { crease: 40, bind: torsoBind });
  for (const s of [-1, 1]) { const S = surf(s * 47, 0.905), w = 0.118, h = 0.125;
    slab(pk, S, [-w / 2, w / 2], [-h / 2, h / 2], [-0.004, 0.012], { front: R.pocket, edge: R.pedge }, { cols: 3, inset: 0.004 });
    slab(pk, S, [-w / 2 - 0.006, w / 2 + 0.006], [h / 2 - 0.048, h / 2 + 0.008], [0.009, 0.019], { front: R.flap, edge: R.pedge }, { cols: 3, inset: 0.002 }); }
  { const S = surf(180, 1.105); slab(pk, S, [-0.085, 0.085], [-0.021, 0.021], [-0.003, 0.008], { front: R.halfbelt, edge: R.pedge }, { cols: 4, inset: 0.002 });
    for (const s of [-1, 1]) { const o = onTorso(1.105, 180 + s * 0.064 / len(sub(torsoAt(1.105, 180.5), torsoAt(1.105, 179.5))), 0.008); button(bits, R.button, o, 0.012); } }

  // the muffler: twice round, one end down his front, the other thrown over his right shoulder
  const neckBind = ladder([[1.47, 'Spine'], [1.53, 'neck'], [1.60, 'neck'], [1.66, 'Head']]);
  const sc = m.part('muffler', { crease: 70, bind: neckBind });
  sc.torus(0.090, 0.043, 16, 7, R.coilA, { wobble: (i) => 0.007 * Math.sin(2 * Math.PI * i / 16 * 2 + 0.8), xf: compose(move([0, 1.512, -0.022]), rotX(7 * D), scale([1, 1, 0.95])) });
  sc.torus(0.081, 0.040, 16, 7, R.coilB, { wobble: (i) => 0.006 * Math.sin(2 * Math.PI * i / 16 * 3 + 2.0), xf: compose(move([0.004, 1.577, -0.016]), rotZ(4 * D), rotX(-5 * D)) });
  const tails = m.part('tails', { crease: 50, bind: torsoBind });
  const tail = (r, pts, w, flip) => { ribbon(tails, pts, w, r, { thick: 0.007, v: pts.map((_, i) => 1 - i / (pts.length - 1)) });
    const a = pts[pts.length - 2], b = pts[pts.length - 1], down = norm(sub(b.p, a.p)), side = norm(cross(down, b.n));                    // a fringe along its end
    for (let i = 0; i < 6; i++) { const u0 = (i + 0.12) / 6, u1 = (i + 0.88) / 6, P = (u, d) => add(add(b.p, mul(side, (u - 0.5) * w)), mul(down, d));
      quadToward(tails, [P(u0, 0), R.fringe.at(u0, 1)], [P(u1, 0), R.fringe.at(u1, 1)], [P(u1 - 0.02, 0.034), R.fringe.at(u1, 0)], [P(u0 + 0.02, 0.034), R.fringe.at(u0, 0)], b.n); } };
  { const pts = []; for (let i = 0; i <= 9; i++) { const t = i / 9, y = 1.478 - 0.338 * t, x = 0.040 + 0.026 * t + 0.006 * Math.sin(5 * t), o = onTorso(Math.min(y, 1.452), degOfX(x, Math.min(y, 1.452)), 0.011); pts.push({ p: [o.p[0], y > 1.452 ? y : o.p[1], o.p[2] + Math.max(0, y - 1.452) * 0.25], n: o.n, w: 0.094 * (0.5 + 0.5 * s01(t / 0.25)) }); } tail(R.tailF, pts, 0.094); }
  { const pts = []; for (let i = 0; i <= 7; i++) { const t = i / 7, y = 1.478 - 0.248 * t, x = -0.062 - 0.012 * t, yy = Math.min(y, 1.45), o = onTorso(yy, degOfX(x, yy, true), 0.011); pts.push({ p: [o.p[0], y > 1.45 ? y : o.p[1], o.p[2] - Math.max(0, y - 1.45) * 0.25], n: o.n, w: 0.088 * (0.5 + 0.5 * s01(t / 0.3)) }); } tail(R.tailB, pts, 0.088); }
};

// =====================================================================================================================
// arms and legs
const SIDE = (s) => (s > 0 ? 'Left' : 'Right');
const arm = (m, R, s) => {
  const sd = SIDE(s), S = J[sd + 'Arm'], E = J[sd + 'ForeArm'], Wr = J[sd + 'Hand'], du = norm(sub(E, S)), dl = norm(sub(Wr, E)), LL = len(sub(Wr, E));
  const bind = chain(torsoBind, [[sd + 'Arm', S], [sd + 'ForeArm', E], [sd + 'Hand', Wr]], [0.07, 0.07, 0.04]), U = (t) => add(S, mul(du, t)), Lw = (t) => add(E, mul(dl, t));
  const sl = m.part('sleeve' + sd, { crease: 60, bind });
  limb(sl, [{ c: add(U(-0.038), [0, -0.016, 0]), rx: 0.030 }, { c: add(U(-0.018), [0, -0.009, 0]), rx: 0.050 }, { c: add(U(0.010), [0, -0.002, 0]), rx: 0.060 }, { c: U(0.09), rx: 0.061 }, { c: U(0.18), rx: 0.057 }, { c: E, rx: 0.056 }, { c: Lw(0.09), rx: 0.053 }, { c: Lw(LL - 0.075), rx: 0.054 }], 10, R.sleeve, { cap: [true, false] });
  const cf = m.part('cuff' + sd, { crease: 60, bind });                                              // the cuff: a wide band, buttoned over, and the dark inside of the sleeve behind the mitten
  limb(cf, [{ c: Lw(LL - 0.082), rx: 0.052, along: dl }, { c: Lw(LL - 0.078), rx: 0.062, along: dl }, { c: Lw(LL - 0.024), rx: 0.064, along: dl }, { c: Lw(LL - 0.018), rx: 0.060, along: dl }], 10, R.cuff);
  limb(cf, [{ c: Lw(LL - 0.018), rx: 0.060, along: dl }, { c: Lw(LL - 0.030), rx: 0.046, along: dl }], 10, R.liningDark);
  // the mitten: a ribbed wrist that goes up the sleeve, a flat hand, its thumb forward
  const F = norm(add([0, 0, 1], mul(dl, -dl[2]))), X = cross(F, dl), Hd = (t, f = 0, x = 0) => add(add(add(Wr, mul(dl, t)), mul(F, f)), mul(X, x));
  const hd = m.part('mitten' + sd, { crease: 70, bind }), fg = m.part('fingers' + sd, { crease: 70, bind: chain(bind, [[sd + 'Fingers', J[sd + 'Fingers']], [sd + 'FingerTips', J[sd + 'FingerTips']]], [0.024, 0.022]) });      // the four fingers close as one
  limb(hd, [{ c: Lw(LL - 0.050), rx: 0.040, along: dl }, { c: Lw(LL - 0.016), rx: 0.041, along: dl }, { c: Hd(-0.002), rx: 0.039, rz: 0.042, along: dl, front: F }], 10, R.wrist);
  limb(fg, [{ c: Hd(-0.004), rx: 0.034, rz: 0.042, along: dl, front: F }, { c: Hd(0.028, 0.002), rx: 0.036, rz: 0.054, along: dl, front: F }, { c: Hd(0.056, 0.003), rx: 0.036, rz: 0.059, along: dl, front: F }, { c: Hd(0.074, 0.003), rx: 0.035, rz: 0.060, along: dl, front: F }, { c: Hd(0.090, 0.002), rx: 0.033, rz: 0.058, along: dl, front: F }, { c: Hd(0.106, 0.002, s * -0.005), rx: 0.030, rz: 0.054, along: dl, front: F },
    { c: Hd(0.127, 0.0, s * -0.011), rx: 0.021, rz: 0.040, along: dl, front: F }], 10, R.mitten, { pow: 2.5, cap: [false, Hd(0.139, 0.0, s * -0.014)] });
  const td = norm(add(mul(dl, 0.62), mul(F, 0.78))), T0 = Hd(0.028, 0.040, s * -0.004);
  limb(hd, [{ c: T0, rx: 0.021 }, { c: add(T0, mul(td, 0.030)), rx: 0.0205 }, { c: add(T0, mul(td, 0.054)), rx: 0.017 }], 6, R.thumb, { cap: [true, add(T0, mul(td, 0.066))] });
};
const leg = (m, R, s) => {
  const sd = SIDE(s), H = J[sd + 'UpLeg'], K = J[sd + 'Leg'], A = J[sd + 'Foot'], T = J[sd + 'ToeBase'];
  const bind = chain('Hips', [[sd + 'UpLeg', H], [sd + 'Leg', K], [sd + 'Foot', A], [sd + 'ToeBase', T]], [0.10, 0.08, 0.05, 0.04]);
  const zs = (y) => H[2] + (A[2] - H[2]) * (H[1] - y) / (H[1] - A[1]), kz = zs(K[1]) + 0.45 * (K[2] - zs(K[1]));                    // his knee, not as far forward as the joint
  const path = curve([[0.14, A[0], A[2] + 0.004], [K[1], K[0], kz], [0.99, H[0], H[2] + 0.004]]), P = (y) => { const [x, z] = path(y); return [x, y, z]; };
  const tr = m.part('trousers' + sd, { crease: 60, bind });
  limb(tr, [{ c: P(0.985), rx: 0.074 }, { c: P(0.86), rx: 0.076 }, { c: P(0.74), rx: 0.071 }, { c: P(0.69), rx: 0.066 }], 8, R.trousers, { cap: [true, false] });
  const bt = m.part('boot' + sd, { crease: 55, bind });
  limb(bt, [{ c: P(0.640), rx: 0.068 }, { c: P(0.648), rx: 0.078 }, { c: P(0.700), rx: 0.080 }, { c: P(0.708), rx: 0.074 }, { c: P(0.690), rx: 0.060 }].map((q) => ({ ...q, along: [0, 1, 0] })), 10, R.bootTop);      // the top of a sea boot, standing off the leg
  limb(bt, [{ c: [A[0], 0.045, A[2] + 0.002], rx: 0.057 }, { c: P(0.17), rx: 0.053 }, { c: P(0.30), rx: 0.055 }, { c: P(0.44), rx: 0.060 }, { c: P(0.585), rx: 0.066 }, { c: P(0.655), rx: 0.070 }].map((q) => ({ ...q, along: [0, 1, 0] })), 10, R.shaft, { v: [-0.1, 0.12, 0.36, 0.6, 0.86, 1] });
  // the foot: long and narrow, heel to toe along the way the foot points
  const fd = norm([T[0] - A[0], 0, T[2] - A[2]]), A0 = [A[0], 0, A[2]], Ft = (t, y) => add(add(A0, mul(fd, t * 1.19)), [0, y, 0]), up = [0, 1, 0];
  limb(bt, [[-0.080, 0.058, 0.038, 0.048, 0.038], [-0.060, 0.058, 0.055, 0.074, 0.042], [0.0, 0.056, 0.064, 0.082, 0.042], [0.064, 0.054, 0.068, 0.066, 0.042], [0.122, 0.052, 0.072, 0.056, 0.042], [0.172, 0.050, 0.065, 0.049, 0.040], [0.203, 0.047, 0.046, 0.037, 0.035]]
    .map(([t, y, rx, ru, rd]) => ({ c: Ft(t, y), rx, rz: [ru, rd], along: fd, front: up })), 10, R.foot, { pow: 2.3, cap: [Ft(-0.089, 0.058), Ft(0.216, 0.045)] });
  limb(bt, [[-0.091, 0.042], [-0.066, 0.058], [0.0, 0.068], [0.064, 0.074], [0.122, 0.078], [0.174, 0.071], [0.216, 0.047]].map(([t, rx]) => ({ c: Ft(t, 0.0175), rx, rz: [0.0085, 0.0175], along: fd, front: up, pow: 3.2 })), 10, R.sole, { cap: [Ft(-0.098, 0.012), Ft(0.227, 0.012)] });
};

// =====================================================================================================================
// the things he carries, each on a joint of its own
const things = (m, R) => {
  // the carpet bag: its long way fore and aft, hanging from the middle of its two handles (the joint `Bag`)
  const G = J.Bag, bag = m.part('bag', { crease: 50, bind: 'Bag' }), fr = frame([0, 1, 0], [0, 0, 1]), at = (dy) => add(G, [0, dy, 0]);
  const st = [[-0.345, 0.076, 0.193], [-0.333, 0.088, 0.205], [-0.250, 0.092, 0.210], [-0.170, 0.086, 0.206], [-0.122, 0.062, 0.199], [-0.096, 0.032, 0.193], [-0.086, 0.015, 0.189]];
  // the carpet goes round by the distance along the bag's side, so that its roses are as wide on the long sides as on the ends
  const wide = ring(at(-0.250), fr, 0.092, 0.210, 14, { pow: 5 }), arc = [0], vs = [0, 0.06, 0.345, 0.62, 0.80, 0.93, 1];
  for (let j = 0; j < 14; j++) arc.push(arc[j] + Math.hypot(...sub(wide[(j + 1) % 14], wide[j])));
  loft(bag, st.map(([dy, rx, rz]) => ring(at(dy), fr, rx, rz, 14, { pow: 5 })), R.bag, { cap: [at(-0.347), at(-0.084)], uv: (i, j) => R.bag.at(j < 0 ? 0.5 : arc[j] / arc[14], vs[i]) });
  loft(bag, [[-0.349, 0.079, 0.196], [-0.337, 0.092, 0.209], [-0.296, 0.0955, 0.2135], [-0.290, 0.092, 0.210]].map(([dy, rx, rz]) => ring(at(dy), fr, rx, rz, 14, { pow: 5 })), R.bagBase, { cap: [at(-0.351), false] });      // a leather foot all round
  const brass = m.part('bagbrass', { crease: 40, bind: 'Bag' }), allR = (r) => ({ px: r, nx: r, py: r, ny: r, pz: r, nz: r });
  brass.box(at(-0.082), [0.011, 0.008, 0.192], allR(R.brass)); brass.box(at(-0.086), [0.019, 0.016, 0.020], allR(R.brass));                            // the frame it shuts with, and its catch
  for (const sx of [-1, 1]) bag.tube([[-0.078, -0.084], [-0.070, -0.040], [-0.040, -0.006], [0, 0.003], [0.040, -0.006], [0.070, -0.040], [0.078, -0.084]].map(([z, y]) => add(G, [sx * (0.015 - 0.009 * Math.max(0, 1 - Math.abs(z) / 0.05)), y, z])), 0.0085, 5, R.handle, { open: true });
  // a luggage label on a string
  const lb = add(G, [0.030, -0.150, 0.082]); bag.tube([add(G, [0.014, -0.070, 0.072]), add(lb, [0, 0.022, 0])], 0.0025, 3, R.string, { open: true });
  within(bag, compose(move(lb), rotZ(-10 * D), rotX(8 * D)), (q) => q.box([0, -0.012, 0], [0.003, 0.034, 0.024], { px: R.label, nx: R.labelBack, py: R.labelBack, ny: R.labelBack, pz: R.labelBack, nz: R.labelBack }));
  // the pocket watch: at rest it lies in his breast under the oilskin (the joint `Watch`); its face looks forward
  const W = J.Watch, wt = m.part('watch', { crease: 45, bind: 'Watch' });
  within(wt, aim(W, [0, 0, 1], [0, 1, 0]), (q) => { q.lathe([[0, -0.0065], [0.0255, -0.0065], [0.0290, -0.002], [0.0290, 0.003], [0.0262, 0.0062]], 12, R.brass); q.lathe([[0.0262, 0.0062], [0, 0.0066]], 12, R.dial, { v: [0, 1] }); });
  wt.tube([add(W, [0, 0.027, 0]), add(W, [0, 0.040, 0])], 0.0055, 5, R.brass); wt.torus(0.0095, 0.0028, 8, 4, R.brass, { xf: compose(move(add(W, [0, 0.049, 0])), rotX(90 * D)) });
};

// =====================================================================================================================
const m = new Model('hollis');
m.material('main', { kind: 'texture', roughness: 0.8 });
m.material('Fog', { kind: 'plain', color: lin(C.fog), roughness: 1 });
m.material('Glass', { kind: 'plain', color: lin('#6A4A22'), emissive: lin(C.light), roughness: 0.4 });      // dark amber under the light, so that what shows is the light's own colour
if (!NORIG) m.skeleton(RIG);
const oil = (o = {}) => ({ mat: 'oilskin', colour: C.oil, soft: 0, ...o }), hide = (o = {}) => ({ mat: 'leather', colour: C.leather, soft: 0, ...o }), flat = (colour, o = {}) => ({ mat: 'flat', colour, var: 0.08, ...o });
const stripes = (o = {}) => ({ mat: 'knit', stripes: [C.coral, C.cream], soft: 0, ...o }), wool = (o = {}) => ({ mat: 'knit', colour: C.wool, soft: 0, ...o });
const R = pack(...ATLAS, {
  // hat
  crown: [704, 224, oil({ colour: C.hat, tile_x: true, k: 1.3, creases: 0.6, seams: [0, 1, 2, 3, 4, 5].map((i) => [(i + 0.5) / 6, 0, (i + 0.5) / 6, 0.97]), ao: { bottom: 0.25 } })], hatButton: [48, 48, oil({ colour: C.hat, creases: 0 })],
  brim: [704, 176, oil({ colour: C.hat, tile_x: true, k: 1.3, creases: 0.5, seams: [[0.002, 0.10, 0.998, 0.10], [0.002, 0.86, 0.998, 0.86]], ao: { bottom: 0.3 } })],
  brimUnder: [512, 112, flat('#B5AECB', { var: 0.10, grain: 0.06, along: 'x', tile_x: true, ao: { top: 0.3 } })], hatInside: [64, 64, flat(C.lining, { light: 0.5 })],
  // coat and what is on it
  coat: [1216, 800, oil({ tile_x: true, k: 1.5, hem: 0.03, flapline: uOfDeg(FLY + 5.5), buttons: BUTTONS.map((y) => [uOfDeg(FLY), vOfY(y), 13]),
    seams: [[0.25, 0, 0.25, vOfY(1.36)], [0.75, 0, 0.75, vOfY(1.36), -1], [0.002, vOfY(0.465), 0.998, vOfY(0.465)], [0.001, 0, 0.001, vOfY(0.80)], [0.30, vOfY(1.335), 0.70, vOfY(1.335)], [0.0, vOfY(1.335), 0.20, vOfY(1.335)], [0.80, vOfY(1.335), 1.0, vOfY(1.335)]] })],
  lining: [64, 64, flat(C.lining)], liningDark: [48, 48, flat('#3B3547', { var: 0.05 })], collar: [512, 112, oil({ tile_x: true, k: 1.3, creases: 0.5, stitched: 6, sides: 't', ao: { bottom: 0.35 } })],
  button: [48, 48, { mat: 'brass', patina: 0.3, verdigris: 0.05, top: 0.5 }], brass: [128, 48, { mat: 'brass', patina: 0.15, verdigris: 0 }],
  pocket: [208, 216, oil({ stitched: 8, k: 1.4, ao: { top: 0.35 } })], flap: [224, 104, oil({ stitched: 7, k: 1.4, sides: 'blr', snap: [0.5, 0.34, 9] })], pedge: [96, 32, oil({ light: 0.82, creases: 0 })], halfbelt: [288, 72, oil({ stitched: 6, k: 1.3 })],
  // muffler
  coilA: [640, 144, stripes({ along: 'x', n: 10, wales: 8, tile_x: true, ao: { bottom: 0.3, top: 0.3 } })], coilB: [576, 128, stripes({ along: 'x', n: 8, wales: 8, tile_x: true, ao: { bottom: 0.3 } })],
  tailF: [144, 544, stripes({ along: 'y', n: 7, wales: 9 })], tailB: [144, 400, stripes({ along: 'y', n: 5, wales: 9 })], fringe: [144, 40, flat(C.cream, { var: 0.14, grain: 0.3, along: 'y', ao: { top: 0.3 } })],
  // arms and legs
  sleeve: [416, 400, oil({ tile_x: true, k: 1.3, seams: [[0.02, 0.05, 0.02, 1]], ao: { top: 0.25 } })], cuff: [416, 72, oil({ tile_x: true, k: 1.3, creases: 0.4, stitched: 6, sides: 'tb', snap: [0.5, 0.5, 9] })],
  wrist: [288, 80, wool({ wales: 16, rib: 1.2, tile_x: true })], mitten: [320, 192, wool({ wales: 20, tile_x: true })], thumb: [80, 80, wool({ wales: 6, tile_x: true })],
  trousers: [96, 96, flat(C.trousers, { var: 0.06 })],
  shaft: [416, 416, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.55, k: 1.4, ao: { top: 0.2 } }], bootTop: [416, 64, { mat: 'leather', colour: '#4A4350', soft: 0, tile_x: true, worn: 0.5 }],
  foot: [416, 288, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.7, k: 1.4, toecap: 0.74 }], sole: [320, 40, flat(C.sole, { var: 0.1 })],
  // bag and watch
  bag: [1184, 312, { mat: 'carpet', ground: C.carpet, pitch: 74, tile_x: true, soft: 0, ao: { top: 0.3 } }], bagBase: [640, 56, hide({ tile_x: true, stitch: 5, sides: 't', worn: 0.6 })], handle: [48, 256, hide({ colour: '#7A5A43', stitch: 4, sides: 'lr' })],
  string: [16, 64, flat('#B9A58C')], label: [80, 112, { mat: 'label', soft: 0 }], labelBack: [32, 32, flat('#E2D6B8')], dial: [128, 128, { mat: 'watchface', soft: 0 }],
}, 10);
if (want('head')) head(m, R);
if (want('body')) body(m, R);
if (want('limbs')) for (const s of [-1, 1]) { arm(m, R, s); leg(m, R, s); }
if (want('things')) things(m, R);
await emit(m, R, ATLAS, args, { size: 1024 });
