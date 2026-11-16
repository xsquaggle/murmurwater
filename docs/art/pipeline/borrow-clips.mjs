// borrow-clips.mjs <figure.glb> <out.glb> name=source.glb#clip[:trim=a-b][:hips=k] ...
// Gives a rigged figure clips from other characters' files. The figure keeps its own mesh and skeleton; every clip is
// carried over through the skinning matrices, as merge-anim.mjs does it: at each frame and joint M = A_src * IBM_src is
// what the source rig does to its mesh there, and the figure's joint is solved so that A * IBM = M. Rest rotations and
// proportions may differ between the two rigs; the joints must have the same names. Output: rotation for every joint
// and translation for the root joint (its movement away from the source's rest place, times hips, default 1).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, quat, vec3 } from 'gl-matrix';

const [inp, out, ...specs] = process.argv.slice(2); const FPS = 30;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const rigOf = (doc) => {
  const skin = doc.getRoot().listSkins()[0], joints = skin.listJoints(), names = joints.map((j) => j.getName()), index = new Map(names.map((n, i) => [n, i]));
  const parent = joints.map((j) => { const p = j.getParentNode(); return p && index.has(p.getName()) ? index.get(p.getName()) : -1; });
  const arr = skin.getInverseBindMatrices().getArray(), ibm = joints.map((_, i) => mat4.clone(arr.subarray(i * 16, i * 16 + 16)));
  const order = [], seen = new Set(), visit = (i) => { if (seen.has(i)) return; if (parent[i] >= 0) visit(parent[i]); seen.add(i); order.push(i); }; joints.forEach((_, i) => visit(i));
  const above = joints.map((j, i) => (parent[i] < 0 && j.getParentNode() ? mat4.clone(j.getParentNode().getWorldMatrix()) : null));
  return { skin, joints, names, index, parent, ibm, order, above };
};
const sampler = (ch) => {
  const s = ch.getSampler(), ti = s.getInput().getArray(), o = s.getOutput(), n = ti.length, size = o.getElementSize(), step = s.getInterpolation() === 'STEP', cubic = s.getInterpolation() === 'CUBICSPLINE', a = [], b = [];
  const get = (k, v) => { if (cubic) { const e = o.getArray(); for (let c = 0; c < size; c++) v[c] = e[(k * 3 + 1) * size + c]; return v; } return o.getElement(k, v); };
  return (t) => {
    let i = 0; if (t >= ti[n - 1]) i = n - 1; else if (t > ti[0]) { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ti[mid] <= t) lo = mid; else hi = mid; } i = lo; }
    get(i, a); if (i >= n - 1 || step) return a.slice(0, size); get(i + 1, b); const f = (t - ti[i]) / (ti[i + 1] - ti[i]);
    if (size === 4) { const q = quat.create(); quat.slerp(q, a, b, f); return Array.from(q); } return a.slice(0, size).map((v, c) => v + (b[c] - v) * f);
  };
};
const base = await io.read(inp), B = rigOf(base), buffer = base.getRoot().listBuffers()[0], bindA = B.ibm.map((m) => mat4.invert(mat4.create(), m));
const rootI = B.order.find((i) => B.parent[i] < 0), restRoot = B.joints[rootI].getTranslation();
for (const a of base.getRoot().listAnimations()) if (specs.some((s) => s.startsWith(a.getName() + '='))) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }
const docs = new Map();
for (const spec of specs) {
  const eq = spec.indexOf('='), name = spec.slice(0, eq), [ref, ...flags] = spec.slice(eq + 1).split(':'), [file, clipName] = ref.split('#');
  const trimF = flags.find((f) => f.startsWith('trim=')), trim = trimF ? trimF.slice(5).split('-').map(Number) : null, hipsF = flags.find((f) => f.startsWith('hips=')), hipsK = hipsF ? Number(hipsF.slice(5)) : 1;
  if (!docs.has(file)) docs.set(file, await io.read(file)); const src = docs.get(file), S = rigOf(src);
  const anim = src.getRoot().listAnimations().find((a) => a.getName() === clipName); if (!anim) throw new Error(`${file} has no clip ${clipName}`);
  const tracks = S.joints.map(() => ({})); let duration = 0;
  for (const ch of anim.listChannels()) { const tn = ch.getTargetNode(); if (!tn || !S.index.has(tn.getName())) continue; tracks[S.index.get(tn.getName())][ch.getTargetPath()] = sampler(ch); const ti = ch.getSampler().getInput().getArray(); duration = Math.max(duration, ti[ti.length - 1]); }
  const t0 = trim ? trim[0] : 0, t1 = trim ? Math.min(duration, trim[1]) : duration; duration = t1 - t0;
  const frames = Math.max(2, Math.round(duration * FPS) + 1), times = new Float32Array(frames); for (let f = 0; f < frames; f++) times[f] = Math.min(duration, f / FPS);
  const rot = B.joints.map(() => new Float32Array(frames * 4)), hipsT = new Float32Array(frames * 3), As = S.joints.map(() => mat4.create()), Ab = B.joints.map(() => mat4.create());
  const srcRest = (() => { const i = S.order.find((k) => S.parent[k] < 0), m = mat4.invert(mat4.create(), S.ibm[i]); return [m[12], m[13], m[14]]; })(), baseRest = [bindA[rootI][12], bindA[rootI][13], bindA[rootI][14]];
  for (let f = 0; f < frames; f++) {
    const t = t0 + times[f];
    for (const i of S.order) { const j = S.joints[i], tr = tracks[i], L = mat4.fromRotationTranslationScale(mat4.create(), tr.rotation ? tr.rotation(t) : j.getRotation(), tr.translation ? tr.translation(t) : j.getTranslation(), tr.scale ? tr.scale(t) : j.getScale());
      if (S.parent[i] < 0) { if (S.above[i]) mat4.multiply(As[i], S.above[i], L); else mat4.copy(As[i], L); } else mat4.multiply(As[i], As[S.parent[i]], L); }
    for (const bi of B.order) { const si = S.index.get(B.names[bi]); if (si === undefined) { mat4.copy(Ab[bi], B.parent[bi] < 0 ? bindA[bi] : mat4.multiply(mat4.create(), Ab[B.parent[bi]], mat4.multiply(mat4.create(), mat4.invert(mat4.create(), bindA[B.parent[bi]]), bindA[bi]))); continue; }
      mat4.multiply(Ab[bi], mat4.multiply(mat4.create(), As[si], S.ibm[si]), bindA[bi]); }
    for (const bi of B.order) {
      const L = B.parent[bi] < 0 ? Ab[bi] : mat4.multiply(mat4.create(), mat4.invert(mat4.create(), Ab[B.parent[bi]]), Ab[bi]);
      const sc = vec3.create(); mat4.getScaling(sc, L); const Ln = mat4.clone(L); for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) Ln[c * 4 + k] /= sc[c];
      const r = quat.create(); mat4.getRotation(r, Ln); quat.normalize(r, r); if (f > 0 && quat.dot(rot[bi].subarray((f - 1) * 4, f * 4), r) < 0) quat.scale(r, r, -1); rot[bi].set(r, f * 4);
      if (B.parent[bi] < 0) { const si = S.index.get(B.names[bi]), move = [As[si][12] - srcRest[0], As[si][13] - srcRest[1], As[si][14] - srcRest[2]]; hipsT.set([restRoot[0] + move[0] * hipsK, restRoot[1] + move[1] * hipsK, restRoot[2] + move[2] * hipsK], f * 3); }
    }
  }
  const A = base.createAnimation(name), ia = base.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  B.joints.forEach((j, bi) => {
    const s = base.createAnimationSampler().setInput(ia).setOutput(base.createAccessor().setType('VEC4').setArray(rot[bi]).setBuffer(buffer)).setInterpolation('LINEAR');
    A.addSampler(s).addChannel(base.createAnimationChannel().setTargetNode(j).setTargetPath('rotation').setSampler(s));
    if (B.parent[bi] < 0) { const st = base.createAnimationSampler().setInput(ia).setOutput(base.createAccessor().setType('VEC3').setArray(hipsT).setBuffer(buffer)).setInterpolation('LINEAR'); A.addSampler(st).addChannel(base.createAnimationChannel().setTargetNode(j).setTargetPath('translation').setSampler(st)); }
  });
  console.error(`${name}: ${frames} frames, ${duration.toFixed(2)} s, from ${clipName} of ${file.split('/').pop()}`);
}
await io.write(out, base);
