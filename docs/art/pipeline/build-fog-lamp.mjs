// build-fog-lamp.mjs : the Fog Lamp that stands on the skiff's bow, built in code (no generation job).
// Usage: node build-fog-lamp.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// Origin at the foot of the crook, +Y up, metres, the lantern hangs out toward +Z. 0.9 m tall, the lantern 0.28 m.
// Two materials: `main` and `Glass` (the lantern's glass; its texture is also its glow map).
import { Model, pack, cli, emit } from './kit.mjs';
import { cagedLantern, lanternRects } from './fen-parts.mjs';

const args = cli(); const ATLAS = [512, 512];
const R = pack(...ATLAS, {
  rod: [72, 400, { mat: 'iron', rust: 0.25, tile_x: true, ao: { bottom: 0.25 } }], scroll: [24, 140, { mat: 'iron', rust: 0.3, tile_x: true }],
  foot: [150, 56, { mat: 'iron', rust: 0.5, tile_x: true, edge: 0.5 }],
  ...lanternRects(150, 'cyanwhite'),
});

const m = new Model('fog-lamp');
m.material('main', { kind: 'texture', roughness: 0.85 });
m.material('Glass', { kind: 'texture', roughness: 0.35, emissive: [1, 1, 1], glow: true });

// ---- the crook: up from the stem, forward and over, and a hook at the end that the lantern's ring hangs on
const CROOK = [[0, 0.02, 0], [0, 0.30, -0.008], [0, 0.54, 0], [0, 0.70, 0.040], [0, 0.80, 0.100], [0, 0.862, 0.180], [0, 0.872, 0.250], [0, 0.850, 0.295], [0, 0.822, 0.283]];
const iron = m.part('crook', { crease: 50 });
iron.tube(CROOK, [0.024, 0.023, 0.022, 0.021, 0.020, 0.018, 0.016, 0.013, 0.009], 5, R.rod);
iron.tube([[0, 0.560, 0.012], [0, 0.635, 0.075], [0, 0.725, 0.100], [0, 0.765, 0.072], [0, 0.748, 0.050]], [0.012, 0.0115, 0.011, 0.009, 0.006], 3, R.scroll);   // a scroll in the crook's elbow
iron.lathe([[0, 0], [0.046, 0], [0.046, 0.050], [0.034, 0.070], [0.024, 0.076]], 6, R.foot);                                                                   // the socket on the stem

// ---- the lantern, hanging from the hook
const frame = m.part('lantern', { crease: 35 }), glass = m.part('glass', { material: 'Glass', crease: 20 });
const L = cagedLantern(frame, glass, R, { at: [0, 0.545, 0.280], h: 0.28, r: 0.052 });

await emit(m, R, ATLAS, args, { extra: { lantern: L } });
