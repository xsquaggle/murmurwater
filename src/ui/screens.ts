/**
 * Menus and conversations: dialogue box, Mara's shop, the notice board, the satchel (hold, gear,
 * journal, quests), pause and settings. Plain DOM; the game supplies a UiHost to act on choices.
 */
import { BAITS, FISH, REGIONS_BY_ID, RODS, fish as fishDef, fishHint, onShelf } from '../core/content';
import { RHYTHM, fmt, rarityIndex } from '../core/economy';
import {
  COLLECTIONS, CREEL, ECHO_UPGRADES, LURES, LURES_BY_ID, POTS, SETS, SLOTS, TUNING, WEARABLES, WEARABLES_BY_ID, collectionProgress, creel, creelNext, potPrice, potUpgradeCost,
  setPieces, tuneCost, tunedRod, type PotUpgrade, type Stats,
} from '../core/gear';
import { BELL_FLAG, canRing, coinsToNextEcho, echoCost, echoRank, echoesFor, startCoins, turnings, unsoldValue } from '../core/bell';
import { potInterval, potsInHand } from '../core/pots';
import { BOARD, BOATS, BOATS_BY_ID, QUESTS, boardOpen, count, currentGoal, describeRewards, npc, objectiveProgress, objectiveTarget, questStatus, shortName } from '../core/quests';
import { aboard, ashore, basket, berths, crewProgress, hired } from '../core/crew';
import { PEARLS, giftText, pearlsFree, pearlsSet, relicGift, shelf, shelfOpen } from '../core/relics';
import { boatOnOffer } from '../core/gear';
import type { GameState } from '../core/state';
import type { GearAction } from '../game/trade';
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
const NPC_COLORS: Record<string, string> = { mara: '#C25F55', pell: '#4C5A66', wick: '#E86F6F', calloway: '#8E8A4E', 'packet-box': '#8A6A42', hollis: '#6F8A7C', oake: '#3A4E72' };

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
    // The initial of the name they go by, not of a title (Mister Hollis is H).
    this.portrait.textContent = shortName(conv.npc).split(' ').pop()![0];
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
  /** Buy, tune, put on, spend Echoes. Returns whether anything changed. */
  act(a: GearAction): boolean;
  /** Ring the Drowned Bell (the screen closes and the tide turns). */
  ringBell(): void;
  acceptBoard(id: string): void;
  abandonBoard(id: string): void;
  applySettings(changed: (keyof Settings)[]): void;
  quit(): void;
  close(): void;
  canQuit: boolean;
  /** What the player's gear adds up to right now. */
  stats(): Stats;
  /** Everything the chart shows, as of now. */
  chart(): ChartView;
  /** Fast travel: sail the boat to a mooring. */
  sailTo(mooring: string): void;
  /** Pell's boatyard: pay for a boat he has to offer, or change to the other one (the screen closes). */
  buyBoat(id: string): void;
  takeBoat(id: string): void;
  /** What a deckhand is doing right now, in words. */
  handState(id: string): string;
}

export type ScreenKind = 'shop' | 'board' | 'hold' | 'gear' | 'journal' | 'quests' | 'shelf' | 'echoes' | 'crew' | 'bell' | 'pause' | 'settings' | 'chart' | 'boatyard';
type ShopTab = 'rods' | 'tackle' | 'clothes' | 'pots';

