// build-calloway.mjs : Dr. Ines Calloway, the visiting naturalist of Mossglass Fen, built in code (no generation job).
// Usage: node build-calloway.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg] [--only head,body,limbs] [--norig]
// She stands in the rest pose of the biped skeleton the generated characters share (biped-rig.json, written from the
// player's rig by dump-skeleton.mjs), so their clips move her. Front toward +Z (her left is +X), metres, one material.
import fs from 'node:fs';
import { Model, pack, emit, cli, add, sub, mul, norm, cross, dot, len, rng, within, move, rotX, rotY, scale, compose } from './kit.mjs';
import { frame, ring, loft, limb, lump, ladder, chain, rigid, mixW, ribbon, slab, outward } from './figure.mjs';
import { aim, membrane, curve, triToward } from './fish.mjs';

const argv = process.argv.slice(2); const oi = argv.indexOf('--only'); const ONLY = oi < 0 ? null : argv.splice(oi, 2)[1].split(',');
const ni = argv.indexOf('--norig'); const NORIG = ni >= 0; if (NORIG) argv.splice(ni, 1);
const want = (k) => !ONLY || ONLY.includes(k);
const args = cli(argv);
const RIG = JSON.parse(fs.readFileSync(new URL('./biped-rig.json', import.meta.url)));
const J = Object.fromEntries(RIG.joints.map((j) => [j.name, j.at]));
const D = Math.PI / 180, ATLAS = [2048, 2048];
const s01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---- colours (the painter reads them from the layout)
const C = { skin: '#DDA680', blush: '#E57F6C', hair: '#3A2A24', hairLight: '#75503A', straw: '#DDC98E', band: '#3FA7A0', brass: '#C9A24A', coat: '#7C7A4A', roll: '#D8C7A0', trousers: '#A48B60',
  boot: '#5B4032', leather: '#8C5C3C', tape: '#EDBE3F', scarf: '#7A6390', collar: '#6A4B37', lining: '#3A3528' };

// =====================================================================================================================
// the head
const HC = [0, 1.44, 0.004], HR = [0.170, 0.168, 0.163];
/** A point of the head: lat (-90 chin .. 90 crown) and lon (0 front, 90 her left) in degrees; k = how far out (1 = the skin). */
const headPt = (lat, lon, k = 1) => {
  const cl = Math.cos(lat * D), sl = Math.sin(lat * D), cn = Math.cos(lon * D), sn = Math.sin(lon * D);
  const jaw = sl < 0 ? 1 - 0.20 * (-sl) ** 1.5 : 1 - 0.04 * sl;                                   // narrower toward the chin
  const cheek = 1 + 0.06 * Math.exp(-(((lat + 24) / 22) ** 2)) * Math.abs(sn) ** 1.5;             // full cheeks
  return add(HC, mul([HR[0] * cl * sn * jaw * cheek, HR[1] * sl, HR[2] * cl * cn * (cn > 0 ? 0.96 : 1) * (sl < 0 ? 1 - 0.05 * -sl : 1)], k));
};
const FACE = { span: 0.42, eye: [0.068, 1.447], eyeR: [0.0165, 0.0215], mouth: [0, 1.348], brow: 1.512, cheek: [0.094, 1.385] };
const faceUv = (r) => (i, j, p) => r.at(0.5 + p[0] / FACE.span, (p[1] - (HC[1] - FACE.span / 2)) / FACE.span);

// the hat: pushed back on her head, its brim a halo behind her face
const TILT = 33, HN = [0, Math.cos(TILT * D), -Math.sin(TILT * D)], HO = add(HC, mul(HN, 0.066)), hatXf = aim(HO, HN, [0, 0, 1]);
const hatInv = (() => { const o = hatXf([0, 0, 0]), ex = sub(hatXf([1, 0, 0]), o), ey = sub(hatXf([0, 1, 0]), o), ez = sub(hatXf([0, 0, 1]), o); return (p) => { const d = sub(p, o); return [dot(d, ex), dot(d, ey), dot(d, ez)]; }; })();
const CROWN = [[0.166, 0.0], [0.167, 0.030], [0.159, 0.066], [0.133, 0.098], [0.080, 0.118], [0, 0.124]], BRIM = 0.338;
const crownR = (h) => { if (h <= 0) return CROWN[0][0]; for (let i = 0; i + 1 < CROWN.length; i++) if (h <= CROWN[i + 1][1]) return CROWN[i][0] + (CROWN[i + 1][0] - CROWN[i][0]) * (h - CROWN[i][1]) / (CROWN[i + 1][1] - CROWN[i][1]); return 0; };
/** Hair that would come through the hat is pressed inside it. */
const tuck = (p) => { const q = hatInv(p); if (q[1] < -0.010) return p; const h = Math.min(q[1], 0.112), r = Math.hypot(q[0], q[2]), rm = crownR(h) - 0.007; return r <= rm && h === q[1] ? p : hatXf([q[0] * Math.min(1, rm / r), h, q[2] * Math.min(1, rm / r)]); };
/** The latitude at which the hat's opening meets her head, at a longitude. */
const hatLat = (lon) => { let a = -60, b = 60; for (let k = 0; k < 30; k++) { const mid = (a + b) / 2; if (dot(sub(headPt(mid, lon), HO), HN) < 0) a = mid; else b = mid; } return (a + b) / 2; };
const hairline = (() => { const f = curve([[0, 43], [30, 39], [55, 22], [75, 0], [95, -24], [130, -40], [180, -50]]); return (lon) => f(Math.abs(lon))[0] - 9 * Math.exp(-(((lon + 34) / 22) ** 2)) + 2 * Math.exp(-(((lon - 22) / 10) ** 2)); })();

