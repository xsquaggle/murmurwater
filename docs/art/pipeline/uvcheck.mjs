// uvcheck.mjs <model.glb> : for every primitive, the v of the lowest and highest vertices, and the texture sizes.
import { NodeIO } from '@gltf-transform/core'; import { EXTTextureWebP } from '@gltf-transform/extensions'; import sharp from 'sharp';
const doc = await new NodeIO().registerExtensions([EXTTextureWebP]).read(process.argv[2]);
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  const P = p.getAttribute('POSITION').getArray(), UV = p.getAttribute('TEXCOORD_0').getArray(); let lo = [1e9, 0], hi = [-1e9, 0], vmin = 1e9, vmax = -1e9;
  for (let i = 0; i < P.length / 3; i++) { const y = P[3 * i + 1], v = UV[2 * i + 1]; if (y < lo[0]) lo = [y, v]; if (y > hi[0]) hi = [y, v]; vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
  console.log(p.getMaterial().getName(), 'lowest y', lo[0].toFixed(3), 'v', lo[1].toFixed(4), '| highest y', hi[0].toFixed(3), 'v', hi[1].toFixed(4), '| v range', vmin.toFixed(4), vmax.toFixed(4), '| emissive', p.getMaterial().getEmissiveFactor(), !!p.getMaterial().getEmissiveTexture(), 'doubleSided', p.getMaterial().getDoubleSided());
}
for (const t of doc.getRoot().listTextures()) { const md = await sharp(Buffer.from(t.getImage())).metadata(); console.log('texture', t.getName(), md.width + 'x' + md.height, t.getImage().byteLength, 'bytes'); }
