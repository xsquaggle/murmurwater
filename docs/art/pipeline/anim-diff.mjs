// node anim-diff.mjs a.glb b.glb -> per clip: largest difference in any channel's keys (and whether key counts match)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const [A, B] = await Promise.all(process.argv.slice(2, 4).map(f => io.read(f)));
const map = (doc) => new Map(doc.getRoot().listAnimations().map(a => [a.getName(), new Map(a.listChannels().map(c => [c.getTargetNode().getName() + '.' + c.getTargetPath(), c.getSampler()]))]));
const a = map(A), b = map(B);
for (const name of new Set([...a.keys(), ...b.keys()])) {
  if (!a.has(name) || !b.has(name)) { console.log(name.padEnd(16), a.has(name) ? 'only in first' : 'only in second'); continue; }
  let worst = 0, counts = true, chans = a.get(name).size === b.get(name).size;
  for (const [k, sa] of a.get(name)) { const sb = b.get(name).get(k); if (!sb) { chans = false; continue; }
    for (const get of ['getInput', 'getOutput']) { const x = sa[get]().getArray(), y = sb[get]().getArray(); if (x.length !== y.length) { counts = false; continue; } for (let i = 0; i < x.length; i++) worst = Math.max(worst, Math.abs(x[i] - y[i])); } }
  console.log(name.padEnd(16), 'max diff', worst.toExponential(2), counts ? 'same keys' : 'KEY COUNTS DIFFER', chans ? '' : 'CHANNELS DIFFER');
}
const nodes = (d) => d.getRoot().listNodes().map(n => n.getName() + ':' + n.getTranslation().map(v => v.toFixed(5)).join(',') + ':' + n.getRotation().map(v => v.toFixed(5)).join(',')).sort().join('|');
console.log('nodes identical:', nodes(A) === nodes(B), ' mesh verts', A.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getCount(), B.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getCount());
