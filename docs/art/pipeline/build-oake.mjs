// build-oake.mjs : Captain Brannagh Oake, the retired whaler who keeps Tryworks Landing on Saltbone Reach, built in code
// (no generation job).
// Usage: node build-oake.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg] [--only head,body,limbs] [--norig]
// She stands in the rest pose of her own skeleton (oake-rig.json: the biped's 24 joints, made short and broad by
// make-oake-rig.mjs, two for each hand and one for her pipe). Front toward +Z (her left is +X), metres, one material,
// 1.50 m to the top of her cap.
import fs from 'node:fs';
import { Model, pack, emit, cli, add, sub, mul, norm, cross, dot, len, rng, within, move, rotX, rotY, rotZ, scale, compose } from './kit.mjs';
import { frame, ring, loft, limb, lump, ladder, chain, rigid, mixW, ribbon, slab, outward } from './figure.mjs';
import { aim, curve, triToward, quadToward } from './fish.mjs';

const argv = process.argv.slice(2); const oi = argv.indexOf('--only'); const ONLY = oi < 0 ? null : argv.splice(oi, 2)[1].split(',');
const ni = argv.indexOf('--norig'); const NORIG = ni >= 0; if (NORIG) argv.splice(ni, 1);
const want = (k) => !ONLY || ONLY.includes(k);
const args = cli(argv);
const RIG = JSON.parse(fs.readFileSync(new URL('./oake-rig.json', import.meta.url)));
const J = Object.fromEntries(RIG.joints.map((j) => [j.name, j.at]));
const D = Math.PI / 180, ATLAS = [2048, 2048];
const s01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---- colours (the painter reads them from the layout)
const C = { skin: '#CF9776', blush: '#C55F50', brows: '#D9D5CC', hair: '#86837E', hairLight: '#C9C4BA', cap: '#984A33', coat: '#33415F', lining: '#1C2232', trousers: '#46413E',
  boot: '#2F2925', sole: '#1E1A18', clay: '#ECE4D2', cord: '#3A2E28' };

// =====================================================================================================================
// the head: broad, heavy in the jaw, a cap pulled down over it, a plait down her back, a pipe in her mouth
const HC = [0, 1.282, 0.006], HR = [0.170, 0.160, 0.160];
/** A point of the head: lat (-90 chin .. 90 crown) and lon (0 front, 90 her left) in degrees; k = how far out (1 = the skin). */
const headPt = (lat, lon, k = 1) => {
  const cl = Math.cos(lat * D), sl = Math.sin(lat * D), cn = Math.cos(lon * D), sn = Math.sin(lon * D);
  const jaw = sl < 0 ? 1 - 0.12 * (-sl) ** 1.5 : 1 - 0.05 * sl;                                   // a heavy jaw
  const cheek = 1 + 0.075 * Math.exp(-(((lat + 30) / 24) ** 2)) * Math.abs(sn) ** 1.3;           // cheeks that have dropped a little
  return add(HC, mul([HR[0] * cl * sn * jaw * cheek, HR[1] * sl, HR[2] * cl * cn * (cn > 0 ? 0.95 : 1) * (sl < 0 ? 1 - 0.04 * -sl : 1)], k));
};
const FACE = { span: 0.42, eye: [0.062, 1.290], eyeR: [0.0128, 0.0135], mouth: [0, 1.204], brow: 1.326, cheek: [0.088, 1.238], chin: 1.13 };
const faceUv = (r) => (i, j, p) => r.at(0.5 + p[0] / FACE.span, (p[1] - (HC[1] - FACE.span / 2)) / FACE.span);

// the cap: a knitted watch cap pulled down to the brow in front and to the nape behind, its cuff turned up
const TILT = 14, HN = [0, Math.cos(TILT * D), -Math.sin(TILT * D)], HO = add(HC, [0, 0.060, 0]), capXf = aim(HO, HN, [0, 0, 1]);
const capInv = (() => { const o = capXf([0, 0, 0]), ex = sub(capXf([1, 0, 0]), o), ey = sub(capXf([0, 1, 0]), o), ez = sub(capXf([0, 0, 1]), o); return (p) => { const d = sub(p, o); return [dot(d, ex), dot(d, ey), dot(d, ez)]; }; })();
// how far the head reaches from the cap's axis at a height above its edge and an angle round it (lathe angles: 0 = her left, 90 = behind)
const NS = 24, HEADQ = (() => { const q = []; for (let la = -90; la <= 90; la += 1.5) for (let lo = -180; lo < 180; lo += 2) q.push(capInv(headPt(la, lo))); return q; })();
const CAPTOP = Math.max(...HEADQ.map((q) => q[1]));
const reachAt = (h, j) => { const a = 2 * Math.PI * j / NS, ca = Math.cos(a), sa = -Math.sin(a); let r = 0;
  for (const q of HEADQ) { if (Math.abs(q[1] - h) > 0.006) continue; const rr = Math.hypot(q[0], q[2]); if (rr < 1e-6) continue; if ((q[0] * ca + q[2] * sa) / rr > Math.cos(9 * D)) r = Math.max(r, rr); } return r; };