const head = (m, R) => {
  const sk = m.part('head', { crease: 70, bind: 'Head' }), N = 16, lats = [-78, -60, -42, -25, -9, 7, 23, 39, 55, 71, 84];
  const rings = lats.map((la) => Array.from({ length: N }, (_, j) => headPt(la, -180 + 360 * j / N)));
  loft(sk, rings.map((r) => r.slice(5, 12)), R.face, { closed: false, uv: faceUv(R.face) });                               // the face, painted as seen from the front
  loft(sk, rings.map((r) => [...r.slice(11), ...r.slice(0, 6)]), R.headskin, { closed: false, v: lats.map((la) => (Math.sin(la * D) - Math.sin(lats[0] * D)) / (Math.sin(lats[lats.length - 1] * D) - Math.sin(lats[0] * D))) });
  loft(sk, [rings[0]], R.headskin, { cap: [headPt(-90, 0), false] }); loft(sk, [rings[rings.length - 1]], R.headskin, { v: [1], cap: [false, headPt(90, 0)] });
  // nose: a small rounded wedge, tipped up
  const no = headPt(-12, 0, 0.965), nd = norm([0, 0.32, 1]), nf = frame(nd, [0, 1, 0]);
  loft(sk, [ring(no, nf, 0.026, [0.019, 0.025], 8), ring(add(no, mul(nd, 0.022)), nf, 0.020, [0.016, 0.019], 8), ring(add(no, mul(nd, 0.034)), nf, 0.011, 0.010, 8)], R.nose, { cap: [false, add(no, mul(nd, 0.039))] });
  for (const s of [-1, 1]) lump(sk, add(headPt(-4, s * 92, 1.0), [s * 0.006, 0, 0]), [0.016, 0.036, 0.027], R.ear, { lat: 4, lon: 6, lump: 0 });
  const nk = m.part('neck', { crease: 70, bind: ladder([[1.17, 'Spine'], [1.22, 'neck'], [1.27, 'neck'], [1.31, 'Head']]) });
  limb(nk, [{ c: [0, 1.150, -0.022], rx: 0.062 }, { c: [0, 1.22, -0.016], rx: 0.057 }, { c: [0, 1.31, -0.004], rx: 0.057 }], 8, R.neck);

  // hair: a cap from the hairline up (under the hat it is pressed flat), and locks that come out from under the brim
  const hr = m.part('hair', { crease: 42, bind: 'Head' }), NH = 32, rnd = rng(7), S = [0, 0.16, 0.36, 0.58, 0.8, 0.94];
  const lonOf = (j) => -180 + 360 * (j % NH) / NH, thick = S.map((s) => Array.from({ length: NH }, () => (0.013 + 0.010 * Math.sin(Math.PI * Math.min(1, s / 0.5) / 2)) * (1 + 0.2 * (rnd() * 2 - 1))));
  const hrings = [Array.from({ length: NH }, (_, j) => headPt(hairline(lonOf(j)) + 3, lonOf(j), 0.99))];
  S.forEach((s, i) => hrings.push(Array.from({ length: NH }, (_, j) => { const lo = lonOf(j), h = hairline(lo); return tuck(headPt(h + (86 - h) * s, lo, 1 + thick[i][j] / 0.168)); })));
  loft(hr, hrings, R.hair, { v: [0, ...S.map((s) => 0.06 + 0.94 * s)], cap: [false, tuck(headPt(90, 0, 1.06))] });
  /** A lock: from under the hat at lon0, down and round to lon0 + dlon, ending `down` degrees below the hairline (or at latitude `to`). */
  const lock = (lon0, dlon, w, { down = 4, to = null, lift = 0.014, n = 4, thickness = 0.012, out = 0 } = {}) => {
    const la0 = hatLat(lon0) + 3, la1 = to ?? hairline(lon0 + dlon) - down, rg = [];
    const at = (t) => headPt(la0 + (la1 - la0) * t, lon0 + dlon * t ** 1.4, 1 + (0.009 + lift * Math.sin(Math.PI * Math.min(1, 0.1 + t)) ** 0.8 + out * t * t) / 0.168);
    for (let i = 0; i <= n; i++) { const t = i / n, c = at(t), fr = frame(sub(at(Math.min(1, t + 0.02)), at(Math.max(0, t - 0.02))), sub(c, HC)); rg.push(ring(c, fr, w / 2 * Math.sin(Math.PI * (0.25 + 0.68 * t)) ** 0.7, thickness * (1 - 0.45 * t * t), 6).map(tuck)); }
    loft(hr, rg, R.lock, { cap: [true, at(1.06)] });
  };
  for (const [lon0, dlon, w] of [[14, -17, 0.044], [-6, -19, 0.048], [-28, -17, 0.046], [-48, -12, 0.040], [32, 13, 0.040], [50, 11, 0.036]]) lock(lon0, dlon, w);          // the fringe, swept to her right from a parting
  lock(-70, 6, 0.036, { to: -36, n: 5, lift: 0.012, out: 0.012 }); lock(69, -5, 0.034, { to: -30, n: 5, lift: 0.012, out: 0.010 });                                         // a lock in front of each ear
  for (const [lon0, dlon, w, to] of [[100, 16, 0.05, -40], [-102, -16, 0.05, -42], [132, 22, 0.055, -48], [-134, -22, 0.055, -48]]) lock(lon0, dlon, w, { to, lift: 0.010 }); // swept back toward the bun
  // a low bun at the nape, with a pencil pushed through it
  const BUN = [0.012, 1.318, -0.150];
  lump(hr, BUN, [0.066, 0.058, 0.060], R.bun, { lat: 5, lon: 9, lump: 0.16, seed: 5 });
  const bits = m.part('hairbits', { crease: 40, bind: 'Head' });
  bits.tube([add(BUN, [-0.115, -0.035, -0.012]), add(BUN, [0.105, 0.045, 0.012])], 0.0058, 6, R.pencil); bits.tube([add(BUN, [0.105, 0.045, 0.012]), add(BUN, [0.125, 0.0527, 0.0143])], [0.0058, 0.0008], 6, R.pencilTip);

  // spectacles: two round brass rims, a bridge, and arms back to her ears
  const sp = m.part('specs', { crease: 50, bind: 'Head' }), ez = headPt(4, 23)[2] + 0.017, EY = FACE.eye[1], EX = FACE.eye[0];
  for (const s of [-1, 1]) {
    sp.torus(0.049, 0.0050, 20, 5, R.brass, { xf: compose(move([s * EX, EY, ez]), rotY(s * 9 * D), rotX(90 * D)) });
    sp.tube([[s * (EX + 0.048), EY + 0.008, ez - 0.006], [s * 0.150, EY + 0.012, 0.075], [s * 0.176, EY + 0.012, 0.0], [s * 0.172, EY - 0.012, -0.03]], 0.0040, 4, R.brass, { open: true });
  }
  sp.tube([[-(EX - 0.047), EY + 0.008, ez + 0.002], [0, EY + 0.02, ez + 0.012], [EX - 0.047, EY + 0.008, ez + 0.002]], 0.0045, 4, R.brass, { open: true });

  // the hat
  const hat = m.part('hat', { crease: 38, bind: 'Head' });
  const leaf = (part, r, root, up, over, lenL, w) => { const ax = norm(cross(over, up)), G = [[], [], []]; for (let j = 0; j <= 3; j++) { const t = j / 3, c = add(root, add(mul(up, lenL * t), mul(over, 0.3 * lenL * t * t))), ww = w * Math.sin(Math.PI * (0.12 + 0.88 * t) ** 0.8) / 2; G[0].push(add(c, mul(ax, -ww))); G[1].push(add(c, mul(over, -0.3 * ww))); G[2].push(add(c, mul(ax, ww))); } membrane(part, G, r, { thick: 0.004 }); };
  within(hat, hatXf, (p) => {
    const prof = [[0.160, -0.006], [0.245, -0.017], [BRIM - 0.014, -0.036], [BRIM, -0.027], [BRIM - 0.013, -0.017], [0.245, 0.0], [0.166, 0.008]];
    p.lathe(prof, 28, R.brim, { lift: (i, j, a) => 0.022 * ((prof[i][0] - 0.16) / (BRIM - 0.16)) ** 2 * (Math.sin(3 * a + 0.7) + 0.5 * Math.sin(5 * a + 2.1)) });
    p.lathe(CROWN.map(([r0, h]) => [r0, h + 0.006]), 20, R.crown);
    p.lathe([[0.1675, 0.008], [0.1755, 0.011], [0.1755, 0.047], [0.1665, 0.050]], 20, R.band);
    const hp = (deg, r0, h) => [r0 * Math.sin(deg * D), h, r0 * Math.cos(deg * D)];
    // the band's bow, at the back
    within(p, compose(move(hp(180, 0.178, 0.029)), rotY(180 * D)), (q) => { q.box([0, 0, 0], [0.011, 0.012, 0.006], R.bow); for (const s of [-1, 1]) q.box([s * 0.030, 0, -0.002], [0.020, 0.016, 0.005], R.bow, { warp: (v) => [v[0], v[1] * (0.45 + 0.55 * Math.abs(v[0]) / 0.05), v[2]] }); });
    // a bulrush and two reed leaves tucked into the band over her left ear
    const sprig = m.part('sprig', { crease: 50, bind: 'Head', xf: p.xf }), a0 = 64, root = hp(a0, 0.180, 0.016), up = norm([0.42 * Math.sin(a0 * D), 1, 0.42 * Math.cos(a0 * D) - 0.25]);
    sprig.tube([root, add(root, mul(up, 0.105))], 0.0032, 5, R.stem); sprig.tube([0.100, 0.108, 0.128, 0.150, 0.158, 0.176].map((t) => add(root, mul(up, t))), [0.0032, 0.0105, 0.0115, 0.0105, 0.003, 0.0012], 7, R.rush);
    leaf(sprig, R.leaf, add(root, [0.004, -0.004, -0.012]), norm([up[0] * 1.5, 1, up[2] - 0.5]), norm([Math.sin(a0 * D), -0.2, Math.cos(a0 * D) - 0.6]), 0.135, 0.030);
    leaf(sprig, R.leaf, add(root, [-0.006, -0.004, 0.012]), norm([up[0] * 0.6, 1, up[2] + 0.45]), norm([Math.sin(a0 * D), -0.1, Math.cos(a0 * D) + 0.5]), 0.085, 0.024);
  });
  // its cord, down behind her ears to a bead under her chin
  const cord = m.part('cord', { crease: 50, bind: 'Head' }), bead = [0, 1.218, 0.094];
  for (const s of [-1, 1]) cord.tube([hatXf([s * 0.158, -0.004, 0.03]), [s * 0.170, 1.40, -0.030], [s * 0.120, 1.305, 0.02], [s * 0.05, 1.243, 0.078], add(bead, [s * 0.006, 0.012, 0])], 0.0042, 4, R.cord, { open: true });
  lump(cord, bead, [0.015, 0.017, 0.015], R.bead, { lat: 4, lon: 6, lump: 0 });
};

