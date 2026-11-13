// build-pot-float.mjs : the float of a Lantern Pot, built in code (no generation job).
// Usage: node build-pot-float.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]
//   1. node build-pot-float.mjs out.glb --layout pot-float.layout.json      writes where everything sits in the atlas
//   2. python paint-pot-float.py pot-float.layout.json pot-float.png        paints the atlas
//   3. node build-pot-float.mjs out.glb pot-float.png                       builds the model with it
// Origin at the waterline on the axis, +Y up, metres. Two materials: `main` (everything) and `Glass` (the four lantern
// panes; its texture is also its glow map, so emissiveIntensity dims and lights the lantern).
import fs from 'node:fs';
import { Model, rect, rng, rotX, rotY, rotZ, move, compose, rad } from './kit.mjs';

const args = process.argv.slice(2); const flag = (k) => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; };
const layoutOut = flag('--layout'), uvOut = flag('--uv'); const [out, texture] = args;

const ATLAS = [1024, 1024];
// ---- the atlas
const R = {
  body: rect(0, 0, 1024, 560),            // the float: once round, bottom centre at the rectangle's bottom edge
  rope: rect(0, 572, 1024, 636),          // dry rope: along the rope (repeats every 32 px), round it
  ropeWet: rect(0, 648, 1024, 712),       // the same rope under water
  staff: rect(4, 724, 100, 1020),
  roof0: rect(112, 724, 232, 808), roof1: rect(240, 724, 360, 808), roof2: rect(368, 724, 488, 808), roof3: rect(496, 724, 616, 808),
  roofUnder: rect(624, 724, 708, 808),
  glass: rect(720, 724, 848, 852),
  plateTop: rect(112, 820, 232, 940), plateSide: rect(240, 820, 480, 844), plateUnder: rect(240, 856, 360, 976),
  post: rect(496, 820, 532, 940), knob: rect(544, 820, 640, 868), ring: rect(544, 880, 704, 912), eye: rect(544, 924, 704, 956),
};

// ---- sizes (metres)
const SIDES = 14;
const BODY = [[0, -0.170], [0.085, -0.165], [0.150, -0.125], [0.198, -0.060], [0.218, 0.015], [0.214, 0.080], [0.190, 0.140], [0.150, 0.185],
  [0.095, 0.215], [0.058, 0.224], [0.050, 0.246], [0.030, 0.251], [0.018, 0.251]];
const CAP = [1, 9];                          // the profile points where the wooden end caps meet the cork
const STAFF = { r: 0.024, y0: 0.246, y1: 0.350 };
const LAN = { plate: [0.350, 0.366, 0.066], glass: [0.366, 0.456, 0.046], post: 0.010, postAt: 0.052, roof: [0.456, 0.504, 0.082, 0.026], knob: 0.520, ring: [0.535, 0.0165, 0.0048] };
const COLLAR = { y: 0.162, R: 0.184, t: 0.020 };
const EYE = { y: -0.171, R: 0.021, t: 0.006 }, BECKET = { y: -0.209, R: 0.030, t: 0.011 };

const m = new Model('pot-float');
m.material('main', { kind: 'texture', roughness: 0.9 });
m.material('Glass', { kind: 'texture', roughness: 0.35, emissive: [1, 1, 1], glow: true });

// ---- the float: a lathe, a little out of round so that it looks carved, not turned
const rnd = rng(7); const lump = Array.from({ length: BODY.length }, () => Array.from({ length: SIDES }, () => 1 + (rnd() - 0.5) * 0.045));
let L = 0; const acc = [0]; for (let i = 1; i < BODY.length; i++) { L += Math.hypot(BODY[i][0] - BODY[i - 1][0], BODY[i][1] - BODY[i - 1][1]); acc.push(L); }
const bodyV = acc.map(a => a / L);
m.part('body', { crease: 50 }).lathe(BODY, SIDES, R.body, { v: bodyV, wobble: (i, j) => (i >= CAP[1] || i === 0 ? 1 : lump[i][j % SIDES]) });

// ---- the staff
m.part('staff', { crease: 30 }).tube([[0, STAFF.y0, 0], [0.002, (STAFF.y0 + STAFF.y1) / 2, 0.001], [0, STAFF.y1 + 0.004, 0]], [STAFF.r, STAFF.r * 0.94, STAFF.r * 0.9], 6, R.staff, { open: true });

