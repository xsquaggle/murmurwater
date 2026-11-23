// build-whaleboat-house.mjs : Captain Oake's house at Tryworks Landing, built in code (no generation job).
// Usage: node build-whaleboat-house.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// Low dry-stone walls of slate with an upturned whaleboat for a roof: five tarred clinker strakes a side, each standing
// proud of the one above it, the keel uppermost, the bow at the back (-Z) with its stem coming down past the wall, and
// the boat sawn off square at the front (+Z), where a cream plank gable fills her section over the stone. In that end:
// a red plank door on a slate step, a small window with four panes, a bench under it with a pot of thrift, and a row of
// four glass net floats hung on a line. A tin stove pipe with a cowl comes up through the planking on the +X side, and
// two ropes weighted with stones hold the boat down. 7.5 m from the stem to the sawn end, 3 m across the gunwales, the
// keel 3.2 m up; the bench and the step stand in front of that. Origin on the ground under the middle; walls, step and
// bench legs go 0.2 m into it. Materials `main` and `Glass` (the window, warm, and the floats, sea green; the model has
// a glow map of its own in which only the window is lit).
import { Model, pack, strip, cli, emit, within, rotY, move, compose, rad, rng, add, sub, mul, norm, lerp, len } from './kit.mjs';
import { curve, mirrored, quadToward, triToward, aim } from './fish.mjs';

const args = cli(), ATLAS = [1024, 1024], rnd = rng(31);
const N = 5, LAP = 0.045, KW = 0.07, KEEL = 0.2, INSET = 0.11, BAT = 0.09, DEEP = -0.2;        // strakes a side; how far a plank's edge stands proud; half the keel's width, its depth; the wall inside the gunwale, its batter, how far it goes into the ground
const ZC = 3.70, ZF = 3.62, ZT = -3.80, SHIFT = (-ZC - ZT) / 2;                                 // the sawn end, the face of the front wall, the stem's forward face; what centres her on the origin
// the boat's lines as she lies: z -> [half breadth at the gunwale, height of the gunwale, of the planking on the centre line, fullness of the section]
const ST = [ZC, 2.9, 2.0, 1.0, 0.0, -1.0, -1.9, -2.6, -3.1, -3.45];
const LINES = curve([[ZC, 1.36, 1.40, 2.92, 2.5], [2.9, 1.43, 1.40, 2.97, 2.5], [2.0, 1.46, 1.40, 3.00, 2.5], [1.0, 1.46, 1.40, 3.00, 2.5], [0.0, 1.42, 1.40, 3.00, 2.4],
  [-1.0, 1.30, 1.38, 2.98, 2.3], [-1.9, 1.08, 1.33, 2.93, 2.1], [-2.6, 0.80, 1.26, 2.80, 1.9], [-3.1, 0.52, 1.19, 2.55, 1.7], [-3.45, 0.28, 1.13, 2.20, 1.5]].reverse());
const RAB = curve([[0.9, -3.64], [1.15, -3.66], [1.55, -3.64], [1.95, -3.56], [2.2, -3.45]]);       // where the planking meets the stem: height -> z
// the keel and stem, from the sawn end round the bow to the stem head: [z, y] of its outer edge and of its inner edge
const K_OUT = [[ZC, 3.12], [2.9, 3.17], [2.0, 3.20], [1.0, 3.20], [0, 3.20], [-1.0, 3.18], [-1.9, 3.13], [-2.6, 3.00], [-3.1, 2.75], [-3.45, 2.40], [-3.66, 2.02], [-3.78, 1.60], [ZT, 1.20], [-3.76, 0.84]];
const K_IN = [[ZC, 2.88], [2.9, 2.93], [2.0, 2.96], [1.0, 2.96], [0, 2.96], [-1.0, 2.94], [-1.9, 2.89], [-2.6, 2.76], [-3.1, 2.51], [-3.45, 2.16], [-3.52, 1.98], [-3.60, 1.60], [-3.62, 1.20], [-3.60, 0.88]];

/** A section: N + 1 points P from the gunwale to the centre line at equal steps of girth, and the proud edge U of each plank's top. */
const withLaps = (P) => { const U = P.map((p, j) => { if (j === 0 || j === N) return p; const t = norm(sub(P[j + 1], P[j - 1])); return add(p, mul([t[1], -t[0], 0], LAP)); });
  const nr = P.map((p, j) => { const t = norm(sub(P[Math.min(N, j + 1)], P[Math.max(0, j - 1)])); return [t[1], -t[0], 0]; }); return { P, U, nr }; };
