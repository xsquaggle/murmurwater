// Hand-authored clips for the 24-joint biped rig that merge-anim.mjs writes (unit scale, rest pose = bind pose, facing +Z).
// node author-anim.mjs in.glb out.glb clips.mjs [--fps 30] [--drop cast,other] [--fingers 0] [--only clip,clip]
//   --only bakes just the named clips of the module and leaves every other clip and the sockets exactly as they are.
//   --fingers 0 leaves the hands as they are (no finger joints); the clips module may return rodSocket: false.
//
// A clip is a function of time that returns a pose spec; every frame is solved with FK for the body and analytic
// two-bone IK for arms and legs, then written as joint rotations plus Hips translation (same channel layout as the
// library clips). A spec can sit on top of a frame of an existing clip (spec.base), so authored arms can ride on
// motion-captured body movement. Angles are degrees: [pitch, yaw, roll] = [lean forward, turn left, tilt right].
// Positions and directions are in metres in "chest" space (bind-pose coordinates that follow the chest), unless the
// hand says space: 'world' or 'socket' (the RodSocket frame, for a second hand on the rod).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [inp, out, clipsFile, ...rest] = process.argv.slice(2);
const opt = { fps: 30, drop: '', fingers: '1', only: '' };
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
opt.fps = Number(opt.fps);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
const skin = root.listSkins()[0];
// ---------- finger joints ----------
// The auto-rig has no finger bones, so a hand cannot close on a rod. Add two joints per hand that curl the four fused
// fingers as one slab (knuckles, then mid-finger); the thumb is left alone. Local +X of each joint is the curl axis,
// +Y runs along the fingers and +Z is the palm normal, so a positive rotation about X closes the hand.
const FINGER = { knuckle: 0.10, mid: 0.15, blendK: 0.012, blendM: 0.010, cut: 0.085 };
const handInfo = {};
{
  const v3 = (m) => vec3.fromValues(m[12], m[13], m[14]);
  const prim = root.listMeshes()[0].listPrimitives()[0];
  const posA = prim.getAttribute('POSITION'), jA = prim.getAttribute('JOINTS_0'), wA = prim.getAttribute('WEIGHTS_0'), idx = prim.getIndices();
  const jl = skin.listJoints(); const nm = jl.map(j => j.getName()); const ibm0 = skin.getInverseBindMatrices().getArray();
  const Wj = (i) => mat4.invert(mat4.create(), ibm0.subarray(i * 16, i * 16 + 16));
  const nV = posA.getCount(); const JN = new Uint16Array(jA.getArray()); const WT = new Float32Array(wA.getArray());
  const newJoints = [];
  for (const side of ['Right', 'Left']) {
    const hi = nm.indexOf(side + 'Hand'), fi = nm.indexOf(side + 'ForeArm'); const Ph = v3(Wj(hi)), Pf = v3(Wj(fi));
    const group = new Set([hi, nm.indexOf(side + 'Fingers'), nm.indexOf(side + 'FingerTips')].filter(i => i >= 0));
    const f0 = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), Ph, Pf));
    const hand = new Map(); const p = [];
    for (let v = 0; v < nV; v++) { let wh = 0; for (let k = 0; k < 4; k++) if (group.has(JN[v * 4 + k])) wh += WT[v * 4 + k]; if (wh > 0.3) { posA.getElement(v, p); hand.set(v, vec3.fromValues(p[0], p[1], p[2])); } }
    const pts = [...hand.values()]; const c = vec3.create(); pts.forEach(q => vec3.add(c, c, q)); vec3.scale(c, c, 1 / pts.length);
    const C = mat3.create(); pts.forEach(q => { const d = vec3.sub(vec3.create(), q, c); for (let a2 = 0; a2 < 3; a2++) for (let b2 = 0; b2 < 3; b2++) C[b2 * 3 + a2] += d[a2] * d[b2] / pts.length; });
    const Ci = mat3.invert(mat3.create(), C); let n0 = vec3.fromValues(1, 0.2, 0.1); for (let it = 0; it < 100; it++) vec3.normalize(n0, vec3.transformMat3(vec3.create(), n0, Ci));
    if (n0[0] * (side === 'Right' ? 1 : -1) < 0) vec3.scale(n0, n0, -1);                     // palms face the body in the A-pose
    vec3.normalize(n0, vec3.sub(vec3.create(), n0, vec3.scale(vec3.create(), f0, vec3.dot(n0, f0))));
    const t0 = side === 'Right' ? vec3.cross(vec3.create(), f0, n0) : vec3.cross(vec3.create(), n0, f0);   // toward the thumb
    const curl = vec3.cross(vec3.create(), f0, n0);                                             // right-hand rotation about this closes the fingers
    const co = (q) => { const d = vec3.sub(vec3.create(), q, Ph); return [vec3.dot(d, f0), vec3.dot(d, t0), vec3.dot(d, n0)]; };
    // the fused fingers = largest connected piece of the hand beyond the cut (the thumb tip is a separate piece)
    const key = (q) => `${Math.round(q[0] * 1e5)},${Math.round(q[1] * 1e5)},${Math.round(q[2] * 1e5)}`; const wid = new Map(), rep = new Map();
    for (const [v, q] of hand) { const k = key(q); if (!wid.has(k)) wid.set(k, wid.size); rep.set(v, wid.get(k)); }
    const sel = new Set(); for (const [v, q] of hand) if (co(q)[0] > FINGER.cut) sel.add(rep.get(v));
    const adj = new Map(); const link = (x, y) => { if (!adj.has(x)) adj.set(x, new Set()); adj.get(x).add(y); };
    for (let t = 0; t < idx.getCount(); t += 3) { const tri = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)]; if (!tri.every(v => hand.has(v))) continue; const r = tri.map(v => rep.get(v)); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== y && sel.has(r[x]) && sel.has(r[y])) link(r[x], r[y]); }
    const comp = new Map(); const sizes = [];
    for (const s0 of sel) { if (comp.has(s0)) continue; const id = sizes.length; let n = 0; const stack = [s0]; comp.set(s0, id); while (stack.length) { const x = stack.pop(); n++; for (const y of adj.get(x) || []) if (!comp.has(y)) { comp.set(y, id); stack.push(y); } } sizes.push(n); }
    const big = sizes.indexOf(Math.max(...sizes));
    const fingerVerts = [...hand.keys()].filter(v => comp.get(rep.get(v)) === big);
    const midN = (a0) => { const m = fingerVerts.map(v => co(hand.get(v))).filter(x => Math.abs(x[0] - a0) < 0.015).map(x => x[2]); return m.length ? (Math.min(...m) + Math.max(...m)) / 2 : 0; };
    let surf = -1e9; for (const q of pts) { const x = co(q); if (x[0] > 0.03 && x[0] < 0.09 && Math.abs(x[1]) < 0.035) surf = Math.max(surf, x[2]); }
    const at = (a0, n1) => vec3.add(vec3.create(), vec3.add(vec3.create(), Ph, vec3.scale(vec3.create(), f0, a0)), vec3.scale(vec3.create(), n0, n1));
    const K1 = at(FINGER.knuckle, midN(FINGER.knuckle)), K2 = at(FINGER.mid, midN(FINGER.mid));
    handInfo[side] = { f0, n0, t0, curl, surf, Ph };
    if (nm.includes(side + 'Fingers') || opt.fingers === '0') continue;                                               // already rigged on an earlier run
    const rotM = mat3.fromValues(curl[0], curl[1], curl[2], f0[0], f0[1], f0[2], n0[0], n0[1], n0[2]); const Rw = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rotM));
    const Wh = Wj(hi); const mk = (name, K, parentNode, Wp) => {
      const W = mat4.fromRotationTranslation(mat4.create(), Rw, K); const L = mat4.multiply(mat4.create(), mat4.invert(mat4.create(), Wp), W);
      const t = vec3.create(), r = quat.create(); mat4.getTranslation(t, L); mat4.getRotation(r, L); quat.normalize(r, r);
      const node = doc.createNode(name).setTranslation(Array.from(t)).setRotation(Array.from(r)); parentNode.addChild(node); return { node, W };
    };
    const A = mk(side + 'Fingers', K1, jl[hi], Wh), B = mk(side + 'FingerTips', K2, A.node, A.W);
    const ia = jl.length + newJoints.length; newJoints.push(A, B); const ib = ia + 1;
    const ss = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
    for (const v of fingerVerts) {
      const a0 = co(hand.get(v))[0]; const s1 = ss(FINGER.knuckle - FINGER.blendK, FINGER.knuckle + FINGER.blendK, a0), s2 = ss(FINGER.mid - FINGER.blendM, FINGER.mid + FINGER.blendM, a0);
      if (s1 <= 0) continue; const inf = new Map(); let wh = 0;
      for (let k = 0; k < 4; k++) { const j = JN[v * 4 + k], w = WT[v * 4 + k]; if (w <= 0) continue; if (j === hi) wh += w; else inf.set(j, (inf.get(j) || 0) + w); }
      if (wh * (1 - s1) > 0) inf.set(hi, wh * (1 - s1)); if (wh * s1 * (1 - s2) > 0) inf.set(ia, wh * s1 * (1 - s2)); if (wh * s1 * s2 > 0) inf.set(ib, wh * s1 * s2);
      const top = [...inf].sort((x, y) => y[1] - x[1]).slice(0, 4); const sum = top.reduce((s0, x) => s0 + x[1], 0);
      for (let k = 0; k < 4; k++) { JN[v * 4 + k] = k < top.length ? top[k][0] : 0; WT[v * 4 + k] = k < top.length ? top[k][1] / sum : 0; }
    }
    console.error(`${side} hand: ${fingerVerts.length} finger vertices, palm surface ${(surf * 100).toFixed(1)} cm above the bone line`);
  }
  if (newJoints.length) {
    const ibmNew = new Float32Array((jl.length + newJoints.length) * 16); ibmNew.set(ibm0);
    newJoints.forEach((j, k) => { skin.addJoint(j.node); ibmNew.set(mat4.invert(mat4.create(), j.W), (jl.length + k) * 16); });
    skin.getInverseBindMatrices().setArray(ibmNew); jA.setArray(JN); wA.setArray(WT);
  }
}
const joints = skin.listJoints();
const names = joints.map(j => j.getName());
const N = joints.length;
const index = new Map(names.map((n, i) => [n, i]));
const J = (n) => { if (!index.has(n)) throw new Error('no joint ' + n); return index.get(n); };
const parent = joints.map(j => { const p = j.getParentNode(); return p && index.has(p.getName()) ? index.get(p.getName()) : -1; });
const order = []; { const seen = new Set(); const visit = i => { if (seen.has(i)) return; if (parent[i] >= 0) visit(parent[i]); seen.add(i); order.push(i); }; joints.forEach((_, i) => visit(i)); }
const ibmArr = skin.getInverseBindMatrices().getArray();
const Wb = joints.map((_, i) => mat4.invert(mat4.create(), ibmArr.subarray(i * 16, i * 16 + 16)));
const P = Wb.map(m => vec3.fromValues(m[12], m[13], m[14]));
const Rb = Wb.map(m => quat.normalize(quat.create(), mat4.getRotation(quat.create(), m)));

