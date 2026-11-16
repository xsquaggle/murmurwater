import { describe, expect, it } from 'vitest';
import { FISH, REGIONS, REGIONS_BY_ID, ROADS, SWAP_BAND, findMooring, regionAcross, regionAhead, regionAt, regionOfNpc, regionOfPlace, roadOpen, roadPoint, roadToward, roadsOpen, zoneAt } from '../src/core/content';
import { Heightfield } from '../src/core/world';
import { clearance, fogAt, murmurAt, newBoat, stepBoat } from '../src/core/boat';
import { boatEnv } from '../src/core/landing';
import { BOATS } from '../src/core/quests';
import { ECHO_UPGRADES, hasFogLamp } from '../src/core/gear';
import { BELL_FLAG, buyEcho, echoCost, ringBell } from '../src/core/bell';
import { newGame } from '../src/core/state';
import { groveTrees } from '../src/core/flora';
import { findRoute } from '../src/core/seaways';

const road = ROADS[0];
const at = (k: number, side = 0): [number, number] => {
  const vx = road.b[0] - road.a[0], vz = road.b[1] - road.a[1], L = Math.hypot(vx, vz);
  return [road.a[0] + vx * k + (vz / L) * side, road.a[1] + vz * k - (vx / L) * side];
};

describe('the sea-road', () => {
  it('joins Hearthbay to Mossglass Fen, from quiet water to quiet water', () => {
    expect(road.between).toEqual(['hearthbay', 'mossglass-fen']);
    for (const [i, end] of [road.a, road.b].entries()) {
      const r = REGIONS_BY_ID.get(road.between[i])!, env = boatEnv(new Heightfield(r));
      expect(fogAt(env, end[0], end[1]), `end ${i} lies short of the fog`).toBe(0);
      for (const boat of BOATS) expect(clearance(env, boat, end[0], end[1], 0), `${boat.id} floats at end ${i}`).toBeGreaterThan(0.5);
    }
    // The two regions do not overlap, so a place is in one of them or in the fog between.
    expect(regionAt(...REGIONS[0].center)).toBe('hearthbay');
    expect(regionAt(...REGIONS[1].center)).toBe('mossglass-fen');
    expect(regionAt(...at(0.5))).toBeNull();
  });

  it('lifts the murmur down its middle and nowhere else', () => {
    expect(roadOpen(road, ...at(0.5))).toBe(1);
    expect(roadOpen(road, ...at(0.5, road.halfWidth * 0.6))).toBe(1);
    const edge = roadOpen(road, ...at(0.5, road.halfWidth * 0.85));
    expect(edge).toBeGreaterThan(0); expect(edge).toBeLessThan(1);
    expect(roadOpen(road, ...at(0.5, road.halfWidth + 1))).toBe(0);
    expect(roadOpen(road, ...at(-0.02))).toBe(0);
    expect(roadOpen(road, ...at(1.02))).toBe(0);
    expect(roadsOpen('hearthbay', ...at(0.4))).toBe(1);
    expect(roadPoint(road, ...at(0.25, 10)).along).toBeCloseTo(0.25);
    expect(roadPoint(road, ...at(0.25, 10)).off).toBeCloseTo(10);
    // The same water with and without a lamp.
    const hf = new Heightfield(REGIONS[0]);
    const dark = boatEnv(hf), lit = boatEnv(hf, [], (x, z) => roadsOpen('hearthbay', x, z));
    const [x, z] = at(0.45);
    expect(murmurAt(dark, x, z)).toBeGreaterThan(0.9);
    expect(murmurAt(lit, x, z)).toBe(0);
    expect(fogAt(lit, x, z)).toBeGreaterThan(0.9); // the fog is as thick as ever: only the way is open
    const [ox, oz] = at(0.45, road.halfWidth + 20);
    expect(murmurAt(lit, ox, oz)).toBeGreaterThan(0.9);
  });

  it('changes region half way along, from either side, and only on the road', () => {
    expect(regionAcross('hearthbay', ...at(0.2))).toBeNull();
    expect(regionAcross('hearthbay', ...at(0.49))).toBeNull();
    expect(regionAcross('hearthbay', ...at(0.52))).toBe('mossglass-fen');
    expect(regionAcross('mossglass-fen', ...at(0.52))).toBeNull();
    expect(regionAcross('mossglass-fen', ...at(0.48))).toBe('hearthbay');
    // A boat turning about on the line does not change waters with every yard: there is a band neither side claims.
    for (const k of [0.5 - SWAP_BAND * 0.9, 0.5, 0.5 + SWAP_BAND * 0.9]) {
      expect(regionAcross('hearthbay', ...at(k))).toBeNull();
      expect(regionAcross('mossglass-fen', ...at(k))).toBeNull();
    }
    expect(regionAcross('hearthbay', ...at(0.6, road.halfWidth + 5))).toBeNull();
    expect(regionAcross('hearthbay', ...at(1.1))).toBeNull();
  });

  it('carries a boat with the Fog Lamp across, and turns one without it back', () => {
    const sail = (lamp: boolean) => {
      let region = 'hearthbay';
      const envOf = (id: string) => boatEnv(new Heightfield(REGIONS_BY_ID.get(id)!), [], (x, z) => (lamp ? roadsOpen(id, x, z) : 0));
      let env = envOf(region);
      const heading = Math.atan2(road.b[0] - road.a[0], road.b[1] - road.a[1]);
      const b = newBoat(road.a[0], road.a[1], heading), skiff = BOATS.find((x) => x.id === 'skiff')!;
      let t = 0, worst = 0;
      for (; t < 150; t += 1 / 60) {
        const r = stepBoat(b, { throttle: 1, rudder: 0 }, skiff, env, 1 / 60);
        worst = Math.max(worst, r.murmur);
        const next = regionAcross(region, b.x, b.z);
        if (next) { region = next; env = envOf(region); }
        if (Math.hypot(b.x - road.b[0], b.z - road.b[1]) < 12) break;
      }
      return { region, t, worst, along: roadPoint(road, b.x, b.z).along };
    };
    const lit = sail(true);
    expect(lit.region).toBe('mossglass-fen');
    expect(lit.worst).toBe(0);
    expect(lit.t).toBeLessThan(75); // about a minute of fog at the skiff's seven metres a second
    const dark = sail(false);
    expect(dark.region).toBe('hearthbay');
    expect(dark.along).toBeLessThan(0.5);
    expect(dark.worst).toBeGreaterThan(0.5);
  });

  it('is open water to fish in, all the way across: never a place where every fish of the region bites', () => {
    // The road runs out past the rim of each region's widest zone. A point in no zone would be read by the
    // fishing rules as every zone at once: the Sump's eel, Old Mossglass and the Listener in the fog.
    for (const region of REGIONS) {
      const open = region.zones.find((z) => z.priority === 0)!;
      for (let k = -0.05; k <= 1.05; k += 0.01) for (const side of [-road.halfWidth, 0, road.halfWidth]) {
        const [x, z] = at(k, side), zone = zoneAt(region, x, z);
        expect(zone, `${region.id} at ${k.toFixed(2)}`).not.toBeNull();
        if (Math.hypot(x - region.center[0], z - region.center[1]) > region.radius) expect(zone!.id).toBe(open.id);
      }
      // What bites in open water is the common run of the region: nothing rarer than uncommon, nothing that waits on anything.
      const here = FISH.filter((f) => f.region === region.id && f.zones.includes(open.id));
      expect(here.length).toBeGreaterThan(1);
      if (region.id === 'mossglass-fen') for (const f of here) expect(['common', 'uncommon'], f.id).toContain(f.rarity);
    }
  });

  it('is prepared for only by a boat bound along it', () => {
    const out = Math.atan2(road.b[0] - road.a[0], road.b[1] - road.a[1]), home = out + Math.PI;
    expect(regionAhead('hearthbay', ...at(0.3), out)).toBe('mossglass-fen');
    expect(regionAhead('hearthbay', ...at(0.3), home)).toBeNull();
    // Just through, and still heading on: the waters behind are not made ready again.
    expect(regionAhead('mossglass-fen', ...at(0.53), out)).toBeNull();
    expect(regionAhead('mossglass-fen', ...at(0.53), home)).toBe('hearthbay');
    expect(regionAhead('hearthbay', ...at(0.3))).toBe('mossglass-fen');
  });

  it('knows the way from one region toward another', () => {
    expect(regionOfPlace('sedge-landing')).toBe('mossglass-fen');
    expect(regionOfPlace('ear-trumpet')).toBe('mossglass-fen');
    expect(regionOfPlace('drowned-bell')).toBe('hearthbay');
    const out = roadToward('hearthbay', 'mossglass-fen')!, back = roadToward('mossglass-fen', 'hearthbay')!;
    expect([out.x, out.z]).toEqual(road.a); expect(out.next).toBe('mossglass-fen');
    expect([back.x, back.z]).toEqual(road.b); expect(back.next).toBe('hearthbay');
    expect(roadToward('hearthbay', 'hearthbay')).toBeNull();
    expect(roadToward('hearthbay', 'nowhere')).toBeNull();
    expect(regionOfNpc('pell')).toBe('hearthbay');
    expect(findMooring('sedge-jetty')!.region.id).toBe('mossglass-fen');
    expect(findMooring('hearthbay-dock')!.region.id).toBe('hearthbay');
    expect(findMooring('no-such')).toBeNull();
  });
});

