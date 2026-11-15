// kit.mjs : a small mesh kit for props that are built in code (build-pot-float.mjs, build-belfry.mjs, the Fen props).
// A model is a set of parts. A part is a soup of triangles (corners with a position, a texture coordinate in pixels of
// the atlas and a shade 0..1 that becomes COLOR_0); it belongs to a node and a material. write() welds the corners,
// gives them normals (smooth up to the part's crease angle), and writes one GLB with a WebP texture.
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const rad = (d) => d * Math.PI / 180;
/** A seeded random number source (mulberry32). */
export const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---- transforms: a function point -> point. compose(f, g) applies g first.
export const ident = (p) => p;
export const move = (d) => (p) => add(p, d);
export const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return (p) => [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]]; };
export const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; };
export const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]]; };
export const scale = (k) => (p) => (typeof k === 'number' ? mul(p, k) : [p[0] * k[0], p[1] * k[1], p[2] * k[2]]);
export const compose = (...fs) => (p) => fs.reduceRight((q, f) => f(q), p);

/** A rectangle of the atlas in pixels: x0, y0 (top left), x1, y1. at(s, t) is s across and t up from its bottom edge. */
export const rect = (x0, y0, x1, y1) => ({ x0, y0, x1, y1, at: (s, t) => [x0 + (x1 - x0) * s, y1 + (y0 - y1) * t], sub: (s0, t0, s1, t1) => rect(x0 + (x1 - x0) * s0, y1 + (y0 - y1) * t1, x0 + (x1 - x0) * s1, y1 + (y0 - y1) * t0) });

/** Run fn(part) with a further transform on the part (applied before the part's own): for a piece built about the origin and then put somewhere. */
export const within = (part, xf, fn) => { const keep = part.xf; part.xf = compose(keep, xf); try { fn(part); } finally { part.xf = keep; } return part; };

/**
 * Lay rectangles out in an atlas without placing each by hand. items: { name: [width, height, paint] } in pixels, where
 * paint (optional) says how the painter fills it: a material name or { mat, ...options } (see mats.py). Returns
 * { name: rect }, every rect carrying its paint; tallest first, each as high up as it fits, `pad` pixels between rectangles.
 * `at` moves the whole lot (to pack one corner of an atlas and place the rest by hand, see strip()).
 */
export const pack = (W, H, items, pad = 8, at = [0, 0]) => {
  const list = Object.entries(items).map(([name, [w, h, paint]], i) => ({ name, w, h, paint: paint ? { seed: 11 + 7 * i, ...(typeof paint === 'string' ? { mat: paint } : paint) } : null }));
  const out = {}; const sky = new Int32Array(W).fill(pad);                       // the skyline: how far down each column is taken
  for (const it of [...list].sort((a, b) => b.h - a.h || b.w - a.w)) {
    if (it.w + 2 * pad > W) throw new Error(`pack: ${it.name} is wider than the atlas`);
    let best = null;
    for (let x = pad; x + it.w + pad <= W; x += 4) { let y = 0; for (let k = x - pad; k < x + it.w + pad && k < W; k++) y = Math.max(y, sky[Math.max(0, k)]); if (!best || y < best.y) best = { x, y }; }
    if (best.y + it.h + pad > H) throw new Error(`pack: the atlas is full at ${it.name} (${Object.keys(out).length} of ${list.length} placed)`);
    out[it.name] = Object.assign(rect(at[0] + best.x, at[1] + best.y, at[0] + best.x + it.w, at[1] + best.y + it.h), { paint: it.paint }); for (let k = best.x; k < best.x + it.w; k++) sky[k] = best.y + it.h + pad;
  }
  return Object.fromEntries(list.map((it) => [it.name, out[it.name]]));
};
/** A rectangle placed by hand, with its paint (as pack() gives them). */
export const strip = (x0, y0, x1, y1, paint, seed = 5) => Object.assign(rect(x0, y0, x1, y1), { paint: { seed, ...(typeof paint === 'string' ? { mat: paint } : paint) } });
/** The layout file the painter reads: where every rectangle is, how it is to be painted, and anything else the painter needs. */
export const layoutOf = (R, atlas, extra = {}) => ({ atlas, rects: Object.fromEntries(Object.entries(R).map(([k, r]) => [k, [r.x0, r.y0, r.x1, r.y1]])), paint: Object.fromEntries(Object.entries(R).filter(([, r]) => r.paint).map(([k, r]) => [k, r.paint])), ...extra });

