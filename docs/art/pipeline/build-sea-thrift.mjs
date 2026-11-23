// build-sea-thrift.mjs : a cushion of sea-thrift for the slate of Saltbone Reach, built in code (no generation job).
// Usage: node build-sea-thrift.mjs <out.glb> [texture.png] [--layout layout.json] [--uv uv.svg]     (paint with paint-atlas.py)
// A low green dome 0.7 m across with twelve pink flower heads on short stalks, all of it geometry (no alpha cards):
// the dome eight-sided, every head a low five-sided cap that looks up and out, every stalk one thin triangle. 0.3 m tall, origin on the
// ground under the middle. One material, `main`, double-sided (the stalks are seen from both sides).
// UV v runs 0 at the foot to 1 at the top of the flower heads, so the game can sway it by v: the dome takes 0 to 0.30
// (it hardly moves), a stalk runs from the dome's v where it stands to 0.92, a head from 0.885 to 1.
import { Model, strip, cli, emit, add, sub, mul, norm, cross, rad, rng } from './kit.mjs';

const args = cli(), ATLAS = [256, 256], SIDES = 8, HEADS = 12, DOME_V = 0.30, rnd = rng(77);
const R = {
  dome: strip(0, 0, 256, 77, { mat: 'thriftdome', flip: true, soft: 2 }, 77),                     // rows 0 to 77 are v 0 to 0.30
  stalk: strip(0, 85, 256, 218, { mat: 'flat', colour: '#7C8A4C', var: 0.14, grain: 0.1, soft: 2 }, 78),
  heads: strip(0, 226, 256, 256, { mat: 'thrifthead', n: HEADS, flip: true, soft: 0 }, 79),       // rows 226 to 256 are v 0.883 to 1
};
const m = new Model('sea-thrift'); m.material('main', { kind: 'texture', roughness: 0.95, doubleSided: true });
const g = m.part('cushion', { crease: 50 }), h = m.part('heads', { crease: 30 });

const PROFILE = [[0.33, 0], [0.30, 0.085], [0.175, 0.165], [0, 0.186]], TOP = 0.186;
const wob = Array.from({ length: 4 }, () => Array.from({ length: SIDES }, () => 1 + 0.06 * (2 * rnd() - 1)));
g.lathe(PROFILE, SIDES, R.dome, { v: PROFILE.map(([, y]) => 1 - y / TOP), wobble: (i, j) => wob[i][j % SIDES], shade: (i) => [0.72, 0.9, 1, 1][i] });
const domeAt = (r) => { for (let i = 0; i + 1 < PROFILE.length; i++) { const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1]; if (r <= r0 && r >= r1) return y0 + (y1 - y0) * (r0 - r) / (r0 - r1); } return 0; };

const px = (u, v) => [u * ATLAS[0], v * ATLAS[1]];                    // a pixel from u and v as the game reads them
for (let k = 0; k < HEADS; k++) {
  const rho = Math.sqrt((k + 0.7) / (HEADS + 0.4)), a = rad(k * 137.5 + 20 * rnd()), d = [Math.cos(a), 0, -Math.sin(a)], side = [Math.sin(a), 0, Math.cos(a)];
  const first = k === 0, rb = first ? 0 : rho * 0.265, yb = domeAt(rb) - 0.012, hc = first ? 0.278 : Math.min(0.262, 0.215 + 0.03 * (1 - rho) + 0.03 * rnd());
  const base = add(mul(d, rb), [0, yb, 0]), c = first ? [0, hc, 0] : add(add(mul(d, rb + 0.035 + 0.05 * rho), mul(side, 0.03 * (rnd() - 0.5))), [0, hc, 0]);
  const u = (k + 0.5) / HEADS, vb = DOME_V * yb / TOP;
  h.tri([add(base, mul(side, -0.011)), px(u - 0.012, vb), 0.8], [add(base, mul(side, 0.011)), px(u + 0.012, vb), 0.8], [c, px(u, 0.92), 1]);
  // the head: a low cap about the line the stalk points along, leaning half way back to upright; the first stands upright in the middle and its top is the top of the plant (0.30 m, v = 1)
  const n = first ? [0, 1, 0] : norm(add(norm(sub(c, base)), [0, 1, 0])), ex = norm(cross(n, side)), ey = cross(n, ex);
  const sw = R.heads.sub(k / HEADS + 0.004, 0, (k + 1) / HEADS - 0.004, 1), rr = 0.040 + 0.007 * rnd(), t0 = rnd() * 6;
  const rim = (j) => { const b = t0 + 2 * Math.PI * (j % 5) / 5; return [add(add(c, mul(n, -0.004)), add(mul(ex, rr * Math.cos(b)), mul(ey, rr * Math.sin(b)))), sw.at(0.5 + 0.42 * Math.cos(b), 0.86), 0.86]; };
  const apex = [add(c, mul(n, 0.022)), sw.at(0.5, 0), 1];             // the patch's bottom row is v = 1
  for (let j = 0; j < 5; j++) h.tri(rim(j), rim(j + 1), apex);
}
await emit(m, R, ATLAS, args, { quality: 88 });
