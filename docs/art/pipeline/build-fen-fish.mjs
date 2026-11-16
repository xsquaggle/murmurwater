// build-fen-fish.mjs : the ten fish of Mossglass Fen, built in code (no generation job).
// Usage: node build-fen-fish.mjs <fish> <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py; make-fish.sh does all of it)
// Every fish is 1 m from nose (+Z) to tail (-Z) with the middle of its bounds at the origin, one material `main`;
// what glows after dark is painted into the emissive map. The game scales each to its species' length.
import { cli, rad, add, sub, mul, norm, cross, rng } from './kit.mjs';
import { buildFish, mirrored, membrane, aim } from './fish.mjs';

// ---- pieces that more than one fish carries
/** Barbels, both sides: each starts on the skin at (s, a degrees) and follows `path` (offsets from there, for the right side). */
const whiskers = (bits, r, B, list) => mirrored(bits, (p) => { for (const { s, a, path, r0 = 0.007 } of list) { const o = B.pt(s, rad(a)); p.tube(path.map((d) => add(o, d)), path.map((_, i) => r0 * (1 - 0.75 * i / (path.length - 1))), 4, r); } });
/** A blade of grass: from `root`, `len` long toward `up`, bending over toward `over`, `width` at its foot; folded a little along its middle. */
const blade = (part, r, root, { up = [0, 1, 0], over = [0, 0, -1], len = 0.12, width = 0.014, bend = 0.05, rows = 4 }) => {
  const ax = norm(cross(over, up)), G = [[], [], []];
  for (let j = 0; j <= rows; j++) { const t = j / rows, c = add(root, add(mul(up, len * t * (1 - 0.25 * t)), mul(over, bend * t * t))), w = width * (1 - t ** 1.6) / 2; G[0].push(add(c, mul(ax, -w))); G[1].push(add(c, mul(over, -0.25 * w))); G[2].push(add(c, mul(ax, w))); }
  return membrane(part, G, r);
};
/** A small flower on a stalk: a five-pointed star facing along `dir`. */
const flowerOn = (part, rF, rS, base, dir, size = 0.03, stalk = 0.035) => {
  const d = norm(dir), top = add(base, mul(d, stalk)), xf = aim(top, d);
  part.tube([sub(base, mul(d, 0.01)), top], 0.0035, 3, rS, { open: true });
  const P = (k) => { const a = 2 * Math.PI * k / 10, rr = k % 2 ? size * 0.52 : size; return [xf([rr * Math.cos(a), k % 2 ? 0 : 0.2 * size, -rr * Math.sin(a)]), rF.at(0.5 + 0.5 * rr / size * Math.cos(a), 0.5 + 0.5 * rr / size * Math.sin(a))]; };
  const c = [xf([0, -0.05 * size, 0]), rF.at(0.5, 0.5)];
  for (let k = 0; k < 10; k++) { part.tri(c, P(k), P(k + 1)); part.tri(c, P(k + 1), P(k)); }
  return part;
};

const FIN = (seed, o) => ({ mat: 'fin', seed, soft: 0, ...o });
const SIDE = [832, 368];
const skin = (B, o, size = SIDE) => [...size, { mat: 'fishskin', soft: 0, ratio: B.ratio(...size), ...o }];
const eyeAt = (B, e) => [...B.uv(e.s, e.a), e.size / B.L];

