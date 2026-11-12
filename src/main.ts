import { Game } from './game/game';
import type { Quality } from './render/renderer';
import { loadGame, localStorageStore, type SaveStore } from './core/save';
import { newGame } from './core/state';
import { assets } from './render/assets';
import { makeFish } from './render/fish-models';
import { loadSettings } from './game/settings';
import * as quests from './core/quests';

declare global {
  interface Window {
    mwNative?: {
      readSave(): Promise<{ main: string | null; backup: string | null }>;
      writeSave(text: string): Promise<boolean>;
      quarantineSave?(): Promise<string[]>;
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

const nativeStore = (): SaveStore => ({
  read: () => window.mwNative!.readSave(),
  write: async (t) => { await window.mwNative!.writeSave(t); },
  quarantine: async () => { await window.mwNative!.quarantineSave?.(); },
});
// ?fresh starts a new test game in a separate slot; ?keepfresh reloads that test slot (for the story bot).
const testSlot = params.has('fresh') || params.has('keepfresh');
const store: SaveStore = window.mwNative ? nativeStore() : localStorageStore(testSlot ? 'murmurwater.test' : 'murmurwater.save');

async function boot() {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  let loaded;
  try { loaded = await loadGame(store); }
  catch (e) {
    ui.innerHTML = `<div class="fatal">This save was made by a newer version of Murmurwater. Update the game to keep playing — your save has not been touched.<br><small>${(e as Error).message}</small></div>`;
    return;
  }
  // Models load behind a small progress line; missing ones fall back to stand-ins.
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Listening for the tide… 0%';
  ui.appendChild(loading);
  await assets.loadAll((p) => { loading.textContent = `Listening for the tide… ${Math.round(p * 100)}%`; });
  loading.remove();
  const state = params.has('fresh') ? newGame(1234) : loaded.state;
  if (params.has('hour')) state.hour = Number(params.get('hour'));
  const settings = await loadSettings();
  if (params.get('quality')) settings.quality = params.get('quality') as Quality;
  const game = new Game(state, canvas, ui, settings.quality, store, settings);
  if (loaded.warning) game.hud.toast(loaded.warning, 'bad');
  // Screenshot hooks: ?cam=x,y,z&look=x,y,z fixes the camera; ?at=x,z places the player.
  const vec = (k: string) => params.get(k)?.split(',').map(Number);
  const cam = vec('cam'), look = vec('look'), at = vec('at');
  if (cam && look) game.debugCam = { pos: game.pos.clone().set(cam[0], cam[1], cam[2]), look: game.pos.clone().set(look[0], look[1], look[2]) };
  if (at) { game.pos.set(at[0], game.groundAt(at[0], at[1]) ?? 1.4, at[1]); if (at[2] !== undefined) game.yaw = at[2]; }

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
  // Clicking the view captures the mouse, but not from under a conversation or a menu.
  canvas.addEventListener('click', () => { game.audio.start(); if (!game.town.blocking) game.input.requestLock(); });

  game.start();
  window.__MW__ = {
    game,
    get frames() { return game.frames; },
    get state() { return game.state; },
    get phase() { return game.session.phase; },
    renderer: game.renderer,
    makeFish,
    get assetsMissing() { return [...assets.missing]; },
    quests,
    buildMs: 0,
    frameStats() { return game.perf?.stats() ?? { fps: 0, p50: 0, p99: 0, cpu: 0 }; },
  };
}
void boot();
