// build-listening-post.mjs : Isolde's listening post in Mossglass Fen, built in code (no generation job).
// Usage: node build-listening-post.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A weathered plank platform 2.4 m square on four piles, its deck 0.45 m above the water, one plank broken short. On it
// a great brass ear trumpet 1.6 m long with a bell 0.9 m across, hung in a yoke on a post and pointed down at the water
// off the front (+Z); a three-legged stool behind its earpiece; a dead lantern; a coil of rope; and a tin box for the
// logbook. Origin at the waterline under the middle of the platform; the piles go on 1.5 m below it.
// One material, `main` (the lantern is dead: its panes are painted dull and do not glow).
// The tin box is a child node `LogBox` with its origin on the deck under the middle of the box.
import { Model, pack, cli, emit, within, rotX, rotY, move, compose, rad, rng } from './kit.mjs';
import { cagedLantern, lanternRects } from './fen-parts.mjs';

const args = cli(); const ATLAS = [1024, 1024]; const rnd = rng(31);
const D = 0.45, HALF = 1.2, DEEP = -1.5, N = 12, TILT = 28;                 // deck height, half the platform, how deep the piles go, planks, how far the horn points down
const PIVOT = [0, D + 0.85, 0.55], BOX = [0.56, D, -0.62], STOOL = [-0.04, -0.52];
const R = pack(...ATLAS, {
  deck: [400, 400, { mat: 'wood', planks: N, along: 'x', tone: 'grey', weather: 0.85, nails: 4, gap: 1.2 }],
  side: [300, 22, { mat: 'wood', tone: 'grey', along: 'x', weather: 0.5, light: 0.8 }], under: [128, 128, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.2, light: 0.7 }],
  beam: [300, 44, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.4 }],
  pile: [128, 400, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.6, tile_x: true, water: [DEEP, D + 0.34], barnacles: 0.6 }],
  horn: [320, 420, { mat: 'brass', tile_x: true, top: 0.3, patina: 0.55, verdigris: 0.5 }], hornIn: [256, 150, { mat: 'brass', tile_x: true, top: 0.5, patina: 0.7, verdigris: 0.3, light: 0.8 }],
  band: [256, 24, { mat: 'brass', tile_x: true, patina: 0.2, verdigris: 0.1, edge: 0.5 }], brass: [96, 96, { mat: 'brass', patina: 0.4 }],
  post: [72, 260, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.4, tile_x: true }], seat: [100, 100, { mat: 'endgrain', tone: 'drift' }], leg: [40, 128, { mat: 'wood', tone: 'drift', along: 'y', weather: 0.5, tile_x: true }],
  tin: [180, 110, { mat: 'tin', edge: 0.4, ao: { bottom: 0.3 } }], tinLid: [180, 110, { mat: 'tin', colour: '#7F8E8C', edge: 0.5 }],
  rope: [160, 36, { mat: 'rope', pitch: 32 }],
  ...lanternRects(170, 'dead', { frame: 'iron' }),
});

const m = new Model('listening-post');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.node('LogBox', BOX);
const deck = m.part('platform', { crease: 40 }), horn = m.part('horn', { crease: 50 }), fit = m.part('things', { crease: 40 }), log = m.part('logbox', { node: 'LogBox', crease: 40 });

// ---- the platform: twelve planks laid across three beams, on four piles that stand a little above the deck
for (let k = 0; k < N; k++) {
  const z = -HALF + (k + 0.5) * (2 * HALF / N), broken = k === 9, x0 = -HALF - 0.05 * rnd(), x1 = broken ? 0.18 : HALF + 0.05 * rnd(), dy = -0.012 * rnd(), tip = (rnd() - 0.5) * 0.012;
  const strip = R.deck.sub(0, k / N, (x1 - x0) / (2 * HALF + 0.1), (k + 1) / N);
  deck.box([(x0 + x1) / 2, D - 0.025 + dy, z], [(x1 - x0) / 2, 0.025, HALF / N - 0.006], { py: strip, ny: R.under, pz: R.side, nz: R.side, px: R.side.sub(0, 0, 0.1, 1), nx: R.side.sub(0, 0, 0.1, 1) },
    { warp: (p) => [p[0], p[1] + tip * p[0] + (broken && p[0] > 0 ? -0.03 : 0), p[2]], shade: { ny: 0.6, pz: 0.8, nz: 0.8 } });
}
for (const x of [-0.9, 0, 0.9]) deck.box([x, D - 0.12, 0], [0.06, 0.07, HALF - 0.02], { px: R.beam, nx: R.beam, ny: R.beam, pz: R.beam.sub(0, 0, 0.1, 1), nz: R.beam.sub(0, 0, 0.1, 1), py: R.beam }, { shade: { ny: 0.6, py: 0.7 } });
for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lean = [(rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12], top = D + 0.2 + 0.14 * rnd();
  deck.tube([[sx * 1.07 + lean[0], DEEP, sz * 1.07 + lean[1]], [sx * 1.07, top, sz * 1.07]], [0.125, 0.11], 6, R.pile, { v: [0, (top - DEEP) / (D + 0.34 - DEEP)] }); }

