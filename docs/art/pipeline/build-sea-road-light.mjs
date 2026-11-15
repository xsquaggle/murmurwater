// build-sea-road-light.mjs : a light of the old sea-road, built in code (no generation job).
// Usage: node build-sea-road-light.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// An iron spar standing out of the sea with a caged lamp on top and a collar of cork floats at the waterline.
// Origin at the waterline, +Y up, metres; 3.2 m above the water and 2 m below; it leans 4 degrees toward +X.
// Two materials: `main` and `Glass` (the lamp's glass; its texture is also its glow map).
import { Model, pack, cli, emit, rotZ, rotY, move, compose, rad, add, mul, norm, cross } from './kit.mjs';
import { cagedLantern, lanternRects } from './fen-parts.mjs';

const args = cli(); const ATLAS = [1024, 1024];
const FOOT = -2.0, HEAD = 2.42, LEAN = 4, BEADS = 6;
const R = pack(...ATLAS, {
  spar: [200, 900, { mat: 'iron', rust: 0.36, tile_x: true, water: [FOOT, HEAD] }],
  floats: [720, 110, { mat: 'floats', n: BEADS, bead: [0.25, 0.75] }],
  rung: [36, 150, { mat: 'iron', rust: 0.55, tile_x: true }],
  barnacle: [48, 48, { mat: 'flat', colour: '#B9B6A0', var: 0.2 }],
  ...lanternRects(400, 'cyan', { frame: 'copper' }),
});

const m = new Model('sea-road-light');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.material('Glass', { kind: 'texture', roughness: 0.35, emissive: [1, 1, 1], glow: true });
const lean = rotZ(-rad(LEAN));

// ---- the spar: a tapered iron pole with a band two thirds of the way up and a flare under the lamp
const SPAR = [[0, FOOT], [0.160, FOOT], [0.138, -0.30], [0.122, 1.42], [0.150, 1.46], [0.150, 1.58], [0.114, 1.62], [0.098, 2.28], [0.150, 2.37], [0.150, HEAD]];
const spar = m.part('spar', { crease: 40, xf: lean });
spar.lathe(SPAR, 6, R.spar, { v: SPAR.map(([, y]) => (y - FOOT) / (HEAD - FOOT)) });
// three rungs for whoever trimmed the lamp, turned a different way each
[[0.80, 20], [1.14, 110], [1.92, 65]].forEach(([y, a]) => { const d = [0.30 * Math.cos(rad(a)), 0, -0.30 * Math.sin(rad(a))]; spar.tube([[-d[0], y, -d[2]], [d[0], y, d[2]]], 0.024, 3, R.rung); });
// barnacles on the wet iron: little four-sided cones standing out from the pole
const cone = (y, a, s) => { const rr = 0.128, o = [Math.cos(rad(a)), 0, -Math.sin(rad(a))], c = mul(o, rr), t = [-o[2], 0, o[0]], up = [0, 1, 0];
  const b = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => add(add(add(c, [0, y, 0]), mul(t, i * s)), mul(up, j * s))); const tip = add(add(c, [0, y, 0]), mul(o, s * 0.7));
  for (let k = 0; k < 4; k++) spar.tri([b[k], R.barnacle.at(k / 4, 0), 0.8], [b[(k + 1) % 4], R.barnacle.at((k + 1) / 4, 0), 0.8], [tip, R.barnacle.at(0.5, 1), 1]); };
[[0.30, 40, 0.046], [0.37, 62, 0.034], [0.27, 200, 0.042], [0.35, 181, 0.030], [0.31, 300, 0.040]].forEach(([y, a, s]) => cone(y, a, s));

// ---- the lamp on top
const frame = m.part('lamp', { crease: 35, xf: lean }), glass = m.part('glass', { material: 'Glass', crease: 20, xf: lean });
const L = cagedLantern(frame, glass, R, { at: [0, HEAD, 0], h: 0.78, r: 0.140, ring: false });

// ---- the collar: square cork floats strung on a rope round the spar, lying level on the water
const col = m.part('collar', { crease: 45 }); const RING = 0.33, THICK = 0.115, THIN = 0.026, ST = [[0, THIN], [0.25, THICK], [0.75, THICK]];
const stations = []; for (let b = 0; b < BEADS; b++) for (const [f, t] of ST) stations.push([(b + f) / BEADS, t]);
const P = (i, j) => { const [u, t] = stations[i % stations.length], a = 2 * Math.PI * u, bb = 2 * Math.PI * (j % 4) / 4 + Math.PI / 4, rr = RING + t * Math.cos(bb) * (t === THIN ? 1 : 0.8); return [rr * Math.cos(a), 0.012 + t * Math.sin(bb) * (t === THIN ? 1 : 0.8), -rr * Math.sin(a)]; };
const C = (i, j) => [P(i, j), R.floats.at(i < stations.length ? stations[i][0] : 1, j / 4)];
for (let i = 0; i < stations.length; i++) for (let j = 0; j < 4; j++) col.quad(C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1));

await emit(m, R, ATLAS, args, { extra: { lantern: L } });
