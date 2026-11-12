// Merge single-clip rigged GLBs of the SAME mesh into one GLB with named clips.
// node merge-anim.mjs out.glb [--tex 2048] [--name player] [--fps 30]  name=file.glb[:inplace] name2=file2.glb ...
//
// The first file supplies mesh, skin weights and skeleton. Every auto-rig job produces a slightly different
// skeleton (joint positions and bone axes), so clips are not copied channel-for-channel. Instead each clip is
// retargeted through the skinning matrices: for every frame and joint, M = A_src * IBM_src is the transform the
// source rig applies to the mesh, and the base joint is solved so that A_base * IBM_base = M. The base rig then
// deforms the mesh the same way. Output channels: rotation for every joint, translation for Hips only.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, textureCompress, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';
import { mat4, quat, vec3 } from 'gl-matrix';

const args = process.argv.slice(2);
const out = args[0];
const opt = { tex: 1024, name: 'character', rough: 0.9, fps: 30, root: 'Hips' };
const clips = [];
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[++i]; continue; }
  const eq = args[i].indexOf('='); const name = args[i].slice(0, eq), rest = args[i].slice(eq + 1);
  const [file, ...flags] = rest.split(':');
  const trim = flags.find(f => f.startsWith('trim='));
  clips.push({ name, file, inplace: flags.includes('inplace'), trim: trim ? trim.slice(5).split('-').map(Number) : null });
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function rigOf(doc) {
  const skin = doc.getRoot().listSkins()[0];
  const joints = skin.listJoints();
  const names = joints.map(j => j.getName());
  const index = new Map(names.map((n, i) => [n, i]));
  const parent = joints.map(j => { const p = j.getParentNode(); return p && index.has(p.getName()) ? index.get(p.getName()) : -1; });
  const ibmArr = skin.getInverseBindMatrices().getArray();
  const ibm = joints.map((_, i) => mat4.clone(ibmArr.subarray(i * 16, i * 16 + 16)));
  // evaluation order: parents before children
  const order = []; const seen = new Set();
  const visit = i => { if (seen.has(i)) return; if (parent[i] >= 0) visit(parent[i]); seen.add(i); order.push(i); };
  joints.forEach((_, i) => visit(i));
  const above = joints.map((j, i) => parent[i] < 0 && j.getParentNode() ? mat4.clone(j.getParentNode().getWorldMatrix()) : null);
  return { skin, joints, names, index, parent, ibm, order, above };
}

function sampler(channel) {
  const s = channel.getSampler(); const inp = s.getInput().getArray(); const outA = s.getOutput(); const n = inp.length; const size = outA.getElementSize();
  const step = s.getInterpolation() === 'STEP'; const cubic = s.getInterpolation() === 'CUBICSPLINE';
  const a = [], b = [];
  return (t) => {
    let i = 0; if (t <= inp[0]) i = 0; else if (t >= inp[n - 1]) i = n - 1; else { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (inp[mid] <= t) lo = mid; else hi = mid; } i = lo; }
    const get = (k, o) => { if (cubic) { const e = outA.getArray(); for (let c = 0; c < size; c++) o[c] = e[(k * 3 + 1) * size + c]; return o; } return outA.getElement(k, o); };
    get(i, a); if (i >= n - 1 || step) return a.slice(0, size);
    get(i + 1, b); const f = (t - inp[i]) / (inp[i + 1] - inp[i]);
    if (size === 4) { const q = quat.create(); quat.slerp(q, a, b, f); return Array.from(q); }
    return a.slice(0, size).map((v, c) => v + (b[c] - v) * f);
  };
}

const base = await io.read(clips[0].file);
const root = base.getRoot();
const B = rigOf(base);
const buffer = root.listBuffers()[0];
// base bind pose in world space (metres) with the armature's 0.01 scale removed, so the output skeleton is unit-scale
const unscale = (m) => { const sc = vec3.create(); mat4.getScaling(sc, m); const c = mat4.clone(m); for (let col = 0; col < 3; col++) for (let k = 0; k < 3; k++) c[col * 4 + k] /= sc[col]; return c; };
const bindA = B.ibm.map(m => unscale(mat4.invert(mat4.create(), m)));
const newIbm = new Float32Array(B.joints.length * 16);
bindA.forEach((m, i) => newIbm.set(mat4.invert(mat4.create(), m), i * 16));
B.skin.getInverseBindMatrices().setArray(newIbm);
// every node above the root joint becomes identity (their transforms are now baked into the joints)
for (const i of B.order) if (B.parent[i] < 0) { let n = B.joints[i].getParentNode(); while (n) { n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]); n = n.getParentNode(); } }
// rest pose = bind pose, so the un-animated model stands in its A-pose
for (const i of B.order) {
  const L = B.parent[i] < 0 ? bindA[i] : mat4.multiply(mat4.create(), mat4.invert(mat4.create(), bindA[B.parent[i]]), bindA[i]);
  const t = vec3.create(), r = quat.create(); mat4.getTranslation(t, L); mat4.getRotation(r, unscale(L)); quat.normalize(r, r);
  B.joints[i].setTranslation(Array.from(t)).setRotation(Array.from(r)).setScale([1, 1, 1]);
}
const restT = B.joints.map(j => j.getTranslation());
for (const a of root.listAnimations()) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }

