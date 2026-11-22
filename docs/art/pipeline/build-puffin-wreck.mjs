// build-puffin-wreck.mjs : the Puffin as she is found (props/puffin-wreck.glb), built in code (no generation job).
// Usage: node build-puffin-wreck.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// The same hull as build-puffin.mjs (puffin.mjs), forty years on a sandbar: heeled 20 degrees to starboard, her mast
// broken and lying along her, weed hanging from her old waterline, reeds grown out through a sprung plank in her port
// bow and up through her well, a moorhen's nest with three eggs on the port stern sheets.
// Origin on the ground under her middle; the water stands about 0.2 m above it. Bow toward +Z, port is +X. Her old
// waterline is 0.30 m above the origin on the centre line; her keel and the weed go down to 0.6 m below it.
// One material, `main`; one mesh, no nodes.
import { Model, pack, cli, emit, within, rotX, rotY, rotZ, move, compose, rad, add, sub, mul, norm, cross, lerp, rng } from './kit.mjs';
import { mirrored, quadToward, triToward } from './fish.mjs';
import * as P from './puffin.mjs';

const args = cli(); const ATLAS = [2048, 2048];
const HEEL = 20, LIFT = 0.30, DEEP = -0.6;
const lay = compose(move([0, LIFT, 0]), rotZ(rad(HEEL)));            // from the hull's own coordinates to the wreck's: +Y of the hull leans toward -X (starboard)
const { ZT, SOLE, SEAT, DECK_Z, disc, slabZY, all } = P, S0 = P.lines(ZT).S;
const PAINT = '#A3A990', INK = '#4B4650', CORAL = '#B08878', BOTTOM = '#5A4A3C', GREY = '#7A746B';      // what is left of bone, ink, coral and bottom paint; bare wood
const LIFT_GREY = 0.6, LIFT_INK = 0.33;            // how far the planking's paint (and the ink of her sheer strake) is taken toward silver-grey above the waterline before the weather is laid on it: what is seen comes out about a third of the way, so that her shaded side is not black against bright reeds
const old = (o = {}) => ({ mat: 'aged', of: 'wood', tone: 'grey', along: 'x', weather: 0.75, algae: 0.35, lichen: 0.3, fade: 0.1, ...o });
const paint = (o = {}) => ({ mat: 'aged', of: 'planked', colour: PAINT, under: GREY, wear: 0.34, grime: 0.4, algae: 0.5, lichen: 0.12, fade: 0.15, ...o });
const R = pack(...ATLAS, {
  topsides: [1520, 150, paint({ planks: 4, first: true, low: 0.9, bleach: LIFT_GREY })], sheer: [1520, 40, paint({ colour: INK, planks: 0, wear: 0.45, algae: 0.25, bleach: LIFT_INK, bleach_from: -0.4 })],
  boot: [1520, 36, { mat: 'planked', colour: CORAL, under: GREY, planks: 0, wear: 0.5, water: [-0.16, -0.03], barnacles: 1.6 }],
  bottom: [1520, 170, { mat: 'antifoul', colour: BOTTOM, slime: 0.9, water: [-0.60, -0.14], barnacles: 1.5 }],
  rub: [1520, 20, old({ weather: 0.8 })], rail: [1520, 50, old({ edge: 0.25, lichen: 0.45, droppings: 0.25 })],
  keel: [600, 60, { mat: 'antifoul', colour: BOTTOM, slime: 0.9, water: [-0.75, -0.2] }],
  stem: [150, 320, { mat: 'aged', of: 'bands', ys: [P.STEM_BOX.y0, P.STEM_BOX.y1], colour: PAINT, boot: CORAL, bottom: BOTTOM, top_colour: INK, top: 0.955 - P.STRAKE, wood_from: 0.95, wear: 0.22, algae: 0.3, lichen: 0.12, fade: 0.25, bleach: LIFT_GREY, bleach_from: 0.39, bleach_over: 0.12, water: [P.STEM_BOX.y0 - 0.06, P.STEM_BOX.y1 - 0.06], barnacles: 0.42 }],
  transomOut: [560, 300, { mat: 'aged', of: 'bands', ys: [P.TRANSOM.y0, P.TRANSOM.y1], colour: PAINT, boot: CORAL, bottom: BOTTOM, top_colour: INK, planks: 4, top: S0 - P.STRAKE, wear: 0.22, algae: 0.35, lichen: 0.12, fade: 0.25, bleach: LIFT_GREY, bleach_from: 0.30, bleach_over: 0.15, water: [P.TRANSOM.y0 - 0.06, P.TRANSOM.y1 - 0.06], barnacles: 0.42 }],
  transomIn: [400, 200, old({ planks: 5, ao: { bottom: 0.3 } })], cap: [300, 22, old()],
  ceiling: [1000, 210, old({ planks: 5, ao: { bottom: 0.35 }, low: 0.9, algae: 0.5 })],
  sole: [660, 300, old({ planks: 9, weather: 0.9, algae: 0.6, lichen: 0, light: 0.8 })],
  bench: [300, 170, old({ planks: 3, droppings: 0.3 })], sheets: [420, 220, old({ planks: 7, along: 'y', droppings: 0.3 })],
  riser: [330, 160, old({ planks: 3, light: 0.72, ao: { bottom: 0.35 }, lichen: 0 })],
  deck: [520, 600, old({ planks: 13, along: 'y', lichen: 0.45, droppings: 0.2 })], bulk: [520, 240, old({ planks: 12, along: 'y', ao: { bottom: 0.3, top: 0.3 } })],
  cuddySide: [420, 90, old({ planks: 2, edge: 0.2 })], cuddyEnd: [420, 90, old({ planks: 2, edge: 0.2 })],
  roof: [360, 380, paint({ colour: '#A9AA93', planks: 0, wear: 0.3, lichen: 0.35, droppings: 0.3, low: 0.1 })], eave: [300, 18, old()],
  rudder: [120, 460, { mat: 'aged', of: 'bands', ys: [-0.6, 0.66], colour: CORAL, boot: CORAL, bottom: BOTTOM, wear: 0.22, algae: 0.3, lichen: 0.1, fade: 0.25, water: [-0.66, 0.60], barnacles: 0.42 }], rudderEdge: [24, 300, old()],
  name: [440, 106, { mat: 'aged', of: 'lettering', text: 'PUFFIN', ink: '#DAD4BE', rim: 0.07, worn: 0.3, edge: 0.3, algae: 0.14, lichen: 0.12, fade: 0.12, low: 0.3 }],
  badge: [200, 200, { mat: 'aged', of: 'badge', algae: 0.2, lichen: 0.15, fade: 0.4 }], badgeEdge: [120, 14, { mat: 'flat', colour: INK }],
  door: [150, 220, { mat: 'aged', of: 'wood', planks: 4, along: 'y', tone: 'teal', weather: 0.7, nails: 2, edge: 0.5, algae: 0.3, lichen: 0.2, fade: 0.3 }],
  port: [72, 72, { mat: 'aged', of: 'porthole', glass: '#1B2428', algae: 0.7, lichen: 0, fade: 0.55, low: 0 }], verdigris: [64, 64, { mat: 'copper', green: 0.9 }],
  hatch: [150, 120, old({ planks: 5, edge: 0.4 })], dark: [200, 60, old({ tone: 'dark', weather: 0.6 })], post: [48, 300, old({ along: 'y' })],
  hole: [96, 48, { mat: 'flat', colour: '#15120E', var: 0.3 }], iron: [64, 64, { mat: 'iron', rust: 0.95 }],
  mast: [112, 600, old({ along: 'y', tile_x: true, lichen: 0.2, low: 0 })], mastTop: [96, 110, paint({ colour: '#C2C0AA', planks: 0, wear: 0.4, tile_x: true, low: 0 })],
  truck: [64, 64, { mat: 'planked', colour: CORAL, under: GREY, planks: 0, wear: 0.6, tile_x: true }],
  rag: [300, 240, { mat: 'aged', of: 'sailcloth', colour: '#7E4A3A', cloths: 3, worn: 0.9, algae: 0.45, lichen: 0, fade: 0.45, tabling: 0 }],
  wire: [96, 16, { mat: 'iron', rust: 1.0 }],
  pot: [260, 150, { mat: 'aged', of: 'wicker', rows: 11, ribs: 10, algae: 0.4, lichen: 0.1, fade: 0.4 }], potEnd: [110, 60, { mat: 'aged', of: 'wicker', rows: 6, ribs: 8, light: 0.8, algae: 0.4, fade: 0.4 }],
  nest: [512, 150, { mat: 'nest' }], nestIn: [256, 96, { mat: 'nest', light: 0.8, ao: { bottom: 0.4 } }], egg: [64, 64, { mat: 'egg' }],
  blades: [288, 420, { mat: 'blade', n: 6, dry: 0.35 }], bulrush: [36, 300, { mat: 'bulrush' }],
  weed: [300, 360, { mat: 'strands', n: 10, tone: ['#3A4226', '#66703A', '#9A9858'] }],
});

