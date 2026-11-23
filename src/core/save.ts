/**
 * Versioned saves. Format on disk: {"format":"murmurwater-save","version":N,"savedAt":ISO,"state":{...}}.
 * Every version bump adds a migration MIGRATIONS[n] that turns a version-n state into version n+1.
 * Loading tries the main save, then the backup. A save from a newer game version is never overwritten.
 */
import { SAVE_VERSION, newGame, type GameState } from './state';
import boatsJson from '../data/boats.json';

const KNOWN_BOATS = new Set((boatsJson.boats as { id: string }[]).map((b) => b.id));

export const SAVE_FORMAT = 'murmurwater-save';

type Migration = (s: any) => any;
/** MIGRATIONS[n] upgrades a version-n state to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: the notice board became an object holding generated jobs and its own timer.
  1: (s) => {
    const q = s.quests ?? {};
    s.quests = { active: q.active ?? {}, done: q.done ?? [], board: { quests: [], timer: 0, serial: 0 } };
    return s;
  },
  // v2 → v3: boats can be sailed. The boat gets a place in the water (null = put it at the landing on load),
  // and the chart remembers the places found so far.
  2: (s) => {
    s.boats = { owned: [], current: null, upgrades: {}, ...(s.boats ?? {}), at: null };
    const w = (s.world ??= {});
    const flags: string[] = s.flags ?? [];
    w.charted = ['hearthbay', ...(flags.includes('lamp-lit') || flags.includes('hb-lighthouse-lit') ? ['gull-point'] : [])];
    w.onBoat = false;
    return s;
  },
  // v3 → v4: the hold's size comes from gear (the creel, a coat, the boat) instead of being saved, the one old
  // Echo upgrade becomes the first ranks of Tidewise. Pots, the creel level and the Echoes paid out so far
  // are new fields and take their defaults.
  3: (s) => {
    delete s.holdCapacity;
    const up = (s.echoUpgrades ??= {});
    if (up.value) { up.tidewise = Math.min(10, up.value); delete up.value; }
    return s;
  },
  // v4 → v5: deckhands. Nobody has signed on in an older save, and the crew basket is empty. A boat that was
  // "current" without being owned (never written by the game, but cheap to mend) is put right, because the
  // crew's berths are counted from the current boat: a boat the game knows is the keeper's from now on (they
  // may be sitting in it), and one it does not know gives way to one they own.
  4: (s) => {
    s.crew = { hired: [], hold: [], clocks: {}, tally: {} };
    const b = (s.boats ??= { owned: [], current: null, upgrades: {}, at: null });
    b.owned ??= [];
    if (b.current && !b.owned.includes(b.current)) {
      if (KNOWN_BOATS.has(b.current)) b.owned.push(b.current); else b.current = b.owned[0] ?? null;
    }
    return s;
  },
  // v5 → v6: things fished up, and Moonpearls set beside relics on the Shelf. In an older save nothing has come
  // up yet and no pearl is set; the pearls the keeper was given are all free to set. Finds wait on a dozen fish
  // landed over all time, so a keeper who has those meets them at once, and the rumours their story has already
  // earned are passed on together the first time the game looks (core/relics.ts newRumours).
  5: (s) => {
    s.finds = { casts: 0, dry: 0, crates: 0, chests: 0, near: {} };
    s.pearls = {};
    return s;
  },
};

// JSON can't hold Infinity (the free breadcrumb stack); encode it.
const INF = '__inf__';
const replacer = (_k: string, v: unknown) => (v === Infinity ? INF : v);
const reviver = (_k: string, v: unknown) => (v === INF ? Infinity : v);

export function serialize(state: GameState, now = new Date()): string {
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: now.toISOString(), state }, replacer);
}

export class SaveError extends Error {
  constructor(message: string, readonly kind: 'corrupt' | 'future' | 'format') { super(message); }
}

export function deserialize(text: string): GameState {
  let doc: any;
  try { doc = JSON.parse(text, reviver); } catch { throw new SaveError('Save file is not valid JSON', 'corrupt'); }
  if (!doc || doc.format !== SAVE_FORMAT || typeof doc.version !== 'number' || typeof doc.state !== 'object') {
    throw new SaveError('Not a Murmurwater save', 'format');
  }
  if (doc.version > SAVE_VERSION) throw new SaveError(`Save is from a newer version (${doc.version})`, 'future');
  let s = doc.state;
  for (let v = doc.version; v < SAVE_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (!m) throw new SaveError(`No migration from v${v}`, 'format');
    s = m(s);
    s.version = v + 1;
  }
  return fillDefaults(s);
}

/** Adds any fields missing from older/partial saves without touching existing values. */
function fillDefaults(s: any): GameState {
  const d: any = newGame(s.seed ?? 1);
  const merge = (a: any, b: any) => {
    for (const k of Object.keys(b)) {
      if (a[k] === undefined) a[k] = b[k];
      else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
    }
  };
  merge(s, d);
  s.version = SAVE_VERSION;
  return s as GameState;
}

