// node open-chest.mjs chest.glb chest-open.glb [--seam 0.31] [--angle 105] [--wall 0.06] [--lidwall 0.04] [--floor 0.07] [--recess 0.05] [--uv 0.36,0.83] [--name chest-open]
// Opens a closed, one-piece chest: cuts the mesh at the lid seam (a horizontal plane), swings everything above it back about the
// rear edge of the seam, and builds what the closed model never had: the rim of the box, its inside walls and floor, and the
// underside of the lid. The new faces use one flat patch of the existing texture (--uv, a plain wood colour) and are shaded with
// vertex colours (COLOR_0), board by board, so the model keeps its one material and one texture.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, prune } from '@gltf-transform/functions';

const [inp, out, ...rest] = process.argv.slice(2);
const opt = { seam: 0.31, angle: 105, wall: 0.06, lidwall: 0.04, floor: 0.07, recess: 0.05, uv: '0.36,0.83', name: 'chest-open' };
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
for (const k of ['seam', 'angle', 'wall', 'lidwall', 'floor', 'recess']) opt[k] = Number(opt[k]);
const UV = opt.uv.split(',').map(Number);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp); const root = doc.getRoot();
const mesh = root.listMeshes()[0]; const prim = mesh.listPrimitives()[0];
const P = prim.getAttribute('POSITION'), Nn = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
const vert = (i) => ({ p: P.getElement(i, []), n: Nn.getElement(i, []), t: T.getElement(i, []), c: [1, 1, 1] });
const mix = (a, b, k) => { const l = (x, y) => x.map((v, i) => v + (y[i] - v) * k); const n = l(a.n, b.n); const m = Math.hypot(...n) || 1; return { p: l(a.p, b.p), n: n.map(v => v / m), t: l(a.t, b.t), c: [1, 1, 1] }; };

// ---- cut every triangle at the seam ----
const body = [], lid = [], segs = [];            // triangles as [v, v, v]; segs: pairs of points on the seam
const Y = opt.seam, EPS = 1e-6;
const clip = (tri, keepAbove) => {
  const outp = [];
  for (let k = 0; k < 3; k++) {
    const a = tri[k], b = tri[(k + 1) % 3]; const da = (a.p[1] - Y) * (keepAbove ? 1 : -1), db = (b.p[1] - Y) * (keepAbove ? 1 : -1);
    if (da >= -EPS) outp.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) { const v = mix(a, b, da / (da - db)); v.p[1] = Y; v.cut = true; outp.push(v); }
  }
  return outp;
};
for (let i = 0; i < I.getCount(); i += 3) {
  const tri = [vert(I.getScalar(i)), vert(I.getScalar(i + 1)), vert(I.getScalar(i + 2))];
  for (const [dst, above] of [[body, false], [lid, true]]) {
    const poly = clip(tri, above); if (poly.length < 3) continue;
    for (let k = 1; k < poly.length - 1; k++) dst.push([poly[0], poly[k], poly[k + 1]]);
    if (!above) { const c = poly.filter(v => v.cut); if (c.length === 2) segs.push([c[0].p, c[1].p]); }
  }
}