/** A builder's command line: <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]. */
export const cli = (argv = process.argv.slice(2)) => { const a = [...argv]; const flag = (k) => { const i = a.indexOf(k); return i < 0 ? null : a.splice(i, 2)[1]; }; const layout = flag('--layout'), uv = flag('--uv'); return { out: a[0], texture: a[1], layout, uv }; };
/** Write what the command line asked for: the layout for the painter, the UV outlines, and the model (textured if the texture exists). */
export const emit = async (m, R, atlas, args, { size = atlas[0] === atlas[1] ? atlas[0] : atlas, glowSize = null, quality = 90, extra = {} } = {}) => {
  if (args.layout) fs.writeFileSync(args.layout, JSON.stringify(layoutOf(R, atlas, extra), null, 1));
  if (args.uv) fs.writeFileSync(args.uv, m.uvSvg(atlas));
  const tex = args.texture && fs.existsSync(args.texture) ? args.texture : null, glow = tex && fs.existsSync(tex.replace(/\.png$/, '.glow.png')) ? tex.replace(/\.png$/, '.glow.png') : null;      // the painter writes <texture>.glow.png when something has a glow map
  const stats = await m.write(args.out, { texture: tex, glowTexture: glow, glowSize, size, atlas, quality }); console.log(JSON.stringify(stats)); return stats;
};

export class Part {
  constructor(name, { node = 'root', material = 'main', crease = 40, shade = 1, xf = ident } = {}) { Object.assign(this, { name, node, material, crease, shade, xf, tris: [] }); }
  /** One triangle, counter-clockwise seen from outside. Corners are [position, uv in pixels, shade?]. */
  tri(a, b, c) { this.tris.push([a, b, c].map(([p, uv, s]) => ({ p: this.xf(p), uv, s: (s ?? 1) * this.shade }))); return this; }
  /** A quad a-b-c-d, counter-clockwise seen from outside. */
  quad(a, b, c, d) { return this.tri(a, b, c).tri(a, c, d); }
  /** A flat quad from four points and a rectangle: a = bottom left, b = bottom right, c = top right, d = top left. */
  face(a, b, c, d, r, s = [1, 1, 1, 1]) { return this.quad([a, r.at(0, 0), s[0]], [b, r.at(1, 0), s[1]], [c, r.at(1, 1), s[2]], [d, r.at(0, 1), s[3]]); }
  /** A flat polygon (convex, counter-clockwise from outside) as a fan; uv(p) gives the pixel for a point. */
  poly(pts, uv, s = 1) { for (let i = 1; i + 1 < pts.length; i++) this.tri([pts[0], uv(pts[0]), s], [pts[i], uv(pts[i]), s], [pts[i + 1], uv(pts[i + 1]), s]); return this; }

