// node skin-pose.mjs model.glb clip time [xr]  -> skins the mesh on the CPU at that moment of a clip and prints the underside
// (lowest y per 5 cm of z for |x| < xr), joint positions and the sockets. Used to seat a character at an exact height.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, quat, vec3 } from 'gl-matrix';
const [file, clipName, tArg, xrArg] = process.argv.slice(2); const t = Number(tArg || 0), xr = Number(xrArg || 0.3);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(file); const root = doc.getRoot();
const skin = root.listSkins()[0]; const joints = skin.listJoints(); const ibm = skin.getInverseBindMatrices().getArray();
const anim = root.listAnimations().find(a => a.getName() === clipName); if (!anim) throw new Error('no clip ' + clipName);
const local = new Map();
const sample = (ch) => { const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput(), n = inp.length, size = out.getElementSize(); const a = [], b = [];
  let i = 0; while (i < n - 1 && inp[i + 1] <= t) i++; out.getElement(i, a); if (i >= n - 1 || t <= inp[0]) return a.slice(0, size); out.getElement(i + 1, b); const f = (t - inp[i]) / (inp[i + 1] - inp[i]);
  if (size === 4) { const q = quat.create(); quat.slerp(q, a, b, f); return Array.from(q); } return a.slice(0, size).map((v, c) => v + (b[c] - v) * f); };
for (const ch of anim.listChannels()) { const n = ch.getTargetNode(); if (!local.has(n)) local.set(n, {}); local.get(n)[ch.getTargetPath()] = sample(ch); }
const world = new Map();
const W = (n) => { if (world.has(n)) return world.get(n); const l = local.get(n) || {}; const m = mat4.fromRotationTranslationScale(mat4.create(), l.rotation || n.getRotation(), l.translation || n.getTranslation(), l.scale || n.getScale()); const p = n.getParentNode(); const w = p ? mat4.multiply(mat4.create(), W(p), m) : m; world.set(n, w); return w; };
const JM = joints.map((j, i) => mat4.multiply(mat4.create(), W(j), ibm.subarray(i * 16, i * 16 + 16)));
const prim = root.listMeshes()[0].listPrimitives()[0]; const pos = prim.getAttribute('POSITION'), ja = prim.getAttribute('JOINTS_0'), wa = prim.getAttribute('WEIGHTS_0');
const p = [], jj = [], ww = []; const bins = new Map(); let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let v = 0; v < pos.getCount(); v++) { pos.getElement(v, p); ja.getElement(v, jj); wa.getElement(v, ww); const o = vec3.create();
  for (let k = 0; k < 4; k++) if (ww[k] > 0) { const q = vec3.transformMat4(vec3.create(), p, JM[jj[k]]); vec3.scaleAndAdd(o, o, q, ww[k]); }
  for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], o[c]); hi[c] = Math.max(hi[c], o[c]); }
  if (Math.abs(o[0]) < xr) { const b = Math.floor(o[2] / 0.05); const e = bins.get(b) || { min: 1e9, max: -1e9 }; e.min = Math.min(e.min, o[1]); e.max = Math.max(e.max, o[1]); bins.set(b, e); } }
console.log('bounds', lo.map(v => v.toFixed(3)).join(' '), '..', hi.map(v => v.toFixed(3)).join(' '));
for (const b of [...bins.keys()].sort((a, c) => a - c)) console.log(`z ${(b * 0.05).toFixed(2)}..${(b * 0.05 + 0.05).toFixed(2)}  underside ${bins.get(b).min.toFixed(3)}  top ${bins.get(b).max.toFixed(3)}`);
for (const n of [...joints, ...root.listNodes().filter(n => /Socket$/.test(n.getName()))]) { const w = W(n); if (/Hips|UpLeg|Leg$|Foot|Hand$|Head$|Socket|^Spine$|Arm$/.test(n.getName())) { const y = vec3.transformMat4(vec3.create(), [0, 1, 0], w); console.log(n.getName().padEnd(16), [w[12], w[13], w[14]].map(v => v.toFixed(3)).join(' '), /Socket/.test(n.getName()) ? ' +Y ' + [y[0] - w[12], y[1] - w[13], y[2] - w[14]].map(v => v.toFixed(2)).join(' ') : ''); } }
