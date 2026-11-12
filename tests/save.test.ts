import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, loadGame, looksReadable, serialize, SaveError, type SaveStore } from '../src/core/save';
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
