// build-the-jaw.mjs : the Jaw, a skull lying on a reef in Saltbone Reach, built in code (no generation job).
// Usage: node build-the-jaw.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// The front half of a skull far too big for any whale, lying on a reef of slate with its mouth fallen open: the cranium
// at the back (-Z), its snout toward +Z, an eye socket high on each side, its upper jaw lifted off the water with a row of
// peg teeth hanging from the rim; and the two halves of the lower jaw lying in the sea, reaching out along it as the
// arms of a cove that opens toward +Z, each with a row of peg teeth standing up along it. The back of the skull is
// broken off. Origin at the waterline in the middle of the cove's mouth: the jawbones' tips are at z = 0.3, 9.1 m apart
// between their inner faces; the skull's broken back is at z = -26. 9 m high; everything goes on to 2.5 m below the
// water. One material, `main`, painted by place (reachmats.py `bone`, `reefrock`).
import { Model, strip, cli, emit, within, move, compose, rotY, rad, rng, add, sub, mul, norm, cross, len } from './kit.mjs';
import { curve, aim, quadToward, triToward } from './fish.mjs';
import { writeGeo } from './geomap.mjs';

const args = cli(), ATLAS = [2048, 2048], rnd = rng(19), DEEP = -2.5, NO = 23, NI = 13, TH = 0.95, NS = 2.15;      // the outer arch's points, the inner's, the rim's thickness, the sections' fullness
// the cranium: z -> [half width at the rim, top, height of the rim, height of the palate's middle]; the mouth is shut behind z = -17
const SK = curve([[-26, 6.6, 7.2, DEEP, DEEP], [-24, 7.2, 8.1, DEEP, DEEP], [-21.5, 7.5, 8.45, DEEP, DEEP], [-19, 7.3, 8.05, DEEP, DEEP], [-17, 6.8, 7.5, -1.4, -0.6],
  [-15.5, 6.2, 6.6, 0.5, 2.2], [-14, 5.6, 6.0, 0.9, 3.0], [-12, 4.8, 5.3, 1.0, 3.4], [-10, 4.0, 4.7, 1.1, 3.4], [-8, 3.3, 4.1, 1.2, 3.1], [-7, 2.9, 3.7, 1.25, 2.8]]);
const ZS = [-26, -24.2, -22.4, -20.8, -19.6, -18.6, -17.6, -16.6, -15.5, -14.3, -13, -11.6, -10.2, -8.6, -7];
const sup = (t) => Math.sign(t) * Math.pow(Math.abs(t), 2 / NS);
const surf = (z, y) => { const [B, T, yl] = SK(z), sn = Math.pow((y - yl) / (T - yl), NS / 2), cs = Math.sqrt(1 - sn * sn); return B * sup(cs); };     // how far out the outer arch is at height y
const EYE = [1, -1].map((sx) => ({ c: [sx * (surf(-18.1, 5.0) - 0.4), 5.0, -18.1], r: 2.05 }));
const tide = { top: 1.3, limpets: 26, size: [0.12, 0.2] };
const skin = { mat: 'bone', tide, lichen: { lo: 6.0, hi: 8.0, amount: 0.1 }, cracks: 1.0, sockets: EYE, soft: 0 };
const R = {
  skull: strip(0, 0, 2048, 1080, skin, 19),
  jawL: strip(0, 1090, 2048, 1330, { ...skin, sockets: [] }, 19), jawR: strip(0, 1340, 2048, 1580, { ...skin, sockets: [] }, 19),
  back: strip(0, 1590, 600, 1840, { mat: 'bone', raw: 0.9, cracks: 0.3, soft: 0 }, 19), front: strip(610, 1590, 1210, 1840, skin, 19),
  teeth: strip(1220, 1590, 2048, 1840, { mat: 'bone', tide, cracks: 0.5, soft: 0 }, 19),
  reef: strip(0, 1850, 2048, 2048, { mat: 'reefrock', top: 1.2, soft: 0 }, 23),
};
const m = new Model('the-jaw'); m.material('main', { kind: 'texture', roughness: 0.92 });
const skull = m.part('skull', { crease: 38 }), jaws = m.part('jaws', { crease: 38 }), teeth = m.part('teeth', { crease: 40 }), reef = m.part('reef', { crease: 45 });

