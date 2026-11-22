// Rig and animate Biscuit the cat. The auto-rigger only handles bipeds, so the skeleton, skin weights and clips are built here.
// node rig-cat.mjs stand in.glb out.glb     standing sculpt: clips walk (in place), idle and swat
// node rig-cat.mjs sit   in.glb out.glb     sitting sculpt:  clips sit, watch and eat
// Input is a static GLB from optimize.mjs (facing +Z, metres, feet at y = 0). Joints are world-aligned in the bind pose, so
// every rotation below is about the world axes: X pitch, Y yaw, Z roll.
// Weights: each vertex is first assigned to one body part by simple geometric rules (legs below the belly, tail above the
// rump, head above the collar, which is found by its teal colour in the texture), then the assignment is diffused over the
// mesh so parts blend into each other. Small parts that ride on one of those (the sitting cat's ears, the end of her tail
// where it lies beside her, her front paws) are laid over that afterwards, each taking its share of a vertex from the rest,
// so the clips made before those joints existed move the mesh as they did.
// The game plays sit and idle all the time and lays watch, eat and swat over them by weight, and two clips that drive the
// same joint each get half of it. So the later clips keep off what the earlier ones drive: `Neck` (no vertices of its own)
// turns the head for them where sit and idle turn `Head`, and swat moves the whole cat by `Root` where idle moves `Body`.
// REGIONS=1 writes the hard assignment as vertex colours instead of the texture, to look at.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import { quat, vec3 } from 'gl-matrix';

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
let regionOf, detailOf = null;
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
  const Neck = add('Neck', Chest, [0, cc[1], cc[2]]);
  const Head = add('Head', Neck, [0, cc[1], cc[2]]);
  const T1 = add('Tail1', Hips, [0, t1, tz(t1, t1 + 0.05)]), T2 = add('Tail2', T1, [0, t2, tz(t2 - 0.02, t2 + 0.02)]), T3 = add('Tail3', T2, [0, t3, tz(t3 - 0.02, t3 + 0.02)]);
  const L = legs.map(([n, , sz], i) => add(n + 'Leg', sz > 0 ? Chest : Hips, [legC[i][0], bellyY + 0.01, legC[i][2]]));
  regionOf = (p) => {
    if (p[1] > backY && p[2] < tailZ) return p[1] > t3 ? T3 : p[1] > t2 ? T2 : T1;
    if (p[1] < bellyY) { const i = legs.findIndex(([, sx, sz]) => Math.sign(p[0]) === sx && (p[2] > 0 ? 1 : -1) === sz); return L[Math.max(0, i)]; }
    if (aboveCollar(p) > 0 && p[2] > -0.02) return Head;
    return p[2] > -0.01 ? Chest : Hips;
  };
} else {
  const u = H / 0.45;
  const Root = add('Root', -1, [0, 0, 0]);
  const Body = add('Body', Root, [0, 0.10 * u, 0]);
  const Chest = add('Chest', Body, [0, 0.20 * u, 0.02]);
  const Neck = add('Neck', Chest, [0, cc[1], cc[2]]);
  const Head = add('Head', Neck, [0, cc[1], cc[2]]);
  regionOf = (p) => aboveCollar(p) > 0 ? Head : p[1] > 0.16 * u ? Chest : Body;
  // Ears: the two peaks of the head. Everything within an ear's width of a peak and above the crown between them.
  const head = P.filter(p => aboveCollar(p) > 0); const hx = head.reduce((s, p) => s + p[0], 0) / head.length;
  const peak = (sx) => head.filter(p => Math.sign(p[0] - hx) === sx).reduce((a, p) => p[1] > a[1] ? p : a, [0, -1, 0]);
  const pk = [peak(1), peak(-1)], mid = (pk[0][0] + pk[1][0]) / 2, crown = Math.max(...head.filter(p => Math.abs(p[0] - mid) < 0.012 * u).map(p => p[1]));
  const earBase = crown - 0.018 * u, earHalf = 0.031 * u, earDeep = 0.042 * u;
  const ears = pk.map((q, i) => add(i ? 'EarRight' : 'EarLeft', Head, [q[0], earBase, q[2] - 0.004 * u]));
  // Tail: it comes round her right side on the ground and ends beside her right front paw. Seen from above, by the angle
  // round her middle from straight ahead (0) toward her right (90): the tube lies outside 0.10 m and under the crease at 0.066 m.
  const ang = (p) => Math.atan2(-p[0], p[2]) * 180 / Math.PI, far = (p) => Math.hypot(p[0], p[2]);
  const inTail = (p) => { const f = ang(p), r = far(p); return p[1] < 0.066 * u && f > 28 && (f > 46 ? r > 0.100 * u : p[0] < -0.052 * u && r > 0.078 * u); };
  const onRing = (f, r, y) => [-Math.sin(f * Math.PI / 180) * r * u, y * u, Math.cos(f * Math.PI / 180) * r * u];
  const TailEnd = add('TailEnd', Body, onRing(100, 0.133, 0.030)), TailTip = add('TailTip', TailEnd, onRing(62, 0.133, 0.030));
  // Front paws: the two cream feet at the front, each turning at its wrist.
  const pawX = [1, -1].map(sx => { const m = P.filter(p => p[1] < 0.03 * u && p[2] > 0.10 * u && Math.sign(p[0] - hx) === sx && Math.abs(p[0] - hx) < 0.075 * u); return m.reduce((s, p) => s + p[0], 0) / m.length; });
  const paws = pawX.map((x, i) => add(i ? 'FrontRightPaw' : 'FrontLeftPaw', Body, [x, 0.050 * u, 0.088 * u]));
  detailOf = (p) => {
    if (aboveCollar(p) > 0 && p[1] > earBase) { const i = pk.findIndex(q => Math.abs(p[0] - q[0]) < earHalf && Math.abs(p[2] - q[2]) < earDeep); if (i >= 0) return ears[i]; }
    if (inTail(p)) { const f = ang(p); return f < 62 ? TailTip : f < 100 ? TailEnd : -1; }
    if (p[1] < 0.052 * u && p[2] > 0.080 * u) { const i = pawX.findIndex(x => Math.abs(p[0] - x) < 0.036 * u); if (i >= 0) return paws[i]; }
    return -1;
  };
  console.error(`ears: peaks ${pk.map(q => q.map(x => x.toFixed(3)))}, crown ${crown.toFixed(3)}; paws at x ${pawX.map(x => x.toFixed(3))}`);
}
const nJ = J.length;
if (process.env.JOINTS) console.error(J.map(j => `${j.name} ${j.pos.map(x => x.toFixed(3))}`).join('\n'));

