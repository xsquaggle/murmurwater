// glbinfo.mjs file.glb : nodes, skins, joints, clips, meshes, materials and texture sizes of a GLB.
import fs from 'fs';
const b = fs.readFileSync(process.argv[2]); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
const acc = j.accessors || [];
console.log('nodes', j.nodes.length, 'meshes', (j.meshes || []).length, 'skins', (j.skins || []).length, 'animations', (j.animations || []).length, 'materials', (j.materials || []).map((m) => m.name).join(','), 'images', (j.images || []).map((i) => i.mimeType).join(','));
for (const m of j.meshes || []) for (const p of m.primitives) console.log(' mesh', m.name, 'verts', acc[p.attributes.POSITION].count, 'tris', acc[p.indices].count / 3, 'attrs', Object.keys(p.attributes).join(','), 'min', acc[p.attributes.POSITION].min.map((v) => v.toFixed(2)).join(' '), 'max', acc[p.attributes.POSITION].max.map((v) => v.toFixed(2)).join(' '));
for (const s of j.skins || []) console.log(' skin joints', s.joints.length, s.joints.map((i) => j.nodes[i].name).join(' '));
for (const a of j.animations || []) { const times = new Set(); let mx = 0; for (const s of a.samplers) { mx = Math.max(mx, acc[s.input].max[0]); times.add(acc[s.input].count); } console.log(' clip', a.name, 'channels', a.channels.length, 'duration', mx.toFixed(2), 'keys', [...times].join('/'), 'paths', [...new Set(a.channels.map((c) => c.target.path))].join(',')); }
const roots = j.scenes[j.scene || 0].nodes; const show = (i, d) => { const n = j.nodes[i]; if (d < (+process.argv[3] || 3)) { console.log(' '.repeat(d * 2 + 1) + (n.name || '?') + (n.mesh !== undefined ? ' [mesh]' : '') + (n.skin !== undefined ? ' [skin]' : '') + (n.translation ? ' t=' + n.translation.map((v) => v.toFixed(3)).join(',') : '') + (n.scale ? ' s=' + n.scale.map((v) => v.toFixed(3)).join(',') : '')); (n.children || []).forEach((c) => show(c, d + 1)); } };
roots.forEach((r) => show(r, 0));