// =====================================================================================================================
// the trunk: the coat's section at every height, and things that lie on it
// [height, half width, front, back, middle z]
const TORSO = curve([[0.585, 0.250, 0.176, 0.178, -0.012], [0.70, 0.232, 0.167, 0.169, -0.014], [0.82, 0.208, 0.155, 0.155, -0.018], [0.90, 0.188, 0.142, 0.138, -0.020], [0.98, 0.191, 0.147, 0.134, -0.022],
  [1.06, 0.186, 0.141, 0.129, -0.024], [1.115, 0.160, 0.116, 0.114, -0.026], [1.150, 0.110, 0.084, 0.090, -0.026], [1.172, 0.074, 0.066, 0.070, -0.024]]);
const TY = [0.585, 1.172], TE = 2 / 2.5;
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
/** Surface coordinates about a place on the coat: x metres to the right (seen from outside), y up, z out. */
const surf = (deg0, y0) => { const per = len(sub(torsoAt(y0, deg0 + 0.5), torsoAt(y0, deg0 - 0.5))); return (x, y, z) => onTorso(y0 + y, deg0 + x / per, z).p; };
/** The angle at which the front of the coat has a given x at a height. */
const degOfX = (x, y) => { const rx = TORSO(y)[0]; return Math.asin(Math.sign(x) * Math.min(1, (Math.abs(x) / rx) ** (1 / TE))) / D; };

