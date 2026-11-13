// node measure-prop.mjs model.glb : upward-facing area by height (finds decks and lids) and the radius profile by height
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const NB = Number(process.argv[3] || 40);
const P = [], T = [];
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), ix = p.getIndices(), base = P.length; const v = [0, 0, 0];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); P.push([...v]); }
  const n = ix ? ix.getCount() : a.getCount(); for (let i = 0; i < n; i += 3) T.push([0, 1, 2].map(k => base + (ix ? ix.getScalar(i + k) : i + k))); }
const mn = [0, 1, 2].map(k => Math.min(...P.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...P.map(p => p[k])));
console.log('bounds', mn.map(v => v.toFixed(3)), mx.map(v => v.toFixed(3)));
const bins = Array.from({ length: NB }, () => ({ up: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, r: 0, ax0: 1e9, ax1: -1e9, az0: 1e9, az1: -1e9 }));
const bi = y => Math.min(NB - 1, Math.max(0, Math.floor((y - mn[1]) / (mx[1] - mn[1]) * NB)));
for (const p of P) { const b = bins[bi(p[1])]; b.r = Math.max(b.r, Math.hypot(p[0], p[2])); b.ax0 = Math.min(b.ax0, p[0]); b.ax1 = Math.max(b.ax1, p[0]); b.az0 = Math.min(b.az0, p[2]); b.az1 = Math.max(b.az1, p[2]); }
for (const [a, b, c] of T) { const u = P[b].map((v, k) => v - P[a][k]), w = P[c].map((v, k) => v - P[a][k]); const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const A = Math.hypot(...n) / 2; if (n[1] / (2 * A) < 0.9) continue;
  const bb = bins[bi((P[a][1] + P[b][1] + P[c][1]) / 3)]; bb.up += A; for (const q of [a, b, c]) { bb.x0 = Math.min(bb.x0, P[q][0]); bb.x1 = Math.max(bb.x1, P[q][0]); bb.z0 = Math.min(bb.z0, P[q][2]); bb.z1 = Math.max(bb.z1, P[q][2]); } }
bins.forEach((b, i) => console.log((mn[1] + (i + 0.5) / NB * (mx[1] - mn[1])).toFixed(3), 'r', b.r.toFixed(3), 'x', b.ax0.toFixed(3), b.ax1.toFixed(3), 'z', b.az0.toFixed(3), b.az1.toFixed(3), '| up', b.up.toFixed(4), b.up > 0.002 ? `x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)} z ${b.z0.toFixed(3)}..${b.z1.toFixed(3)}` : ''));
