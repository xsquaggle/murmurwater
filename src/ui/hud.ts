/**
 * The in-game HUD: cast power, bite prompt, fight gauge, catch card, coins/hold, next goal, toasts.
 * Plain DOM + CSS so text is crisp at any UI scale.
 */
import { fish } from '../core/content';
import { fmt, rarityIndex } from '../core/economy';
import { FEEL, STRANGE_TRAITS, type FishingSession } from '../core/fishing';
import type { CatchItem, GameState } from '../core/state';

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Uncanny'];

const h = (tag: string, cls: string, parent?: HTMLElement, html = '') => {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

export class Hud {
  readonly root: HTMLElement;
  private coins: HTMLElement; private hold: HTMLElement; private rhythm: HTMLElement;
  private goal: HTMLElement; private goalText: HTMLElement;
  private power: HTMLElement; private powerFill: HTMLElement;
  private bite: HTMLElement;
  private fight: HTMLElement; private tensionFill: HTMLElement; private distFill: HTMLElement; private staminaFill: HTMLElement;
  private arrowL: HTMLElement; private arrowR: HTMLElement; private fightLabel: HTMLElement;
  private card: HTMLElement;
  private toasts: HTMLElement;
  private hint: HTMLElement;
  private prompt: HTMLElement;
  private shownCoins = 0;
  private cardTimer = 0;
  private markers: HTMLElement;
  private markerEls: HTMLElement[] = [];
  private fadeEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = h('div', 'hud', parent);
    const tr = h('div', 'hud-tr', this.root);
    this.coins = h('div', 'pill coins', tr, '<span class="ico">◉</span><b>0</b>');
    this.hold = h('div', 'pill hold', tr, '<span class="ico">⛁</span><b>0/12</b>');
    this.rhythm = h('div', 'pill rhythm', tr, '<span class="ico">♪</span><b>×1.00</b>');
    this.goal = h('div', 'goal', this.root, '<div class="goal-k">Next</div>');
    this.goalText = h('div', 'goal-t', this.goal);
    this.power = h('div', 'power', this.root, `<div class="power-sweet" style="left:${FEEL.sweetSpot[0] * 100}%;width:${(FEEL.sweetSpot[1] - FEEL.sweetSpot[0]) * 100}%"></div>`);
    this.powerFill = h('div', 'power-fill', this.power);
    this.bite = h('div', 'bite', this.root, '<span>!</span>');
    this.fight = h('div', 'fight', this.root);
    this.fightLabel = h('div', 'fight-label', this.fight);
    const tension = h('div', 'gauge tension', this.fight, '<div class="gauge-k">Tension</div><div class="zone-hot"></div>');
    this.tensionFill = h('div', 'gauge-fill', tension);
    const dist = h('div', 'gauge dist', this.fight, '<div class="gauge-k">Line</div>');
    this.distFill = h('div', 'gauge-fill', dist);
    const stam = h('div', 'gauge stamina', this.fight, '<div class="gauge-k">Fish</div>');
    this.staminaFill = h('div', 'gauge-fill', stam);
    this.arrowL = h('div', 'run-arrow left', this.root, '◀<small>A</small>');
    this.arrowR = h('div', 'run-arrow right', this.root, '<small>D</small>▶');
    this.card = h('div', 'catch-card', this.root);
    this.toasts = h('div', 'toasts', this.root);
    this.hint = h('div', 'hint', this.root);
    this.prompt = h('div', 'prompt', this.root);
    this.markers = h('div', 'markers', parent);
    this.fadeEl = h('div', 'fade', parent, '<div class="fade-text"></div>');
  }

  /** Floating markers over NPCs and places: '!' new quest, '?' ready to hand in, names when close. */
  setMarkers(items: { x: number; y: number; kind: 'offer' | 'turnIn' | 'place' | null; glyph?: string; label: string | null; alpha: number }[]) {
    while (this.markerEls.length < items.length) this.markerEls.push(h('div', 'marker', this.markers, '<div class="mk"></div><div class="nm"></div>'));
    this.markerEls.forEach((e, i) => {
      const it = items[i];
      if (!it) { e.style.display = 'none'; return; }
      e.style.display = '';
      e.style.left = `${it.x}px`; e.style.top = `${it.y}px`; e.style.opacity = String(it.alpha);
      const mk = e.firstElementChild as HTMLElement, nm = e.lastElementChild as HTMLElement;
      mk.style.display = it.kind ? '' : 'none';
      mk.className = 'mk ' + (it.kind ?? '');
      mk.textContent = it.glyph ?? (it.kind === 'turnIn' ? '?' : it.kind === 'offer' ? '!' : '•');
      nm.style.display = it.label ? '' : 'none';
      nm.textContent = it.label ?? '';
    });
  }

  /** Fade the screen to the sea colour (with an optional line of text) or back. */
  fade(on: boolean, text = '') {
    this.fadeEl.classList.toggle('on', on);
    if (on) (this.fadeEl.firstElementChild as HTMLElement).textContent = text;
  }

  setGoal(text: string) { if (this.goalText.textContent !== text) { this.goalText.textContent = text; this.goal.classList.remove('flash'); void this.goal.offsetWidth; this.goal.classList.add('flash'); } }
  setHint(text: string) { this.hint.innerHTML = text; this.hint.classList.toggle('on', !!text); }
  setPrompt(text: string) { this.prompt.innerHTML = text; this.prompt.classList.toggle('on', !!text); }

  toast(html: string, kind = '') {
    const t = h('div', 'toast ' + kind, this.toasts, html);
    // At most four at once: a burst pushes the oldest out early.
    const live = [...this.toasts.children].filter((c) => !c.classList.contains('out'));
    for (const old of live.slice(0, Math.max(0, live.length - 4))) { old.classList.add('out'); setTimeout(() => old.remove(), 600); }
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  showCatch(item: CatchItem | null, catchInfo: { fishId: string; weight: number; trait: string | null }, first: boolean, record: boolean, value: number, holdFull: boolean) {
    const f = fish(catchInfo.fishId);
    const r = rarityIndex(catchInfo.fishId);
    const trait = catchInfo.trait ? STRANGE_TRAITS.find((t) => t.id === catchInfo.trait) : null;
    this.card.className = `catch-card on r${r}`;
    this.card.innerHTML = `
      <div class="cc-rarity">${RARITY_NAMES[r]}${first ? '<span class="cc-new">New!</span>' : ''}${record ? '<span class="cc-new rec">Record</span>' : ''}</div>
      <div class="cc-name">${trait ? `<span class="cc-trait">${trait.name}</span> ` : ''}${f.name}</div>
      <div class="cc-stats"><span>${catchInfo.weight.toFixed(2)} kg</span><span class="cc-val">◉ ${fmt(value)}</span></div>
      <div class="cc-lore">${f.lore}</div>
      ${holdFull ? '<div class="cc-warn">Hold full — released back to the sea</div>' : ''}`;
    this.cardTimer = first ? 5.5 : 3.2;
    void item;
  }

  update(dt: number, s: GameState, session: FishingSession, bitePos: { x: number; y: number } | null) {
    this.shownCoins += (s.coins - this.shownCoins) * Math.min(1, dt * 8);
    if (Math.abs(s.coins - this.shownCoins) < 0.5) this.shownCoins = s.coins;
    (this.coins.querySelector('b') as HTMLElement).textContent = fmt(this.shownCoins);
    (this.hold.querySelector('b') as HTMLElement).textContent = `${s.hold.length}/${s.holdCapacity}`;
    this.hold.classList.toggle('full', s.hold.length >= s.holdCapacity);
    (this.rhythm.querySelector('b') as HTMLElement).textContent = `×${(1 + Math.min(10, s.rhythm) * 0.05).toFixed(2)}`;
    this.rhythm.classList.toggle('on', s.rhythm > 0);

    const ph = session.phase;
    this.power.classList.toggle('on', ph === 'charging');
    if (ph === 'charging') {
      this.powerFill.style.width = `${session.power * 100}%`;
      const [lo, hi] = FEEL.sweetSpot;
      this.power.classList.toggle('sweet', session.power >= lo && session.power <= hi);
    }
    this.bite.classList.toggle('on', ph === 'bite');
    if (ph === 'bite' && bitePos) { this.bite.style.left = `${bitePos.x}px`; this.bite.style.top = `${bitePos.y}px`; }

    const fs = session.fight;
    this.fight.classList.toggle('on', ph === 'fighting' && !!fs);
    if (fs) {
      this.fightLabel.textContent = fs.thrash > 0 ? 'It’s thrashing — ease off!' : fs.run !== 0 ? 'It’s running — steer against it!' : 'Reel it in';
      this.fightLabel.classList.toggle('warn', fs.thrash > 0 || fs.run !== 0);
      this.tensionFill.style.width = `${Math.min(1, fs.tension) * 100}%`;
      this.tensionFill.parentElement!.classList.toggle('danger', fs.tension > 0.85);
      this.tensionFill.parentElement!.classList.toggle('slack', fs.tension < FEEL.slackThreshold * 1.5);
      const maxD = Math.max(session.castDistance, 1);
      this.distFill.style.width = `${Math.max(0, Math.min(1, 1 - fs.distance / (maxD * 1.2))) * 100}%`;
      this.staminaFill.style.width = `${fs.stamina * 100}%`;
      const warnDir = fs.run !== 0 ? fs.run : fs.warned ? fs.pendingRun : 0;
      // Arrows show which way to steer: against the run (+1 = fish heading screen-left → steer right).
      this.arrowR.classList.toggle('on', warnDir === 1);
      this.arrowL.classList.toggle('on', warnDir === -1);
      this.arrowR.classList.toggle('active', fs.run === 1);
      this.arrowL.classList.toggle('active', fs.run === -1);
    } else { this.arrowL.classList.remove('on', 'active'); this.arrowR.classList.remove('on', 'active'); }

    if (this.cardTimer > 0) { this.cardTimer -= dt; if (this.cardTimer <= 0) this.card.classList.remove('on'); }
  }
}