// ---- the cranium: rings across it from the broken back to the snout. Each ring is an outer arch from the left rim over
// the top to the right rim, then an inner arch (the palate) back from right to left; where the mouth is shut the inner
// arch lies flat along the bottom. A low crest runs along the top of the dome; the eye sockets are bowls pressed in with
// a brow over them; the back is broken off raggedly.
const ringAt = (z, k) => {
  const [B, T, yl, P] = SK(z), pts = [], crest = 0.55 * Math.min(1, Math.max(0, (-z - 13) / 6));
  for (let i = 0; i < NO; i++) { const ph = Math.PI * (1 - i / (NO - 1)), x = B * sup(Math.cos(ph)); pts.push([x, yl + (T - yl) * sup(Math.sin(ph)) + crest * Math.exp(-((x / 1.5) ** 2)), z]); }
  const Bi = B - TH, Pi = Math.max(yl, P);
  for (let i = 0; i < NI; i++) { const ph = Math.PI * i / (NI - 1); pts.push([Bi * sup(Math.cos(ph)), yl + (Pi - yl) * sup(Math.sin(ph)), z]); }
  return pts.map((p, i) => {
    let q = p; if (i < NO) for (const e of EYE) { const d = len(sub(p, e.c)) / e.r, n = norm([Math.sign(p[0]), 0.3, 0]), above = p[1] > e.c[1] - 0.3 * e.r;
      if (d < 1) q = add(q, mul(n, -2.0 * Math.pow(1 - d * d, 1.5))); else if (d < 1.7 && above) q = add(q, mul(n, 0.45 * Math.sin(Math.PI * (d - 1) / 0.7))); }
    if (k === 0) q = add(q, [0, 0, 1.5 * (rnd() - 0.5) + (i < NO ? -0.4 * Math.sin(Math.PI * i / (NO - 1)) : 0)]);
    return q;
  });
};
const RINGS = ZS.map(ringAt), NP = NO + NI;
{ // u by arc length round a ring in the middle (so the outer arch gets most of the patch), v by z
  const mid = RINGS[8], acc = [0]; for (let i = 1; i <= NP; i++) acc.push(acc[i - 1] + len(sub(mid[i % NP], mid[i - 1])));
  const U = (i) => acc[i] / acc[NP], V = (z) => (z + 26.9) / 20.0;
  for (let k = 0; k + 1 < RINGS.length; k++) for (let i = 0; i < NP; i++) {
    const a = RINGS[k], b = RINGS[k + 1], j = i + 1, sh = (q) => (q >= NO ? 0.6 : 1);
    skull.quad([a[i], R.skull.at(U(i), V(ZS[k])), sh(i)], [b[i], R.skull.at(U(i), V(ZS[k + 1])), sh(i)], [b[j % NP], R.skull.at(U(j), V(ZS[k + 1])), sh(j % NP)], [a[j % NP], R.skull.at(U(j), V(ZS[k])), sh(j % NP)]);
  }
}
{ // the snout's front: a horseshoe between the outer arch and the palate
  const ring = RINGS[RINGS.length - 1], xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), uv = (p) => [p, R.front.at((p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0))];
  for (let i = 0; i + 1 < NO; i++) { const o0 = ring[i], o1 = ring[i + 1], i0 = ring[NP - 1 - Math.round(i * (NI - 1) / (NO - 1))], i1 = ring[NP - 1 - Math.round((i + 1) * (NI - 1) / (NO - 1))];
    if (i0 === i1) triToward(skull, uv(o0), uv(o1), uv(i0), [0, 0, 1]); else quadToward(skull, uv(o0), uv(o1), uv(i1), uv(i0), [0, 0, 1]); }
}
{ // the broken back: the edge of the shell, then the hollow inside it going dark
  const B0 = RINGS[0], c = [0, 1.6, -26], Q1 = B0.map((p, i) => add(add(c, mul(sub(p, c), 0.8)), [0, 0, 1.1 + 0.6 * rnd()])), Q2 = B0.map((p) => add(add(c, mul(sub(p, c), 0.45)), [0, 0, 4.2])), end = [0, 1.2, -20.5];
  const xs = B0.map((p) => p[0]), ys = B0.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), uv = (p, s = 1) => [p, R.back.at((p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0)), s];
  for (let i = 0; i < NP; i++) { const j = (i + 1) % NP, mid = mul(add(B0[i], B0[j]), 0.5);
    quadToward(skull, uv(B0[i]), uv(B0[j]), uv(Q1[j], 0.8), uv(Q1[i], 0.8), [0, 0, -1]);
    quadToward(skull, uv(Q1[i], 0.55), uv(Q1[j], 0.55), uv(Q2[j], 0.32), uv(Q2[i], 0.32), add(norm(sub(c, mid)), [0, 0, -0.6]));
    triToward(skull, uv(Q2[i], 0.32), uv(Q2[j], 0.32), uv(end, 0.2), [0, 0, -1]); }
}

