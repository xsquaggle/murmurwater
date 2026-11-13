// node build-sail-rig.mjs <sail-rig concept.png (1744x2336, transparent)> <out.glb> [--tex 1024]
// Builds boats/sail-rig.glb in code from the painted side elevation of the rig: the picture gives the proportions and is
// also the texture. Mast (lathe), boom and yard (tubes), boom jaw (box) and a two-sided sail grid, one mesh, one material.
// Origin at the mast foot, +Y up, sail in the Y-Z plane, boom toward -Z. The picture is the view from +X.
// Morph target 0 ("belly") fills the sail toward +X; weight -1 fills it toward -X, 0 leaves it flat. Default weight 1.
// Morph target 1 ("furl") lowers the sail: the yard comes down to lie along the boom and the cloth is gathered into a
// roll between them. Default weight 0. The two add up, so set belly to 0 as furl goes to 1.
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';

const [src, out, ...rest] = process.argv.slice(2);
const TEX = rest.includes('--tex') ? +rest[rest.indexOf('--tex') + 1] : 1024;

// ---- measurements of the picture, in its pixels
const CROP = { x0: 81, y0: 105, x1: 1674, y1: 2263 };      // texture = this part of the picture
const MX = 166;                                             // mast centre line
const MAST_HW = 53;                                         // mast half width
const BOOM_PY = 1888, BOOM_R = 32, BOOM_X0 = 250, BOOM_X1 = 1650;
const YARD = { x0: 212, x1: 1648, yAt620: 631, slope: -0.4766, r: 27 };   // centre line y = yAt620 + slope * (x - 620)
const SAIL = { xl: 228, xr: 1608, foot: 1880, headIn: 4 };
const JAW = { x0: 198, x1: 282, y0: 1812, y1: 1968 };

// ---- the rig in metres
const SZ = 2.22 / (1653 - MX);        // boom tip 2.22 m aft of the mast centre
const SV = 2.40 / (BOOM_PY - 113);    // peak 2.40 m above the boom at the mast
const BOOM_Y = 1.10;                  // boom height at the mast
const RISE = 0.35;                    // the boom rises this much from mast to tip, to clear a seated head
const R_MAST = 0.075, R_BOOM = 0.045, R_YARD = 0.040, JAW_HX = 0.062, BELLY = 0.22;
const NS = 10;                        // sides of the mast and spars
const NU = 12, NV = 10;               // sail grid

const Zm = px => -(px - MX) * SZ;
const Ym = py => BOOM_Y + (BOOM_PY - py) * SV;
const Tm = px => (px - MX) / (1653 - MX);
const yardPy = px => YARD.yAt620 + YARD.slope * (px - 620);
const uvOf = (px, py) => [(px - CROP.x0) / (CROP.x1 - CROP.x0), (py - CROP.y0) / (CROP.y1 - CROP.y0)];

const P = [], N = [], UV = [], I = [], DP = [], DN = [], FP = [], FN = [];     // DP, DN: belly deltas; FP, FN: furl deltas
const vert = (p, n, t, dp = [0, 0, 0], dn = [0, 0, 0], fp = [0, 0, 0], fn = [0, 0, 0]) => { P.push(...p); N.push(...n); UV.push(...t); DP.push(...dp); DN.push(...dn); FP.push(...fp); FN.push(...fn); return P.length / 3 - 1; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const at = (arr, i) => [arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]];
function tri(a, b, c) {          // wound so that the face normal agrees with the vertex normals
  const g = cross(sub(at(P, b), at(P, a)), sub(at(P, c), at(P, a)));
  const n = [0, 1, 2].map(k => N[3 * a + k] + N[3 * b + k] + N[3 * c + k]);
  if (dot(g, n) < 0) I.push(a, c, b); else I.push(a, b, c);
}
// lateral texture coordinate round a spar: -1..1 across the picture of the spar on the +X half, mirrored on the -X half
const lat = th => { const a = Math.atan2(Math.sin(th), Math.cos(th)); return Math.abs(a) <= Math.PI / 2 ? a / (Math.PI / 2) : Math.sign(a) * (Math.PI - Math.abs(a)) / (Math.PI / 2); };