// ---------- small maths ----------
const V = (a) => vec3.fromValues(a[0], a[1], a[2]);
const norm = (a) => vec3.normalize(vec3.create(), a);
const sub = (a, b) => vec3.sub(vec3.create(), a, b);
const add = (a, b) => vec3.add(vec3.create(), a, b);
const mul = (a, s) => vec3.scale(vec3.create(), a, s);
const dot = vec3.dot;
const cross = (a, b) => vec3.cross(vec3.create(), a, b);
const rotv = (q, v) => vec3.transformQuat(vec3.create(), v, q);
const qmul = (a, b) => quat.multiply(quat.create(), a, b);
const conj = (q) => quat.conjugate(quat.create(), q);
const arc = (a, b) => quat.normalize(quat.create(), quat.rotationTo(quat.create(), norm(a), norm(b)));
const rad = Math.PI / 180;
const eulerQ = (e) => { // yaw (Y), then pitch (X), then roll (Z)
  if (!e) return quat.create();
  const q = quat.create(); quat.rotateY(q, q, (e[1] || 0) * rad); quat.rotateX(q, q, (e[0] || 0) * rad); quat.rotateZ(q, q, (e[2] || 0) * rad); return q;
};
// rotation taking the frame (p0 exact, s0 as hint) onto the frame (p1 exact, s1 as hint)
const basis = (p, s) => { const x = norm(p); let y = sub(s, mul(x, dot(s, x))); if (vec3.length(y) < 1e-5) y = Math.abs(x[1]) < 0.9 ? cross(x, [0, 1, 0]) : cross(x, [1, 0, 0]); y = norm(y); return [x, y, cross(x, y)]; };
const frameQ = (p0, s0, p1, s1) => {
  const a = basis(p0, s0), b = basis(p1, s1); const m = mat3.create();
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 3 + r] = b[0][r] * a[0][c] + b[1][r] * a[1][c] + b[2][r] * a[2][c];
  return quat.normalize(quat.create(), quat.fromMat3(quat.create(), m));
};
const twistAbout = (q, axis) => { const d = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2]; const t = quat.fromValues(axis[0] * d, axis[1] * d, axis[2] * d, q[3]); if (quat.length(t) < 1e-6) return quat.create(); return quat.normalize(t, t); };

