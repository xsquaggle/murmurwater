/**
 * People and places: NPCs standing in the world, talking to them, the stall, the notice board,
 * Pell's ferry, the lighthouse lamp, quest progress toasts, and every menu screen.
 */
import { Vector3 } from 'three';
import type { Game } from './game';
import { NpcFigure } from '../render/npc-figure';
import { Cat } from '../render/cat';
import { hashString } from '../core/rng';
import { Dialogue, Screens, type ScreenKind, type UiHost } from '../ui/screens';
import { converse, afterTurnIn, textHash, type Conversation, type Line, type TalkAction } from './talk';
import {
  QUESTS_BY_ID, accept, acceptBoard, boardOpen, currentGoal, describeRewards, npc, npcOffer, onQuestEvent, questStatus,
  readySet, newlyReady, tickBoard, turnIn, type QuestEvent, type QuestUpdate,
} from '../core/quests';
import { BAITS_BY_ID, RODS_BY_ID, type FerryPoint, type NpcSpot, type PlaceDef, type RegionContent } from '../core/content';
import { fmt, sellAll } from '../core/economy';
import { saveSettings, type Settings } from './settings';
import { QUALITY } from '../render/renderer';

interface Interactable { kind: 'npc' | 'board' | 'lamp'; id: string; pos: Vector3; r: number; prompt: string }
interface Step { at: number; run: () => void }

export class Town {
  readonly npcs = new Map<string, { fig: NpcFigure; spots: NpcSpot[] }>();
  readonly critters: { island: string; cat: Cat }[] = [];
  readonly dialogue: Dialogue;
  readonly screens: Screens;
  island = 'hearthbay';
  private region: RegionContent;
  private places = new Map<string, PlaceDef>();
  private talking: string | null = null;
  private barkSeq: Record<string, number> = {};
  private seq: Step[] = []; private seqT = 0;
  private focus: Interactable | null = null;
  private expectUnlock = false;
  private wasLocked = false;

