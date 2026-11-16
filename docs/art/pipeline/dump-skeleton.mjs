// node dump-skeleton.mjs rigged.glb out.json [joints] : the skeleton of a rigged character as data (name, parent, local
// translation and rotation, rest position in the model), the first `joints` joints only (24 = the biped without finger joints).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4 } from 'gl-matrix';
import fs from 'node:fs';
const [inp, out, nArg] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(inp); const skin = doc.getRoot().listSkins()[0];
const joints = skin.listJoints().slice(0, Number(nArg || 24)); const names = new Set(joints.map((j) => j.getName())); const ibm = skin.getInverseBindMatrices().getArray();
const r = (v, d = 6) => Array.from(v).map((x) => +x.toFixed(d));
const arm = joints[0].getParentNode();
const data = { from: inp.split('/').pop(), armature: { name: arm.getName(), t: r(arm.getTranslation()), r: r(arm.getRotation()), s: r(arm.getScale()) }, joints: joints.map((j, i) => {
  const W = mat4.invert(mat4.create(), ibm.subarray(i * 16, i * 16 + 16)); const p = j.getParentNode();
  return { name: j.getName(), parent: p && names.has(p.getName()) ? p.getName() : null, t: r(j.getTranslation()), r: r(j.getRotation()), s: r(j.getScale()), at: r([W[12], W[13], W[14]], 4), ibm: r(ibm.subarray(i * 16, i * 16 + 16), 7) };
}) };
fs.writeFileSync(out, JSON.stringify(data, null, 1)); console.log(data.armature, data.joints.length, 'joints'); for (const j of data.joints) console.log(j.name.padEnd(14), (j.parent || '-').padEnd(14), j.at.join(' '), ' s', j.s.join(' '));
