import { describe, expect, it } from 'vitest';
import { clearance, murmurAt, nearestFloat, newBoat, stepBoat, type BoatEnv, type BoatInput, type BoatSpec, type BoatState } from '../src/core/boat';
import { BOATS } from '../src/core/quests';
import { Rng } from '../src/core/rng';

// The skiff as she ships: a change to boats.json is held to the same handling rules.
const SKIFF: BoatSpec = BOATS.find((b) => b.id === 'skiff')!;
const DT = 1 / 60;
const open: BoatEnv = { depth: () => 20, centre: [0, 0], radius: 5000 };
/** A straight shore along x = 0: land to the west, deepening to the east. */
const shore: BoatEnv = { depth: (x) => Math.max(0, x * 0.2), centre: [0, 0], radius: 5000 };
/** Round islands with shelving beaches, scattered on a deep sea. */
const isles: [number, number, number][] = [[0, 0, 30], [70, 20, 18], [-40, 80, 25], [60, -70, 12], [-90, -40, 22], [10, 120, 16]];
const archipelago: BoatEnv = {
  depth: (x, z) => { let d = 20; for (const [ix, iz, r] of isles) d = Math.min(d, Math.max(0, (Math.hypot(x - ix, z - iz) - r) * 0.3)); return d; },
  centre: [0, 0], radius: 400,
};

function run(b: BoatState, env: BoatEnv, seconds: number, inp: BoatInput | ((t: number) => BoatInput), each?: (r: ReturnType<typeof stepBoat>) => void) {
  for (let t = 0; t < seconds; t += DT) { const r = stepBoat(b, typeof inp === 'function' ? inp(t) : inp, SKIFF, env, DT); each?.(r); }
}
const AHEAD = { throttle: 1, rudder: 0 }, ASTERN = { throttle: -1, rudder: 0 }, IDLE = { throttle: 0, rudder: 0 };