// ---------- hands ----------
const HAND = {}; for (const side of ['Right', 'Left']) HAND[side] = { ...handInfo[side], hi: J(side + 'Hand'), fa: index.has(side + 'Fingers') ? J(side + 'Fingers') : -1, fb: index.has(side + 'FingerTips') ? J(side + 'FingerTips') : -1 };
const GRIP = { radius: 0.025, a: 0.059, curlA: 70, curlB: 65 };   // handle radius the closed hand is shaped for, where it sits along the palm, and the closed curl angles

// ---------- existing clips (for spec.base) ----------
function sampler(channel) {
  const s = channel.getSampler(); const inp = s.getInput().getArray(); const outA = s.getOutput(); const n = inp.length; const size = outA.getElementSize();
  const a = [], b = [];
  return (t) => {
    let i = 0; if (t <= inp[0]) i = 0; else if (t >= inp[n - 1]) i = n - 1; else { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (inp[mid] <= t) lo = mid; else hi = mid; } i = lo; }
    outA.getElement(i, a); if (i >= n - 1) return a.slice(0, size);
    outA.getElement(i + 1, b); const f = (t - inp[i]) / (inp[i + 1] - inp[i]);
    if (size === 4) { const q = quat.create(); quat.slerp(q, a, b, f); return Array.from(q); }
    return a.slice(0, size).map((v, c) => v + (b[c] - v) * f);
  };
}
const existing = new Map();
for (const a of root.listAnimations()) {
  const tracks = joints.map(() => ({})); let duration = 0;
  for (const ch of a.listChannels()) { const tn = ch.getTargetNode(); if (!tn || !index.has(tn.getName())) continue; tracks[index.get(tn.getName())][ch.getTargetPath()] = sampler(ch); const inp = ch.getSampler().getInput().getArray(); duration = Math.max(duration, inp[inp.length - 1]); }
  existing.set(a.getName(), { tracks, duration });
}
const restT = joints.map(j => V(j.getTranslation())), restR = joints.map(j => quat.clone(j.getRotation()));
function evalClip(name, t) {
  const c = existing.get(name); if (!c) throw new Error('no clip ' + name);
  const tt = ((t % c.duration) + c.duration) % c.duration; const Rw = [], X = [];
  for (const i of order) {
    const tr = c.tracks[i]; const T = tr.translation ? V(tr.translation(tt)) : restT[i]; const R = tr.rotation ? quat.normalize(quat.create(), tr.rotation(tt)) : restR[i];
    if (parent[i] < 0) { Rw[i] = R; X[i] = T; } else { Rw[i] = qmul(Rw[parent[i]], R); X[i] = add(X[parent[i]], rotv(Rw[parent[i]], T)); }
  }
  return { Rw, X };
}
const bindBase = { Rw: Rb, X: P };

