// reach-parts.mjs : small things shared by the builders of Saltbone Reach (rib.mjs, build-vertebra.mjs).
import { add, sub, mul, norm, cross, dot } from './kit.mjs';

export const r3 = (p) => p.map((v) => +v.toFixed(3));

/** Corners in the order that looks toward the point `at` (for a face whose winding is not worth working out by hand). */
export const facing = (pts, at) => (dot(cross(sub(pts[1][0], pts[0][0]), sub(pts[2][0], pts[0][0])), sub(at, pts[0][0])) >= 0 ? pts : [...pts].reverse());

/** A limpet: a low six-sided cone of radius r set into a face at c, whose outward normal is n. `rect` is painted with `limpet`. */
export const limpetCone = (part, c, n, r, rect, turn = 0) => {
  const ex = norm(cross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n)), ey = cross(n, ex), apex = [add(c, mul(n, r * 0.40)), rect.at(0.5, 0.5), 1];
  const rim = (q) => { const a = turn + 2 * Math.PI * q / 6; return [add(add(c, mul(n, -0.02)), add(mul(ex, r * Math.cos(a)), mul(ey, r * Math.sin(a)))), rect.at(0.5 + 0.46 * Math.cos(a), 0.5 + 0.46 * Math.sin(a)), 1]; };
  for (let q = 0; q < 6; q++) part.tri(rim(q), rim(q + 1), apex);
};