const spine = ladder([[0.893, 'Hips'], [0.982, 'Spine02'], [1.073, 'Spine01'], [1.148, 'Spine'], [1.235, 'neck'], [1.30, 'Head']]);
/** The bind of the trunk: the spine by height, the shoulder girdle toward each arm, both thighs for the coat's skirt. */
const torsoBind = (p) => {
  let w = spine(p); const sd = p[0] > 0 ? 'Left' : 'Right';
  const sh = s01((Math.abs(p[0]) - 0.05) / 0.09) * s01((p[1] - 1.02) / 0.08); if (sh > 0) w = mixW(w, [[sd + 'Shoulder', 1]], 0.7 * sh);
  const sk = 0.6 * s01((0.84 - p[1]) / 0.2); if (sk > 0) { const t = s01(p[0] / 0.16 + 0.5); w = mixW(w, [['LeftUpLeg', t], ['RightUpLeg', 1 - t]], sk); }
  return w;
};
const NT = 20, YS = [0.585, 0.64, 0.70, 0.76, 0.82, 0.865, 0.90, 0.935, 0.98, 1.02, 1.06, 1.09, 1.115, 1.135, 1.150, 1.163, 1.172], BY = 0.90;
const coatV = (() => { let L = 0; const a = [0]; for (let i = 1; i < YS.length; i++) { L += (len(sub(torsoAt(YS[i], 90), torsoAt(YS[i - 1], 90))) + len(sub(torsoAt(YS[i], 0), torsoAt(YS[i - 1], 0)))) / 2; a.push(L); } return a.map((x) => x / L); })();
const vOfY = (y) => { let i = 0; while (i + 2 < YS.length && y > YS[i + 1]) i++; return coatV[i] + (coatV[i + 1] - coatV[i]) * (y - YS[i]) / (YS[i + 1] - YS[i]); };
// the satchel's strap: a loop in a tilted plane, from her left shoulder to the back of her right hip
const SATCHEL = { deg: -132, y: 0.755 }, STRAP = (() => { const hi = [0.10, 1.156, -0.026], lo = torsoAt(0.87, SATCHEL.deg), d = norm([hi[0] - lo[0], 0, hi[2] - lo[2]]), k = (hi[1] - lo[1]) / (dot(sub(hi, lo), d)); return { d, k, y0: hi[1] - k * dot(hi, d) }; })();
const strapY = (deg) => { let a = 0.70, b = TY[1]; const f = (y) => y - STRAP.y0 - STRAP.k * dot(torsoAt(y, deg), STRAP.d); for (let i = 0; i < 40; i++) { const mid = (a + b) / 2; if (f(mid) < 0) a = mid; else b = mid; } return (a + b) / 2; };

const button = (part, r, y, deg, rad0 = 0.0125) => { const s = onTorso(y, deg, 0); within(part, aim(s.p, s.n), (q) => q.lathe([[rad0, -0.002], [rad0, 0.004], [rad0 * 0.62, 0.0068], [0, 0.0068]], 7, r)); };
const disc = (part, r, c, n, rad0, sides = 12) => { const xf = aim(c, n), P = (j) => { const a = 2 * Math.PI * j / sides; return [xf([rad0 * Math.cos(a), 0, rad0 * Math.sin(a)]), r.at(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a))]; }; for (let j = 0; j < sides; j++) triToward(part, [c, r.at(0.5, 0.5)], P(j), P(j + 1), n); };