// ---------- sockets ----------
// RodSocket: origin at the centre of a grip lying in the right palm, +Y toward the rod tip (out of the thumb side of the fist),
// +X out of the palm (the character's left in a neutral hold), +Z along the hand away from the wrist.
const RH = HAND.Right;
const rod0 = norm(add(RH.t0, mul(RH.f0, 0.1)));
const sockX0 = norm(sub(RH.n0, mul(rod0, dot(RH.n0, rod0))));
const sockO0 = add(add(add(P[RH.hi], mul(RH.f0, GRIP.a)), mul(RH.n0, RH.surf + GRIP.radius)), mul(RH.t0, -0.005));
const sockR0 = (() => { const z = cross(sockX0, rod0); const m = mat3.fromValues(sockX0[0], sockX0[1], sockX0[2], rod0[0], rod0[1], rod0[2], z[0], z[1], z[2]); return quat.normalize(quat.create(), quat.fromMat3(quat.create(), m)); })();

// ---------- solver ----------
const warn = new Set();
function solve(spec = {}, tag = '') {
  const base = spec.base ? evalClip(spec.base.clip, spec.base.t || 0) : bindBase;
  const Db = (i) => qmul(base.Rw[i], conj(Rb[i]));
  const Rel = (i) => qmul(conj(Db(parent[i])), Db(i));
  const D = new Array(N), X = new Array(N);
  const place = (i) => { const p = parent[i]; X[i] = add(X[p], rotv(D[p], sub(P[i], P[p]))); };
  const fk = (i, extra) => { place(i); D[i] = qmul(qmul(D[parent[i]], eulerQ(extra)), Rel(i)); };
  const hips = J('Hips');
  D[hips] = qmul(eulerQ(spec.hips && spec.hips.rot), Db(hips)); X[hips] = add(base.X[hips], V((spec.hips && spec.hips.pos) || [0, 0, 0]));
  const sp = spec.spine || [0, 0, 0]; const third = sp.map(v => v / 3);
  for (const n of ['Spine02', 'Spine01', 'Spine']) fk(J(n), third);
  const chest = J('Spine');
  const toWorldP = (p, space, sock) => space === 'world' ? V(p) : space === 'socket' ? add(sock.o, rotv(sock.r, V(p))) : add(X[chest], rotv(D[chest], sub(V(p), P[chest])));
  const toWorldD = (d, space, sock) => norm(space === 'world' ? V(d) : space === 'socket' ? rotv(sock.r, V(d)) : rotv(D[chest], V(d)));
  // head
  const neck = J('neck'), head = J('Head');
  if (spec.look) { place(neck); const target = eulerQ(spec.look); const viaChest = qmul(D[chest], Rel(neck)); D[neck] = quat.normalize(quat.create(), quat.slerp(quat.create(), viaChest, target, 0.5)); X[head] = add(X[neck], rotv(D[neck], sub(P[head], P[neck]))); D[head] = target; }
  else { const h = (spec.head || [0, 0, 0]).map(v => v / 2); fk(neck, h); fk(head, h); }
  for (const n of ['head_end', 'headfront']) if (index.has(n)) fk(J(n));
  // arms
  let sock = null;
  const twoBone = (S, T, L1, L2, pole) => {
    let v = sub(T, S); let d = vec3.length(v); const max = (L1 + L2) * 0.999; let clamped = false;
    if (d > max) { clamped = d - max; d = max; } if (d < 1e-4) d = 1e-4;
    const dir = norm(v); const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let perp = sub(pole, mul(dir, dot(pole, dir))); if (vec3.length(perp) < 1e-5) perp = cross(dir, [1, 0, 0]); perp = norm(perp);
    const E = add(add(S, mul(dir, a)), mul(perp, h)); const Tc = add(S, mul(dir, d));
    return { E, T: Tc, clamped };
  };
  const arm = (side) => {
    const sh = J(side + 'Shoulder'), up = J(side + 'Arm'), fo = J(side + 'ForeArm'), ha = J(side + 'Hand'); const key = side === 'Right' ? 'r' : 'l'; const sgn = side === 'Right' ? -1 : 1;
    if (spec.lockShoulders) { place(sh); D[sh] = qmul(D[parent[sh]], eulerQ(spec[key + 'Shoulder'])); }   // collarbones keep their rest relation to the chest
    else fk(sh, spec[key + 'Shoulder']);
    const hs = spec[key + 'Hand'];
    if (!hs || !hs.pos) { fk(up, hs && hs.armRot); fk(fo, hs && hs.foreRot); fk(ha, hs && hs.rot); }
    else {
      place(up); const S = X[up]; const L1 = vec3.distance(P[up], P[fo]), L2 = vec3.distance(P[fo], P[ha]);
      const T = toWorldP(hs.pos, hs.space, sock); const pole = toWorldD(hs.pole || [sgn * 0.5, -0.6, -0.6], hs.space === 'socket' ? 'chest' : hs.space, sock);
      const r = twoBone(S, T, L1, L2, pole); if (r.clamped && r.clamped > 0.004) warn.add(`${tag}: ${side} hand ${(r.clamped * 100).toFixed(1)} cm out of reach`);
      const u = norm(sub(r.E, S)), f = norm(sub(r.T, r.E));
      D[up] = qmul(arc(rotv(D[sh], norm(sub(P[fo], P[up]))), u), D[sh]);
      X[fo] = r.E; D[fo] = qmul(arc(rotv(D[up], norm(sub(P[ha], P[fo]))), f), D[up]); X[ha] = r.T;
      const H = HAND[side]; let Dh;
      if (hs.rod) Dh = frameQ(rod0, H.f0, toWorldD(hs.rod, hs.rodSpace || hs.space, sock), hs.fingers ? toWorldD(hs.fingers, hs.space, sock) : f);
      else if (hs.fingers) Dh = frameQ(H.f0, H.n0, toWorldD(hs.fingers, hs.space, sock), hs.palm ? toWorldD(hs.palm, hs.space, sock) : rotv(D[fo], H.n0));
      else Dh = qmul(D[fo], eulerQ(hs.rot));
      // share the wrist roll with the forearm so the wrist does not candy-wrap
      const relq = qmul(Dh, conj(D[fo])); const tw = twistAbout(relq, f); const part = quat.slerp(quat.create(), quat.create(), tw, hs.twistShare === undefined ? 0.5 : hs.twistShare);
      D[fo] = qmul(part, D[fo]); D[ha] = Dh;
    }
    if (HAND[side].fa >= 0) { const H = HAND[side]; const g = spec[key + 'Grip'] === undefined ? 0 : spec[key + 'Grip'];
      place(H.fa); D[H.fa] = qmul(D[ha], quat.setAxisAngle(quat.create(), H.curl, GRIP.curlA * g * rad));
      place(H.fb); D[H.fb] = qmul(D[H.fa], quat.setAxisAngle(quat.create(), H.curl, GRIP.curlB * g * rad)); }
    if (side === 'Right') sock = { o: add(X[ha], rotv(D[ha], sub(sockO0, P[ha]))), r: qmul(D[ha], sockR0) };
  };
  arm('Right'); arm('Left');
  // legs: feet stay where the base put them unless the spec moves them
  const leg = (side) => {
    const up = J(side + 'UpLeg'), lo = J(side + 'Leg'), ft = J(side + 'Foot'), toe = J(side + 'ToeBase'); const key = side === 'Right' ? 'r' : 'l';
    place(up); const fs = spec[key + 'Foot'] || {};
    const S = X[up]; const L1 = vec3.distance(P[up], P[lo]), L2 = vec3.distance(P[lo], P[ft]);
    const T = add(base.X[ft], V(fs.pos || [0, 0, 0]));
    const bl = sub(base.X[ft], base.X[up]); const bk = sub(base.X[lo], base.X[up]); let pole = sub(bk, mul(norm(bl), dot(bk, norm(bl)))); if (vec3.length(pole) < 0.01) pole = V([0, 0, 1]);
    if (fs.pole) pole = V(fs.pole);
    const r = twoBone(S, T, L1, L2, pole); if (r.clamped && r.clamped > 0.004) warn.add(`${tag}: ${side} foot ${(r.clamped * 100).toFixed(1)} cm out of reach`);
    D[up] = qmul(arc(rotv(D[parent[up]], norm(sub(P[lo], P[up]))), norm(sub(r.E, S))), D[parent[up]]);
    // keep the thigh's base twist: re-apply the twist the base had about the thigh axis
    X[lo] = r.E; D[lo] = qmul(arc(rotv(D[up], norm(sub(P[ft], P[lo]))), norm(sub(r.T, r.E))), D[up]);
    X[ft] = r.T; D[ft] = qmul(eulerQ(fs.rot), Db(ft));
    if (index.has(side + 'ToeBase')) { place(toe); D[toe] = qmul(D[ft], Rel(toe)); }
  };
  leg('Right'); leg('Left');
  // local rotations
  const q = new Float32Array(N * 4); const Rw = D.map((d, i) => qmul(d, Rb[i]));
  for (let i = 0; i < N; i++) { const l = parent[i] < 0 ? Rw[i] : qmul(conj(Rw[parent[i]]), Rw[i]); quat.normalize(l, l); q.set(l, i * 4); }
  return { q, hips: X[hips], X, D, sock };
}

