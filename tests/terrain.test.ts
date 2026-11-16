import { describe, expect, it } from 'vitest';
import type { Mesh } from 'three';
import { REGIONS, REGIONS_BY_ID, regionAhead, ROADS } from '../src/core/content';
import { Heightfield } from '../src/core/world';
import { buildTerrain, terrainSteps } from '../src/render/terrain';
import { RegionPrep } from '../src/render/region-prep';
import { lookOf } from '../src/render/looks';

/** Every triangle of the land and the bed, as [x, y, z] corners. */
function triangles(mesh: Mesh): { land: number; bed: number; tris: number[][][] } {
  const out: number[][][] = [];
  const counts = [0, 0];
  [mesh, ...(mesh.children as Mesh[])].forEach((m, k) => {
    const p = m.geometry.getAttribute('position');
    counts[k] = p.count / 3;
    for (let i = 0; i < p.count; i += 3) out.push([0, 1, 2].map((d) => [p.getX(i + d), p.getY(i + d), p.getZ(i + d)]));
  });
  return { land: counts[0], bed: counts[1], tris: out };
}

describe('the ground', () => {
  for (const region of REGIONS) {
    it(`${region.name}: flat bed is drawn coarse, and nothing is left open between coarse and fine`, () => {
      const hf = new Heightfield(region), cell = 4;
      const built = buildTerrain(hf, cell, lookOf(region.grade).terrain);
      const { land, bed, tris } = triangles(built.mesh);
      const n = Math.ceil((region.radius * 2) / cell);
      // Far fewer faces than the full lattice, which has two to a cell.
      expect(land + bed).toBeLessThan(n * n * 2 * 0.6);
      expect(land).toBeGreaterThan(500);
      expect(bed).toBeGreaterThan(land);
      // Every face looks up.
      for (const [a, b, c] of tris) {
        const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        expect(ny).toBeGreaterThan(0);
      }
      // Watertight: an edge used by one face only lies on the rim of the region, or on the rim of the deep
      // (below 18 m the bed is left out, since the water hides it).
      const key = (p: number[]) => `${Math.round(p[0] * 100)},${Math.round(p[2] * 100)}`;
      const edges = new Map<string, { n: number; a: number[]; b: number[] }>();
      for (const t of tris) for (let i = 0; i < 3; i++) {
        const a = t[i], b = t[(i + 1) % 3], ka = key(a), kb = key(b), k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = edges.get(k); if (e) e.n++; else edges.set(k, { n: 1, a, b });
      }
      const minX = region.center[0] - region.radius, minZ = region.center[1] - region.radius, max = region.radius * 2;
      const onRim = (p: number[]) => Math.abs(p[0] - minX) < 0.01 || Math.abs(p[2] - minZ) < 0.01 || Math.abs(p[0] - minX - max) < cell || Math.abs(p[2] - minZ - max) < cell;
      let open = 0;
      for (const e of edges.values()) {
        expect(e.n).toBeLessThanOrEqual(2);
        if (e.n === 1 && !(onRim(e.a) && onRim(e.b)) && !(e.a[1] < -16 && e.b[1] < -16)) open++;
      }
      expect(open).toBe(0);
      // The land, and only the land, throws shadows.
      expect(built.mesh.castShadow).toBe(true);
      expect((built.mesh.children[0] as Mesh).castShadow).toBe(false);
    }, 60000);
  }

  it('can be made a little at a time, and comes out the same', () => {
    const region = REGIONS_BY_ID.get('mossglass-fen')!, look = lookOf(region.grade).terrain;
    const whole = triangles(buildTerrain(new Heightfield(region), 5, look).mesh);
    const steps = terrainSteps(new Heightfield(region), 5, look);
    let turns = 0, longest = 0, r = steps.next();
    while (!r.done) { const t0 = performance.now(); r = steps.next(); longest = Math.max(longest, performance.now() - t0); turns++; }
    const stepped = triangles(r.value.mesh);
    expect(stepped.land).toBe(whole.land);
    expect(stepped.bed).toBe(whole.bed);
    expect(turns).toBeGreaterThan(300);
    // No single turn is a pause anyone would see (the meshes themselves are the longest).
    expect(longest).toBeLessThan(120);
  }, 60000);

  it('is made ready ahead of a crossing, and handed over once', () => {
    const prep = new RegionPrep(), fen = REGIONS_BY_ID.get('mossglass-fen')!;
    expect(prep.take('mossglass-fen', 5)).toBeNull();
    prep.want(fen, 5);
    expect(prep.working).toBe(true);
    for (let i = 0; i < 4000 && prep.working; i++) prep.pump(0.5);
    expect(prep.working).toBe(false);
    expect(prep.readyFor).toBe('mossglass-fen');
    // Asking again for the same thing does not start over.
    prep.want(fen, 5);
    expect(prep.readyFor).toBe('mossglass-fen');
    // A different size of cell is a different job: what was made is not handed over for it.
    expect(prep.take('mossglass-fen', 4)).toBeNull();
    const got = prep.take('mossglass-fen', 5);
    expect(got?.terrain.mesh.geometry.getAttribute('position').count).toBeGreaterThan(1000);
    expect(prep.take('mossglass-fen', 5)).toBeNull();
    // Half made is finished on the spot when it is needed.
    prep.want(fen, 5); prep.pump(1);
    expect(prep.take('mossglass-fen', 5)?.hf.region.id).toBe('mossglass-fen');
  }, 60000);

  it('knows where a sea-road leads from either end', () => {
    const r = ROADS[0], mid = (k: number): [number, number] => [r.a[0] + (r.b[0] - r.a[0]) * k, r.a[1] + (r.b[1] - r.a[1]) * k];
    expect(regionAhead(r.between[0], ...mid(0.2))).toBe(r.between[1]);
    expect(regionAhead(r.between[1], ...mid(0.8))).toBe(r.between[0]);
    expect(regionAhead(r.between[0], 0, 0)).toBeNull();
  });
});
