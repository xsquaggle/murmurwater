// make-oake-rig.mjs [biped-rig.json] [oake-rig.json] : Captain Oake's skeleton, made from the biped's.
// The 24 joints keep their names, their order and the way each one is turned at rest; only where they are changes:
// she is shorter than the biped (a tenth less in the trunk and the leg), much broader in the hip and the shoulder, and
// stands with her feet well apart. Each hand gets the two joints that close it (the names author-anim.mjs gives the
// finger joints of the generated characters), and one joint is added for the thing she carries, which the clips move
// by itself:
//   Pipe   (child of Head)   her clay pipe: its origin is the end of the stem, where her teeth hold it; at rest it is
//                            in the right corner of her mouth, the bowl forward and down a little
import fs from 'node:fs';
import { mat4, quat, vec3 } from 'gl-matrix';

const [inp = new URL('./biped-rig.json', import.meta.url).pathname, out = new URL('./oake-rig.json', import.meta.url).pathname] = process.argv.slice(2);
const rig = JSON.parse(fs.readFileSync(inp)), by = new Map(rig.joints.map((j) => [j.name, j]));
const world = new Map(rig.joints.map((j) => [j.name, mat4.invert(mat4.create(), j.ibm)]));

// heights: [the biped's, hers]
const YS = [[0, 0], [0.153, 0.128], [0.439, 0.372], [0.767, 0.650], [0.849, 0.725], [1.119, 0.975], [1.136, 0.990], [1.176, 1.026], [1.289, 1.130], [1.40, 1.24]];
const yMap = (y) => { let i = 0; while (i + 2 < YS.length && y > YS[i + 1][0]) i++; const [a, b] = [YS[i], YS[i + 1]]; return b[1] + (y - b[0]) * (b[1] - a[1]) / (b[0] - a[0]); };
const LEGX = { UpLeg: 0.108, Leg: 0.125, Foot: 0.142, ToeBase: 0.160 }, ARM = { shoulderX: 0.212, upper: 0.190, fore: 0.180 }, FOOT = 1.05;
const at = new Map();
const place = (j) => {
  const p = j.at, side = j.name.startsWith('Left') ? 1 : j.name.startsWith('Right') ? -1 : 0, part = j.name.replace(/^(Left|Right)/, '');
  if (side && part in LEGX) return [side * LEGX[part], yMap(p[1]), part === 'ToeBase' ? p[2] * FOOT : p[2]];
  if (side && part === 'Shoulder') return [side * 0.040, yMap(p[1]), p[2]];
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
// hands: a joint at the knuckles and one half way along the fingers, turned as the hand is
export const KNUCKLE = 0.078, MIDFINGER = 0.110;
for (const side of ['Left', 'Right']) {
  const h = at.get(side + 'Hand'), f = at.get(side + 'ForeArm'), d = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), h, f)), R = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(side + 'Hand')));
  let prev = h; for (const [name, k] of [[side + 'Fingers', KNUCKLE], [side + 'FingerTips', MIDFINGER]]) {
    const p = [h[0] + d[0] * k, h[1] + d[1] * k, h[2] + d[2] * k], t = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), p, prev), quat.conjugate(quat.create(), R));
    joints.push({ name, parent: name.endsWith('Tips') ? side + 'Fingers' : side + 'Hand', t: r6(t), r: [0, 0, 0, 1], s: [1, 1, 1], at: r6(p, 4), ibm: r6(mat4.invert(mat4.create(), mat4.fromRotationTranslation(mat4.create(), R, p)), 7) }); at.set(name, p); prev = p; }
}
// the thing she carries: a joint that is not turned at rest
const extra = (name, parent, p) => {
  const Rp = quat.normalize(quat.create(), mat4.getRotation(quat.create(), world.get(parent))), inv = quat.conjugate(quat.create(), Rp);
  const t = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), p, at.get(parent)), inv);
  joints.push({ name, parent, t: r6(t), r: r6(inv), s: [1, 1, 1], at: r6(p, 4), ibm: r6(mat4.fromTranslation(mat4.create(), [-p[0], -p[1], -p[2]]), 7) }); at.set(name, p);
};
// her head is built at the biped's size and then made larger about a point under the chin (build-oake.mjs reads both
// numbers from the rig), so the pipe's joint is where the mouth ends up
export const HEAD = { scale: 1.12, pivot: [0, 1.12, -0.01] }, PIPE0 = [-0.028, 1.203, 0.122];
extra('Pipe', 'Head', PIPE0.map((v, i) => HEAD.pivot[i] + HEAD.scale * (v - HEAD.pivot[i])));
fs.writeFileSync(out, JSON.stringify({ from: rig.from + ', made short and broad by make-oake-rig.mjs', armature: rig.armature, head: HEAD, joints }, null, 1));
for (const j of joints) console.log(j.name.padEnd(14), (j.parent || '-').padEnd(14), j.at.map((v) => v.toFixed(3)).join(' '));