describe('boat handling', () => {
  it('gathers way, holds its top speed and never exceeds it', () => {
    const b = newBoat(0, 0, 0);
    let top = 0;
    run(b, open, 2, AHEAD);
    expect(b.speed).toBeGreaterThan(3);          // has weight, but answers within a couple of seconds
    expect(b.speed).toBeLessThan(6.5);
    run(b, open, 6, AHEAD, () => { top = Math.max(top, b.speed); });
    expect(b.speed).toBeGreaterThan(SKIFF.speed * 0.97);
    expect(top).toBeLessThanOrEqual(SKIFF.speed + 1e-9);
    expect(b.x).toBeCloseTo(0, 6);               // heading 0 sails along +z
    expect(b.z).toBeGreaterThan(40);
  });

  it('glides to a stop when the throttle is let go', () => {
    const b = newBoat(0, 0, 0);
    run(b, open, 8, AHEAD);
    const z0 = b.z;
    run(b, open, 14, IDLE);
    expect(Math.abs(b.speed)).toBeLessThan(0.1);
    expect(b.z - z0).toBeGreaterThan(10);
    expect(b.z - z0).toBeLessThan(28);
  });

  it('brakes faster than it coasts, and goes astern slowly', () => {
    const a = newBoat(0, 0, 0), c = newBoat(0, 0, 0);
    run(a, open, 8, AHEAD); run(c, open, 8, AHEAD);
    run(a, open, 1.5, IDLE); run(c, open, 1.5, ASTERN);
    expect(c.speed).toBeLessThan(a.speed - 2);
    run(c, open, 8, ASTERN);
    expect(c.speed).toBeCloseTo(-SKIFF.speed * 0.35, 1);
  });

  it('turns to port with positive rudder, and makes a full circle in a few seconds', () => {
    const b = newBoat(0, 0, 0);
    run(b, open, 6, AHEAD);
    let turned = 0, last = b.heading, t = 0;
    while (turned < Math.PI * 2 && t < 20) { stepBoat(b, { throttle: 1, rudder: 1 }, SKIFF, open, DT); turned += Math.atan2(Math.sin(b.heading - last), Math.cos(b.heading - last)); last = b.heading; t += DT; }
    expect(t).toBeGreaterThan(4.5);
    expect(t).toBeLessThan(8);
    expect(b.speed).toBeGreaterThan(SKIFF.speed * 0.7); // a hard turn costs some speed, not most of it
  });

  it('can pivot at rest, so it is never stuck pointing at a shore', () => {
    const b = newBoat(0, 0, 0);
    run(b, open, 3, { throttle: 0, rudder: -1 });
    expect(b.heading).toBeLessThan(-0.6);
    expect(Math.hypot(b.x, b.z)).toBeLessThan(0.01);
  });

  it('slides a little in a turn: travel lags the heading', () => {
    const b = newBoat(0, 0, 0);
    run(b, open, 6, AHEAD);
    run(b, open, 1, { throttle: 1, rudder: 1 });
    const lag = Math.atan2(Math.sin(b.heading - b.course), Math.cos(b.heading - b.course));
    expect(lag).toBeGreaterThan(0.1);
    expect(lag).toBeLessThan(0.6);
  });

  it('stops at a shore: the hull never enters water shallower than its draft', () => {
    const b = newBoat(30, 0, -Math.PI / 2);
    let bumps = 0, least = Infinity;
    run(b, shore, 20, AHEAD, (r) => { if (r.bump > 0) bumps++; least = Math.min(least, clearance(shore, SKIFF, b.x, b.z, b.heading)); });
    expect(least).toBeGreaterThanOrEqual(0);
    expect(bumps).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(5);                     // it got right up to the shallows
    expect(Math.abs(b.speed)).toBeLessThan(1.2);
    // …and backs straight off again.
    const x0 = b.x;
    run(b, shore, 4, ASTERN);
    expect(b.x - x0).toBeGreaterThan(3);
  });

  it('slides along a shore it meets at an angle instead of sticking', () => {
    const b = newBoat(30, 0, Math.atan2(-1, 1));            // forward = (−0.71, +0.71): toward the shore and along it
    let least = Infinity;
    run(b, shore, 25, AHEAD, () => { least = Math.min(least, clearance(shore, SKIFF, b.x, b.z, b.heading)); });
    expect(least).toBeGreaterThanOrEqual(0);
    expect(b.z).toBeGreaterThan(60);
  });

  it('slides along a diagonal shore too', () => {
    const diag: BoatEnv = { depth: (x, z) => Math.max(0, (x + z) * 0.15), centre: [0, 0], radius: 5000 };
    const b = newBoat(40, 40, Math.PI);                     // heading −z, into the shore at 45 degrees
    let least = Infinity;
    run(b, diag, 30, AHEAD, () => { least = Math.min(least, clearance(diag, SKIFF, b.x, b.z, b.heading)); });
    expect(least).toBeGreaterThanOrEqual(0);
    expect(b.x - 40).toBeGreaterThan(25);                   // carried along the shore toward +x
  });

  it('cannot pass through something solid', () => {
    const pier: BoatEnv = { depth: () => 10, solid: (x, z) => Math.abs(x) < 1.5 && z > 20 && z < 60, centre: [0, 0], radius: 5000 };
    const b = newBoat(-30, 40, Math.PI / 2);
    let least = Infinity;
    run(b, pier, 15, AHEAD, () => { least = Math.min(least, clearance(pier, SKIFF, b.x, b.z, b.heading)); });
    expect(least).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThan(-1.5);
  });

  it('never grounds and can always get away again, whatever the helm does', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = new Rng(seed);
      const start = nearestFloat(archipelago, SKIFF, rng.range(-120, 120), rng.range(-120, 120), rng.range(-3, 3))!;
      const b = newBoat(start.x, start.z, start.heading);
      let inp: BoatInput = AHEAD, least = Infinity;
      for (let i = 0; i < 60 * 150; i++) {
        if (i % 45 === 0) inp = { throttle: rng.chance(0.75) ? 1 : rng.chance(0.5) ? -1 : 0, rudder: rng.pick([-1, 0, 0, 1]) };
        stepBoat(b, inp, SKIFF, archipelago, DT);
        least = Math.min(least, clearance(archipelago, SKIFF, b.x, b.z, b.heading));
      }
      expect(least, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      // From wherever that left it, some plain input moves the boat a good way.
      let best = 0;
      for (const esc of [AHEAD, ASTERN, { throttle: 1, rudder: 1 }, { throttle: -1, rudder: -1 }]) {
        const c = { ...b };
        run(c, archipelago, 8, esc);
        best = Math.max(best, Math.hypot(c.x - b.x, c.z - b.z));
      }
      expect(best, `seed ${seed} escape`).toBeGreaterThan(4);
    }
  });

  it('is turned back by the murmur at the edge of the region, and can sail away from it', () => {
    const b = newBoat(0, archipelago.radius - 140, 0);
    let far = 0, loud = 0;
    run(b, archipelago, 90, AHEAD, (r) => { far = Math.max(far, Math.hypot(b.x, b.z)); loud = Math.max(loud, r.murmur); });
    expect(far).toBeLessThan(archipelago.radius);
    expect(loud).toBeGreaterThan(0.5);
    expect(murmurAt(archipelago, 0, 0)).toBe(0);
    // Turn round and leave.
    b.heading = Math.PI; b.course = Math.PI;
    run(b, archipelago, 20, AHEAD);
    expect(Math.hypot(b.x, b.z)).toBeLessThan(archipelago.radius - 150);
  });

  it('is deterministic', () => {
    const a = newBoat(50, 50, 1), c = newBoat(50, 50, 1);
    const helm = (t: number): BoatInput => ({ throttle: Math.sin(t) > -0.5 ? 1 : -1, rudder: Math.sin(t * 0.7) > 0.3 ? 1 : Math.sin(t * 0.7) < -0.3 ? -1 : 0 });
    run(a, archipelago, 60, helm); run(c, archipelago, 60, helm);
    expect(a).toEqual(c);
  });

  it('finds floating water next to a landing', () => {
    const p = nearestFloat(archipelago, SKIFF, 0, 0, 0)!;   // the middle of an island
    expect(p).toBeTruthy();
    expect(clearance(archipelago, SKIFF, p.x, p.z, p.heading)).toBeGreaterThanOrEqual(0.15);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(40);
    expect(nearestFloat({ depth: () => 0, centre: [0, 0], radius: 100 }, SKIFF, 0, 0, 0, 20)).toBeNull();
  });
  it('lying against a shelving shore she can always be brought round with the helm alone', () => {
    // Alongside the beach with a hand's breadth of water under her: turning her bow in is blocked, so the
    // turn has to work her off instead of leaving the rudder dead.
    for (const rudder of [1, -1]) {
      const b = newBoat(2.3 + SKIFF.beam / 2, 0, 0);
      expect(clearance(shore, SKIFF, b.x, b.z, b.heading)).toBeGreaterThanOrEqual(0);
      const h0 = b.heading;
      let least = Infinity, turned = 0, last = h0;
      run(b, shore, 25, { throttle: 0, rudder }, () => {
        least = Math.min(least, clearance(shore, SKIFF, b.x, b.z, b.heading));
        turned += Math.abs(Math.atan2(Math.sin(b.heading - last), Math.cos(b.heading - last))); last = b.heading;
      });
      expect(least, 'never grounds').toBeGreaterThanOrEqual(-1e-6);
      expect(turned, `rudder ${rudder}: turned through`).toBeGreaterThan(Math.PI);
      expect(b.x, 'worked off the beach, not far').toBeLessThan(12);
    }
  });
});
