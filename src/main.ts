import { Game } from './game/game';
import type { Quality } from './render/renderer';
import { loadGame, localStorageStore, type SaveStore } from './core/save';
import { newGame } from './core/state';

declare global {
  interface Window {
    mwNative?: {
      readSave(): Promise<{ main: string | null; backup: string | null }>;
      writeSave(text: string): Promise<boolean>;
      readSettings(): Promise<string | null>;
      writeSettings(text: string): Promise<boolean>;
      setWindowMode(mode: string): Promise<void>;
      setResolution(w: number, h: number): Promise<void>;
      quit(): Promise<void>;
    };
    __MW__?: any;
  }
}

const params = new URLSearchParams(location.search);
const quality = (params.get('quality') as Quality) ?? 'high';

const nativeStore = (): SaveStore => ({
  read: () => window.mwNative!.readSave(),
  write: async (t) => { await window.mwNative!.writeSave(t); },
});
const store: SaveStore = window.mwNative ? nativeStore() : localStorageStore(params.has('fresh') ? 'murmurwater.test' : 'murmurwater.save');

async function boot() {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  let loaded;
  try { loaded = await loadGame(store); }
  catch (e) {
    ui.innerHTML = `<div class="fatal">This save was made by a newer version of Murmurwater. Update the game to keep playing — your save has not been touched.<br><small>${(e as Error).message}</small></div>`;
    return;
  }
  const state = params.has('fresh') ? newGame(1234) : loaded.state;
  if (params.has('hour')) state.hour = Number(params.get('hour'));
  const game = new Game(state, canvas, ui, quality, store);
  if (loaded.warning) game.hud.toast(loaded.warning, 'bad');

  // Title card: a click starts audio (browser rule) and captures the mouse.
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = `<div class="title-inner"><div class="title-name">Murmurwater</div><div class="title-sub">the sea is listening</div><div class="title-go">Click to begin</div></div>`;
  ui.appendChild(title);
  document.body.classList.add('titled');
  const begin = () => {
    title.classList.add('out');
    document.body.classList.remove('titled');
    setTimeout(() => title.remove(), 900);
    game.audio.start();
    game.input.requestLock();
  };
  if (params.has('notitle')) { title.remove(); document.body.classList.remove('titled'); } else title.addEventListener('click', begin, { once: true });
  canvas.addEventListener('click', () => { game.audio.start(); game.input.requestLock(); });

  game.start();
  window.__MW__ = {
    game,
    get frames() { return game.frames; },
    get state() { return game.state; },
    get phase() { return game.session.phase; },
    renderer: game.renderer,
    buildMs: 0,
    frameStats() { return { p50: 0, p99: 0 }; },
  };
}
void boot();
