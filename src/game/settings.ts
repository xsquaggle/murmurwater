/**
 * Player settings (separate from the save, so a reset save keeps your keybinds).
 * Electron stores them in userData/settings.json; the browser build uses localStorage.
 */
import type { Quality } from '../render/renderer';
import { DEFAULT_BINDINGS, type Action } from './input';

export interface Settings {
  version: 1;
  quality: Quality;
  windowMode: 'windowed' | 'fullscreen';
  resolution: [number, number];
  volumes: { master: number; music: number; sfx: number; voice: number; ambience: number };
  sensitivity: number;
  invertY: boolean;
  uiScale: number;
  shake: number;
  subtitles: boolean;
  bindings: Record<Action, string[]>;
}

export const RESOLUTIONS: [number, number][] = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]];

export function defaultSettings(): Settings {
  return {
    version: 1, quality: 'high', windowMode: 'windowed', resolution: [1600, 900],
    volumes: { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9, ambience: 0.6 },
    sensitivity: 1, invertY: false, uiScale: 1, shake: 1, subtitles: true,
    bindings: structuredClone(DEFAULT_BINDINGS),
  };
}

/** Merges stored settings over the defaults so new options appear with sane values. */
export function parseSettings(text: string | null): Settings {
  const d = defaultSettings();
  if (!text) return d;
  try {
    const s = JSON.parse(text);
    return {
      ...d, ...s,
      volumes: { ...d.volumes, ...(s.volumes ?? {}) },
      bindings: { ...d.bindings, ...(s.bindings ?? {}) },
    };
  } catch { return d; }
}

export async function loadSettings(): Promise<Settings> {
  try {
    if (window.mwNative) return parseSettings(await window.mwNative.readSettings());
    return parseSettings(localStorage.getItem('murmurwater.settings'));
  } catch { return defaultSettings(); }
}

export async function saveSettings(s: Settings) {
  const text = JSON.stringify(s, null, 2);
  try {
    if (window.mwNative) await window.mwNative.writeSettings(text);
    else localStorage.setItem('murmurwater.settings', text);
  } catch (e) { console.error('settings save failed', e); }
}

/** Human-readable key names for the rebinding screen. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Mouse0: 'Left mouse', Mouse1: 'Middle mouse', Mouse2: 'Right mouse', Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter',
  };
  return map[code] ?? code;
}
