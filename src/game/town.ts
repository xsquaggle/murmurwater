/**
 * People and places: NPCs standing in the world, talking to them, the stall, the notice board,
 * Pell's ferry, the lighthouse lamp, quest progress toasts, and every menu screen.
 */
import { Color, Vector3 } from 'three';
import type { Game } from './game';
import { NpcFigure } from '../render/npc-figure';
import { Cat } from '../render/cat';
import { hashString } from '../core/rng';
import { Dialogue, Screens, type ScreenKind, type UiHost } from '../ui/screens';
import { converse, afterTurnIn, textHash, type Conversation, type Line, type TalkAction } from './talk';
import {
  BOATS_BY_ID, QUESTS_BY_ID, abandonBoard, accept, acceptBoard, boardOpen, currentGoal, describeRewards, npc, npcOffer, onQuestEvent, questStatus,
  readySet, newlyReady, tickBoard, turnIn, type QuestEvent, type QuestUpdate,
} from '../core/quests';
import { BAITS_BY_ID, RODS_BY_ID, type FerryPoint, type MooringDef, type NpcSpot, type PlaceDef, type RegionContent } from '../core/content';
import { LANDING } from '../core/landing';
import { DAY_LENGTH_S } from '../render/daycycle';
import type { ChartRaster, ChartView } from '../ui/chart';
import { fmt, sellAll } from '../core/economy';
import { saveSettings, type Settings } from './settings';
import { QUALITY } from '../render/renderer';

interface Interactable {
  kind: 'npc' | 'board' | 'lamp' | 'boat' | 'ashore' | 'kettle' | 'chest'; id: string; pos: Vector3; r: number; prompt: string;
  /** How far away it counts as being, when that is not simply the distance to `pos` (the boat's hull). */ dist?: number;
}
interface Step { at: number; run: () => void }

export class Town {
  readonly npcs = new Map<string, { fig: NpcFigure; spots: NpcSpot[] }>();
  readonly critters: { island: string; cat: Cat }[] = [];
  readonly dialogue: Dialogue;
  readonly screens: Screens;
  island = 'hearthbay';
  private catGreeted = false;
  private meowRest = 0;
  private region: RegionContent;
  private places = new Map<string, PlaceDef>();
  private talking: string | null = null;
  private barkSeq: Record<string, number> = {};
  private seq: Step[] = []; private seqT = 0;
  private focus: Interactable | null = null;
  private expectUnlock = false;
  private wasLocked = false;
  private chartRaster: ChartRaster | null = null;
  private steamT = 0;
  private white = new Color('#FFFFFF');
  private gold = new Color('#FFD27A');

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
    this.arrive();
    g.world.placeFerry(this.island);
    g.world.lighthouseLit = this.lampLit;
    if (g.world.kettle) g.world.kettle.visible = !g.state.flags.includes('kettle-taken');
    this.showChests();

