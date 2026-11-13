// Optimize a generated GLB for Murmurwater.
// node optimize.mjs in.glb out.glb [--size 1.7] [--axis y|x|z|max] [--yaw 90] [--pitch 0] [--roll 0] [--origin feet|centre]
//   [--tris 3000] [--tex 1024] [--emissive hue0,hue1,minV,minS] [--estrength 1.5] [--name id] [--keep-pbr]
//   [--fit w,h,d]  (non-uniform: stretch the bounds to exactly w x h x d metres after rotation; use for mild corrections only)
//   [--oy 0.6]  (origin this far above the lowest point, e.g. a waterline)  [--cut y --legs d]  (stretch everything below y so the lowest point is d below the origin)
// Static meshes get transforms baked into vertices. Output: +Y up, metres, front toward +Z (after --yaw).
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, flatten, transformPrimitive, textureCompress, getBounds, unpartition, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { addEmissive } from './emissive.mjs';
import { mat4, quat, vec3 } from 'gl-matrix';

const args = process.argv.slice(2);
const [inp, out] = args;
const opt = { oy: null, cut: null, legs: null, size: null, axis: 'max', yaw: 0, pitch: 0, roll: 0, origin: 'feet', tris: null, tex: 1024, emissive: null, ebox: null, estrength: 1.5, name: null, keepPbr: false, rough: 0.9, texfmt: 'webp' };
for (let i = 2; i < args.length; i++) {
  const k = args[i].replace(/^--/, '');
  if (k === 'keep-pbr') { opt.keepPbr = true; continue; }
  opt[k] = args[++i];
}
for (const k of ['oy', 'cut', 'legs', 'size', 'yaw', 'pitch', 'roll', 'tris', 'tex', 'estrength', 'rough']) if (opt[k] !== null) opt[k] = Number(opt[k]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];
const skinned = root.listSkins().length > 0;

const countTris = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = countTris();

await doc.transform(dedup(), weld());
if (opt.tris && countTris() > opt.tris) {
  await MeshoptSimplifier.ready;
  // iterate: simplify stops early on the error bound, so relax until we reach the target
  for (const error of [0.002, 0.005, 0.01, 0.02, 0.05]) {
    const cur = countTris(); if (cur <= opt.tris * 1.02) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: opt.tris / cur, error, lockBorder: false }));
  }
}

// materials: stylised, non-metal, no normal/ORM maps unless asked
for (const m of root.listMaterials()) {
  if (!opt.keepPbr) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(opt.rough); }
  m.setDoubleSided(false);
}

// orientation / scale / origin
const bounds = () => getBounds(scene);
if (!skinned) {
  await doc.transform(flatten());
  const q = quat.create(); quat.fromEuler(q, opt.pitch, opt.yaw, opt.roll);
  const R = mat4.fromQuat(mat4.create(), q);
  const apply = (M) => { for (const node of root.listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const W = mat4.multiply(mat4.create(), M, node.getWorldMatrix()); for (const p of mesh.listPrimitives()) transformPrimitive(p, W); node.setMatrix(mat4.create()); } };
  apply(R);
  let b = bounds(); let size = vec3.sub(vec3.create(), b.max, b.min);
  if (opt.fit) { const f = String(opt.fit).split(',').map(Number); apply(mat4.fromScaling(mat4.create(), [f[0] / size[0], f[1] / size[1], f[2] / size[2]])); }
  else if (opt.size) { const dim = opt.axis === 'max' ? Math.max(...size) : size['xyz'.indexOf(opt.axis)]; const s = opt.size / dim; apply(mat4.fromScaling(mat4.create(), [s, s, s])); }
  b = bounds();
  const c = [(b.min[0] + b.max[0]) / 2, opt.origin === 'feet' ? b.min[1] : (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  if (opt.origin === 'top-back') { c[1] = b.max[1]; c[2] = b.min[2]; }
  apply(mat4.fromTranslation(mat4.create(), [-c[0], -c[1], -c[2]]));
  if (opt.oy !== null) apply(mat4.fromTranslation(mat4.create(), [0, -opt.oy, 0]));
  if (opt.cut !== null && opt.legs !== null) {     // longer legs: scale heights below the cut, leave everything above it alone
    const lowest = bounds().min[1], k = (-opt.legs - opt.cut) / (lowest - opt.cut), v = [0, 0, 0];
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); if (v[1] < opt.cut) { v[1] = opt.cut + (v[1] - opt.cut) * k; a.setElement(i, v); } } }
  }
}

if (opt.emissive) await addEmissive(doc, opt);

await doc.transform(prune(), dedup());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: opt.texfmt, resize: [opt.tex, opt.tex], quality: 92 }));
if (opt.name) { scene.setName(opt.name); root.listMeshes().forEach((m, i) => m.setName(opt.name + (i ? '_' + i : ''))); root.listMaterials().forEach((m, i) => m.setName(opt.name + '_mat' + (i ? i : ''))); }
root.getAsset().generator = 'Murmurwater asset pipeline (gltf-transform)';
await io.write(out, doc);
const b = bounds();
console.log(JSON.stringify({ out, trisBefore: before, tris: countTris(), skinned, size: vec3.sub(vec3.create(), b.max, b.min).map(v => +v.toFixed(3)), min: Array.from(b.min).map(v => +v.toFixed(3)), textures: root.listTextures().map(t => `${t.getName()}:${t.getSize()?.join('x')}:${Math.round(t.getImage().byteLength / 1024)}KB`) }));