// ---- mast: a lathe. rings from the top down: [height m, picture row, half width px]
const lash = 66;
const rings = [
  [Ym(459), 462, 56], [Ym(478), 480, 74], [Ym(520), 520, 74], [Ym(545), 545, 62], [Ym(560), 562, MAST_HW],
  [Ym(664), 664, MAST_HW], [Ym(672), 674, lash], [Ym(746), 744, lash], [Ym(754), 756, MAST_HW],
  [Ym(1766), 1764, MAST_HW], [Ym(1776), 1778, lash], [Ym(1974), 1972, lash], [Ym(1984), 1986, MAST_HW], [Ym(1990), 1992, MAST_HW],
];
{ // below the boom lashing the picture's short mast foot is used three times over (down, mirrored back up, down), so the grain is not stretched far
  const legs = [[1992, 2190], [2190, 2010], [2010, 2244]], px = legs.reduce((n, [a, b]) => n + Math.abs(b - a), 0), top = Ym(1990) - 0.012;
  let done = 0;
  for (const [a, b] of legs) { done += Math.abs(b - a); rings.push([0.012 + top * (1 - done / px), b, MAST_HW]); }
  rings.push([0, 2252, 47]);
}
{
  const k = R_MAST / MAST_HW, first = P.length / 3;
  rings.forEach(([y, py, hw], i) => {
    const a = rings[Math.max(0, i - 1)], b = rings[Math.min(rings.length - 1, i + 1)];
    const tr = (b[2] - a[2]) * k, ty = b[0] - a[0]; const [nr, ny] = norm([-ty, tr, 0]);
    for (let j = 0; j < NS; j++) {
      const th = 2 * Math.PI * j / NS, c = Math.cos(th), s = Math.sin(th), r = hw * k;
      vert([r * c, y, -r * s], norm([nr * c, ny, -nr * s]), uvOf(MX + lat(th) * hw * 0.88, py));
    }
  });
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < NS; j++) {
    const a = first + i * NS + j, b = first + i * NS + (j + 1) % NS, c = a + NS, d = b + NS; tri(a, c, d); tri(a, d, b);
  }
  const top = vert([0, rings[0][0] + 0.006, 0], [0, 1, 0], uvOf(MX, 468)), bot = vert([0, 0, 0], [0, -1, 0], uvOf(MX, 2236));
  const last = first + (rings.length - 1) * NS;
  for (let j = 0; j < NS; j++) { tri(top, first + j, first + (j + 1) % NS); tri(bot, last + (j + 1) % NS, last + j); }
}