// a pose function may return { blend: [A, B, k] }: both sides are solved and mixed joint by joint (exact at k = 0 and 1)
function solveAny(x, tag) {
  if (!x || !x.blend) return solve(x, tag);
  const [A, B, k] = x.blend; const a = solveAny(A, tag), b = solveAny(B, tag); const q = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { const qa = a.q.subarray(i * 4, i * 4 + 4), qb = b.q.subarray(i * 4, i * 4 + 4); const o = quat.create(); quat.slerp(o, qa, qb, k); q.set(o, i * 4); }
  return { q, hips: vec3.lerp(vec3.create(), a.hips, b.hips, k) };
}
// ---------- spec helpers handed to the clip file ----------
const lerp = (a, b, k) => {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerp(v, b[i], k));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) o[key] = key in a && key in b ? lerp(a[key], b[key], k) : (k < 0.5 ? (key in a ? a[key] : b[key]) : (key in b ? b[key] : a[key])); return o; }
  return k < 0.5 ? a : b;
};
const ease = { linear: k => k, inOut: k => k * k * (3 - 2 * k), out: k => 1 - (1 - k) * (1 - k), in: k => k * k, outBack: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); } };
const keys = (list, t) => { // list: [{t, spec, ease}] sorted; ease applies to the segment ending at that key
  if (t <= list[0].t) return list[0].spec; const last = list[list.length - 1]; if (t >= last.t) return last.spec;
  for (let i = 1; i < list.length; i++) if (t <= list[i].t) { const a = list[i - 1], b = list[i]; const k = (t - a.t) / (b.t - a.t); return lerp(a.spec, b.spec, (ease[b.ease || 'inOut'])(k)); }
};
const chestSpace = (spec, jointName) => { const r = solve(spec, 'probe'); const ch = J('Spine'); return Array.from(add(P[ch], rotv(conj(r.D[ch]), sub(r.X[J(jointName)], r.X[ch])))); };
const palmCentre = (pose, side) => { const H = HAND[side]; return add(pose.X[H.hi], rotv(pose.D[H.hi], add(mul(H.f0, 0.07), mul(H.n0, H.surf + 0.01)))); };
const blend = (A, B, k) => ({ blend: [A, B, k] });
const ctx = { blend, palmCentre, solve, lerp, ease, keys, names, P, Rb, HAND, GRIP, existing, evalClip, J, sockO0, sockR0, rod0, chestSpace, eulerQ, math: { vec3, quat, mat4 } };