const m = new Model('puffin-wreck');
m.material('main', { kind: 'texture', roughness: 0.94 });
// parts in the hull's own coordinates (laid over at the end), and parts in the wreck's (things that grow or hang plumb)
const hull = m.part('hull', { crease: 62 }), wood = m.part('wood', { crease: 40 }), fit = m.part('fittings', { crease: 40 }), round = m.part('round', { crease: 50 });
const grow = m.part('growth', { crease: 30 }), nestP = m.part('nest', { crease: 60 }), plumb = m.part('plumb', { crease: 30 });
P.shell(hull, R); P.backbone(wood, R); P.transom(wood, { out: R.transomOut, in: R.transomIn, cap: R.cap });
P.rubrail(wood, R.rub); P.rail(wood, R.rail); P.ceiling(wood, R.ceiling); P.cockpit(wood, R); P.deck(wood, R); P.cuddy(wood, { side: R.cuddySide, end: R.cuddyEnd, roof: R.roof, eave: R.eave });
fit.box([0, -0.78, -0.21], [P.KW + 0.006, 0.18, 2.21], { px: R.keel, nx: R.keel, ny: R.keel, pz: R.keel, nz: R.keel });      // the keel carried down into the bar

// ---- the rudder, swung to the low side on its pintles; the gudgeons' straps; no tiller
within(fit, compose(move([0, 0, ZT - 0.03]), rotY(rad(34)), move([0, 0, -(ZT - 0.03)])), (f) => slabZY(f, P.rudderOutline(0.60), 0.028, R.rudder, R.rudderEdge, P.RUDDER_BOX));
for (const y of [0.33, -0.01]) fit.box([0, y, ZT - 0.004], [0.10, 0.022, 0.010], all(R.iron));