const body = (m, R) => {
  // the coat
  const coat = m.part('coat', { crease: 60, bind: torsoBind });
  loft(coat, YS.map((y) => torsoRing(y, NT)), R.coat, { v: coatV });
  const inside = m.part('inside', { crease: 30, bind: torsoBind });
  loft(inside, [torsoRing(0.585, NT), torsoRing(0.590, NT, -0.012), torsoRing(0.655, NT, -0.02)], R.lining, { flip: true });
  loft(inside, [torsoRing(0.655, NT, -0.02)], R.lining, { cap: [[0, 0.655, -0.014], false] });
  loft(inside, [torsoRing(1.172, NT)], R.lining, { cap: [false, [0, 1.176, -0.024]] });
  // collar: brown corduroy, turned down, open at the front
  const col = m.part('collar', { crease: 55, bind: torsoBind }), CA = Array.from({ length: 17 }, (_, i) => 30 + (330 - 30) * i / 16);
  const tipK = (a) => Math.exp(-(((a - 30) / 20) ** 2)) + Math.exp(-(((330 - a) / 20) ** 2)), cpt = (a, r0, y) => [r0 * Math.sin(a * D), y, -0.024 + 0.95 * r0 * Math.cos(a * D)];
  const fall = (a, off) => { const want = 0.117 + 0.020 * tipK(a); let lo = 1.09, hi = TY[1]; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2, q = torsoAt(mid, a); if (Math.hypot(q[0], q[2] + 0.024) > want) lo = mid; else hi = mid; } return onTorso((lo + hi) / 2, a, off).p; };      // its edge lies on her shoulders, a set distance from her neck
  loft(col, [CA.map((a) => cpt(a, 0.070, 1.190)), CA.map((a) => cpt(a, 0.081, 1.196)), CA.map((a) => fall(a, 0.009)), CA.map((a) => fall(a, 0.0))], R.collar, { closed: false, v: [0, 0.2, 0.92, 1] });
  outward(col, 0, [0, 1.09, -0.024]);
  // neckerchief
  const sc = m.part('scarf', { crease: 60, bind: ladder([[1.16, 'Spine'], [1.235, 'neck']]) });
  sc.torus(0.064, 0.021, 16, 6, R.scarf, { xf: compose(move([0, 1.224, -0.014]), rotX(9 * D), scale([1, 1.2, 0.97])) });
  const KN = [0.008, 1.197, 0.064];
  lump(sc, KN, [0.024, 0.021, 0.018], R.knot, { lat: 4, lon: 7, lump: 0.12, seed: 3 });
  for (const [dx, ln, wd] of [[0.42, 0.090, 0.050], [-0.30, 0.074, 0.044]]) {
    const G = [[], [], []]; for (let j = 0; j <= 3; j++) { const t = j / 3, cx = KN[0] + dx * ln * t, cy = KN[1] - 0.008 - ln * t, ww = (0.012 + (wd - 0.012) * t) / 2; for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * ww, y = Math.min(1.16, cy + (i === 1 ? -0.012 * t : 0)); G[i].push(onTorso(y, degOfX(x, y), 0.010 + 0.006 * (1 - t)).p); } }
    membrane(sc, G, R.tail, { thick: 0.005, nrm: [0, 0.2, 1] });
  }
  // belt and buckle
  const belt = m.part('belt', { crease: 40, bind: torsoBind });
  loft(belt, [torsoRing(BY - 0.024, NT, 0.001), torsoRing(BY - 0.020, NT, 0.009), torsoRing(BY + 0.020, NT, 0.009), torsoRing(BY + 0.024, NT, 0.001)], R.belt, { v: [0, 0.12, 0.88, 1] });
  slab(belt, surf(0, BY), [-0.031, 0.031], [-0.028, 0.028], [0.007, 0.0165], { front: R.buckle, edge: R.brass }, { cols: 1, inset: 0.002 });
  // pockets, far too many
  const pk = m.part('pockets', { crease: 40, bind: torsoBind });
  const pocket = (deg, y, w, h, { depth = 0.020, flap = 0.40, big = true } = {}) => {
    const S = surf(deg, y), fh = h * flap;
    slab(pk, S, [-w / 2, w / 2], [-h / 2, h / 2], [-0.004, depth], { front: big ? R.pocket : R.pocketS, edge: R.pedge }, { cols: 3, inset: 0.005 });
    if (flap) slab(pk, S, [-w / 2 - 0.005, w / 2 + 0.005], [h / 2 - fh, h / 2 + 0.006], [depth - 0.004, depth + 0.007], { front: big ? R.flap : R.flapS, edge: R.pedge }, { cols: 3, inset: 0.002 });
    return S;
  };
  for (const s of [-1, 1]) pocket(s * 41, 0.712, 0.112, 0.118);                                              // on the skirt of the coat
  const CP = pocket(31, 1.022, 0.072, 0.074, { depth: 0.013, big: false, flap: 0 });                          // on her chest, open, with her notebook in it (the satchel's strap lies where its fellow would be)
  for (const s of [-1, 1]) pocket(s * 43, 0.826, 0.058, 0.044, { depth: 0.011, big: false, flap: 0.5 });       // ticket pockets
  pocket(176, 0.735, 0.150, 0.100, { depth: 0.016 });                                                          // the game pocket on the back
  slab(pk, CP, [-0.026, 0.010], [0.012, 0.058], [0.001, 0.009], { front: R.notebook, edge: R.pages }, { cols: 1 });
  pk.tube([CP(0.021, 0.0, 0.006), CP(0.021, 0.068, 0.006)], 0.0042, 5, R.pencil); pk.tube([CP(0.021, 0.068, 0.006), CP(0.021, 0.078, 0.006)], [0.0042, 0.0008], 5, R.pencilTip);
  pk.tube([CP(0.030, 0.0, 0.005), CP(0.030, 0.052, 0.005)], 0.0038, 5, R.pen);
  for (const y of [1.088, 1.022, 0.962, 0.815, 0.735, 0.655]) button(pk, R.button, y, 2.5);
  // the measuring tape round her neck
  const tp = m.part('tape', { crease: 30, bind: torsoBind }), bump = (d) => Math.exp(-((d / 0.032) ** 2));
  for (const [s, yEnd] of [[-1, 0.79], [1, 0.86]]) {
    const pts = [], x = s * 0.058, ySt = strapY(degOfX(x, 1.0)); for (let i = 0; i <= 12; i++) { const y = 1.150 + (yEnd - 1.150) * i / 12, o = onTorso(y, degOfX(x, y), 0.0038 + 0.0085 * Math.max(bump(y - BY), bump(y - ySt))); pts.push({ p: o.p, n: o.n }); }
    let L = 0; const acc = [0]; for (let i = 1; i < pts.length; i++) { L += len(sub(pts[i].p, pts[i - 1].p)); acc.push(L); }
    ribbon(tp, pts, 0.023, R.tape, { thick: 0.003, v: acc.map((a) => (L - a) / 0.37) });
  }
  // satchel on the back of her right hip, its strap over her left shoulder
  const SS = surf(SATCHEL.deg, SATCHEL.y), sat = m.part('satchel', { crease: 45, bind: rigid(torsoBind, SS(0, 0.03, 0.03)) });
  slab(sat, SS, [-0.095, 0.095], [-0.078, 0.070], [0.0, 0.068], { front: R.satchel, edge: R.satchelSide }, { cols: 3, rows: 2, inset: 0.010 });
  slab(sat, SS, [-0.099, 0.099], [-0.022, 0.076], [0.064, 0.077], { front: R.satchelFlap, edge: R.satchelSide }, { cols: 3, inset: 0.004 });
  slab(sat, SS, [-0.014, 0.014], [-0.050, 0.030], [0.074, 0.082], { front: R.satchelStrap, edge: R.satchelSide }, { cols: 1, rows: 2 });
  slab(sat, SS, [-0.020, 0.020], [-0.030, -0.004], [0.080, 0.087], { front: R.buckleS, edge: R.brass }, { cols: 1, inset: 0.002 });
  sat.tube([SS(-0.040, 0.050, 0.034), SS(-0.075, 0.165, 0.050)], 0.0135, 7, R.paper);
  const st = m.part('strap', { crease: 40, bind: torsoBind }), sp = [];
  for (let i = 0; i <= 30; i++) { const deg = SATCHEL.deg + 360 * i / 30, o = onTorso(strapY(deg), deg, 0.0085); sp.push({ p: o.p, n: o.n }); }
  ribbon(st, sp, 0.036, R.strap, { thick: 0.0075, ends: false });
  // a magnifying glass hanging from her belt, on her left
  const MB = onTorso(BY - 0.022, 68, 0.012), mg = m.part('magnifier', { crease: 45, bind: rigid(torsoBind, MB.p) }), mo = (dy) => onTorso(BY - 0.022 + dy, 68, 0.016);
  mg.tube([MB.p, mo(-0.022).p], 0.0030, 4, R.cord); mg.tube([mo(-0.020).p, mo(-0.082).p], [0.0075, 0.0085], 6, R.handle);
  const mc = mo(-0.118); mg.torus(0.034, 0.0062, 14, 5, R.brass, { xf: aim(mc.p, mc.n) }); disc(mg, R.lens, add(mc.p, mul(mc.n, 0.002)), mc.n, 0.033);
};

