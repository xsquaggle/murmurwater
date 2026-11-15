// build-stilt-hut.mjs : Dr. Calloway's field hut at Sedge Landing, built in code (no generation job).
// Usage: node build-stilt-hut.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A plank hut 3 m square on four stilts with a reed thatch in two tiers; its floor is 2.2 m above the origin. A deck 1 m
// deep runs across the front (+Z) with a rail, a ladder down from it in front of the door, a lantern on a bracket between
// the door and a round window, a second round window on the +X wall, a rain gauge and a wind vane on the rail, a tin
// stovepipe through the roof, a tide staff on one stilt. Origin on the ground under the middle of the hut; stilts and ladder go on 1.5 m below it.
// Materials `main` and `Glass` (the lantern's panes and both windows, warm; the atlas is also the glow map).
// The wind vane's arrow is a child node `Vane` that turns about its own Y.
import { Model, pack, cli, emit, within, rotY, rotZ, move, compose, rad, rng } from './kit.mjs';
import { cagedLantern, lanternRects, roundWindow, windowRects } from './fen-parts.mjs';

const args = cli(); const ATLAS = [1024, 1024]; const rnd = rng(12);
const F = 2.2, HW = 1.5, WH = 2.0, TOP = F + WH, DEEP = -1.5;           // floor, half the hut's width, wall height, eaves, how far down the stilts go
const DECK = 2.52, SLAB = 0.12, PX = 1.62;                               // the deck's front edge, the floor's thickness, half the platform's width
const R = pack(...ATLAS, {
  wallF: [400, 260, { mat: 'wood', planks: 15, along: 'y', tone: 'drift', weather: 0.55, nails: 2, ao: { top: 0.35, bottom: 0.2 } }],
  wallS: [400, 260, { mat: 'wood', planks: 15, along: 'y', tone: 'drift', weather: 0.7, nails: 2, ao: { top: 0.35, bottom: 0.2 } }],
  thatch: [440, 250, { mat: 'thatch', courses: 3, moss: 0.5 }], cap: [260, 120, { mat: 'thatch', courses: 1, moss: 0.3 }],
  eave: [300, 36, { mat: 'flat', colour: '#544E2E', var: 0.28, grain: 0.35, along: 'y' }],
  soffit: [300, 60, { mat: 'wood', planks: 10, along: 'y', tone: 'dark', weather: 0.1, light: 0.8 }],
  floor: [300, 300, { mat: 'wood', planks: 11, along: 'y', tone: 'grey', weather: 0.5, nails: 3 }],
  under: [200, 200, { mat: 'wood', planks: 8, along: 'y', tone: 'dark', weather: 0.2, light: 0.75 }],
  stilt: [110, 420, { mat: 'wood', tone: 'dark', along: 'y', weather: 0.5, tile_x: true, water: [DEEP, F - SLAB], barnacles: 0 }],
  beam: [300, 44, { mat: 'wood', tone: 'dark', along: 'x', weather: 0.4 }],
  trim: [300, 40, { mat: 'wood', tone: 'pale', along: 'x', weather: 0.6, edge: 0.3 }],
  door: [120, 250, { mat: 'wood', planks: 4, along: 'y', tone: 'teal', weather: 0.75, nails: 3, edge: 0.5, ao: { bottom: 0.3 } }],
  staff: [44, 480, { mat: 'staff', marks: 33, water: [-1.4, 1.9], barnacles: 0 }],
  iron: [64, 64, { mat: 'iron', rust: 0.3 }], brass: [64, 64, { mat: 'brass', patina: 0.3 }], tin: [72, 140, { mat: 'tin', tile_x: true }],
  ...windowRects(120, 'warm'), ...lanternRects(170, 'warm'),
});

const m = new Model('stilt-hut');
m.material('main', { kind: 'texture', roughness: 0.92 });
m.material('Glass', { kind: 'texture', roughness: 0.4, emissive: [1, 1, 1], glow: true });
m.node('Vane', [1.54, 4.02, DECK - 0.06]);
const frame = m.part('frame', { crease: 40 }), walls = m.part('walls', { crease: 30 }), roof = m.part('roof', { crease: 28 }), glass = m.part('glass', { material: 'Glass', crease: 20 });
const fit = m.part('fittings', { crease: 40 }), vane = m.part('vane', { node: 'Vane', crease: 30 });

