// geomap.mjs : where every pixel of a code-built model's atlas lies on the model, for a painter that paints by place
// (reachmats.py: bone that is green at the waterline and has lichen high up, whatever way its patch is laid out).
// writeGeo(model, atlas, file) writes float32, little endian, H x W x 7, row 0 at the top: x, y, z of the point the
// pixel is painted on (metres, model coordinates), the smoothed normal there, and how the pixel is covered: 1 inside
// a triangle, 0.5 within `grow` pixels of one (so that a patch's bleed is painted like its edge), 0 where nothing is.
// A builder calls it when it writes its layout and names the file in the layout ({ geo: 'name.geo.f32' }, beside the layout).
import fs from 'node:fs';
import path from 'node:path';
import { sub, add, cross, norm, len } from './kit.mjs';

export const geoMap = (m, [W, H], { grow = 3 } = {}) => {
  const out = new Float32Array(W * H * 7), far = new Float32Array(W * H).fill(1e9);
  for (const part of m.parts) {
    if (m.materials.get(part.material).kind !== 'texture') continue;
    const key = (p) => p.map((v) => Math.round(v * 1e4)).join(','), nrm = new Map();          // normals smoothed over the whole part, crease or no crease
    for (const t of part.tris) { const fn = cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p)); for (const c of t) nrm.set(key(c.p), add(nrm.get(key(c.p)) || [0, 0, 0], fn)); }
    for (const t of part.tris) {
      const [a, b, c] = t.map((k) => k.uv), area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]); if (Math.abs(area) < 1e-6) continue;
      const fn = cross(sub(t[1].p, t[0].p), sub(t[2].p, t[0].p)); if (len(fn) < 1e-12) continue;
      const N = t.map((k) => norm(nrm.get(key(k.p)))), E = [[b, c], [c, a], [a, b]].map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - grow)), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0]) + grow));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - grow)), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1]) + grow));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area, w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area, w2 = 1 - w0 - w1;
        const d = Math.max(0, -w0 * Math.abs(area) / E[0], -w1 * Math.abs(area) / E[1], -w2 * Math.abs(area) / E[2]);      // pixels outside the triangle
        const i = y * W + x; if (d > grow || d >= far[i]) continue; far[i] = d;
        for (let k = 0; k < 3; k++) out[i * 7 + k] = w0 * t[0].p[k] + w1 * t[1].p[k] + w2 * t[2].p[k];
        const n = norm([0, 1, 2].map((k) => w0 * N[0][k] + w1 * N[1][k] + w2 * N[2][k])); for (let k = 0; k < 3; k++) out[i * 7 + 3 + k] = n[k];
        out[i * 7 + 6] = d === 0 ? 1 : 0.5;
      }
    }
  }
  return out;
};

/** Write the map beside the layout the command line asked for and return what the layout must say; nothing without a layout. */
export const writeGeo = (m, atlas, args, opt) => {
  if (!args.layout) return {};
  const file = path.basename(args.layout).replace(/\.layout\.json$/, '') + '.geo.f32';
  fs.writeFileSync(path.join(path.dirname(args.layout), file), Buffer.from(geoMap(m, atlas, opt).buffer)); return { geo: file };
};