// ---- the jawbones: each a loft of upright rounded sections along the water from under the cheek to its tip
const JW = curve([[-17, 4.3, 2.9, 2.6], [-14.5, 4.6, 2.85, 3.4], [-12, 4.9, 2.75, 3.0], [-9, 5.05, 2.6, 2.3], [-6, 5.1, 2.5, 2.0], [-3, 4.95, 2.4, 1.8], [-1, 4.7, 2.3, 1.65], [0.3, 4.55, 2.2, 1.5]]);   // z -> inner face, width, top
const JZ = [-17, -15.5, -14, -12.5, -11, -9, -7, -5, -3, -1.6, -0.5];
const jawRing = (z, sx) => { const [inn, w, top] = JW(z), cx = sx * (inn + w / 2), c = sup, s = sup, pts = [];
  for (let i = 0; i < 10; i++) { const a = 2 * Math.PI * i / 10 + Math.PI / 2; const y0 = (DEEP + top) / 2, h = (top - DEEP) / 2; pts.push([cx + sx * (w / 2) * c(Math.cos(a)), y0 + h * s(Math.sin(a)), z]); }
  return pts; };
for (const sx of [-1, 1]) {
  const r = sx < 0 ? R.jawL : R.jawR, rings = JZ.map((z) => jawRing(z, sx)), V = (z) => (z + 17.3) / 18.0, tip = [sx * (4.55 + 1.1), 0.1, 0.3];
  for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < 10; i++) { const a = rings[k], b = rings[k + 1], j = (i + 1) % 10, ui = i / 10, uj = (i + 1) / 10;
    const q = [[a[i], r.at(ui, V(JZ[k]))], [b[i], r.at(ui, V(JZ[k + 1]))], [b[j], r.at(uj, V(JZ[k + 1]))], [a[j], r.at(uj, V(JZ[k]))]]; sx < 0 ? jaws.quad(...q) : jaws.quad(q[3], q[2], q[1], q[0]); }
  const L = rings[rings.length - 1]; for (let i = 0; i < 10; i++) { const j = (i + 1) % 10, t = [[L[i], r.at(i / 10, V(-0.5))], [L[j], r.at((i + 1) / 10, V(-0.5))], [tip, r.at((i + 0.5) / 10, 1)]]; sx > 0 ? jaws.tri(...t) : jaws.tri(t[2], t[1], t[0]); }
}

