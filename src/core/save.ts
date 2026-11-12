/**
 * Versioned saves. Format on disk: {"format":"murmurwater-save","version":N,"savedAt":ISO,"state":{...}}.
 * Every version bump adds a migration MIGRATIONS[n] that turns a version-n state into version n+1.
 * Loading tries the main save, then the backup. A save from a newer game version is never overwritten.
 */
import { SAVE_VERSION, newGame, type GameState } from './state';

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
    try { return { state: deserialize(backup), source: 'backup', warning }; }
    catch (e) { if (e instanceof SaveError && e.kind === 'future') throw e; }
  }
  return { state: newGame(), source: 'new', warning: main ? 'Saves were unreadable; started a new game.' : undefined };
}

/** Browser fallback store (dev builds). Electron uses window.mwNative (atomic file + .bak). */
export function localStorageStore(key = 'murmurwater.save'): SaveStore {
  return {
    async read() { return { main: localStorage.getItem(key), backup: localStorage.getItem(key + '.bak') }; },
    async write(text) { const prev = localStorage.getItem(key); if (prev) localStorage.setItem(key + '.bak', prev); localStorage.setItem(key, text); },
  };
}
