/**
 * Makes the next region's ground ahead of time, a few milliseconds a frame, so that crossing into it does not
 * hold the game up. One region is kept in hand at a time.
 */
import { Heightfield, type RegionDef } from '../core/world';
import { lookOf } from './looks';
import { terrainSteps, type TerrainBuild } from './terrain';

export class RegionPrep {
  private id: string | null = null;
  private cell = 0;
  private hf: Heightfield | null = null;
  private steps: Generator<void, TerrainBuild, void> | null = null;
  private terrain: TerrainBuild | null = null;
  /** Milliseconds of work done on the region in hand, and the longest single turn at it (for the frame profile). */
  spent = 0;
  longest = 0;

  /** Start on `region`, at this size of terrain cell. Does nothing if it is the one already in hand. */
  want(region: RegionDef, cell: number) {
    if (this.id === region.id && this.cell === cell) return;
    this.id = region.id; this.cell = cell; this.spent = 0; this.longest = 0;
    this.hf = new Heightfield(region);
    this.steps = terrainSteps(this.hf, cell, lookOf(region.grade).terrain);
    this.terrain = null;
  }

  /** The region whose ground is finished and waiting, if any. */
  get readyFor(): string | null { return this.terrain ? this.id : null; }
  get working(): boolean { return this.steps !== null; }

  /** Do up to `budgetMs` of the work. */
  pump(budgetMs: number) {
    if (!this.steps) return;
    const t0 = performance.now();
    for (;;) {
      const r = this.steps.next();
      if (r.done) { this.terrain = r.value; this.steps = null; break; }
      if (performance.now() - t0 >= budgetMs) break;
    }
    const took = performance.now() - t0;
    this.spent += took;
    if (Number.isFinite(budgetMs)) this.longest = Math.max(this.longest, took);
  }

  /** Hands over the ground for `id` if it is the one in hand, finishing it first if need be; null otherwise. */
  take(id: string, cell: number): { hf: Heightfield; terrain: TerrainBuild } | null {
    if (this.id !== id || this.cell !== cell) return null;
    this.pump(Infinity);
    const out = { hf: this.hf!, terrain: this.terrain! };
    this.id = null; this.hf = null; this.terrain = null; this.steps = null;
    return out;
  }
}