// ---- the platform: four stilts that splay a little, two beams on them, braces, the floor and deck in one slab
const STILTS = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({ top: [sx * 1.26, F - SLAB - 0.14, sz * 1.26], foot: [sx * (1.46 + 0.05 * rnd()), DEEP, sz * (1.46 + 0.05 * rnd())] }));
const onStilt = (s, y) => { const t = (y - s.foot[1]) / (s.top[1] - s.foot[1]); return s.foot.map((v, i) => v + (s.top[i] - v) * t); };
for (const s of STILTS) frame.tube([s.foot, s.top], [0.13, 0.105], 6, R.stilt, { open: true, v: [0, 1] });
for (const sx of [-1, 1]) frame.box([sx * 1.26, F - SLAB - 0.07, (DECK - 1.62) / 2], [0.08, 0.07, (DECK + 1.62) / 2 - 0.02], { px: R.beam, nx: R.beam, ny: R.beam, pz: R.beam.sub(0, 0, 0.1, 1), nz: R.beam.sub(0, 0, 0.1, 1) }, { shade: { ny: 0.7 } });
const brace = (a, ya, b, yb) => frame.tube([onStilt(STILTS[a], ya), onStilt(STILTS[b], yb)], 0.045, 4, R.beam, { open: true, twist: Math.PI / 4 });
brace(0, 0.35, 1, 1.75); brace(1, 0.35, 0, 1.75); brace(1, 0.35, 2, 1.75); brace(2, 0.35, 1, 1.75); brace(3, 0.35, 0, 1.75); brace(0, 0.35, 3, 1.75);
for (const i of [2, 3]) frame.tube([onStilt(STILTS[i], 1.15), [STILTS[i].top[0], F - SLAB - 0.1, DECK - 0.22]], 0.05, 4, R.beam, { open: true, twist: Math.PI / 4 });      // struts under the deck
frame.box([0, F - SLAB / 2, (DECK - 1.62) / 2], [PX, SLAB / 2, (DECK + 1.62) / 2], { py: R.floor, ny: R.under, px: R.beam, nx: R.beam, pz: R.beam, nz: R.beam }, { shade: { ny: 0.72 } });

// a tide staff on the front stilt on the +X side: Dr. Calloway measures everything (a white board marked in decimetres, red at every metre)
{ const s = STILTS[2], y0 = -1.4, y1 = 1.9, side = R.trim.sub(0, 0, 1, 0.3);
  frame.box([0, 0, 0], [0.06, (y1 - y0) / 2, 0.012], { pz: R.staff, px: side, nx: side, py: side }, { warp: (p) => { const q = onStilt(s, (y0 + y1) / 2 + p[1]); return [q[0] + p[0], q[1], q[2] + 0.125 + p[2]]; } }); }

// ---- walls: a quad each, the front one cut round the door; a post on every corner
const wallAt = (rect, x0, y0, x1, y1) => rect.sub((x0 + HW) / (2 * HW), (y0 - F) / WH, (x1 + HW) / (2 * HW), (y1 - F) / WH);
const panel = (p, rect, x0, y0, x1, y1, z = HW) => p.face([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], wallAt(rect, x0, y0, x1, y1));
for (const yaw of [90, 180, 270]) within(walls, rotY(rad(yaw)), (p) => panel(p, R.wallS, -HW, F, HW, TOP));
const DX0 = -1.08, DX1 = -0.26, DTOP = F + 1.78, INSET = 0.06;
panel(walls, R.wallF, -HW, F, DX0, TOP); panel(walls, R.wallF, DX1, F, HW, TOP); panel(walls, R.wallF, DX0, DTOP, DX1, TOP);
walls.face([DX0, F, HW - INSET], [DX1, F, HW - INSET], [DX1, DTOP, HW - INSET], [DX0, DTOP, HW - INSET], R.door);
const rev = R.trim.sub(0, 0, 0.5, 1);                                                                    // the reveals round the door
walls.face([DX0, F, HW], [DX0, F, HW - INSET], [DX0, DTOP, HW - INSET], [DX0, DTOP, HW], rev, [0.7, 0.7, 0.7, 0.7]);
walls.face([DX1, F, HW - INSET], [DX1, F, HW], [DX1, DTOP, HW], [DX1, DTOP, HW - INSET], rev, [0.7, 0.7, 0.7, 0.7]);
walls.face([DX0, DTOP, HW - INSET], [DX1, DTOP, HW - INSET], [DX1, DTOP, HW], [DX0, DTOP, HW], rev, [0.6, 0.6, 0.6, 0.6]);
const proud = { pz: R.trim, px: R.trim.sub(0, 0, 0.2, 1), nx: R.trim.sub(0, 0, 0.2, 1), py: R.trim.sub(0, 0, 0.2, 1), ny: R.trim.sub(0, 0, 0.2, 1) };
walls.box([DX0 - 0.05, (F + DTOP) / 2 + 0.05, HW + 0.02], [0.05, (DTOP - F) / 2 + 0.05, 0.02], { ...proud, pz: R.trim.sub(0, 0, 1, 1) }, { warp: (p) => p });   // jambs and lintel, standing 4 cm proud
walls.box([DX1 + 0.05, (F + DTOP) / 2 + 0.05, HW + 0.02], [0.05, (DTOP - F) / 2 + 0.05, 0.02], proud);
walls.box([(DX0 + DX1) / 2, DTOP + 0.06, HW + 0.025], [(DX1 - DX0) / 2 + 0.14, 0.06, 0.025], proud);
fit.box([DX1 - 0.12, F + 0.92, HW - INSET + 0.03], [0.022, 0.05, 0.03], R.brass);                                                                                 // the door handle
for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) walls.box([sx * HW, F + WH / 2, sz * HW], [0.075, WH / 2, 0.075], { pz: R.trim, nz: R.trim, px: R.trim, nx: R.trim }, { warp: (p) => [p[0], p[1], p[2]] });

