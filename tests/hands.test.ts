import { describe, expect, it } from 'vitest';
import { Group, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { Hands } from '../src/game/hands';
import type { Game } from '../src/game/game';
import { freeOwn } from '../src/render/assets';
import { newGame, type GameState } from '../src/core/state';
import { CREW_BY_ID, hire } from '../src/core/crew';
import { takeBoat } from '../src/core/gear';
import { REGIONS_BY_ID } from '../src/core/content';

/** A hull with berths and nothing else: what Hands asks of a BoatRig. */
function stubRig(boatId: string, n: number) {
  const root = new Group(), berths: Group[] = [];
  for (let i = 0; i < n; i++) { const b = new Group(); b.name = `berth${i}`; root.add(b); berths.push(b); }
  return { boatId, root, berth: (i: number) => berths[i] ?? null };
}
type Rig = ReturnType<typeof stubRig>;

/** As much of the game as the hands touch. Node has no models, so the figures are the stand-ins: all their own. */
function world(s: GameState, rig: Rig) {
  const sailing = { owned: true, rig, aboard: false, busy: false, boat: { x: 0, z: 0, speed: 0, heading: 0 }, env: { centre: [0, 0], radius: 5000 } };
  const g = {
    state: s, sailing, session: { biteIn: Infinity }, world: { time: 0 }, waveY: () => 0, pos: { x: 0, z: 0 }, stats: { value: 1, luck: 0, rod: { luck: 0 } },
    audio: new Proxy({}, { get: () => () => {} }), hud: { toast() {} }, fx: { spray: { burst() {} }, ripples: { spawn() {} } },
  };
  return { g, sailing, hands: new Hands(g as unknown as Game) };
}
const keeper = (boat: 'skiff' | 'puffin', ...crew: string[]) => {
  const s = newGame(5);
  s.boats.owned = ['skiff', 'puffin']; s.boats.current = boat;
  for (const id of crew) hire(s, id);
  return s;
};
const seated = (rig: Rig) => rig.root.children.map((b) => b.children.length);

/** Counts what is made under `root` for the graphics card (geometry, materials) and what of it is later freed. */
function watch(root: Object3D, tally: { made: number; freed: number }) {
  const seen = new Set<object>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.geometry || !m.material) return;
    for (const r of [m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material])] as (BufferGeometry | Material)[]) {
      if (seen.has(r)) continue;
      seen.add(r); tally.made++;
      r.addEventListener('dispose', () => { tally.freed++; });
    }
  });
}

