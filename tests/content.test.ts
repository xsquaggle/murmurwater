import { describe, expect, it } from 'vitest';
import { validateContent, zoneAt, REGIONS, BAITS, inHours } from '../src/core/content';
import { Heightfield } from '../src/core/world';
import { clearance, murmurAt, newBoat, stepBoat } from '../src/core/boat';
import { LANDING, boatEnv, hullDistance, landingSpot, walkableHeight } from '../src/core/landing';
import { BOATS, QUESTS } from '../src/core/quests';
import { findRoute, routeLength } from '../src/core/seaways';

describe('content', () => {
  it('validates', () => { expect(validateContent()).toEqual([]); });
  it('zones resolve by priority', () => {
    const hb = REGIONS[0];
    expect(zoneAt(hb, -100, 22)?.id).toBe('hb-dock');
    expect(zoneAt(hb, -275, 245)?.id).toBe('hb-teeth');
    expect(zoneAt(hb, 300, 300)?.id).toBe('hb-open');
  });
  it('hour ranges wrap midnight', () => {
    expect(inHours(23, [19, 5])).toBe(true);
    expect(inHours(3, [19, 5])).toBe(true);
    expect(inHours(12, [19, 5])).toBe(false);
    expect(inHours(12, [6, 18])).toBe(true);
  });
});