    this.dialogue = new Dialogue(uiRoot, (line) => this.playVoice(line));
    // Which lines have a recording that matches their current text (see tools/voice-manifest.ts).
    void fetch('audio/voice/voiced.json').then((r) => (r.ok ? r.json() : {})).then((v) => { this.voiced = v ?? {}; }).catch(() => {});
    const host: UiHost = {
      state: g.state, settings,
      buyRod: (id) => this.buyRod(id), equipRod: (id) => { g.state.gear.rod = id; g.refreshSession(); },
      buyBait: (id, n) => this.buyBait(id, n), equipBait: (id) => { g.state.gear.bait = id; g.refreshSession(); },
      acceptBoard: (id) => { acceptBoard(g.state, id); },
      abandonBoard: (id) => { abandonBoard(g.state, id); },
      applySettings: (k) => this.applySettings(k),
      quit: () => { void g.save().then(() => window.mwNative?.quit()); },
      close: () => this.closeScreens(),
      canQuit: !!window.mwNative,
      chart: () => this.chartView(),
      sailTo: (id) => this.sailTo(id),
    };
    this.screens = new Screens(uiRoot, host);
    // Every button in the interface clicks; tabs turn a page.
    uiRoot.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.sc-tab')) g.audio.pageTurn();
      else if (t.closest('button, .btn, .dlg-choice')) g.audio.click();
    }, true);

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
  /** The island nearest a point (the Teeth count as one place). */
  islandAt(p: Vector3): string {
    let best = 'hearthbay', bd = Infinity;
    for (const isl of this.region.islands) {
      const dx = p.x - isl.x, dz = p.z - isl.z;
      const c = Math.cos(isl.rot), s = Math.sin(isl.rot);
      const d = Math.hypot((dx * c - dz * s) / isl.rx, (dx * s + dz * c) / isl.rz);
      if (d < bd) { bd = d; best = isl.id; }
    }
    return chartPlaceOf(best);
  }

  /** The player has come ashore somewhere (or the game has just loaded): work out who is where. */
  arrive() {
    const s = this.g.state;
    this.island = this.islandAt(this.g.pos);
    // Pell waits at Gull Point until the skiff has carried the player somewhere else; after that he keeps to the dock.
    if (s.boats.owned.length && this.island !== 'gull-point' && !s.flags.includes('pell-home')) s.flags.push('pell-home');
    this.placeNpcs();
  }

  private placeNpcs() {
    const s = this.g.state, owner = s.boats.owned.length > 0;
    for (const [, e] of this.npcs) {
      // Most people keep to one spot. The ferryman has two: he goes where he rows the player, until they sail themselves.
      const at = !owner ? this.island : s.flags.includes('pell-home') ? e.spots[0].island : 'gull-point';
      const sp = e.spots.length === 1 ? e.spots[0] : e.spots.find((x) => x.island === at) ?? null;
      e.fig.root.visible = !!sp;
      if (!sp) continue;
      const y = this.g.groundAt(sp.x, sp.z) ?? Math.max(0, this.g.world.hf.height(sp.x, sp.z));
      e.fig.root.position.set(sp.x, y, sp.z);
      e.fig.restYaw = sp.yaw;
    }
  }

  /** The fixed spot of a place or a chest as a vector, made once: this is asked for every step. */
  private spot(p: { id: string; x: number; z: number }): Vector3 {
    let v = this.spots.get(p.id);
    if (!v) { v = new Vector3(p.x, 0, p.z); this.spots.set(p.id, v); }
    return v;
  }
  private spots = new Map<string, Vector3>();

  private interactables(): Interactable[] {
    const out: Interactable[] = [];
    const sail = this.g.sailing;
    // In the boat there is one thing to do with your feet: step off, where there is somewhere to stand.
    if (sail.aboard) {
      if (sail.canLand) out.push({ kind: 'ashore', id: 'ashore', pos: this.g.pos, r: 1, prompt: 'Step ashore', dist: 0 });
      return out;
    }
    if (sail.boardable) {
      // Measured to the hull, so whichever of the boat and a bystander is nearer is the one you get.
      out.push({ kind: 'boat', id: 'boat', pos: this.g.pos, r: LANDING.reach + LANDING.slack, prompt: `Board the ${sail.def!.name.replace(/^The /, '')}`, dist: sail.distanceTo(this.g.pos) });
    }
    const kettle = this.places.get('keepers-kettle');
    if (kettle && !this.g.state.flags.includes('kettle-taken')) {
      out.push({ kind: 'kettle', id: 'keepers-kettle', pos: this.spot(kettle), r: kettle.r, prompt: questStatus(this.g.state, 'hb-07-kettle') === 'active' ? 'Take the kettle' : 'Look at the kettle' });
    }
    for (const c of this.region.chests ?? []) {
      if (!this.g.state.flags.includes(`chest:${c.id}`)) out.push({ kind: 'chest', id: c.id, pos: this.spot(c), r: 2.4, prompt: 'Open the chest' });
    }
    for (const [id, e] of this.npcs) {
      if (!e.fig.root.visible) continue;
      out.push({ kind: 'npc', id, pos: e.fig.root.position, r: 2.8, prompt: `Talk to ${npc(id).name}` });
    }
    const v = (p: PlaceDef) => this.spot(p);
    const stall = this.places.get('mara-stall');
    if (stall && this.npcs.get('mara')?.fig.root.visible) out.push({ kind: 'npc', id: 'mara', pos: v(stall), r: stall.r, prompt: 'Talk to Mara' });
    const board = this.places.get('notice-board');
    if (board) out.push({ kind: 'board', id: 'notice-board', pos: v(board), r: board.r, prompt: 'Read the notice board' });
    const lamp = this.places.get('lighthouse-lamp');
    if (lamp) {
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
    if (this.blocking || g.sailing.busy) { this.focus = null; return; }

    // Nearest thing to interact with (only when the rod is idle).
    const ph = g.session.phase;
    this.focus = null;
    if (ph === 'idle' || ph === 'landed' || ph === 'lost') {
      let bd = Infinity;
      for (const it of this.interactables()) {
        const d = it.dist ?? Math.hypot(g.pos.x - it.pos.x, g.pos.z - it.pos.z);
        if (d < it.r && d < bd) { bd = d; this.focus = it; }
      }
    }
    const inp = g.input;
    if (this.focus && inp.wasPressed('interact')) this.interact();
    else if (inp.wasPressed('journal')) this.openScreen('journal');
    else if (inp.wasPressed('inventory')) this.openScreen('hold');
    else if (inp.wasPressed('map')) { if (g.sailing.owned) this.openScreen('chart'); else g.hud.toast('You’ll want a boat before a chart is any use.'); }
    else if (inp.wasPressed('pause')) this.openScreen('pause');
  }

  /** Act on whatever is in front of the player (also used by the bot). */
  interact() {
    const it = this.focus;
    if (!it) return false;
    if (it.kind === 'npc') this.talkTo(it.id);
    else if (it.kind === 'board') { if (!boardOpen(this.g.state)) this.g.hud.toast('Just a notice about a lost cat. Nothing for you yet.'); else this.openScreen('board'); }
    else if (it.kind === 'lamp') { if (questStatus(this.g.state, 'hb-06-relight') === 'active' && !this.lampLit) this.lightLamp(); else this.g.hud.toast(it.prompt); }
    else if (it.kind === 'boat') this.g.sailing.board();
    else if (it.kind === 'ashore') this.g.sailing.stepAshore();
    else if (it.kind === 'kettle') this.takeKettle();
    else if (it.kind === 'chest') this.openChest(it.id);
    return true;
  }
  get focusPrompt() { return this.focus?.prompt ?? null; }

  /** People standing on this island, as [x, z, radius] circles the player walks around. */
  *bodies(): Iterable<readonly [number, number, number]> {
    for (const [, e] of this.npcs) if (e.fig.root.visible) yield [e.fig.root.position.x, e.fig.root.position.z, 0.45];
  }
  /** Who the player is talking to, if anyone (for the camera). */
  /** 0..1: how close the player stands to a cat (it purrs). */
  catCloseness(): number {
    let best = 0;
    for (const c of this.critters) if (c.cat.root.visible) best = Math.max(best, 1 - (c.cat.root.position.distanceTo(this.g.pos) - 1) / 2.5);
    return Math.min(1, Math.max(0, best));
  }

  get talkingTo(): Vector3 | null { return this.talking && this.dialogue.isOpen ? this.npcs.get(this.talking)?.fig.root.position ?? null : null; }

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
    this.g.audio.questDone();
    this.g.hud.toast(`Quest complete: ${q.title}`, 'gold');
    const got = describeRewards(r);
    if (got.length) setTimeout(() => this.g.hud.toast(got.join(' · '), 'good'), 450);
    if (r.flags?.includes('hb-lighthouse-lit')) this.g.world.lighthouseLit = true;
    // Baits and relics both change what the next cast can do.
    if (r.items || r.relics?.length) this.g.refreshSession();
    if (r.boats?.length) {
      // She is in the water from this moment, lying off the nearest landing.
      this.g.sailing.launch();
      const name = BOATS_BY_ID.get(r.boats[0])?.name ?? 'boat';
      setTimeout(() => this.g.hud.toast(`${name} is yours. She lies just off the landing.`, 'gold'), 1400);
    }
    void this.g.save();
    const next = afterTurnIn(s, npcId, this.island);
    this.openConversation(next);
  }

  private onTalkAction(a: TalkAction) {
    const g = this.g, s = g.state;
    switch (a.type) {
      case 'accept': {
        if (accept(s, a.quest)) {
          g.audio.questAccept();
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
      g.audio.questReady();
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
    // The lamp is on Gull Point, and the only way over is Pell's boat.
    if (questStatus(s, 'hb-06-relight') === 'active' && !this.lampLit) {
      return this.island === 'gull-point' ? 'Relight: climb the lighthouse stair and light the lamp' : 'Relight: ask Pell at the dock to row you out to Gull Point';
    }
    return currentGoal(s).text;
  }

  /** Where the current goal is, for the compass, the chart and the marker over it. */
  goalTarget(): { x: number; z: number; y: number } | null {
    const g = this.g, s = g.state;
    const at = (x: number, z: number, lift: number) => ({ x, z, y: Math.max(g.groundAt(x, z) ?? 0, g.world.hf.height(x, z), 0) + lift });
    const person = (id: string) => { const p = this.npcs.get(id)?.fig.root; return p?.visible ? { x: p.position.x, z: p.position.z, y: p.position.y + 2.6 } : null; };
    if (s.hold.length >= s.holdCapacity) return person('mara');
    const goal = currentGoal(s);
    if (goal.npc) return person(goal.npc);
    if (goal.at) return at(goal.at[0], goal.at[1], 5);
    const place = goal.place ? this.places.get(goal.place) : null;
    return place ? at(place.x, place.z, 3) : null;
  }

  /** Compass marks for the helm: the goal, and the moorings the player knows. */
  bearings(): { bearing: number; kind: 'goal' | 'mooring' }[] {
    const g = this.g, out: { bearing: number; kind: 'goal' | 'mooring' }[] = [];
    const to = (x: number, z: number) => Math.atan2(x - g.pos.x, -(z - g.pos.z));
    for (const m of this.region.moorings ?? []) {
      if (g.state.world.charted.includes(m.place) && Math.hypot(m.x - g.pos.x, m.z - g.pos.z) > 30) out.push({ bearing: to(m.x, m.z), kind: 'mooring' });
    }
    const goal = this.goalTarget();
    if (goal && Math.hypot(goal.x - g.pos.x, goal.z - g.pos.z) > 12) out.push({ bearing: to(goal.x, goal.z), kind: 'goal' });
    return out;
  }

  // ------------------------------------------------------------------ sea chests
  /** Shows each chest shut or open, as the save has it. */
  private showChests() {
    for (const [id, c] of this.g.world.chests) { const got = this.g.state.flags.includes(`chest:${id}`); c.shut.visible = !got; c.open.visible = got; }
  }

  private openChest(id: string) {
    const g = this.g, s = g.state, def = this.region.chests?.find((c) => c.id === id);
    if (!def || s.flags.includes(`chest:${id}`)) return;
    s.flags.push(`chest:${id}`);
    s.coins += def.coins; s.lifetime.coins += def.coins; s.run.coins += def.coins;
    const got = [`◉ ${def.coins}`];
    for (const [bait, n] of Object.entries(def.items ?? {})) { s.gear.baits[bait] = (s.gear.baits[bait] ?? 0) + n; got.push(`${n} ${BAITS_BY_ID.get(bait)?.name ?? bait}`); }
    this.showChests();
    g.audio.chestOpen(); g.audio.discover();
    g.fx.glow.burst(_v.set(def.x, (g.groundAt(def.x, def.z) ?? 1) + 0.7, def.z), 22, this.gold, 1.6, 2.4, 0.9, 0.12, 2.5);
    g.hud.toast(def.text);
    g.hud.toast(`In the chest: ${got.join(', ')}`, 'gold');
    void g.save();
  }

  // ------------------------------------------------------------------ the kettle on Kettle Isle
  private takeKettle() {
    const g = this.g, s = g.state;
    if (questStatus(s, 'hb-07-kettle') !== 'active') { g.hud.toast('A kettle on a ring of stones, warm to the touch. Somebody ought to hear of it.'); return; }
    s.flags.push('kettle-taken');
    if (g.world.kettle) g.world.kettle.visible = false;
    g.audio.coin(2);
    g.hud.toast('You take the keeper’s kettle. It is warm, and it stays warm.', 'gold');
    this.questEvent({ type: 'visit', place: 'keepers-kettle' });
    void g.save();
  }

  // ------------------------------------------------------------------ the chart
  /** Terrain heights for the chart, sampled once: the islands and a margin of sea round them. */
  private raster(): ChartRaster {
    if (this.chartRaster) return this.chartRaster;
    const hf = this.g.world.hf, cell = 3, pad = 48;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of this.region.islands) {
      const r = Math.max(i.rx, i.rz) * 1.18;
      x0 = Math.min(x0, i.x - r); x1 = Math.max(x1, i.x + r); z0 = Math.min(z0, i.z - r); z1 = Math.max(z1, i.z + r);
    }
    x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
    const w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((z1 - z0) / cell) + 1;
    const height = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) height[j * w + i] = hf.height(x0 + i * cell, z0 + j * cell);
    return (this.chartRaster = { x0, z0, cell, w, h, height });
  }

  private chartView(): ChartView {
    const g = this.g, s = g.state, rc = this.region, sail = g.sailing;
    const known = (id: string) => s.world.charted.includes(id);
    const ph = g.session.phase;
    const goal = this.goalTarget();
    return {
      title: `Chart of ${rc.zones.find((z) => z.priority === 0)?.name ?? rc.name}`,
      raster: this.raster(),
      islands: rc.islands.map((i) => ({ place: chartPlaceOf(i.id), x: i.x, z: i.z, rx: i.rx, rz: i.rz, rot: i.rot })),
      places: (rc.chart ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind, note: c.note ?? '', known: known(c.id) })),
      moorings: (rc.moorings ?? []).map((m) => ({ id: m.id, name: m.name, place: m.place, x: m.x, z: m.z, known: known(m.place) })),
      dock: { x: rc.landmarks.dock.x, z: rc.landmarks.dock.z, rot: rc.landmarks.dock.rot ?? 0, length: rc.landmarks.dock.length ?? 30 },
      you: { x: g.pos.x, z: g.pos.z, aboard: sail.aboard },
      boat: sail.owned ? { x: sail.boat.x, z: sail.boat.z, heading: sail.boat.heading } : null,
      goal: goal ? { x: goal.x, z: goal.z } : null,
      from: ph === 'idle' || ph === 'landed' || ph === 'lost' ? sail.mooredAt()?.id ?? null : null,
      hint: rc.edgeHint ?? '',
    };
  }

  /** Fast travel: the boat carries the player to a mooring they know. The sail costs a little of the day. */
  sailTo(id: string) {
    const g = this.g, s = g.state, sail = g.sailing;
    const m = (this.region.moorings ?? []).find((x: MooringDef) => x.id === id), from = sail.mooredAt();
    if (!m || !from || from.id === m.id || !s.world.charted.includes(m.place)) return;
    this.closeScreens();
    const hours = (Math.hypot(m.x - sail.boat.x, m.z - sail.boat.z) / sail.def!.speed) * (24 / DAY_LENGTH_S) * 1.5;
    this.run([
      { at: 0, run: () => { g.hud.fade(true, `You set the sail for ${m.name}…`); g.audio.sailFlap(); } },
      { at: 1.5, run: () => { sail.moorAt(m); s.hour = (s.hour + hours) % 24; this.arrive(); } },
      { at: 2.6, run: () => { g.hud.fade(false); g.input.requestLock(); } },
      { at: 3.3, run: () => { g.hud.toast(m.name, 'good'); void g.save(); } },
    ]);
  }

  // ------------------------------------------------------------------ screens
  openScreen(kind: ScreenKind) {
    if (this.dialogue.isOpen) return;
    this.releaseMouse();
    if (kind === 'chart') this.g.audio.chartOpen(); else if (!this.screens.isOpen) this.g.audio.uiOpen();
    this.screens.open(kind);
  }
  closeScreens() {
    if (this.screens.isOpen) this.g.audio.uiClose();
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
      if (e.code === 'Escape' || (b.journal.includes(e.code) && cur === 'journal') || (b.inventory.includes(e.code) && cur === 'hold') || (b.map.includes(e.code) && cur === 'chart')) { e.preventDefault(); this.closeScreens(); }
      else if (b.map.includes(e.code) && this.g.sailing.owned) this.openScreen('chart');
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
      { at: 0, run: () => { g.hud.fade(true, text); g.audio.oars(); } },
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
        g.audio.lampIgnite();
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
      // Seen from the boat as well as on their own island, but not from across the bay.
      c.cat.root.visible = c.island === this.island || c.cat.root.position.distanceTo(g.pos) < 140;
      if (!c.cat.root.visible) continue;
      c.cat.update(dt, g.pos);
      // The cat says hello when you walk up to it.
      const near = c.cat.root.position.distanceTo(g.pos) < 3.2;
      this.meowRest -= dt;
      if (near && !this.catGreeted && this.meowRest <= 0) { g.audio.meow(); this.meowRest = 25; }
      this.catGreeted = near;
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
    // The goal, when it is a place: a star over it. From the boat it shows from any distance, with how far.
    const goal = this.goalTarget(), aboard = g.sailing.aboard;
    if (goal && !this.blocking) {
      const d = Math.hypot(goal.x - g.pos.x, goal.z - g.pos.z);
      const isPerson = !!currentGoal(s).npc || s.hold.length >= s.holdCapacity;
      if (aboard ? d > 14 : !isPerson && d < 95) {
        const v = new Vector3(goal.x, goal.y, goal.z).project(g.camera);
        if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) items.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, kind: 'place', glyph: '✦', label: aboard && d > 40 ? `${Math.round(d / 5) * 5} m` : null, alpha: 1 });
      }
    }
    // On foot with somewhere to sail to: an anchor over the boat, so finding her is never a hunt.
    const sail = g.sailing;
    if (goal && !aboard && !this.blocking && sail.owned && !sail.busy && this.islandAt(_v.set(goal.x, 0, goal.z)) !== this.island) {
      const d = Math.hypot(sail.boat.x - g.pos.x, sail.boat.z - g.pos.z);
      if (d > 7 && d < 260) {
        const v = new Vector3(sail.boat.x, 4.4, sail.boat.z).project(g.camera);
        if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) items.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, kind: 'place', glyph: '⚓', label: d > 40 ? sail.def!.name.replace(/^The /, '') : null, alpha: 1 });
      }
    }
    g.hud.setMarkers(items);
    // The kettle steams for as long as it sits on its stones.
    const kettle = g.world.kettle;
    if (kettle?.visible) {
      this.steamT -= dt;
      if (this.steamT <= 0 && kettle.getWorldPosition(_v).distanceTo(g.pos) < 70) {
        this.steamT = 0.22;
        g.fx.spray.burst(_v.add(_up), 1, this.white, 0.12, 0.5, 1.8, 0.16, -0.35);
      }
    }
    this.dialogue.update(dt);
  }
}

const _v = new Vector3(), _up = new Vector3(0, 0.32, 0);
/** The chart place an island belongs to: the three stacks of the Teeth are one place. */
const chartPlaceOf = (island: string) => (island.startsWith('teeth-') ? 'the-teeth' : island);