// =====================================================================================================================
// arms and legs
const SIDE = (s) => (s > 0 ? 'Left' : 'Right');
const arm = (m, R, s) => {
  const sd = SIDE(s), S = J[sd + 'Arm'], E = J[sd + 'ForeArm'], Wr = J[sd + 'Hand'], du = norm(sub(E, S)), dl = norm(sub(Wr, E));
  const bind = chain(torsoBind, [[sd + 'Arm', S], [sd + 'ForeArm', E], [sd + 'Hand', Wr]], [0.07, 0.07, 0.04]), U = (t) => add(S, mul(du, t)), Lw = (t) => add(E, mul(dl, t));
  const sl = m.part('sleeve' + sd, { crease: 60, bind });
  limb(sl, [{ c: add(U(-0.036), [0, -0.016, 0]), rx: 0.032 }, { c: add(U(-0.018), [0, -0.009, 0]), rx: 0.053 }, { c: add(U(0.008), [0, -0.002, 0]), rx: 0.064 }, { c: U(0.06), rx: 0.067 }, { c: U(0.12), rx: 0.065 }, { c: E, rx: 0.064 }, { c: Lw(0.028), rx: 0.063 }], 10, R.sleeve, { cap: [true, false] });
  const ro = m.part('roll' + sd, { crease: 60, bind });                                              // the sleeve rolled up, its checked lining outward
  limb(ro, [{ c: Lw(0.014), rx: 0.060, along: dl }, { c: Lw(0.018), rx: 0.073, along: dl }, { c: Lw(0.040), rx: 0.077, along: dl }, { c: Lw(0.066), rx: 0.073, along: dl }, { c: Lw(0.072), rx: 0.050, along: dl }], 10, R.roll);
  const fa = m.part('arm' + sd, { crease: 70, bind });
  limb(fa, [{ c: Lw(0.050), rx: 0.050 }, { c: Lw(0.10), rx: 0.046 }, { c: Lw(0.155), rx: 0.039 }, { c: add(Wr, mul(dl, 0.004)), rx: 0.035, rz: 0.033 }], 8, R.arm);
  // the hand: a mitten, flat, its thumb forward
  const F = norm(add([0, 0, 1], mul(dl, -dl[2]))), X = cross(F, dl), Hd = (t, f = 0, x = 0) => add(add(add(Wr, mul(dl, t)), mul(F, f)), mul(X, x));
  const hd = m.part('hand' + sd, { crease: 70, bind });
  limb(hd, [{ c: Hd(-0.004), rx: 0.027, rz: 0.034, along: dl, front: F }, { c: Hd(0.024, 0.002), rx: 0.029, rz: 0.046, along: dl, front: F }, { c: Hd(0.056, 0.003), rx: 0.028, rz: 0.051, along: dl, front: F }, { c: Hd(0.086, 0.002, s * -0.005), rx: 0.024, rz: 0.046, along: dl, front: F },
    { c: Hd(0.106, 0.0, s * -0.011), rx: 0.016, rz: 0.034, along: dl, front: F }], 10, R.hand, { pow: 2.6, cap: [false, Hd(0.115, 0.0, s * -0.014)] });
  const td = norm(add(mul(dl, 0.62), mul(F, 0.78))), T0 = Hd(0.024, 0.034, s * -0.004);
  limb(hd, [{ c: T0, rx: 0.017 }, { c: add(T0, mul(td, 0.025)), rx: 0.0165 }, { c: add(T0, mul(td, 0.045)), rx: 0.0135 }], 6, R.thumb, { cap: [true, add(T0, mul(td, 0.055))] });
  // a pocket on her left sleeve
  if (s > 0) {
    const o = norm(cross(du, cross([0, 1, 0.25], du))), xd = cross(mul(du, -1), o), c0 = U(0.085), Sa = (x, y, z) => { const a = x / 0.060; return add(add(c0, mul(du, -y)), mul(add(mul(o, Math.cos(a)), mul(xd, Math.sin(a))), 0.0655 + z)); };
    slab(sl, Sa, [-0.027, 0.027], [-0.030, 0.026], [-0.003, 0.010], { front: R.pocketS, edge: R.pedge }, { cols: 2, inset: 0.003 }); slab(sl, Sa, [-0.030, 0.030], [0.004, 0.030], [0.008, 0.015], { front: R.flapS, edge: R.pedge }, { cols: 2, inset: 0.002 });
  }
};
const leg = (m, R, s) => {
  const sd = SIDE(s), H = J[sd + 'UpLeg'], K = J[sd + 'Leg'], A = J[sd + 'Foot'], T = J[sd + 'ToeBase'];
  const bind = chain('Hips', [[sd + 'UpLeg', H], [sd + 'Leg', K], [sd + 'Foot', A], [sd + 'ToeBase', T]], [0.10, 0.08, 0.05, 0.04]);
  const zs = (y) => H[2] + (A[2] - H[2]) * (H[1] - y) / (H[1] - A[1]), kz = zs(K[1]) + 0.45 * (K[2] - zs(K[1]));                    // her knee, not as far forward as the joint
  const path = curve([[0.13, A[0], A[2] + 0.004], [K[1], K[0], kz], [0.76, H[0] + s * 0.004, H[2] + 0.004]]), P = (y) => { const [x, z] = path(y); return [x, y, z]; };
  const tr = m.part('trousers' + sd, { crease: 60, bind });
  limb(tr, [{ c: P(0.75), rx: 0.100 }, { c: P(0.66), rx: 0.100 }, { c: P(0.56), rx: 0.098 }, { c: P(0.485), rx: 0.099 }, { c: P(0.445), rx: 0.090 }, { c: P(0.415), rx: 0.072 }], 10, R.trousers);
  const bt = m.part('boot' + sd, { crease: 55, bind });
  limb(bt, [{ c: P(0.390), rx: 0.086 }, { c: P(0.396), rx: 0.095 }, { c: P(0.420), rx: 0.098 }, { c: P(0.438), rx: 0.094 }, { c: P(0.430), rx: 0.080 }].map((q) => ({ ...q, along: [0, 1, 0] })), 10, R.cuff);      // the turned-down top
  limb(bt, [{ c: [A[0], 0.040, A[2] + 0.002], rx: 0.066 }, { c: P(0.15), rx: 0.070 }, { c: P(0.24), rx: 0.075 }, { c: P(0.33), rx: 0.081 }, { c: P(0.405), rx: 0.087 }].map((q) => ({ ...q, along: [0, 1, 0] })), 10, R.shaft, { v: [-0.12, 0.2, 0.48, 0.76, 1] });
  // the foot: heel to toe along the way the foot points
  const fd = norm([T[0] - A[0], 0, T[2] - A[2]]), A0 = [A[0], 0, A[2]], Ft = (t, y) => add(add(A0, mul(fd, t)), [0, y, 0]), up = [0, 1, 0];
  limb(bt, [[-0.080, 0.058, 0.040, 0.048, 0.038], [-0.060, 0.058, 0.059, 0.074, 0.042], [0.0, 0.056, 0.069, 0.084, 0.042], [0.064, 0.054, 0.074, 0.068, 0.042], [0.122, 0.052, 0.079, 0.059, 0.042], [0.172, 0.050, 0.071, 0.051, 0.040], [0.203, 0.047, 0.050, 0.038, 0.035]]
    .map(([t, y, rx, ru, rd]) => ({ c: Ft(t, y), rx, rz: [ru, rd], along: fd, front: up })), 10, R.foot, { pow: 2.3, cap: [Ft(-0.089, 0.058), Ft(0.216, 0.045)] });
  limb(bt, [[-0.091, 0.044], [-0.066, 0.062], [0.0, 0.074], [0.064, 0.080], [0.122, 0.085], [0.174, 0.077], [0.216, 0.051]].map(([t, rx]) => ({ c: Ft(t, 0.0175), rx, rz: [0.0085, 0.0175], along: fd, front: up, pow: 3.2 })), 10, R.sole, { cap: [Ft(-0.098, 0.012), Ft(0.227, 0.012)] });
};