const ringAt = (z) => {
  const [B, yg, yk, n] = LINES(z), M = 96, at = (phi) => [B * Math.pow(Math.cos(phi), 2 / n), yg + (yk - yg) * Math.pow(Math.sin(phi), 2 / n), z];
  const fine = Array.from({ length: M + 1 }, (_, i) => at(Math.PI / 2 * i / M)), acc = [0]; for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + len(sub(fine[i], fine[i - 1])));
  const P = []; for (let j = 0; j <= N; j++) { const s = acc[M] * j / N; let i = 1; while (i < M && acc[i] < s) i++; P.push(lerp(fine[i - 1], fine[i], (s - acc[i - 1]) / (acc[i] - acc[i - 1]))); }
  return withLaps(P);
};
const STEM_RING = withLaps(Array.from({ length: N + 1 }, (_, j) => { const y = 1.08 + (2.02 - 1.08) * j / N; return [0.04, y, RAB(y)[0]]; }));
const RINGS = [...ST.map(ringAt), STEM_RING], NR = RINGS.length;
// which way is out, on plan, at each section's gunwale; and the wall under it
const OUT = RINGS.map((_, i) => { const a = RINGS[Math.max(0, i - 1)].P[0], b = RINGS[Math.min(NR - 1, i + 1)].P[0]; return norm([a[2] - b[2], 0, b[0] - a[0]]); });
const YW = (i) => RINGS[i].P[0][1] - 0.045;                                                        // the top of the wall: the underside of the rail
const WALL = RINGS.map((r, i) => { const p = r.P[0], o = OUT[i], k = i === 0 ? 0 : 1;
  const top = i === NR - 1 ? [0, YW(i), -3.50] : [Math.max(0.12, p[0] - o[0] * INSET), YW(i), i === 0 ? ZF : p[2] - o[2] * INSET];
  return { top, foot: [top[0] + o[0] * BAT * k, DEEP, top[2] + o[2] * BAT * k - (i === NR - 1 ? BAT : 0)] }; });
const XW = WALL[0].top[0], YF = YW(0);                                                             // the front wall: half its width, its height

const R = {
  hull: strip(0, 0, 1024, 330, { mat: 'tarred', strakes: N, ppm: 136, worn: 0.28, lichen: 0.2, moss: 0.15, soft: 0 }, 31),
  ledge: strip(0, 338, 1024, 352, { mat: 'wood', tone: 'grey', along: 'x', weather: 0.9, light: 0.92 }, 32),
  wall: strip(0, 360, 1024, 568, { mat: 'drystone', ppm: 132, lichen: 0.5, moss: 0.5, ao: { top: 0.3 } }, 33),
  keel: strip(0, 576, 1024, 612, { mat: 'aged', of: 'wood', tone: 'tar', along: 'x', weather: 0.6, algae: 0.12, lichen: 0.3, fade: 0.2, low: 0, droppings: 0.25 }, 34),
  rail: strip(0, 620, 1024, 648, { mat: 'aged', of: 'wood', tone: 'tar', along: 'x', weather: 0.7, algae: 0.3, lichen: 0.2, fade: 0.25, low: 0.6 }, 35),
  ...pack(1024, 368, {
    front: [336, 208, { mat: 'drystone', ppm: 132, lichen: 0.4, moss: 0.5 }],
    gable: [352, 216, { mat: 'wood', planks: 14, along: 'y', tone: 'cream', weather: 0.6, nails: 2, ao: { top: 0.35 } }],
    door: [112, 236, { mat: 'wood', planks: 4, along: 'y', tone: 'red', weather: 0.55, nails: 3, edge: 0.4, ao: { bottom: 0.3, top: 0.15 } }],
    trim: [220, 36, { mat: 'wood', tone: 'pale', along: 'x', weather: 0.7, edge: 0.3 }],
    winFrame: [220, 26, { mat: 'wood', tone: 'cream', along: 'x', weather: 0.4, edge: 0.4 }],
    winGlass: [72, 72, { mat: 'glass', hue: 'warm', soft: 0, glow: { mat: 'glass', hue: 'warm', soft: 0 } }],
    floatA: [160, 80, { mat: 'floatglass', colour: '#5FA892', net: 5, soft: 0, glow: { mat: 'flat', colour: '#000000', var: 0, soft: 0 } }],
    floatB: [160, 80, { mat: 'floatglass', colour: '#4E9C96', net: 6, soft: 0, glow: { mat: 'flat', colour: '#000000', var: 0, soft: 0 } }],
    bench: [220, 60, { mat: 'wood', planks: 2, along: 'x', tone: 'grey', weather: 0.5, nails: 2, edge: 0.3 }],
    tin: [96, 168, { mat: 'tin', tile_x: true }],
    rope: [128, 24, { mat: 'rope', pitch: 32 }],
    slab: [112, 96, { mat: 'flat', colour: '#6C727C', var: 0.16, grain: 0.25, along: 'x', edge: 0.35 }],
    stone: [96, 56, { mat: 'flat', colour: '#7B8089', var: 0.2, tile_x: true }],
    iron: [48, 48, { mat: 'iron', rust: 0.5 }],
    cut: [64, 28, { mat: 'wood', tone: 'grey', along: 'y', weather: 0.3 }],
    dark: [48, 32, { mat: 'flat', colour: '#2B2622', var: 0.1 }],
    pot: [72, 40, { mat: 'flat', colour: '#9A5E44', var: 0.14, tile_x: true }],
    dome: [96, 36, { mat: 'thriftdome', soft: 2 }],
    heads: [80, 16, { mat: 'thrifthead', n: 5, soft: 0 }],
  }, 8, [0, 656]),
};