describe('the hands as they are seen aboard', () => {
  it('each sits in a berth of their own: the cat on her perch, Mister Hollis on the bench, with or without the other', () => {
    expect([CREW_BY_ID.get('biscuit')!.berth, CREW_BY_ID.get('hollis')!.berth]).toEqual([0, 1]);
    let rig = stubRig('puffin', 2), w = world(keeper('puffin', 'biscuit', 'hollis'), rig);
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([1, 1]);
    // With no cat he is on the bench all the same, and the cat's perch is empty.
    rig = stubRig('puffin', 2); w = world(keeper('puffin', 'hollis'), rig);
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([0, 1]);
    // The skiff has the perch only: nobody sits on it but a cat.
    rig = stubRig('skiff', 1); w = world(keeper('skiff', 'hollis'), rig);
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([0]);
    rig = stubRig('skiff', 1); w = world(keeper('skiff', 'hollis', 'biscuit'), rig);
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([1]);
  });

  it('changing boats frees every figure, however many times it is done', () => {
    const s = keeper('puffin', 'biscuit', 'hollis');
    const w = world(s, stubRig('puffin', 2));
    const tally = { made: 0, freed: 0 };
    for (let swap = 0; swap < 6; swap++) {
      const old = w.sailing.rig, to = swap % 2 ? 'puffin' : 'skiff';
      w.hands.present(1 / 60);
      watch(old.root, tally);
      expect(tally.made).toBeGreaterThan(tally.freed);
      // Pell is asked: the save changes boats at once, and the old hull stays in the water while he brings the
      // other round. The hands sit where they sat, and nothing is built into a hull about to be broken up.
      const before = old.root.children.map((b) => b.children[0]);
      expect(takeBoat(s, to)).toBe(true);
      w.hands.present(1 / 60);
      expect(old.root.children.map((b) => b.children[0])).toEqual(before);
      // Sailing.fitOut: the hands step off, the hull is taken out and freed, and the new one is put in.
      w.hands.unship(); old.root.removeFromParent(); freeOwn(old.root);
      expect(seated(old)).toEqual(old.root.children.map(() => 0));
      expect(tally.freed).toBe(tally.made);
      w.sailing.rig = stubRig(to, to === 'puffin' ? 2 : 1);
    }
    expect(tally.made).toBeGreaterThan(60);
  });

  it('a new hand signing on rebuilds the crew once and frees the figures that were there', () => {
    const s = keeper('puffin', 'biscuit');
    const rig = stubRig('puffin', 2), w = world(s, rig);
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([1, 0]);
    const cat = rig.root.children[0].children[0];
    const tally = { made: 0, freed: 0 };
    watch(rig.root, tally);
    // Nothing changes: nothing is rebuilt.
    for (let i = 0; i < 5; i++) w.hands.present(1 / 60);
    expect(rig.root.children[0].children[0]).toBe(cat);
    expect(tally.freed).toBe(0);
    hire(s, 'hollis');
    w.hands.present(1 / 60);
    expect(seated(rig)).toEqual([1, 1]);
    expect(rig.root.children[0].children[0]).not.toBe(cat);
    expect(tally.freed).toBe(tally.made);
  });

  it('a fish in a mitten or under a nose goes with the figure that had it', () => {
    const s = keeper('puffin', 'biscuit', 'hollis');
    s.journal.butterperch = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 };
    s.journal['kettle-carp'] = { caught: 1, bestWeight: 1, traits: [], firstAt: 0 };
    const rig = stubRig('puffin', 2), w = world(s, rig);
    s.world.region = 'hearthbay'; s.hour = 23;
    w.hands.present(1 / 60);
    // Long enough at night for the cat's fourth fish (eaten) and several of his.
    for (let t = 0; t < 125; t += 0.5) { w.hands.step(0.5); }
    expect(s.crew.tally.biscuit.eaten).toBe(1);
    expect(s.crew.tally.hollis.fish).toBeGreaterThan(0);
    w.hands.present(1 / 60);
    const count = () => { let n = 0; rig.root.traverse(() => { n++; }); return n; };
    expect(count()).toBeGreaterThan(3);
    w.hands.unship();
    // Nothing of theirs is left in the hull: not the figures, not a fish in flight, held or half eaten.
    expect(count()).toBe(3);
  });

  it('in a new water the zone under the keel is looked up at once, not a quarter of a second late', () => {
    const s = keeper('skiff', 'biscuit');
    const w = world(s, stubRig('skiff', 1));
    const zonesOf = (id: string) => new Set<string | null>([null, ...REGIONS_BY_ID.get(id)!.zones.map((z) => z.id)]);
    s.world.region = 'hearthbay';
    w.hands.step(1 / 60);
    expect(w.hands.env!.region).toBe('hearthbay');
    expect(zonesOf('hearthbay').has(w.hands.env!.zone)).toBe(true);
    // The chart carries her across between two steps.
    s.world.region = 'mossglass-fen';
    w.hands.step(1 / 60);
    expect(w.hands.env!.region).toBe('mossglass-fen');
    expect(zonesOf('mossglass-fen').has(w.hands.env!.zone)).toBe(true);
    // The step makes no new picture of where she lies each time: the one it has is written over.
    const env = w.hands.env;
    w.hands.step(1 / 60);
    expect(w.hands.env).toBe(env);
  });
});