// ---- name board (one end dropped) and badge
{ const c = [0.675, 0.355, ZT - 0.014]; within(fit, compose(move(c), rotZ(rad(5)), move(mul(c, -1))), (f) => f.box([0.385, 0.355, ZT - 0.014], [0.29, 0.07, 0.014], { nz: R.name, px: R.cap, nx: R.cap, py: R.cap, ny: R.cap })); }
disc(fit, [-0.385, 0.355, ZT], [-1, 0, 0], [0, 1, 0], 0.135, 10, R.badge, { proud: 0.014, edge: R.badgeEdge });

// ---- the mast: its stump in the tabernacle, and the rest lying along her with its head on the starboard quarter
const MAST = [0, P.deckY(0, P.MAST_Z), P.MAST_Z];
for (const sx of [1, -1]) fit.box([sx * 0.135, MAST[1] + 0.15, MAST[2]], [0.027, 0.17, 0.095], all(R.dark), { warp: (p) => [p[0], p[1] + (sx < 0 && p[1] > MAST[1] + 0.2 ? -0.07 : 0), p[2] + (p[1] > MAST[1] + 0.2 ? (p[2] > MAST[2] ? -0.03 : 0.03) : 0)] });
round.tube([[0, MAST[1] - 0.01, MAST[2]], [0, MAST[1] + 0.36, MAST[2]], [0.035, MAST[1] + 0.47, MAST[2] + 0.01]], [0.098, 0.096, 0.07], 7, R.mast);
for (const [dx, dz, h] of [[0.055, -0.02, 0.26], [-0.01, 0.05, 0.15]]) for (const f of [1, -1]) triToward(fit, [[dx - 0.03, MAST[1] + 0.44, MAST[2] + dz - 0.02], R.mast.at(0.2, 0.2)], [[dx + 0.035, MAST[1] + 0.45, MAST[2] + dz + 0.02], R.mast.at(0.5, 0.2)], [[dx + 0.015, MAST[1] + 0.45 + h, MAST[2] + dz], R.mast.at(0.35, 0.6)], [f * 0.5, 0, -f]);      // splinters
const A = [-0.17, P.roofY(-0.17, 1.0) + 0.078, 1.0], B = [-0.50, S0 + 0.075, -2.62], along = norm(sub(B, A)), at = (t) => add(A, mul(along, t));
round.tube([at(-0.02), at(0.10), at(2.45)], [0.058, 0.082, 0.068], 6, R.mast);
for (const f of [1, -1]) triToward(fit, [add(at(0), [0.0, 0.05, 0]), R.mast.at(0.2, 0.2)], [add(at(0), [0.02, -0.03, 0]), R.mast.at(0.5, 0.2)], [add(at(-0.30), [0.03, 0.04, 0]), R.mast.at(0.35, 0.6)], [f, 0, 0]);
round.tube([at(2.45), at(2.48), at(2.60), at(2.63)], [0.068, 0.079, 0.079, 0.060], 6, R.iron, { open: true });
round.tube([at(2.63), at(3.42)], [0.060, 0.047], 6, R.mastTop, { open: true });
round.tube([at(3.42), at(3.46), at(3.52), at(3.555)], [0.047, 0.076, 0.052, 0.004], 6, R.truck, { open: true });
{ // rags of the mainsail still bent to it, hanging in tatters into the cockpit on the low side
  const tatter = (t0, t1, drops, u0) => { const n = drops.length - 1, top = (i) => { const p = at(t0 + (t1 - t0) * i / n); return [p[0] - 0.02, p[1] + 0.065, p[2]]; }, low = (i) => { const p = top(i), d = drops[i]; return [p[0] - 0.10 - d * 0.42, p[1] - d, p[2] + (i % 2 ? 0.03 : -0.02)]; };
    for (const s of [1, -1]) for (let i = 0; i < n; i++) { const c = (k, v) => [(v ? top : low)(k), R.rag.at(u0 + 0.9 * k / n, v ? 1 : 1 - Math.min(1, drops[k] / 0.7))]; quadToward(fit, c(i, 0), c(i + 1, 0), c(i + 1, 1), c(i, 1), [-s, s * 0.4, 0]); } };
  tatter(1.22, 2.30, [0.20, 0.44, 0.38, 0.60, 0.52, 0.30, 0.36, 0.12], 0.05); }