// ---- a spar: tube from p0 to p1 (metres, in the Y-Z plane), textured from the picture line i0 to i1
function tube(p0, p1, i0, i1, r, rImg) {
  const a = norm(sub(p1, p0)), n = [0, -a[2], a[1]], L = Math.hypot(...sub(p1, p0));
  const ai = norm([i1[0] - i0[0], i1[1] - i0[1], 0]), ni = [ai[1], -ai[0]], Li = Math.hypot(i1[0] - i0[0], i1[1] - i0[1]);
  const prof = [[0, 0.62, -1], [0.45 * r / L, 0.92, -0.5], [1.1 * r / L, 1, 0], [1 - 1.1 * r / L, 1, 0], [1 - 0.45 * r / L, 0.92, 0.5], [1, 0.62, 1]];   // [fraction, radius scale, normal lean]
  const first = P.length / 3;
  for (const [s, k, lean] of prof) for (let j = 0; j < NS; j++) {
    const th = 2 * Math.PI * j / NS, c = Math.cos(th), sn = Math.sin(th);
    const p = [0, 1, 2].map(q => p0[q] + a[q] * L * s + r * k * ((q === 0 ? c : 0) + sn * n[q]));
    const nn = norm([0, 1, 2].map(q => (q === 0 ? c : 0) + sn * n[q] + a[q] * lean * 0.9));
    const g = lat(th) * rImg * 0.88 * k;
    vert(p, nn, uvOf(i0[0] + ai[0] * Li * s + ni[0] * g, i0[1] + ai[1] * Li * s + ni[1] * g));
  }
  for (let i = 0; i + 1 < prof.length; i++) for (let j = 0; j < NS; j++) {
    const v = first + i * NS + j, w = first + i * NS + (j + 1) % NS; tri(v, v + NS, w + NS); tri(v, w + NS, w);
  }
  const e0 = vert(p0.map((v, q) => v - a[q] * 0.004), a.map(v => -v), uvOf(i0[0] + ai[0] * rImg * 0.5, i0[1] + ai[1] * rImg * 0.5));
  const e1 = vert(p1.map((v, q) => v + a[q] * 0.004), a, uvOf(i1[0] - ai[0] * rImg * 0.5, i1[1] - ai[1] * rImg * 0.5));
  const last = first + (prof.length - 1) * NS;
  for (let j = 0; j < NS; j++) { tri(e0, first + j, first + (j + 1) % NS); tri(e1, last + j, last + (j + 1) % NS); }
}
const boomAt = px => [0, BOOM_Y + RISE * Tm(px), Zm(px)];
tube(boomAt(BOOM_X0), boomAt(BOOM_X1), [BOOM_X0, BOOM_PY], [BOOM_X1, BOOM_PY], R_BOOM, BOOM_R);
const yardAt = px => [0, Ym(yardPy(px)), Zm(px)];
const yardFirst = P.length / 3;
tube(yardAt(YARD.x0), yardAt(YARD.x1), [YARD.x0, yardPy(YARD.x0)], [YARD.x1, yardPy(YARD.x1)], R_YARD, YARD.r);

// ---- furled: the yard lowered onto a roll of cloth that lies along the top of the boom
const FURL = { rx: 0.10, ry: 0.078, lift: 0.9 * R_BOOM };          // half width and half height of the roll, its underside above the boom's centre line
const boomY = z => BOOM_Y + RISE * (-z / 2.22);                     // the boom's centre line, carried on past its tip
const aBoom = norm(sub(boomAt(BOOM_X1), boomAt(BOOM_X0))), aYard = norm(sub(yardAt(YARD.x1), yardAt(YARD.x0))), yardLen = Math.hypot(...sub(yardAt(YARD.x1), yardAt(YARD.x0)));
const yardDown0 = [0, boomY(Zm(YARD.x0)) + FURL.lift + 2 * FURL.ry + R_YARD - 0.012, Zm(YARD.x0)];
const yardDown = px => { const t = (px - YARD.x0) / (YARD.x1 - YARD.x0); return [0, yardDown0[1] + aBoom[1] * yardLen * t, yardDown0[2] + aBoom[2] * yardLen * t]; };
{ // the yard keeps its length: it turns about X from its own slope to the boom's and drops (a morph, so half way it is a hair shorter)
  const c = dot(aYard, aBoom), sn = aYard[1] * aBoom[2] - aYard[2] * aBoom[1], rot = v => [v[0], c * v[1] - sn * v[2], sn * v[1] + c * v[2]], o = yardAt(YARD.x0);
  for (let i = yardFirst; i < P.length / 3; i++) {
    const p = at(P, i), n = at(N, i), q = rot(sub(p, o)).map((v, k) => v + yardDown0[k]), m = rot(n);
    for (let k = 0; k < 3; k++) { FP[3 * i + k] = q[k] - p[k]; FN[3 * i + k] = m[k] - n[k]; }
  }
}

