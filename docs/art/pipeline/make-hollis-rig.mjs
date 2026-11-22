// make-hollis-rig.mjs [biped-rig.json] [hollis-rig.json] : Mister Hollis's skeleton, made from the biped's.
// The 24 joints keep their names, their order and the way each one is turned at rest; only where they are changes:
// he is a quarter taller in the leg and the trunk, narrower in the hip and the shoulder, longer in the arm and the
// foot. Each mitten gets the two joints that close it (the names author-anim.mjs gives the finger joints of the
// generated characters), and two joints are added for things he carries, which the clips move by themselves:
//   Bag    (child of Hips)   the carpet bag: its origin is the middle of its handles
//   Watch  (child of Spine)  his pocket watch: at rest it lies in his breast, 4 cm under the oilskin, face forward (nobody
//                            sees it until the game thins him to an outline: then it is a watch in a pocket)
import fs from 'node:fs';
import { mat4, quat, vec3 } from 'gl-matrix';

const [inp = new URL('./biped-rig.json', import.meta.url).pathname, out = new URL('./hollis-rig.json', import.meta.url).pathname] = process.argv.slice(2);
const rig = JSON.parse(fs.readFileSync(inp)), by = new Map(rig.joints.map((j) => [j.name, j]));
const world = new Map(rig.joints.map((j) => [j.name, mat4.invert(mat4.create(), j.ibm)]));

// heights: [the biped's, his]
const YS = [[0, 0], [0.153, 0.170], [0.439, 0.585], [0.767, 1.000], [0.849, 1.090], [1.119, 1.400], [1.136, 1.425], [1.176, 1.470], [1.289, 1.600], [1.40, 1.74]];
const yMap = (y) => { let i = 0; while (i + 2 < YS.length && y > YS[i + 1][0]) i++; const [a, b] = [YS[i], YS[i + 1]]; return b[1] + (y - b[0]) * (b[1] - a[1]) / (b[0] - a[0]); };
const LEGX = { UpLeg: 0.075, Leg: 0.092, Foot: 0.105, ToeBase: 0.125 }, ARM = { shoulderX: 0.150, upper: 0.265, fore: 0.255 }, FOOT = 1.3;       // feet a third longer
const at = new Map();
const place = (j) => {
  const p = j.at, side = j.name.startsWith('Left') ? 1 : j.name.startsWith('Right') ? -1 : 0, part = j.name.replace(/^(Left|Right)/, '');
  if (side && part in LEGX) return [side * LEGX[part], yMap(p[1]), part === 'ToeBase' ? p[2] * FOOT : p[2]];
  if (side && part === 'Arm') return [side * ARM.shoulderX, yMap(p[1]), p[2]];
  if (side && (part === 'ForeArm' || part === 'Hand')) { const par = by.get(j.parent), d = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), p, par.at)), o = at.get(j.parent), L = part === 'ForeArm' ? ARM.upper : ARM.fore; return [o[0] + d[0] * L, o[1] + d[1] * L, o[2] + d[2] * L]; }
  if (j.name === 'head_end' || j.name === 'headfront') { const h = by.get('Head').at, o = at.get('Head'); return [o[0] + p[0] - h[0], o[1] + p[1] - h[1], o[2] + p[2] - h[2]]; }
  return [p[0], yMap(p[1]), p[2]];
};
const r6 = (v, d = 6) => Array.from(v).map((x) => +x.toFixed(d));
const joints = rig.joints.map((j) => {
  const p = place(j); at.set(j.name, p);
  const R = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(j.name))), W = mat4.fromRotationTranslation(mat4.create(), R, p);
  let t = p; if (j.parent) { const Rp = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(j.parent))); t = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), p, at.get(j.parent)), quat.conjugate(quat.create(), Rp)); }
  return { name: j.name, parent: j.parent, t: r6(t), r: j.r, s: j.s, at: r6(p, 4), ibm: r6(mat4.invert(mat4.create(), W), 7) };
});
// mittens: a joint at the knuckles and one half way along the fingers, turned as the hand is
export const KNUCKLE = 0.074, MIDFINGER = 0.106;
for (const side of ['Left', 'Right']) {
  const h = at.get(side + 'Hand'), f = at.get(side + 'ForeArm'), d = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), h, f)), R = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(side + 'Hand')));
  let prev = h; for (const [name, k] of [[side + 'Fingers', KNUCKLE], [side + 'FingerTips', MIDFINGER]]) {
    const p = [h[0] + d[0] * k, h[1] + d[1] * k, h[2] + d[2] * k], t = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), p, prev), quat.conjugate(quat.create(), R));
    joints.push({ name, parent: name.endsWith('Tips') ? side + 'Fingers' : side + 'Hand', t: r6(t), r: [0, 0, 0, 1], s: [1, 1, 1], at: r6(p, 4), ibm: r6(mat4.invert(mat4.create(), mat4.fromRotationTranslation(mat4.create(), R, p)), 7) }); at.set(name, p); prev = p; }
}
// the things he carries: joints that are not turned at rest
const extra = (name, parent, p) => {
  const Rp = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(parent))), inv = quat.conjugate(quat.create(), Rp);
  const t = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), p, at.get(parent)), inv);
  joints.push({ name, parent, t: r6(t), r: r6(inv), s: [1, 1, 1], at: r6(p, 4), ibm: r6(mat4.fromTranslation(mat4.create(), [-p[0], -p[1], -p[2]]), 7) }); at.set(name, p);
};
const hand = at.get('RightHand');
extra('Bag', 'Hips', [hand[0] - 0.060, hand[1] - 0.070, hand[2] + 0.005]);
extra('Watch', 'Spine', [0.060, 1.330, 0.070]);
fs.writeFileSync(out, JSON.stringify({ from: rig.from + ', stretched by make-hollis-rig.mjs', armature: rig.armature, joints }, null, 1));
for (const j of joints) console.log(j.name.padEnd(14), (j.parent || '-').padEnd(14), j.at.map((v) => v.toFixed(3)).join(' '));