// ---- what is left on deck: portholes gone green, the hatch slid off its opening, the door hanging open, the samson post, the stub of the lantern post, a crab pot
mirrored(fit, (p) => { for (const z of [0.98, 1.44]) { const w0 = P.CUDDY.hw(z), w1 = P.CUDDY.hw(z + 0.1), yb = P.deckY(w0, z) - 0.02, yt = P.deckY(0, z) - 0.02 + P.CUDDY.h(z), e1 = norm([w1 - w0, 0, 0.1]), e2 = norm([-P.CUDDY.tumble, yt - yb, 0]);
  disc(p, [w0 - P.CUDDY.tumble / 2, (yb + yt) / 2 + 0.005, z], mul(e1, -1), e2, 0.072, 6, R.port, { proud: 0.012, edge: R.verdigris }); } });
{ const y = P.roofY(0, 0.90); fit.face([-0.17, y + 0.004, 1.03], [0.17, y + 0.004, 1.03], [0.17, y + 0.004, 0.77], [-0.17, y + 0.004, 0.77], R.hole);
  within(fit, compose(move([0.16, y + 0.03, 1.02]), rotY(rad(24)), rotZ(rad(-7))), (f) => f.box([0, 0, 0], [0.20, 0.024, 0.16], { py: R.hatch, px: R.eave, nx: R.eave, pz: R.eave, nz: R.eave, ny: R.eave })); }
{ const y0 = SOLE + 0.05, y1 = 0.40, hinge = [0.58, 0, DECK_Z - 0.014];
  fit.face([0.58, y0, DECK_Z - 0.004], [0.16, y0, DECK_Z - 0.004], [0.16, y1, DECK_Z - 0.004], [0.58, y1, DECK_Z - 0.004], R.hole);
  within(fit, compose(move(hinge), rotY(rad(-68)), rotX(rad(4)), move(mul(hinge, -1))), (f) => f.box([0.37, (y0 + y1) / 2, DECK_Z - 0.014], [0.21, (y1 - y0) / 2, 0.014], { nz: R.door, pz: R.door, px: R.dark, nx: R.dark, py: R.dark, ny: R.dark })); }
{ const y = P.deckY(0, 2.2); fit.box([0, y + 0.10, 2.20], [0.042, 0.115, 0.042], all(R.post)); }
fit.box([-0.60, SEAT + 0.17, -2.24], [0.036, 0.19, 0.036], all(R.post), { warp: (p) => [p[0] + (p[1] - SEAT) * 0.25, p[1] - (p[1] > SEAT + 0.2 && p[2] > -2.24 ? 0.09 : 0), p[2]] });
{ const c = [-0.63, SEAT, -1.72], r = 0.17, L = 0.44, K = 5, pt = (k, z) => [c[0] + r * Math.cos(Math.PI * k / K), c[1] + r * Math.sin(Math.PI * k / K) * 0.8, c[2] + z];
  for (let k = 0; k < K; k++) quadToward(fit, [pt(k, -L / 2), R.pot.at(0, k / K)], [pt(k, L / 2), R.pot.at(1, k / K)], [pt(k + 1, L / 2), R.pot.at(1, (k + 1) / K)], [pt(k + 1, -L / 2), R.pot.at(0, (k + 1) / K)], [Math.cos(Math.PI * (k + 0.5) / K), Math.sin(Math.PI * (k + 0.5) / K), 0]);
  for (const s of [-1, 1]) for (let k = 0; k < K; k++) triToward(fit, [[c[0], c[1], c[2] + s * L / 2], R.potEnd.at(0.5, 0)], [pt(k, s * L / 2), R.potEnd.at(0.5 + 0.5 * Math.cos(Math.PI * k / K), Math.sin(Math.PI * k / K))], [pt(k + 1, s * L / 2), R.potEnd.at(0.5 + 0.5 * Math.cos(Math.PI * (k + 1) / K), Math.sin(Math.PI * (k + 1) / K))], [0, 0, s]); }