describe('the Fog Lamp', () => {
  it('is bought once with Echoes and stays on the boat through every Turning', () => {
    const s = newGame(5);
    const lamp = ECHO_UPGRADES.find((u) => u.id === 'fog-lamp')!;
    expect(lamp.thing).toBe(true);
    expect(hasFogLamp(s)).toBe(false);
    s.echoes = lamp.cost[0] - 1;
    expect(buyEcho(s, 'fog-lamp')).toBe(false);
    s.echoes = lamp.cost[0] + 3;
    expect(buyEcho(s, 'fog-lamp')).toBe(true);
    expect(s.echoes).toBe(3);
    expect(hasFogLamp(s)).toBe(true);
    expect(echoCost(s, 'fog-lamp')).toBeNull();
    expect(buyEcho(s, 'fog-lamp')).toBe(false);
    s.flags.push(BELL_FLAG); s.lifetime.coins = 1e6; s.run.coins = 1e6;
    expect(ringBell(s)).not.toBeNull();
    expect(hasFogLamp(s)).toBe(true);
  });
});

describe('the reed beds of the Fen', () => {
  const fen = REGIONS_BY_ID.get('mossglass-fen')!, hf = new Heightfield(fen);
  it('stand just under the water, in a maze with ways through, and stop short of the fog', () => {
    let beds = 0, water = 0, outer = 0;
    for (let x = -400; x <= 400; x += 8) for (let z = -400; z <= 400; z += 8) {
      const h = hf.height(fen.center[0] + x, fen.center[1] + z);
      if (Math.hypot(x, z) > 380) continue;
      if (h > -0.45 && h < 0) beds++; else if (h < -1.2) water++;
    }
    for (let a = 0; a < 360; a += 3) {
      const r = fen.shoals!.within + 15, x = fen.center[0] + Math.sin(a) * r, z = fen.center[1] + Math.cos(a) * r;
      // Islands may stand out here; reed beds may not.
      if (fen.islands.some((i) => Math.hypot(x - i.x, z - i.z) < Math.max(i.rx, i.rz) * 1.8)) continue;
      if (hf.height(x, z) > -1) outer++;
    }
    expect(beds / (beds + water)).toBeGreaterThan(0.08);
    expect(beds / (beds + water)).toBeLessThan(0.4);
    expect(outer).toBe(0);
    // A reed bed stops the skiff (0.4 m of draught over 0.16 m of water).
    expect(fen.shoals!.top).toBeGreaterThan(-0.4);
  });

  it('the Standing Trees stand in water over their roots, apart from each other, and a boat can thread them', () => {
    const trees = groveTrees(fen, hf), grove = fen.groves![0];
    expect(trees.length).toBeGreaterThan(60);
    expect(trees.length).toBeLessThan(110);
    expect(trees.filter((t) => t.kind === 'b').length).toBeGreaterThan(8);
    for (const t of trees) {
      expect(Math.hypot(t.x - grove.x, t.z - grove.z)).toBeLessThanOrEqual(grove.r + grove.spacing);
      const d = hf.depth(t.x, t.z);
      expect(d, 'her roots (1.5 m below the waterline) are in the bed or near it').toBeLessThan(2.2);
      expect(d).toBeGreaterThan(0.35);
    }
    let nearest = Infinity;
    for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) nearest = Math.min(nearest, Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z) - trees[i].r - trees[j].r);
    expect(nearest, 'room for a hull between any two trunks').toBeGreaterThan(3);
    // From the jetty to the heart of the grove, with every trunk in the way.
    const env = boatEnv(hf, trees.map((t) => [t.x, t.z, t.r] as const)), jetty = fen.moorings![0];
    for (const boat of BOATS) {
      const route = findRoute(env, boat, [jetty.x, jetty.z], [grove.x, grove.z]);
      expect(route, `${boat.id} to the middle of the grove`).not.toBeNull();
      const end = route![route!.length - 1];
      expect(Math.hypot(end[0] - grove.x, end[1] - grove.z)).toBeLessThan(25);
    }
  });
});