const CAPH = Array.from({ length: 9 }, (_, i) => i * (CAPTOP - 0.008) / 8);
const REACH = CAPH.map((h) => Array.from({ length: NS }, (_, j) => reachAt(h, j)));
for (const row of REACH) for (let j = 0; j < NS; j++) if (!row[j]) row[j] = Math.max(...row);         // a gap in the sampling takes the widest
const capR = (h, j) => { const t = Math.min(CAPH.length - 1.001, Math.max(0, h / CAPH[CAPH.length - 1] * (CAPH.length - 1))), i = Math.floor(t), f = t - i, jj = ((j % NS) + NS) % NS; return REACH[i][jj] * (1 - f) + REACH[i + 1][jj] * f; };
/** Hair that would come through the cap is pressed inside it. */
const tuck = (p) => { const q = capInv(p); if (q[1] < -0.012) return p; const r = Math.hypot(q[0], q[2]); if (r < 1e-6) return p;
  const a = Math.atan2(-q[2], q[0]), j = a / (2 * Math.PI) * NS, j0 = Math.floor(j), f = j - j0, h = Math.max(0, Math.min(q[1], CAPH[CAPH.length - 1])), rm = (capR(h, j0) * (1 - f) + capR(h, j0 + 1) * f) + 0.004;
  return r <= rm ? p : capXf([q[0] * rm / r, q[1], q[2] * rm / r]); };
const hairline = (() => { const f = curve([[0, 40], [50, 34], [64, 16], [72, -4], [80, 6], [93, 12], [106, -12], [130, -34], [180, -44]]); return (lon) => f(Math.abs(lon))[0]; })();

// her pipe: a short clay pipe, the end of its stem in the right corner of her mouth (the joint `Pipe`, which is where this
// point ends up when the head is made larger: see grow())
const HK = RIG.head.scale, PIV = RIG.head.pivot, PIPE = J.Pipe.map((v, i) => PIV[i] + (v - PIV[i]) / HK), STEM = norm([-0.30, -0.42, 0.86]), STEML = 0.075, BOWL = norm([-0.10, 1, 0.22]);