// ---- boom jaw: a block round the boom's fore end, against the mast
{
  const z0 = Zm(JAW.x0), z1 = Zm(JAW.x1), dy = RISE * Tm((JAW.x0 + JAW.x1) / 2), y0 = Ym(JAW.y1) + dy, y1 = Ym(JAW.y0) + dy, hx = JAW_HX;
  const face = (ps, uvs, n) => { const v = ps.map((p, i) => vert(p, n, uvOf(...uvs[i]))); tri(v[0], v[1], v[2]); tri(v[0], v[2], v[3]); };
  const m = 5, { x0, x1, y0: t, y1: b } = JAW;
  for (const sx of [1, -1]) face([[sx * hx, y0, z0], [sx * hx, y0, z1], [sx * hx, y1, z1], [sx * hx, y1, z0]], [[x0 + m, b - m], [x1 - m, b - m], [x1 - m, t + m], [x0 + m, t + m]], [sx, 0, 0]);
  face([[-hx, y1, z0], [hx, y1, z0], [hx, y1, z1], [-hx, y1, z1]], [[x0 + 12, t + 8], [x0 + 12, t + 20], [x1 - 12, t + 20], [x1 - 12, t + 8]], [0, 1, 0]);
  face([[-hx, y0, z0], [hx, y0, z0], [hx, y0, z1], [-hx, y0, z1]], [[x0 + 12, b - 8], [x0 + 12, b - 20], [x1 - 12, b - 20], [x1 - 12, b - 8]], [0, -1, 0]);
  face([[-hx, y0, z1], [hx, y0, z1], [hx, y1, z1], [-hx, y1, z1]], [[x1 - 8, b - 30], [x1 - 20, b - 30], [x1 - 20, t + 30], [x1 - 8, t + 30]], [0, 0, -1]);
  face([[-hx, y0, z0], [hx, y0, z0], [hx, y1, z0], [-hx, y1, z0]], [[x0 + 8, b - 30], [x0 + 20, b - 30], [x0 + 20, t + 30], [x0 + 8, t + 30]], [0, 0, 1]);
}

// ---- sail: a grid between luff, leech, boom and yard, both sides
{
  const camber = u => 0.85 * Math.sin(Math.PI * Math.pow(u, 0.75)) + 0.25 * u * u;
  const S = (u, v, w) => {       // surface point at belly weight w
    const px = SAIL.xl + u * (SAIL.xr - SAIL.xl), head = yardPy(px) + SAIL.headIn, py = SAIL.foot + v * (head - SAIL.foot);
    return { p: [w * BELLY * Math.pow(Math.sin(Math.PI * v), 0.8) * camber(u), Ym(py) + RISE * Tm(px) * (1 - v), Zm(px)], px, py };
  };
  const nrm = (u, v) => { const e = 1e-3, cl = x => Math.min(1, Math.max(0, x));
    const du = sub(S(cl(u + e), v, 1).p, S(cl(u - e), v, 1).p), dv = sub(S(u, cl(v + e), 1).p, S(u, cl(v - e), 1).p); let n = norm(cross(du, dv)); if (n[0] < 0) n = n.map(x => -x); return n; };
  // furled: the foot stays on the boom and the head on the lowered yard. From the foot the cloth goes once round the roll
  // (up the +X side, over, down the -X side: the first 8 rows) and then up through the middle to the yard (the last 2).
  const F = (u, v) => {
    const px = SAIL.xl + u * (SAIL.xr - SAIL.xl), z = Zm(px) + (yardDown(px)[2] - Zm(px)) * v;
    const rx = FURL.rx * (0.8 + 0.2 * Math.sin(Math.PI * u)) * (1 + 0.15 * Math.sin(6 * Math.PI * u + 0.5));       // a little lumpy, slimmer at the ends
    const th = -Math.PI / 2 + 2 * Math.PI * Math.min(v, 0.8) / 0.8, up = Math.max(0, v - 0.8) / 0.2 * 2 * FURL.ry;
    return [v <= 0.8 ? rx * Math.cos(th) : 0, boomY(z) + FURL.lift + FURL.ry + FURL.ry * Math.sin(th) + up, z];
  };
  const fnrm = (u, v) => { const e = 1e-3, cl = x => Math.min(1, Math.max(0, x)); return norm(cross(sub(F(cl(u + e), v), F(cl(u - e), v)), sub(F(u, cl(v + e)), F(u, cl(v - e))))); };
  for (const side of [1, -1]) {
    const first = P.length / 3;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = i / NU, v = j / NV, a = S(u, v, 0), b = S(u, v, 1), n = nrm(u, v), fn = fnrm(u, v);
      vert(a.p, [side, 0, 0], uvOf(a.px, a.py), sub(b.p, a.p), [side * n[0] - side, side * n[1], side * n[2]], sub(F(u, v), a.p), [side * fn[0] - side, side * fn[1], side * fn[2]]);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = first + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; tri(a, b, d); tri(a, d, c);
    }
  }
}