  constructor(private g: Game, uiRoot: HTMLElement, public settings: Settings) {
    this.region = g.world.region as RegionContent;
    for (const p of this.region.places ?? []) this.places.set(p.id, p);
    for (const sp of this.region.npcSpots ?? []) {
      let e = this.npcs.get(sp.npc);
      if (!e) { e = { fig: new NpcFigure(sp.npc, sp.yaw), spots: [] }; this.npcs.set(sp.npc, e); g.world.scene.add(e.fig.root); }
      e.spots.push(sp);
    }
    for (const c of this.region.critters ?? []) {
      if (c.kind !== 'cat' || !Cat.available()) continue;
      const cat = new Cat(new Vector3(c.x, 0, c.z), c.r, (x, z) => g.groundAt(x, z), hashString(c.id));
      this.critters.push({ island: c.island, cat }); g.world.scene.add(cat.root);
    }
    this.island = this.islandAt(g.pos);
    this.placeNpcs();
    g.world.placeFerry(this.island);
    g.world.lighthouseLit = this.lampLit;

    this.dialogue = new Dialogue(uiRoot, (line) => this.playVoice(line));
    // Which lines have a recording that matches their current text (see tools/voice-manifest.ts).
    void fetch('audio/voice/voiced.json').then((r) => (r.ok ? r.json() : {})).then((v) => { this.voiced = v ?? {}; }).catch(() => {});
    const host: UiHost = {
      state: g.state, settings,
      buyRod: (id) => this.buyRod(id), equipRod: (id) => { g.state.gear.rod = id; g.refreshSession(); },
      buyBait: (id, n) => this.buyBait(id, n), equipBait: (id) => { g.state.gear.bait = id; g.refreshSession(); },
      acceptBoard: (id) => { acceptBoard(g.state, id); g.audio.click(); },
      applySettings: (k) => this.applySettings(k),
      quit: () => { void g.save().then(() => window.mwNative?.quit()); },
      close: () => this.closeScreens(),
      canQuit: !!window.mwNative,
    };
    this.screens = new Screens(uiRoot, host);

    // Keys while a conversation or screen is open are handled here, before gameplay input sees them.
    window.addEventListener('keydown', (e) => this.onUiKey(e), true);
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === g.renderer.canvas;
      if (this.wasLocked && !locked && !this.expectUnlock && !this.blocking) this.openScreen('pause');
      this.expectUnlock = false;
      this.wasLocked = locked;
    });
  }

  get lampLit() { return this.g.state.flags.includes('lamp-lit') || this.g.state.flags.includes('hb-lighthouse-lit'); }
  /** True while a conversation, screen or cutscene has the player's attention. */
  get blocking() { return this.dialogue.isOpen || this.screens.isOpen || this.seq.length > 0; }
  /** Screens pause the world; conversations don't. */
  get pausesWorld() { return this.screens.isOpen; }

  // ------------------------------------------------------------------ where things are
  islandAt(p: Vector3): string {
    let best = 'hearthbay', bd = Infinity;
    for (const isl of this.region.islands) {
      const dx = p.x - isl.x, dz = p.z - isl.z;
      const c = Math.cos(isl.rot), s = Math.sin(isl.rot);
      const d = Math.hypot((dx * c - dz * s) / isl.rx, (dx * s + dz * c) / isl.rz);
      if (d < bd) { bd = d; best = isl.id; }
    }
    return best === 'gull-point' ? 'gull-point' : 'hearthbay';
  }

  private placeNpcs() {
    for (const [, e] of this.npcs) {
      const sp = e.spots.find((s) => s.island === this.island) ?? null;
      e.fig.root.visible = !!sp;
      if (!sp) continue;
      const y = this.g.groundAt(sp.x, sp.z) ?? Math.max(0, this.g.world.hf.height(sp.x, sp.z));
      e.fig.root.position.set(sp.x, y, sp.z);
      e.fig.restYaw = sp.yaw;
    }
  }

  private interactables(): Interactable[] {
    const out: Interactable[] = [];
    for (const [id, e] of this.npcs) {
      if (!e.fig.root.visible) continue;
      out.push({ kind: 'npc', id, pos: e.fig.root.position, r: 2.8, prompt: `Talk to ${npc(id).name}` });
    }
    const v = (p: PlaceDef) => new Vector3(p.x, 0, p.z);
    const stall = this.places.get('mara-stall');
    if (stall && this.npcs.get('mara')?.fig.root.visible) out.push({ kind: 'npc', id: 'mara', pos: v(stall), r: stall.r, prompt: 'Talk to Mara' });
    const board = this.places.get('notice-board');
    if (board && this.island === 'hearthbay') out.push({ kind: 'board', id: 'notice-board', pos: v(board), r: board.r, prompt: 'Read the notice board' });
    const lamp = this.places.get('lighthouse-lamp');
    if (lamp && this.island === 'gull-point') {
      const can = questStatus(this.g.state, 'hb-06-relight') === 'active' && !this.lampLit;
      out.push({ kind: 'lamp', id: 'lighthouse-lamp', pos: v(lamp), r: lamp.r, prompt: can ? 'Climb the stair and light the lamp' : this.lampLit ? 'The lamp burns steady' : 'The lighthouse door is stiff with salt' });
    }
    return out;
  }

  // ------------------------------------------------------------------ per step
  step(dt: number) {
    const g = this.g, s = g.state;
    if (this.seq.length) {
      this.seqT += dt;
      while (this.seq.length && this.seq[0].at <= this.seqT) this.seq.shift()!.run();
    }
    if (tickBoard(s, dt) && s.quests.board.serial > 3) g.hud.toast('New notices on the board');
    if (this.blocking) { this.focus = null; return; }

    // Nearest thing to interact with (only when the rod is idle).
    const ph = g.session.phase;
    this.focus = null;
    if (ph === 'idle' || ph === 'landed' || ph === 'lost') {
      let bd = Infinity;
      for (const it of this.interactables()) {
        const d = Math.hypot(g.pos.x - it.pos.x, g.pos.z - it.pos.z);
        if (d < it.r && d < bd) { bd = d; this.focus = it; }
      }
    }
    const inp = g.input;
    if (this.focus && inp.wasPressed('interact')) this.interact();
    else if (inp.wasPressed('journal')) this.openScreen('journal');
    else if (inp.wasPressed('inventory')) this.openScreen('hold');
    else if (inp.wasPressed('map')) g.hud.toast('You’ll want a boat before a chart is any use.');
    else if (inp.wasPressed('pause')) this.openScreen('pause');
  }

  /** Act on whatever is in front of the player (also used by the bot). */
  interact() {
    const it = this.focus;
    if (!it) return false;
    if (it.kind === 'npc') this.talkTo(it.id);
    else if (it.kind === 'board') { if (!boardOpen(this.g.state)) this.g.hud.toast('Just a notice about a lost cat. Nothing for you yet.'); else this.openScreen('board'); }
    else if (it.kind === 'lamp') { if (questStatus(this.g.state, 'hb-06-relight') === 'active' && !this.lampLit) this.lightLamp(); else this.g.hud.toast(it.prompt); }
    return true;
  }
  get focusPrompt() { return this.focus?.prompt ?? null; }

  // ------------------------------------------------------------------ talking
  talkTo(npcId: string) {
    const s = this.g.state;
    if (!s.flags.includes(`met-${npcId}`)) s.flags.push(`met-${npcId}`);
    const seq = (this.barkSeq[npcId] = (this.barkSeq[npcId] ?? Math.floor(s.playTime)) + 1);
    this.openConversation(converse(s, npcId, this.island, seq));
  }

  private openConversation(conv: Conversation) {
    this.talking = conv.npc;
    this.releaseMouse();
    const onDone = () => { if (conv.turnIn) this.handIn(conv.turnIn, conv.npc); };
    if (this.dialogue.isOpen) this.dialogue.continueWith(conv, onDone);
    else this.dialogue.open(conv, (a) => this.onTalkAction(a), onDone);
  }

  private handIn(id: string, npcId: string) {
    const s = this.g.state, q = QUESTS_BY_ID.get(id)!;
    const r = turnIn(s, id);
    if (!r) return;
    this.g.audio.catchFanfare(2);
    this.g.hud.toast(`Quest complete: ${q.title}`, 'gold');
    const got = describeRewards(r);
    if (got.length) setTimeout(() => this.g.hud.toast(got.join(' · '), 'good'), 450);
    if (r.flags?.includes('hb-lighthouse-lit')) this.g.world.lighthouseLit = true;
    if (r.items) this.g.refreshSession();
    void this.g.save();
    const next = afterTurnIn(s, npcId, this.island);
    this.openConversation(next);
  }

  private onTalkAction(a: TalkAction) {
    const g = this.g, s = g.state;
    switch (a.type) {
      case 'accept': {
        if (accept(s, a.quest)) {
          g.audio.hook(true);
          g.hud.toast(`New quest: ${QUESTS_BY_ID.get(a.quest)!.title}`, 'gold');
          // Some objectives may already be met (e.g. you already own the rod).
          if (questStatus(s, a.quest) === 'ready') setTimeout(() => g.hud.toast(`Already done! Talk to ${npc(QUESTS_BY_ID.get(a.quest)!.giver).name}`, 'good'), 500);
        }
        this.endConversation();
        break;
      }
      case 'sell': {
        const n = s.hold.length;
        const total = sellAll(s);
        g.audio.coin(n);
        g.hud.toast(`Sold ${n} fish for ◉ ${fmt(total)}`, 'gold');
        this.questEvent({ type: 'sell', count: n, coins: total });
        void g.save();
        // Back to Mara: a sale can finish a quest she then wants to hear about.
        this.openConversation(npcOffer(s, 'mara').kind === 'turnIn' ? converse(s, 'mara', this.island) : { npc: 'mara', lines: [], choices: [{ label: 'Bye for now.', action: { type: 'bye' } }, ...(s.flags.includes('shop-open') ? [{ label: 'Show me the good shelf.', action: { type: 'shop' as const } }] : [])] });
        break;
      }
      case 'shop': this.endConversation(false); this.openScreen('shop'); break;
      case 'ferry': this.endConversation(false); this.ferry(a.to); break;
      default: this.endConversation();
    }
  }

  private endConversation(relock = true) {
    this.dialogue.close();
    this.talking = null;
    if (relock) this.g.input.requestLock();
  }

  private voiced: Record<string, string> = {};

  private playVoice(line: Line): () => void {
    const g = this.g;
    if (this.voiced[line.voice] !== textHash(line.text)) return () => {};
    let src: AudioBufferSourceNode | null = null, stopped = false;
    void g.audio.play(`audio/voice/${line.voice}.mp3`, 'voice').then((s) => { src = s; if (stopped) s?.stop(); });
    return () => { stopped = true; try { src?.stop(); } catch { /* already ended */ } };
  }

  // ------------------------------------------------------------------ quests
  questEvent(ev: QuestEvent): QuestUpdate {
    const g = this.g, s = g.state;
    const u = onQuestEvent(s, ev);
    for (const id of u.ready) {
      const q = QUESTS_BY_ID.get(id)!;
      g.audio.hook(true);
      g.hud.toast(`${q.title}: done! Return to ${npc(q.giver).name}`, 'gold');
    }
    for (const id of u.advanced) {
      if (u.ready.includes(id)) continue;
      const q = QUESTS_BY_ID.get(id)!;
      const i = q.objectives.findIndex((_, k) => (s.quests.active[id]?.[k] ?? 0) > 0);
      const o = q.objectives[Math.max(0, i)];
      const prog = s.quests.active[id]?.[Math.max(0, i)] ?? 0;
      if ((o.count ?? 1) > 1) g.hud.toast(`${q.title}: ${prog}/${o.count}`);
    }
    for (const b of u.boardDone) { g.audio.coin(4); g.hud.toast(`Notice paid: ${b.title} · ${describeRewards(b.reward).join(', ')}`, 'gold'); }
    return u;
  }

  private buyRod(id: string) {
    const g = this.g, s = g.state, r = RODS_BY_ID.get(id)!;
    if (s.coins < r.price || s.gear.rods.includes(id)) return;
    const before = readySet(s);
    s.coins -= r.price;
    s.gear.rods.push(id); s.gear.rodLevels[id] = 0; s.gear.rod = id;
    g.refreshSession();
    g.audio.coin(6);
    g.hud.toast(`Bought the ${r.name}`, 'gold');
    for (const q of newlyReady(s, before)) g.hud.toast(`${QUESTS_BY_ID.get(q)!.title}: done! Return to ${npc(QUESTS_BY_ID.get(q)!.giver).name}`, 'gold');
    void g.save();
  }

  private buyBait(id: string, n: number) {
    const g = this.g, s = g.state, b = BAITS_BY_ID.get(id)!;
    if (s.coins < b.price * n) return;
    s.coins -= b.price * n;
    s.gear.baits[id] = (s.gear.baits[id] ?? 0) + n;
    g.audio.coin(2);
    void g.save();
  }

  /** The goal line: the story's next step, with a couple of practical overrides. */
  goal(): string {
    const s = this.g.state;
    if (s.hold.length >= s.holdCapacity) return 'Your hold is full: sell your catch to Mara at the stall';
    return currentGoal(s).text;
  }

  // ------------------------------------------------------------------ screens
  openScreen(kind: ScreenKind) {
    if (this.dialogue.isOpen) return;
    this.releaseMouse();
    this.screens.open(kind);
  }
  closeScreens() {
    this.screens.close();
    this.g.input.requestLock();
  }
  private releaseMouse() {
    if (this.g.input.locked) { this.expectUnlock = true; this.g.input.exitLock(); }
  }

  private onUiKey(e: KeyboardEvent) {
    if (this.screens.capturingKeys) return;
    const b = this.g.input.bindings;
    if (this.dialogue.isOpen) {
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (/^Digit[1-9]$/.test(e.code)) this.dialogue.pick(Number(e.code.slice(5)) - 1);
      else if (e.code === 'Escape') this.endConversation();
      else if (b.interact.includes(e.code) || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.dialogue.advance(); }
      return;
    }
    if (this.screens.isOpen) {
      e.stopImmediatePropagation();
      if (e.repeat) return;
      const cur = this.screens.current;
      if (e.code === 'Escape' || (b.journal.includes(e.code) && cur === 'journal') || (b.inventory.includes(e.code) && cur === 'hold')) { e.preventDefault(); this.closeScreens(); }
      else if (b.journal.includes(e.code)) this.screens.open('journal');
      else if (b.inventory.includes(e.code)) { e.preventDefault(); this.screens.open('hold'); }
    }
  }

  applySettings(keys: (keyof Settings)[]) {
    const g = this.g, st = this.settings;
    for (const k of keys) {
      if (k === 'quality') g.renderer.setQuality(st.quality);
      if (k === 'volumes') { Object.assign(g.audio.volumes, st.volumes); g.audio.applyVolumes(); }
      if (k === 'sensitivity') g.input.sensitivity = st.sensitivity;
      if (k === 'invertY') g.input.invertY = st.invertY;
      if (k === 'bindings') g.input.bindings = structuredClone(st.bindings);
      if (k === 'uiScale') document.documentElement.style.setProperty('--ui-scale', String(st.uiScale));
      if (k === 'subtitles') document.body.classList.toggle('subtitle-off', !st.subtitles);
      if (k === 'windowMode') void window.mwNative?.setWindowMode(st.windowMode);
      if (k === 'resolution') void window.mwNative?.setResolution(st.resolution[0], st.resolution[1]);
    }
    g.shakeScale = st.shake;
    void saveSettings(st);
    void QUALITY;
  }

  // ------------------------------------------------------------------ cutscenes
  private run(steps: Step[]) { this.seq = steps.sort((a, b) => a.at - b.at); this.seqT = 0; this.focus = null; }

  ferry(to: string) {
    const g = this.g;
    const dest = this.region.ferry?.[to] as FerryPoint | undefined;
    if (!dest) return;
    const text = to === 'gull-point' ? 'Pell rows you out across the still water…' : 'Pell rows you home. He hums something old.';
    this.run([
      { at: 0, run: () => { g.hud.fade(true, text); g.audio.splash(0.4); } },
      { at: 1.6, run: () => {
        g.pos.set(dest.x, g.groundAt(dest.x, dest.z) ?? 1, dest.z);
        g.yaw = dest.yaw; g.snapCamera();
        this.island = to; this.placeNpcs(); g.world.placeFerry(to);
      } },
      { at: 2.6, run: () => { g.hud.fade(false); g.input.requestLock(); } },
      { at: 3.4, run: () => { if (to === 'gull-point') g.hud.toast('Gull Point. The lighthouse waits up the hill.'); void g.save(); } },
    ]);
  }

  private lightLamp() {
    const g = this.g, s = g.state;
    this.run([
      { at: 0, run: () => g.hud.fade(true, 'You climb the long stair. The lampjaw’s light goes into the lamp like it remembers the way.') },
      { at: 3.2, run: () => {
        if (!s.flags.includes('lamp-lit')) s.flags.push('lamp-lit');
        g.world.lighthouseLit = true;
        this.questEvent({ type: 'visit', place: 'lighthouse-lamp' });
        g.lookAtLamp();
      } },
      { at: 3.6, run: () => { g.hud.fade(false); g.audio.catchFanfare(5); } },
      { at: 6.5, run: () => { g.hud.toast('The lamp catches. Somewhere below, the water holds two moons.', 'gold'); g.input.requestLock(); void g.save(); } },
    ]);
  }

  // ------------------------------------------------------------------ presentation
  present(dt: number) {
    const g = this.g, s = g.state;
    const w = window.innerWidth, h = window.innerHeight;
    const items: Parameters<typeof g.hud.setMarkers>[0] = [];
    for (const c of this.critters) {
      c.cat.root.visible = c.island === this.island;
      if (c.cat.root.visible) c.cat.update(dt, g.pos);
    }
    for (const [id, e] of this.npcs) {
      const f = e.fig;
      f.update(dt, f.root.visible ? g.pos : null, this.talking === id);
      if (!f.root.visible) continue;
      const d = f.root.position.distanceTo(g.pos);
      if (d > 45) continue;
      const p = f.root.position.clone(); p.y += f.labelHeight;
      const v = p.project(g.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const offer = npcOffer(s, id);
      const kind = offer.kind === 'turnIn' ? 'turnIn' : offer.kind === 'offer' ? 'offer' : null;
      if (!kind && d > 12) continue;
      items.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, kind, label: d < 12 && this.talking !== id ? npc(id).name : null, alpha: d > 30 ? 0.6 : 1 });
    }
    const lamp = this.places.get('lighthouse-lamp');
    if (lamp && questStatus(s, 'hb-06-relight') === 'active' && !this.lampLit && this.island === 'gull-point') {
      const v = new Vector3(lamp.x, (g.groundAt(lamp.x, lamp.z) ?? 10) + 3, lamp.z).project(g.camera);
      if (v.z < 1) items.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, kind: 'place', glyph: '✦', label: null, alpha: 1 });
    }
    g.hud.setMarkers(items);
    this.dialogue.update(dt);
  }
}