const mod = await import(pathToFileURL(path.resolve(clipsFile)).href);
const def = mod.default(ctx);
const only = new Set(String(opt.only).split(',').filter(Boolean));
if (only.size) { def.clips = def.clips.filter(c => only.has(c.name)); def.sockets = []; def.rodSocket = false; for (const n of only) if (!def.clips.some(c => c.name === n)) throw new Error('no clip ' + n + ' in ' + clipsFile); }

// ---------- sockets as nodes ----------
const addSocket = (name, parentJoint, worldO, worldR, parentWorld) => {
  for (const n of root.listNodes()) if (n.getName() === name) n.dispose();
  const Wp = parentWorld; const Ws = mat4.fromRotationTranslation(mat4.create(), worldR, worldO); const L = mat4.multiply(mat4.create(), mat4.invert(mat4.create(), Wp), Ws);
  const t = vec3.create(), r = quat.create(); mat4.getTranslation(t, L); mat4.getRotation(r, L); quat.normalize(r, r);
  const node = doc.createNode(name).setTranslation(Array.from(t)).setRotation(Array.from(r)); joints[parentJoint].addChild(node); return node;
};
if (def.rodSocket !== false) addSocket('RodSocket', RH.hi, sockO0, sockR0, Wb[RH.hi]);
for (const s of def.sockets || []) { const pose = solve(s.spec, s.name); const pj = J(s.joint); const Wp = mat4.fromRotationTranslation(mat4.create(), qmul(pose.D[pj], Rb[pj]), pose.X[pj]); addSocket(s.name, pj, s.origin(pose), s.rot, Wp); }

