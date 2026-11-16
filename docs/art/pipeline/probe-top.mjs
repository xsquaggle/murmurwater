// probe-top.mjs model.glb x0,x1,nx z0,z1,nz [ymax] : the height of the highest surface under each point of a grid
// (a ray straight down from ymax, default above everything), printed as a table: rows are z from far to near, columns x.
// For finding a deck, a thwart or a place to sit in a model that is one fused mesh.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, vec3 } from 'gl-matrix';
const [file, xs, zs, ymaxArg] = process.argv.slice(2); const [x0, x1, nx] = xs.split(',').map(Number), [z0, z1, nz] = zs.split(',').map(Number);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file); const tris = [];
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) { const P = prim.getAttribute('POSITION'), I = prim.getIndices(); const v = []; for (let i = 0; i < P.getCount(); i++) { const p = vec3.transformMat4(vec3.create(), P.getElement(i, []), M); v.push(p); }
    const n = I ? I.getCount() : P.getCount(); for (let i = 0; i < n; i += 3) tris.push([v[I ? I.getScalar(i) : i], v[I ? I.getScalar(i + 1) : i + 1], v[I ? I.getScalar(i + 2) : i + 2]]); } }
const ymax = ymaxArg !== undefined ? Number(ymaxArg) : 1e9;
const top = (x, z) => { let best = -Infinity; for (const [a, b, c] of tris) { const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
  const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue;
  const y = l1 * a[1] + l2 * b[1] + l3 * c[1]; if (y <= ymax && y > best) best = y; } return best; };
const X = Array.from({ length: nx }, (_, i) => x0 + (x1 - x0) * i / Math.max(1, nx - 1)), Z = Array.from({ length: nz }, (_, i) => z1 + (z0 - z1) * i / Math.max(1, nz - 1));
console.log('   z \\ x ' + X.map((x) => x.toFixed(2).padStart(6)).join(''));
for (const z of Z) console.log(z.toFixed(2).padStart(8) + ' ' + X.map((x) => { const y = top(x, z); return (y === -Infinity ? '  .' : y.toFixed(2)).padStart(6); }).join(''));
