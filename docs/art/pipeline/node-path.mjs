// node-path.mjs model.glb node clip [steps] : where a node is in the model's space through a clip (its origin and
// the way its +Y and +Z point), sampled at steps+1 moments. For checking a socket such as Hollis's `LineHand`.
import { NodeIO } from '@gltf-transform/core'; import { EXTTextureWebP } from '@gltf-transform/extensions'; import { mat4, quat, vec3 } from 'gl-matrix';
const [file, name, clipName, steps = 8] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions([EXTTextureWebP]).read(file), root = doc.getRoot();
const clip = root.listAnimations().find((a) => a.getName() === clipName); if (!clip) throw new Error('no clip ' + clipName);
const tracks = new Map(); let dur = 0;
for (const ch of clip.listChannels()) { const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput(), size = out.getElementSize(); dur = Math.max(dur, inp[inp.length - 1]);
  const at = (t) => { let i = 0; while (i + 2 < inp.length && inp[i + 1] <= t) i++; if (inp.length === 1) return out.getElement(0, []); const a = out.getElement(i, []), b = out.getElement(i + 1, []), k = Math.min(1, Math.max(0, (t - inp[i]) / (inp[i + 1] - inp[i])));
    return size === 4 ? Array.from(quat.slerp(quat.create(), a, b, k)) : a.map((v, j) => v + (b[j] - v) * k); };
  const n = ch.getTargetNode(); if (!tracks.has(n)) tracks.set(n, {}); tracks.get(n)[ch.getTargetPath()] = at; }
const target = root.listNodes().find((n) => n.getName() === name); if (!target) throw new Error('no node ' + name);
const world = (n, t) => { const tr = tracks.get(n) || {}, L = mat4.fromRotationTranslationScale(mat4.create(), tr.rotation ? tr.rotation(t) : n.getRotation(), tr.translation ? tr.translation(t) : n.getTranslation(), n.getScale()); const p = n.getParentNode(); return p ? mat4.multiply(mat4.create(), world(p, t), L) : L; };
const f = (v) => '(' + Array.from(v).map((x) => x.toFixed(3)).join(', ') + ')';
for (let i = 0; i <= steps; i++) { const t = dur * i / steps, W = world(target, t), o = mat4.getTranslation(vec3.create(), W), y = vec3.transformMat4(vec3.create(), [0, 1, 0], W), z = vec3.transformMat4(vec3.create(), [0, 0, 1], W);
  console.log(t.toFixed(2).padStart(6) + ' s  at ' + f(o) + '  +Y ' + f(vec3.sub(y, y, o)) + '  +Z ' + f(vec3.sub(z, z, o))); }
