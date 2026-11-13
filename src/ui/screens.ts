/**
 * Menus and conversations: dialogue box, Mara's shop, the notice board, the satchel (hold, gear,
 * journal, quests), pause and settings. Plain DOM; the game supplies a UiHost to act on choices.
 */
import { BAITS, FISH, RODS, fish as fishDef } from '../core/content';
import { fmt, rarityIndex } from '../core/economy';
import { BOARD, QUESTS, RELICS_BY_ID, boardOpen, describeRewards, npc, objectiveProgress, objectiveTarget, questStatus } from '../core/quests';
import type { GameState } from '../core/state';
import { ACTION_LABELS, DEFAULT_BINDINGS, type Action } from '../game/input';
import { RESOLUTIONS, keyLabel, type Settings } from '../game/settings';
import type { Choice, Conversation, Line, TalkAction } from '../game/talk';
import type { Quality } from '../render/renderer';
import { drawChart, type ChartView } from './chart';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
export function el(tag: string, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Uncanny'];
const NPC_COLORS: Record<string, string> = { mara: '#C25F55', pell: '#4C5A66', wick: '#E86F6F' };

// ------------------------------------------------------------------ dialogue

export class Dialogue {
  readonly root: HTMLElement;
  private nameEl: HTMLElement; private roleEl: HTMLElement; private textEl: HTMLElement; private portrait: HTMLElement;
  private choicesEl: HTMLElement; private more: HTMLElement;
  private conv: Conversation | null = null;
  private i = 0; private shown = 0; private full = '';
  private stopVoice: (() => void) | null = null;
  private onChoice: (a: TalkAction) => void = () => {};
  private onLinesDone: () => void = () => {};
  private gen = 0;
  isOpen = false;

  constructor(parent: HTMLElement, private playVoice: (line: Line) => () => void) {
    this.root = el('div', { class: 'dlg' });
    this.portrait = el('div', { class: 'dlg-portrait' });
    this.nameEl = el('div', { class: 'dlg-name' });
    this.roleEl = el('div', { class: 'dlg-role' });
    this.textEl = el('div', { class: 'dlg-text' });
    this.more = el('div', { class: 'dlg-more' }, '▾');
    this.choicesEl = el('div', { class: 'dlg-choices' });
    this.root.append(this.portrait, el('div', { class: 'dlg-body' }, el('div', { class: 'dlg-head' }, this.nameEl, this.roleEl), this.textEl, this.choicesEl), this.more);
    this.root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.advance(); });
    parent.appendChild(this.root);
  }

  open(conv: Conversation, onChoice: (a: TalkAction) => void, onLinesDone: () => void) {
    this.conv = conv; this.onChoice = onChoice; this.onLinesDone = onLinesDone;
    this.isOpen = true; this.i = 0; this.gen++;
    const n = npc(conv.npc);
    this.portrait.textContent = n.name[0];
    this.portrait.style.background = NPC_COLORS[conv.npc] ?? '#7A6390';
    this.nameEl.textContent = n.name;
    this.roleEl.textContent = n.role;
    this.root.classList.add('on');
    this.showLine();
  }

  /** Replace the conversation without closing (e.g. a hand-in followed by the next quest). */
  continueWith(conv: Conversation, onLinesDone: () => void = () => {}) { this.open(conv, this.onChoice, onLinesDone); }

  private showLine() {
    this.stopVoice?.(); this.stopVoice = null;
    this.choicesEl.innerHTML = '';
    const c = this.conv!;
    if (this.i >= c.lines.length) { this.showChoices(); return; }
    const line = c.lines[this.i];
    this.full = line.text; this.shown = 0; this.textEl.textContent = '';
    this.more.classList.remove('on');
    this.stopVoice = this.playVoice(line);
  }

  private showChoices() {
    const c = this.conv!;
    this.more.classList.remove('on');
    const done = this.onLinesDone; this.onLinesDone = () => {};
    const gen = this.gen;
    done();
    if (!this.conv || gen !== this.gen) return; // closed, or a follow-up conversation took over
    const choices = this.conv.choices;
    if (!choices.length) { this.close(); return; }
    if (!c.lines.length) this.textEl.textContent = '';
    choices.forEach((ch: Choice, k) => {
      this.choicesEl.append(el('button', { class: 'dlg-choice', onclick: () => this.pick(k) }, el('kbd', {}, String(k + 1)), ch.label));
    });
  }

  pick(k: number) {
    const ch = this.conv?.choices[k];
    if (!ch || this.choicesEl.childElementCount === 0) return;
    this.onChoice(ch.action);
  }

  advance() {
    if (!this.isOpen || !this.conv) return;
    if (this.i < this.conv.lines.length && this.shown < this.full.length) { this.shown = this.full.length; this.textEl.textContent = this.full; this.more.classList.add('on'); return; }
    if (this.i < this.conv.lines.length) { this.i++; this.showLine(); }
  }

  update(dt: number) {
    if (!this.isOpen || !this.conv || this.i >= this.conv.lines.length) return;
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * 48);
      this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
      if (this.shown >= this.full.length) this.more.classList.add('on');
    }
  }

  close() {
    this.stopVoice?.(); this.stopVoice = null;
    this.isOpen = false; this.conv = null;
    this.root.classList.remove('on');
  }
}

