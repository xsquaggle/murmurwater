import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, loadGame, localStorageStore, looksReadable, serialize, SaveError, type SaveStore } from '../src/core/save';
import { newGame, SAVE_VERSION } from '../src/core/state';

const mem = (main: string | null, backup: string | null): SaveStore & { written?: string } => ({
  async read() { return { main, backup }; }, async write(t) { (this as any).written = t; },
});

describe('saves', () => {
  it('round-trips, including the infinite breadcrumb stack', () => {
    const s = newGame(42);
    s.coins = 123; s.hold.push({ uid: 1, fishId: 'butterperch', weight: 0.5, trait: null, value: 6, perfect: true });
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    expect(back.gear.baits.breadcrumb).toBe(Infinity);
  });
  it('falls back to the backup when the main save is corrupt', async () => {
    const good = serialize(Object.assign(newGame(1), { coins: 77 }));
    const r = await loadGame(mem('{not json', good));
    expect(r.source).toBe('backup');
    expect(r.state.coins).toBe(77);
    expect(r.warning).toBeTruthy();
  });
  it('refuses saves from a newer version instead of overwriting them', async () => {
    const future = JSON.stringify({ format: 'murmurwater-save', version: SAVE_VERSION + 1, savedAt: '', state: {} });
    await expect(loadGame(mem(future, null))).rejects.toBeInstanceOf(SaveError);
  });
  it('starts fresh with no saves', async () => {
    const r = await loadGame(mem(null, null));
    expect(r.source).toBe('new');
  });
  it('fills fields missing from partial saves', () => {
    const s: any = newGame(3); delete s.relics; delete s.gear.worn;
    const back = deserialize(JSON.stringify({ format: 'murmurwater-save', version: SAVE_VERSION, savedAt: '', state: s }));
    expect(back.relics).toEqual([]);
    expect(back.gear.worn).toEqual({ hat: null, coat: null, boots: null, charm: null });
  });
  it('v1 saves migrate to the v2 notice-board shape', () => {
    const st = deserialize(readFileSync(join(__dirname, 'fixtures', 'saves', 'v1.json'), 'utf8'));
    expect(st.quests.board).toEqual({ quests: [], timer: 0, serial: 0 });
    expect((st.quests as any).boardTimer).toBeUndefined();
    expect(st.coins).toBe(1530);
    expect(st.journal['kettle-carp'].caught).toBe(3);
  });
  it('v2 saves migrate to v3: the boat has no place yet and the chart starts with what was found', () => {
    const st = deserialize(readFileSync(join(__dirname, 'fixtures', 'saves', 'v2.json'), 'utf8'));
    expect(st.boats.at).toBeNull();
    expect(st.world.charted).toEqual(['hearthbay']);
    expect(st.world.onBoat).toBe(false);
    expect(st.quests.active['hb-02-supper']).toEqual({ 0: 3 });
    expect(st.quests.board.quests[0].progress).toBe(1);
    // A v2 save from after the lamp was lit already knows Gull Point.
    const lit = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'saves', 'v2.json'), 'utf8'));
    lit.state.flags.push('lamp-lit'); lit.state.boats.owned = ['skiff']; lit.state.boats.current = 'skiff';
    const st2 = deserialize(JSON.stringify(lit));
    expect(st2.world.charted).toEqual(['hearthbay', 'gull-point']);
    expect(st2.boats.owned).toEqual(['skiff']);
    expect(st2.boats.at).toBeNull();
  });
  it('v3 saves keep the boat, the chart and being aboard', () => {
    const st = deserialize(readFileSync(join(__dirname, 'fixtures', 'saves', 'v3.json'), 'utf8'));
    expect(st.boats.at).toEqual({ x: -319, z: 28, heading: -1.5708 });
    expect(st.world.charted).toContain('kettle-isle');
    expect(st.world.onBoat).toBe(true);
  });
  it('a save from before Saltbone Reach (v6) loads with nothing changed but its number', () => {
    for (const f of ['v6.json', 'v6-finds.json']) {
      const text = readFileSync(join(__dirname, 'fixtures', 'saves', f), 'utf8');
      const was = JSON.parse(text, (_k, v) => (v === '__inf__' ? Infinity : v)).state;
      expect(was.version, f).toBe(6);
      const st = deserialize(text);
      expect(st.version, f).toBe(SAVE_VERSION);
      // Field for field what was written: no water, weather, rod or relic of the Reach arrives with the load.
      expect({ ...st, version: 6 }, f).toEqual(was);
      expect(st.world.region, f).toBe('hearthbay');
      expect(st.flags.some((x) => x === 'reached:saltbone-reach' || x === 'almanac'), f).toBe(false);
    }
  });
  it('every fixture save from every past version still loads', () => {
    const dir = join(__dirname, 'fixtures', 'saves');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const st = deserialize(readFileSync(join(dir, f), 'utf8'));
      expect(st.version, f).toBe(SAVE_VERSION);
      expect(st.gear.rod, f).toBeTruthy();
    }
  });
});

