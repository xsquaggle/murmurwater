// Rig and animate Biscuit the cat. The auto-rigger only handles bipeds, so the skeleton, skin weights and clips are built here.
// node rig-cat.mjs stand in.glb out.glb     standing sculpt: clips walk (in place) and idle
// node rig-cat.mjs sit   in.glb out.glb     sitting sculpt:  clip sit
// Input is a static GLB from optimize.mjs (facing +Z, metres, feet at y = 0). Joints are world-aligned in the bind pose, so
// every rotation below is about the world axes: X pitch, Y yaw, Z roll.
// Weights: each vertex is first assigned to one body part by simple geometric rules (legs below the belly, tail above the
// rump, head above the collar, which is found by its teal colour in the texture), then the assignment is diffused over the
// mesh so parts blend into each other.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import { quat } from 'gl-matrix';

const [mode, inp, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp); const root = doc.getRoot();
const meshNode = root.listNodes().find(n => n.getMesh()); const mesh = meshNode.getMesh(); const prim = mesh.listPrimitives()[0];
const posA = prim.getAttribute('POSITION'), uvA = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
const nV = posA.getCount(); const P = []; const UV = []; { const p = [], u = []; for (let v = 0; v < nV; v++) { posA.getElement(v, p); uvA.getElement(v, u); P.push([p[0], p[1], p[2]]); UV.push([u[0], u[1]]); } }
const bb = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; for (const p of P) for (let k = 0; k < 3; k++) { bb.min[k] = Math.min(bb.min[k], p[k]); bb.max[k] = Math.max(bb.max[k], p[k]); }