export class Screens {
  readonly root: HTMLElement;
  private card: HTMLElement;
  current: ScreenKind | null = null;
  private rebinding: { action: Action; slot: number } | null = null;
  private selectedFish: string | null = null;
  private shopTab: ShopTab = 'rods';

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
    else if (k === 'hold' || k === 'gear' || k === 'journal' || k === 'quests' || k === 'shelf' || k === 'echoes' || k === 'crew') this.renderSatchel(k);
    else if (k === 'boatyard') this.renderBoatyard();
    else if (k === 'bell') this.renderBell();
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
      ...(v.elsewhere ?? []).map((r) => el('div', { class: 'chart-place far' },
        el('div', { class: 'item-top' }, el('b', {}, r.name), el('span', { class: 'chart-far' }, 'Across the fog')),
        ...r.moorings.map((m) => el('div', { class: 'item-top chart-far-row' }, el('span', {}, m.name),
          el('button', { class: 'btn gold', disabled: !v.from, onclick: () => this.host.sailTo(m.id) }, 'Sail there'))))),
      ...(v.storms?.length ? [el('div', { class: 'chart-almanac' }, el('div', { class: 'item-top' }, el('b', {}, 'The almanac'), el('span', { class: 'muted' }, 'Storms here keep hours')),
        ...v.storms.map((st) => el('div', { class: 'chart-storm' + (st.on ? ' on' : '') }, el('div', { class: 'item-top' }, el('b', {}, st.name), st.on ? el('span', { class: 'chart-here' }, 'Blowing now') : null),
          el('div', { class: 'item-desc' }, `${st.when} ${st.note}`))))] : []),
      el('p', { class: 'muted chart-edge' }, v.hint));
    this.card.append(el('div', { class: 'chart-wrap' }, canvas, list));
  }

  // ---- shop
  /** A button that does something to the gear and redraws the screen. */
  private btn(label: string, a: GearAction, o: { gold?: boolean; disabled?: boolean; cls?: string } = {}) {
    return el('button', { class: `btn${o.gold ? ' gold' : ''}${o.cls ? ' ' + o.cls : ''}`, disabled: o.disabled, onclick: () => { this.host.act(a); this.render(); } }, label);
  }
  private pips(n: number, max: number) { return el('span', { class: 'pips', title: `${n} of ${max}` }, ...Array.from({ length: max }, (_, i) => el('i', { class: i < n ? 'on' : '' }))); }

  private renderShop() {
    const s = this.host.state, st = this.host.stats();
    this.card.append(this.header('Mara’s Good Shelf'));
    const tabs: [ShopTab, string][] = [['rods', 'Rods and bait'], ['tackle', 'Lures and creel'], ['clothes', 'Clothes']];
    if (s.flags.includes('pots-open')) tabs.push(['pots', 'Lantern Pots']);
    if (!tabs.some(([k]) => k === this.shopTab)) this.shopTab = 'rods';
    this.card.append(el('div', { class: 'shop-bar' },
      el('div', { class: 'sc-coins' }, `◉ ${fmt(s.coins)}`),
      el('div', { class: 'sc-tabs' }, ...tabs.map(([k, label]) => el('button', { class: 'sc-tab' + (k === this.shopTab ? ' on' : ''), onclick: () => { this.shopTab = k; this.render(); } }, label)))));
    const stat = (label: string, v: number, max: number) => el('div', { class: 'stat' }, el('span', {}, label), el('div', { class: 'stat-bar' }, el('i', { style: `width:${Math.min(100, (v / max) * 100)}%` })));
    const buy = (price: number, a: GearAction) => this.btn(`Buy ◉ ${fmt(price)}`, a, { gold: true, disabled: s.coins < price });
    let left: HTMLElement, right: HTMLElement;

    if (this.shopTab === 'rods') {
      left = el('div', { class: 'shop-col' }, el('h3', {}, 'Rods'), ...RODS.filter((r) => onShelf(s.flags, r) || s.gear.rods.includes(r.id)).map((r) => {
        const owned = s.gear.rods.includes(r.id), equipped = s.gear.rod === r.id, lvl = s.gear.rodLevels[r.id] ?? 0, t = owned ? tunedRod(s, r.id) : r;
        const main = equipped ? el('button', { class: 'btn ghost', disabled: true }, 'In hand')
          : owned ? this.btn('Use this', { type: 'equipRod', id: r.id })
          : buy(r.price, { type: 'buyRod', id: r.id });
        const cost = owned ? tuneCost(s, r.id, st) : null;
        return el('div', { class: 'item' + (equipped ? ' sel' : '') },
          el('div', { class: 'item-top' }, el('b', {}, r.name, lvl ? el('span', { class: 'plus' }, `+${lvl}`) : null), main),
          el('div', { class: 'item-desc' }, r.desc),
          el('div', { class: 'stats' }, stat('Reach', t.reach, 48), stat('Power', t.power, 7), stat('Control', t.control, 2.8), stat('Luck', t.luck, 0.8)),
          owned ? el('div', { class: 'tune' }, el('span', {}, 'Tuning'), this.pips(lvl, TUNING.maxLevel),
            cost !== null ? this.btn(`Tune ◉ ${fmt(cost)}`, { type: 'tune', id: r.id }, { gold: true, disabled: s.coins < cost, cls: 'small' }) : el('span', { class: 'muted' }, 'As good as she gets')) : null);
      }));
      right = el('div', { class: 'shop-col' }, el('h3', {}, 'Bait'), ...BAITS.filter((b) => onShelf(s.flags, b) || (s.gear.baits[b.id] ?? 0) > 0).map((b) => {
        const have = s.gear.baits[b.id] ?? 0, equipped = s.gear.bait === b.id;
        const likes = Object.keys(b.affinity).map((id) => fishDef(id).name).join(', ');
        return el('div', { class: 'item' + (equipped ? ' sel' : '') },
          el('div', { class: 'item-top' }, el('b', {}, b.name), el('span', { class: 'have' }, have === Infinity ? '∞' : `× ${have}`)),
          el('div', { class: 'item-blurb' }, b.blurb),
          el('div', { class: 'item-desc' }, b.desc + (likes ? ` Favoured by: ${likes}.` : '')),
          el('div', { class: 'item-btns' },
            b.price > 0 ? this.btn(`10 for ◉ ${b.price * 10}`, { type: 'buyBait', id: b.id, n: 10 }, { gold: true, disabled: s.coins < b.price * 10 }) : null,
            b.price > 0 ? this.btn(`50 for ◉ ${b.price * 50}`, { type: 'buyBait', id: b.id, n: 50 }, { gold: true, disabled: s.coins < b.price * 50 }) : null,
            equipped ? el('button', { class: 'btn ghost', disabled: true }, 'On the hook') : this.btn('Use this', { type: 'equipBait', id: b.id }, { disabled: have <= 0 })));
      }));
    } else if (this.shopTab === 'tackle') {
      left = el('div', { class: 'shop-col' }, el('h3', {}, 'Lures'),
        el('p', { class: 'muted' }, 'A lure rides the line above the bait. One at a time, and it never wears out.'),
        ...LURES.filter((l) => (l.price !== undefined && onShelf(s.flags, l)) || s.gear.lures.includes(l.id)).map((l) => {
          const owned = s.gear.lures.includes(l.id), on = s.gear.lure === l.id;
          return el('div', { class: 'item' + (on ? ' sel' : '') },
            el('div', { class: 'item-top' }, el('b', {}, l.name), on ? el('button', { class: 'btn ghost', disabled: true }, 'On the line') : owned ? this.btn('Use this', { type: 'equipLure', id: l.id }) : buy(l.price!, { type: 'buyLure', id: l.id })),
            el('div', { class: 'item-blurb' }, l.blurb), el('div', { class: 'item-desc' }, l.desc));
        }));
      const have = creel(s), next = creelNext(s);
      right = el('div', { class: 'shop-col' }, el('h3', {}, 'Creel'),
        el('p', { class: 'muted' }, 'What you carry your catch in. A better one holds more, and fish kept well sell for more.'),
        el('div', { class: 'item sel' }, el('div', { class: 'item-top' }, el('b', {}, have.name), el('button', { class: 'btn ghost', disabled: true }, 'Yours')),
          el('div', { class: 'item-blurb' }, `${have.slots} slots` + (have.value ? ` · fish sell for ${Math.round(have.value * 100)}% more` : ''))),
        next ? el('div', { class: 'item' }, el('div', { class: 'item-top' }, el('b', {}, next.name), buy(next.price, { type: 'buyCreel' })),
          el('div', { class: 'item-blurb' }, `${next.slots} slots · fish sell for ${Math.round(next.value * 100)}% more`),
          el('div', { class: 'item-desc' }, `${CREEL.levels.length - s.gear.creel - 1 ? `${CREEL.levels.length - s.gear.creel - 1} better still after this one.` : 'The best there is.'}`))
          : el('p', { class: 'muted' }, 'There is no better creel than the one you have.'));
    } else if (this.shopTab === 'clothes') {
      const cards = WEARABLES.filter((w) => w.price !== undefined && (onShelf(s.flags, w) || s.gear.wearables.includes(w.id))).map((w) => {
        const owned = s.gear.wearables.includes(w.id), on = s.gear.worn[w.slot] === w.id;
        return el('div', { class: 'item' + (on ? ' sel' : '') },
          el('div', { class: 'item-top' }, el('b', {}, w.name, el('span', { class: 'slot-tag' }, w.slot)), on ? el('button', { class: 'btn ghost', disabled: true }, 'Wearing') : owned ? this.btn('Put on', { type: 'wear', id: w.id }) : buy(w.price!, { type: 'buyWearable', id: w.id })),
          el('div', { class: 'item-blurb' }, w.blurb), el('div', { class: 'item-desc' }, w.desc));
      });
      left = el('div', { class: 'shop-col' }, el('h3', {}, 'Clothes'), ...cards.filter((_, i) => i % 2 === 0));
      right = el('div', { class: 'shop-col' }, el('h3', {}, ' '), ...cards.filter((_, i) => i % 2 === 1),
        el('p', { class: 'muted' }, 'One hat, one coat, one pair of boots, one charm. The keeper’s own things are not for sale. They turn up.'));
    } else {
      const price = potPrice(s);
      left = el('div', { class: 'shop-col' }, el('h3', {}, 'Lantern Pots'),
        el('p', { class: 'muted' }, `A pot fishes on its own while you fish, traps only fish from your journal, and stops when it is full. Each one traps a fish about every ${Math.round(potInterval(st))} seconds, holds ${st.potCapacity}, and its fish sell for ${Math.round(st.potValue * 100)}% of a hand-caught one.`),
        el('div', { class: 'item sel' }, el('div', { class: 'item-top' }, el('b', {}, `Your pots: ${st.potCount}`), el('span', { class: 'have' }, `${s.pots.placed.length} in the water`)),
          el('div', { class: 'item-desc' }, `${potsInHand(s, st)} in hand, ready to set.`)),
        price !== null ? el('div', { class: 'item' }, el('div', { class: 'item-top' }, el('b', {}, 'Another Lantern Pot'), buy(price, { type: 'buyPot' })),
          el('div', { class: 'item-blurb' }, 'One more pot in the water'), el('div', { class: 'item-desc' }, 'Wicker, a lamp, and a line long enough for anywhere you would want to leave it.'))
          : el('p', { class: 'muted' }, 'That is every pot Mara has. More would need somebody who remembers how they were made.'));
      right = el('div', { class: 'shop-col' }, el('h3', {}, 'For the pots'), ...(Object.keys(POTS.upgrades) as PotUpgrade[]).map((k) => {
        const u = POTS.upgrades[k], lvl = s.pots.levels[k], cost = potUpgradeCost(s, k);
        return el('div', { class: 'item' },
          el('div', { class: 'item-top' }, el('b', {}, u.name), cost !== null ? buy(cost, { type: 'potUpgrade', k }) : el('span', { class: 'muted' }, 'As good as it gets')),
          el('div', { class: 'item-blurb' }, u.blurb), el('div', { class: 'tune' }, el('span', {}, 'Level'), this.pips(lvl, u.max)));
      }));
    }
    this.card.append(el('div', { class: 'shop-cols' }, left, right));
  }

  // ---- Pell's boatyard
  private renderBoatyard() {
    const s = this.host.state;
    this.card.append(this.header('Pell’s Boatyard'));
    this.card.append(el('div', { class: 'shop-bar' }, el('div', { class: 'sc-coins' }, `◉ ${fmt(s.coins)}`),
      el('p', { class: 'muted' }, 'One boat in the water at a time. Pell minds the other, and brings her round when you ask.')));
    const stat = (label: string, v: number, max: number, text: string) => el('div', { class: 'stat' }, el('span', {}, label), el('div', { class: 'stat-bar' }, el('i', { style: `width:${Math.min(100, (v / max) * 100)}%` })), el('em', {}, text));
    const cards = BOATS.filter((b) => s.boats.owned.includes(b.id) || boatOnOffer(s, b.id)).map((b) => {
      const owned = s.boats.owned.includes(b.id), current = s.boats.current === b.id;
      const main = current ? el('button', { class: 'btn ghost', disabled: true }, 'In the water')
        : owned ? el('button', { class: 'btn', onclick: () => this.host.takeBoat(b.id) }, 'Take her out')
        : el('button', { class: 'btn gold', disabled: s.coins < b.price, onclick: () => this.host.buyBoat(b.id) }, `Fit her out ◉ ${fmt(b.price)}`);
      return el('div', { class: 'item boat' + (current ? ' sel' : '') },
        el('div', { class: 'item-top' }, el('b', {}, b.name), main),
        el('div', { class: 'item-desc' }, b.desc),
        el('div', { class: 'stats' },
          stat('Speed', b.speed, 12, `${(b.speed * 1.94).toFixed(0)} kn`), stat('Handiness', b.turn, 1.2, b.turn >= 0.9 ? 'quick' : 'steady'),
          stat('Hold', b.hold, 20, `+${b.hold} fish`), stat('Draws', b.draft, 1, `${b.draft.toFixed(1)} m`)),
        el('div', { class: 'item-blurb' }, `${b.crew === 1 ? 'One berth' : `${b.crew} berths`} for crew · crew basket of ${b.crewHold}`),
        !owned && s.coins < b.price ? el('div', { class: 'muted' }, `◉ ${fmt(b.price - s.coins)} short.`) : null);
    });
    this.card.append(el('div', { class: 'boat-cols' }, ...cards));
    const signed = hired(s);
    if (signed.length) {
      const waiting = ashore(s).map((c) => c.name);
      this.card.append(el('p', { class: 'muted' }, waiting.length ? `${waiting.join(' and ')} ${waiting.length === 1 ? 'has' : 'have'} no berth in the boat you have in the water.` : 'Your crew sail in whichever boat you take.'));
    }
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
  private renderSatchel(kind: 'hold' | 'gear' | 'journal' | 'quests' | 'shelf' | 'echoes' | 'crew') {
    const s = this.host.state, st = this.host.stats();
    const tabs: [ScreenKind, string][] = [['hold', 'Hold'], ['gear', 'Gear'], ['journal', 'Journal'], ['quests', 'Quests']];
    // The Shelf is there from the first relic, or the first word of one still in the water.
    if (shelfOpen(s) || kind === 'shelf') tabs.push(['shelf', 'Shelf']);
    if (s.crew.hired.length) tabs.push(['crew', 'Crew']);
    if (s.flags.includes(BELL_FLAG) || s.lifetime.echoes > 0) tabs.push(['echoes', 'Echoes']);
    this.card.append(this.header('Satchel', tabs));
    if (kind === 'hold') {
      const total = s.hold.reduce((a, c) => a + c.value, 0);
      // A hold brought over from a bigger boat can be over what this one carries: every fish is shown, and said.
      const room = this.host.stats().hold, over = s.hold.length > room;
      this.card.append(el('p', { class: 'muted' }, s.hold.length ? `${s.hold.length} ${over ? `fish in a hold for ${room}` : `of ${room} slots`} · worth ◉ ${fmt(total)} at Mara’s stall` : 'Your hold is empty. The sea is not.'));
      if (over) this.card.append(el('p', { class: 'muted hold-also' }, 'They came over from the bigger boat. Nothing more goes in until there is room.'));
      // What rides beside the hold is said before it: a big hold fills the page.
      if (s.pots.hold.length) {
        const worth = s.pots.hold.reduce((a, c) => a + c.value, 0);
        this.card.append(el('p', { class: 'muted hold-also' }, el('b', {}, 'From the pots: '), `${s.pots.hold.length} fish hauled from your Lantern Pots, worth ◉ ${fmt(worth)}. They ride in the pot basket, not your hold, and Mara takes them with the rest.`));
      }
      if (s.crew.hold.length) {
        const bk = basket(s);
        this.card.append(el('p', { class: 'muted hold-also' }, el('b', {}, 'From the crew: '), `${bk.fish} of ${bk.room} fish in the crew basket, worth ◉ ${fmt(bk.value)}. Mara takes them with the rest.`));
      }
      this.card.append(el('div', { class: 'hold-grid' }, ...Array.from({ length: Math.max(room, s.hold.length) }, (_, i) => {
        const c = s.hold[i];
        if (!c) return el('div', { class: 'slot empty' });
        const f = fishDef(c.fishId);
        return el('div', { class: `slot r${rarityIndex(c.fishId)}` }, el('b', {}, f.name), el('span', {}, `${c.weight.toFixed(2)} kg`), c.trait ? el('em', {}, c.trait) : null, el('span', { class: 'val' }, `◉ ${fmt(c.value)}`));
      })));
    } else if (kind === 'gear') {
      this.renderGear(s, st);
    } else if (kind === 'shelf') {
      this.renderShelf(s);
    } else if (kind === 'echoes') {
      this.renderEchoes(s);
    } else if (kind === 'crew') {
      this.renderCrew(s);
    } else if (kind === 'journal') {
      const region = FISH.filter((f) => f.region === s.world.region);
      const found = region.filter((f) => s.journal[f.id]).length;
      const sel = this.selectedFish && s.journal[this.selectedFish] ? this.selectedFish : null;
      this.card.append(el('p', { class: 'muted' }, `${REGIONS_BY_ID.get(s.world.region)?.name ?? 'These waters'}: ${found} of ${region.length} found`));
      for (const c of COLLECTIONS.filter((x) => x.region === s.world.region)) {
        const p = collectionProgress(s, c), done = s.flags.includes(`page:${c.id}`);
        this.card.append(el('p', { class: 'page-line' + (done ? ' done' : '') }, done ? `✓ ${c.name} is complete.` : `${c.name}: ${p.found} of ${p.total}. ${c.tease}`));
      }
      const grid = el('div', { class: 'journal-grid' }, ...region.map((f) => {
        const j = s.journal[f.id];
        const r = RARITIES_IDX(f.id);
        return el('button', { class: `jcard r${r}` + (j ? '' : ' unknown') + (sel === f.id ? ' sel' : ''), onclick: () => { if (j) { this.selectedFish = f.id; this.render(); } } },
          el('div', { class: 'jname' }, j ? f.name : '???'),
          el('div', { class: 'jrar' }, RARITY_NAMES[r]),
          j ? el('div', { class: 'jstat' }, `× ${j.caught} · best ${j.bestWeight.toFixed(2)} kg`) : el('div', { class: 'jstat' }, fishHint(f, s.flags)));
      }));
      this.card.append(grid);
      if (sel) { const f = fishDef(sel); const j = s.journal[sel]; this.card.append(el('div', { class: 'jdetail' }, el('b', {}, f.name), el('p', {}, f.lore), j.traits.length ? el('p', { class: 'muted' }, 'Strange ones seen: ' + j.traits.join(', ')) : null)); }
    } else {
      const active = QUESTS.filter((q) => ['active', 'ready'].includes(questStatus(s, q.id)));
      const done = QUESTS.filter((q) => questStatus(s, q.id) === 'done');
      this.card.append(el('h3', {}, 'In progress'));
      if (!active.length) { const who = currentGoal(s).npc; this.card.append(el('p', { class: 'muted' }, who ? `Nothing right now. ${npc(who).name} probably wants a word.` : 'Nothing right now.')); }
      for (const q of active) {
        const ready = questStatus(s, q.id) === 'ready';
        this.card.append(el('div', { class: 'qcard' + (ready ? ' ready' : '') },
          el('div', { class: 'item-top' }, el('b', {}, q.title), el('span', { class: 'muted' }, npc(q.giver).name)),
          el('div', { class: 'item-desc' }, q.summary),
          ...q.objectives.map((o, i) => el('div', { class: 'qobj' }, `${objectiveProgress(s, q, i) >= objectiveTarget(o) ? '✓' : '○'} ${o.label}` + (objectiveTarget(o) > 1 ? ` (${count(objectiveProgress(s, q, i))}/${count(objectiveTarget(o))})` : ''))),
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

  // ---- crew
  private renderCrew(s: GameState) {
    const bk = basket(s), boat = s.boats.current ? BOATS_BY_ID.get(s.boats.current) : null, on = aboard(s);
    this.card.append(el('p', { class: 'muted' }, 'Your crew fish from the boat while she lies still and the game is running: only fish that are in your journal, of the water under her. Their catch goes in the crew basket, and they stop when it is full.'));
    this.card.append(el('div', { class: 'sum' },
      el('div', { class: 'sum-i' }, el('span', {}, 'Boat'), el('b', {}, boat?.name ?? 'None')),
      el('div', { class: 'sum-i' }, el('span', {}, 'Berths'), el('b', {}, `${on.length} of ${berths(s)} taken`)),
      el('div', { class: 'sum-i' + (bk.full ? ' warn' : '') }, el('span', {}, 'Crew basket'), el('b', {}, `${bk.fish}/${bk.room}${bk.full ? ' · full' : ''}`)),
      el('div', { class: 'sum-i' }, el('span', {}, 'Worth'), el('b', {}, `◉ ${fmt(bk.value)}`))));
    for (const c of hired(s)) {
      const t = s.crew.tally[c.id] ?? { fish: 0, coins: 0, eaten: 0 }, isOn = on.some((x) => x.id === c.id);
      const what = c.eatsEvery ? `A fish about every ${c.interval} seconds, worth ${Math.round(c.value * 100)}% of yours. Eats one in ${c.eatsEvery}.` : `A fish about every ${c.interval} seconds, worth ${Math.round(c.value * 100)}% of yours.`;
      this.card.append(el('div', { class: 'item hand' + (isOn ? ' sel' : '') },
        el('div', { class: 'item-top' }, el('b', {}, c.name, el('span', { class: 'slot-tag' }, c.role)), el('span', { class: 'have' }, this.host.handState(c.id))),
        el('div', { class: 'item-blurb' }, c.blurb),
        el('div', { class: 'item-desc' }, `${c.desc} ${what}`),
        isOn ? el('div', { class: 'bar' }, el('i', { style: `width:${Math.round(crewProgress(s, c) * 100)}%` })) : null,
        el('div', { class: 'muted' }, `Landed ${fmt(t.fish)} fish for ◉ ${fmt(t.coins)}` + (c.eatsEvery ? ` · ate ${fmt(t.eaten)}` : ''))));
    }
  }

  // ---- gear
  private renderGear(s: GameState, st: Stats) {
    const act = (a: GearAction) => () => { this.host.act(a); this.render(); };
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    // What it all adds up to, in the numbers the game plays with.
    const sums: [string, string][] = [
      ['Reach', `${st.rod.reach.toFixed(1)} m`], ['Power', st.rod.power.toFixed(2)], ['Control', st.rod.control.toFixed(2)],
      ['Luck', pct(st.rod.luck + st.luck)], ['Fish sell for', pct(st.value - 1)], ['Hold', `${st.hold} slots`],
      ['Rhythm', `up to ×${(1 + st.rhythmCap * RHYTHM.perStack).toFixed(2)}`],
    ];
    // Waits are divided by the bite speed, so 1.3 is 23% sooner, not 30%.
    if (st.biteSpeed !== 1) sums.push(['Bites come', `${Math.round((1 - 1 / st.biteSpeed) * 100)}% sooner`]);
    if (st.biteWindow !== 1) sums.push(['Time to hook', pct(st.biteWindow - 1)]);
    // The size bonus closes part of the gap between a fish's weight and the heaviest of its kind.
    if (st.size > 0) sums.push(['Bigger fish', `${Math.round(st.size * 100)}% nearer the biggest`]);
    if (st.strange > 0.031) sums.push(['Strange fish', `${(st.strange * 100).toFixed(0)}% of catches`]);
    this.card.append(el('div', { class: 'sum' }, ...sums.map(([k, v]) => el('div', { class: 'sum-i' }, el('span', {}, k), el('b', {}, v)))));

    const rods = s.gear.rods.map((id) => RODS.find((r) => r.id === id)!).filter(Boolean);
    this.card.append(el('h3', {}, 'Rod'), el('div', { class: 'gear-row' }, ...rods.map((r) => el('button', { class: 'chip' + (s.gear.rod === r.id ? ' on' : ''), onclick: act({ type: 'equipRod', id: r.id }) }, r.name + ((s.gear.rodLevels[r.id] ?? 0) ? ` +${s.gear.rodLevels[r.id]}` : '')))));
    const baits = BAITS.filter((b) => (s.gear.baits[b.id] ?? 0) > 0);
    this.card.append(el('h3', {}, 'Bait'), el('div', { class: 'gear-row' }, ...baits.map((b) => el('button', { class: 'chip' + (s.gear.bait === b.id ? ' on' : ''), title: b.blurb, onclick: act({ type: 'equipBait', id: b.id }) }, `${b.name} ${s.gear.baits[b.id] === Infinity ? '∞' : '× ' + s.gear.baits[b.id]}`))),
      el('p', { class: 'muted tip' }, BAITS.find((b) => b.id === s.gear.bait)?.blurb ?? ''));
    if (s.gear.lures.length) {
      const on = s.gear.lure ? LURES_BY_ID.get(s.gear.lure) : null;
      this.card.append(el('h3', {}, 'Lure'), el('div', { class: 'gear-row' },
        ...s.gear.lures.map((id) => el('button', { class: 'chip' + (s.gear.lure === id ? ' on' : ''), onclick: act({ type: 'equipLure', id }) }, LURES_BY_ID.get(id)?.name ?? id)),
        el('button', { class: 'chip' + (s.gear.lure === null ? ' on' : ''), onclick: act({ type: 'equipLure', id: null }) }, 'None')),
        el('p', { class: 'muted tip' }, on ? `${on.blurb}. ${on.desc}` : 'Nothing on the line but bait.'));
    }
    if (s.gear.wearables.length) {
      this.card.append(el('h3', {}, 'Wearing'), el('div', { class: 'wear' }, ...SLOTS.map((slot) => {
        const mine = s.gear.wearables.map((id) => WEARABLES_BY_ID.get(id)!).filter((w) => w && w.slot === slot), on = s.gear.worn[slot] ? WEARABLES_BY_ID.get(s.gear.worn[slot]!) : null;
        return el('div', { class: 'wear-slot' }, el('div', { class: 'wear-k' }, slot),
          mine.length ? el('div', { class: 'gear-row' }, ...mine.map((w) => el('button', { class: 'chip' + (on?.id === w.id ? ' on' : ''), title: w.desc, onclick: act({ type: 'wear', id: w.id }) }, w.name)))
            : el('div', { class: 'muted' }, 'Nothing yet'),
          el('div', { class: 'muted tip' }, on ? on.blurb : mine.length ? 'Bare. Click one to put it on.' : ''));
      })));
      for (const set of SETS) {
        const owned = WEARABLES.filter((w) => w.set === set.id && s.gear.wearables.includes(w.id)).length, total = WEARABLES.filter((w) => w.set === set.id).length;
        if (!owned) continue;
        const worn = setPieces(s, set.id);
        this.card.append(el('div', { class: 'set' }, el('b', {}, set.name), el('span', { class: 'muted' }, ` ${worn} of ${total} worn · ${owned} found`),
          ...set.bonuses.map((b) => el('div', { class: 'qobj' + (worn >= b.pieces ? ' got' : '') }, `${worn >= b.pieces ? '✓' : '○'} ${b.pieces} worn: ${b.blurb}`))));
      }
    }
    if (st.potCount > 0) {
      this.card.append(el('h3', {}, 'Lantern Pots'), el('p', { class: 'muted' },
        `${st.potCount} pot${st.potCount === 1 ? '' : 's'}: ${s.pots.placed.length} in the water, ${potsInHand(s, st)} in hand. Each traps a fish about every ${Math.round(potInterval(st))} seconds while you play, and holds ${st.potCapacity}.`));
    }
    // Relics stand on the Shelf, a page of their own, once there is one (or word of one).
    this.card.append(el('h3', {}, 'Relics'), el('p', { class: 'muted' }, shelfOpen(s)
      ? `${s.relics.length ? `${s.relics.length} on the Keeper’s Shelf` : 'None yet, but something is said of one'}: see the Shelf page.`
      : 'Nothing strange in your pockets. Yet.'));
  }

  // ---- the Keeper's Shelf
  /**
   * Every relic of the waters reached has a place: the thing itself with its two hollows for Moonpearls, what
   * is said of it while it is still in the water, or a bare place nobody has spoken of yet.
   */
  private renderShelf(s: GameState) {
    const places = shelf(s), found = places.filter((p) => p.state === 'found').length;
    const set = pearlsSet(s), free = pearlsFree(s), have = set + free;
    const half = PEARLS.each === 0.5 ? 'half as much again' : `${Math.round(PEARLS.each * 100)}% more`;
    this.card.append(el('div', { class: 'shelf-head' },
      el('div', { class: 'shelf-n' }, el('span', { class: 'pearl' }), String(free)),
      el('div', {}, el('b', {}, `${found} of ${places.length} places on the Keeper’s Shelf are filled.`),
        el('div', { class: 'muted' }, have ? `${have} Moonpearl${have === 1 ? '' : 's'}: ${set} set, ${free} in hand.` : 'No Moonpearls yet. Sea chests hold them, and some jobs pay in them.'),
        el('div', { class: 'muted' }, `A pearl set beside a relic makes it give ${half}. Each relic has ${PEARLS.hollows} hollows, and a pearl can be lifted out and set somewhere else.`))));
    const regions = [...new Set(places.map((p) => p.relic.region))];
    for (const region of regions) {
      if (regions.length > 1) this.card.append(el('h3', {}, REGIONS_BY_ID.get(region)?.name ?? region));
      this.card.append(el('div', { class: 'shelf-grid' }, ...places.filter((p) => p.relic.region === region).map(({ relic: r, state }) => {
        if (state === 'empty') return el('div', { class: 'place empty' }, el('div', { class: 'place-q' }, '·'), el('div', { class: 'item-desc' }, 'A bare place. Nobody has spoken of what stands here.'));
        if (state === 'rumour') {
          return el('div', { class: 'place rumour' },
            el('div', { class: 'item-top' }, el('b', {}, r.where ? 'Still in the water' : 'Not yet given'), el('span', { class: 'place-q' }, '?')),
            el('div', { class: 'item-desc' }, r.hint.text));
        }
        const n = s.pearls[r.id] ?? 0;
        const hollows = Array.from({ length: PEARLS.hollows }, (_, i) => i < n
          ? el('button', { class: 'hollow on', title: 'Lift this pearl out', onclick: () => { this.host.act({ type: 'liftPearl', id: r.id }); this.render(); } })
          : el('button', { class: 'hollow', title: free ? 'Set a pearl here' : 'No pearl in hand', disabled: !free, onclick: () => { this.host.act({ type: 'setPearl', id: r.id }); this.render(); } }));
        return el('div', { class: 'place found' + (n ? ' lit' : '') },
          el('div', { class: 'item-top' }, el('b', {}, r.name), el('span', { class: 'hollows' }, ...hollows)),
          el('div', { class: 'item-blurb' }, giftText(r.effect, relicGift(s, r.id))),
          el('div', { class: 'item-desc' }, r.lore));
      })));
    }
  }

  // ---- Echoes
  private renderEchoes(s: GameState) {
    const n = turnings(s), now = echoesFor(s);
    this.card.append(el('div', { class: 'echo-head' },
      el('div', { class: 'echo-n' }, el('span', {}, '✺'), String(s.echoes)),
      el('div', {}, el('b', {}, n ? `The tide has turned ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}.` : 'The tide has not turned yet.'),
        el('div', { class: 'muted' }, now >= 1 ? `The Drowned Bell would give ✺ ${now} more if you rang it now.` : `The Bell has nothing for you yet: ◉ ${fmt(coinsToNextEcho(s))} more earned and it will.`),
        el('div', { class: 'muted' }, 'Echoes are what the sea gives back. What they buy is never forgotten.'))));
    this.card.append(el('div', { class: 'echo-grid' }, ...ECHO_UPGRADES.map((u) => {
      const rank = echoRank(s, u.id), cost = echoCost(s, u.id), max = u.cost.length;
      const blurb = u.startCoins ? (cost !== null ? `Begin each tide with ◉ ${fmt(u.startCoins[rank])}` + (rank ? ` (now ◉ ${fmt(startCoins(s))})` : '') : `Begin each tide with ◉ ${fmt(startCoins(s))}`) : u.blurb;
      // A thing (the Fog Lamp) is bought once and is then simply there: no ranks to count.
      return el('div', { class: 'item echo' + (rank ? ' has' : '') + (u.thing ? ' thing' : '') },
        el('div', { class: 'item-top' }, el('b', {}, u.name), cost !== null
          ? this.btn(`✺ ${cost}`, { type: 'buyEcho', id: u.id }, { cls: 'echo-btn', disabled: s.echoes < cost })
          : el('span', { class: 'muted' }, u.thing ? 'On the bow' : 'Whole')),
        el('div', { class: 'item-blurb' }, blurb + (rank && !u.startCoins && !u.thing ? ` · ${rank} time${rank === 1 ? '' : 's'} over` : '')),
        el('div', { class: 'item-desc' }, u.desc), ...(u.thing ? [] : [this.pips(rank, max)]));
    })));
  }

  // ---- the Drowned Bell
  private renderBell() {
    const s = this.host.state, give = echoesFor(s), can = canRing(s), catchWorth = unsoldValue(s);
    this.card.append(this.header('The Drowned Bell'));
    this.card.append(el('p', { class: 'bell-lead' }, 'Ring it, and the tide turns. Your coins go back to the sea, and so does what they did to your gear: the tuning, the creel, the bait. The islands forget, and the morning starts over on the Hearthbay dock. What the tide carried comes back to you as Echoes.'));
    const li = (items: string[]) => el('ul', {}, ...items.map((t) => el('li', {}, t)));
    this.card.append(el('div', { class: 'bell-cols' },
      el('div', { class: 'bell-col takes' }, el('h3', {}, 'The tide takes'), li([
        `Your coins (◉ ${fmt(s.coins)} now${catchWorth ? `, plus ◉ ${fmt(catchWorth)} for the catch in your hold and baskets, which is sold first` : ''})`,
        'Rod tuning', 'Your creel, back to the basket', 'Bait', 'Pot upgrades, and pots in the water come home', 'Notice board jobs and your Rhythm'])),
      el('div', { class: 'bell-col keeps' }, el('h3', {}, 'You keep'), li([
        'Rods, lures, clothes and the keeper’s things', s.boats.owned.length > 1 ? 'Your boats' : 'The skiff', ...(s.crew.hired.length ? ['Your crew'] : []), 'Your Lantern Pots', 'Relics and Moonpearls', 'The journal, the chart and the story', 'Echoes, and everything they have bought']))));
    this.card.append(el('div', { class: 'bell-give' + (can ? ' can' : '') }, can
      ? el('div', {}, 'The Bell will give ', el('b', {}, `✺ ${give} Echo${give === 1 ? '' : 'es'}`), el('div', { class: 'muted' }, `The next one is ◉ ${fmt(coinsToNextEcho(s))} of fish away. Waiting never loses any.`))
      : el('div', {}, 'The bay has not given enough yet.', el('div', { class: 'muted' }, `◉ ${fmt(coinsToNextEcho(s))} more earned, and the Bell will have an Echo for you.`))));
    this.card.append(el('div', { class: 'bell-btns' },
      el('button', { class: 'btn big gold', disabled: !can, onclick: () => this.host.ringBell() }, 'Ring the Bell'),
      el('button', { class: 'btn big ghost', onclick: () => this.host.close() }, 'Not yet')));
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
