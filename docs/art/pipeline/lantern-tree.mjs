// lantern-tree.mjs : the drowned lantern trees of Mossglass Fen, built from a description (build-lantern-tree-a.mjs, -b.mjs).
// A buttressed trunk standing in the water, roots arching into it, knees round it, boughs that carry flat pads of leaves,
// dead boughs, and ribbons of hanging moss. Origin at the waterline under the trunk, +Y up, metres.
// Two materials: `main` (bark and leaves) and `Glow` (the moss: grey-green by day in the base colour, its own glow map
// for the dark). Every moss ribbon has UV v = 0 at its root and 1 at its tip, so the game can sway it like the reeds.
import { Model, pack, strip, emit, within, rotX, rotY, move, compose, rad, add, sub, mul, lerp, rng } from './kit.mjs';

const out = (a) => [Math.cos(rad(a)), 0, -Math.sin(rad(a))];              // the direction at a compass angle, as the lathe counts it

/**
 * spec: { name, seed, sides, foot, trunk: [[x, y, z, radius, buttress], ...] (rings, bottom to top), twist (turns per metre),
 *   snag (the trunk ends broken), dead (0..1, how bleached the bark is),
 *   pads: [{ at, r, h, sides, from (the height its bough leaves the trunk; none for the pad the trunk itself carries), moss, len: [lo, hi], tilt: [degrees, toward] }],
 *   bare: [{ from, toward, reach, rise, r, twig }] (dead boughs), boughMoss, bareMoss,
 *   roots: [[toward, reach, height it leaves the trunk], ...], knees: [[x, z, top, radius], ...] }
 */