// ---- peg teeth: blunt five-sided pegs, each in its own cell of the teeth patch
let cell = 0; const peg = (at, dir, h, r) => { const c = cell++, cu = c % 8, cv = Math.floor(c / 8), rr = R.teeth.sub(cu / 8 + 0.005, cv / 4 + 0.01, (cu + 1) / 8 - 0.005, (cv + 1) / 4 - 0.01);
  within(teeth, aim(at, dir), (p) => p.lathe([[r, -0.3], [r * 0.82, h * 0.72], [0, h]], 5, rr, { wobble: (i, j) => 1 + 0.06 * (((j + c) % 3) - 1) })); };
for (const sx of [-1, 1]) for (const z of [-14.4, -13.0, -11.7, -10.4, -9.1, -7.9]) { const [B, , yl] = SK(z); peg([sx * (B - TH / 2), yl + 0.25, z], [0.08 * sx, -1, 0.05], 0.95 + 0.3 * rnd(), 0.30); }
{ const F = RINGS[RINGS.length - 1]; for (const i of [NO + 2, NO + 4, NO + 6, NO + 8, NO + 10]) { const p = F[i]; peg(add(p, [0, 0.2, -0.35]), [0, -1, 0.12], 0.85 + 0.3 * rnd(), 0.26); } }
for (const sx of [-1, 1]) for (const z of [-8.4, -6.4, -4.4, -2.5, -0.8]) { const [inn, w, top] = JW(z); peg([sx * (inn + w / 2) + 0.2 * (rnd() - 0.5), top - 0.25, z], [0.06 * sx, 1, 0.08], 0.9 + 0.35 * rnd(), 0.32); }

// ---- the reef: a low ring of slate round the skull's foot, ragged, that the jawbones run out of
{ const N = 14, RX = 8.4, RZ = 7.6, CZ = -19.0, prof = [[1.0, DEEP], [0.93, -0.4], [0.80, 0.55], [0.62, 0.9]], jit = Array.from({ length: N * 4 }, () => rnd());
  const P = (i, j) => { const a = 2 * Math.PI * j / N, k = prof[i][0] * (1 + 0.16 * (jit[(j % N) * 4 + i] - 0.5)), y = prof[i][1] + (i ? 0.35 * (jit[(j % N) * 4 + ((i + 2) % 4)] - 0.5) : 0); return [RX * k * Math.cos(a), y, CZ - RZ * k * Math.sin(a)]; };
  for (let i = 0; i + 1 < prof.length; i++) for (let j = 0; j < N; j++) reef.quad([P(i, j), R.reef.at(j / N, i / 3)], [P(i, j + 1), R.reef.at((j + 1) / N, i / 3)], [P(i + 1, j + 1), R.reef.at((j + 1) / N, (i + 1) / 3)], [P(i + 1, j), R.reef.at(j / N, (i + 1) / 3)]);
  for (let j = 0; j < N; j++) reef.tri([P(3, j), R.reef.at(j / N, 1)], [P(3, j + 1), R.reef.at((j + 1) / N, 1)], [[0, 0.7, CZ], R.reef.at((j + 0.5) / N, 1)]);
  for (const [x, z, s] of [[8.2, -8.5, 1.1], [-8.0, -10.5, 1.3], [3.0, -25.6, 1.2], [-6.2, -24.8, 1.1]]) within(reef, compose(move([x, 0, z]), rotY(rnd() * 6)), (p) => p.lathe([[s, DEEP], [s * 0.9, 0.1], [s * 0.45, 0.6 + 0.3 * rnd()], [0, 0.75]], 5, R.reef.sub(0, 0, 0.3, 1), { wobble: (i, j) => 1 + 0.25 * (((j * 7 + i * 3) % 5) / 4 - 0.5) })); }

await emit(m, R, ATLAS, args, { size: 2048, quality: 86, extra: writeGeo(m, ATLAS, args) });