const up = (r) => ({ ...r, at: (s, t) => r.at(t, s) });                                            // a rectangle turned: for a post or a shaft, so that the grain runs up it
const m = new Model('whaleboat-house');
m.material('main', { kind: 'texture', roughness: 0.92 });
m.material('Glass', { kind: 'texture', roughness: 0.35, emissive: [1, 1, 1], glow: true });
const xf = move([0, 0, SHIFT]);
const hull = m.part('hull', { crease: 30, xf }), walls = m.part('walls', { crease: 30, xf }), front = m.part('front', { crease: 30, xf }), fit = m.part('fittings', { crease: 40, xf });
const glass = m.part('glass', { material: 'Glass', crease: 60, xf });

// ---- the hull: five strakes a side and the ledges between them, the sawn ends of the planks, the rail, the keel and stem
const uOf = (z) => (ZC - z) / (ZC - RAB(1.2)[0]);
mirrored(hull, (p) => {
  for (let i = 0; i + 1 < NR; i++) { const A = RINGS[i], B = RINGS[i + 1], ua = (j) => uOf(A.P[j][2]), ub = (j) => uOf(B.P[j][2]);
    for (let j = 0; j < N; j++) { const hi = (r) => (j + 1 < N ? r.U[j + 1] : r.P[N]);
      quadToward(p, [A.P[j], R.hull.at(ua(j), j / N)], [B.P[j], R.hull.at(ub(j), j / N)], [hi(B), R.hull.at(ub(j + 1), (j + 1) / N)], [hi(A), R.hull.at(ua(j + 1), (j + 1) / N)], [1, 0.4, 0]);
      if (j) quadToward(p, [A.U[j], R.ledge.at(ua(j), 0)], [B.U[j], R.ledge.at(ub(j), 0)], [B.P[j], R.ledge.at(ub(j), 1), 0.85], [A.P[j], R.ledge.at(ua(j), 1), 0.85], [-A.nr[j][1], A.nr[j][0], 0]); }
  }
  const E = RINGS[0], I = E.P.map((q, j) => (j === N ? [0, q[1] - 0.045, q[2]] : sub(q, mul(E.nr[j], 0.045)))), cu = (q) => R.cut.at(0.1 + 0.8 * q[0] / 1.5, 0.1 + 0.8 * (q[1] - 1.3) / 1.7);
  for (let j = 0; j < N; j++) {                                                                    // the planks' sawn ends, and the inside of the overhang
    if (j + 1 < N) triToward(p, [E.P[j], cu(E.P[j])], [E.U[j + 1], cu(E.U[j + 1])], [E.P[j + 1], cu(E.P[j + 1])], [0, 0, 1]);
    quadToward(p, [E.P[j], cu(E.P[j])], [E.P[j + 1], cu(E.P[j + 1])], [I[j + 1], cu(I[j + 1])], [I[j], cu(I[j])], [0, 0, 1]);
    const back = (q) => [q[0], q[1], ZF]; quadToward(p, [I[j], R.dark.at(0.1, 0.9), 0.6], [I[j + 1], R.dark.at(0.9, 0.9), 0.6], [back(I[j + 1]), R.dark.at(0.9, 0.1), 0.6], [back(I[j]), R.dark.at(0.1, 0.1), 0.6], mul(E.nr[j], -1));
  }
  // the rail (what was her gunwale), with the underside of the eave back to the wall
  const sec = RINGS.map((r, i) => { const q = r.P[0], o = OUT[i]; return { b: add(q, [o[0] * 0.006, 0.05, o[2] * 0.006]), a: add(q, [o[0] * 0.055, 0.045, o[2] * 0.055]), c: add(q, [o[0] * 0.055, -0.045, o[2] * 0.055]), w: WALL[i].top, u: uOf(q[2]) }; });
  sec[0].w = [XW, YF, ZC - 0.01];
  for (let i = 0; i + 1 < NR; i++) { const A = sec[i], B = sec[i + 1], o = OUT[i], r = R.rail;
    quadToward(p, [A.b, r.at(A.u, 1)], [B.b, r.at(B.u, 1)], [B.a, r.at(B.u, 0.68)], [A.a, r.at(A.u, 0.68)], [0, 1, 0]);
    quadToward(p, [A.a, r.at(A.u, 0.68)], [B.a, r.at(B.u, 0.68)], [B.c, r.at(B.u, 0.24)], [A.c, r.at(A.u, 0.24)], o);
    quadToward(p, [A.c, r.at(A.u, 0.24), 0.7], [B.c, r.at(B.u, 0.24), 0.7], [B.w, r.at(B.u, 0), 0.5], [A.w, r.at(A.u, 0), 0.5], [0, -1, 0]); }
  const e = sec[0]; quadToward(p, [e.b, cu(e.b)], [e.a, cu(e.a)], [e.c, cu(e.c)], [[e.b[0] - 0.04, e.c[1], e.b[2]], cu(e.c)], [0, 0, 1]);
});
{ // keel and stem: a slab KW either side of the centre line
  const acc = [0]; for (let i = 1; i < K_OUT.length; i++) acc.push(acc[i - 1] + Math.hypot(K_OUT[i][0] - K_OUT[i - 1][0], K_OUT[i][1] - K_OUT[i - 1][1]));
  const u = (i) => acc[i] / acc[acc.length - 1], O = (i, x) => [x, K_OUT[i][1], K_OUT[i][0]], I = (i, x) => [x, K_IN[i][1], K_IN[i][0]], k = R.keel;
  for (let i = 0; i + 1 < K_OUT.length; i++) {
    const away = sub(add(O(i, 0), O(i + 1, 0)), add(I(i, 0), I(i + 1, 0)));
    quadToward(hull, [O(i, KW), k.at(u(i), 0.62)], [O(i + 1, KW), k.at(u(i + 1), 0.62)], [O(i + 1, -KW), k.at(u(i + 1), 1)], [O(i, -KW), k.at(u(i), 1)], away);
    for (const sx of [1, -1]) quadToward(hull, [O(i, sx * KW), k.at(u(i), 0.62)], [O(i + 1, sx * KW), k.at(u(i + 1), 0.62)], [I(i + 1, sx * KW), k.at(u(i + 1), 0)], [I(i, sx * KW), k.at(u(i), 0)], [sx, 0, 0]);
  }
  const c = (q) => [q, R.cut.at(0.5 + q[0] * 2, 0.5 + (q[1] - 3) * 2)], L = K_OUT.length - 1;
  quadToward(hull, c(I(0, -KW)), c(I(0, KW)), c(O(0, KW)), c(O(0, -KW)), [0, 0, 1]); quadToward(hull, c(I(L, -KW)), c(I(L, KW)), c(O(L, KW)), c(O(L, -KW)), [0, -1, 0]);
}