export const lanternTree = async (spec, args) => {
  const ATLAS = [1024, 1024], foot = spec.foot ?? -1.5, rings = spec.trunk, N = spec.sides, top = rings[rings.length - 1][1];
  const LANES = 4, ROOTTOP = 1.3;
  const R = {
    moss: strip(0, 0, 128, 1024, { mat: 'strands', n: LANES, root: 'top', tone: ['#2F4A3A', '#5F8468', '#9DBB92'], glow: { mat: 'glow', colour: '#7FF0D0', dark: '#174A42', tip: 0, pale: 0.3, soft: 2 } }, 3),
    trunk: strip(140, 8, 396, 1016, { mat: 'bark', tile_x: true, moss: 0.4, dead: spec.dead || 0, water: [foot, top], barnacles: 0 }, 21),
    ...pack(616, 1024, {
      padA: [592, 300, { mat: 'canopy', rim: 0.3, tile_x: true }], padB: [592, 280, { mat: 'canopy', rim: 0.3, tile_x: true }],
      bough: [150, 330, { mat: 'bark', tile_x: true, moss: 0.42, dead: (spec.dead || 0) * 0.6 }],
      root: [150, 330, { mat: 'bark', tile_x: true, moss: 0.62, water: [foot, ROOTTOP], barnacles: 0 }],
      bare: [150, 330, { mat: 'bark', tile_x: true, moss: 0.12, dead: 0.8 }],
      snag: [64, 64, { mat: 'endgrain' }],
    }, 8, [404, 0]),
  };
  const m = new Model(spec.name); const rnd = rng(spec.seed);
  m.material('main', { kind: 'texture', roughness: 0.95 });
  m.material('Glow', { kind: 'texture', roughness: 1, emissive: [1, 1, 1], glow: true, doubleSided: true });
  const wood = m.part('wood', { crease: 55 }), leaves = m.part('leaves', { crease: 24 }), moss = m.part('moss', { material: 'Glow', crease: 180 });

  // ---- the trunk: rings of N corners, every other corner a buttress that dies away with height
  const fin = Array.from({ length: N }, (_, j) => (j % 2 === 0 ? 0.7 + 0.6 * rnd() : -0.14 * rnd())), skew = Array.from({ length: N }, () => (rnd() - 0.5) * 0.3);
  const axis = (y) => { let i = 0; while (i + 2 < rings.length && rings[i + 1][1] < y) i++; const a = rings[i], b = rings[i + 1], t = Math.max(0, Math.min(1, (y - a[1]) / (b[1] - a[1]))); return { c: [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t], r: a[3] + (b[3] - a[3]) * t }; };
  const jag = Array.from({ length: N }, (_, j) => (spec.snag ? (j % 2 ? 0.34 * rnd() : -0.1 * rnd()) : 0));                    // a broken top is splintered
  const TP = (i, j) => { const [cx, y, cz, rr, B] = rings[i], jj = j % N, a = 2 * Math.PI * ((jj + skew[jj]) / N + (spec.twist || 0) * (y - foot)), k = rr * (1 + B * fin[jj]); return [cx + k * Math.cos(a), y + (i === rings.length - 1 ? jag[jj] : 0), cz - k * Math.sin(a)]; };
  const TC = (i, j) => { const [, y, , , B] = rings[i]; return [TP(i, j), R.trunk.at(j / N, (y - foot) / (top - foot)), (j % 2 ? 1 - 0.3 * Math.min(1, B) : 1) * (1 - 0.18 * Math.max(0, (y - 0.55 * top) / (0.45 * top)))]; };
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < N; j++) wood.quad(TC(i, j), TC(i, j + 1), TC(i + 1, j + 1), TC(i + 1, j));
  if (spec.snag) { const i = rings.length - 1, [cx, y, cz] = rings[i]; for (let j = 0; j < N; j++) { const a = 2 * Math.PI * j / N, p = (jj) => [TP(i, jj), R.snag.at(0.5 + 0.45 * Math.cos(2 * Math.PI * jj / N), 0.5 + 0.45 * Math.sin(2 * Math.PI * jj / N)), 0.9]; wood.tri([[cx, y - 0.22, cz], R.snag.at(0.5, 0.5), 0.55], p(j), p(j + 1)); } }

  // ---- roots: out of the buttresses in an arch and down into the water
  const rootV = (y) => (y - foot) / (ROOTTOP - foot);
  for (const [a, reach, y0, thick = 0.19] of spec.roots || []) {
    const s = axis(y0), d = out(a), at = (k, y) => [s.c[0] + d[0] * k, y, s.c[2] + d[2] * k];
    const pts = [at(s.r * 0.5, y0), at(0.46 * reach, 0.74 * y0), at(0.82 * reach, 0.24 * y0), at(1.0 * reach, -0.45), at(1.07 * reach, foot)];
    wood.tube(pts, [thick * 1.15, thick * 0.92, thick * 0.78, thick * 0.68, thick * 0.6], 4, R.root, { open: true, v: pts.map((p) => rootV(p[1])), twist: Math.PI / 4 });
  }
  // ---- knees: stumps that stand out of the water round the tree
  for (const [x, z, h, kr] of spec.knees || []) within(wood, compose(move([x, 0, z]), rotY(rnd() * 6.28), rotX(rad(5 + 9 * rnd()))), (p) => {
    const prof = [[kr * 1.3, foot], [kr, -0.05], [kr * 0.56, h * 0.7], [0, h]]; p.lathe(prof, 4, R.root, { v: prof.map(([, y]) => rootV(y)), wobble: (i, j) => 1 + 0.25 * (((j * 7 + 3) % 5) / 5 - 0.5) });
  });

  // ---- moss: a ribbon hanging from a point; v runs 0 at its root to 1 at its tip
  let strands = 0;
  const ribbon = (p, yaw, L, w) => {
    const lane = R.moss.sub((strands % LANES) / LANES, 0, (strands % LANES + 1) / LANES, 1); strands++;
    const d = out(yaw), torn = rnd() < 0.45, k = torn ? 0.74 + 0.14 * rnd() : 0.58 + 0.16 * rnd(), side = rnd() < 0.5 ? -1 : 1, sway = (rnd() - 0.5) * 0.10 * L;
    const a = add(p, mul(d, -w / 2)), b = add(p, mul(d, w / 2)), mid = add(add(p, mul(d, sway * k)), [0, -L * k, 0]), half = w * (torn ? 0.44 : 0.36);
    const e = add(mid, mul(d, -half)), c = add(mid, mul(d, half)), tip = add(add(p, mul(d, sway + (torn ? side * half * 0.9 : (rnd() - 0.5) * 0.4 * w))), [0, -L, 0]);   // torn: the point hangs from one edge
    moss.quad([a, lane.at(0.08, 1)], [e, lane.at(0.14, 1 - k)], [c, lane.at(0.86, 1 - k)], [b, lane.at(0.92, 1)]);
    moss.tri([e, lane.at(0.14, 1 - k)], [tip, lane.at(0.5, 0)], [c, lane.at(0.86, 1 - k)]);
  };

  // ---- a bough from the trunk out and up to a point; returns its points for the moss
  const bough = (from, to, r0, rect, taper = [1, 0.82, 0.62, 0.46]) => {
    const s = axis(from).c, f = (t, u) => [s[0] + (to[0] - s[0]) * t, s[1] + (to[1] - s[1]) * u, s[2] + (to[2] - s[2]) * t];
    const pts = [s, f(0.5, 0.3), f(0.9, 0.74), to], rr = taper.map((k) => k * r0);
    wood.tube(pts, rr, 5, rect, { open: true }); return { pts, rr };
  };
  const along = (b, t) => { const k = Math.min(b.pts.length - 2, Math.floor(t * (b.pts.length - 1))), u = t * (b.pts.length - 1) - k; return add(lerp(b.pts[k], b.pts[k + 1], u), [0, -0.6 * (b.rr[k] + (b.rr[k + 1] - b.rr[k]) * u), 0]); };

  // ---- pads of leaves: a flat faceted umbrella on the end of a bough (or of the trunk), moss hanging from its rim
  const boughs = [];
  (spec.pads || []).forEach((pad, n) => {
    const { at, r, h, sides = 8, from = null, moss: count = 0, len: span = [1.2, 2.6], tilt = [0, 0] } = pad;
    if (from !== null) boughs.push(bough(from, add(at, [0, -0.05 * h, 0]), 0.085 * r + 0.10, R.bough));
    const wob = Array.from({ length: sides }, () => 0.9 + 0.2 * rnd()), wob2 = Array.from({ length: sides }, () => 0.88 + 0.24 * rnd()), up = Array.from({ length: sides }, () => (rnd() - 0.5) * 0.16 * h);
    const turn = rnd() * 360, xf = compose(move(at), rotY(rad(tilt[1])), rotX(rad(tilt[0])), rotY(rad(turn - tilt[1])));
    const prof = [[0, -0.16 * h], [r, 0], [0.74 * r, 0.50 * h], [0.38 * r, 0.86 * h], [0, h]];
    within(leaves, xf, (p) => p.lathe(prof, sides, n % 2 ? R.padB : R.padA, { v: [0, 0.3, 0.56, 0.8, 1],
      wobble: (i, j) => (i === 1 ? wob[j % sides] : i === 2 ? wob2[j % sides] : i === 3 ? wob[(j + 2) % sides] : 1),
      lift: (i, j) => (i === 1 ? up[j % sides] : i === 2 ? up[(j + 3) % sides] * 0.7 : i === 3 ? up[(j + 1) % sides] * 0.4 : 0),
      shade: (i) => (i === 0 ? 0.82 : 1) }));
    const bunches = Math.max(1, Math.round(count / 2.5));                    // the moss hangs in bunches: a long ribbon and one or two shorter beside it
    for (let k = 0, left = count; k < bunches && left > 0; k++) {
      const a = (k + 0.8 * rnd()) / bunches * 360, q = 0.55 + 0.33 * rnd(), L = span[0] + (span[1] - span[0]) * rnd() ** 1.3, n = Math.min(left, k === bunches - 1 ? left : 2 + (rnd() < 0.5 ? 1 : 0)); left -= n;
      const yaw = a + 90 + (rnd() - 0.5) * 130, w = 0.13 + 0.09 * rnd(), d = out(a), e = out(yaw), longest = Math.floor(rnd() * n);      // a bunch is a little curtain: its ribbons side by side
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * w * 0.85, local = [d[0] * q * r + e[0] * off, -0.16 * h * (1 - q) + 0.06, d[2] * q * r + e[2] * off];
        ribbon(xf(local), yaw + turn + (rnd() - 0.5) * 30, L * (i === longest ? 1 : 0.35 + 0.5 * rnd()), w * (0.85 + 0.3 * rnd()));
      }
    }
  });
  // moss under the living boughs
  boughs.forEach((b, i) => { for (let k = 0; k < (spec.boughMoss || 0); k++) ribbon(along(b, 0.3 + 0.62 * (k + rnd()) / spec.boughMoss), rnd() * 360, 0.6 + 1.6 * rnd() ** 1.5, 0.10 + 0.09 * rnd()); });

  // ---- dead boughs: bare, pointed, with a twig
  (spec.bare || []).forEach(({ from, toward, reach, rise, r = 0.13, twig = 0.5, moss: count = 0 }) => {
    const s = axis(from).c, d = out(toward), to = [s[0] + d[0] * reach, from + rise, s[2] + d[2] * reach];
    const b = bough(from, to, r, R.bare, [1, 0.78, 0.5, 0.06]);
    if (twig) { const q = lerp(b.pts[1], b.pts[2], 0.55), side = out(toward + (rnd() < 0.5 ? 55 : -55)), e = add(q, [side[0] * reach * twig * 0.6, reach * twig * 0.55, side[2] * reach * twig * 0.6]);
      wood.tube([q, lerp(q, e, 0.55), e], [r * 0.5, r * 0.32, 0.015], 3, R.bare, { open: true }); }
    for (let k = 0; k < count; k++) ribbon(along(b, 0.35 + 0.5 * (k + rnd()) / count), rnd() * 360, 0.6 + 1.2 * rnd(), 0.10 + 0.09 * rnd());
  });

  return emit(m, R, ATLAS, args, { glowSize: 512, extra: { strands } });
};
