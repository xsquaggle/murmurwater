import { Game } from './game/game';
import type { Quality } from './render/renderer';
import { deserialize, loadGame, localStorageStore, type SaveStore } from './core/save';
import { newGame } from './core/state';
import { assets } from './render/assets';
import { makeFish } from './render/fish-models';
import { loadSettings } from './game/settings';
import * as quests from './core/quests';
import { findRoute } from './core/seaways';
import { clearance } from './core/boat';
import { LANDING, hullDistance, landingSpot } from './core/landing';
import testerFinds from './data/tester/finds.json';
import testerCrew from './data/tester/crew.json';
import testerFen from './data/tester/fen.json';

declare global {
  interface Window {
    mwNative?: {
      readSave(): Promise<{ main: string | null; backup: string | null }>;
      writeSave(text: string): Promise<boolean>;
      quarantineSave?(only?: 'main'): Promise<string[]>;
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
  quarantine: async (only) => { await window.mwNative!.quarantineSave?.(only); },
});
// ?fresh starts a new test game in a separate slot; ?keepfresh reloads that test slot (for the story bot).
const testSlot = params.has('fresh') || params.has('keepfresh');
/**
 * ?tester (F8 on the title screen) is a tester's start: a save the simulator's keeper played up to the doorstep
 * of a slice (tools/tester-save.ts), for trying it without the play before it. `?tester` is the newest slice,
 * `?tester=crew` and `?tester=fen` the ones before; F8 goes through them and then back to the player's own game. A tester's start
 * reads and writes no save at all, so the player's own game is as they left it.
 */
const TESTERS = [
  { id: 'finds', save: testerFinds, note: 'Things fished up: nightfall on the home dock, the Puffin afloat, both hands aboard, four relics and three Moonpearls never set. Open the satchel\'s Shelf for the rumours; the first lies in the cove beside you.' },
  { id: 'crew', save: testerCrew, note: 'Hands aboard: the cat signed on, the wreck of the Puffin found, the price of her refit in your purse (see Pell), and a gentleman waiting on the old sea-road.' },
  { id: 'fen', save: testerFen, note: 'Mossglass Fen: the Bell rung once, the Fog Lamp on the bow, Pell\'s road job in hand.' },
];
const testerAt = params.has('tester') ? Math.max(0, TESTERS.findIndex((t) => t.id === params.get('tester'))) : -1;
const tester = testerAt >= 0;
const nowhere = (): SaveStore => ({ read: async () => ({ main: null, backup: null }), write: async () => {} });
const store: SaveStore = tester ? nowhere() : window.mwNative ? nativeStore() : localStorageStore(testSlot ? 'murmurwater.test' : 'murmurwater.save');

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
  const state = tester ? deserialize(JSON.stringify(TESTERS[testerAt].save)) : params.has('fresh') ? newGame(1234) : loaded.state;
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
  const nextTester = testerAt + 1 < TESTERS.length ? TESTERS[testerAt + 1] : null;
  const testerNote = tester ? `<div class="title-tester">A tester's start (${testerAt + 1} of ${TESTERS.length}). ${TESTERS[testerAt].note}<br>Nothing here is saved, and your own game is untouched. F8: ${nextTester ? 'the start before this one' : 'back to your own game'}.</div>` : '';
  title.innerHTML = `<div class="title-inner"><div class="title-name">Murmurwater</div><div class="title-sub">the sea is listening</div><div class="title-go">Click to begin</div>${testerNote}</div>`;
  ui.appendChild(title);
  document.body.classList.add('titled');
  // F8 on the title screen goes to the tester's starts, newest first, and then back.
  const toTester = (e: KeyboardEvent) => {
    if (e.code !== 'F8') return;
    e.preventDefault();
    location.search = !nextTester ? '' : testerAt + 1 === 0 ? '?tester' : `?tester=${nextTester.id}`;
  };
  window.addEventListener('keydown', toTester);
  const begin = () => {
    window.removeEventListener('keydown', toTester);
    title.classList.add('out');
    document.body.classList.remove('titled');
    setTimeout(() => title.remove(), 900);
    game.audio.start();
    game.input.requestLock();
    if (tester) game.hud.toast("Tester's start: nothing here is saved", 'good');
  };
  if (params.has('notitle')) { title.remove(); document.body.classList.remove('titled'); window.removeEventListener('keydown', toTester); } else title.addEventListener('click', begin, { once: true });
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
    tester,
    testerStart: tester ? TESTERS[testerAt].id : null,
    quests,
    findRoute,
    clearance,
    landingSpot, hullDistance, LANDING,
    buildMs: 0,
    frameStats() { return game.perf?.stats() ?? { fps: 0, p50: 0, p99: 0, cpu: 0 }; },
  };
}
void boot();