// ---- the walls: dry stone under the gunwale all the way round the bow, battered, mirrored
{ const acc = [0]; for (let i = 1; i < NR; i++) acc.push(acc[i - 1] + len(sub(WALL[i].top, WALL[i - 1].top)));
  const u = (i) => acc[i] / acc[NR - 1], v = (y) => (y - DEEP) / (1.42 - DEEP);
  mirrored(walls, (p) => { for (let i = 0; i + 1 < NR; i++) { const A = WALL[i], B = WALL[i + 1];
    quadToward(p, [A.foot, R.wall.at(u(i), 0)], [B.foot, R.wall.at(u(i + 1), 0)], [B.top, R.wall.at(u(i + 1), v(B.top[1]))], [A.top, R.wall.at(u(i), v(A.top[1]))], OUT[i]); } }); }

// ---- the front: stone either side of the door, the plank gable over it, the door in its frame on a slate step
const DX0 = -0.98, DX1 = -0.13, DY0 = 0.07, DTOP = 1.87, DIN = 0.13;
{ const fr = (x, y) => R.front.at((x + XW) / (2 * XW), (y - DEEP) / (YF - DEEP));
  const panel = (x0, x1) => front.quad([[x0, DEEP, ZF], fr(x0, DEEP)], [[x1, DEEP, ZF], fr(x1, DEEP)], [[x1, YF, ZF], fr(x1, YF)], [[x0, YF, ZF], fr(x0, YF)]);
  panel(-XW, DX0); panel(DX1, XW);
  // the gable: strips up to the inside of the planking
  const E = RINGS[0], I = E.P.map((q, j) => (j === N ? [0, q[1] - 0.045] : [q[0] - E.nr[j][0] * 0.045, q[1] - E.nr[j][1] * 0.045])), GB = I[0][0], GT = I[N][1];
  const top = (x) => { const ax = Math.abs(x); if (ax >= GB) return YF; for (let j = 0; j < N; j++) if (ax <= I[j][0] && ax >= I[j + 1][0]) return I[j][1] + (I[j + 1][1] - I[j][1]) * (I[j][0] - ax) / (I[j][0] - I[j + 1][0]); return GT; };
  const xs = [...new Set([...I.flatMap((q) => [q[0], -q[0]]), DX0, DX1, -0.55, 0.3, 0.75].map((x) => +x.toFixed(4)))].sort((a, b) => a - b);
  const gb = (x, y) => R.gable.at((x + GB) / (2 * GB), (y - YF) / (GT - YF));
  for (let i = 0; i + 1 < xs.length; i++) { const [a, b] = [xs[i], xs[i + 1]], lo = (a >= DX0 - 1e-6 && b <= DX1 + 1e-6) ? DTOP : YF;
    front.quad([[a, lo, ZF], gb(a, lo)], [[b, lo, ZF], gb(b, lo)], [[b, Math.max(lo, top(b)), ZF], gb(b, top(b))], [[a, Math.max(lo, top(a)), ZF], gb(a, top(a))]); }
  // the door, set back in the wall
  const zd = ZF - DIN; front.face([DX0, DY0, zd], [DX1, DY0, zd], [DX1, DTOP, zd], [DX0, DTOP, zd], R.door);
  const rev = R.trim.sub(0, 0, 0.5, 1);
  front.face([DX0, DY0, ZF], [DX0, DY0, zd], [DX0, DTOP, zd], [DX0, DTOP, ZF], rev, [0.75, 0.6, 0.6, 0.75]);
  front.face([DX1, DY0, zd], [DX1, DY0, ZF], [DX1, DTOP, ZF], [DX1, DTOP, zd], rev, [0.6, 0.75, 0.75, 0.6]);
  front.face([DX0, DTOP, zd], [DX1, DTOP, zd], [DX1, DTOP, ZF], [DX0, DTOP, ZF], rev, [0.5, 0.5, 0.6, 0.6]);
  const post = { pz: R.trim, px: R.trim.sub(0, 0, 0.25, 1), nx: R.trim.sub(0, 0, 0.25, 1), py: R.trim.sub(0, 0, 0.25, 1), ny: R.trim.sub(0, 0, 0.25, 1) };
  for (const x of [DX0 - 0.05, DX1 + 0.05]) front.box([x, (DY0 + DTOP) / 2, ZF + 0.025], [0.05, (DTOP - DY0) / 2, 0.025], { pz: up(R.trim), px: up(R.trim.sub(0, 0, 1, 0.3)), nx: up(R.trim.sub(0, 0, 1, 0.3)) });
  front.box([(DX0 + DX1) / 2, DTOP + 0.065, ZF + 0.035], [(DX1 - DX0) / 2 + 0.16, 0.065, 0.035], post);
  front.box([(DX0 + DX1) / 2, (DEEP + DY0) / 2, ZF + 0.12], [(DX1 - DX0) / 2 + 0.12, (DY0 - DEEP) / 2, 0.26], { py: R.slab, pz: R.slab.sub(0, 0, 1, 0.4), px: R.slab.sub(0, 0, 0.4, 0.4), nx: R.slab.sub(0, 0, 0.4, 0.4) });      // the step
  fit.box([DX1 - 0.11, 1.0, zd + 0.02], [0.02, 0.07, 0.02], R.iron); fit.torus(0.045, 0.011, 6, 3, R.iron, { xf: compose(move([DX1 - 0.11, 0.93, zd + 0.045]), (q) => [q[0], q[2], q[1]]) });      // the latch and its ring
  for (const y of [0.42, 1.52]) fit.box([(DX0 + DX1) / 2 - 0.06, y, zd + 0.008], [(DX1 - DX0) / 2 - 0.09, 0.03, 0.008], { pz: R.iron, py: R.iron, ny: R.iron, px: R.iron });                         // strap hinges
}