// ------------------------------------------------------------------ screens

export interface UiHost {
  state: GameState;
  settings: Settings;
  buyRod(id: string): void;
  equipRod(id: string): void;
  buyBait(id: string, n: number): void;
  equipBait(id: string): void;
  acceptBoard(id: string): void;
  abandonBoard(id: string): void;
  applySettings(changed: (keyof Settings)[]): void;
  quit(): void;
  close(): void;
  canQuit: boolean;
  /** Everything the chart shows, as of now. */
  chart(): ChartView;
  /** Fast travel: sail the boat to a mooring. */
  sailTo(mooring: string): void;
}

export type ScreenKind = 'shop' | 'board' | 'hold' | 'gear' | 'journal' | 'quests' | 'pause' | 'settings' | 'chart';

export class Screens {
  readonly root: HTMLElement;
  private card: HTMLElement;
  current: ScreenKind | null = null;
  private rebinding: { action: Action; slot: number } | null = null;
  private selectedFish: string | null = null;

  constructor(parent: HTMLElement, private host: UiHost) {
    this.root = el('div', { class: 'screen' });
    this.card = el('div', { class: 'screen-card' });
    this.root.append(this.card);
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.host.close(); });
    parent.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (!this.rebinding) return;
      // Nothing else may see this key: not the screen shortcuts (Esc, J, Tab), not gameplay.
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code !== 'Escape') this.bind(e.code);
      else { this.rebinding = null; this.render(); }
    }, true);
    window.addEventListener('mousedown', (e) => {
      if (!this.rebinding || !(e.target as HTMLElement).closest('.screen')) return;
      if ((e.target as HTMLElement).closest('.rebind')) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.bind('Mouse' + e.button);
    }, true);
  }

  get isOpen() { return this.current !== null; }
  get capturingKeys() { return this.rebinding !== null; }

  open(kind: ScreenKind) { this.current = kind; this.root.classList.add('on'); this.render(); }
  close() { this.current = null; this.rebinding = null; this.root.classList.remove('on'); }
  refresh() { if (this.current) this.render(); }

  private header(title: string, tabs?: [ScreenKind, string][]) {
    return el('div', { class: 'sc-head' },
      el('div', { class: 'sc-title' }, title),
      tabs ? el('div', { class: 'sc-tabs' }, ...tabs.map(([k, label]) => el('button', { class: 'sc-tab' + (k === this.current ? ' on' : ''), onclick: () => this.open(k) }, label))) : null,
      el('button', { class: 'sc-x', title: 'Close', onclick: () => this.host.close() }, '✕'));
  }

  private render() {
    const k = this.current;
    this.card.innerHTML = '';
    this.card.className = 'screen-card sc-' + k;
    if (k === 'shop') this.renderShop();
    else if (k === 'board') this.renderBoard();
    else if (k === 'hold' || k === 'gear' || k === 'journal' || k === 'quests') this.renderSatchel(k);
    else if (k === 'pause') this.renderPause();
    else if (k === 'settings') this.renderSettings();
    else if (k === 'chart') this.renderChart();
  }

  // ---- chart
  private renderChart() {
    const v = this.host.chart();
    this.card.append(this.header(v.title));
    const canvas = el('canvas', { class: 'chart-map' }) as HTMLCanvasElement;
    drawChart(canvas, v, 640);
    const known = v.places.filter((p) => p.known), hidden = v.places.length - known.length;
    const list = el('div', { class: 'chart-list' },
      el('p', { class: 'muted' }, v.from
        ? 'She lies at a mooring. Pick another and she will carry you there.'
        : 'Bring her to a mooring you know, with the rod put away, to set a course from the chart.'),
      ...known.map((p) => {
        const m = v.moorings.find((x) => x.place === p.id && x.known);
        const here = !!m && m.id === v.from;
        return el('div', { class: 'chart-place' + (here ? ' here' : '') },
          el('div', { class: 'item-top' }, el('b', {}, p.name),
            here ? el('span', { class: 'chart-here' }, 'Moored here')
              : m ? el('button', { class: 'btn gold', disabled: !v.from, onclick: () => this.host.sailTo(m.id) }, 'Sail here') : null),
          el('div', { class: 'item-desc' }, p.note + (m ? '' : ' No mooring: sail her there yourself.')));
      }),
      hidden ? el('p', { class: 'muted chart-unknown' }, `${hidden} place${hidden === 1 ? '' : 's'} still uncharted. Sail close and they go on the chart.`) : el('p', { class: 'muted chart-unknown' }, 'Every place in these waters is on the chart.'),
      el('p', { class: 'muted chart-edge' }, v.hint));
    this.card.append(el('div', { class: 'chart-wrap' }, canvas, list));
  }

  // ---- shop
  private renderShop() {
    const s = this.host.state;
    this.card.append(this.header('Mara’s Good Shelf'));
    const coins = el('div', { class: 'sc-coins' }, `◉ ${fmt(s.coins)}`);
    const stat = (label: string, v: number, max: number) => el('div', { class: 'stat' }, el('span', {}, label), el('div', { class: 'stat-bar' }, el('i', { style: `width:${Math.min(100, (v / max) * 100)}%` })));
    const rods = el('div', { class: 'shop-col' }, el('h3', {}, 'Rods'), ...RODS.map((r) => {
      const owned = s.gear.rods.includes(r.id), equipped = s.gear.rod === r.id;
      const btn = equipped ? el('button', { class: 'btn ghost', disabled: true }, 'In hand')
        : owned ? el('button', { class: 'btn', onclick: () => { this.host.equipRod(r.id); this.render(); } }, 'Use this')
        : el('button', { class: 'btn gold', disabled: s.coins < r.price, onclick: () => { this.host.buyRod(r.id); this.render(); } }, `Buy ◉ ${fmt(r.price)}`);
      return el('div', { class: 'item' + (equipped ? ' sel' : '') },
        el('div', { class: 'item-top' }, el('b', {}, r.name), btn),
        el('div', { class: 'item-desc' }, r.desc),
        el('div', { class: 'stats' }, stat('Reach', r.reach, 40), stat('Power', r.power, 5), stat('Control', r.control, 2), stat('Luck', r.luck, 0.4)));
    }));
    const baits = el('div', { class: 'shop-col' }, el('h3', {}, 'Bait'), ...BAITS.map((b) => {
      const have = s.gear.baits[b.id] ?? 0, equipped = s.gear.bait === b.id;
      const likes = Object.keys(b.affinity).map((id) => fishDef(id).name).join(', ');
      return el('div', { class: 'item' + (equipped ? ' sel' : '') },
        el('div', { class: 'item-top' }, el('b', {}, b.name), el('span', { class: 'have' }, have === Infinity ? '∞' : `× ${have}`)),
        el('div', { class: 'item-desc' }, b.desc + (likes ? ` Favoured by: ${likes}.` : '')),
        el('div', { class: 'item-btns' },
          b.price > 0 ? el('button', { class: 'btn gold', disabled: s.coins < b.price * 10, onclick: () => { this.host.buyBait(b.id, 10); this.render(); } }, `10 for ◉ ${b.price * 10}`) : null,
          b.price > 0 ? el('button', { class: 'btn gold', disabled: s.coins < b.price * 50, onclick: () => { this.host.buyBait(b.id, 50); this.render(); } }, `50 for ◉ ${b.price * 50}`) : null,
          equipped ? el('button', { class: 'btn ghost', disabled: true }, 'On the hook') : el('button', { class: 'btn', disabled: have <= 0, onclick: () => { this.host.equipBait(b.id); this.render(); } }, 'Use this')));
    }));
    this.card.append(coins, el('div', { class: 'shop-cols' }, rods, baits));
  }

  // ---- notice board
  private renderBoard() {
    const s = this.host.state;
    this.card.append(this.header('Notice Board'));
    if (!boardOpen(s)) { this.card.append(el('p', { class: 'muted' }, 'Just a few curling notes about a lost cat. Nothing for you yet.')); return; }
    const b = s.quests.board;
    const mins = Math.max(0, Math.ceil(b.timer / 60));
    this.card.append(el('p', { class: 'muted' }, `Folk pin odd jobs here. Fresh notices in about ${mins} minute${mins === 1 ? '' : 's'} of fishing.`));
    this.card.append(el('div', { class: 'notes' }, ...b.quests.map((q, i) => {
      const t = objectiveTarget(q.objective);
      return el('div', { class: 'note' + (q.done ? ' done' : q.accepted ? ' taken' : ''), style: `transform: rotate(${[-1.6, 1.2, -0.6][i % 3]}deg)` },
        el('div', { class: 'note-title' }, q.title),
        el('div', { class: 'note-obj' }, q.objective.label),
        q.accepted ? el('div', { class: 'bar' }, el('i', { style: `width:${(q.progress / t) * 100}%` })) : null,
        el('div', { class: 'note-reward' }, 'Pays: ' + describeRewards(q.reward).join(', ')),
        q.done ? el('div', { class: 'stamp' }, 'Paid') : q.accepted ? el('div', { class: 'note-state' }, `${q.progress}/${t}`)
          : el('button', { class: 'btn gold', onclick: () => { this.host.acceptBoard(q.id); this.render(); } }, 'Take this job'),
        q.accepted && !q.done ? el('button', { class: 'btn ghost', onclick: () => { this.host.abandonBoard(q.id); this.render(); } }, 'Give it up') : null);
    })));
    void BOARD;
  }

  // ---- satchel
  private renderSatchel(kind: 'hold' | 'gear' | 'journal' | 'quests') {
    const s = this.host.state;
    this.card.append(this.header('Satchel', [['hold', 'Hold'], ['gear', 'Gear'], ['journal', 'Journal'], ['quests', 'Quests']]));
    if (kind === 'hold') {
      const total = s.hold.reduce((a, c) => a + c.value, 0);
      this.card.append(el('p', { class: 'muted' }, s.hold.length ? `${s.hold.length} of ${s.holdCapacity} slots · worth ◉ ${fmt(total)} at Mara’s stall` : 'Your hold is empty. The sea is not.'));
      this.card.append(el('div', { class: 'hold-grid' }, ...Array.from({ length: s.holdCapacity }, (_, i) => {
        const c = s.hold[i];
        if (!c) return el('div', { class: 'slot empty' });
        const f = fishDef(c.fishId);
        return el('div', { class: `slot r${rarityIndex(c.fishId)}` }, el('b', {}, f.name), el('span', {}, `${c.weight.toFixed(2)} kg`), c.trait ? el('em', {}, c.trait) : null, el('span', { class: 'val' }, `◉ ${fmt(c.value)}`));
      })));
    } else if (kind === 'gear') {
      const rods = s.gear.rods.map((id) => RODS.find((r) => r.id === id)!).filter(Boolean);
      this.card.append(el('h3', {}, 'Rods'), el('div', { class: 'gear-row' }, ...rods.map((r) => el('button', { class: 'chip' + (s.gear.rod === r.id ? ' on' : ''), onclick: () => { this.host.equipRod(r.id); this.render(); } }, r.name))));
      const baits = BAITS.filter((b) => (s.gear.baits[b.id] ?? 0) > 0);
      this.card.append(el('h3', {}, 'Bait'), el('div', { class: 'gear-row' }, ...baits.map((b) => el('button', { class: 'chip' + (s.gear.bait === b.id ? ' on' : ''), onclick: () => { this.host.equipBait(b.id); this.render(); } }, `${b.name} ${s.gear.baits[b.id] === Infinity ? '∞' : '× ' + s.gear.baits[b.id]}`))));
      this.card.append(el('h3', {}, 'Relics'), s.relics.length
        ? el('div', { class: 'relics' }, ...s.relics.map((id) => { const r = RELICS_BY_ID.get(id)!; return el('div', { class: 'relic' }, el('b', {}, r.name), el('div', { class: 'item-desc' }, r.lore)); }))
        : el('p', { class: 'muted' }, 'Nothing strange in your pockets. Yet.'));
    } else if (kind === 'journal') {
      const region = FISH.filter((f) => f.region === s.world.region);
      const found = region.filter((f) => s.journal[f.id]).length;
      const sel = this.selectedFish && s.journal[this.selectedFish] ? this.selectedFish : null;
      this.card.append(el('p', { class: 'muted' }, `Hearthbay: ${found} of ${region.length} found`));
      const grid = el('div', { class: 'journal-grid' }, ...region.map((f) => {
        const j = s.journal[f.id];
        const r = RARITIES_IDX(f.id);
        return el('button', { class: `jcard r${r}` + (j ? '' : ' unknown') + (sel === f.id ? ' sel' : ''), onclick: () => { if (j) { this.selectedFish = f.id; this.render(); } } },
          el('div', { class: 'jname' }, j ? f.name : '???'),
          el('div', { class: 'jrar' }, RARITY_NAMES[r]),
          j ? el('div', { class: 'jstat' }, `× ${j.caught} · best ${j.bestWeight.toFixed(2)} kg`) : el('div', { class: 'jstat' }, hintFor(f.id)));
      }));
      this.card.append(grid);
      if (sel) { const f = fishDef(sel); const j = s.journal[sel]; this.card.append(el('div', { class: 'jdetail' }, el('b', {}, f.name), el('p', {}, f.lore), j.traits.length ? el('p', { class: 'muted' }, 'Strange ones seen: ' + j.traits.join(', ')) : null)); }
    } else {
      const active = QUESTS.filter((q) => ['active', 'ready'].includes(questStatus(s, q.id)));
      const done = QUESTS.filter((q) => questStatus(s, q.id) === 'done');
      this.card.append(el('h3', {}, 'In progress'));
      if (!active.length) this.card.append(el('p', { class: 'muted' }, 'Nothing right now. Someone in Hearthbay probably wants a word.'));
      for (const q of active) {
        const ready = questStatus(s, q.id) === 'ready';
        this.card.append(el('div', { class: 'qcard' + (ready ? ' ready' : '') },
          el('div', { class: 'item-top' }, el('b', {}, q.title), el('span', { class: 'muted' }, npc(q.giver).name)),
          el('div', { class: 'item-desc' }, q.summary),
          ...q.objectives.map((o, i) => el('div', { class: 'qobj' }, `${objectiveProgress(s, q, i) >= objectiveTarget(o) ? '✓' : '○'} ${o.label}` + (objectiveTarget(o) > 1 ? ` (${objectiveProgress(s, q, i)}/${objectiveTarget(o)})` : ''))),
          ready ? el('div', { class: 'qready' }, `Return to ${npc(q.giver).name}`) : null,
          el('div', { class: 'note-reward' }, 'Reward: ' + describeRewards(q.rewards).join(', '))));
      }
      const board = s.quests.board.quests.filter((b) => b.accepted && !b.done);
      if (board.length) {
        this.card.append(el('h3', {}, 'Notice board jobs'));
        for (const b of board) this.card.append(el('div', { class: 'qobj' }, `○ ${b.objective.label} (${b.progress}/${objectiveTarget(b.objective)})`));
      }
      if (done.length) this.card.append(el('h3', {}, 'Done'), el('div', { class: 'muted' }, done.map((q) => q.title).join(' · ')));
    }
  }

  // ---- pause & settings
  private renderPause() {
    const s = this.host.state;
    const mins = Math.floor(s.playTime / 60);
    this.card.append(el('div', { class: 'pause-title' }, 'Murmurwater'), el('div', { class: 'muted center' }, `${Math.floor(mins / 60)}h ${mins % 60}m at sea · ◉ ${fmt(s.lifetime.coins)} earned`));
    const col = el('div', { class: 'pause-btns' },
      el('button', { class: 'btn big', onclick: () => this.host.close() }, 'Back to the water'),
      el('button', { class: 'btn big', onclick: () => this.open('quests') }, 'Satchel & journal'),
      el('button', { class: 'btn big', onclick: () => this.open('settings') }, 'Settings'),
      this.host.canQuit ? el('button', { class: 'btn big ghost', onclick: () => this.host.quit() }, 'Save and quit to desktop') : el('div', { class: 'muted center' }, 'Progress saves automatically.'));
    this.card.append(col, el('div', { class: 'muted center small' }, `v${__APP_VERSION__} · F3 shows performance`));
  }

  private renderSettings() {
    const st = this.host.settings;
    const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { st[k] = v; this.host.applySettings([k]); };
    this.card.append(this.header('Settings'));
    const row = (label: string, ctrl: HTMLElement, note?: string) => el('div', { class: 'set-row' }, el('label', {}, label, note ? el('small', {}, note) : null), ctrl);
    const select = <T extends string>(val: T, opts: [T, string][], on: (v: T) => void) => {
      const sel = el('select', { onchange: (e: Event) => on((e.target as HTMLSelectElement).value as T) }) as HTMLSelectElement;
      for (const [v, l] of opts) sel.append(el('option', { value: v, selected: v === val }, l));
      return sel;
    };
    const slider = (val: number, min: number, max: number, step: number, on: (v: number) => void, fmtv = (v: number) => `${Math.round(v * 100)}%`) => {
      const out = el('span', { class: 'sv' }, fmtv(val));
      const inp = el('input', { type: 'range', min, max, step, value: val, oninput: (e: Event) => { const v = Number((e.target as HTMLInputElement).value); out.textContent = fmtv(v); on(v); } });
      return el('div', { class: 'slider' }, inp, out);
    };
    const toggle = (val: boolean, on: (v: boolean) => void) => el('input', { type: 'checkbox', checked: val, onchange: (e: Event) => on((e.target as HTMLInputElement).checked) });

    const gfx = el('div', { class: 'set-group' }, el('h3', {}, 'Display'),
      row('Graphics quality', select<Quality>(st.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], (v) => set('quality', v)), 'Terrain and water detail apply after a restart'),
      window.mwNative ? row('Window', select(st.windowMode, [['windowed', 'Windowed'], ['fullscreen', 'Fullscreen (borderless)']], (v) => set('windowMode', v as Settings['windowMode']))) : null,
      window.mwNative ? row('Window size', select(st.resolution.join('x'), RESOLUTIONS.map((r) => [r.join('x'), `${r[0]} × ${r[1]}`] as [string, string]), (v) => set('resolution', v.split('x').map(Number) as [number, number])), 'Used in windowed mode') : null,
      row('Interface size', slider(st.uiScale, 0.75, 1.5, 0.05, (v) => set('uiScale', v))),
      row('Camera shake', slider(st.shake, 0, 1, 0.1, (v) => set('shake', v))));
    const audio = el('div', { class: 'set-group' }, el('h3', {}, 'Sound'),
      ...(['master', 'music', 'sfx', 'voice', 'ambience'] as const).map((k) => row({ master: 'Master', music: 'Music', sfx: 'Effects', voice: 'Voices', ambience: 'Sea and weather' }[k],
        slider(st.volumes[k], 0, 1, 0.05, (v) => { st.volumes[k] = v; this.host.applySettings(['volumes']); }))),
      row('Subtitles', toggle(st.subtitles, (v) => set('subtitles', v))));
    const ctrl = el('div', { class: 'set-group' }, el('h3', {}, 'Controls'),
      row('Mouse sensitivity', slider(st.sensitivity, 0.2, 3, 0.05, (v) => set('sensitivity', v), (v) => v.toFixed(2) + '×')),
      row('Invert vertical look', toggle(st.invertY, (v) => set('invertY', v))));
    const keys = el('div', { class: 'set-group keys' }, el('h3', {}, 'Keys'), el('p', { class: 'muted' }, 'Click a key to change it, then press the new key or mouse button. Esc cancels.'),
      ...(Object.keys(ACTION_LABELS) as Action[]).filter((a) => a !== 'pause').map((a) => el('div', { class: 'set-row' }, el('label', {}, ACTION_LABELS[a]),
        el('div', { class: 'keys-btns' }, ...[0, 1].map((slot) => {
          const code = st.bindings[a][slot];
          const busy = this.rebinding?.action === a && this.rebinding.slot === slot;
          return el('button', { class: 'rebind' + (busy ? ' busy' : ''), onclick: () => { this.rebinding = { action: a, slot }; this.render(); } }, busy ? 'Press a key…' : code ? keyLabel(code) : '—');
        })))),
      el('button', { class: 'btn ghost', onclick: () => { st.bindings = structuredClone(DEFAULTS()); this.host.applySettings(['bindings']); this.render(); } }, 'Reset keys to default'));
    this.card.append(el('div', { class: 'set-cols' }, el('div', {}, gfx, audio, ctrl), keys));
  }

  private bind(code: string) {
    const r = this.rebinding; if (!r) return;
    const st = this.host.settings;
    const list = [...st.bindings[r.action]];
    list[r.slot] = code;
    st.bindings[r.action] = list.filter(Boolean);
    this.rebinding = null;
    this.host.applySettings(['bindings']);
    this.render();
  }
}

const DEFAULTS = () => DEFAULT_BINDINGS;
const RARITIES_IDX = (id: string) => rarityIndex(id);
function hintFor(id: string): string {
  const f = fishDef(id);
  const zone = f.zones.includes('hb-dock') ? 'off the dock' : f.zones.includes('hb-teeth') ? 'near the Teeth' : f.zones.includes('hb-bay') ? 'out in the bay' : 'in open water';
  const time = f.hours ? (f.hours[0] > f.hours[1] ? 'after dark' : `between ${f.hours[0]}:00 and ${f.hours[1]}:00`) : '';
  return f.requires ? 'Something waits for a light.' : `Bites ${zone}${time ? ' ' + time : ''}`;
}