describe('unreadable saves', () => {
  it('are moved aside before a new game can save over them', async () => {
    let quarantined = 0;
    const store: SaveStore = { async read() { return { main: '{broken', backup: 'also broken' }; }, async write() {}, async quarantine() { quarantined++; } };
    const r = await loadGame(store);
    expect(r.source).toBe('new');
    expect(quarantined).toBe(1);
    expect(r.warning).toMatch(/kept aside/);
  });
  it('a main save that cannot be read is kept aside when the backup is played from, and the backup is left where it is', async () => {
    const good = serialize(Object.assign(newGame(1), { coins: 77 }));
    const asked: (string | undefined)[] = [];
    const r = await loadGame({ async read() { return { main: '{half a sa', backup: good }; }, async write() {}, async quarantine(only) { asked.push(only); } });
    expect(r.source).toBe('backup');
    expect(r.state.coins).toBe(77);
    expect(asked).toEqual(['main']);
    expect(r.warning).toMatch(/restored the backup.*kept aside/);
    // A store that cannot keep files aside still loads the backup, and says only what it did.
    const plain = await loadGame(mem('{half a sa', good));
    expect(plain.source).toBe('backup');
    expect(plain.warning).toMatch(/restored the backup\.$/);
    // And one whose keeping-aside fails does not lose the backup with it.
    const failing = await loadGame({ async read() { return { main: '{half a sa', backup: good }; }, async write() {}, async quarantine() { throw new Error('disk full'); } });
    expect(failing.source).toBe('backup');
    expect(failing.state.coins).toBe(77);
  });
  it('the browser store keeps aside only what it is asked to, and the next save does not rotate over the good backup', async () => {
    const box = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => { box.set(k, v); }, removeItem: (k: string) => { box.delete(k); } };
    try {
      const store = localStorageStore('t.save');
      const good = serialize(Object.assign(newGame(1), { coins: 77 }));
      box.set('t.save', '{half a sa'); box.set('t.save.bak', good);
      const r = await loadGame(store);
      expect(r.source).toBe('backup');
      expect(box.has('t.save')).toBe(false);
      expect(box.get('t.save.bak')).toBe(good);
      const aside = [...box.keys()].filter((k) => k.startsWith('t.save.corrupt-'));
      expect(aside.length).toBe(1);
      expect(box.get(aside[0])).toBe('{half a sa');
      // The first autosave after that: the backup is still the good copy, and the unreadable file is still aside.
      const next = serialize(Object.assign(r.state, { coins: 78 }));
      await store.write(next);
      expect(box.get('t.save')).toBe(next);
      expect(box.get('t.save.bak')).toBe(good);
      expect(box.get(aside[0])).toBe('{half a sa');
      // Both unreadable: both are kept aside.
      box.clear(); box.set('t.save', '{a'); box.set('t.save.bak', '{b');
      expect((await loadGame(store)).source).toBe('new');
      expect([...box.keys()].filter((k) => k.includes('.corrupt-')).length).toBe(2);
      expect(box.has('t.save') || box.has('t.save.bak')).toBe(false);
    } finally { delete (globalThis as any).localStorage; }
  });
  it('are not quarantined when there was simply no save', async () => {
    let quarantined = 0;
    const r = await loadGame({ async read() { return { main: null, backup: null }; }, async write() {}, async quarantine() { quarantined++; } });
    expect(r.source).toBe('new');
    expect(quarantined).toBe(0);
    expect(r.warning).toBeUndefined();
  });
  it('looksReadable tells a save from junk', () => {
    expect(looksReadable(serialize(newGame(1)))).toBe(true);
    expect(looksReadable('{broken')).toBe(false);
    expect(looksReadable('{"format":"something-else"}')).toBe(false);
  });
});