// ---- windows and the lantern
roundWindow(walls, glass, R, { at: [0.72, F + 1.12, HW], yaw: 0, r: 0.33 });
roundWindow(walls, glass, R, { at: [HW, F + 1.12, 0.15], yaw: 90, r: 0.33 });
const LX = 0.12, LZ = HW + 0.36, LH = 0.36, LY = F + 1.36;                                                // the lantern hangs between the door and the window
const L = cagedLantern(fit, glass, R, { at: [LX, LY, LZ], h: LH, r: 0.062 });
fit.tube([[LX, L.ringMid + 0.07, HW], [LX, L.ringMid + 0.09, LZ + 0.03]], 0.016, 4, R.iron, { twist: Math.PI / 4 });
fit.tube([[LX, L.ringMid - 0.2, HW], [LX, L.ringMid + 0.07, LZ - 0.1]], 0.012, 3, R.iron, { open: true });
fit.tube([[LX, L.ringMid + 0.08, LZ], [LX, L.ringMid + 0.012, LZ]], 0.008, 3, R.iron, { open: true });

// ---- the roof: two tiers of thatch, each side a little grid so the eaves can sag and the surface bulge
const tier = (rows, nu, rect, edge, seed) => {
  const jr = rng(seed), jit = rows.map((row) => Array.from({ length: nu + 1 }, (_, j) => (j === 0 || j === nu ? 0 : (jr() - 0.5) * 2 * (row.rag || 0))));
  for (let k = 0; k < 4; k++) within(roof, rotY(rad(90 * k)), (p) => {
    const P = (i, j) => { const { w, y, sag = 0, out = 0 } = rows[i], u = -1 + 2 * j / nu, c = Math.cos(Math.PI * u / 2); return [u * w, y - sag * c * c + jit[i][j], w + out * c]; };
    for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j < nu; j++) { const r = rows[i].edge ? edge : rect, v0 = rows[i].edge ? 0 : rows[i].v, v1 = rows[i].edge ? 1 : rows[i + 1].v;
      p.quad([P(i, j), r.at(j / nu, v0)], [P(i, j + 1), r.at((j + 1) / nu, v0)], [P(i + 1, j + 1), r.at((j + 1) / nu, v1)], [P(i + 1, j), r.at(j / nu, v1)]); }
    if (rows[0].under) for (let j = 0; j < nu; j++) { const [w, y] = rows[0].under, I = (jj) => [(-1 + 2 * jj / nu) * w, y, w];                    // the underside, from the wall out to the eave
      p.quad([I(j), R.soffit.at(j / nu, 1), 0.75], [I(j + 1), R.soffit.at((j + 1) / nu, 1), 0.75], [P(0, j + 1), R.soffit.at((j + 1) / nu, 0), 0.9], [P(0, j), R.soffit.at(j / nu, 0), 0.9]); }
  });
};
tier([{ w: 1.96, y: TOP - 0.12, sag: 0.07, rag: 0.03, edge: true, under: [HW, TOP] }, { w: 1.94, y: TOP + 0.05, sag: 0.06, rag: 0.02, v: 0 }, { w: 1.36, y: TOP + 0.62, out: 0.06, rag: 0.03, v: 0.52 }, { w: 0.72, y: TOP + 1.16, v: 1 }], 4, R.thatch, R.eave, 3);
tier([{ w: 0.98, y: TOP + 0.96, sag: 0.03, rag: 0.02, edge: true, under: [0.66, TOP + 1.08] }, { w: 0.96, y: TOP + 1.09, sag: 0.03, v: 0 }, { w: 0.5, y: TOP + 1.50, out: 0.04, v: 0.6 }, { w: 0, y: TOP + 1.78, v: 1 }], 2, R.cap, R.eave, 4);
// the stovepipe, out through the back of the roof, with a hat on it
within(fit, move([-0.82, 0, -0.95]), (p) => { p.lathe([[0.065, TOP + 0.55], [0.065, TOP + 1.52]], 6, R.tin); p.lathe([[0.15, TOP + 1.60], [0, TOP + 1.72]], 6, R.tin.sub(0, 0.6, 1, 1)); p.lathe([[0, TOP + 1.60], [0.15, TOP + 1.60]], 6, R.tin.sub(0, 0.6, 1, 1), { shade: () => 0.6 });
  for (const a of [0, 120, 240]) p.tube([[0.06 * Math.cos(rad(a)), TOP + 1.5, -0.06 * Math.sin(rad(a))], [0.09 * Math.cos(rad(a)), TOP + 1.61, -0.09 * Math.sin(rad(a))]], 0.008, 3, R.iron, { open: true }); });