// ---- collar plane from the texture ----
const tex = prim.getMaterial().getBaseColorTexture();
const { data: px, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const colour = (uv) => { const x = Math.min(info.width - 1, Math.max(0, Math.floor(uv[0] * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor(uv[1] * info.height))); const o = (y * info.width + x) * 3; return [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255]; };
const isTeal = (c) => { const mx = Math.max(...c), mn = Math.min(...c); if (mx - mn < 0.08) return false; return c[1] > c[0] + 0.06 && c[2] > c[0] + 0.03; };
const collar = P.filter((_, v) => isTeal(colour(UV[v])));
const cc = [0, 0, 0]; collar.forEach(p => { for (let k = 0; k < 3; k++) cc[k] += p[k] / collar.length; });
// plane normal = smallest-variance direction of the collar ring, kept in the YZ plane (the cat is symmetric in X)
let syy = 0, szz = 0, syz = 0; collar.forEach(p => { const y = p[1] - cc[1], z = p[2] - cc[2]; syy += y * y; szz += z * z; syz += y * z; });
const ang = 0.5 * Math.atan2(2 * syz, syy - szz); let cn = [0, -Math.sin(ang), Math.cos(ang)]; // perpendicular to the major axis
{ const major = [0, Math.cos(ang), Math.sin(ang)]; const along = collar.map(p => (p[1] - cc[1]) * major[1] + (p[2] - cc[2]) * major[2]); const across = collar.map(p => (p[1] - cc[1]) * cn[1] + (p[2] - cc[2]) * cn[2]); const v = a => a.reduce((s, x) => s + x * x, 0); if (v(across) > v(along)) cn = major; }
if (cn[1] < 0) cn = cn.map(x => -x);                       // the head is the upper side
console.error(`collar: ${collar.length} verts, centre ${cc.map(x => x.toFixed(3))}, normal ${cn.map(x => x.toFixed(2))}`);
const aboveCollar = (p) => (p[1] - cc[1]) * cn[1] + (p[2] - cc[2]) * cn[2];

// ---- skeleton ----
const H = bb.max[1];
const J = []; const add = (name, parent, pos) => { J.push({ name, parent, pos }); return J.length - 1; };
let regionOf;
if (mode === 'stand') {
  const bellyY = 0.085 / 0.55 * H, backY = 0.33 / 0.55 * H, tailZ = -0.12 / 0.55 * H;
  const legs = [['FrontLeft', 1, 1], ['FrontRight', -1, 1], ['HindLeft', 1, -1], ['HindRight', -1, -1]];
  const legC = legs.map(([, sx, sz]) => { const m = P.filter(p => p[1] < bellyY * 0.7 && Math.sign(p[0]) === sx && Math.sign(p[2] - 0.0) === sz); const c = [0, 0, 0]; m.forEach(p => { for (let k = 0; k < 3; k++) c[k] += p[k] / m.length; }); return c; });
  const tail = P.filter(p => p[1] > backY && p[2] < tailZ); const tz = (lo, hi) => { const m = tail.filter(p => p[1] >= lo && p[1] < hi); return m.reduce((s, p) => s + p[2], 0) / Math.max(1, m.length); };
  const t1 = backY - 0.02, t2 = backY + (H - backY) * 0.36, t3 = backY + (H - backY) * 0.68;
  const Root = add('Root', -1, [0, 0, 0]);
  const Body = add('Body', Root, [0, 0.20 / 0.55 * H, 0]);
  const Hips = add('Hips', Body, [0, 0.20 / 0.55 * H, -0.07 / 0.55 * H]);
  const Chest = add('Chest', Body, [0, 0.21 / 0.55 * H, 0.05 / 0.55 * H]);
  const Head = add('Head', Chest, [0, cc[1], cc[2]]);
  const T1 = add('Tail1', Hips, [0, t1, tz(t1, t1 + 0.05)]), T2 = add('Tail2', T1, [0, t2, tz(t2 - 0.02, t2 + 0.02)]), T3 = add('Tail3', T2, [0, t3, tz(t3 - 0.02, t3 + 0.02)]);
  const L = legs.map(([n, , sz], i) => add(n + 'Leg', sz > 0 ? Chest : Hips, [legC[i][0], bellyY + 0.01, legC[i][2]]));
  regionOf = (p) => {
    if (p[1] > backY && p[2] < tailZ) return p[1] > t3 ? T3 : p[1] > t2 ? T2 : T1;
    if (p[1] < bellyY) { const i = legs.findIndex(([, sx, sz]) => Math.sign(p[0]) === sx && (p[2] > 0 ? 1 : -1) === sz); return L[Math.max(0, i)]; }
    if (aboveCollar(p) > 0 && p[2] > -0.02) return Head;
    return p[2] > -0.01 ? Chest : Hips;
  };
} else {
  const Root = add('Root', -1, [0, 0, 0]);
  const Body = add('Body', Root, [0, 0.10 / 0.45 * H, 0]);
  const Chest = add('Chest', Body, [0, 0.20 / 0.45 * H, 0.02]);
  const Head = add('Head', Chest, [0, cc[1], cc[2]]);
  regionOf = (p) => aboveCollar(p) > 0 ? Head : p[1] > 0.16 / 0.45 * H ? Chest : Body;
}
const nJ = J.length;

// ---- weights: assign, then diffuse over the welded mesh ----
const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`; const wid = new Map(); const rep = new Int32Array(nV);
for (let v = 0; v < nV; v++) { const k = key(P[v]); if (!wid.has(k)) wid.set(k, wid.size); rep[v] = wid.get(k); }
const nW = wid.size; const nb = Array.from({ length: nW }, () => new Set());
for (let t = 0; t < idx.getCount(); t += 3) { const a = rep[idx.getScalar(t)], b = rep[idx.getScalar(t + 1)], c = rep[idx.getScalar(t + 2)]; nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b); }
let W = new Float32Array(nW * nJ); const hard = new Int32Array(nW); for (let v = 0; v < nV; v++) { const r = regionOf(P[v]); hard[rep[v]] = r; } for (let w = 0; w < nW; w++) W[w * nJ + hard[w]] = 1;
const ITER = mode === 'stand' ? 7 : 10;
for (let it = 0; it < ITER; it++) { const W2 = new Float32Array(W.length); for (let w = 0; w < nW; w++) { const n = nb[w]; for (let j = 0; j < nJ; j++) { let s = 0; for (const o of n) s += W[o * nJ + j]; W2[w * nJ + j] = 0.5 * W[w * nJ + j] + 0.5 * (n.size ? s / n.size : W[w * nJ + j]); } } W = W2; }
const JN = new Uint8Array(nV * 4), WT = new Float32Array(nV * 4);
for (let v = 0; v < nV; v++) { const w = rep[v]; const list = []; for (let j = 0; j < nJ; j++) { const x = Math.pow(W[w * nJ + j], 1.6); if (x > 1e-4) list.push([j, x]); } list.sort((a, b) => b[1] - a[1]); const top = list.slice(0, 4); const sum = top.reduce((s, x) => s + x[1], 0); for (let k = 0; k < 4; k++) { JN[v * 4 + k] = k < top.length ? top[k][0] : 0; WT[v * 4 + k] = k < top.length ? top[k][1] / sum : 0; } }

// ---- write skeleton and skin ----
const buffer = root.listBuffers()[0];
const nodes = J.map(j => doc.createNode(j.name)); const ibm = new Float32Array(nJ * 16);
J.forEach((j, i) => { const pp = j.parent >= 0 ? J[j.parent].pos : [0, 0, 0]; nodes[i].setTranslation([j.pos[0] - pp[0], j.pos[1] - pp[1], j.pos[2] - pp[2]]); if (j.parent >= 0) nodes[j.parent].addChild(nodes[i]); ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -j.pos[0], -j.pos[1], -j.pos[2], 1], i * 16); });
const skin = doc.createSkin('biscuit'); nodes.forEach(n => skin.addJoint(n)); skin.setSkeleton(nodes[0]); skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(JN).setBuffer(buffer)); prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(WT).setBuffer(buffer));
meshNode.setSkin(skin); const scene = root.listScenes()[0]; scene.addChild(nodes[0]);

// ---- clips ----
const rad = Math.PI / 180; const TAU = Math.PI * 2; const FPS = 30;
const eul = (x, y, z) => { const q = quat.create(); quat.rotateY(q, q, y * rad); quat.rotateX(q, q, x * rad); quat.rotateZ(q, q, z * rad); return q; };
function clip(name, duration, fn) { // fn(t) -> { JointName: { r: [x,y,z] degrees, t: [dx,dy,dz] offset, s: [sx,sy,sz] } }
  const frames = Math.round(duration * FPS) + 1; const times = new Float32Array(frames); const tracks = new Map();
  for (let f = 0; f < frames; f++) { const t = f / FPS; times[f] = t; const pose = fn(t); for (const [jn, v] of Object.entries(pose)) { const i = J.findIndex(j => j.name === jn); if (i < 0) throw new Error(jn); if (!tracks.has(jn)) tracks.set(jn, { i, r: v.r && new Float32Array(frames * 4), t: v.t && new Float32Array(frames * 3), s: v.s && new Float32Array(frames * 3) }); const tr = tracks.get(jn); if (v.r) tr.r.set(eul(...v.r), f * 4); if (v.t) { const b = nodes[i].getTranslation(); tr.t.set([b[0] + v.t[0], b[1] + v.t[1], b[2] + v.t[2]], f * 3); } if (v.s) tr.s.set(v.s, f * 3); } }
  const A = doc.createAnimation(name); const inAcc = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  for (const tr of tracks.values()) for (const [path, arr, type] of [['rotation', tr.r, 'VEC4'], ['translation', tr.t, 'VEC3'], ['scale', tr.s, 'VEC3']]) { if (!arr) continue; const o = doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer); const s = doc.createAnimationSampler().setInput(inAcc).setOutput(o).setInterpolation('LINEAR'); A.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[tr.i]).setTargetPath(path).setSampler(s)); }
}
if (mode === 'stand') {
  const T = 0.72;   // one full stride
  clip('walk', T, (t) => {
    const p = TAU * t / T; const s = Math.sin, c = Math.cos; const swing = 30, lift = 0.012 * (H / 0.55);
    const leg = (ph) => ({ r: [swing * s(p + ph), 0, 0], t: [0, lift * Math.max(0, c(p + ph)), 0] });   // lifts while it swings forward
    return {
      Body: { r: [1.5 * s(2 * p), 0, 3.5 * s(p)], t: [0, 0.005 * (H / 0.55) * c(2 * p + 0.6), 0] },
      Hips: { r: [0, 7 * s(p), 2 * s(p)] }, Chest: { r: [0, -5 * s(p), -2 * s(p)] },
      Head: { r: [2.5 * s(2 * p + 0.8), 4 * s(p), -3 * s(p)] },
      Tail1: { r: [3 * s(2 * p), 0, 9 * s(p - 0.6)] }, Tail2: { r: [0, 0, 11 * s(p - 1.3)] }, Tail3: { r: [0, 0, 13 * s(p - 2.0)] },
      FrontLeftLeg: leg(0), HindRightLeg: leg(0.25), FrontRightLeg: leg(Math.PI), HindLeftLeg: leg(Math.PI + 0.25),
    };
  });
  const TI = 4.0;
  clip('idle', TI, (t) => { const p = TAU * t / TI; const s = Math.sin; const b = (s(2 * p) + 1) / 2;
    return { Body: { r: [0, 0, 0], t: [0, 0.002 * b, 0] }, Chest: { r: [-0.8 * b, 0, 0], s: [1 + 0.012 * b, 1 + 0.008 * b, 1] }, Head: { r: [2 * s(p + 1), 7 * s(p), 3 * s(p + 0.5)] },
      Tail1: { r: [0, 0, 7 * s(2 * p)] }, Tail2: { r: [0, 0, 10 * s(2 * p - 0.8)] }, Tail3: { r: [4 * s(2 * p), 0, 14 * s(2 * p - 1.6)] } }; });
} else {
  const TS = 5.0;
  clip('sit', TS, (t) => { const p = TAU * t / TS; const s = Math.sin; const b = (s(2 * p) + 1) / 2;
    return { Chest: { s: [1 + 0.014 * b, 1 + 0.007 * b, 1 + 0.016 * b] }, Head: { r: [2.5 * s(2 * p + 0.7), 6 * s(p), 3.5 * s(p + 1.1)], t: [0, 0.0015 * b, 0] } }; });
}
await doc.transform(prune({ keepLeaves: true }), dedup());
await io.write(out, doc);
console.log(JSON.stringify({ out, joints: J.map(j => j.name), clips: root.listAnimations().map(a => a.getName()) }));
