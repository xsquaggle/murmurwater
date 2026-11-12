/**
 * Keyboard + mouse input with rebindable actions. Edges (pressed/released) are latched until consumed
 * by the fixed-step loop, so a quick click between two frames is never lost.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'sprint'
  | 'cast' | 'cancel' | 'interact' | 'journal' | 'inventory' | 'map' | 'pause' | 'steerLeft' | 'steerRight';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft'],
  cast: ['Mouse0', 'Space'], cancel: ['Mouse2', 'KeyQ'], interact: ['KeyE'],
  journal: ['KeyJ'], inventory: ['Tab', 'KeyI'], map: ['KeyM'], pause: ['Escape'],
  steerLeft: ['KeyA', 'ArrowLeft'], steerRight: ['KeyD', 'ArrowRight'],
};

export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', sprint: 'Sprint',
  cast: 'Cast / hook / reel', cancel: 'Reel in / cancel', interact: 'Talk / interact', journal: 'Journal',
  inventory: 'Inventory', map: 'Chart', pause: 'Pause', steerLeft: 'Steer fish left', steerRight: 'Steer fish right',
};

export class Input {
  bindings: Record<Action, string[]> = structuredClone(DEFAULT_BINDINGS);
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  mouseDX = 0; mouseDY = 0; wheel = 0;
  sensitivity = 1;
  invertY = false;
  locked = false;
  enabled = true;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.press(e.code);
    });
    window.addEventListener('keyup', (e) => this.release(e.code));
    el.addEventListener('mousedown', (e) => { this.press('Mouse' + e.button); });
    window.addEventListener('mouseup', (e) => this.release('Mouse' + e.button));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
    window.addEventListener('blur', () => { for (const c of this.down) this.released.add(c); this.down.clear(); });
  }

  private press(code: string) { if (!this.down.has(code)) { this.down.add(code); this.pressed.add(code); } }
  private release(code: string) { if (this.down.has(code)) { this.down.delete(code); this.released.add(code); } }

  requestLock() { if (!this.locked) this.el.requestPointerLock?.(); }
  exitLock() { if (this.locked) document.exitPointerLock?.(); }

  held(a: Action): boolean { return this.enabled && this.bindings[a].some((c) => this.down.has(c)); }
  wasPressed(a: Action): boolean { return this.enabled && this.bindings[a].some((c) => this.pressed.has(c)); }
  wasReleased(a: Action): boolean { return this.bindings[a].some((c) => this.released.has(c)); }

  /** Call once per fixed step after reading edges. */
  consumeEdges() { this.pressed.clear(); this.released.clear(); }
  consumeMouse() { const d = [this.mouseDX * this.sensitivity, this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1)]; this.mouseDX = 0; this.mouseDY = 0; return d; }

  /** Test/bot hook: synthesise input. */
  simulate(code: string, down: boolean) { down ? this.press(code) : this.release(code); }
}