const head = (m, R) => {
  const sk = m.part('head', { crease: 70, bind: 'Head' }), N = 16, lats = [-78, -60, -42, -25, -9, 7, 23, 39, 55, 71, 84];
  const rings = lats.map((la) => Array.from({ length: N }, (_, j) => headPt(la, -180 + 360 * j / N)));
  loft(sk, rings.map((r) => r.slice(5, 12)), R.face, { closed: false, uv: faceUv(R.face) });                               // the face, painted as seen from the front
  loft(sk, rings.map((r) => [...r.slice(11), ...r.slice(0, 6)]), R.headskin, { closed: false, v: lats.map((la) => (Math.sin(la * D) - Math.sin(lats[0] * D)) / (Math.sin(lats[lats.length - 1] * D) - Math.sin(lats[0] * D))) });
  loft(sk, [rings[0]], R.headskin, { cap: [headPt(-90, 0), false] }); loft(sk, [rings[rings.length - 1]], R.headskin, { v: [1], cap: [false, headPt(90, 0)] });
  // the nose: broad and a little hooked, with a round end
  const no = headPt(-8, 0, 0.955), nd = norm([0, 0.05, 1]), nf = frame(nd, [0, 1, 0]);
  loft(sk, [ring(no, nf, 0.027, [0.022, 0.028], 8), ring(add(no, mul(nd, 0.018)), nf, 0.021, [0.018, 0.023], 8), ring(add(no, mul(nd, 0.030)), nf, 0.015, [0.014, 0.015], 8)], R.nose, { cap: [false, add(no, mul(nd, 0.036))] });
  lump(sk, add(no, [0, -0.005, 0.031]), [0.0150, 0.0135, 0.0130], R.nose, { lat: 4, lon: 7, lump: 0 });
  for (const s of [-1, 1]) lump(sk, add(headPt(-6, s * 93, 1.0), [s * 0.006, 0, 0]), [0.017, 0.040, 0.029], R.ear, { lat: 4, lon: 6, lump: 0 });
  const lobe = add(headPt(-6, 93, 1.0), [0.014, -0.036, 0.006]), er = m.part('earring', { crease: 50, bind: 'Head' });                     // a small gold ring in her left ear
  er.torus(0.0085, 0.0018, 12, 4, R.gold, { xf: compose(move(add(lobe, [0, -0.008, 0])), rotZ(90 * D), rotX(10 * D)) });
  const nk = m.part('neck', { crease: 70, bind: ladder([[1.00, 'Spine'], [1.05, 'neck'], [1.12, 'neck'], [1.16, 'Head']]) });
  limb(nk, [{ c: [0, 0.995, -0.024], rx: 0.072 }, { c: [0, 1.07, -0.020], rx: 0.070 }, { c: [0, 1.17, -0.010], rx: 0.070 }], 8, R.neck);

  // hair: grey, swept back from the temples under the cap; it only shows round the ears and at the nape
  const hr = m.part('hair', { crease: 42, bind: 'Head' }), NH = 32, rnd = rng(9), S = [0, 0.2, 0.45, 0.7, 0.9];
  const lonOf = (j) => -180 + 360 * (j % NH) / NH, thick = S.map(() => Array.from({ length: NH }, () => 0.010 * (1 + 0.2 * (rnd() * 2 - 1))));
  const hrings = [Array.from({ length: NH }, (_, j) => headPt(hairline(lonOf(j)) + 2, lonOf(j), 0.99))];
  S.forEach((s, i) => hrings.push(Array.from({ length: NH }, (_, j) => { const lo = lonOf(j), h = hairline(lo); return tuck(headPt(h + (86 - h) * s, lo, 1 + thick[i][j] / 0.16)); })));
  loft(hr, hrings, R.hair, { v: [0, ...S.map((s) => 0.06 + 0.94 * s)], cap: [false, tuck(headPt(90, 0, 1.06))] });

  // the cap: the body hugs the head, a little slack at the crown; the cuff turned up round its edge
  const cap = m.part('cap', { crease: 50, bind: 'Head' }), TH = 0.012, NC = CAPH.length;
  within(cap, capXf, (p) => {
    const prof = CAPH.map((h) => [1, h]).concat([[0.55, CAPTOP + 0.010], [0, CAPTOP + 0.016]]);
    p.lathe(prof, NS, R.cap, { wobble: (i, j) => (i < NC ? capR(CAPH[i], j) + TH + 0.006 * (CAPH[i] / CAPTOP) ** 2 : capR(CAPH[NC - 1], j) + TH) });
    const CUFF = [[0.0, -0.008], [0.009, -0.011], [0.0165, -0.004], [0.0175, 0.022], [0.0165, 0.044], [0.010, 0.051], [0.0, 0.050]];
    p.lathe(CUFF.map(([, h]) => [1, h]), NS, R.cuff, { wobble: (i, j) => capR(Math.max(0, CUFF[i][1]), j) + TH + CUFF[i][0], v: [0, 0.06, 0.18, 0.5, 0.82, 0.94, 1] });
  });

  // the plait: gathered at the nape, over her collar and down the middle of her back, tied, the end loose
  const pl = m.part('plait', { crease: 75, bind: ladder([[0.95, 'Spine01'], [1.02, 'Spine'], [1.10, 'neck'], [1.16, 'Head']]) });
  const KN = [0, 1.178, -0.120];
  lump(hr, add(KN, [0, -0.002, -0.008]), [0.040, 0.030, 0.022], R.gather, { lat: 5, lon: 9, lump: 0.08, seed: 4, xf: rotX(-25 * D) });
  const path = curve([[0.80, 0.012, -0.193], [0.88, 0.010, -0.190], [0.96, 0.008, -0.181], [1.02, 0.006, -0.163], [1.07, 0.004, -0.150], [1.11, 0.002, -0.143], [1.17, 0.0, -0.141]]), PP = (y) => { const [x, z] = path(y); return [x, y, z]; };
  const NL = 13, Y0 = 1.150, Y1 = 0.840;
  for (let k = 0; k < NL; k++) {
    const t = k / (NL - 1), y = Y0 + (Y1 - Y0) * t, s = k % 2 ? 1 : -1, c = PP(y), tg = norm(sub(PP(y - 0.01), PP(y + 0.01))), w = 1 - 0.32 * t;
    const R0 = aim([0, 0, 0], tg, [0, 0, -1]), xf = (q) => R0(rotZ(s * 38 * D)(q));
    lump(pl, add(c, [s * 0.0095 * w, 0, 0]), [0.0230 * w, 0.0235, 0.0120 * w], R.lobe, { lat: 5, lon: 8, lump: 0.03, seed: 20 + k, xf });
  }
  const TIE = PP(0.818), tgT = norm(sub(PP(0.808), PP(0.828)));
  within(pl, aim(TIE, mul(tgT, -1), [0, 0, -1]), (q) => q.lathe([[0.0115, -0.006], [0.0135, -0.004], [0.0135, 0.004], [0.0115, 0.006]], 8, R.tie));
  within(pl, aim(add(TIE, mul(tgT, 0.004)), tgT, [0, 0, -1]), (q) => q.lathe([[0.0105, 0], [0.0150, 0.016], [0.0170, 0.034], [0.0120, 0.050], [0.0, 0.056]], 8, R.tuft, { wobble: (i, j) => 1 + 0.12 * Math.sin(j * 2.3 + i) }));

  // the pipe: a short stem and a small bowl, white clay gone brown at the lip and the mouthpiece
  const pp = m.part('pipe', { crease: 50, bind: 'Pipe' }), E = add(PIPE, mul(STEM, STEML));
  pp.tube([PIPE, add(PIPE, mul(STEM, 0.04)), E], [0.0040, 0.0044, 0.0050], 6, R.stem, { v: [0, 0.5, 1] });
  within(pp, aim(add(E, mul(BOWL, -0.004)), BOWL, STEM), (q) => {
    q.lathe([[0.0, -0.002], [0.0060, -0.0015], [0.0092, 0.004], [0.0112, 0.016], [0.0128, 0.030], [0.0128, 0.034]], 10, R.bowl);
    q.lathe([[0.0128, 0.034], [0.0098, 0.0345], [0.0082, 0.022], [0.0, 0.016]], 10, R.char);
  });
};