  /**
   * A surface of revolution about +Y. profile: [[radius, height], ...] from its start to its end; the outside is to the
   * right of that direction (bottom to top for an outer wall). u runs once round the rectangle, v along the profile by
   * arc length from the rectangle's bottom edge (or by opt.v: one 0..1 per profile point). opt.wobble(i, j, a) scales a
   * ring's radius; opt.shade(i, j) shades a vertex; opt.arc = [from, to] in turns for a part of the circle.
   */
  lathe(profile, sides, r, opt = {}) {
    const n = profile.length; let L = 0; const acc = [0];
    for (let i = 1; i < n; i++) { L += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]); acc.push(L); }
    const vOf = (i) => (opt.v ? opt.v[i] : acc[i] / (L || 1)); const [a0, a1] = opt.arc || [0, 1];
    const P = (i, j) => { const jj = (a0 === 0 && a1 === 1) ? j % sides : j, a = 2 * Math.PI * (a0 + (a1 - a0) * jj / sides), k = opt.wobble ? opt.wobble(i, jj, a) : 1; const [rr, y] = profile[i]; return [rr * k * Math.cos(a), y + (opt.lift ? opt.lift(i, jj, a) : 0), -rr * k * Math.sin(a)]; };
    const C = (i, j) => [P(i, j), r.at(j / sides, vOf(i)), opt.shade ? opt.shade(i, j % sides) : 1];
    for (let i = 0; i + 1 < n; i++) {
      const [ra, ya] = profile[i], [rb, yb] = profile[i + 1]; if (Math.hypot(rb - ra, yb - ya) < 1e-9) continue;
      for (let j = 0; j < sides; j++) {
        if (ra < 1e-9) this.tri(C(i, j), C(i + 1, j + 1), C(i + 1, j));            // a fan round the axis
        else if (rb < 1e-9) this.tri(C(i, j), C(i, j + 1), C(i + 1, j));
        else this.quad(C(i, j), C(i, j + 1), C(i + 1, j + 1), C(i + 1, j));
      }
    }
    return this;
  }

  /** A box. c = centre, h = half sizes. rects: one rectangle for every face, or { px, nx, py, ny, pz, nz }; a missing face is left out. opt.warp(p) moves its corners. */
  box(c, h, rects, opt = {}) {
    const w = opt.warp || ident, R = (k) => (rects.at ? rects : rects[k]); const v = (sx, sy, sz) => w([c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]]);
    const s = opt.shade || {}; const f = (k, a, b, cc, d) => { if (R(k)) this.face(a, b, cc, d, R(k), Array(4).fill(s[k] ?? 1)); };
    f('pz', v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)); f('nz', v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1));
    f('px', v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1)); f('nx', v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1));
    f('py', v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)); f('ny', v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1));
    return this;
  }

  /** A tube along points with a radius at each (number or list), `sides` round; u round the rectangle, v along it (or opt.v: one 0..1 per point). Ends are capped unless opt.open. */
  tube(pts, radius, sides, r, opt = {}) {
    const n = pts.length, R = (i) => (typeof radius === 'number' ? radius : radius[i]); let L = 0; const acc = [0];
    for (let i = 1; i < n; i++) { L += len(sub(pts[i], pts[i - 1])); acc.push(L); }
    const frames = []; let up = opt.up || [0, 1, 0];
    for (let i = 0; i < n; i++) {
      const t = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])); if (Math.abs(dot(t, up)) > 0.95) up = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      const x = norm(cross(up, t)), y = cross(t, x); frames.push({ x, y, t }); up = y;
    }
    const P = (i, j) => { const a = 2 * Math.PI * (j % sides) / sides + (opt.twist || 0), f = frames[i]; return add(pts[i], add(mul(f.x, R(i) * Math.cos(a)), mul(f.y, R(i) * Math.sin(a)))); };
    const C = (i, j) => [P(i, j), r.at(j / sides * (opt.wrap || 1), opt.v ? opt.v[i] : acc[i] / (L || 1)), opt.shade ? opt.shade(i, j % sides) : 1];
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j < sides; j++) this.quad(C(i, j), C(i, j + 1), C(i + 1, j + 1), C(i + 1, j));
    if (!opt.open) for (const [i, flip] of [[0, false], [n - 1, true]]) {
      const cp = [pts[i], r.at(0.5, i ? 1 : 0), 1];
      for (let j = 0; j < sides; j++) flip ? this.tri(cp, C(i, j), C(i, j + 1)) : this.tri(cp, C(i, j + 1), C(i, j));
    }
    return this;
  }

  /** A ring (torus) in the X-Z plane about the origin, then moved by opt.xf. R = ring radius, t = thickness radius. u along the ring (opt.wrap times round the rectangle), v round the rope. */
  torus(R, t, segs, sides, r, opt = {}) {
    const f = opt.xf || ident, wrap = opt.wrap || 1;
    const P = (i, j) => { const a = 2 * Math.PI * (i % segs) / segs, b = 2 * Math.PI * (j % sides) / sides, k = opt.wobble ? opt.wobble(i % segs) : 0, rr = R + t * Math.cos(b); return f([rr * Math.cos(a), t * Math.sin(b) + k, -rr * Math.sin(a)]); };
    const C = (i, j) => [P(i, j), r.at(i / segs * wrap, j / sides), opt.shade ? opt.shade(i % segs, j % sides) : 1];
    for (let i = 0; i < segs; i++) for (let j = 0; j < sides; j++) this.quad(C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1));
    return this;
  }
}