// ---- the sprung plank in her port bow: the gap it left, and the plank standing off at its fore end
const GAP = { z: [1.12, 1.40, 1.68, 1.95], y: [0.20, 0.30] }, skin = (z, y, off = 0) => [P.half(z, y) + off, y, z];
for (let i = 0; i + 1 < GAP.z.length; i++) { const [a, b] = [GAP.z[i], GAP.z[i + 1]], u = (z) => (z - GAP.z[0]) / (GAP.z[3] - GAP.z[0]);
  quadToward(fit, [skin(a, GAP.y[0], 0.006), R.hole.at(u(a), 0)], [skin(b, GAP.y[0], 0.006), R.hole.at(u(b), 0)], [skin(b, GAP.y[1], 0.006), R.hole.at(u(b), 1)], [skin(a, GAP.y[1], 0.006), R.hole.at(u(a), 1)], [1, 0, 0]);
  const off = [0.008, 0.035, 0.12, 0.27], rise = [0, 0.005, 0.03, 0.07], pl = (k, y, t) => { const q = skin(GAP.z[k], y, off[k] + t); return [q[0], q[1] + rise[k], q[2]]; }, tu = (k) => 0.62 + 0.3 * u(GAP.z[k]);
  const c = (k, j, t, r, v) => [pl(k, GAP.y[j], t), r.at(tu(k), v)];
  quadToward(fit, c(i, 0, 0.022, R.topsides, 0.30), c(i + 1, 0, 0.022, R.topsides, 0.30), c(i + 1, 1, 0.022, R.topsides, 0.52), c(i, 1, 0.022, R.topsides, 0.52), [1, 0, 0]);      // its painted face
  quadToward(fit, c(i, 0, 0, R.rub, 0), c(i + 1, 0, 0, R.rub, 0), c(i + 1, 1, 0, R.rub, 1), c(i, 1, 0, R.rub, 1), [-1, 0, 0]);                                              // its back
  quadToward(fit, c(i, 1, 0, R.rub, 0), c(i + 1, 1, 0, R.rub, 0), c(i + 1, 1, 0.022, R.rub, 1), c(i, 1, 0.022, R.rub, 1), [0, 1, 0]);
  quadToward(fit, c(i, 0, 0, R.rub, 0), c(i + 1, 0, 0, R.rub, 0), c(i + 1, 0, 0.022, R.rub, 1), c(i, 0, 0.022, R.rub, 1), [0, -1, 0]);
  if (i === 2) quadToward(fit, c(3, 0, 0, R.rub, 0), c(3, 0, 0.022, R.rub, 1), c(3, 1, 0.022, R.rub, 1), c(3, 1, 0, R.rub, 0), [0, 0, 1]); }