for (const clip of clips) {
  const src = clip.file === clips[0].file ? await io.read(clip.file) : await io.read(clip.file);
  const S = rigOf(src);
  const anim = src.getRoot().listAnimations()[0];
  const tracks = S.joints.map(() => ({}));
  let duration = 0;
  for (const ch of anim.listChannels()) {
    const tn = ch.getTargetNode(); if (!tn || !S.index.has(tn.getName())) continue;
    tracks[S.index.get(tn.getName())][ch.getTargetPath()] = sampler(ch);
    const inp = ch.getSampler().getInput().getArray(); duration = Math.max(duration, inp[inp.length - 1]);
  }
  const t0 = clip.trim ? clip.trim[0] : 0, t1 = clip.trim ? Math.min(duration, clip.trim[1]) : duration; duration = t1 - t0;
  const frames = Math.max(2, Math.round(duration * opt.fps) + 1);
  const times = new Float32Array(frames); for (let f = 0; f < frames; f++) times[f] = Math.min(duration, f / opt.fps);
  const rot = B.joints.map(() => new Float32Array(frames * 4)); const hipsT = new Float32Array(frames * 3);
  const As = S.joints.map(() => mat4.create()), Ab = B.joints.map(() => mat4.create());
  let maxStretch = 0;
  for (let f = 0; f < frames; f++) {
    const t = t0 + times[f];
    for (const i of S.order) {
      const j = S.joints[i], tr = tracks[i];
      const T = tr.translation ? tr.translation(t) : j.getTranslation(), R = tr.rotation ? tr.rotation(t) : j.getRotation(), Sc = tr.scale ? tr.scale(t) : j.getScale();
      const L = mat4.fromRotationTranslationScale(mat4.create(), R, T, Sc);
      if (S.parent[i] < 0) { if (S.above[i]) mat4.multiply(As[i], S.above[i], L); else mat4.copy(As[i], L); } else mat4.multiply(As[i], As[S.parent[i]], L);
    }
    for (const bi of B.order) {
      const si = S.index.get(B.names[bi]);
      const M = mat4.multiply(mat4.create(), As[si], S.ibm[si]);           // skinning matrix of the source rig
      mat4.multiply(Ab[bi], M, bindA[bi]);                                  // base joint that gives the same skinning matrix
    }
    for (const bi of B.order) {
      const L = B.parent[bi] < 0 ? Ab[bi] : mat4.multiply(mat4.create(), mat4.invert(mat4.create(), Ab[B.parent[bi]]), Ab[bi]);
      const s = vec3.create(); mat4.getScaling(s, L); const Ln = mat4.clone(L); for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) Ln[c * 4 + k] /= s[c];
      const r = quat.create(); mat4.getRotation(r, Ln); quat.normalize(r, r);
      if (f > 0) { const p = rot[bi].subarray((f - 1) * 4, f * 4); if (quat.dot(p, r) < 0) quat.scale(r, r, -1); }
      rot[bi].set(r, f * 4);
      const tl = vec3.create(); mat4.getTranslation(tl, L);
      if (B.parent[bi] < 0) hipsT.set(tl, f * 3); else maxStretch = Math.max(maxStretch, vec3.distance(tl, restT[bi]));
    }
  }
  if (clip.inplace) {
    const n = frames, dx = hipsT[(n - 1) * 3] - hipsT[0], dz = hipsT[(n - 1) * 3 + 2] - hipsT[2]; let mx = 0, mz = 0;
    for (let f = 0; f < n; f++) { const u = f / (n - 1); hipsT[f * 3] -= dx * u; hipsT[f * 3 + 2] -= dz * u; mx += hipsT[f * 3]; mz += hipsT[f * 3 + 2]; }
    mx /= n; mz /= n; const hi = B.order.find(i => B.parent[i] < 0);
    for (let f = 0; f < n; f++) { hipsT[f * 3] += restT[hi][0] - mx; hipsT[f * 3 + 2] += restT[hi][2] - mz; }
    console.error(`${clip.name}: removed root drift x=${dx.toFixed(3)} z=${dz.toFixed(3)} (m)`);
  }
  console.error(`${clip.name}: ${frames} frames, ${duration.toFixed(2)}s, joint-offset mismatch absorbed: up to ${(maxStretch * 100).toFixed(2)} cm`);
  const A = base.createAnimation(clip.name);
  const inAcc = base.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  B.joints.forEach((j, bi) => {
    const o = base.createAccessor().setType('VEC4').setArray(rot[bi]).setBuffer(buffer);
    const s = base.createAnimationSampler().setInput(inAcc).setOutput(o).setInterpolation('LINEAR');
    A.addSampler(s).addChannel(base.createAnimationChannel().setTargetNode(j).setTargetPath('rotation').setSampler(s));
    if (B.parent[bi] < 0) {
      const o2 = base.createAccessor().setType('VEC3').setArray(hipsT).setBuffer(buffer);
      const s2 = base.createAnimationSampler().setInput(inAcc).setOutput(o2).setInterpolation('LINEAR');
      A.addSampler(s2).addChannel(base.createAnimationChannel().setTargetNode(j).setTargetPath('translation').setSampler(s2));
    }
  });
}

const scene = root.listScenes()[0];
for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(Number(opt.rough)); m.setDoubleSided(false); m.setName(opt.name + '_mat'); }
for (const mesh of root.listMeshes()) { mesh.setName(opt.name); for (const p of mesh.listPrimitives()) { if (p.getAttribute('TANGENT')) p.setAttribute('TANGENT', null); } }
scene.setName(opt.name);
await base.transform(unpartition(), resample({ tolerance: 1e-5 }), prune(), dedup());
await base.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(opt.tex), Number(opt.tex)], quality: 92 }));
root.getAsset().generator = 'Murmurwater asset pipeline (gltf-transform)';
await io.write(out, base);
console.log(JSON.stringify({ out, clips: root.listAnimations().map(a => `${a.getName()}:${a.listChannels().length}ch`), joints: B.names.length, textures: root.listTextures().map(t => `${t.getSize()?.join('x')}:${Math.round(t.getImage().byteLength / 1024)}KB`) }));