export class Model {
  constructor(name) { this.name = name; this.parts = []; this.nodes = new Map([['root', { pivot: [0, 0, 0], parent: null }]]); this.materials = new Map(); this.empties = []; }
  part(name, opt) { const p = new Part(name, opt); this.parts.push(p); return p; }
  /** A node of its own (something the game moves): its origin is `pivot`, in model coordinates. */
  node(name, pivot = [0, 0, 0], parent = 'root') { this.nodes.set(name, { pivot, parent }); return this; }
  /** An empty node at a point, child of a node. */
  empty(name, at, parent = 'root') { this.empties.push({ name, at, parent }); return this; }
  /** kind 'texture' (the atlas) or 'plain' ({ color: [r, g, b] in linear 0..1 }); emissive: [r, g, b] factor; glow: true gives it an emissive texture: the model's glow map if write() gets one, else the atlas. */
  material(name, def) { this.materials.set(name, def); return this; }

  async write(out, { texture, glowTexture = null, glowSize = null, size = 1024, atlas = [1024, 1024], quality = 90 } = {}) {
    const doc = new Document(); doc.createExtension(EXTTextureWebP).setRequired(true); const buf = doc.createBuffer();
    const acc = (arr, type, T = Float32Array) => doc.createAccessor().setArray(new T(arr)).setType(type).setBuffer(buf);
    let tex = null, texBytes = 0;
    const [sw, sh] = Array.isArray(size) ? size : [size, size], [gw, gh] = glowSize ? (Array.isArray(glowSize) ? glowSize : [glowSize, glowSize]) : [sw, sh];      // a size is one number (square) or [width, height]
    if (texture) { const webp = await sharp(texture).removeAlpha().resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality, effort: 6 }).toBuffer(); texBytes = webp.length; tex = doc.createTexture(this.name).setImage(webp).setMimeType('image/webp'); }
    let gtex = null;                                                                   // a glow map of its own (painted black where nothing glows); without one the atlas is the glow map
    if (glowTexture) { const webp = await sharp(glowTexture).removeAlpha().resize(gw, gh, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality, effort: 6 }).toBuffer(); texBytes += webp.length; gtex = doc.createTexture(this.name + '-glow').setImage(webp).setMimeType('image/webp'); }
    const mats = new Map();
    for (const [name, d] of this.materials) {
      const m = doc.createMaterial(name).setMetallicFactor(d.metallic ?? 0).setRoughnessFactor(d.roughness ?? 0.9);
      if (d.kind === 'texture' && tex) m.setBaseColorTexture(tex); if (d.color) m.setBaseColorFactor([...d.color, 1]); if (d.emissive) m.setEmissiveFactor(d.emissive);
      if (d.glow && (gtex || tex)) m.setEmissiveTexture(gtex || tex);                   // emissive = factor x glow map (the atlas itself if the model has no glow map of its own)
      if (d.doubleSided) m.setDoubleSided(true);
      mats.set(name, m);
    }
    const scene = doc.createScene(this.name); const gn = new Map(); const stats = { nodes: {}, tris: 0, verts: 0 };
    const world = (name) => { const n = this.nodes.get(name); return n.pivot; };
    for (const [name, n] of this.nodes) { const g = doc.createNode(name === 'root' ? this.name : name); gn.set(name, g); }
    for (const [name, n] of this.nodes) { if (n.parent === null) scene.addChild(gn.get(name)); else { gn.get(n.parent).addChild(gn.get(name)); gn.get(name).setTranslation(sub(n.pivot, world(n.parent))); } }
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const [nodeName] of this.nodes) {
      const parts = this.parts.filter(p => p.node === nodeName); if (!parts.length) continue;
      const mesh = doc.createMesh(nodeName === 'root' ? this.name : nodeName); const pivot = world(nodeName); let nodeTris = 0;
      for (const matName of new Set(parts.map(p => p.material))) {
        const P = [], N = [], UV = [], COL = [], I = [], index = new Map(); const textured = this.materials.get(matName).kind === 'texture';
        for (const part of parts.filter(p => p.material === matName)) {
          const tris = part.tris.filter(t => len(cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p))) > 1e-10);
          const fn = tris.map(t => cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p)));       // area-weighted face normals
          const at = new Map(); const key = (p) => p.map(v => Math.round(v * 1e4)).join(',');
          tris.forEach((t, f) => t.forEach(c => { const k = key(c.p); if (!at.has(k)) at.set(k, []); at.get(k).push(f); }));
          const cosC = Math.cos(rad(part.crease));
          tris.forEach((t, f) => t.forEach(c => {
            const me = norm(fn[f]); let n = [0, 0, 0];
            for (const g of at.get(key(c.p))) if (dot(me, norm(fn[g])) >= cosC) n = add(n, fn[g]);
            n = norm(n); const p = sub(c.p, pivot), uv = [c.uv[0] / atlas[0], c.uv[1] / atlas[1]];
            const k = [...p, ...n, ...uv, c.s].map(v => Math.round(v * 1e4)).join(',');
            let i = index.get(k); if (i === undefined) { i = P.length / 3; index.set(k, i); P.push(...p); N.push(...n); UV.push(...uv); COL.push(c.s, c.s, c.s, 1); }
            I.push(i); for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], c.p[q]); hi[q] = Math.max(hi[q], c.p[q]); }
          }));
        }
        const prim = doc.createPrimitive().setMaterial(mats.get(matName)).setIndices(acc(I, 'SCALAR', P.length / 3 > 65535 ? Uint32Array : Uint16Array)).setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3'));
        if (textured) prim.setAttribute('TEXCOORD_0', acc(UV, 'VEC2'));
        if (COL.some((v, i) => i % 4 < 3 && v < 0.999)) prim.setAttribute('COLOR_0', acc(COL, 'VEC4'));
        mesh.addPrimitive(prim); nodeTris += I.length / 3; stats.verts += P.length / 3;
      }
      gn.get(nodeName).setMesh(mesh); stats.nodes[nodeName] = nodeTris; stats.tris += nodeTris;
    }
    for (const e of this.empties) { const n = doc.createNode(e.name).setTranslation(sub(e.at, world(e.parent))); gn.get(e.parent).addChild(n); }
    await new NodeIO().registerExtensions([EXTTextureWebP]).write(out, doc);
    return { out, ...stats, min: lo.map(v => +v.toFixed(3)), max: hi.map(v => +v.toFixed(3)), texBytes };
  }
  /** The outline of every triangle in the atlas, as an SVG to lay over the texture while painting. */
  uvSvg(atlas = [1024, 1024]) {
    const lines = []; for (const p of this.parts) if (this.materials.get(p.material).kind === 'texture') for (const t of p.tris) lines.push(`<polygon points="${t.map(c => c.uv.map(v => v.toFixed(1)).join(',')).join(' ')}"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${atlas[0]}" height="${atlas[1]}"><g fill="none" stroke="#00e0ff" stroke-width="0.6">${lines.join('')}</g></svg>`;
  }
}