// ---- lay her over: everything so far was built in the hull's own coordinates
for (const p of [hull, wood, fit, round]) for (const t of p.tris) for (const c of t) c.p = lay(c.p);

// ---- reeds: out through the gap in her bow and up, and up through her well
const rnd = rng(41);
const blade = (foot, mid, tip, w, k) => { const r = R.blades.sub(k / 6, 0, (k + 1) / 6, 1), a = rnd() * Math.PI, s = [Math.cos(a) * w / 2, 0, Math.sin(a) * w / 2];
  const c = (p, sx, kk, v) => [add(p, mul(s, sx * kk)), r.at(0.5 + 0.5 * sx * kk, v)];
  for (const f of [1, -1]) { const n = mul(cross(s, sub(tip, foot)), f);
    quadToward(grow, c(foot, -1, 1, 0), c(foot, 1, 1, 0), c(mid, 1, 0.9, 0.5), c(mid, -1, 0.9, 0.5), n); triToward(grow, c(mid, -1, 0.9, 0.5), c(mid, 1, 0.9, 0.5), [tip, r.at(0.5, 1)], n); } };
const rush = (foot, tip) => { const d = sub(tip, foot), p = (t) => add(foot, mul(d, t));
  grow.tube([foot, p(0.72)], 0.008, 3, R.bulrush.sub(0, 0, 1, 0.7), { open: true });
  grow.tube([p(0.72), p(0.74), p(0.92), p(0.94), p(1)], [0.008, 0.024, 0.024, 0.006, 0.003], 5, R.bulrush.sub(0, 0.7, 1, 1), { open: true }); };
for (let i = 0; i < 11; i++) { const z = 1.20 + 0.70 * (i + 0.5) / 11 + (rnd() - 0.5) * 0.04, out = lay(skin(z, 0.25, 0.02 + rnd() * 0.05)), h = 0.75 + rnd() * 0.75, lean = [0.10 + rnd() * 0.22, (rnd() - 0.5) * 0.3];
  blade(add(out, [-0.05, -0.06, 0]), add(out, [lean[0] * 0.35, h * 0.5, lean[1] * 0.3]), add(out, [lean[0], h, lean[1]]), 0.05 + rnd() * 0.025, i % 6); }
{ const o = lay(skin(1.52, 0.25, 0.05)); rush(add(o, [-0.03, -0.05, 0]), add(o, [0.16, 1.62, 0.05])); const q = lay(skin(1.78, 0.25, 0.06)); rush(add(q, [-0.03, -0.05, 0]), add(q, [0.30, 1.34, -0.10])); }
for (let i = 0; i < 8; i++) { const foot = lay([0.10 + rnd() * 0.30, SOLE - 0.05, -0.45 + rnd() * 0.42]), h = 1.15 + rnd() * 0.7, lean = [(rnd() - 0.6) * 0.3, (rnd() - 0.5) * 0.3];
  blade(foot, add(foot, [lean[0] * 0.35, h * 0.5, lean[1] * 0.35]), add(foot, [lean[0], h, lean[1]]), 0.055 + rnd() * 0.025, (i + 3) % 6); }
{ const f = lay([0.24, SOLE - 0.05, -0.22]); rush(f, add(f, [-0.08, 2.05, 0.06])); }

