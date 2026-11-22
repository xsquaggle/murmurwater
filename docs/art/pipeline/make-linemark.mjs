// make-linemark.mjs out.glb [fish] : a marker for checking a socket in a render. Without `fish`: a thin white line
// along the socket's +Y (0.9 m down, 0.25 m up) and a short red peg along its +Z. With it: a red slab where the game
// hangs Hollis's catch (0.22 m long, its middle 0.12 m under the node) on a short white line.
import { Model, rect } from './kit.mjs';
const fish = process.argv[3] === 'fish', m = new Model('linemark'), r = rect(0, 0, 1, 1), all = { px: r, nx: r, py: r, ny: r, pz: r, nz: r };
m.material('main', { kind: 'plain', color: [0.9, 0.9, 0.85], roughness: 1 }); m.material('Glass', { kind: 'plain', color: [0.8, 0.05, 0.05], roughness: 1 });
if (fish) { m.part('line', { material: 'main' }).box([0, 0.06, 0], [0.003, 0.19, 0.003], all); m.part('peg', { material: 'Glass' }).box([0, -0.12, 0], [0.045, 0.11, 0.012], all); }
else { m.part('line', { material: 'main' }).box([0, -0.325, 0], [0.003, 0.575, 0.003], all); m.part('peg', { material: 'Glass' }).box([0, 0, 0.03], [0.004, 0.004, 0.03], all); }
console.log(JSON.stringify(await m.write(process.argv[2], {})));
