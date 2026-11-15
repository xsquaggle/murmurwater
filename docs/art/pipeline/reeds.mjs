// reeds.mjs : a clump of reeds and bulrushes for Mossglass Fen, built from blades (build-reeds-a.mjs, build-reeds-b.mjs).
// Every blade is a flat ribbon (a quad and a pointed tip) and every bulrush a ribbon stem with a three-sided head.
// Origin at the waterline in the middle of the clump, +Y up, metres; the feet are 0.6 m below it.
// One material, `main`, double-sided. UV v runs 0 at the foot to 1 at the tip of every blade and every bulrush
// (the foot is the top row of the texture), so the game can sway them by it.
import { Model, strip, emit, add, mul, sub, len, rad, rng } from './kit.mjs';

const out = (a) => [Math.cos(rad(a)), 0, -Math.sin(rad(a))];
const FOOT = -0.6, HEAD = 0.80, SPIKE = 0.93, LANES = 5, ACROSS = 0.6;

/** spec: { name, seed, tall (m above the water), blades, shorts, rushes, spread (radius the feet stand in), dry } */
export const reedClump = async (spec, args) => {
  const ATLAS = [256, 512], rnd = rng(spec.seed);
  const R = {
    blade: strip(0, 0, 160, 512, { mat: 'blade', n: LANES, dry: spec.dry ?? 0.3, flip: true, soft: 2 }, spec.seed),
    rushA: strip(168, 0, 208, 512, { mat: 'bulrush', head: HEAD, tip: SPIKE, flip: true, soft: 2 }, spec.seed + 1),
    rushB: strip(212, 0, 252, 512, { mat: 'bulrush', head: HEAD, tip: SPIKE, flip: true, soft: 2 }, spec.seed + 2),
  };
  const m = new Model(spec.name); m.material('main', { kind: 'texture', roughness: 0.9, doubleSided: true });
  const g = m.part('reeds', { crease: 50 });
  const spot = (k, n) => { const a = (k + rnd()) / n * 360 + 40 * rnd(), r = spec.spread * Math.sqrt(0.08 + 0.92 * rnd()); return { a, r, base: [r * Math.cos(rad(a)), -r * Math.sin(rad(a))] }; };

  let lanes = 0;
  /** A blade from a foot under the water: it stands `h` above the water and its tip ends `reach` further out along `az`; `arc` bends it. */
  const blade = (base, az, h, reach, w, arc) => {
    const lane = R.blade.sub((lanes % LANES) / LANES, 0, (lanes % LANES + 1) / LANES, 1); lanes++;
    const d = out(az), t = out(az + 90 + (rnd() - 0.5) * 70), L = h - FOOT, k = 0.5 + 0.14 * rnd();
    const foot = [base[0], FOOT, base[1]], mid = add(foot, add(mul(d, reach * k * (1 - arc)), [0, L * k, 0])), tip = add(foot, add(mul(d, reach), [0, L, 0]));
    const vm = len(sub(mid, foot)) / (len(sub(mid, foot)) + len(sub(tip, mid)));
    const fl = add(foot, mul(t, -w / 2)), fr = add(foot, mul(t, w / 2)), ml = add(mid, mul(t, -w * 0.42)), mr = add(mid, mul(t, w * 0.42));
    g.quad([fl, lane.at(0.1, 1), 0.72], [fr, lane.at(0.9, 1), 0.72], [mr, lane.at(0.84, 1 - vm), 0.96], [ml, lane.at(0.16, 1 - vm), 0.96]);
    g.tri([ml, lane.at(0.16, 1 - vm), 0.96], [mr, lane.at(0.84, 1 - vm), 0.96], [tip, lane.at(0.5, 0), 1]);
  };
  /** A bulrush: a straight stem, a brown head from HEAD to SPIKE of its length, a spike above. */
  const rush = (base, az, h, reach, rect) => {
    const d = out(az), L = h - FOOT, foot = [base[0], FOOT, base[1]], P = (v) => add(foot, add(mul(d, reach * v), [0, L * v, 0]));
    const t = out(rnd() * 360), sw = 0.017, hr = 0.036 + 0.008 * rnd(), a0 = rnd() * 360;
    const S = (v, side, k) => [add(P(v), mul(t, side * sw * k)), rect.at(0.5 + side * 0.14, 1 - v), 0.7 + 0.3 * v];
    g.quad(S(0, -1, 1), S(0, 1, 1), S(HEAD + 0.01, 1, 0.8), S(HEAD + 0.01, -1, 0.8));
    const ring = (v, r, j) => [add(P(v), mul(out(a0 + 120 * j), r)), rect.at(j / 3, 1 - v), 1];
    for (let j = 0; j < 3; j++) {
      g.quad(ring(HEAD, hr * 0.85, j), ring(HEAD, hr * 0.85, j + 1), ring(SPIKE, hr, j + 1), ring(SPIKE, hr, j));
      g.tri(ring(SPIKE, hr, j), ring(SPIKE, hr, j + 1), [P(1), rect.at((j + 0.5) / 3, 0), 1]);
      g.tri([P(HEAD - 0.012), rect.at((j + 0.5) / 3, 1 - HEAD + 0.012), 0.85], ring(HEAD, hr * 0.85, j + 1), ring(HEAD, hr * 0.85, j));
    }
  };

  const tipAt = (s) => Math.min(ACROSS - 0.02, s.r + (ACROSS - s.r) * (0.25 + 0.75 * rnd()));          // how far from the middle a tip ends: inside 1.2 m across
  for (let i = 0; i < spec.blades; i++) { const s = spot(i, spec.blades), h = spec.tall * (0.62 + 0.36 * rnd()); blade(s.base, s.a + (rnd() - 0.5) * 50, h, tipAt(s) - s.r, 0.06 + 0.035 * rnd(), 0.25 + 0.5 * rnd()); }
  for (let i = 0; i < (spec.shorts || 0); i++) { const s = spot(i, spec.shorts), h = spec.tall * (0.28 + 0.2 * rnd()); blade(s.base, s.a + (rnd() - 0.5) * 60, h, (tipAt(s) - s.r) * 0.8, 0.07 + 0.03 * rnd(), 0.5 + 0.4 * rnd()); }
  for (let i = 0; i < spec.rushes; i++) { const s = spot(i, spec.rushes), h = spec.tall * (0.84 + 0.16 * (i === 0 ? 1 : rnd())); rush([s.base[0] * 0.7, s.base[1] * 0.7], s.a, h, (tipAt(s) - s.r) * 0.45, i % 2 ? R.rushB : R.rushA); }

  return emit(m, R, ATLAS, args, { quality: 88 });
};