// =====================================================================================================================
// the trunk: the pilot coat's section at every height, and things that lie on it
// [height, half width, front, back, middle z]: a short broad body, the coat to the middle of her thighs
const TORSO = curve([[0.43, 0.272, 0.212, 0.198, 0.006], [0.50, 0.266, 0.210, 0.194, 0.004], [0.58, 0.260, 0.210, 0.188, 0.002], [0.66, 0.255, 0.214, 0.182, -0.002], [0.74, 0.250, 0.218, 0.176, -0.006],
  [0.82, 0.244, 0.214, 0.170, -0.010], [0.89, 0.240, 0.200, 0.163, -0.014], [0.94, 0.226, 0.180, 0.156, -0.018], [0.975, 0.204, 0.158, 0.147, -0.021], [1.002, 0.170, 0.132, 0.130, -0.024], [1.025, 0.128, 0.104, 0.105, -0.026], [1.045, 0.095, 0.082, 0.085, -0.026]]);
const TY = [0.43, 1.045], TE = 2 / 2.5;
/** A point of the coat at a height and an angle (0 = front, 90 = her left), pushed `off` outward in its level section. */
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
/** The angle at which the front of the coat has a given x at a height. */
const degOfX = (x, y) => { const rx = TORSO(y)[0]; return Math.asin(Math.sign(x) * Math.min(1, (Math.abs(x) / rx) ** (1 / TE))) / D; };

