// build-vertebra.mjs : a single vertebra lying awash in Saltbone Reach, built in code (no generation job).
// Usage: node build-vertebra.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A drum of bone the size of a cart, lying on one end and tipped a few degrees, with three stubby wings: one to either
// side (+X and -X, each swept 14 degrees toward +Z) and one behind (-Z). 2.6 m across the wings, 1.4 m above the origin, and the
// drum goes on 1 m below it (for the swell, and for burying it in a beach). Its upper end is dished, with rings of
// growth and a spongy middle; the rim is chipped. Origin at the waterline on the drum's axis. One material, `main`.
// Painted by place like the ribs (reachmats.py `bone`): green and weedy between the tides, limpets, no lichen.
import { Model, strip, cli, emit, add, sub, mul, cross, rad, rng, compose, rotX, rotZ } from './kit.mjs';
import { writeGeo } from './geomap.mjs';
import { limpetCone } from './reach-parts.mjs';

const args = cli(), ATLAS = [1024, 512], SIDES = 12, HIGH = 1.4, ACROSS = 2.6, rnd = rng(57);
const tilt = compose(rotZ(rad(4)), rotX(rad(-3)));
const tide = { top: 0.55, limpets: 7, size: [0.055, 0.085] }, skin = { mat: 'bone', tide, cracks: 0.6, soft: 0 };

// the drum's side and its upper end, as one profile: [radius, height]; `v` is how far up its patch each point lies (the metre under the water is squeezed into the foot of it)
const profile = (lift) => [[0.90, -1.0], [0.97, -0.15], [0.94, 0.38], [0.87, 0.80], [0.93, 1.14], [0.96, 1.28 + lift], [0.87, 1.365 + lift], [0.50, 1.31 + lift], [0, 1.295 + lift]];
const VS = [0.004, 0.10, 0.26, 0.40, 0.52, 0.58, 0.63, 0.82, 0.996];
const chip = Array.from({ length: SIDES }, () => 1 + 0.05 * (2 * rnd() - 1)), wob = (i, j) => (i >= 5 && i <= 6 && j === 4 ? 0.87 : i >= 5 && i <= 6 && j === 9 ? 0.93 : 1) * (i < 8 ? chip[(j + 3 * i) % SIDES] : 1);
// the wings: which way each points (degrees from +X toward -Z), how long it is (1 = to 1.3 m from the axis), how it is turned
const WINGS = [[-14, 1.0, 0.0], [194, 0.94, 0.05], [92, 0.9, -0.04]];
const stations = (reach) => [[0.72, 0.17, 0.20, 1.20], [1.0, 0.14, 0.27, 1.13], [1.0 + 0.72 * (reach - 1.0), 0.105, 0.40, 1.00], [reach, 0.07, 0.54, 0.88]];      // [out from the axis, half thickness, bottom, top]

const build = (lift, reach) => {
  const R = {
    drum: strip(0, 0, 760, 512, { ...skin, tile_x: true, end: null }, 57),
    wing0: strip(772, 4, 1020, 100, skin, 57), wing1: strip(772, 112, 1020, 208, skin, 57), wing2: strip(772, 220, 1020, 316, skin, 57),
    tips: strip(772, 328, 900, 372, skin, 57),
    limpet: strip(920, 328, 1016, 424, { mat: 'limpet' }, 58),
  };
  const m = new Model('vertebra'); m.material('main', { kind: 'texture', roughness: 0.92 });
  const g = m.part('drum', { crease: 40, xf: tilt }), w = m.part('wings', { crease: 40, xf: tilt }), bits = m.part('limpets', { crease: 35, xf: tilt });
  const prof = profile(lift);
  g.lathe(prof, SIDES, R.drum, { v: VS, wobble: (i, j) => wob(i, j % SIDES), shade: (i) => (i < 1 ? 0.8 : i > 6 ? 0.94 : 1) });
  WINGS.forEach(([deg, len, lean], k) => {
    const d = [Math.cos(rad(deg)), 0, -Math.sin(rad(deg))], s = cross([0, 1, 0], d), rect = R['wing' + k], st = stations(reach * len);
    const rings = st.map(([out, half, lo, hi], i) => { const c = add(mul(d, out), mul(s, lean * out * i)); return [add(add(c, mul(s, half)), [0, lo, 0]), add(add(c, mul(s, half)), [0, hi, 0]), add(add(c, mul(s, -half)), [0, hi, 0]), add(add(c, mul(s, -half)), [0, lo, 0])]; });
    const U = [0, 0.42, 0.5, 0.92, 1], C = (i, j) => [rings[i][j % 4], rect.at(U[j], 0.02 + 0.96 * i / (st.length - 1)), 1];
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 4; j++) w.quad(C(i, j), C(i, j + 1), C(i + 1, j + 1), C(i + 1, j));
    const e = rings[rings.length - 1], t = R.tips.sub(k / 3 + 0.02, 0.05, (k + 1) / 3 - 0.02, 0.95); w.quad([e[0], t.at(1, 0), 0.95], [e[1], t.at(1, 1), 0.95], [e[2], t.at(0, 1), 0.95], [e[3], t.at(0, 0), 0.95]);
  });
  // limpets on the drum between the tides
  const radiusAt = (y) => { for (let i = 0; i + 1 < prof.length; i++) if (y >= prof[i][1] && y <= prof[i + 1][1]) return prof[i][0] + (prof[i + 1][0] - prof[i][0]) * (y - prof[i][1]) / (prof[i + 1][1] - prof[i][1]); return 0.9; };
  const lr = rng(91); for (const deg of [40, 68, 128, 238, 262, 300, 334]) { const y = 0.14 + 0.5 * lr(), a = rad(deg + 10 * lr()), n = [Math.cos(a), 0, -Math.sin(a)]; limpetCone(bits, add(mul(n, radiusAt(y) * 0.985), [0, y, 0]), n, 0.10 + 0.05 * lr(), R.limpet, lr() * 6); }
  const top = tilt([0, 1.3 + lift, 0]); R.drum.paint.end = { c: [+top[0].toFixed(3), +top[2].toFixed(3)], r: 0.9 };
  return { m, R };
};
const reachOf = ({ m }) => { let hi = -9, x0 = 9, x1 = -9; for (const p of m.parts) for (const t of p.tris) for (const c of t) { hi = Math.max(hi, c.p[1]); x0 = Math.min(x0, c.p[0]); x1 = Math.max(x1, c.p[0]); } return { hi, across: x1 - x0 }; };
let lift = 0, reach = 1.3, B = build(lift, reach);
for (let k = 0; k < 12; k++) { const q = reachOf(B); lift += HIGH - q.hi; reach += (ACROSS - q.across) / 2; B = build(lift, reach); }      // fitted: 1.4 m high, 2.6 m across the wings
await emit(B.m, B.R, ATLAS, args, { size: ATLAS, quality: 88, extra: writeGeo(B.m, ATLAS, args) });