// ---- weights: assign, then diffuse over the welded mesh ----
const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`; const wid = new Map(); const rep = new Int32Array(nV);
for (let v = 0; v < nV; v++) { const k = key(P[v]); if (!wid.has(k)) wid.set(k, wid.size); rep[v] = wid.get(k); }
const nW = wid.size; const nb = Array.from({ length: nW }, () => new Set());
for (let t = 0; t < idx.getCount(); t += 3) { const a = rep[idx.getScalar(t)], b = rep[idx.getScalar(t + 1)], c = rep[idx.getScalar(t + 2)]; nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b); }
let W = new Float32Array(nW * nJ); const hard = new Int32Array(nW); for (let v = 0; v < nV; v++) { const r = regionOf(P[v]); hard[rep[v]] = r; } for (let w = 0; w < nW; w++) W[w * nJ + hard[w]] = 1;
const ITER = mode === 'stand' ? 7 : 10;
for (let it = 0; it < ITER; it++) { const W2 = new Float32Array(W.length); for (let w = 0; w < nW; w++) { const n = nb[w]; for (let j = 0; j < nJ; j++) { let s = 0; for (const o of n) s += W[o * nJ + j]; W2[w * nJ + j] = 0.5 * W[w * nJ + j] + 0.5 * (n.size ? s / n.size : W[w * nJ + j]); } } W = W2; }
// Small parts: their own assignment, diffused less, taken out of what the vertex had.
let D = null; const detail = new Int32Array(nW).fill(-1);
if (detailOf) { D = new Float32Array(nW * nJ); for (let v = 0; v < nV; v++) { const r = detailOf(P[v]); if (r >= 0) detail[rep[v]] = r; } for (let w = 0; w < nW; w++) if (detail[w] >= 0) D[w * nJ + detail[w]] = 1;
  for (let it = 0; it < 3; it++) { const D2 = new Float32Array(D.length); for (let w = 0; w < nW; w++) { const n = nb[w]; for (let j = 0; j < nJ; j++) { let s = 0; for (const o of n) s += D[o * nJ + j]; D2[w * nJ + j] = 0.5 * D[w * nJ + j] + 0.5 * (n.size ? s / n.size : D[w * nJ + j]); } } D = D2; } }
const JN = new Uint8Array(nV * 4), WT = new Float32Array(nV * 4);
for (let v = 0; v < nV; v++) { const w = rep[v]; let list = []; for (let j = 0; j < nJ; j++) { const x = Math.pow(W[w * nJ + j], 1.6); if (x > 1e-4) list.push([j, x]); }
  if (D) { const own = []; let share = 0; for (let j = 0; j < nJ; j++) { const x = D[w * nJ + j]; if (x > 0.02) { own.push([j, x]); share += x; } }
    if (own.length) { share = Math.min(1, share); const sum = list.reduce((s, x) => s + x[1], 0), so = own.reduce((s, x) => s + x[1], 0); list = list.map(([j, x]) => [j, x / sum * (1 - share)]).concat(own.map(([j, x]) => [j, x / so * share])); } }
  list = list.filter(x => x[1] > 1e-4).sort((a, b) => b[1] - a[1]); const top = list.slice(0, 4); const sum = top.reduce((s, x) => s + x[1], 0); for (let k = 0; k < 4; k++) { JN[v * 4 + k] = k < top.length ? top[k][0] : 0; WT[v * 4 + k] = k < top.length ? top[k][1] / sum : 0; } }

// ---- write skeleton and skin ----
const buffer = root.listBuffers()[0];
const nodes = J.map(j => doc.createNode(j.name)); const ibm = new Float32Array(nJ * 16);
J.forEach((j, i) => { const pp = j.parent >= 0 ? J[j.parent].pos : [0, 0, 0]; nodes[i].setTranslation([j.pos[0] - pp[0], j.pos[1] - pp[1], j.pos[2] - pp[2]]); if (j.parent >= 0) nodes[j.parent].addChild(nodes[i]); ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -j.pos[0], -j.pos[1], -j.pos[2], 1], i * 16); });
const skin = doc.createSkin('biscuit'); nodes.forEach(n => skin.addJoint(n)); skin.setSkeleton(nodes[0]); skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(JN).setBuffer(buffer)); prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(WT).setBuffer(buffer));
meshNode.setSkin(skin); const scene = root.listScenes()[0]; scene.addChild(nodes[0]);
if (process.env.REGIONS) { const col = new Float32Array(nV * 3); const hue = (i) => { const h = i * 0.381966 % 1, f = (n) => { const k = (n + h * 6) % 6; return 1 - 0.75 * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
  for (let v = 0; v < nV; v++) { const w = rep[v]; col.set(hue(detail[w] >= 0 ? detail[w] : hard[w]), v * 3); } prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(col).setBuffer(buffer)); prim.getMaterial().setBaseColorTexture(null); }

// ---- clips ----
const rad = Math.PI / 180; const TAU = Math.PI * 2; const FPS = 30;
const eul = (x, y, z) => { const q = quat.create(); quat.rotateY(q, q, y * rad); quat.rotateX(q, q, x * rad); quat.rotateZ(q, q, z * rad); return q; };
function clip(name, duration, fn) { // fn(t) -> { JointName: { r: [x,y,z] degrees or q: quaternion, t: [dx,dy,dz] offset, s: [sx,sy,sz] } }
  const frames = Math.round(duration * FPS) + 1; const times = new Float32Array(frames); const tracks = new Map();
  for (let f = 0; f < frames; f++) { const t = f / FPS; times[f] = t; const pose = fn(t); for (const [jn, v] of Object.entries(pose)) { const i = J.findIndex(j => j.name === jn); if (i < 0) throw new Error(jn); if (!tracks.has(jn)) tracks.set(jn, { i, r: (v.r || v.q) && new Float32Array(frames * 4), t: v.t && new Float32Array(frames * 3), s: v.s && new Float32Array(frames * 3) }); const tr = tracks.get(jn); if (v.q) tr.r.set(v.q, f * 4); else if (v.r) tr.r.set(eul(...v.r), f * 4); if (v.t) { const b = nodes[i].getTranslation(); tr.t.set([b[0] + v.t[0], b[1] + v.t[1], b[2] + v.t[2]], f * 3); } if (v.s) tr.s.set(v.s, f * 3); } }
  const A = doc.createAnimation(name); const inAcc = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  for (const tr of tracks.values()) for (const [path, arr, type] of [['rotation', tr.r, 'VEC4'], ['translation', tr.t, 'VEC3'], ['scale', tr.s, 'VEC3']]) { if (!arr) continue; const o = doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer); const s = doc.createAnimationSampler().setInput(inAcc).setOutput(o).setInterpolation('LINEAR'); A.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[tr.i]).setTargetPath(path).setSampler(s)); }
}
const bump = (t, t0, len) => { const x = (t - t0) / len; return x > 0 && x < 1 ? Math.sin(Math.PI * x) ** 2 : 0; };   // one smooth pulse
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const keys = (t, k) => { if (t <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * ease((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])); return k[k.length - 1][1]; };
const at = (n) => J.find(j => j.name === n).pos;
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
  // swat: she hooks a fish out. Once, 1 s. The game shows this sculpt only while it plays, and throws the fish from the water in front of
  // her to the boards behind her left shoulder in the first half second: so the clip opens with her down and the right paw in, scoops
  // by 0.2 s, and her head goes round after the fish. The whole cat is moved by Root (the hind feet stay where they stand), the rump is
  // turned back by Hips, and each foot that stays down is aimed at its own place on the ground from wherever its shoulder has got to.
  const LEG = at('FrontLeftLeg')[1], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], turn = (q, v) => vec3.transformQuat([], v, q), inv = (q) => quat.conjugate(quat.create(), q);
  const aim = (parentQ, dir) => quat.multiply(quat.create(), inv(parentQ), quat.rotationTo(quat.create(), [0, -1, 0], vec3.normalize([], dir)));
  clip('swat', 1.0, (t) => {
    const pitch = keys(t, [[0, 13], [0.06, 16], [0.2, 3], [0.34, -5], [0.52, -1], [0.72, 2], [0.9, 0]]), roll = keys(t, [[0, 5], [0.06, 6], [0.2, -2], [0.34, -4], [0.6, -1], [0.85, 0]]);
    const yaw = keys(t, [[0, -4], [0.08, -4], [0.22, 5], [0.4, 12], [0.56, 11], [0.8, 3], [0.94, 0]]), sink = keys(t, [[0, 0.006], [0.06, 0.008], [0.22, 0], [1, 0]]), lunge = keys(t, [[0, 0.022], [0.06, 0.026], [0.24, 0.008], [0.5, -0.004], [0.85, 0]]);
    const qRoot = eul(pitch, yaw, roll), qHips = eul(-0.6 * pitch, -yaw, -0.8 * roll), qRear = quat.multiply(quat.create(), qRoot, qHips);
    // Root goes where the hind hips stay over their feet, at their own height less the sink.
    const hipMid = [0, LEG, (at('HindLeftLeg')[2] + at('HindRightLeg')[2]) / 2], rear = (p) => vec3.add([], turn(qRoot, at('Hips')), turn(qRear, sub(p, at('Hips'))));
    const m = rear(hipMid), tRoot = [-m[0], LEG - sink - m[1], hipMid[2] - m[2] + lunge];
    // A foot that stays down: aimed at its own place on the ground. The leg is one bone, so it cannot fold: it is let out by up to 16 mm
    // or pushed up into her by up to 12 mm, and where the shoulder is lower than that allows the foot goes as far ahead as the leg is long.
    const IN = 0.012, OUT = 0.016;
    const foot = (name, h) => { const b = at(name), dx = b[0] - h[0], m2 = (LEG - IN) ** 2 - h[1] * h[1] - dx * dx, v = [dx, -h[1], Math.max(b[2] - h[2], m2 > 0 ? Math.sqrt(m2) : -1)], d = Math.hypot(...v); return { dir: vec3.scale([], v, 1 / d), more: Math.min(OUT, Math.max(-IN, d - LEG)) }; };
    const leg = (parentQ, dir, more) => ({ q: aim(parentQ, dir), t: turn(inv(parentQ), vec3.scale([], dir, more)) }), plant = (name, parentQ, h) => { const f = foot(name, h); return leg(parentQ, f.dir, f.more); };
    const front = (name) => vec3.add([], tRoot, turn(qRoot, at(name))), hind = (name) => vec3.add([], tRoot, rear(at(name)));
    // The right paw: how far it swings forward from hanging straight down, and how far across toward her left.
    const swing = keys(t, [[0, 66], [0.06, 60], [0.13, 92], [0.2, 122], [0.3, 106], [0.4, 92], [0.52, 52], [0.66, 10], [0.74, 0]]), across = keys(t, [[0, -6], [0.08, -4], [0.2, 10], [0.34, 22], [0.5, 12], [0.7, 0]]), reach = keys(t, [[0, 0.016], [0.06, 0.018], [0.2, 0.01], [0.4, 0.004], [0.6, 0]]);
    const free = [Math.sin(across * rad), -Math.cos(swing * rad) * Math.cos(across * rad), Math.sin(swing * rad) * Math.cos(across * rad)], home = foot('FrontRightLeg', front('FrontRightLeg')), back = ease((t - 0.58) / 0.2);   // and it comes home to its own place
    const paw = leg(qRoot, vec3.normalize([], vec3.lerp([], free, home.dir, back)), reach + (home.more - reach) * back);
    const lash = (ph) => Math.sin(TAU * 2.5 * t + ph) * keys(t, [[0, 1], [0.5, 1], [0.92, 0]]);
    return {
      Root: { q: qRoot, t: tRoot }, Hips: { q: qHips },
      Neck: { r: [keys(t, [[0, 26], [0.07, 28], [0.2, -8], [0.32, -20], [0.46, -6], [0.6, 12], [0.8, 8], [0.95, 0]]), keys(t, [[0, -7], [0.1, -6], [0.22, 14], [0.36, 44], [0.5, 56], [0.62, 52], [0.82, 16], [0.96, 0]]), keys(t, [[0, 4], [0.2, -3], [0.4, -10], [0.6, -8], [0.9, 0]])] },
      FrontRightLeg: paw,
      FrontLeftLeg: plant('FrontLeftLeg', qRoot, front('FrontLeftLeg')), HindLeftLeg: plant('HindLeftLeg', qRear, hind('HindLeftLeg')), HindRightLeg: plant('HindRightLeg', qRear, hind('HindRightLeg')),
      Tail1: { r: [keys(t, [[0, 10], [0.2, -6], [0.6, 0]]), 0, 16 * lash(0)] }, Tail2: { r: [0, 0, 24 * lash(-0.9)] }, Tail3: { r: [0, 0, 30 * lash(-1.8)] },
    }; });
} else {
  const TS = 5.0;
  clip('sit', TS, (t) => { const p = TAU * t / TS; const s = Math.sin; const b = (s(2 * p) + 1) / 2;
    return { Chest: { s: [1 + 0.014 * b, 1 + 0.007 * b, 1 + 0.016 * b] }, Head: { r: [2.5 * s(2 * p + 0.7), 6 * s(p), 3.5 * s(p + 1.1)], t: [0, 0.0015 * b, 0] } }; });
  // The tail's end lies on the ground: it lifts about the level axis square to the way it runs, and swings about the upright one.
  const tailTo = { TailEnd: at('TailTip'), TailTip: [-0.052 * (H / 0.45), 0.03 * (H / 0.45), 0.087 * (H / 0.45)] };
  const tail = (name, lift, swing) => { const a = at(name), b = tailTo[name], d = [b[0] - a[0], b[2] - a[2]], n = Math.hypot(...d); const q = quat.setAxisAngle(quat.create(), [-d[1] / n, 0, d[0] / n], lift * rad); return { q: quat.multiply(quat.create(), quat.setAxisAngle(quat.create(), [0, 1, 0], -swing * rad), q) }; };
  // watch: she leans out to look over the side, ears forward, and the tip of her tail goes. A loop; the game fades it in over sit.
  const TW = 2.4;
  clip('watch', TW, (t) => { const p = TAU * t / TW; const s = Math.sin;
    const flick = bump(t, 0.16, 0.34) + 0.6 * bump(t, 0.58, 0.28) + bump(t, 1.38, 0.36) + 0.45 * bump(t, 1.92, 0.26), twitch = bump(t, 1.02, 0.22);
    return {
      Body: { r: [5 + 0.6 * s(p), 0, 0] }, Chest: { r: [9 + 1.0 * s(p + 0.6), 3 * s(p), 0] },
      Neck: { r: [27 + 2 * s(p + 1.2), 5 * s(p + 0.4), 0], t: [0, -0.004, 0.012] },
      EarLeft: { r: [9 + 1.5 * s(2 * p), 0, 5] }, EarRight: { r: [9 + 1.5 * s(2 * p + 1) - 16 * twitch, 0, -5 + 17 * twitch] },   // +Z roll tips an ear toward her right
      TailEnd: tail('TailEnd', 3 + 8 * flick + 2 * s(p), 3 * s(p + 0.5)), TailTip: tail('TailTip', 4 + 32 * flick, 6 + 18 * flick + 4 * s(p)),
    }; });
  // eat: head down, working at something between her paws. Once, 2.5 s; it carries its own way down and back up.
  const TE = 2.5;
  clip('eat', TE, (t) => { const s = Math.sin; const e = ease(t / 0.38) * ease((TE - t) / 0.42);
    const chew = e * s(TAU * 4.6 * t) * (0.6 + 0.4 * s(TAU * 0.9 * t + 1)), tug = bump(t, 1.16, 0.36), gnaw = e * s(TAU * 1.15 * t + 0.4);
    const knead = (ph) => e * Math.max(0, s(TAU * 1.5 * t + ph)) ** 2;
    return {
      Body: { r: [11 * e, 0, 1.5 * gnaw] }, Chest: { r: [24 * e - 6 * tug, 3 * gnaw, 0] },
      Neck: { r: [48 * e + 5 * chew - 14 * tug, 7 * gnaw, 9 * gnaw], t: [0, -0.008 * e, 0.016 * e] },
      EarLeft: { r: [-8 * e + 3 * chew, 0, -12 * e] }, EarRight: { r: [-8 * e + 3 * chew, 0, 12 * e] },
      FrontLeftPaw: { r: [-16 * knead(0), 0, 0] }, FrontRightPaw: { r: [-16 * knead(Math.PI), 0, 0] },
      TailEnd: tail('TailEnd', 2 * e, 0), TailTip: tail('TailTip', 16 * e * bump(t, 0.5, 1.5), 8 * e * bump(t, 0.5, 1.5)),
    }; });
}
await doc.transform(prune({ keepLeaves: true }), dedup());
await io.write(out, doc);
console.log(JSON.stringify({ out, joints: J.map(j => j.name), clips: root.listAnimations().map(a => a.getName()) }));