const spine = ladder([[0.765, 'Hips'], [0.85, 'Spine02'], [0.93, 'Spine01'], [1.0, 'Spine'], [1.075, 'neck'], [1.14, 'Head']]);
/** The bind of the trunk: the spine by height, the shoulder girdle toward each arm, both thighs for the coat's skirt. */
const torsoBind = (p) => {
  let w = spine(p); const sd = p[0] > 0 ? 'Left' : 'Right';
  const sh = s01((Math.abs(p[0]) - 0.07) / 0.10) * s01((p[1] - 0.90) / 0.07); if (sh > 0) w = mixW(w, [[sd + 'Shoulder', 1]], 0.7 * sh);
  const sk = 0.85 * s01((0.66 - p[1]) / 0.18); if (sk > 0) { const t = s01(p[0] / 0.16 + 0.5); w = mixW(w, [['LeftUpLeg', t], ['RightUpLeg', 1 - t]], sk); }
  return w;
};
const NT = 24, YS = [0.43, 0.44, 0.47, 0.52, 0.58, 0.66, 0.74, 0.82, 0.89, 0.94, 0.975, 1.002, 1.025, 1.045];
const coatV = (() => { let L = 0; const a = [0]; for (let i = 1; i < YS.length; i++) { L += (len(sub(torsoAt(YS[i], 90), torsoAt(YS[i - 1], 90))) + len(sub(torsoAt(YS[i], 0), torsoAt(YS[i - 1], 0)))) / 2; a.push(L); } return a.map((x) => x / L); })();
const vOfY = (y) => { let i = 0; while (i + 2 < YS.length && y > YS[i + 1]) i++; return coatV[i] + (coatV[i + 1] - coatV[i]) * (y - YS[i]) / (YS[i + 1] - YS[i]); };
const uOfDeg = (deg) => 0.5 + deg / 360;
// double-breasted: the right front laps over to her left, its edge at EDGE; two rows of brass buttons, the outer row through the cloth
const BTN = { x: 0.084, ys: [0.948, 0.868, 0.788, 0.708] }, EDGE = 0.122;
const button = (part, r, o, rad0 = 0.0135) => within(part, aim(o.p, o.n), (q) => q.lathe([[rad0, -0.002], [rad0, 0.0042], [rad0 * 0.70, 0.0074], [0, 0.0078]], 9, r));

const body = (m, R) => {
  // the coat
  const coat = m.part('coat', { crease: 60, bind: torsoBind });
  loft(coat, YS.map((y) => torsoRing(y, NT)), R.coat, { v: coatV });
  const inside = m.part('inside', { crease: 30, bind: torsoBind });
  loft(inside, [torsoRing(0.43, NT), torsoRing(0.436, NT, -0.012), torsoRing(0.50, NT, -0.022)], R.lining, { flip: true });
  loft(inside, [torsoRing(0.50, NT, -0.022)], R.liningDark, { cap: [[0, 0.50, 0.0], false] });
  // the collar, turned up and done up round her neck; its ends lap at the throat, held by a button
  const col = m.part('collar', { crease: 55, bind: torsoBind }), NC = 20, cr = (rx, rz, y) => Array.from({ length: NC }, (_, j) => { const a = 2 * Math.PI * j / NC - Math.PI / 2; return [-rx * Math.cos(a), y, -0.024 + rz * Math.sin(a)]; });
  loft(col, [torsoRing(1.026, NC, 0.002), cr(0.112, 0.104, 1.046), cr(0.106, 0.099, 1.080), cr(0.104, 0.097, 1.104), cr(0.098, 0.091, 1.110), cr(0.091, 0.085, 1.098), cr(0.086, 0.081, 1.060)], R.collar, { v: [0, 0.18, 0.52, 0.74, 0.82, 0.9, 1] });
  const bits = m.part('bits', { crease: 40, bind: torsoBind });
  { const a = 14 * D, c0 = [0.104 * Math.sin(a), 1.074, -0.024 + 0.097 * Math.cos(a)], n = norm([Math.sin(a), 0.05, Math.cos(a)]); button(bits, R.button, { p: add(c0, mul(n, 0.002)), n }, 0.0105); }
  // buttons down the front, two rows of four
  for (const y of BTN.ys) for (const s of [-1, 1]) button(bits, R.button, onTorso(y, degOfX(s * BTN.x, y), 0));
};