// ---- the window: four panes in a cream frame, a sill under it
{ const WX = 0.64, WY = 1.86, G = 0.23, F = 0.07, z0 = ZF, zp = ZF + 0.05, zg = ZF + 0.012, f = R.winFrame;
  const bar = (x0, y0, x1, y1, z, r, s = 1) => front.face([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], r, [s, s, s, s]);
  for (const [x0, y0, x1, y1] of [[-G - F, -G - F, G + F, -G], [-G - F, G, G + F, G + F]]) front.box([WX + (x0 + x1) / 2, WY + (y0 + y1) / 2, (z0 + zp) / 2], [(x1 - x0) / 2, (y1 - y0) / 2, (zp - z0) / 2], { pz: f, py: f.sub(0, 0, 1, 0.4), ny: f.sub(0, 0, 1, 0.4), px: f.sub(0, 0, 0.1, 1), nx: f.sub(0, 0, 0.1, 1) }, { shade: { ny: 0.7 } });
  for (const sx of [-1, 1]) front.box([WX + sx * (G + F / 2), WY, (z0 + zp) / 2], [F / 2, G, (zp - z0) / 2], { pz: f.sub(0, 0, 0.5, 1), px: f.sub(0, 0, 0.5, 0.4), nx: f.sub(0, 0, 0.5, 0.4) });
  const b = f.sub(0.05, 0.25, 0.5, 0.75); bar(WX - G, WY - 0.016, WX + G, WY + 0.016, ZF + 0.03, b); bar(WX - 0.016, WY - G, WX + 0.016, WY + G, ZF + 0.03, b);
  glass.face([WX - G, WY - G, zg], [WX + G, WY - G, zg], [WX + G, WY + G, zg], [WX - G, WY + G, zg], R.winGlass);
  front.box([WX, WY - G - F - 0.02, ZF + 0.05], [G + F + 0.05, 0.02, 0.05], { pz: f, py: f, ny: f, px: f.sub(0, 0, 0.1, 1), nx: f.sub(0, 0, 0.1, 1) }, { shade: { ny: 0.65 } });
}