// ---- texture: the picture, with its transparent surround filled from the nearest paint so no edge bleeds
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
{
  const W = info.width, H = info.height; let known = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) known[i] = data[4 * i + 3] > 200 ? 1 : 0;
  for (let it = 0; it < 40; it++) {
    const next = known.slice(); let changed = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (known[i]) continue;
      let r = 0, g = 0, b = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const k = yy * W + xx;
        if (known[k]) { r += data[4 * k]; g += data[4 * k + 1]; b += data[4 * k + 2]; c++; }
      }
      if (c) { data[4 * i] = r / c; data[4 * i + 1] = g / c; data[4 * i + 2] = b / c; next[i] = 1; changed++; }
    }
    known = next; if (!changed) break;
  }
  for (let i = 0; i < W * H; i++) data[4 * i + 3] = 255;
}
const webp = await sharp(data, { raw: info }).removeAlpha()
  .extract({ left: CROP.x0, top: CROP.y0, width: CROP.x1 - CROP.x0, height: CROP.y1 - CROP.y0 })
  .resize(TEX, TEX, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 90, effort: 6 }).toBuffer();

// ---- document
const doc = new Document(); doc.createExtension(EXTTextureWebP).setRequired(true);
const buf = doc.createBuffer();
const acc = (arr, type, T = Float32Array) => doc.createAccessor().setArray(new T(arr)).setType(type).setBuffer(buf);
const texture = doc.createTexture('sail-rig').setImage(webp).setMimeType('image/webp');
const mat = doc.createMaterial('sail-rig_mat').setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(0.9);
const prim = doc.createPrimitive().setMaterial(mat).setIndices(acc(I, 'SCALAR', Uint16Array))
  .setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3')).setAttribute('TEXCOORD_0', acc(UV, 'VEC2'));
prim.addTarget(doc.createPrimitiveTarget('belly').setAttribute('POSITION', acc(DP, 'VEC3')).setAttribute('NORMAL', acc(DN, 'VEC3')));
prim.addTarget(doc.createPrimitiveTarget('furl').setAttribute('POSITION', acc(FP, 'VEC3')).setAttribute('NORMAL', acc(FN, 'VEC3')));
const mesh = doc.createMesh('sail-rig').addPrimitive(prim).setWeights([1, 0]).setExtras({ targetNames: ['belly', 'furl'] });
doc.createScene('sail-rig').addChild(doc.createNode('sail-rig').setMesh(mesh));
await new NodeIO().registerExtensions([EXTTextureWebP]).write(out, doc);
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
console.log(JSON.stringify({ out, verts: P.length / 3, tris: I.length / 3, min: lo.map(v => +v.toFixed(3)), max: hi.map(v => +v.toFixed(3)), boom: { atMast: BOOM_Y, atTip: +(BOOM_Y + RISE * Tm(BOOM_X1)).toFixed(3), length: +Math.hypot(...sub(boomAt(BOOM_X1), boomAt(MX))).toFixed(3) }, mastTop: +rings[0][0].toFixed(3), texBytes: webp.length }));