// ---- the ear trumpet: turned about its own axis, then hung at the pivot pointing forward and down
const hang = compose(move(PIVOT), rotX(rad(90 + TILT)));
within(horn, hang, (p) => {
  p.lathe([[0.034, -0.85], [0.016, -0.80], [0.021, -0.50], [0.036, -0.12], [0.07, 0.24], [0.135, 0.50], [0.26, 0.665], [0.45, 0.75], [0.462, 0.762]], 16, R.horn);
  p.lathe([[0.462, 0.762], [0.445, 0.765], [0.255, 0.68], [0.13, 0.515], [0.066, 0.26], [0.03, -0.05], [0, -0.06]], 16, R.hornIn, { shade: (i) => [1, 0.95, 0.75, 0.55, 0.38, 0.22, 0.15][i] });
  p.lathe([[0.046, -0.035], [0.058, -0.03], [0.062, 0.03], [0.052, 0.035]], 8, R.band);                    // the band the trunnions are fixed to
  p.lathe([[0.150, 0.50], [0.158, 0.505], [0.172, 0.535], [0.166, 0.54]], 16, R.band);                     // a band where the bell begins
});
// the stand: a post on a foot, three stays, a collar, and a yoke whose arms carry the trunnions
const PX = PIVOT[0], PY = PIVOT[1], PZ = PIVOT[2];
within(fit, move([PX, 0, PZ]), (p) => {
  p.lathe([[0.17, D], [0.17, D + 0.03], [0.075, D + 0.07], [0.052, D + 0.13], [0.046, PY - 0.33]], 8, R.post);
  p.lathe([[0.046, PY - 0.33], [0.072, PY - 0.31], [0.072, PY - 0.26], [0.03, PY - 0.25], [0, PY - 0.25]], 8, R.brass);
  for (const a of [90, 210, 330]) p.tube([[0.3 * Math.cos(rad(a)), D, -0.3 * Math.sin(rad(a))], [0.04 * Math.cos(rad(a)), D + 0.42, -0.04 * Math.sin(rad(a))]], 0.02, 4, R.post, { open: true });
  p.tube([[-0.15, PY + 0.02, 0], [-0.15, PY - 0.14, 0], [-0.08, PY - 0.24, 0], [0.08, PY - 0.24, 0], [0.15, PY - 0.14, 0], [0.15, PY + 0.02, 0]], 0.022, 4, R.brass, { twist: Math.PI / 4 });
  for (const s of [-1, 1]) p.tube([[s * 0.16, PY, 0], [s * 0.05, PY, 0]], 0.014, 4, R.brass, { open: true });
});

// ---- the stool behind the earpiece
within(fit, move([STOOL[0], D, STOOL[1]]), (p) => {
  p.lathe([[0, 0.42], [0.17, 0.42], [0.178, 0.46], [0, 0.468]], 8, R.seat, { v: [0.5, 0.05, 0, 0.5], shade: (i) => (i === 0 ? 0.6 : 1) });
  for (const a of [30, 150, 270]) p.tube([[0.2 * Math.cos(rad(a)), 0, -0.2 * Math.sin(rad(a))], [0.09 * Math.cos(rad(a)), 0.43, -0.09 * Math.sin(rad(a))]], [0.024, 0.02], 4, R.leg, { open: true });
});

// ---- the dead lantern, standing on the deck, and a coil of rope
const L = cagedLantern(fit, fit, R, { at: [-0.72, D, -0.18], h: 0.42, r: 0.075, turn: rad(20) });
for (const [y, rr, turn] of [[0.03, 0.19, 0], [0.085, 0.16, 0.5]]) fit.torus(rr, 0.03, 8, 3, R.rope, { xf: compose(move([0.76, D + y, 0.18]), rotY(turn)), wrap: 2 });

// ---- the tin box for the logbook: its own node
within(log, compose(move(BOX), rotY(rad(24))), (p) => {
  const W = 0.18, H = 0.16, Z = 0.12, lid = 0.07;
  p.box([0, H / 2, 0], [W, H / 2, Z], { pz: R.tin, nz: R.tin, px: R.tin.sub(0, 0, 0.66, 1), nx: R.tin.sub(0, 0, 0.66, 1) });
  p.box([0, H + lid / 2, 0], [W + 0.007, lid / 2, Z + 0.007], { py: R.tinLid, pz: R.tinLid.sub(0, 0, 1, 0.35), nz: R.tinLid.sub(0, 0, 1, 0.35), px: R.tinLid.sub(0, 0, 0.66, 0.35), nx: R.tinLid.sub(0, 0, 0.66, 0.35), ny: R.tinLid.sub(0, 0, 1, 0.2) }, { shade: { ny: 0.6 } });
  p.tube([[-0.07, H + lid, 0], [-0.055, H + lid + 0.035, 0], [0.055, H + lid + 0.035, 0], [0.07, H + lid, 0]], 0.008, 3, R.brass, { open: true });
  p.box([0, H - 0.005, Z + 0.012], [0.024, 0.04, 0.006], R.brass);
});

await emit(m, R, ATLAS, args, { extra: { lantern: L, pivot: PIVOT } });
