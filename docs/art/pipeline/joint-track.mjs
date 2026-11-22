// World position of a point fixed to a joint, through a clip: node joint-track.mjs model clip Joint "x,y,z" t1,t2,...   (x,y,z in the joint's own frame)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, quat, vec3 } from 'gl-matrix';
const [inp, clip, jn, off, ts] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(inp); const root = doc.getRoot();
const a = root.listAnimations().find(a => a.getName() === clip); const node = root.listNodes().find(n => n.getName() === jn);
const sample = (ch, t) => { const s = ch.getSampler(), ti = s.getInput().getArray(), o = s.getOutput(); let k = 0; while (k < ti.length - 2 && ti[k + 1] <= t) k++; const u = Math.min(1, Math.max(0, (t - ti[k]) / (ti[k + 1] - ti[k]))); const p = [], q = []; o.getElement(k, p); o.getElement(k + 1, q); return ch.getTargetPath() === 'rotation' ? quat.slerp([], p, q, u) : vec3.lerp([], p, q, u); };
for (const t of ts.split(',').map(Number)) { const local = new Map();
  for (const ch of a.listChannels()) { const n = ch.getTargetNode(); if (!local.has(n)) local.set(n, {}); local.get(n)[ch.getTargetPath()] = sample(ch, t); }
  const world = (n) => { const l = local.get(n) || {}; const m = mat4.fromRotationTranslationScale([], l.rotation || n.getRotation(), l.translation || n.getTranslation(), l.scale || n.getScale()); const p = n.getParentNode(); return p ? mat4.multiply([], world(p), m) : m; };
  const p = vec3.transformMat4([], off.split(',').map(Number), world(node)); console.log(t.toFixed(2), p.map(x => x.toFixed(3)).join(' ')); }