const FISH = {
  // Reedling, 0.28 m: pencil-thin, pale straw green with dark upright bars like reed shadows, a small upturned mouth.
  reedling: (() => { const E = { s: 0.085, a: 22, size: 0.03, bulge: 0.7, look: 0.4 }; return {
    len: 0.80, rings: 20, around: 6, mouth: { tilt: 38, tiltReach: 0.09 },
    body: [[0, 0.034, 0.012, 0.012], [0.03, 0.046, -0.014, 0.027], [0.10, 0.056, -0.044, 0.042], [0.3, 0.062, -0.056, 0.046], [0.6, 0.052, -0.048, 0.038], [0.85, 0.032, -0.03, 0.02], [1, 0.022, -0.02, 0.011]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#93A465', flank: '#D2DBA2', belly: '#F2F3DC', split: [0.26, 0.74], blend: [0.10, 0.12],
        bars: { n: 10, colour: '#3F5034', u: [0.15, 0.99], width: 0.24, uneven: 0.55, low: 0.2, fade: 0.1, tilt: 0.35, wob: 0.12, taper: 0.35, amount: 0.8, soft: 0.05 },
        gill: { u: 0.145, bend: 0.02, v: [0.2, 0.78], colour: '#5E6E44', amount: 0.5 }, mouth: { to: 0.05, v: 0.5, v1: 0.3, w: 2.2, colour: '#4A5234' },
        eye: eyeAt(B, E), socket: { colour: '#5E6E44', amount: 0.4, grow: 1.4 }, sheen: 0.14 }, [832, 200]),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#E6CF62', pupil: 0.5, iris_r: 0.76 }],
      fin: [224, 96, FIN(5, { colour: '#D6DEA8', tip: '#F3F5DE', root: '#AAB67C', rays: 5, ray: '#8C9C60' })],
      tail: [224, 120, FIN(6, { colour: '#D6DEA8', tip: '#F3F5DE', root: '#AAB67C', rays: 6, ray: '#8C9C60', band: { colour: '#55653F', v: [0.52, 0.66], amount: 0.5 } })],
      pec: [128, 96, FIN(7, { colour: '#DEE5B8', tip: '#F6F7E6', root: '#AAB67C', rays: 4, ray: '#8C9C60' })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.55, to: 0.70, h: 0.062, rays: 5, spike: 0.15, sweep: 0.8, sink: 0.006, thick: 0.008, shape: [[0, 0.9], [0.25, 1], [1, 0.4]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.64, to: 0.80, h: 0.045, rays: 5, spike: 0.15, sweep: 0.8, sink: 0.006, thick: 0.008, shape: [[0, 0.9], [0.25, 1], [1, 0.4]] },
      { kind: 'tail', rect: 'tail', len: 0.21, spread: 30, fork: 0.5, rays: 6, spike: 0.1, thick: 0.01 },
      { kind: 'side', rect: 'pec', s: 0.175, a: -18, len: 0.075, fan: 32, root: 0.022, dir: [0.6, -0.35, -0.7], rays: 4 },
      { kind: 'side', rect: 'pec', s: 0.44, a: -72, len: 0.048, fan: 28, root: 0.016, dir: [0.3, -0.7, -0.65], rays: 4 },
    ],
  }; })(),

  // Mudlark, 0.30 m: squat and wide-mouthed, warm brown with a cream throat and short whiskers; a cheerful face.
  mudlark: (() => { const E = { s: 0.13, a: 40, size: 0.055, bulge: 0.7, look: 0.45 }; return {
    len: 0.74, mid: 0.42, pow: 0.9, rings: 18, around: 8, mouth: { open: true, smile: 0.04, reach: 0.12, depth: 0.07 },
    body: [[0, 0.03, -0.045, 0.13], [0.05, 0.10, -0.10, 0.175], [0.15, 0.17, -0.135, 0.215], [0.32, 0.20, -0.15, 0.22], [0.55, 0.17, -0.125, 0.165], [0.8, 0.10, -0.07, 0.08], [1, 0.062, -0.04, 0.035]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#6B4428', flank: '#A8703C', belly: '#D9B078', split: [0.30, 0.70], blend: [0.10, 0.14],
        head: { to: 0.30, colour: '#F6E8C4', amount: 0.95, v: [-1, 0.33], soft: 0.06 }, mottle: [{ colour: '#56351F', amount: 0.4, cells: [4, 9], cut: [0.58, 0.75], v: [0.5, 2] }],
        spots: { colour: '#5A3820', n: 16, r: 0.012, u: [0.3, 0.95], v: [0.45, 0.9], amount: 0.5 }, gill: { u: 0.30, bend: 0.04, v: [0.16, 0.74], colour: '#4A2C18', amount: 0.6, w: 2.8 },
        lip: { to: 0.02, colour: '#7A4A2A', amount: 0.7 }, blobs: [{ u: 0.20, v: 0.40, r: 0.035, colour: '#E58E6E', amount: 0.55 }], eye: eyeAt(B, E), socket: { colour: '#4A2C18', amount: 0.45, grow: 1.45 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#7A4A22', pupil: 0.56, iris_r: 0.80 }], maw: [112, 80, { mat: 'maw', soft: 0 }],
      fin: [224, 104, FIN(5, { colour: '#C4853F', tip: '#EDBE74', root: '#8A5630', rays: 6, ray: '#6E4424' })],
      tail: [224, 104, FIN(6, { colour: '#C4853F', tip: '#EDBE74', root: '#8A5630', rays: 7, ray: '#6E4424' })],
      pec: [160, 104, FIN(7, { colour: '#D09248', tip: '#F2CC88', root: '#8A5630', rays: 5, ray: '#6E4424' })],
      whisker: [16, 64, { mat: 'flat', colour: '#8A5A34', var: 0.15 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.38, to: 0.74, h: 0.11, rays: 6, spike: 0.18, sweep: 0.55, shape: [[0, 0.7], [0.3, 1], [0.7, 0.85], [1, 0.4]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.62, to: 0.84, h: 0.07, rays: 6, spike: 0.18, sweep: 0.6 },
      { kind: 'tail', rect: 'tail', len: 0.25, spread: 42, fork: -0.22, rays: 7, spike: 0.12 },
      { kind: 'side', rect: 'pec', s: 0.33, a: -22, len: 0.15, fan: 42, root: 0.05, dir: [0.75, -0.35, -0.6], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.50, a: -66, len: 0.09, fan: 34, root: 0.035, dir: [0.4, -0.7, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => whiskers(bits, R.whisker, B, [
      { s: 0.025, a: 12, path: [[0, 0, 0], [0.035, -0.012, 0.012], [0.07, -0.045, 0.0], [0.085, -0.085, -0.025]] },
      { s: 0.04, a: -55, path: [[0, 0, 0], [0.012, -0.03, 0.01], [0.02, -0.06, 0.0], [0.022, -0.085, -0.02]], r0: 0.006 },
    ]),
  }; })(),

  // Glassfin, 0.24 m: leaf-shaped and nearly clear: palest aqua, a darker line for the spine, a bright cyan edge to the fins.
  glassfin: (() => { const E = { s: 0.095, a: 16, size: 0.04, bulge: 0.6, look: 0.5 }; const F = { colour: '#D2F2EE', tip: '#EAFBF8', root: '#9EDAD4', ray: '#5FB9B8', ray_amount: 0.6, rim: { colour: '#16CDEC', w: 0.22, amount: 1 } }; return {
    len: 0.72, pow: 1.25, rings: 18, around: 6, roughness: 0.45, mouth: { tilt: 14 },
    body: [[0, 0.012, -0.008, 0.008], [0.04, 0.062, -0.05, 0.03], [0.14, 0.14, -0.12, 0.052], [0.36, 0.21, -0.20, 0.06], [0.6, 0.17, -0.16, 0.048], [0.85, 0.07, -0.065, 0.024], [1, 0.035, -0.032, 0.012]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#8FD6D0', flank: '#C2EFE9', belly: '#E4FAF6', split: [0.22, 0.82], blend: [0.12, 0.10], vary: 0.06, sheen: 0.34,
        spine: { v: 0.56, arch: 0.025, colour: '#1F7C84', amount: 0.9, ribs: 12, u: [0.16, 0.985], reach: 0.29, w: 3.6 },
        blobs: [{ u: 0.26, v: 0.38, r: 0.06, squash: 0.8, colour: '#F0A890', amount: 0.85, soft: 0.3 }, { u: 0.245, v: 0.42, r: 0.022, colour: '#FBEDE2', amount: 0.9, soft: 0.5 },
          { u: 0.37, v: 0.47, r: 0.075, squash: 0.36, colour: '#F4FFFD', amount: 0.9, soft: 0.25 }, { u: 0.36, v: 0.49, r: 0.03, squash: 0.3, colour: '#FFFFFF', amount: 0.9, soft: 0.5 }],
        gill: { u: 0.165, bend: 0.025, v: [0.22, 0.78], colour: '#2F8A90', amount: 0.55 }, mouth: { to: 0.04, v: 0.52, v1: 0.42, w: 2.4, colour: '#2F7C84' },
        mottle: [{ colour: '#22D3EE', amount: 0.75, cells: [1, 1], cut: [-1, -0.5], v: [0.95, 2] }, { colour: '#22D3EE', amount: 0.6, cells: [1, 1], cut: [-1, -0.5], v: [-1, 0.045], u: [0.3, 2] }],
        eye: eyeAt(B, E), socket: { colour: '#7FBFC0', amount: 0.35, grow: 1.4 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#BFE3E6', pupil: 0.52, iris_r: 0.78 }],
      fin: [256, 96, FIN(5, { ...F, rays: 9 })], tail: [224, 120, FIN(6, { ...F, rays: 7 })], pec: [128, 96, FIN(7, { ...F, rays: 4 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.30, to: 0.84, h: 0.10, rays: 9, spike: 0.14, sweep: 0.7, sink: 0.006, thick: 0.008, shape: [[0, 0.55], [0.2, 1], [0.6, 0.8], [1, 0.3]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.42, to: 0.86, h: 0.09, rays: 9, spike: 0.14, sweep: 0.7, sink: 0.006, thick: 0.008, shape: [[0, 0.55], [0.2, 1], [0.6, 0.8], [1, 0.3]] },
      { kind: 'tail', rect: 'tail', len: 0.27, spread: 36, fork: 0.55, rays: 7, spike: 0.1, thick: 0.01 },
      { kind: 'side', rect: 'pec', s: 0.2, a: -12, len: 0.085, fan: 34, root: 0.025, dir: [0.55, -0.3, -0.75], rays: 4 },
      { kind: 'side', rect: 'pec', s: 0.3, a: -80, len: 0.07, fan: 22, root: 0.016, dir: [0.2, -0.8, -0.55], rays: 4 },
    ],
  }; })(),

  // Sedge Pike, 0.80 m: long and flat-snouted, olive with bark mottling; it is pretending to be a log, and a sprig of sedge grows on its back.
  'sedge-pike': (() => { const E = { s: 0.215, a: 46, size: 0.027, bulge: 0.7, look: 0.3 }; const F = { colour: '#7C7A40', tip: '#B07A3E', root: '#4E5230', ray: '#3E3A22', band: { colour: '#3E3A22', v: [0.45, 0.6], amount: 0.45 } }; return {
    len: 0.80, pow: 0.82, rings: 22, around: 6, originY: 0, mouth: { tilt: 10, tiltReach: 0.16 },
    body: [[0, 0.007, -0.012, 0.042], [0.06, 0.02, -0.028, 0.056], [0.16, 0.038, -0.045, 0.06], [0.24, 0.064, -0.06, 0.066], [0.45, 0.075, -0.075, 0.07], [0.7, 0.066, -0.066, 0.055], [0.88, 0.04, -0.04, 0.03], [1, 0.03, -0.028, 0.013]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#49552C', flank: '#6F7A40', belly: '#DAD8AA', split: [0.24, 0.66], blend: [0.08, 0.14],
        bark: { dark: '#322C1C', light: '#A29C66', amount: 0.75, length: 4, fine: 46, v: [0.3, 2] }, mottle: [{ colour: '#C2BC84', amount: 0.6, cells: [7, 34], cut: [0.7, 0.8], v: [0.26, 0.7], u: [0.24, 2] }],
        gill: { u: 0.275, bend: 0.02, v: [0.16, 0.82], colour: '#2E2A1A', amount: 0.55 }, mouth: { to: 0.19, v: 0.5, v1: 0.4, w: 2.4, colour: '#2E2A1A', curl: -0.03 },
        eye: eyeAt(B, E), socket: { colour: '#2E2A1A', amount: 0.45, grow: 1.5 } }, [832, 200]),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#DDBB48', pupil: 0.46, iris_r: 0.78 }],
      fin: [176, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 120, FIN(6, { ...F, rays: 7 })], pec: [128, 96, FIN(7, { ...F, rays: 4, band: null })],
      sprig: [40, 160, { mat: 'sprig', seed: 8, soft: 0 }], seed: [24, 48, { mat: 'flat', colour: '#7A5A30', var: 0.3, grain: 0.4 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.74, to: 0.91, h: 0.09, rays: 6, spike: 0.15, sweep: 0.75, sink: 0.008, thick: 0.01, shape: [[0, 0.6], [0.3, 1], [1, 0.5]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.76, to: 0.91, h: 0.075, rays: 6, spike: 0.15, sweep: 0.75, sink: 0.008, thick: 0.01, shape: [[0, 0.6], [0.3, 1], [1, 0.5]] },
      { kind: 'tail', rect: 'tail', len: 0.2, spread: 38, fork: 0.32, rays: 7, spike: 0.1, thick: 0.012 },
      { kind: 'side', rect: 'pec', s: 0.31, a: -52, len: 0.085, fan: 32, root: 0.026, dir: [0.55, -0.5, -0.67], rays: 4 },
      { kind: 'side', rect: 'pec', s: 0.56, a: -70, len: 0.07, fan: 30, root: 0.022, dir: [0.4, -0.65, -0.65], rays: 4 },
    ],
    more: ({ B, R, bits }) => {                      // the sprig of sedge: four blades and a seed head on a stalk
      const at = (s, x = 0) => [x, B.at(s).top - 0.006, B.Z(s)];
      blade(bits, R.sprig, at(0.43), { up: norm([0.05, 1, 0.1]), over: [0, 0, -1], len: 0.17, width: 0.016, bend: 0.07 });
      blade(bits, R.sprig, at(0.445, 0.006), { up: norm([0.35, 1, -0.1]), over: norm([0.6, 0, -0.8]), len: 0.12, width: 0.014, bend: 0.06 });
      blade(bits, R.sprig, at(0.445, -0.006), { up: norm([-0.4, 1, 0.0]), over: norm([-0.7, 0, -0.7]), len: 0.11, width: 0.014, bend: 0.055 });
      blade(bits, R.sprig, at(0.42), { up: norm([-0.1, 1, 0.35]), over: [0, 0, 1], len: 0.09, width: 0.012, bend: 0.04 });
      const s0 = at(0.438), top = add(s0, [0.012, 0.15, -0.02]);
      bits.tube([s0, add(s0, [0.004, 0.08, -0.004]), top], 0.0028, 3, R.sprig, { open: true });
      bits.tube([add(top, [0, -0.012, 0.002]), add(top, [0.002, 0.012, -0.004]), add(top, [0.005, 0.034, -0.01])], [0.004, 0.009, 0.002], 4, R.seed);
    },
  }; })(),

  // Mossback Tench, 0.50 m: round-backed, bronze-green, with a hump of bright moss and two tiny white flowers on it.
  'mossback-tench': (() => { const E = { s: 0.115, a: 26, size: 0.034, bulge: 0.65, look: 0.45 }; const F = { colour: '#565E38', tip: '#7C8048', root: '#363C24', ray: '#2A2E1C' }; return {
    len: 0.74, mid: 0.44, rings: 18, around: 8, mouth: { tilt: -6 },
    body: [[0, 0.012, -0.02, 0.03], [0.05, 0.08, -0.07, 0.07], [0.16, 0.16, -0.12, 0.105], [0.38, 0.235, -0.165, 0.125], [0.62, 0.19, -0.14, 0.10], [0.85, 0.10, -0.08, 0.05], [1, 0.075, -0.06, 0.028]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#465428', flank: '#7C7A36', belly: '#D6BC72', split: [0.26, 0.68], blend: [0.10, 0.14],
        mottle: [{ colour: '#B88E48', amount: 0.4, cells: [3, 6], cut: [0.45, 0.75], v: [0.18, 0.72] }], scales: { nu: 30, colour: '#33361A', amount: 0.4, lit: 0.16, shadow: 0.14, u0: 0.25, v: [0.1, 2] },
        gill: { u: 0.25, bend: 0.035, v: [0.16, 0.78], colour: '#2E3018', amount: 0.55, w: 2.6 }, lip: { to: 0.022, colour: '#C98A5A', amount: 0.8 }, mouth: { to: 0.045, v: 0.46, v1: 0.4, w: 2.4, colour: '#4A3018' },
        eye: eyeAt(B, E), socket: { colour: '#2E3018', amount: 0.4, grow: 1.5 } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#E2562A', pupil: 0.48, iris_r: 0.8 }],
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 104, FIN(6, { ...F, rays: 7 })], pec: [160, 104, FIN(7, { ...F, rays: 5, colour: '#6A6A3C' })],
      moss: [176, 104, { mat: 'mosspad', seed: 8, soft: 0 }], flower: [64, 64, { mat: 'flower', seed: 9, soft: 0 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.50, to: 0.70, h: 0.12, rays: 6, spike: 0.08, sweep: 0.5, shape: [[0, 0.7], [0.4, 1], [1, 0.62]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.68, to: 0.83, h: 0.09, rays: 6, spike: 0.08, sweep: 0.5, shape: [[0, 0.7], [0.4, 1], [1, 0.62]] },
      { kind: 'tail', rect: 'tail', len: 0.24, spread: 40, fork: 0.07, rays: 7, spike: 0.07 },
      { kind: 'side', rect: 'pec', s: 0.27, a: -36, len: 0.12, fan: 40, root: 0.045, dir: [0.65, -0.45, -0.6], rays: 5, spike: 0.08 },
      { kind: 'side', rect: 'pec', s: 0.50, a: -72, len: 0.10, fan: 34, root: 0.035, dir: [0.35, -0.7, -0.6], rays: 5, spike: 0.08 },
    ],
    more: ({ B, R, bits }) => {                      // the hump of moss, and two flowers standing in it
      const from = 0.17, to = 0.52, a0 = 34, H = 0.05, nu = 9, nv = 4, rnd = rng(8), lump = Array.from({ length: nu + 1 }, () => Array.from({ length: nv + 1 }, () => rnd()));
      const P = (i, j) => { const t = i / nu, q = j / nv, s = from + (to - from) * t, th = rad(a0 + (90 - a0) * q), lift = H * Math.sin(Math.PI * t) ** 0.55 * q ** 0.6 * (0.7 + 0.6 * lump[i][j]) - 0.006; return add(B.pt(s, th), mul(B.normal(s, th), lift)); };
      mirrored(bits, (p) => { for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const C = (ii, jj) => [P(ii, jj), R.moss.at(ii / nu, jj / nv)]; p.quad(C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1)); } });
      flowerOn(bits, R.flower, R.moss.sub(0.4, 0.5, 0.5, 0.9), P(3, 3), [0.3, 1, 0.12], 0.038, 0.045);
      const q = P(6, 3); flowerOn(bits, R.flower, R.moss.sub(0.4, 0.5, 0.5, 0.9), [-q[0], q[1], q[2]], [-0.32, 1, -0.08], 0.032, 0.035);
    },
  }; })(),

  // Glowbelly, 0.40 m: plump; dark teal above, and a belly that is a lit lantern (emissive, warm cyan).
  glowbelly: (() => { const E = { s: 0.12, a: 32, size: 0.048, bulge: 0.7, look: 0.45 }; const F = { colour: '#2A6A72', tip: '#86DCCC', root: '#173E48', ray: '#123036' };
    const LAN = { u: [0.2, 0.83], top: 0.47, ribs: 0, rib_w: 2.2, longs: [0.2, 0.42, 0.64, 0.84], glass: '#4FD8BC', core: '#D6FFEC', frame: '#1B5458', frame_amount: 0.8, frame_dark: 0.7, glow: '#35C9A4', hot: '#D4FFE6' }; return {
    len: 0.74, mid: 0.47, rings: 18, around: 8, glow: true, glowSize: [512, 256], mouth: { open: true, smile: 0.012, depth: 0.045 },
    body: [[0, 0.02, -0.026, 0.045], [0.05, 0.10, -0.10, 0.10], [0.16, 0.19, -0.19, 0.16], [0.36, 0.22, -0.255, 0.19], [0.6, 0.17, -0.20, 0.15], [0.84, 0.075, -0.07, 0.05], [1, 0.05, -0.045, 0.025]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#153A44', flank: '#235E68', belly: '#2F767C', split: [0.44, 0.74], blend: [0.08, 0.12],
        scales: { nu: 24, colour: '#0E262C', amount: 0.35, lit: 0.12, shadow: 0.14, u0: 0.24, v: [0.5, 2] }, lantern: LAN,
        gill: { u: 0.235, bend: 0.03, v: [0.5, 0.82], colour: '#0E262C', amount: 0.5 }, lip: { to: 0.02, colour: '#3F8E90', amount: 0.7 },
        eye: eyeAt(B, E), socket: { colour: '#0E262C', amount: 0.45, grow: 1.45 }, glow: { mat: 'skinglow', seed: 3, soft: 0, lantern: LAN } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#7CE0CE', pupil: 0.54, iris_r: 0.8 }], maw: [96, 72, { mat: 'maw', soft: 0, colour: '#7A3A48' }],
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 104, FIN(6, { ...F, rays: 7 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.40, to: 0.70, h: 0.10, rays: 6, spike: 0.18, sweep: 0.55, shape: [[0, 0.7], [0.3, 1], [1, 0.45]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.74, to: 0.87, h: 0.055, rays: 6, spike: 0.18, sweep: 0.6 },
      { kind: 'tail', rect: 'tail', len: 0.25, spread: 42, fork: 0.22, rays: 7, spike: 0.12 },
      { kind: 'side', rect: 'pec', s: 0.29, a: 2, len: 0.12, fan: 40, root: 0.045, dir: [0.8, -0.05, -0.6], rays: 5 },
    ],
  }; })(),

  // Stilt Gar, 0.90 m: a needle-nosed gar, slate green, with long thin fins hanging down like stilts.
  'stilt-gar': (() => { const E = { s: 0.30, a: 22, size: 0.021, bulge: 0.7, look: 0.4 }; const F = { colour: '#70887E', tip: '#B9C9BC', root: '#44584F', ray: '#2E3E38', band: { colour: '#2E3E38', v: [0.5, 0.64], amount: 0.5 } }; return {
    len: 0.84, rings: 24, around: 6, originY: 0, mouth: {},
    body: [[0, 0.006, -0.006, 0.006], [0.06, 0.011, -0.011, 0.0095], [0.2, 0.016, -0.016, 0.013], [0.27, 0.036, -0.03, 0.03], [0.34, 0.055, -0.05, 0.042], [0.55, 0.058, -0.056, 0.045], [0.78, 0.048, -0.046, 0.036], [0.92, 0.03, -0.03, 0.02], [1, 0.024, -0.024, 0.011]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#41564F', flank: '#7A9288', belly: '#DCE2D4', split: [0.28, 0.7], blend: [0.08, 0.12],
        scales: { nu: 46, colour: '#2E3E38', amount: 0.32, lit: 0.12, shadow: 0.12, u0: 0.35, v: [0.2, 2] }, spots: { colour: '#26332E', n: 14, r: 0.007, u: [0.62, 0.99], v: [0.3, 0.92], amount: 0.7 },
        gill: { u: 0.345, bend: 0.014, v: [0.18, 0.8], colour: '#26332E', amount: 0.5 }, mouth: { to: 0.275, v: 0.5, v1: 0.46, w: 1.8, colour: '#26332E' },
        eye: eyeAt(B, E), socket: { colour: '#26332E', amount: 0.4, grow: 1.5 } }, [900, 150]),
      eye: [96, 96, { mat: 'eye', seed: 4, soft: 0, iris: '#DCC66A', pupil: 0.46, iris_r: 0.78 }],
      fin: [176, 104, FIN(5, { ...F, rays: 5 })], tail: [200, 120, FIN(6, { ...F, rays: 6 })],
      stilt: [56, 300, FIN(7, { colour: '#7A9288', tip: '#DCE2D4', root: '#44584F', ray: '#33443E', rays: 2, band: null, ray_w: 2.2 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.85, to: 0.955, h: 0.06, rays: 5, spike: 0.12, sweep: 0.8, sink: 0.006, thick: 0.008, shape: [[0, 0.7], [0.3, 1], [1, 0.5]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.83, to: 0.945, h: 0.055, rays: 5, spike: 0.12, sweep: 0.8, sink: 0.006, thick: 0.008, shape: [[0, 0.7], [0.3, 1], [1, 0.5]] },
      { kind: 'tail', rect: 'tail', len: 0.155, spread: 34, fork: -0.25, rays: 6, spike: 0.1, thick: 0.01 },
      { kind: 'side', rect: 'stilt', s: 0.38, a: -58, len: 0.31, fan: 2.2, root: 0.016, dir: [0.1, -0.97, 0.2], up: [0, 0, 1], rays: 2, spike: 0, ripple: 0.0015, thick: 0.008, rows: 5, bow: -0.14, shape: [[0, 0.7], [0.5, 1], [1, 0.7]] },
      { kind: 'side', rect: 'stilt', s: 0.62, a: -62, len: 0.33, fan: 2.2, root: 0.016, dir: [0.08, -0.99, -0.1], up: [0, 0, 1], rays: 2, spike: 0, ripple: 0.0015, thick: 0.008, rows: 5, bow: -0.12, shape: [[0, 0.7], [0.5, 1], [1, 0.7]] },
    ],
  }; })(),

  // Bottomless Eel, 1.60 m: a very long eel, ink black going to deep green, pale eyes; the tail thins to a thread.
  'bottomless-eel': (() => { const E = { s: 0.046, a: 30, size: 0.017, bulge: 0.75, look: 0.4 }; const F = { colour: '#0E1418', tip: '#1A262A', root: '#080B0E', ray: '#05070A', ray_amount: 0.4, fade: { colour: '#1F6044', u: [0.1, 0.9] } }; return {
    atlas: [1024, 256], len: 1.0, bias: 1.0, rings: 44, around: 5, glow: true, glowSize: [512, 128], roughness: 0.5, mouth: {},
    body: [[0, 0.012, -0.016, 0.022], [0.025, 0.036, -0.036, 0.04], [0.07, 0.045, -0.045, 0.044], [0.14, 0.042, -0.042, 0.038], [0.3, 0.037, -0.037, 0.032], [0.6, 0.026, -0.026, 0.02], [0.85, 0.011, -0.011, 0.007], [0.95, 0.004, -0.004, 0.003], [1, 0.0012, -0.0012, 0.001]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#0A0D12', flank: '#161F25', belly: '#2A3A3A', split: [0.24, 0.66], blend: [0.10, 0.14], vary: 0.2, sheen: 0.3,
        tail: { back: '#0F3A2A', flank: '#1D6044', belly: '#3A8A62', u: [0.22, 0.92] }, pores: { v: 0.55, n: 30, u: [0.1, 0.93], r: 0.0024, colour: '#63C792', amount: 0.75 },
        gill: { u: 0.105, bend: 0.006, v: [0.25, 0.7], colour: '#000000', amount: 0.5, w: 1.8 }, mouth: { to: 0.062, v: 0.44, v1: 0.36, w: 1.8, colour: '#000000' },
        eye: eyeAt(B, E), socket: { colour: '#000000', amount: 0.5, grow: 1.5 } }, [1000, 112]),
      eye: [64, 64, { mat: 'eye', seed: 4, soft: 0, iris: '#E6F2DE', white: '#E6F2DE', pupil: 0.16, iris_r: 0.82, ring: '#06080A', glow: { mat: 'eyeglow', soft: 0, colour: '#DDF2E0', amount: 0.3, r0: 0.84 } }],
      fin: [800, 48, FIN(5, { ...F, rays: 40 })], pec: [64, 64, FIN(7, { colour: '#0E1418', tip: '#1F2C30', root: '#080B0E', ray: '#05070A', rays: 4 })],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.2, to: 0.93, h: 0.032, rays: 40, spike: 0.1, sweep: 0.5, sink: 0.003, thick: 0.005, ripple: 0.002, shape: [[0, 0.2], [0.1, 1], [0.55, 0.85], [0.9, 0.35], [1, 0.1]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.44, to: 0.93, h: 0.024, rays: 28, spike: 0.1, sweep: 0.5, sink: 0.003, thick: 0.005, ripple: 0.002, shape: [[0, 0.2], [0.15, 1], [0.55, 0.85], [0.9, 0.35], [1, 0.1]] },
      { kind: 'side', rect: 'pec', s: 0.135, a: -12, len: 0.05, fan: 38, root: 0.016, dir: [0.6, -0.3, -0.74], rays: 4, thick: 0.004 },
    ],
  }; })(),

  // Old Mossglass, 1.10 m: a great carp of bottle-green glass with gold-rimmed scales and whiskers; a darker shape shows inside it; faint glow.
  'old-mossglass': (() => { const E = { s: 0.115, a: 30, size: 0.04, bulge: 0.65, look: 0.45 };
    const F = { colour: '#2C9464', tip: '#A6E8BE', root: '#0F4A34', ray: '#E2BA4C', ray_amount: 0.75, glow: { mat: 'finglow', soft: 0, colour: '#3FD08A', amount: 0.0, body: 0.16 } };
    const SC = { nu: 15, colour: '#E6BE50', amount: 0.9, lit: 0.2, shadow: 0.22, u0: 0.27, v: [0.08, 2] };
    const IN = { poly: [[0.37, 0.5], [0.42, 0.61], [0.52, 0.66], [0.62, 0.6], [0.675, 0.52], [0.75, 0.63], [0.735, 0.5], [0.75, 0.37], [0.675, 0.48], [0.62, 0.4], [0.52, 0.34], [0.42, 0.39]], colour: '#052016', amount: 0.62, soft: 9 }; return {
    len: 0.74, mid: 0.45, rings: 18, around: 8, glow: true, glowSize: [512, 256], roughness: 0.35, mouth: { open: true, smile: 0.008, depth: 0.045 },
    body: [[0, 0.02, -0.028, 0.045], [0.05, 0.085, -0.075, 0.085], [0.16, 0.17, -0.125, 0.125], [0.36, 0.23, -0.17, 0.14], [0.6, 0.19, -0.145, 0.115], [0.84, 0.10, -0.08, 0.055], [1, 0.07, -0.058, 0.03]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#0D4430', flank: '#1D7850', belly: '#86CE9E', split: [0.24, 0.72], blend: [0.12, 0.14], sheen: 0.3,
        head: { to: 0.25, colour: '#3FA272', amount: 0.5 }, scales: SC, inner: IN, gill: { u: 0.26, bend: 0.035, v: [0.16, 0.8], colour: '#E6BE50', amount: 0.6, w: 2.6 }, lip: { to: 0.022, colour: '#E6BE50', amount: 0.85 },
        eye: eyeAt(B, E), socket: { colour: '#0A3424', amount: 0.45, grow: 1.5 },
        glow: { mat: 'skinglow', seed: 3, soft: 0, ratio: B.ratio(...SIDE), allover: { colour: '#34C47E', amount: 0.24 }, scales: SC, rim: { colour: '#FFD970', amount: 0.34 }, inner: { ...IN, amount: 0.9 } } }),
      eye: [128, 128, { mat: 'eye', seed: 4, soft: 0, iris: '#EBC44C', pupil: 0.5, iris_r: 0.8 }], maw: [96, 72, { mat: 'maw', soft: 0, colour: '#2F6E50', deep: '#06221A', tongue: '#5FA883' }],
      fin: [256, 104, FIN(5, { ...F, rays: 9 })], tail: [224, 104, FIN(6, { ...F, rays: 8 })], pec: [160, 104, FIN(7, { ...F, rays: 5 })],
      whisker: [16, 64, { mat: 'flat', colour: '#E2BA4C', var: 0.15 }],
    }),
    eyes: [E],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.37, to: 0.74, h: 0.13, rays: 9, spike: 0.16, sweep: 0.5, shape: [[0, 0.75], [0.12, 1], [0.5, 0.7], [1, 0.45]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.68, to: 0.83, h: 0.09, rays: 9, spike: 0.16, sweep: 0.55, shape: [[0, 0.75], [0.2, 1], [1, 0.45]] },
      { kind: 'tail', rect: 'tail', len: 0.27, spread: 44, fork: 0.36, rays: 8, spike: 0.12 },
      { kind: 'side', rect: 'pec', s: 0.28, a: -38, len: 0.14, fan: 40, root: 0.045, dir: [0.65, -0.45, -0.6], rays: 5 },
      { kind: 'side', rect: 'pec', s: 0.50, a: -70, len: 0.11, fan: 34, root: 0.035, dir: [0.35, -0.7, -0.6], rays: 5 },
    ],
    more: ({ B, R, bits }) => whiskers(bits, R.whisker, B, [
      { s: 0.02, a: 15, path: [[0, 0, 0], [0.03, -0.015, 0.015], [0.06, -0.055, 0.005], [0.07, -0.11, -0.03]] },
      { s: 0.012, a: -40, path: [[0, 0, 0], [0.012, -0.03, 0.012], [0.018, -0.06, 0.004], [0.02, -0.085, -0.015]], r0: 0.006 },
    ]),
  }; })(),

  // The Listener, 1.00 m: pale and smooth with no eyes, and two wide round fins like ears or gramophone horns; a violet cast.
  'the-listener': (() => { const F = { colour: '#E2DAEC', tip: '#C4B0EA', root: '#CFC4E0', ray: '#A892CC', ray_amount: 0.3, pleat: 0.05 };
    const PO = { v: 0.55, n: 11, u: [0.25, 0.95], r: 0.009, arch: 0.02, colour: '#523A86', amount: 0.85, glow: '#B58CFF', lit: 0.55 }; return {
    len: 0.72, mid: 0.46, rings: 18, around: 8, glow: true, glowSize: [512, 256], roughness: 0.55, mouth: {},
    body: [[0, 0.01, -0.012, 0.03], [0.04, 0.07, -0.06, 0.075], [0.14, 0.125, -0.10, 0.105], [0.32, 0.14, -0.115, 0.11], [0.58, 0.105, -0.09, 0.08], [0.84, 0.05, -0.045, 0.035], [1, 0.03, -0.028, 0.014]],
    rects: (B) => ({
      side: skin(B, { seed: 3, back: '#C3B4DA', flank: '#E6E0EE', belly: '#F6F3F6', split: [0.28, 0.74], blend: [0.12, 0.14], vary: 0.05, sheen: 0.16,
        mottle: [{ colour: '#A48CCC', amount: 0.28, cells: [3, 5], cut: [0.55, 0.85] }], pores: PO, mouth: { to: 0.075, v: 0.44, v1: 0.43, w: 1.8, colour: '#6A5890' },
        blobs: [{ u: 0.105, v: 0.66, r: 0.03, colour: '#D9D0E8', amount: 0.55, soft: 0.6 }], glow: { mat: 'skinglow', seed: 3, soft: 0, ratio: B.ratio(832, 330), pores: PO } }, [832, 330]),
      fin: [224, 104, FIN(5, { ...F, rays: 6 })], tail: [224, 120, FIN(6, { ...F, rays: 7 })],
      hornOut: [256, 120, FIN(7, { ...F, rays: 12, dip: 0, tip: '#EFEAF4' })],
      hornIn: [256, 150, FIN(8, { colour: '#A886DE', root: '#E6DCF2', tip: '#2E1C56', ray: '#7C5CC0', ray_amount: 0.45, rays: 12, dip: 0, glow: { mat: 'finglow', soft: 0, colour: '#9A6CFF', amount: 0.3, w: 0.3, body: 0.45, rays: 12 } })],
    }),
    eyes: [],
    fins: [
      { kind: 'ridge', rect: 'fin', from: 0.42, to: 0.78, h: 0.05, rays: 6, spike: 0.0, sweep: 0.6, shape: [[0, 0.3], [0.4, 1], [1, 0.3]] },
      { kind: 'ridge', rect: 'fin', belly: true, from: 0.6, to: 0.84, h: 0.04, rays: 6, spike: 0.0, sweep: 0.6, shape: [[0, 0.3], [0.4, 1], [1, 0.3]] },
      { kind: 'tail', rect: 'tail', len: 0.31, spread: 46, fork: 0.6, rays: 7, spike: 0.04 },
    ],
    more: ({ B, R, bits }) => mirrored(bits, (p) => {      // the two horns: a short stem out of the flank, opening into a wide round mouth
      const o = B.pt(0.30, rad(10)), axis = norm([0.9, 0.34, 0.1]), xf = aim(sub(o, mul(axis, 0.02)), axis, [0, 1, 0]), keep = p.xf; p.xf = xf;
      p.lathe([[0.024, 0], [0.021, 0.04], [0.032, 0.072], [0.066, 0.102], [0.115, 0.122], [0.142, 0.128]], 12, R.hornOut);
      p.lathe([[0.142, 0.128], [0.134, 0.133], [0.062, 0.108], [0.028, 0.076], [0.012, 0.035], [0, 0.03]], 12, R.hornIn);
      p.xf = keep;
    }),
  }; })(),
};

const [id, ...rest] = process.argv.slice(2);
if (!FISH[id]) { console.error('fish: ' + Object.keys(FISH).join(', ')); process.exit(1); }
await buildFish({ name: id, ...FISH[id] }, cli(rest));
