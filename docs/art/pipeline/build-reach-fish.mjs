// build-reach-fish.mjs : the ten fish of Saltbone Reach, built in code (no generation job), on the Fen fish's kit (fish.mjs).
// Usage: node build-reach-fish.mjs <fish> <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]   (FISHB=build-reach-fish.mjs make-fish.sh <fish> does all of it)
// Every fish is 1 m from nose (+Z) to tail (-Z) with the middle of its bounds at the origin, one material `main`;
// what glows after dark is painted into the emissive map. The game scales each to its species' length. Cold-water
// fish: steel, pewter, bone, with one note of colour each.
import { cli, rad, add, sub, mul, norm, cross, dot, rng } from './kit.mjs';
import { buildFish, mirrored, aim } from './fish.mjs';

// ---- pieces that more than one fish carries
/** Barbels, both sides: each starts on the skin at (s, a degrees) and follows `path` (offsets from there, for the right side). */
const whiskers = (bits, r, B, list) => mirrored(bits, (p) => { for (const { s, a, path, r0 = 0.007 } of list) { const o = B.pt(s, rad(a)); p.tube(path.map((d) => add(o, d)), path.map((_, i) => r0 * (1 - 0.75 * i / (path.length - 1))), 4, r); } });
/** One barbel on the middle line under the chin, from (s) along `path`; returns where it ends and which way it goes. */
const chinBarbel = (bits, r, B, s, path, r0 = 0.006, sides = 4) => {
  const o = B.pt(s, rad(-90)), pts = path.map((d) => add(o, d));
  bits.tube(pts, pts.map((_, i) => r0 * (1 - 0.6 * i / (pts.length - 1))), sides, r);
  return { end: pts[pts.length - 1], dir: norm(sub(pts[pts.length - 1], pts[pts.length - 2])) };
};
/** A bare spine from `base` to `tip`, bending through `mid` (if given): a thin three-sided tube coming to a point. */
const spine = (part, r, base, tip, r0 = 0.0035, mid = null) => part.tube(mid ? [base, mid, tip] : [base, tip], mid ? [r0, r0 * 0.6, r0 * 0.12] : [r0, r0 * 0.12], 3, r, { open: true });
/** An eye on the right side only (a flatfish has both of its eyes on one side): eyeDome without the mirror. */
const eyeOne = (part, r, B, { s, a, size = 0.045, bulge = 0.6, look = 0.4, toward = [1, 0.15, 0.3], sides = 10, sink = 0.3 }) => {
  const th = rad(a), P0 = B.pt(s, th), n = B.normal(s, th), d = norm(add(mul(n, 1 - look), mul(norm(toward), look)));
  const eu = norm(cross([0, 1, 0], d)), ev = cross(d, eu), C0 = sub(P0, mul(d, sink * bulge * size)), rings = [[1, 0], [0.8, 0.6], [0.45, 0.893], [0, 1]];
  const V = (k, j) => { const [rho, h] = rings[k], ang = 2 * Math.PI * (j % sides) / sides; return [add(C0, add(add(mul(eu, rho * size * Math.cos(ang)), mul(ev, rho * size * Math.sin(ang))), mul(d, h * bulge * size))), r.at(0.5 + 0.48 * rho * Math.cos(ang), 0.5 + 0.48 * rho * Math.sin(ang))]; };
  for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < sides; j++) { if (rings[k + 1][0] === 0) part.tri(V(k, j), V(k, j + 1), V(k + 1, 0)); else part.quad(V(k, j), V(k, j + 1), V(k + 1, j + 1), V(k + 1, j)); }
};
/** A barnacle on the skin at (s, a degrees), on the right side or (left) the left: a little cone with a crater. */
const barnacle = (part, r, B, s, a, size, left = false) => {
  const th = rad(a), P = B.pt(s, th), n = B.normal(s, th), f = left ? (q) => [-q[0], q[1], q[2]] : (q) => q;
  const xf = aim(sub(P, mul(n, 0.15 * size)), n, [0, 0, 1]), keep = part.xf; part.xf = (q) => f(xf(q));
  part.lathe([[size, -0.003], [0.62 * size, 0.62 * size], [0.3 * size, 0.55 * size], [0, 0.3 * size]], 5, r, { shade: (i) => [0.8, 1, 0.9, 0.55][i] });
  part.xf = keep;
};
/** Every point of the model turned about Z by `deg` (a flatfish lies on its side). */
const turnZ = (m, deg) => {                          // and centre it across, which fit() leaves alone (a fish is otherwise its own mirror image)
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), ks = []; for (const p of m.parts) for (const t of p.tris) for (const k of t) ks.push(k);
  for (const k of ks) k.p = [c * k.p[0] - s * k.p[1], s * k.p[0] + c * k.p[1], k.p[2]];
  const xs = ks.map((k) => k.p[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2; for (const k of ks) k.p = [k.p[0] - mid, k.p[1], k.p[2]];
};
/** Lines on the skin patch for `marks`: a zigzag from (u, v) down and back in `n` legs. */
const zigzag = (u, v, n, du, dv, kick, rnd) => { const pts = [[u, v]]; for (let k = 1; k <= n; k++) pts.push([u + du * k + (k % 2 ? kick : -kick * 0.3) * (0.7 + 0.6 * rnd()), v - dv * k * (0.85 + 0.3 * rnd())]); return pts; };

const FIN = (seed, o) => ({ mat: 'fin', seed, soft: 0, ...o });
const SIDE = [832, 368];
const skin = (B, o, size = SIDE) => [...size, { mat: 'fishskin', soft: 0, ratio: B.ratio(...size), ...o }];
const eyeAt = (B, e) => [...B.uv(e.s, e.a), e.size / B.L];

const FISH = {
  // Bonefin Herring, 0.30 m: a slim silver herring whose fins are bare white spines with no web, like little combs.
  'bonefin-herring': (() => { const E = { s: 0.1, a: 16, size: 0.034, bulge: 0.65, look: 0.45 }; return {
    len: 0.80, pow: 1.12, rings: 20, around: 6, roughness: 0.4, mouth: { tilt: 30, tiltReach: 0.08 },
    body: [[0, 0.02, -0.024, 0.012], [0.04, 0.05, -0.056, 0.024], [0.14, 0.085, -0.095, 0.038], [0.34, 0.098, -0.106, 0.043], [0.6, 0.082, -0.084, 0.034], [0.85, 0.046, -0.044, 0.019], [1, 0.03, -0.028, 0.01]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#3B5F74', flank: '#B7C4CC', belly: '#F1F4F2', split: [0.36, 0.66], blend: [0.05, 0.07], vary: 0.06, sheen: 0.4,
        scales: { nu: 34, colour: '#8A9AA4', amount: 0.25, lit: 0.12, shadow: 0.08, u0: 0.18, v: [0.1, 2] }, line: { v: 0.6, colour: '#7F95A2', amount: 0.3, u: [0.2, 0.97] },
        gill: { u: 0.17, bend: 0.03, v: [0.16, 0.82], colour: '#5B7486', amount: 0.45 }, mouth: { to: 0.06, v: 0.58, v1: 0.48, w: 2.0, colour: '#3A4E5C' },
        eye: eyeAt(B, E), socket: { colour: '#5B7486', amount: 0.3, grow: 1.35 } }, [832, 260]),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#C9D3D9', pupil: 0.56, iris_r: 0.82 }],
      bone: [16, 96, { mat: 'flat', colour: '#EFEBE0', var: 0.08 }],
    }),
    eyes: [E], fins: [],
    more: ({ B, R, bits }) => {                      // every fin a comb of bare spines
      const comb = (from, to, n, h0, h1, belly) => { for (let k = 0; k < n; k++) { const t = k / (n - 1), s = from + (to - from) * t, c = B.at(s), y = belly ? c.bot + 0.004 : c.top - 0.004, h = (h0 + (h1 - h0) * t) * (belly ? -1 : 1), z = B.Z(s);
        spine(bits, R.bone, [0, y, z], [0, y + h, z - 0.55 * Math.abs(h)], 0.0042, [0, y + 0.55 * h, z - 0.22 * Math.abs(h)]); } };
      comb(0.40, 0.57, 9, 0.085, 0.035, false); comb(0.66, 0.80, 7, 0.055, 0.025, true);
      mirrored(bits, (p) => { for (const [s, a, len, fan, n, dir] of [[0.19, -30, 0.085, 28, 5, [0.55, -0.4, -0.73]], [0.50, -84, 0.05, 20, 4, [0.25, -0.7, -0.67]]]) {
        const P0 = B.pt(s, rad(a)), d = norm(dir), ac = norm(cross([1, 0, 0], d)), side = norm(cross(d, ac));
        for (let k = 0; k < n; k++) { const q = (k / (n - 1)) * 2 - 1, ph = rad(fan) * q, ray = add(mul(d, Math.cos(ph)), mul(side, Math.sin(ph))), L = len * (1 - 0.3 * q * q);
          spine(p, R.bone, add(P0, mul(side, 0.006 * q)), add(P0, mul(ray, L)), 0.0028, add(P0, add(mul(ray, 0.5 * L), mul(ac, 0.004)))); } } });
      const e = B.at(1), z0 = B.Z(1) + 0.02;
      for (let k = 0; k < 13; k++) { const q = (k / 12) * 2 - 1, ph = rad(32) * q, L = 0.21 * (1 - 0.55 * (1 - Math.abs(q) ** 1.4)), y0 = e.cy + q * 0.9 * (q > 0 ? e.top - e.cy : e.cy - e.bot);
        spine(bits, R.bone, [0, y0, z0], [0, y0 + L * Math.sin(ph), z0 - L * Math.cos(ph)], 0.0042, [0, y0 + 0.5 * L * Math.sin(ph) + 0.004 * q, z0 - 0.5 * L * Math.cos(ph)]); }
    },
  }; })(),

  // Slate Pout, 0.34 m: blunt and sulky, slate grey with a paler belly, a pushed-out lower lip, one chin whisker.
  'slate-pout': (() => { const E = { s: 0.115, a: 34, size: 0.036, bulge: 0.6, look: 0.3, toward: [1, -0.1, 0.25] }; const F = { colour: '#5C636C', tip: '#7E8690', root: '#40464E', ray: '#353A40' }; return {
    len: 0.76, mid: 0.46, rings: 18, around: 8, mouth: { tilt: 20, tiltReach: 0.1 },
    body: [[0, 0.03, -0.06, 0.05], [0.05, 0.10, -0.12, 0.092], [0.15, 0.155, -0.16, 0.118], [0.32, 0.17, -0.162, 0.112], [0.55, 0.135, -0.125, 0.082], [0.8, 0.075, -0.068, 0.04], [1, 0.05, -0.042, 0.018]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#474D56', flank: '#6C747D', belly: '#C6C9C6', split: [0.3, 0.66], blend: [0.1, 0.12], vary: 0.12,
        mottle: [{ colour: '#383D44', amount: 0.35, cells: [4, 10], cut: [0.55, 0.75], v: [0.4, 2] }], line: { v: 0.62, colour: '#A7ADB2', amount: 0.45, u: [0.22, 0.97], arch: 0.05 },
        gill: { u: 0.25, bend: 0.035, v: [0.16, 0.8], colour: '#2E3238', amount: 0.55 }, mouth: { to: 0.075, v: 0.40, v1: 0.35, w: 2.4, colour: '#2A2E33', curl: -0.04 },
        blobs: [{ u: 0.112, v: 0.74, r: 0.034, squash: 0.45, colour: '#2E3238', amount: 0.55, soft: 0.45 }],
        eye: eyeAt(B, E), socket: { colour: '#2E3238', amount: 0.45, grow: 1.5 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#A88E5A', pupil: 0.55, iris_r: 0.8 }],
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 104, FIN(6, { ...F, rays: 7 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
      lip: [96, 32, { mat: 'flat', colour: '#6A6470', var: 0.14 }], whisker: [16, 64, { mat: 'flat', colour: '#8A9097', var: 0.15 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.43, h: 0.08, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', from: 0.47, to: 0.62, h: 0.07, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', from: 0.66, to: 0.82, h: 0.06, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.45, to: 0.62, h: 0.06, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.66, to: 0.82, h: 0.05, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'tail', rect: 'tail', len: 0.22, spread: 38, fork: -0.12, rays: 7, spike: 0.1 },
      { kind: 'side', rect: 'pec', s: 0.27, a: -28, len: 0.12, fan: 38, root: 0.045, dir: [0.7, -0.35, -0.62], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.17, a: -80, len: 0.08, fan: 24, root: 0.025, dir: [0.3, -0.75, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => {                      // the lower lip pushed out, and the one whisker under the chin
      mirrored(bits, (p) => { const pts = [-8, -35, -62, -90].map((d, i) => add(B.pt(0.012 + 0.012 * (3 - i) / 3 * (i < 3 ? 1 : 0), rad(d)), add(mul(B.normal(0.01, rad(d)), 0.006), [0, -0.004, 0.012 * i / 3])));
        p.tube(pts, [0.007, 0.011, 0.013, 0.014], 5, R.lip); });
      chinBarbel(bits, R.whisker, B, 0.07, [[0, 0, 0], [0, -0.03, -0.004], [0, -0.058, -0.02], [0, -0.078, -0.045]], 0.006);
    },
  }; })(),

  // Thrift Wrasse, 0.26 m: a stout little wrasse, grey-green with a scatter of thrift-pink spots and pink lips.
  'thrift-wrasse': (() => { const E = { s: 0.12, a: 30, size: 0.036, bulge: 0.65, look: 0.4 }; const F = { colour: '#5E7258', tip: '#93A486', root: '#3E4E3A', ray: '#2E3A2A' }; return {
    len: 0.76, mid: 0.5, rings: 18, around: 8, mouth: { tilt: 6 },
    body: [[0, 0.03, -0.035, 0.035], [0.05, 0.095, -0.085, 0.075], [0.16, 0.155, -0.135, 0.105], [0.38, 0.175, -0.15, 0.108], [0.62, 0.145, -0.12, 0.082], [0.86, 0.085, -0.07, 0.042], [1, 0.062, -0.05, 0.02]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#435640', flank: '#7A8C6E', belly: '#CDD2BC', split: [0.3, 0.66], blend: [0.1, 0.12],
        mottle: [{ colour: '#5A6E50', amount: 0.4, cells: [4, 8], cut: [0.55, 0.78] }], scales: { nu: 22, colour: '#34442F', amount: 0.3, lit: 0.12, shadow: 0.12, u0: 0.22, v: [0.12, 2] },
        spots: { colour: '#E0709E', n: 34, r: 0.015, u: [0.08, 0.95], v: [0.14, 0.95], amount: 0.9 }, gill: { u: 0.235, bend: 0.035, v: [0.16, 0.8], colour: '#2E3A2A', amount: 0.5 },
        lip: { to: 0.018, colour: '#EC86B2', amount: 0.8 }, mouth: { to: 0.05, v: 0.47, v1: 0.43, w: 2.2, colour: '#8A3A5A' },
        eye: eyeAt(B, E), socket: { colour: '#2E3A2A', amount: 0.4, grow: 1.45 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#B9A86A', pupil: 0.5, iris_r: 0.8 }],
      fin: [256, 104, FIN(5, { ...F, rays: 11, rim: { colour: '#D88AAE', w: 0.14, amount: 0.55 } })], tail: [224, 104, FIN(6, { ...F, rays: 7 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
      lips: [64, 32, { mat: 'flat', colour: '#E886B0', var: 0.12 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.24, to: 0.86, h: 0.085, rays: 11, spike: 0.32, sweep: 0.4, shape: [[0, 0.65], [0.3, 0.9], [0.75, 1], [1, 0.75]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.64, to: 0.86, h: 0.07, rays: 6, spike: 0.25, sweep: 0.45 },
      { kind: 'tail', rect: 'tail', len: 0.22, spread: 40, fork: -0.2, rays: 7, spike: 0.08 },
      { kind: 'side', rect: 'pec', s: 0.27, a: -10, len: 0.12, fan: 36, root: 0.045, dir: [0.75, -0.2, -0.62], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.36, a: -76, len: 0.08, fan: 26, root: 0.03, dir: [0.3, -0.75, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => mirrored(bits, (p) => {      // thick pink lips round the mouth
      for (const [a0, a1] of [[86, 8], [-8, -86]]) { const pts = [0, 0.5, 1].map((t) => { const a = a0 + (a1 - a0) * t, q = B.pt(0.008, rad(a)); return add(q, mul(B.normal(0.008, rad(a)), 0.004)); }); p.tube(pts, [0.005, 0.0075, 0.005], 5, R.lips); }
    }),
  }; })(),

  // Ribfish, 0.85 m: long and flat-sided, pale cream, with eleven dark curved bars down each side exactly like a ribcage; a small head.
  ribfish: (() => { const E = { s: 0.075, a: 24, size: 0.022, bulge: 0.6, look: 0.35 }; const F = { colour: '#D9CDAE', tip: '#F0E8D4', root: '#B8AA88', ray: '#8C7E62' }; return {
    len: 0.84, mid: 0.5, rings: 24, around: 8, mouth: { tilt: 8 },
    body: [[0, 0.016, -0.018, 0.016], [0.04, 0.038, -0.042, 0.026], [0.12, 0.07, -0.074, 0.033], [0.26, 0.104, -0.104, 0.038], [0.46, 0.114, -0.112, 0.038], [0.7, 0.09, -0.088, 0.031], [0.9, 0.05, -0.048, 0.018], [1, 0.032, -0.03, 0.011]],
    rects: (B) => { const ribs = []; for (let k = 0; k < 11; k++) { const t = k / 10, u0 = 0.2 + 0.52 * t, reach = 0.62 * Math.sin(Math.PI * (0.14 + 0.72 * t)) ** 0.6, pts = [];
        for (let i = 0; i <= 10; i++) { const q = i / 10; pts.push([u0 + 0.055 * Math.sin(q * Math.PI * 0.62) + 0.01 * q * q, 0.82 - reach * q]); } ribs.push(pts); }
      return {
      side: skin(B, { seed: 3, back: '#CDBF9C', flank: '#E7DDC4', belly: '#F4EFE1', split: [0.3, 0.7], blend: [0.12, 0.12], vary: 0.07, sheen: 0.2,
        marks: [{ lines: ribs, colour: '#3A322C', w: 5.5, amount: 0.92, halo: { colour: '#7C6E5C', w: 11, soft: 2.5, amount: 0.35 } },
          { lines: [[[0.16, 0.8], [0.4, 0.84], [0.65, 0.83], [0.9, 0.78], [0.99, 0.76]]], colour: '#4A4038', w: 4, amount: 0.7 }],
        gill: { u: 0.13, bend: 0.02, v: [0.2, 0.8], colour: '#8C7E62', amount: 0.45 }, mouth: { to: 0.04, v: 0.5, v1: 0.45, w: 1.8, colour: '#6A5E4A' },
        eye: eyeAt(B, E), socket: { colour: '#8C7E62', amount: 0.3, grow: 1.4 } }, [960, 300]),
      eye: [96, 96, { mat: 'eye', seed: 4, soft: 0, iris: '#B4483A', pupil: 0.5, iris_r: 0.8 }],
      fin: [320, 80, FIN(5, { ...F, rays: 16 })], tail: [200, 104, FIN(6, { ...F, rays: 7 })], pec: [128, 80, FIN(7, { ...F, rays: 4 })],
    }; },
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.92, h: 0.05, rays: 16, spike: 0.12, sweep: 0.6, sink: 0.006, thick: 0.008, shape: [[0, 0.4], [0.15, 1], [0.8, 0.8], [1, 0.4]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.38, to: 0.92, h: 0.045, rays: 14, spike: 0.12, sweep: 0.6, sink: 0.006, thick: 0.008, shape: [[0, 0.4], [0.15, 1], [0.8, 0.8], [1, 0.4]] },
      { kind: 'tail', rect: 'tail', len: 0.16, spread: 34, fork: 0.35, rays: 7, spike: 0.1, thick: 0.01 },
      { kind: 'side', rect: 'pec', s: 0.15, a: -22, len: 0.06, fan: 30, root: 0.02, dir: [0.6, -0.35, -0.72], rays: 4 },
    ],
  }; })(),

  // Kettle Cod, 0.75 m: a pot-bellied cod, iron black above with rust freckles, a mouth like a spout.
  'kettle-cod': (() => { const E = { s: 0.12, a: 40, size: 0.032, bulge: 0.65, look: 0.4 }; const F = { colour: '#2A2E33', tip: '#5A4A40', root: '#1A1D20', ray: '#121416' }; return {
    len: 0.76, mid: 0.36, rings: 18, around: 8, mouth: {},
    body: [[0, 0.035, -0.035, 0.04], [0.05, 0.11, -0.12, 0.1], [0.16, 0.16, -0.21, 0.15], [0.34, 0.17, -0.25, 0.165], [0.56, 0.14, -0.16, 0.11], [0.8, 0.08, -0.07, 0.05], [1, 0.05, -0.04, 0.02]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#1B1E21', flank: '#33383D', belly: '#8D8882', split: [0.34, 0.6], blend: [0.1, 0.1], vary: 0.12,
        mottle: [{ colour: '#45403C', amount: 0.35, cells: [3, 7], cut: [0.55, 0.8], v: [0.35, 2] }],
        spots: { colour: '#A6532A', n: 90, r: 0.0075, u: [0.03, 0.97], v: [0.42, 1.0], amount: 0.9 }, line: { v: 0.62, colour: '#8A8682', amount: 0.4, u: [0.22, 0.97], arch: 0.06 },
        gill: { u: 0.25, bend: 0.035, v: [0.18, 0.8], colour: '#0E1012', amount: 0.55 }, eye: eyeAt(B, E), socket: { colour: '#0E1012', amount: 0.45, grow: 1.45 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#C8893A', pupil: 0.5, iris_r: 0.8 }],
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 104, FIN(6, { ...F, rays: 8 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
      spout: [128, 64, { mat: 'fishskin', seed: 9, soft: 0, back: '#1E2124', flank: '#2E3236', belly: '#3A3E42', vary: 0.15, spots: { colour: '#A6532A', n: 14, r: 0.03, u: [0, 1], v: [0, 1], amount: 0.8 }, sheen: 0, tile_x: true }],
      throat: [48, 48, { mat: 'flat', colour: '#120E0E', var: 0.2 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.42, h: 0.09, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', from: 0.46, to: 0.62, h: 0.075, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', from: 0.66, to: 0.82, h: 0.065, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.48, to: 0.64, h: 0.06, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.68, to: 0.82, h: 0.055, rays: 6, spike: 0.12, sweep: 0.5 },
      { kind: 'tail', rect: 'tail', len: 0.22, spread: 40, fork: 0.0, rays: 8, spike: 0.1 },
      { kind: 'side', rect: 'pec', s: 0.27, a: -30, len: 0.13, fan: 38, root: 0.05, dir: [0.7, -0.35, -0.62], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.18, a: -84, len: 0.08, fan: 24, root: 0.03, dir: [0.3, -0.75, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => {                      // the spout: out of the mouth, forward and up, its end turned up with a lip
      const o = B.at(0), z0 = B.Z(0), c = o.cy;
      const pts = [[0, c, z0 - 0.02], [0, c + 0.004, z0 + 0.035], [0, c + 0.022, z0 + 0.08], [0, c + 0.055, z0 + 0.108]];
      bits.tube(pts, [0.034, 0.024, 0.018, 0.017], 8, R.spout, { open: true });
      const tip = pts[3], d = norm(sub(pts[3], pts[2])), keep = bits.xf; bits.xf = aim(tip, d, [0, 0, 1]);
      bits.lathe([[0.017, 0], [0.021, 0.006], [0.017, 0.01], [0.012, 0.004], [0, -0.012]], 8, R.spout, { shade: (i) => [1, 1, 0.9, 0.4, 0.2][i] });
      bits.lathe([[0.0119, 0.0041], [0, -0.0119]], 8, R.throat, { shade: () => 0.3 });
      bits.xf = keep;
    },
  }; })(),

  // Squall Mackerel, 0.55 m: a mackerel drawn in a hurry: steel blue, white zigzags along the back like rain on a window, a forked tail swept right back.
  'squall-mackerel': (() => { const E = { s: 0.09, a: 22, size: 0.026, bulge: 0.6, look: 0.4 }; const F = { colour: '#3E5A74', tip: '#8EA4B6', root: '#26384A', ray: '#1C2A38' };
    const rnd = rng(21), zz = []; for (let k = 0; k < 16; k++) { const u = 0.17 + 0.78 * k / 15 + 0.012 * (rnd() - 0.5); zz.push(zigzag(u, 0.99, 3 + Math.floor(rnd() * 3), 0.016, 0.085, 0.014, rnd)); } return {
    len: 0.74, pow: 1.05, rings: 22, around: 8, roughness: 0.45, mouth: { tilt: 8 },
    body: [[0, 0.015, -0.02, 0.014], [0.05, 0.055, -0.06, 0.045], [0.18, 0.1, -0.1, 0.07], [0.4, 0.11, -0.105, 0.074], [0.65, 0.085, -0.08, 0.055], [0.88, 0.035, -0.033, 0.022], [1, 0.02, -0.019, 0.016]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#24476A', flank: '#8AA0B2', belly: '#EEF2F2', split: [0.4, 0.6], blend: [0.05, 0.06], vary: 0.08, sheen: 0.35,
        marks: [{ lines: zz, colour: '#F2F6FA', w: 2.8, amount: 0.95 }], line: { v: 0.58, colour: '#5A7286', amount: 0.35, u: [0.2, 0.97], arch: 0.03 },
        gill: { u: 0.155, bend: 0.025, v: [0.2, 0.8], colour: '#1C2A38', amount: 0.5 }, mouth: { to: 0.05, v: 0.5, v1: 0.44, w: 2.0, colour: '#1C2A38' },
        eye: eyeAt(B, E), socket: { colour: '#1C2A38', amount: 0.4, grow: 1.4 } }, [832, 260]),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#D9D4B4', pupil: 0.56, iris_r: 0.82 }],
      fin: [176, 80, FIN(5, { ...F, rays: 6 })], tail: [256, 120, FIN(6, { ...F, rays: 9 })], pec: [128, 80, FIN(7, { ...F, rays: 4 })], let: [32, 32, FIN(8, { ...F, rays: 1 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.44, h: 0.075, rays: 6, spike: 0.2, sweep: 0.8, sink: 0.006, thick: 0.008 },
      { kind: 'ridge', rect: 'fin', from: 0.56, to: 0.64, h: 0.05, rays: 6, spike: 0.12, sweep: 0.8, sink: 0.006, thick: 0.008 },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.58, to: 0.66, h: 0.045, rays: 6, spike: 0.12, sweep: 0.8, sink: 0.006, thick: 0.008 },
      ...[0.70, 0.75, 0.80, 0.85, 0.90].flatMap((s) => [false, true].map((belly) => ({ kind: 'ridge', rect: 'let', belly, from: s, to: s + 0.03, h: 0.018, rays: 1, spike: 0, sweep: 1.0, sink: 0.004, thick: 0.004, ripple: 0 }))),
      { kind: 'tail', rect: 'tail', len: 0.32, spread: 26, fork: 0.88, rays: 9, spike: 0.06, thick: 0.01, rootK: 0.8 },
      { kind: 'side', rect: 'pec', s: 0.2, a: 4, len: 0.08, fan: 22, root: 0.022, dir: [0.45, -0.1, -0.88], rays: 4 },
      { kind: 'side', rect: 'pec', s: 0.32, a: -82, len: 0.04, fan: 18, root: 0.014, dir: [0.2, -0.6, -0.78], rays: 4 },
    ],
  }; })(),

  // Lantern Ling, 1.20 m: a long ling, dark umber, with one barbel under the chin that ends in a small warm light (emissive, amber).
  'lantern-ling': (() => { const E = { s: 0.07, a: 30, size: 0.02, bulge: 0.65, look: 0.4 }; const F = { colour: '#4A3626', tip: '#6A5440', root: '#2E2218', ray: '#20180F', rim: { colour: '#D8CBB4', w: 0.12, amount: 0.75 } }; return {
    len: 0.9, rings: 28, around: 6, glow: true, glowSize: [256, 128], mouth: { tilt: -8, tiltReach: 0.07 },
    body: [[0, 0.025, -0.03, 0.03], [0.04, 0.05, -0.055, 0.045], [0.12, 0.068, -0.07, 0.052], [0.3, 0.07, -0.07, 0.048], [0.6, 0.06, -0.058, 0.038], [0.85, 0.04, -0.038, 0.022], [1, 0.025, -0.022, 0.01]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#33251A', flank: '#56402E', belly: '#B29C82', split: [0.28, 0.6], blend: [0.08, 0.12], vary: 0.12,
        mottle: [{ colour: '#7A6048', amount: 0.4, cells: [5, 22], cut: [0.6, 0.8], v: [0.35, 2] }], line: { v: 0.6, colour: '#A08A70', amount: 0.4, u: [0.1, 0.97], arch: 0.02 },
        gill: { u: 0.105, bend: 0.012, v: [0.2, 0.8], colour: '#1E160E', amount: 0.55 }, mouth: { to: 0.06, v: 0.44, v1: 0.4, w: 2.0, colour: '#1E160E' },
        eye: eyeAt(B, E), socket: { colour: '#1E160E', amount: 0.45, grow: 1.45 } }, [960, 200]),
      eye: [96, 96, { mat: 'eye', seed: 4, soft: 0, iris: '#C9B98A', pupil: 0.52, iris_r: 0.8 }],
      fin: [480, 64, FIN(5, { ...F, rays: 30 })], fin1: [128, 64, FIN(8, { ...F, rays: 6 })], tail: [160, 96, FIN(6, { ...F, rays: 7 })], pec: [128, 80, FIN(7, { ...F, rays: 5 })],
      barbel: [16, 64, { mat: 'flat', colour: '#7A6048', var: 0.15 }],
      bulb: [48, 48, { mat: 'flat', colour: '#FFC062', var: 0.1, glow: { mat: 'flat', colour: '#FF9E2C', var: 0.08 } }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin1', from: 0.24, to: 0.33, h: 0.045, rays: 6, spike: 0.1, sweep: 0.5, sink: 0.006, thick: 0.008 },
      { kind: 'ridge', rect: 'fin', from: 0.37, to: 0.95, h: 0.04, rays: 30, spike: 0.06, sweep: 0.5, sink: 0.006, thick: 0.008, shape: [[0, 0.5], [0.1, 1], [0.9, 0.9], [1, 0.4]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.42, to: 0.95, h: 0.035, rays: 26, spike: 0.06, sweep: 0.5, sink: 0.006, thick: 0.008, shape: [[0, 0.5], [0.1, 1], [0.9, 0.9], [1, 0.4]] },
      { kind: 'tail', rect: 'tail', len: 0.11, spread: 44, fork: -0.35, rays: 7, spike: 0.06, thick: 0.01 },
      { kind: 'side', rect: 'pec', s: 0.13, a: -20, len: 0.07, fan: 34, root: 0.025, dir: [0.65, -0.35, -0.68], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.1, a: -84, len: 0.045, fan: 18, root: 0.012, dir: [0.2, -0.85, -0.5], rays: 4 },
    ],
    more: ({ B, R, bits }) => {                      // the barbel, and the light at its end
      const { end, dir } = chinBarbel(bits, R.barbel, B, 0.04, [[0, 0, 0], [0, -0.022, 0.008], [0, -0.045, 0.006], [0, -0.062, -0.006]], 0.0045, 4);
      const keep = bits.xf; bits.xf = aim(add(end, mul(dir, -0.004)), dir, [0, 0, 1]);
      bits.lathe([[0, -0.002], [0.011, 0.005], [0.016, 0.016], [0.011, 0.027], [0, 0.031]], 8, R.bulb);
      bits.xf = keep;
    },
  }; })(),

  // Thunderback, 1.30 m: a great halibut seen from above: slate, with one jagged white fork of lightning across its back that glows faintly (emissive, pale blue-white). Both eyes on top.
  thunderback: (() => { const E1 = { s: 0.09, a: 38, size: 0.024, bulge: 0.8, look: 0.3, toward: [1, 0.3, 0.2] }, E2 = { s: 0.115, a: 8, size: 0.024, bulge: 0.8, look: 0.3, toward: [1, -0.1, 0.2] };
    const F = { colour: '#4A525A', tip: '#6A747C', root: '#363C42', ray: '#262B30' };
    const BOLT = [[[0.2, 0.86], [0.29, 0.7], [0.27, 0.64], [0.37, 0.5], [0.34, 0.44], [0.47, 0.3], [0.44, 0.24], [0.56, 0.12]], [[0.37, 0.5], [0.46, 0.53], [0.52, 0.47], [0.62, 0.52], [0.7, 0.45]]];
    const MK = { lines: BOLT, colour: '#F4F8FF', w: 4.5, amount: 0.95, halo: { colour: '#AFC8E8', w: 14, soft: 3, amount: 0.4, lit: 0.22 }, glow: '#CFE3FF', lit: 0.7 }; return {
    len: 0.82, mid: 0.5, rings: 20, around: 8, glow: true, glowSize: [512, 256], mouth: { tilt: 14 },
    body: [[0, 0.03, -0.035, 0.02], [0.05, 0.1, -0.095, 0.034], [0.15, 0.18, -0.165, 0.044], [0.36, 0.215, -0.2, 0.048], [0.6, 0.17, -0.16, 0.04], [0.85, 0.07, -0.066, 0.02], [1, 0.045, -0.042, 0.012]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#4A535C', flank: '#56606A', belly: '#4C555E', split: [0.25, 0.75], blend: [0.12, 0.12], vary: 0.14, sheen: 0.05, under: 0,
        mottle: [{ colour: '#3A4148', amount: 0.45, cells: [5, 10], cut: [0.55, 0.78] }, { colour: '#7A848C', amount: 0.3, cells: [9, 18], cut: [0.68, 0.85] }],
        line: { v: 0.5, colour: '#7E888F', amount: 0.4, u: [0.16, 0.97], arch: 0.12 }, marks: [MK],
        gill: { u: 0.2, bend: 0.05, v: [0.2, 0.8], colour: '#2A3036', amount: 0.5 }, mouth: { to: 0.09, v: 0.45, v1: 0.32, w: 2.4, colour: '#22282E', curl: -0.04 },
        glow: { mat: 'skinglow', seed: 3, soft: 0, ratio: B.ratio(...SIDE), marks: [MK] } }),
      eye: [96, 96, { mat: 'eye', seed: 4, soft: 0, iris: '#D8D2B8', pupil: 0.5, iris_r: 0.8 }],
      fin: [480, 64, FIN(5, { ...F, rays: 40 })], tail: [224, 104, FIN(6, { ...F, rays: 8 })], pec: [128, 80, FIN(7, { ...F, rays: 5 })],
    }),
    eyes: [],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.1, to: 0.9, h: 0.06, rays: 40, spike: 0.08, sweep: 0.35, sink: 0.006, thick: 0.008, shape: [[0, 0.3], [0.25, 0.8], [0.55, 1], [0.85, 0.75], [1, 0.3]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.26, to: 0.9, h: 0.055, rays: 34, spike: 0.08, sweep: 0.35, sink: 0.006, thick: 0.008, shape: [[0, 0.3], [0.25, 0.8], [0.55, 1], [0.85, 0.75], [1, 0.3]] },
      { kind: 'tail', rect: 'tail', len: 0.19, spread: 42, fork: 0.12, rays: 8, spike: 0.08, thick: 0.012 },
      { kind: 'side', rect: 'pec', s: 0.22, a: 0, len: 0.07, fan: 30, root: 0.03, dir: [0.4, -0.1, -0.9], rays: 5 },
    ],
    more: ({ m, B, R, bits }) => {                   // both eyes on the right side, then she lies on her left side: the right side up
      eyeOne(bits, R.eye, B, E1); eyeOne(bits, R.eye, B, E2);
      turnZ(m, 90);
    },
  }; })(),

  // Old Greyback, 1.70 m: a huge deep-bodied bass the colour of the swell, barnacles along the back, a notched tail, one old harpoon scar, a pale calm eye.
  'old-greyback': (() => { const E = { s: 0.105, a: 30, size: 0.026, bulge: 0.55, look: 0.35 }; const F = { colour: '#4C6470', tip: '#7E94A0', root: '#33454E', ray: '#26343C' };
    const SCAR = [{ lines: [[[0.43, 0.8], [0.455, 0.68], [0.47, 0.57], [0.5, 0.44]]], colour: '#D8D2C6', w: 7, amount: 0.9, halo: { colour: '#9EAAAA', w: 18, soft: 3, amount: 0.55 } },
      { lines: [0.47, 0.53, 0.59, 0.65, 0.71, 0.77].map((v, k) => { const u = 0.43 + (0.8 - v) * 0.19 + 0.008 * (k % 2); return [[u - 0.012, v - 0.008], [u + 0.012, v + 0.01]]; }), colour: '#BDB6AA', w: 2.4, amount: 0.8 }]; return {
    len: 0.76, mid: 0.48, rings: 20, around: 8, roughness: 0.6, mouth: { tilt: 12 },
    body: [[0, 0.04, -0.05, 0.045], [0.05, 0.12, -0.12, 0.09], [0.16, 0.2, -0.18, 0.13], [0.38, 0.235, -0.205, 0.14], [0.62, 0.19, -0.16, 0.11], [0.85, 0.1, -0.085, 0.055], [1, 0.07, -0.058, 0.026]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#3A505C', flank: '#6E858E', belly: '#C8D1CE', split: [0.3, 0.62], blend: [0.1, 0.12], vary: 0.14,
        mottle: [{ colour: '#5A7A86', amount: 0.4, cells: [3, 6], cut: [0.5, 0.75], v: [0.4, 2] }, { colour: '#2E414A', amount: 0.35, cells: [6, 14], cut: [0.62, 0.8], v: [0.55, 2] }],
        scales: { nu: 24, colour: '#27363E', amount: 0.35, lit: 0.12, shadow: 0.14, u0: 0.24, v: [0.1, 2] }, line: { v: 0.66, colour: '#9EB0B6', amount: 0.4, u: [0.24, 0.97], arch: 0.06 },
        marks: SCAR, gill: { u: 0.25, bend: 0.04, v: [0.16, 0.8], colour: '#1E2A30', amount: 0.55, w: 2.8 }, mouth: { to: 0.12, v: 0.45, v1: 0.38, w: 2.8, colour: '#1E2A30', curl: -0.03 },
        eye: eyeAt(B, E), socket: { colour: '#1E2A30', amount: 0.4, grow: 1.5 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#D4DEDC', pupil: 0.36, iris_r: 0.8, white: '#E8ECE6' }],
      fin: [256, 104, FIN(5, { ...F, rays: 10 })], fin2: [224, 104, FIN(8, { ...F, rays: 8 })], tail: [256, 120, FIN(6, { ...F, rays: 9 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
      barnacle: [64, 48, { mat: 'flat', colour: '#C6BEA8', var: 0.22 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.50, h: 0.13, rays: 10, spike: 0.42, sweep: 0.45 },
      { kind: 'ridge', rect: 'fin2', from: 0.53, to: 0.72, h: 0.1, rays: 8, spike: 0.12, sweep: 0.5, shape: [[0, 0.8], [0.3, 1], [1, 0.5]] },
      { kind: 'ridge', rect: 'fin2', belly: true, from: 0.66, to: 0.82, h: 0.08, rays: 8, spike: 0.2, sweep: 0.5 },
      { kind: 'tail', rect: 'tail', len: 0.26, spread: 40, fork: 0.22, rays: 9, spike: 0.1, shape: (t) => (1 - 0.22 * (1 - Math.abs(2 * t - 1) ** 1.4)) * (1 - 0.72 * Math.exp(-(((t - 0.74) / 0.085) ** 2))) },
      { kind: 'side', rect: 'pec', s: 0.27, a: -30, len: 0.14, fan: 38, root: 0.05, dir: [0.7, -0.35, -0.62], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.33, a: -80, len: 0.1, fan: 26, root: 0.035, dir: [0.3, -0.75, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => {                      // barnacles along the back, more on the left
      const rnd = rng(17);
      for (let k = 0; k < 30; k++) { const s = 0.2 + 0.5 * rnd(), a = 52 + 30 * rnd(), size = 0.008 + 0.009 * rnd(); barnacle(bits, R.barnacle, B, s, a, size, rnd() < 0.55); }
    },
  }; })(),

  // The Lull, 1.10 m: smooth, pale, almost round, its eyes shut and no mouth to speak of; a slow violet sheen. It looks asleep.
  'the-lull': (() => { const E = { s: 0.135, a: 20, size: 0.04, bulge: 0.42, look: 0.3, rect: 'lid' }; const F = { colour: '#E2DCEC', tip: '#C8B8E6', root: '#D6CEE4', ray: '#B4A2D4', ray_amount: 0.3, pleat: 0.05 }; return {
    len: 0.82, mid: 0.5, rings: 20, around: 10, glow: true, glowSize: [512, 256], roughness: 0.5, mouth: {},
    body: [[0, 0.06, -0.06, 0.06], [0.05, 0.17, -0.17, 0.13], [0.18, 0.28, -0.28, 0.18], [0.4, 0.31, -0.31, 0.19], [0.62, 0.26, -0.26, 0.16], [0.84, 0.14, -0.14, 0.08], [1, 0.07, -0.065, 0.03]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#D2CAE0', flank: '#ECE8F0', belly: '#F6F4F6', split: [0.3, 0.72], blend: [0.14, 0.14], vary: 0.04, sheen: 0.3, sheen_colour: '#B89CF0', under: 0.08,
        mottle: [{ colour: '#B49EDA', amount: 0.3, cells: [2, 4], cut: [0.45, 0.85] }], blobs: [{ u: 0.45, v: 0.6, r: 0.22, squash: 1, colour: '#C4AEE8', amount: 0.25, soft: 0.9 }],
        glow: { mat: 'skinglow', seed: 3, soft: 0, ratio: B.ratio(...SIDE), allover: { colour: '#9070E0', amount: 0.14 }, blobs: [{ u: 0.45, v: 0.62, r: 0.2, colour: '#A88CF0', amount: 0.18, soft: 0.9 }] } }),
      lid: [128, 128, { mat: 'lid', seed: 4, soft: 0, colour: '#E2DCEA', crease: '#5E4C86', w: 3.2 }],
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 120, FIN(6, { ...F, rays: 7 })], pec: [128, 96, FIN(7, { ...F, rays: 4 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.46, to: 0.76, h: 0.05, rays: 6, spike: 0.0, sweep: 0.6, shape: [[0, 0.3], [0.4, 1], [1, 0.3]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.5, to: 0.76, h: 0.045, rays: 6, spike: 0.0, sweep: 0.6, shape: [[0, 0.3], [0.4, 1], [1, 0.3]] },
      { kind: 'tail', rect: 'tail', len: 0.15, spread: 44, fork: -0.3, rays: 7, spike: 0.03 },
      { kind: 'side', rect: 'pec', s: 0.3, a: -18, len: 0.08, fan: 34, root: 0.035, dir: [0.7, -0.3, -0.65], rays: 4, spike: 0.03 },
    ],
  }; })(),
};

const [id, ...rest] = process.argv.slice(2);
if (!FISH[id]) { console.error('fish: ' + Object.keys(FISH).join(', ')); process.exit(1); }
await buildFish({ name: id, ...FISH[id] }, cli(rest));