// =====================================================================================================================
// arms and legs
const SIDE = (s) => (s > 0 ? 'Left' : 'Right');
const arm = (m, R, s) => {
  const sd = SIDE(s), S = J[sd + 'Arm'], E = J[sd + 'ForeArm'], Wr = J[sd + 'Hand'], du = norm(sub(E, S)), dl = norm(sub(Wr, E)), LL = len(sub(Wr, E));
  const bind = chain(torsoBind, [[sd + 'Arm', S], [sd + 'ForeArm', E], [sd + 'Hand', Wr]], [0.08, 0.08, 0.045]), U = (t) => add(S, mul(du, t)), Lw = (t) => add(E, mul(dl, t));
  const sl = m.part('sleeve' + sd, { crease: 60, bind });
  limb(sl, [{ c: add(U(-0.044), [0, -0.020, 0]), rx: 0.036 }, { c: add(U(-0.024), [0, -0.011, 0]), rx: 0.062 }, { c: add(U(0.008), [0, -0.003, 0]), rx: 0.077 }, { c: U(0.07), rx: 0.077 }, { c: U(0.14), rx: 0.072 }, { c: E, rx: 0.069 }, { c: Lw(0.07), rx: 0.066 }, { c: Lw(LL - 0.052), rx: 0.064 }], 12, R.sleeve, { cap: [true, false] });
  const cf = m.part('cuff' + sd, { crease: 60, bind });                                              // a turned-back cuff, and the dark inside of the sleeve round the wrist
  limb(cf, [{ c: Lw(LL - 0.060), rx: 0.063, along: dl }, { c: Lw(LL - 0.056), rx: 0.071, along: dl }, { c: Lw(LL - 0.012), rx: 0.073, along: dl }, { c: Lw(LL - 0.006), rx: 0.069, along: dl }], 12, R.cuffband);
  limb(cf, [{ c: Lw(LL - 0.006), rx: 0.069, along: dl }, { c: Lw(LL - 0.020), rx: 0.050, along: dl }], 12, R.liningDark);
  // the hand: big, broad, bare; a mitten of a hand with the fingers drawn on, the thumb forward; it closes at two joints
  const F = norm(add([0, 0, 1], mul(dl, -dl[2]))), X = cross(F, dl), Hd = (t, f = 0, x = 0) => add(add(add(Wr, mul(dl, t)), mul(F, f)), mul(X, x));
  const wr = m.part('wrist' + sd, { crease: 70, bind });
  limb(wr, [{ c: Lw(LL - 0.040), rx: 0.042, along: dl }, { c: Lw(LL - 0.008), rx: 0.043, along: dl }, { c: Hd(0.004), rx: 0.040, rz: 0.044, along: dl, front: F }], 10, R.wrist);
  const hd = m.part('hand' + sd, { crease: 70, bind: chain(bind, [[sd + 'Fingers', J[sd + 'Fingers']], [sd + 'FingerTips', J[sd + 'FingerTips']]], [0.024, 0.022]) });
  limb(hd, [{ c: Hd(-0.002), rx: 0.034, rz: 0.044, along: dl, front: F }, { c: Hd(0.030, 0.002), rx: 0.036, rz: 0.058, along: dl, front: F }, { c: Hd(0.066, 0.003), rx: 0.035, rz: 0.064, along: dl, front: F },
    { c: Hd(0.102, 0.002, s * -0.006), rx: 0.030, rz: 0.058, along: dl, front: F }, { c: Hd(0.126, 0.0, s * -0.013), rx: 0.020, rz: 0.042, along: dl, front: F }], 10, R.hand, { pow: 2.6, cap: [false, Hd(0.137, 0.0, s * -0.017)] });
  const td = norm(add(mul(dl, 0.62), mul(F, 0.78))), T0 = Hd(0.030, 0.042, s * -0.005), th = m.part('thumb' + sd, { crease: 70, bind });
  limb(th, [{ c: T0, rx: 0.022 }, { c: add(T0, mul(td, 0.031)), rx: 0.0212 }, { c: add(T0, mul(td, 0.056)), rx: 0.0172 }], 6, R.thumb, { cap: [true, add(T0, mul(td, 0.069))] });
};
const leg = (m, R, s) => {
  const sd = SIDE(s), H = J[sd + 'UpLeg'], K = J[sd + 'Leg'], A = J[sd + 'Foot'], T = J[sd + 'ToeBase'];
  const bind = chain('Hips', [[sd + 'UpLeg', H], [sd + 'Leg', K], [sd + 'Foot', A], [sd + 'ToeBase', T]], [0.10, 0.08, 0.05, 0.04]);
  const zs = (y) => H[2] + (A[2] - H[2]) * (H[1] - y) / (H[1] - A[1]), kz = zs(K[1]) + 0.45 * (K[2] - zs(K[1]));                    // her knee, not as far forward as the joint
  const path = curve([[0.12, A[0], A[2] + 0.004], [K[1], K[0], kz], [0.66, H[0], H[2] + 0.004]]), P = (y) => { const [x, z] = path(y); return [x, y, z]; };
  const tr = m.part('trousers' + sd, { crease: 60, bind });
  limb(tr, [{ c: P(0.65), rx: 0.092 }, { c: P(0.55), rx: 0.092 }, { c: P(0.45), rx: 0.088 }, { c: P(0.38), rx: 0.082 }, { c: P(0.33), rx: 0.078 }], 10, R.trousers, { cap: [true, false] });
  const bt = m.part('boot' + sd, { crease: 55, bind });
  limb(bt, [{ c: P(0.322), rx: 0.084 }, { c: P(0.328), rx: 0.097 }, { c: P(0.362), rx: 0.100 }, { c: P(0.370), rx: 0.095 }, { c: P(0.360), rx: 0.080 }].map((q) => ({ ...q, along: [0, 1, 0] })), 12, R.bootTop);      // the top of a sea boot, turned down
  limb(bt, [{ c: [A[0], 0.042, A[2] + 0.002], rx: 0.068 }, { c: P(0.14), rx: 0.072 }, { c: P(0.21), rx: 0.078 }, { c: P(0.28), rx: 0.085 }, { c: P(0.330), rx: 0.090 }].map((q) => ({ ...q, along: [0, 1, 0] })), 12, R.shaft, { v: [-0.12, 0.25, 0.55, 0.82, 1] });
  // the foot: broad, heel to toe along the way the foot points
  const fd = norm([T[0] - A[0], 0, T[2] - A[2]]), A0 = [A[0], 0, A[2]], Ft = (t, y) => add(add(A0, mul(fd, t)), [0, y, 0]), up = [0, 1, 0];
  limb(bt, [[-0.082, 0.060, 0.044, 0.050, 0.040], [-0.062, 0.060, 0.064, 0.076, 0.044], [0.0, 0.058, 0.075, 0.086, 0.044], [0.064, 0.056, 0.080, 0.070, 0.044], [0.122, 0.054, 0.084, 0.060, 0.044], [0.168, 0.051, 0.076, 0.052, 0.041], [0.196, 0.047, 0.054, 0.039, 0.036]]
    .map(([t, y, rx, ru, rd]) => ({ c: Ft(t, y), rx, rz: [ru, rd], along: fd, front: up })), 10, R.foot, { pow: 2.3, cap: [Ft(-0.091, 0.060), Ft(0.209, 0.046)] });
  limb(bt, [[-0.093, 0.048], [-0.068, 0.067], [0.0, 0.080], [0.064, 0.086], [0.122, 0.090], [0.170, 0.082], [0.209, 0.055]].map(([t, rx]) => ({ c: Ft(t, 0.0185), rx, rz: [0.009, 0.0185], along: fd, front: up, pow: 3.2 })), 10, R.sole, { cap: [Ft(-0.100, 0.013), Ft(0.220, 0.013)] });
};