// ---- the deck's rail: posts and two rails, open where the ladder comes up
const RAIL = F + 0.92, POST = [[-PX + 0.08, DECK - 0.06], [-0.5, DECK - 0.06], [0.52, DECK - 0.06], [PX - 0.08, DECK - 0.06]];
for (const [x, z] of POST) fit.box([x, (F - SLAB + RAIL + 0.06) / 2, z], [0.042, (RAIL + 0.06 - F + SLAB) / 2, 0.042], { pz: R.trim, nz: R.trim, px: R.trim, nx: R.trim, py: R.trim.sub(0, 0, 0.1, 1) });
const rail = (a, b, y) => fit.tube([[a[0], y, a[1]], [b[0], y, b[1]]], 0.03, 4, R.trim, { open: true, twist: Math.PI / 4 });
for (const y of [RAIL - 0.02, F + 0.46]) { rail(POST[1], POST[2], y); rail(POST[2], POST[3], y); rail(POST[3], [PX - 0.08, HW + 0.07], y); rail(POST[0], [-PX + 0.08, HW + 0.07], y); }

// ---- the ladder: in front of the door, leaning in, with seven rungs
const LAD = (y) => DECK + 0.05 + (F - y) * 0.26, LXS = [-1.24, -0.64];
for (const x of LXS) fit.tube([[x, DEEP, LAD(DEEP)], [x, F + 0.95, LAD(F + 0.95)]], 0.036, 4, R.trim, { twist: Math.PI / 4, wrap: 1 });
for (let i = 0; i < 7; i++) { const y = 0.28 + i * 0.3; fit.tube([[LXS[0], y, LAD(y)], [LXS[1], y, LAD(y)]], 0.022, 3, R.beam, { open: true }); }

// ---- the rain gauge on a post, and the wind vane on the corner post
within(fit, move([POST[2][0], RAIL + 0.06, POST[2][1]]), (p) => { p.lathe([[0.04, 0], [0.04, 0.24], [0.088, 0.33]], 6, R.brass); p.lathe([[0.088, 0.33], [0.022, 0.25], [0, 0.25]], 6, R.brass, { shade: (i) => (i ? 0.45 : 0.8) }); });
const VP = [POST[3][0], POST[3][1]];
fit.tube([[VP[0], RAIL + 0.06, VP[1]], [VP[0], 4.06, VP[1]]], 0.016, 4, R.iron, { open: true });
for (const a of [0, 90]) fit.tube([[VP[0] - 0.2 * Math.cos(rad(a)), 3.72, VP[1] + 0.2 * Math.sin(rad(a))], [VP[0] + 0.2 * Math.cos(rad(a)), 3.72, VP[1] - 0.2 * Math.sin(rad(a))]], 0.01, 3, R.iron);
within(vane, move([VP[0], 4.02, VP[1]]), (p) => {                                                           // the arrow points along +X; flat pieces are given both faces
  p.tube([[-0.32, 0, 0], [0.3, 0, 0]], 0.011, 3, R.iron);
  const flat = (pts) => { const c = (q) => [q, R.brass.at(0.5 + q[0], 0.5 + q[1] * 2)]; for (let i = 1; i + 1 < pts.length; i++) { p.tri(c(pts[0]), c(pts[i]), c(pts[i + 1])); p.tri(c(pts[0]), c(pts[i + 1]), c(pts[i])); } };
  flat([[0.28, -0.07, 0], [0.44, 0, 0], [0.28, 0.07, 0]]); flat([[-0.36, -0.1, 0], [-0.18, -0.03, 0], [-0.18, 0.03, 0], [-0.36, 0.1, 0]]);
});

await emit(m, R, ATLAS, args, { extra: { lantern: L } });