// ---- the outline of the cut: chain the segments into loops, keep the largest ----
const key = (p) => `${Math.round(p[0] * 2e4)},${Math.round(p[2] * 2e4)}`;
const adj = new Map(); const pt = new Map();
for (const [a, b] of segs) { const ka = key(a), kb = key(b); if (ka === kb) continue; pt.set(ka, a); pt.set(kb, b); (adj.get(ka) || adj.set(ka, []).get(ka)).push(kb); (adj.get(kb) || adj.set(kb, []).get(kb)).push(ka); }
const seen = new Set(); const loops = [];
for (const start of adj.keys()) {
  if (seen.has(start)) continue; const loop = [start]; seen.add(start); let cur = start, closed = false;
  for (;;) { const next = adj.get(cur).find(k => !seen.has(k)); if (!next) { closed = adj.get(cur).includes(start) && loop.length > 2; break; } seen.add(next); loop.push(next); cur = next; }
  const pts = loop.map(k => pt.get(k)); let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[2] - b[0] * a[2]; }
  loops.push({ pts, area: area / 2, closed });
}
loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
console.error(`cut at y ${Y}: ${segs.length} segments, ${loops.length} loop(s): ` + loops.slice(0, 6).map(l => `${l.pts.length} pts ${Math.abs(l.area).toFixed(4)} m2${l.closed ? '' : ' OPEN'}`).join('; '));
const outline = loops[0].pts; if (!loops[0].closed) console.error('warning: the main outline is not a closed loop');
const xs = outline.map(p => p[0]), zs = outline.map(p => p[2]);
const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
const inset = (w) => ({ x0: box.x0 + w, x1: box.x1 - w, z0: box.z0 + w, z1: box.z1 - w });
let inner = inset(opt.wall);                      // the rectangle the faces below are built on: the box's inside, then the lid's
const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
console.error(`outline x ${box.x0.toFixed(3)}..${box.x1.toFixed(3)} z ${box.z0.toFixed(3)}..${box.z1.toFixed(3)}; inside ${(inner.x1 - inner.x0).toFixed(3)} x ${(inner.z1 - inner.z0).toFixed(3)} m, ${(Y - opt.floor).toFixed(2)} deep`);

// ---- new faces ----
const tri = (dst, a, b, c, want, shade) => {           // a, b, c: positions; want: the side the face must look at; shade: vertex colour
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const m = Math.hypot(...n); if (m < 1e-12) return; n = n.map(x => x / m);
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; n = n.map(x => -x); }
  const mk = (p) => ({ p: [...p], n, t: [UV[0] + (p[0] - cx) * 0.02, UV[1] + (p[2] - cz) * 0.02], c: [shade, shade, shade] });
  dst.push([mk(a), mk(b), mk(c)]);
};
const quad = (dst, a, b, c, d, want, shade) => { tri(dst, a, b, c, want, shade); tri(dst, a, c, d, want, shade); };
const onInner = (p) => {                                // where the ray from the centre through p leaves the inner rectangle, and on which side
  const dx = p[0] - cx, dz = p[2] - cz; const hx = (inner.x1 - inner.x0) / 2, hz = (inner.z1 - inner.z0) / 2;
  const kx = Math.abs(dx) < 1e-9 ? Infinity : hx / Math.abs(dx), kz = Math.abs(dz) < 1e-9 ? Infinity : hz / Math.abs(dz); const k = Math.min(kx, kz);
  return { q: [cx + dx * k, Y, cz + dz * k], side: kx < kz ? (dx > 0 ? 'x1' : 'x0') : (dz > 0 ? 'z1' : 'z0') };
};
const corner = (s1, s2) => { const s = [s1, s2]; return [s.includes('x0') ? inner.x0 : inner.x1, Y, s.includes('z0') ? inner.z0 : inner.z1]; };
const rim = (dst, want, shade) => {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]; const ia = onInner(a), ib = onInner(b);
    quad(dst, a, b, ib.q, ia.q, want, shade);
    if (ia.side !== ib.side && ia.side[0] !== ib.side[0]) tri(dst, ia.q, ib.q, corner(ia.side, ib.side), want, shade);
  }
};
const boards = (dst, y0, y1, n, shades, flat, flatShades) => {
  // four inside walls between y0 and y1 in n horizontal boards, then a flat panel at y1 in boards along x
  const ring = [[inner.x0, inner.z0], [inner.x1, inner.z0], [inner.x1, inner.z1], [inner.x0, inner.z1]];
  for (let w = 0; w < 4; w++) { const [ax, az] = ring[w], [bx, bz] = ring[(w + 1) % 4]; const want = [cx - (ax + bx) / 2, 0, cz - (az + bz) / 2];
    for (let k = 0; k < n; k++) { const ya = y0 + (y1 - y0) * k / n, yb = y0 + (y1 - y0) * (k + 1) / n; quad(dst, [ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az], want, shades[(k + w) % shades.length]); } }
  const m = flatShades.length; for (let k = 0; k < m; k++) { const xa = inner.x0 + (inner.x1 - inner.x0) * k / m, xb = inner.x0 + (inner.x1 - inner.x0) * (k + 1) / m;
    quad(dst, [xa, y1, inner.z0], [xb, y1, inner.z0], [xb, y1, inner.z1], [xa, y1, inner.z1], flat, flatShades[k]); }
};
const nBody = body.length, nLid = lid.length;
{ let poke = 0; for (const t of body) for (const v of t) if (v.p[1] > opt.floor + 0.002 && v.p[1] < Y - 0.002 && v.p[0] > inner.x0 && v.p[0] < inner.x1 && v.p[2] > inner.z0 && v.p[2] < inner.z1) poke++;
  if (poke) console.error(`warning: ${poke} corner(s) of the old shell reach into the new inside; use a larger --wall`); }