// =====================================================================================================================
const m = new Model('oake');
m.material('main', { kind: 'texture', roughness: 0.84 });
if (!NORIG) m.skeleton(RIG);
const skin = (o = {}) => ({ mat: 'skin', colour: C.skin, soft: 0, ...o }), hairP = (o = {}) => ({ mat: 'hair', colour: C.hair, sheen: C.hairLight, soft: 0, ...o });
const wool = (o = {}) => ({ mat: 'melton', colour: C.coat, soft: 0, ...o }), knit = (o = {}) => ({ mat: 'knit', colour: C.cap, soft: 0, ...o }), flat = (colour, o = {}) => ({ mat: 'flat', colour, var: 0.08, ...o });
const R = pack(...ATLAS, {
  // head
  face: [576, 576, { mat: 'oldface', soft: 0, colour: C.skin, blush: C.blush, brows: C.brows, cy: HC[1], cap: 1.385, pipe: [PIPE[0], PIPE[1]], ...FACE }],
  headskin: [384, 176, skin({ ys: [HC[1] + HR[1] * Math.sin(-78 * D), HC[1] + HR[1] * Math.sin(84 * D)] })], nose: [80, 80, skin({ tip: C.blush, tipfrom: 0.2, var: 0 })], ear: [64, 64, skin({ tip: C.blush, tipfrom: 0.6, ao: { bottom: 0.15 } })], neck: [192, 80, skin({ ao: { top: 0.5, bottom: 0.3 } })],
  hair: [704, 224, hairP()], gather: [192, 128, hairP({ colour: '#7C7974', sheen: '#B9B4AA', along: 'x', locks: 5, shine: 0.35 })], lobe: [96, 96, hairP({ colour: '#7C7974', sheen: '#B9B4AA', locks: 3, band: 0.55, shine: 0.35 })], tuft: [96, 96, hairP({ colour: '#7C7974', sheen: '#B9B4AA', locks: 4, band: 0.4, shine: 0.35 })], tie: [64, 24, flat(C.cord)],
  cap: [832, 256, knit({ wales: 44, tile_x: true, worn: 0.35, ao: { bottom: 0.25 } })], cuff: [832, 112, knit({ wales: 44, rib: 1.0, tile_x: true, worn: 0.35, along: 'y' })],
  gold: [64, 16, { mat: 'brass', patina: 0.05, verdigris: 0 }],
  // coat
  coat: [1344, 704, wool({ tile_x: true, k: 1.4, hem: 0.035, flapline: uOfDeg(degOfX(EDGE, 0.8)), holes: BTN.ys.map((y) => [uOfDeg(degOfX(BTN.x, y)), vOfY(y), 13]),
    seams: [[0.25, 0, 0.25, vOfY(0.995)], [0.75, 0, 0.75, vOfY(0.995), -1], [0.001, 0, 0.001, vOfY(1.03)], [0.999, 0, 0.999, vOfY(1.03), -1]],
    welts: [-1, 1].map((sd) => [uOfDeg(sd * 52 - sd * 3), vOfY(0.745), uOfDeg(sd * 52 + sd * 3), vOfY(0.885), 10]) })],
  lining: [64, 64, flat('#2B3348')], liningDark: [48, 48, flat('#141A26', { var: 0.05 })], collar: [640, 128, wool({ tile_x: true, k: 1.2, stitched: 6, sides: 't', flapline: 0.5 + 18 / 360, ao: { bottom: 0.35 } })],
  button: [48, 48, { mat: 'brass', patina: 0.35, verdigris: 0.06, top: 0.5 }],
  sleeve: [448, 384, wool({ tile_x: true, k: 1.3, seams: [[0.02, 0.05, 0.02, 1]], worn: 0.45, ao: { top: 0.25 } })], cuffband: [448, 80, wool({ tile_x: true, k: 1.2, stitched: 6, sides: 'tb' })],
  wrist: [192, 80, skin({ tile_x: true, ao: { bottom: 0.35 } })], hand: [288, 176, { mat: 'hand', colour: C.skin, tip: C.blush, soft: 0 }], thumb: [72, 72, skin({ tip: C.blush, tipfrom: 0.5 })],
  trousers: [352, 256, flat(C.trousers, { var: 0.08, grain: 0.05, along: 'y', tile_x: true, ao: { top: 0.4, bottom: 0.3 } })],
  shaft: [448, 320, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.5, k: 1.4, ao: { top: 0.2 } }], bootTop: [448, 72, { mat: 'leather', colour: '#4A3F38', soft: 0, tile_x: true, worn: 0.6 }],
  foot: [416, 288, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.7, k: 1.4, toecap: 0.74 }], sole: [320, 40, flat(C.sole, { var: 0.1 })],
  stem: [32, 192, { mat: 'clay', colour: C.clay, mouthpiece: 0.12, soft: 0 }], bowl: [96, 64, { mat: 'clay', colour: C.clay, burnt: 0.28, soft: 0 }], char: [64, 32, flat('#2A211C', { var: 0.15 })],
}, 10);
/** The head and all on it made larger about a point under the chin: built at the biped's size, it looked small on her. */
const grow = (m, names) => { for (const p of m.parts) if (names.includes(p.name)) for (const t of p.tris) for (const k of t) k.p = k.p.map((v, i) => PIV[i] + HK * (v - PIV[i])); };
if (want('head')) { head(m, R); grow(m, ['head', 'earring', 'hair', 'cap', 'pipe']); }
if (want('body')) body(m, R);
if (want('limbs')) for (const s of [-1, 1]) { arm(m, R, s); leg(m, R, s); }
await emit(m, R, ATLAS, args, { size: 1024 });