export interface SaveStore {
  read(): Promise<{ main: string | null; backup: string | null }>;
  write(text: string): Promise<void>;
  /**
   * Moves unreadable save files aside so the next autosave can't overwrite them: both of them, or with `'main'`
   * only the main save (its backup was readable, is being played from, and stays where it is).
   */
  quarantine?(only?: 'main'): Promise<void>;
}

export interface LoadResult { state: GameState; source: 'main' | 'backup' | 'new'; warning?: string }

export async function loadGame(store: SaveStore): Promise<LoadResult> {
  const { main, backup } = await store.read();
  let warning: string | undefined;
  if (main) {
    try { return { state: deserialize(main), source: 'main' }; }
    catch (e) {
      if (e instanceof SaveError && e.kind === 'future') throw e; // never clobber a newer save
      warning = `Main save unreadable (${(e as Error).message}); restored the backup.`;
    }
  }
  if (backup) {
    let state: GameState | null = null;
    try { state = deserialize(backup); }
    catch (e) { if (e instanceof SaveError && e.kind === 'future') throw e; }
    if (state) {
      // The main save could not be read and the game goes on from the backup. The unreadable file may still hold
      // something a person could get back, so it is kept aside before the first autosave is written in its place.
      if (main && warning) {
        try { if (store.quarantine) { await store.quarantine('main'); warning += ' The unreadable file has been kept aside (save.corrupt-…).'; } } catch { /* the backup still loads */ }
      }
      return { state, source: 'backup', warning };
    }
  }
  if (!main && !backup) return { state: newGame(), source: 'new' };
  // Neither file could be read. Keep them aside before the new game starts saving over them.
  let kept = false;
  try { await store.quarantine?.(); kept = !!store.quarantine; } catch { /* nothing more we can do */ }
  return { state: newGame(), source: 'new', warning: kept ? 'Your save could not be read. It has been kept aside (save.corrupt-…) and a new game started.' : 'Saves were unreadable; started a new game.' };
}

/** True when a save file parses; an unreadable main save must never be rotated over a good backup. */
export function looksReadable(text: string): boolean {
  try { const d = JSON.parse(text); return !!d && d.format === SAVE_FORMAT; } catch { return false; }
}

/** Browser fallback store (dev builds). Electron uses window.mwNative (atomic file + .bak). */
export function localStorageStore(key = 'murmurwater.save'): SaveStore {
  return {
    async read() { return { main: localStorage.getItem(key), backup: localStorage.getItem(key + '.bak') }; },
    async write(text) { const prev = localStorage.getItem(key); if (prev && looksReadable(prev)) localStorage.setItem(key + '.bak', prev); localStorage.setItem(key, text); },
    async quarantine(only) {
      const stamp = Date.now();
      for (const k of only === 'main' ? [key] : [key, key + '.bak']) { const v = localStorage.getItem(k); if (v !== null) { localStorage.setItem(`${k}.corrupt-${stamp}`, v); localStorage.removeItem(k); } }
    },
  };
}