rim(body, [0, 1, 0], 0.80);
boards(body, Y, opt.floor, 3, [0.50, 0.44, 0.47], [0, 1, 0], [0.40, 0.36, 0.42, 0.37, 0.41, 0.36]);
inner = inset(opt.lidwall);
rim(lid, [0, -1, 0], 0.72);
boards(lid, Y, Y + opt.recess, 1, [0.48], [0, -1, 0], [0.50, 0.45, 0.52, 0.46, 0.51, 0.45]);

// ---- swing the lid back about the rear edge of the seam ----
const th = -opt.angle * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), hz = box.z0;
for (const t of lid) for (const v of t) { if (v.done) continue; v.done = true;
  const y = v.p[1] - Y, z = v.p[2] - hz; v.p[1] = Y + y * cs - z * sn; v.p[2] = hz + y * sn + z * cs;
  const ny = v.n[1], nz = v.n[2]; v.n = [v.n[0], ny * cs - nz * sn, ny * sn + nz * cs]; }

// ---- write ----
const all = [...body, ...lid]; const n = all.length * 3;
const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
all.forEach((t, i) => t.forEach((v, k) => { const j = i * 3 + k; pos.set(v.p, j * 3); nor.set(v.n, j * 3); uv.set(v.t, j * 2); col.set(v.c, j * 3); }));
const buf = root.listBuffers()[0];
prim.setIndices(null);
for (const [sem, arr, type] of [['POSITION', pos, 'VEC3'], ['NORMAL', nor, 'VEC3'], ['TEXCOORD_0', uv, 'VEC2'], ['COLOR_0', col, 'VEC3']]) prim.setAttribute(sem, doc.createAccessor().setType(type).setArray(arr).setBuffer(buf));
for (const s of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'].includes(s)) prim.setAttribute(s, null);
mesh.setName(opt.name); prim.getMaterial().setName(opt.name + '_mat');
for (const node of root.listNodes()) if (node.getMesh() === mesh) node.setName(opt.name);
for (const s of root.listScenes()) s.setName(opt.name);
await doc.transform(weld(), prune());
await io.write(out, doc);
const pp = root.listMeshes()[0].listPrimitives()[0]; const A = pp.getAttribute('POSITION'); const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], q = [];
for (let i = 0; i < A.getCount(); i++) { A.getElement(i, q); for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], q[c]); hi[c] = Math.max(hi[c], q[c]); } }
console.log(JSON.stringify({ out, tris: pp.getIndices().getCount() / 3, verts: A.getCount(), cut: { body: nBody, lid: nLid }, added: all.length - nBody - nLid, min: lo.map(v => +v.toFixed(3)), max: hi.map(v => +v.toFixed(3)) }));