describe('the sea', () => {
  const region = REGIONS[0];
  const hf = new Heightfield(region);
  const env = boatEnv(hf);
  const ground = (x: number, z: number) => walkableHeight(hf, x, z);
  it('every boat floats at every mooring, with somewhere to step ashore', () => {
    for (const boat of BOATS) for (const m of region.moorings ?? []) {
      expect(clearance(env, boat, m.x, m.z, m.heading), `${boat.id} at ${m.id}`).toBeGreaterThanOrEqual(0.1);
      expect(landingSpot(ground, m), `landing at ${m.id}`).not.toBeNull();
      expect(murmurAt(env, m.x, m.z), `${m.id} is in quiet water`).toBe(0);
    }
  });
  it('every chart place and zone is inside the quiet water, and found places are reachable by boat', () => {
    for (const c of region.chart ?? []) expect(Math.hypot(c.x - region.center[0], c.z - region.center[1]) + c.r, c.id).toBeLessThan(region.radius - 110);
  });
  it('every boat can sail from the home dock to every mooring, every chart place and every quest ground', () => {
    const home = region.moorings![0];
    const quests = QUESTS.flatMap((q) => q.objectives.filter((o) => o.at).map((o) => ({ id: q.id, x: o.at![0], z: o.at![1] })));
    for (const boat of BOATS) {
      for (const m of [...(region.moorings ?? []).slice(1), ...quests]) {
        const route = findRoute(env, boat, [home.x, home.z], [m.x, m.z]);
        expect(route, `${boat.id}: home dock to ${m.id}`).not.toBeNull();
        // The way there is not absurdly roundabout, and ends where it was meant to.
        const end = route![route!.length - 1];
        expect(Math.hypot(end[0] - m.x, end[1] - m.z), `${m.id}: route ends near it`).toBeLessThan(30);
        expect(routeLength(route!), `${m.id}: route length`).toBeLessThan(3.2 * Math.hypot(m.x - home.x, m.z - home.z) + 80);
      }
      // Found by coming within its circle: the circle must hold water the boat can reach.
      for (const c of region.chart ?? []) {
        if (c.r <= 0) continue;
        let reached = false;
        for (let a = 0; a < 16 && !reached; a++) {
          const x = c.x + Math.cos((a / 16) * Math.PI * 2) * c.r * 0.8, z = c.z + Math.sin((a / 16) * Math.PI * 2) * c.r * 0.8;
          const route = findRoute(env, boat, [home.x, home.z], [x, z]);
          const end = route?.[route.length - 1];
          reached = !!end && Math.hypot(end[0] - c.x, end[1] - c.z) < c.r - 4;
        }
        expect(reached, `${boat.id} can come within sight of ${c.id}`).toBe(true);
      }
    }
  });
  it('every sea chest stands on dry ground, within a short walk of water a boat can land from', () => {
    const ids = new Set<string>();
    for (const c of region.chests ?? []) {
      expect(ids.has(c.id), `${c.id} is listed once`).toBe(false); ids.add(c.id);
      expect(ground(c.x, c.z), `${c.id} is on ground`).not.toBeNull();
      expect(hf.height(c.x, c.z), `${c.id} is above the tide`).toBeGreaterThan(0.4);
      for (const id of Object.keys(c.items ?? {})) expect(BAITS.some((b) => b.id === id), `${c.id}: bait ${id}`).toBe(true);
      // Somewhere within 60 m a boat can lie with a place to step off.
      let landing = false;
      for (const boat of BOATS) for (let r = 6; r <= 60 && !landing; r += 3) for (let a = 0; a < 24 && !landing; a++) {
        const x = c.x + Math.cos((a / 24) * Math.PI * 2) * r, z = c.z + Math.sin((a / 24) * Math.PI * 2) * r;
        landing = clearance(env, boat, x, z, 0) >= 0.1 && landingSpot(ground, { x, z, heading: 0 }) !== null && findRoute(env, boat, [region.moorings![0].x, region.moorings![0].z], [x, z]) !== null;
      }
      expect(landing, `${c.id} can be landed at`).toBe(true);
    }
  });
  it('wherever a boat is run at a shore she stays afloat, and where she lets you off she can be boarded again', () => {
    // Driven at every island from all round, at full sail and at a crawl, bow-on and at a slant. Where a
    // landing is on offer it must be inside boarding reach of the hull: once a spot beyond it left the
    // player ashore on Kettle Isle with no way back aboard.
    let offered = 0, runs = 0;
    for (const boat of BOATS) for (const isl of region.islands) {
      const far = Math.max(isl.rx, isl.rz) + 45;
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2 + 0.013;
        const b = newBoat(isl.x + Math.sin(a) * far, isl.z + Math.cos(a) * far, a + Math.PI + (k % 3 - 1) * 0.5);
        // Started from open water: a bearing that begins on another island is not a run at this one.
        if (clearance(env, boat, b.x, b.z, b.heading) < 0.5) continue;
        runs++;
        const throttle = k % 2 ? 1 : 0.35;
        let least = Infinity, still = 0;
        for (let n = 0; n < 40 * 60 && still < 1.5; n++) {
          stepBoat(b, { throttle, rudder: 0 }, boat, env, 1 / 60);
          still = Math.abs(b.speed) < 0.3 && n > 180 ? still + 1 / 60 : 0;
          // Past the island and away: a slanted run that missed.
          if (n > 300 && Math.hypot(b.x - isl.x, b.z - isl.z) > far + 5) break;
          if (n % 6 === 0) least = Math.min(least, clearance(env, boat, b.x, b.z, b.heading));
          // The landing a player would be offered at any moment she is slow enough to step off.
          if (Math.abs(b.speed) < 1.5 && n % 20 === 0) {
            const l = landingSpot(ground, b);
            if (!l) continue;
            offered++;
            expect(hullDistance(b, l.x, l.z), `${isl.id} bearing ${k * 10}: landing at (${l.x.toFixed(1)}, ${l.z.toFixed(1)}) from (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`).toBeLessThanOrEqual(LANDING.reach + 1e-6);
            expect(ground(l.x, l.z), 'the landing is ground').not.toBeNull();
          }
        }
        expect(least, `${boat.id} run at ${isl.id} on bearing ${k * 10}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
    expect(runs).toBeGreaterThan(150);
    expect(offered).toBeGreaterThan(100);
    expect(LANDING.slack).toBeGreaterThan(0.3);
  }, 30000);
  it('a landing prefers ground clear of people and props, and uses crowded ground only when there is no other', () => {
    // A beach along x >= 4, with a crowd on the part nearest the boat.
    const beach = (x: number) => (x >= 4 ? 0.3 + (x - 4) * 0.05 : null);
    const boat = { x: 0, z: 0, heading: 0 };
    const crowd = (x: number, z: number) => Math.hypot(x - 4.5, z) > 2;
    const open = landingSpot((x) => beach(x), boat)!;
    const clear = landingSpot((x) => beach(x), boat, crowd)!;
    expect(Math.hypot(open.x - 4.5, open.z)).toBeLessThan(2);
    expect(crowd(clear.x, clear.z)).toBe(true);
    expect(hullDistance(boat, clear.x, clear.z)).toBeLessThanOrEqual(LANDING.reach);
    expect(landingSpot((x) => beach(x), boat, () => false)).not.toBeNull();
    expect(landingSpot(() => null, boat)).toBeNull();
    // Too far for anyone to wade: 7 m of shallows off the beam.
    expect(landingSpot((x) => (x >= 0.75 + LANDING.reach + 0.5 ? 0.3 : null), boat)).toBeNull();
  });
  it('the places a quest sends you to on foot can be stood on', () => {
    for (const p of region.places ?? []) {
      let ok = false;
      for (let a = 0; a < 12 && !ok; a++) ok = ground(p.x + Math.cos(a) * p.r * 0.7, p.z + Math.sin(a) * p.r * 0.7) !== null;
      expect(ok, p.id).toBe(true);
    }
  });
});