// ---- weed: ragged ribbons clinging to her bottom from the old waterline down, each ending in two tails; a deep one hangs
// plumb from where it leaves her and reaches DEEP, whatever the bar does under her
const cling = (z, y, sx, off = 0.014) => { const zz = Math.max(ZT + 0.07, Math.min(2.25, z)); return lay([sx * (P.half(zz, y) + off), y, zz]); };
const tuft = (z, sx, k, wide, long, deep) => { const r = R.weed.sub(k / 10, 0, (k + 1) / 10, 1), w = wide / 2, y0 = 0.05 + (rnd() - 0.5) * 0.03, yb = P.lines(z).yb + 0.03;
  const y1 = Math.max(yb, y0 - long * 0.5), d = (rnd() - 0.5) * wide * 0.6, w1 = w * (0.85 + rnd() * 0.4), out = sub(cling(z, y1, sx, 0.3), cling(z, y1, sx, 0));
  const tail = (dz, plumb) => { const y = Math.max(yb - 0.02, y0 - long * (0.7 + rnd() * 0.6)), q = cling(z + d + dz + (rnd() - 0.5) * w, y, sx); return plumb ? [q[0] + sx * 0.03, DEEP, q[2] + (rnd() - 0.5) * 0.3] : q; };
  const A = [cling(z - w * 0.5, y0, sx), r.at(0.2, 1)], B = [cling(z + w * 0.5, y0, sx), r.at(0.8, 1)], C = [cling(z + d - w1, y1, sx), r.at(0, 0.5)], D = [cling(z + d + w1, y1, sx), r.at(1, 0.5)], M = [cling(z + d, y1 - 0.01, sx), r.at(0.5, 0.5)];
  quadToward(plumb, A, B, D, C, out); triToward(plumb, C, M, [tail(-w1 * 0.55, deep), r.at(0.25, 0)], out); triToward(plumb, M, D, [tail(w1 * 0.55, false), r.at(0.75, 0)], out); };
// port, the high side: a fringe with gaps in it and a deep one here and there; starboard: deep ones, under water from the top
for (let i = 0; i < 30; i++) { const z = -2.28 + 4.4 * (i + 0.15 + rnd() * 0.7) / 30; if (i % 7 === 4) continue; tuft(z, 1, Math.floor(rnd() * 10), 0.09 + rnd() * 0.08, 0.16 + rnd() * 0.4, i % 6 === 2); }
for (let i = 0; i < 8; i++) tuft(-2.2 + 4.2 * (i + rnd()) / 8, -1, Math.floor(rnd() * 10), 0.14 + rnd() * 0.06, 0.4, true);

// ---- the moorhen's nest on the port stern sheets, built level, and three eggs in it
{ const W = lay([0.36, SEAT, -1.98]), c = [W[0], W[1] + 0.02, W[2]];
  within(nestP, move(c), (n) => { n.lathe([[0.12, -0.11], [0.26, -0.04], [0.285, 0.07], [0.24, 0.135]], 9, R.nest, { wobble: (i, j) => 1 + 0.07 * Math.sin(j * 2.3 + i) });
    n.lathe([[0.24, 0.135], [0.165, 0.085], [0, 0.06]], 9, R.nestIn, { wobble: (i, j) => (i === 0 ? 1 + 0.07 * Math.sin(j * 2.3 + 3) : 1) }); });
  const eggAt = (dx, dz, yaw, tip) => within(nestP, compose(move([c[0] + dx, c[1] + 0.098, c[2] + dz]), rotY(yaw), rotZ(rad(90 + tip))), (e) => e.lathe([[0, -0.046], [0.027, -0.026], [0.034, 0.004], [0.022, 0.038], [0, 0.052]], 5, R.egg));
  eggAt(-0.055, 0.02, 0.5, 6); eggAt(0.045, 0.055, 2.3, -5); eggAt(0.02, -0.065, 4.0, 8); }

await emit(m, R, ATLAS, args, { size: 2048 });