// ---- the bench under the window, with a pot of thrift on it; the floats on their line
{ const BX = 0.74, BZ = ZF + 0.27, top = 0.46;
  fit.box([BX, top - 0.03, BZ], [0.60, 0.03, 0.19], { py: R.bench, pz: R.bench.sub(0, 0, 1, 0.3), nz: R.bench.sub(0, 0, 1, 0.3), px: R.bench.sub(0, 0, 0.2, 0.3), nx: R.bench.sub(0, 0, 0.2, 0.3), ny: R.bench }, { shade: { ny: 0.55 } });
  for (const dx of [-0.44, 0.44]) fit.box([BX + dx, (DEEP + top - 0.06) / 2, BZ], [0.08, (top - 0.06 - DEEP) / 2, 0.16], { pz: R.slab.sub(0, 0, 0.3, 1), nz: R.slab.sub(0, 0, 0.3, 1), px: R.slab.sub(0.3, 0, 1, 1), nx: R.slab.sub(0.3, 0, 1, 1) });
  within(fit, move([BX + 0.42, top, BZ - 0.02]), (p) => {
    p.lathe([[0.075, 0], [0.105, 0.13], [0.088, 0.13]], 6, R.pot);
    p.lathe([[0.118, 0.115], [0.105, 0.19], [0.058, 0.235], [0, 0.25]], 6, R.dome, { shade: (i) => (i ? 1 : 0.8) });
    [[0.0, 0.0], [0.085, 0.5], [0.08, 2.6], [0.09, 4.2], [0.045, 5.4]].forEach(([r, a], k) => { const c = [r * Math.cos(a), 0.275 - r * 0.45, r * Math.sin(a)], h = R.heads.sub(k / 5 + 0.02, 0, (k + 1) / 5 - 0.02, 1);
      for (let q = 0; q < 4; q++) { const b = (t) => add(c, [0.03 * Math.cos(Math.PI / 2 * t), -0.012, -0.03 * Math.sin(Math.PI / 2 * t)]); p.tri([b(q), h.at(q / 4, 0)], [b(q + 1), h.at((q + 1) / 4, 0)], [add(c, [0, 0.02, 0]), h.at(0.5, 1)]); } });
  });
  const LY = 1.31, FL = [[0.25, 0.13, 0.13, 'A', 0.4], [0.555, 0.105, 0.29, 'B', 2.1], [0.865, 0.15, 0.09, 'A', 3.3], [1.16, 0.115, 0.23, 'B', 5.0]];      // x, radius, length of its cord, which glass, turn
  fit.tube([[0.08, LY + 0.02, ZF + 0.02], [0.4, LY - 0.01, ZF + 0.03], [0.72, LY - 0.02, ZF + 0.03], [1.02, LY - 0.01, ZF + 0.03], [XW - 0.04, LY + 0.02, ZF + 0.02]], 0.012, 3, R.rope, { lay: 5, open: true });
  for (const sx of [0.08, XW - 0.04]) fit.box([sx, LY + 0.02, ZF + 0.02], [0.022, 0.022, 0.03], R.iron);
  for (const [x, r, cord, which, turn] of FL) { const c = [x, LY - 0.02 - cord - r, ZF + r + 0.012];
    within(glass, compose(move(c), rotY(turn)), (p) => p.lathe([[0, -r], [0.72 * r, -0.70 * r], [r, 0], [0.72 * r, 0.70 * r], [0, r]], 6, R['float' + which], { v: [0, 0.22, 0.5, 0.78, 1] }));
    fit.tube([[x, LY - 0.015, ZF + 0.03], [x, c[1] + r * 0.96, c[2]]], 0.008, 3, R.rope, { open: true }); }
}