// =====================================================================================================================
const m = new Model('calloway');
m.material('main', { kind: 'texture', roughness: 0.82 });
if (!NORIG) m.skeleton(RIG);
const skin = (o = {}) => ({ mat: 'skin', colour: C.skin, soft: 0, ...o }), wax = (o = {}) => ({ mat: 'waxed', colour: C.coat, soft: 0, ...o }), hide = (o = {}) => ({ mat: 'leather', colour: C.leather, soft: 0, ...o });
const hairP = (o = {}) => ({ mat: 'hair', colour: C.hair, sheen: C.hairLight, soft: 0, ...o }), flat = (colour, o = {}) => ({ mat: 'flat', colour, var: 0.08, ...o });
const R = pack(...ATLAS, {
  // head
  face: [576, 576, { mat: 'face', soft: 0, colour: C.skin, blush: C.blush, hair: C.hair, cy: HC[1], ...FACE }],
  headskin: [384, 176, skin({ ys: [HC[1] + HR[1] * Math.sin(-78 * D), HC[1] + HR[1] * Math.sin(84 * D)] })], nose: [72, 72, skin({ tip: C.blush, var: 0 })], ear: [64, 64, skin({ ao: { bottom: 0.15 } })], neck: [192, 72, skin({ ao: { top: 0.5, bottom: 0.3 } })],
  hair: [704, 256, hairP()], bun: [256, 160, hairP({ along: 'x', locks: 5 })], lock: [128, 224, hairP({ band: 0.5, locks: 3 })],
  brim: [960, 416, { mat: 'straw', colour: C.straw, coils: 15, under: 0.45, soft: 0 }], crown: [704, 192, { mat: 'straw', colour: C.straw, coils: 9, soft: 0 }], band: [512, 48, flat(C.band, { var: 0.1 })], bow: [64, 64, flat(C.band, { var: 0.1, edge: 0.5 })],
  cord: [16, 128, flat('#8A6A4F', { var: 0.1 })], bead: [48, 48, flat(C.band)], brass: [128, 48, { mat: 'brass', patina: 0.1, verdigris: 0 }],
  pencil: [32, 160, flat('#E7B43A', { var: 0.06 })], pencilTip: [32, 32, flat('#3A2F2A', { var: 0.05 })], pen: [32, 96, flat('#B5533C', { var: 0.06 })], leaf: [64, 128, { mat: 'blade', n: 1 }], stem: [16, 96, flat('#6F8F4E')], rush: [48, 96, flat('#5E3F2A', { var: 0.16, ao: { top: 0.3, bottom: 0.3 } })],
  // coat and what is on it
  coat: [1152, 608, wax({ tile_x: true, k: 1.5, cinch: [vOfY(BY), 0.05], hem: 0.04, seams: [[0.25, 0, 0.25, vOfY(1.10)], [0.75, 0, 0.75, vOfY(1.10), -1], [0.514, 0, 0.514, vOfY(1.14)], [0.002, vOfY(0.607), 0.998, vOfY(0.607)], [0.002, vOfY(1.088), 0.24, vOfY(1.088)], [0.76, vOfY(1.088), 0.998, vOfY(1.088)]] })],
  lining: [64, 64, flat(C.lining)], collar: [512, 96, flat(C.collar, { var: 0.10, grain: 0.14, along: 'y', edge: 0.3 })],
  scarf: [512, 96, { mat: 'dots', colour: C.scarf, tile_x: true, soft: 0 }], knot: [96, 96, { mat: 'dots', colour: C.scarf, soft: 0 }], tail: [96, 128, { mat: 'dots', colour: C.scarf, soft: 0, ao: { bottom: 0.3 } }],
  belt: [768, 48, hide({ tile_x: true, stitch: 5, sides: 'tb' })], buckle: [96, 88, { mat: 'buckle', colour: C.leather, soft: 0 }], buckleS: [64, 48, { mat: 'buckle', colour: '#6E4630', soft: 0 }],
  pocket: [208, 216, wax({ stitched: 8, pleat: true, k: 1.4, ao: { top: 0.35 } })], flap: [224, 96, wax({ stitched: 7, k: 1.4, sides: 'blr', snap: [0.5, 0.36, 9] })], pedge: [96, 32, wax({ light: 0.82 })],
  pocketS: [144, 152, wax({ stitched: 7, k: 1.3, ao: { top: 0.3 } })], flapS: [160, 72, wax({ stitched: 6, k: 1.3, sides: 'blr', snap: [0.5, 0.38, 7] })], button: [48, 48, { mat: 'brass', patina: 0.25, verdigris: 0, top: 0.5 }],
  notebook: [80, 96, flat('#B5533C', { var: 0.1, edge: 0.4 })], pages: [48, 24, flat('#EFE6CC')],
  tape: [44, 768, { mat: 'tape', colour: C.tape, soft: 0 }],
  satchel: [352, 288, hide({ colour: '#9A6A44', stitch: 8, k: 1.4, ao: { top: 0.5 } })], satchelFlap: [352, 192, hide({ colour: '#9A6A44', stitch: 8, k: 1.4, sides: 'blr' })], satchelSide: [192, 64, hide({ colour: '#7C5236' })], satchelStrap: [48, 144, hide({ colour: '#6E4630', stitch: 5, sides: 'lr' })],
  paper: [64, 128, flat('#EFE6CC', { var: 0.05, ao: { bottom: 0.3 } })], strap: [48, 1024, hide({ stitch: 6, sides: 'lr', k: 1.2 })], lens: [96, 96, { mat: 'lens', soft: 0 }], handle: [32, 96, flat('#6A4B37', { grain: 0.1 })],
  // arms and legs
  sleeve: [352, 224, wax({ tile_x: true, k: 1.3, ao: { top: 0.3 } })], roll: [352, 80, { mat: 'plaid', colour: C.roll, soft: 0, ao: { top: 0.25, bottom: 0.2 } }], arm: [224, 144, skin({ tile_x: true, ao: { bottom: 0.3 } })],
  hand: [256, 160, { mat: 'hand', colour: C.skin, tip: C.blush, soft: 0 }], thumb: [64, 64, skin({ tip: C.blush, tipfrom: 0.5 })],
  trousers: [352, 288, flat(C.trousers, { var: 0.08, grain: 0.05, along: 'y', tile_x: true, ao: { top: 0.4, bottom: 0.3 } })],
  shaft: [416, 352, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.5, k: 1.4, laces: { u: 0.5, v0: 0.06, v1: 0.90, n: 7, w: 0.14 } }], cuff: [416, 56, { mat: 'leather', colour: '#6E4E3A', soft: 0, tile_x: true }],
  foot: [416, 288, { mat: 'leather', colour: C.boot, soft: 0, tile_x: true, worn: 0.6, k: 1.4, toecap: 0.74, laces: { u: 0.5, v0: 0.30, v1: 0.56, n: 3, w: 0.15 } }], sole: [320, 40, flat('#33261F', { var: 0.1 })],
}, 10);
if (want('head')) head(m, R);
if (want('body')) body(m, R);
if (want('limbs')) for (const s of [-1, 1]) { arm(m, R, s); leg(m, R, s); }
await emit(m, R, ATLAS, args, { size: 1024 });