// ---------- write clips ----------
const drop = new Set(String(opt.drop).split(',').filter(Boolean)); for (const c of def.clips) drop.add(c.name);
for (const a of root.listAnimations()) if (drop.has(a.getName())) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }
const buffer = root.listBuffers()[0];
// library clips get constant open-hand channels for the finger joints, so every clip drives the same joints
const fingerJoints = ['RightFingers', 'RightFingerTips', 'LeftFingers', 'LeftFingerTips'].filter(n => index.has(n)).map(J);
for (const a of root.listAnimations()) {
  const have = new Set(a.listChannels().map(ch => ch.getTargetNode())); let dur = 0; for (const sm of a.listSamplers()) { const arr = sm.getInput().getArray(); dur = Math.max(dur, arr[arr.length - 1]); }
  let inAcc = null;
  for (const i of fingerJoints) if (!have.has(joints[i])) {
    inAcc = inAcc || doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, dur])).setBuffer(buffer);
    const r = joints[i].getRotation(); const o = doc.createAccessor().setType('VEC4').setArray(new Float32Array([...r, ...r])).setBuffer(buffer);
    const sm = doc.createAnimationSampler().setInput(inAcc).setOutput(o).setInterpolation('LINEAR'); a.addSampler(sm).addChannel(doc.createAnimationChannel().setTargetNode(joints[i]).setTargetPath('rotation').setSampler(sm));
  }
}
for (const clip of def.clips) {
  const frames = Math.max(2, Math.round(clip.duration * opt.fps) + 1);
  const times = new Float32Array(frames); const rot = joints.map(() => new Float32Array(frames * 4)); const hipsT = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / opt.fps); times[f] = t; const pose = solveAny(clip.pose(t), clip.name);
    for (let i = 0; i < N; i++) { const r = pose.q.subarray(i * 4, i * 4 + 4); if (f > 0) { const p = rot[i].subarray((f - 1) * 4, f * 4); if (quat.dot(p, r) < 0) quat.scale(r, r, -1); } rot[i].set(r, f * 4); }
    hipsT.set(pose.hips, f * 3);
  }
  const A = doc.createAnimation(clip.name); const inAcc = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  joints.forEach((j, i) => {
    const o = doc.createAccessor().setType('VEC4').setArray(rot[i]).setBuffer(buffer); const s = doc.createAnimationSampler().setInput(inAcc).setOutput(o).setInterpolation('LINEAR');
    A.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(j).setTargetPath('rotation').setSampler(s));
    if (parent[i] < 0) { const o2 = doc.createAccessor().setType('VEC3').setArray(hipsT).setBuffer(buffer); const s2 = doc.createAnimationSampler().setInput(inAcc).setOutput(o2).setInterpolation('LINEAR'); A.addSampler(s2).addChannel(doc.createAnimationChannel().setTargetNode(j).setTargetPath('translation').setSampler(s2)); }
  });
}
for (const w of warn) console.error('warn', w);
await doc.transform(resample({ tolerance: 1e-5 }), prune({ keepLeaves: true }), dedup());
await io.write(out, doc);
console.log(JSON.stringify({ out, clips: root.listAnimations().map(a => { let d = 0; for (const s of a.listSamplers()) { const arr = s.getInput().getArray(); d = Math.max(d, arr[arr.length - 1]); } return `${a.getName()}:${d.toFixed(2)}s`; }), sockets: root.listNodes().filter(n => /Socket$/.test(n.getName())).map(n => n.getName()) }));
