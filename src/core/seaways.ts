/**
 * Finding a way by water: a grid search over the sea a given boat can float in.
 *
 * Used by the tests (every mooring must be reachable from every other, for every boat) and by the sailing
 * bot's pilot. Pure, like the boat model it reads.
 */
import type { BoatEnv, BoatSpec } from './boat';

export interface RouteOptions {
  /** Grid cell, m (default 4). */ cell?: number;
  /** Water to spare under the keel along the route, m (default 0.3). */ spare?: number;
  /** How far inside the region's edge the route must stay, m (default the murmur band). */ inset?: number;
}

/**
 * A route from `from` to `to` as [x, z] points a few metres apart, or null when there is no way through.
 * The ends are snapped to the nearest floatable cell within 30 m.
 */
export function findRoute(env: BoatEnv, spec: BoatSpec, from: readonly [number, number], to: readonly [number, number], opts: RouteOptions = {}): [number, number][] | null {
  const cell = opts.cell ?? 4, spare = opts.spare ?? 0.3, inset = opts.inset ?? env.edge ?? 110;
  const half = Math.ceil(env.radius / cell), n = half * 2 + 1;
  const [cx, cz] = env.centre;
  const X = (i: number) => cx + (i - half) * cell, Z = (j: number) => cz + (j - half) * cell;
  const I = (x: number) => Math.round((x - cx) / cell) + half, J = (z: number) => Math.round((z - cz) / cell) + half;
  // A cell is open when the hull has water to spare there whichever way she lies: a ring of samples half
  // a boat-length out, plus the middle.
  const reach = Math.max(spec.length / 2, spec.beam), limit = env.radius - inset;
  const open = new Int8Array(n * n); // 0 unknown, 1 open, -1 closed
  const isOpen = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    const k = j * n + i;
    if (open[k] !== 0) return open[k] === 1;
    const x = X(i), z = Z(j);
    let ok = Math.hypot(x - cx, z - cz) <= limit;
    for (let a = 0; ok && a < 9; a++) {
      const r = a === 8 ? 0 : reach, px = x + Math.cos((a * Math.PI) / 4) * r, pz = z + Math.sin((a * Math.PI) / 4) * r;
      if (env.solid?.(px, pz) || env.depth(px, pz) - spec.draft < spare) ok = false;
    }
    open[k] = ok ? 1 : -1;
    return ok;
  };
  const snap = (p: readonly [number, number]): [number, number] | null => {
    const i0 = I(p[0]), j0 = J(p[1]);
    let best: [number, number] | null = null, bd = Infinity;
    const r = Math.ceil(30 / cell);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const d = Math.hypot(di, dj);
      if (d < bd && isOpen(i0 + di, j0 + dj)) { bd = d; best = [i0 + di, j0 + dj]; }
    }
    return best;
  };
  const a = snap(from), b = snap(to);
  if (!a || !b) return null;

  // A* over eight neighbours with a binary heap.
  const start = a[1] * n + a[0], goal = b[1] * n + b[0];
  const g = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1);
  const heap: number[] = [], f = new Float32Array(n * n);
  const h = (k: number) => Math.hypot((k % n) - b[0], Math.floor(k / n) - b[1]);
  const push = (k: number) => {
    heap.push(k);
    for (let c = heap.length - 1; c > 0;) { const p = (c - 1) >> 1; if (f[heap[p]] <= f[heap[c]]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
  };
  const pop = (): number => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let p = 0; ;) {
        const l = p * 2 + 1, r = l + 1; let m = p;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]]; p = m;
      }
    }
    return top;
  };
  g[start] = 0; f[start] = h(start); push(start);
  const done = new Uint8Array(n * n);
  while (heap.length) {
    const k = pop();
    if (k === goal) break;
    if (done[k]) continue;
    done[k] = 1;
    const i = k % n, j = Math.floor(k / n);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      if (!isOpen(i + di, j + dj)) continue;
      // No cutting a corner between two closed cells.
      if (di && dj && (!isOpen(i + di, j) || !isOpen(i, j + dj))) continue;
      const m = (j + dj) * n + (i + di), cost = g[k] + (di && dj ? Math.SQRT2 : 1);
      if (cost < g[m]) { g[m] = cost; came[m] = k; f[m] = cost + h(m); push(m); }
    }
  }
  if (!isFinite(g[goal])) return null;
  const out: [number, number][] = [];
  for (let k = goal; k !== -1; k = came[k]) out.push([X(k % n), Z(Math.floor(k / n))]);
  return out.reverse();
}

/** Length of a route in metres. */
export function routeLength(route: readonly (readonly [number, number])[]): number {
  let d = 0;
  for (let i = 1; i < route.length; i++) d += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return d;
}
