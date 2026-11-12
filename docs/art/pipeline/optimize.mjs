// Optimize a generated GLB for Murmurwater.
// node optimize.mjs in.glb out.glb [--size 1.7] [--axis y|x|z|max] [--yaw 90] [--pitch 0] [--roll 0] [--origin feet|centre]
//   [--tris 3000] [--tex 1024] [--emissive hue0,hue1,minV,minS] [--estrength 1.5] [--name id] [--keep-pbr] [--mirrorx]
// Static meshes get transforms baked into vertices. Output: +Y up, metres, front toward +Z (after --yaw).
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, flatten, transformPrimitive, textureCompress, getBounds, unpartition, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mat4, quat, vec3 } from 'gl-matrix';

const args = process.argv.slice(2);
const [inp, out] = args;
const opt = { size: null, axis: 'max', yaw: 0, pitch: 0, roll: 0, origin: 'feet', tris: null, tex: 1024, emissive: null, ebox: null, estrength: 1.5, name: null, keepPbr: false, rough: 0.9, texfmt: 'webp' };
for (let i = 2; i < args.length; i++) {
  const k = args[i].replace(/^--/, '');
  if (k === 'keep-pbr') { opt.keepPbr = true; continue; }
  opt[k] = args[++i];
}
for (const k of ['size', 'yaw', 'pitch', 'roll', 'tris', 'tex', 'estrength', 'rough']) if (opt[k] !== null) opt[k] = Number(opt[k]);

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
  if (opt.size) { const dim = opt.axis === 'max' ? Math.max(...size) : size['xyz'.indexOf(opt.axis)]; const s = opt.size / dim; apply(mat4.fromScaling(mat4.create(), [s, s, s])); }
  b = bounds();
  const c = [(b.min[0] + b.max[0]) / 2, opt.origin === 'feet' ? b.min[1] : (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  if (opt.origin === 'top-back') { c[1] = b.max[1]; c[2] = b.min[2]; }
  apply(mat4.fromTranslation(mat4.create(), [-c[0], -c[1], -c[2]]));
}

// emissive map from base colour: warm, bright, saturated texels glow
if (opt.emissive) {
  const [h0, h1, minV, minS] = opt.emissive.split(',').map(Number);
  for (const m of root.listMaterials()) {
    const tex = m.getBaseColorTexture(); if (!tex) continue;
    const img = sharp(Buffer.from(tex.getImage()));
    const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const outBuf = Buffer.alloc(info.width * info.height * 3); let lit = 0;
    const W = info.width, H = info.height;
    let mask = null;
    if (opt.ebox) {
      const boxes = opt.ebox.split(';').map(b => b.split(',').map(Number));
      mask = new Uint8Array(W * H);
      for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
        if (p.getMaterial() !== m) continue;
        const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
        const n = idx ? idx.getCount() : pos.getCount();
        const P = [[], [], []], U = [[], [], []];
        for (let t = 0; t < n; t += 3) {
          for (let k = 0; k < 3; k++) { const vi = idx ? idx.getScalar(t + k) : t + k; pos.getElement(vi, P[k]); uv.getElement(vi, U[k]); }
          const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
          if (!boxes.some(bx => cx >= bx[0] && cx <= bx[1] && cy >= bx[2] && cy <= bx[3] && cz >= bx[4] && cz <= bx[5])) continue;
          const x0 = U[0][0] * W, y0 = U[0][1] * H, x1 = U[1][0] * W, y1 = U[1][1] * H, x2 = U[2][0] * W, y2 = U[2][1] * H;
          const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)) - 2), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)) + 2);
          const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)) - 2), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)) + 2);
          const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
          const pad = 2.5 * (Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x0 - x2, y0 - y2)) / Math.abs(area); // ~2.5 px dilation in barycentric units
          for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
            const w0 = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area, w1 = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area, w2 = 1 - w0 - w1;
            if (w0 >= -pad && w1 >= -pad && w2 >= -pad) mask[y * W + x] = 1;
          }
        }
      }
    }
    for (let i = 0, j = 0; i < data.length; i += 3, j += 3) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0; if (d > 1e-5) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
      const s = mx === 0 ? 0 : d / mx;
      const inHue = h0 <= h1 ? (h >= h0 && h <= h1) : (h >= h0 || h <= h1);
      const sm = (x, a, b2) => Math.min(1, Math.max(0, (x - a) / (b2 - a)));
      const px = j / 3; const w = (mask && !mask[px]) ? 0 : inHue ? sm(mx, minV, Math.min(1, minV + 0.08)) * sm(s, minS, minS + 0.1) : 0;
      if (w > 0.5) lit++;
      outBuf[j] = Math.round(data[i] * w); outBuf[j + 1] = Math.round(data[i + 1] * w); outBuf[j + 2] = Math.round(data[i + 2] * w);
    }
    const blurred = await sharp(outBuf, { raw: { width: info.width, height: info.height, channels: 3 } }).blur(1.2).png().toBuffer();
    const et = doc.createTexture((m.getName() || 'mat') + '_emissive').setImage(blurred).setMimeType('image/png');
    m.setEmissiveTexture(et).setEmissiveFactor([1, 1, 1]);
    const ext = doc.createExtension((await import('@gltf-transform/extensions')).KHRMaterialsEmissiveStrength);
    m.setExtension('KHR_materials_emissive_strength', ext.createEmissiveStrength().setEmissiveStrength(opt.estrength));
    console.error(`emissive: ${(100 * lit / (info.width * info.height)).toFixed(2)}% of texels lit`);
  }
}

await doc.transform(prune(), dedup());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: opt.texfmt, resize: [opt.tex, opt.tex], quality: 92 }));
if (opt.name) { scene.setName(opt.name); root.listMeshes().forEach((m, i) => m.setName(opt.name + (i ? '_' + i : ''))); root.listMaterials().forEach((m, i) => m.setName(opt.name + '_mat' + (i ? i : ''))); }
root.getAsset().generator = 'Murmurwater asset pipeline (gltf-transform)';
await io.write(out, doc);
const b = bounds();
console.log(JSON.stringify({ out, trisBefore: before, tris: countTris(), skinned, size: vec3.sub(vec3.create(), b.max, b.min).map(v => +v.toFixed(3)), min: Array.from(b.min).map(v => +v.toFixed(3)), textures: root.listTextures().map(t => `${t.getName()}:${t.getSize()?.join('x')}:${Math.round(t.getImage().byteLength / 1024)}KB`) }));