// ---- the stove pipe, up through the planking on the +X side: a tin collar, the pipe, a cowl that looks down the wind
within(fit, move([0.78, 0, -0.9]), (p) => { const t = R.tin;
  p.lathe([[0.21, 2.58], [0.125, 2.86], [0.10, 2.88]], 6, t.sub(0, 0, 1, 0.22));
  p.lathe([[0.092, 2.86], [0.092, 3.50]], 6, t.sub(0, 0.22, 1, 0.72)); p.lathe([[0.112, 3.28], [0.112, 3.335]], 6, t.sub(0, 0.5, 1, 0.56));
  const E = [[0, 3.46, 0], [0, 3.61, 0], [0, 3.72, 0.10], [0, 3.76, 0.31]]; p.tube(E, [0.095, 0.10, 0.115, 0.135], 6, t.sub(0, 0.72, 1, 1), { open: true });
  within(p, aim(E[3], sub(E[3], E[2])), (q) => q.lathe([[0.135, 0], [0.04, -0.15], [0, -0.15]], 6, R.dark, { shade: () => 0.5 }));
});

// ---- two ropes over the hull, a stone hung on each end to hold her down in a gale
for (const z of [1.55, -1.75]) { const r = ringAt(z), B = r.P[0][0], yk = r.P[N][1];
  const half = [[B + 0.075, 0.78, z], [B + 0.075, r.P[0][1] + 0.055, z], ...r.U.slice(1, N).map((q, j) => add(q, mul(r.nr[j + 1], 0.02))), [KW + 0.025, yk + KEEL + 0.022, z]];
  fit.tube([...half, ...half.map(([x, y, zz]) => [-x, y, zz]).reverse()], 0.017, 3, R.rope, { lay: 14, open: true });
  for (const sx of [1, -1]) within(fit, compose(move([sx * (B + 0.075), 0.66, z]), rotY(rnd() * 6)), (p) => p.lathe([[0, -0.15], [0.14, -0.07], [0.125, 0.06], [0.04, 0.125], [0, 0.125]], 5, R.stone, { wobble: (i, j) => 1 + 0.16 * (((j * 7 + i * 3) % 5) / 4 - 0.5) }));
}

await emit(m, R, ATLAS, args);