// ---- the lantern: plate, four posts, four panes of glass, a hipped roof, a knob and a carrying ring
const lan = m.part('lantern', { crease: 25 });
{ const [y0, y1, h] = LAN.plate; lan.box([0, (y0 + y1) / 2, 0], [h, (y1 - y0) / 2, h], { px: R.plateSide.sub(0, 0, 0.25, 1), pz: R.plateSide.sub(0.25, 0, 0.5, 1), nx: R.plateSide.sub(0.5, 0, 0.75, 1), nz: R.plateSide.sub(0.75, 0, 1, 1), py: R.plateTop, ny: R.plateUnder }); }
{ const [y0, y1] = LAN.glass, p = LAN.post, a = LAN.postAt;
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) lan.box([sx * a, (y0 + y1) / 2, sz * a], [p, (y1 - y0) / 2, p], { px: R.post, nx: R.post, pz: R.post, nz: R.post }); }
{ const [y0, y1, a, b] = LAN.roof; const w = b / a;
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];                                    // corners, counter-clockwise seen from above is 0,3,2,1
  const faces = [[1, 0], [0, 3], [3, 2], [2, 1]];                                    // +Z face first, then +X, -Z, -X (left to right seen from outside)
  faces.forEach(([i, j], k) => { const r = R['roof' + k]; const lo = (c) => [c[0] * a, y0, c[1] * a], hi = (c) => [c[0] * b, y1, c[1] * b];
    lan.quad([lo(C[i]), r.at(0, 0)], [lo(C[j]), r.at(1, 0)], [hi(C[j]), r.at(0.5 + w / 2, 1)], [hi(C[i]), r.at(0.5 - w / 2, 1)]); });
  lan.face([-a, y0, -a], [a, y0, -a], [a, y0, a], [-a, y0, a], R.roofUnder);                                                       // the underside of the eaves
  lan.lathe([[b * 1.02, y1 - 0.001], [b * 0.8, y1 + 0.008], [b * 0.55, LAN.knob - 0.004], [0, LAN.knob]], 6, R.knob); }
{ const [y, RR, t] = LAN.ring; lan.torus(RR, t, 8, 3, R.ring, { xf: compose(move([0, y, 0]), rotY(rad(25)), rotX(rad(90))) }); }

const glass = m.part('glass', { material: 'Glass', crease: 10 });
{ const [y0, y1, h] = LAN.glass; glass.box([0, (y0 + y1) / 2, 0], [h, (y1 - y0) / 2, h], { px: R.glass, nx: R.glass, pz: R.glass, nz: R.glass }); }

// ---- rope: a grommet round the shoulder, and under water an iron eye with a rope becket for the pot's line
const sag = rng(11); const dips = Array.from({ length: SIDES }, () => (sag() - 0.5) * 0.008);
m.part('collar', { crease: 80 }).torus(COLLAR.R, COLLAR.t, SIDES, 6, R.rope, { xf: move([0, COLLAR.y, 0]), wobble: (i) => dips[i] });
m.part('eye', { crease: 60 }).torus(EYE.R, EYE.t, 6, 3, R.eye, { xf: compose(move([0, EYE.y, 0]), rotX(rad(90))) });
m.part('becket', { crease: 95 }).torus(BECKET.R, BECKET.t, 8, 4, R.ropeWet.sub(0, 0, 0.1875, 1), { xf: compose(move([0, BECKET.y, 0]), rotZ(rad(90))) });

if (layoutOut) {
  const rects = Object.fromEntries(Object.entries(R).map(([k, r]) => [k, [r.x0, r.y0, r.x1, r.y1]]));
  fs.writeFileSync(layoutOut, JSON.stringify({ atlas: ATLAS, rects, body: BODY.map(([r, y], i) => [r, y, +bodyV[i].toFixed(5)]), collar: COLLAR, cap: CAP, sides: SIDES, roofTop: LAN.roof[3] / LAN.roof[2] }, null, 1));
}
if (uvOut) fs.writeFileSync(uvOut, m.uvSvg(ATLAS));
const stats = await m.write(out, { texture: texture && fs.existsSync(texture) ? texture : null, size: 1024, atlas: ATLAS, quality: 90 });
console.log(JSON.stringify(stats));
