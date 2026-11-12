/** The game: owns state, world, player, fishing, UI and audio, and runs the fixed-step loop. */
import { Color, PerspectiveCamera, Vector3 } from 'three';
import { Renderer, QUALITY, type Quality } from '../render/renderer';
import { WorldScene } from '../render/world-scene';
import { Avatar, type PlayerAvatar, type Pose } from '../render/avatar';
import { ModelAvatar } from '../render/model-avatar';
import { makeFish, type FishObject } from '../render/fish-models';
import { FishingView } from '../render/fishing-view';
import { Fx } from '../render/fx';
import { DAY_LENGTH_S } from '../render/daycycle';
import { Hud } from '../ui/hud';
import { Town } from './town';
import { defaultSettings, keyLabel, type Settings } from './settings';
import { relicBonus } from '../core/quests';
import { AudioEngine } from '../audio/audio';
import { Input } from './input';
import { Rng } from '../core/rng';
import { FishingSession, FEEL, type FishingInput, type SpotInfo } from '../core/fishing';
import { REGIONS_BY_ID, bait, rod, zoneAt } from '../core/content';
import { addCatch, breakRhythm, rarityIndex, RHYTHM } from '../core/economy';
import { type GameState } from '../core/state';
import { serialize, type SaveStore } from '../core/save';
import { waveHeight, CALM_WAVES } from '../core/waves';

const STEP = 1 / 60;
const SEA_STATE = 0.6;

export class Game {
  readonly camera = new PerspectiveCamera(55, 16 / 9, 0.2, 9000);
  readonly world: WorldScene;
  readonly renderer: Renderer;
  readonly input: Input;
  readonly hud: Hud;
  readonly audio = new AudioEngine();
  readonly fx = new Fx();
  readonly avatar: PlayerAvatar = ModelAvatar.available() ? new ModelAvatar() : new Avatar();
  private shown: FishObject | null = null;
  private showTimer = 0;
  private faceYaw = 0;
  readonly view: FishingView;
  session: FishingSession;
  readonly pos = new Vector3();
  yaw = 0;
  private camYaw = 0; private camPitch = 0.28; private camDist = 5.2;
  private camTarget = new Vector3();
  private acc = 0;
  private time = 0;
  private speed = 0;
  private rngSeed: number;
  private saveTimer = 0;
  private castYaw = 0;
  private lastTension = 0;
  private shake = 0;
  private idleSince = 0;
  frames = 0;
  paused = false;
  /** Bots/screenshots: stop the real-time loop entirely (they drive frames themselves). */
  halted = false;
  /** Screenshot/debug hooks: force an avatar pose or a fixed camera. */
  debugPose: { pose: Pose; speed?: number; power?: number; tension?: number; lateral?: number; reeling?: boolean } | null = null;
  debugCam: { pos: Vector3; look: Vector3 } | null = null;
  /** When set (tests/bot), replaces player input to the fishing session. */
  botInput: FishingInput | null = null;
  readonly town: Town;
  /** Camera shake multiplier from settings (0 = off). */
  shakeScale = 1;

  constructor(public state: GameState, canvas: HTMLCanvasElement, uiRoot: HTMLElement, quality: Quality, private store: SaveStore, settings: Settings = defaultSettings()) {
    const region = REGIONS_BY_ID.get(state.world.region)!;
    this.world = new WorldScene(region, QUALITY[quality]);
    this.renderer = new Renderer(canvas, quality, this.world.scene, this.camera);
    this.input = new Input(canvas);
    this.hud = new Hud(uiRoot);
    this.world.hour = state.hour;
    this.world.scene.add(this.avatar.root, this.fx.group);
    this.view = new FishingView(this.fx, (x, z) => this.waveY(x, z));
    this.world.scene.add(this.view.group);
    this.pos.set(...state.world.pos);
    this.yaw = state.world.yaw;
    this.camYaw = this.yaw;
    this.rngSeed = state.seed;
    this.session = this.newSession();
    this.faceYaw = this.yaw;
    this.town = new Town(this, uiRoot, settings);
    this.town.applySettings(['volumes', 'sensitivity', 'invertY', 'bindings', 'uiScale', 'subtitles']);
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('beforeunload', () => { void this.save(); });
  }

  private onResize() {
    this.renderer.resize();
    this.view.setResolution(window.innerWidth, window.innerHeight);
  }

  waveY(x: number, z: number) { return waveHeight(CALM_WAVES, x, z, this.world.time, SEA_STATE * 0.6); }

  private newSession(): FishingSession {
    const s = this.state;
    const region = REGIONS_BY_ID.get(s.world.region)!;
    return new FishingSession({
      rod: rod(s.gear.rod), bait: bait(s.gear.bait), hour: this.world.hour, luck: relicBonus(s, 'luck'), biteWindowMult: 1, strangeChance: 0.03,
      flags: new Set(s.flags), region: s.world.region,
      spot: (dist: number): SpotInfo => {
        // Walk back along the aim line until the lure lands in water at least 0.6 m deep.
        const dir = new Vector3(Math.sin(this.castYaw), 0, Math.cos(this.castYaw));
        for (let d = dist; d > 2; d -= 0.5) {
          const x = this.pos.x + dir.x * d, z = this.pos.z + dir.z * d;
          const depth = this.world.hf.depth(x, z);
          if (depth >= 0.6) return { zoneId: zoneAt(region, x, z)?.id ?? null, depth, hotspot: false, distance: d };
        }
        return { zoneId: null, depth: 0, hotspot: false, distance: 0 };
      },
    }, new Rng(this.rngSeed++));
  }

  /** Rebuild the fishing session after gear changes (only between casts). */
  refreshSession() { if (this.session.phase === 'idle') this.session = this.newSession(); }

  /** Put the camera straight behind the player (after a teleport). */
  snapCamera() {
    this.camYaw = this.yaw; this.faceYaw = this.yaw;
    this.camTarget.copy(this.pos).add(new Vector3(0, 1.6, 0));
    const cx = this.pos.x - Math.sin(this.yaw) * this.camDist, cz = this.pos.z - Math.cos(this.yaw) * this.camDist;
    this.camera.position.set(cx, Math.max(this.pos.y + 2.2, this.world.hf.height(cx, cz) + 1.2, 1), cz);
  }

  /** Swing the view up to the lighthouse lamp (after lighting it). */
  lookAtLamp() {
    const L = this.world.region.landmarks.lighthouse;
    this.camYaw = Math.atan2(L.x - this.pos.x, L.z - this.pos.z);
    this.camPitch = -0.12;
  }

  /** Is there castable water ahead of the player? */
  private waterAhead(): boolean {
    const dir = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    for (let d = 3; d < rod(this.state.gear.rod).reach; d += 1) if (this.world.hf.depth(this.pos.x + dir.x * d, this.pos.z + dir.z * d) >= 0.6) return true;
    return false;
  }

  start() {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!this.halted) this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt: number) {
    if (!this.paused && !this.town.pausesWorld) {
      this.acc += dt;
      while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; }
    }
    this.present(dt);
    this.frames++;
  }

  /** Test/bot hook: advance the simulation by `seconds` without rendering, calling policy each step. */
  simulate(seconds: number, policy?: (g: Game) => FishingInput | null) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) { this.botInput = policy ? policy(this) : this.botInput; this.step(STEP); }
  }
  /** Test/bot hook: present one frame (camera, effects, HUD) with a given dt. */
  presentOnce(dt = STEP) { this.present(dt); }

  /** Fixed-step simulation. */
  step(dt: number) {
    const s = this.state;
    const inp = this.input;
    this.time += dt;
    s.playTime += dt;
    s.hour = (s.hour + (dt * 24) / DAY_LENGTH_S) % 24;
    this.world.hour = s.hour;
    this.session.ctx.hour = s.hour;

    // Mouse look / aim.
    const [mdx, mdy] = inp.consumeMouse();
    const fighting = this.session.phase === 'fighting';
    const ui = this.town.blocking;
    if (!fighting && !ui) {
      this.camYaw -= mdx * 0.0026;
      this.camPitch = Math.max(-0.15, Math.min(1.1, this.camPitch + mdy * 0.002));
    }
    if (inp.wheel) { this.camDist = Math.max(2.8, Math.min(12, this.camDist + inp.wheel * 0.6)); inp.wheel = 0; }

    // Movement (only when not fishing).
    const ph = this.session.phase;
    const canMove = (ph === 'idle' || ph === 'landed' || ph === 'lost') && !ui;
    let mx = 0, mz = 0;
    if (canMove) {
      if (inp.held('forward')) mz += 1; if (inp.held('back')) mz -= 1;
      if (inp.held('left')) mx += 1; if (inp.held('right')) mx -= 1;
    }
    const len = Math.hypot(mx, mz);
    const target = len > 0 ? (inp.held('sprint') ? 6.2 : 3.6) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (len > 0) {
      const a = this.camYaw + Math.atan2(mx, mz);
      let dy = a - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 12);
      const nx = this.pos.x + Math.sin(a) * this.speed * dt, nz = this.pos.z + Math.cos(a) * this.speed * dt;
      const gy = this.groundAt(nx, nz);
      if (gy !== null && Math.abs(gy - this.pos.y) < 1.2) { this.pos.x = nx; this.pos.z = nz; }
    } else if (ph === 'idle' || ph === 'charging') {
      // Standing still: the player turns to face where the camera looks (aiming).
      let dy = this.camYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 10);
    }
    const gy = this.groundAt(this.pos.x, this.pos.z);
    if (gy !== null) this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 15);

    // Fishing input.
    let fi: FishingInput;
    if (this.botInput) fi = this.botInput;
    else if (ui) fi = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    else {
      // Steer in the fish's lateral space (+1 = screen-left): A pulls left, D pulls right, mouse too.
      const steerKeys = (inp.held('steerLeft') ? 1 : 0) - (inp.held('steerRight') ? 1 : 0);
      const steerMouse = fighting ? Math.max(-1, Math.min(1, -mdx * 0.06)) : 0;
      fi = {
        primary: inp.held('cast'), primaryPressed: inp.wasPressed('cast'), primaryReleased: inp.wasReleased('cast'),
        steer: Math.max(-1, Math.min(1, steerKeys + steerMouse)), cancel: inp.wasPressed('cancel'),
      };
    }
    if (ph === 'idle' && fi.primaryPressed) {
      if (len > 0 || this.speed > 0.5) fi = { ...fi, primaryPressed: false };
      else if (!this.waterAhead()) { this.hud.toast('Face the water to cast'); fi = { ...fi, primaryPressed: false }; }
    }
    if (ph === 'charging') this.castYaw = this.yaw;
    this.session.update(dt, fi);
    this.handleEvents();

    // People, places, menus.
    this.town.step(dt);

    // Rhythm decays if you stop fishing for a while.
    if (this.session.phase === 'idle') { this.idleSince += dt; if (this.idleSince > RHYTHM.decayAfter && s.rhythm > 0) { s.rhythm = 0; this.hud.toast('Your rhythm fades'); } }
    else this.idleSince = 0;

    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; void this.save(); }
    inp.consumeEdges();
  }

  private handleEvents() {
    const s = this.state;
    for (const e of this.session.events.splice(0)) {
      switch (e.type) {
        case 'cast': {
          this.audio.whoosh(e.power);
          const tip = this.avatar.tipWorld();
          this.view.beginCast(tip, this.pos, this.castYaw, e.distance, FEEL.flightBase + e.distance * FEEL.flightPerMetre);
          if (e.clean) this.hud.toast('Clean cast!', 'good');
          break;
        }
        case 'splash': this.audio.plop(); break;
        case 'nibble': this.audio.nibble(); this.view.nibble(); break;
        case 'bite': this.audio.bite(); this.shake = 0.25; break;
        case 'hook': {
          const b = s.gear.bait;
          if (b !== 'breadcrumb' && isFinite(s.gear.baits[b] ?? 0)) {
            s.gear.baits[b] = Math.max(0, (s.gear.baits[b] ?? 0) - 1);
            if (s.gear.baits[b] === 0) { s.gear.bait = 'breadcrumb'; this.hud.toast(`Out of ${bait(b).name}: back to breadcrumbs`); }
          }
        }
          this.audio.hook(e.grade === 'perfect'); this.hud.toast(e.grade === 'perfect' ? 'Perfect hook!' : 'Hooked!', e.grade === 'perfect' ? 'gold' : 'good'); this.shake = 0.35; break;
        case 'tooEarly': this.hud.toast(e.spooked ? 'Too early — you spooked it' : 'Wait for the bobber to go under', 'bad'); break;
        case 'missed': this.audio.lose(); this.hud.toast('It got away… keep watching', 'bad'); break;
        case 'runWarn': this.audio.warn(); break;
        case 'run': this.shake = 0.2; break;
        case 'thrash': this.shake = 0.6; this.audio.splash(1.2); break;
        case 'landed': {
          const res = addCatch(s, e.catch);
          this.town.questEvent({ type: 'catch', fishId: e.catch.fishId, weight: e.catch.weight, trait: e.catch.trait, perfect: e.catch.perfectHook });
          const r = rarityIndex(e.catch.fishId);
          this.audio.catchFanfare(r);
          this.audio.splash(0.8);
          const value = res.item?.value ?? 0;
          this.hud.showCatch(res.item, e.catch, res.firstCatch, res.newRecord, value, res.holdFull);
          this.fx.glow.burst(this.avatar.tipWorld().add(new Vector3(0, -0.5, 0)), 30 + r * 20, RARITY_GLOW[r], 2.5, 3, 1.4, 0.18, 1.5);
          this.shown?.dispose();
          this.shown = makeFish(e.catch.fishId, e.catch.weight);
          this.avatar.holdFish(this.shown.obj);
          this.showTimer = 2.4;
          this.session = this.newSession();
          this.session.phase = 'landed';
          (this.session as any).resultTimer = 1.0;
          void this.save();
          break;
        }
        case 'lost':
          if (e.reason === 'snap') { this.audio.snap(); this.hud.toast('Snap! The line broke', 'bad'); s.lifetime.snaps++; breakRhythm(s); }
          else if (e.reason === 'slack') { this.audio.lose(); this.hud.toast('Too much slack — it threw the hook', 'bad'); breakRhythm(s); }
          else this.audio.lose();
          break;
        case 'reeledIn': break;
      }
    }
  }

  /** Ground height for walking: dock deck or dry land; null where you can't walk. */
  groundAt(x: number, z: number): number | null {
    const deck = this.world.dockDeckAt(x, z);
    const h = this.world.hf.height(x, z);
    if (deck !== null) return Math.max(deck, h);
    if (h < 0.15) return null;
    if (this.world.hf.normal(x, z, 0.8)[1] < 0.62) return null;
    return h;
  }

  /** Per-frame presentation (camera, avatar, views, HUD, audio). */
  private present(dt: number) {
    const s = this.state;
    const ph = this.session.phase;
    const fs = this.session.fight;
    // Avatar
    this.avatar.root.position.copy(this.pos);
    // Showing off a catch: turn to face the camera; otherwise face where we're heading.
    const wantYaw = this.shown ? Math.atan2(this.camera.position.x - this.pos.x, this.camera.position.z - this.pos.z) : this.yaw;
    let dYaw = wantYaw - this.faceYaw; dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    this.faceYaw += dYaw * Math.min(1, dt * (this.shown ? 7 : 30));
    this.avatar.root.rotation.y = this.faceYaw;
    const pose: Pose = ph === 'charging' ? 'charge' : ph === 'casting' ? 'cast' : ph === 'waiting' || ph === 'bite' ? 'wait' : ph === 'fighting' ? 'fight' : ph === 'landed' ? 'cheer' : this.speed > 0.2 ? 'walk' : 'idle';
    const dbg = this.debugPose;
    if (dbg) this.avatar.update(dt, dbg.pose, dbg.speed ?? 0, dbg);
    else this.avatar.update(dt, pose, this.speed, { power: this.session.power, tension: fs?.tension, lateral: fs ? (fs.run || 0) : 0, reeling: !!fs && this.input.held('cast') });
    this.avatar.root.updateMatrixWorld(true);
    if (this.shown) {
      this.shown.animate(this.time, 0.15);
      this.showTimer -= dt;
      if (this.showTimer <= 0 || ph === 'charging') { this.avatar.holdFish(null); this.shown.dispose(); this.shown = null; }
    }
    const tip = this.avatar.tipWorld();

    // Camera: orbit behind the player; while fishing, frame the bobber/fish too.
    const head = this.pos.clone().add(new Vector3(0, 1.6, 0));
    let look = head.clone();
    if (ph !== 'idle' && ph !== 'charging' && ph !== 'landed' && ph !== 'lost') look.lerp(this.view.bobberPos.y > -5 ? this.view.bobberPos : head, ph === 'fighting' ? 0.4 : 0.3);
    this.camTarget.lerp(look, Math.min(1, dt * 5));
    const fishingView = ph === 'fighting' || ph === 'waiting' || ph === 'bite' || ph === 'casting';
    const camYaw = fishingView ? this.castYaw : this.camYaw;
    const dist = this.camDist + (ph === 'fighting' ? 2.2 : fishingView ? 1.6 : 0);
    const pitch = fishingView ? Math.max(this.camPitch, 0.38) : this.camPitch;
    const shoulder = fishingView ? 1.5 : 0.9;
    const want = new Vector3(
      this.camTarget.x - Math.sin(camYaw) * Math.cos(pitch) * dist + Math.cos(camYaw) * shoulder,
      this.camTarget.y + Math.sin(pitch) * dist + 0.3,
      this.camTarget.z - Math.cos(camYaw) * Math.cos(pitch) * dist - Math.sin(camYaw) * shoulder,
    );
    const ground = this.world.hf.height(want.x, want.z);
    want.y = Math.max(want.y, Math.max(ground, this.waveY(want.x, want.z)) + 0.6);
    this.camera.position.lerp(want, Math.min(1, dt * 6));
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const tension = fs?.tension ?? 0;
    const sh = (this.shake * 0.08 + Math.max(0, tension - 0.8) * 0.03) * this.shakeScale;
    this.camera.lookAt(this.camTarget.x + (Math.random() - 0.5) * sh, this.camTarget.y + (Math.random() - 0.5) * sh, this.camTarget.z);
    if (this.debugCam) { this.camera.position.copy(this.debugCam.pos); this.camera.lookAt(this.debugCam.look); }
    const fov = 55 + (ph === 'fighting' ? -4 * tension : 0) + (ph === 'charging' ? -3 * this.session.power : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4); this.camera.updateProjectionMatrix(); }

    this.view.update(dt, this.session, tip, this.pos);
    this.fx.update(dt, (x, z) => this.waveY(x, z));
    this.world.update(dt, this.camera, this.pos);

    // HUD
    let bitePos: { x: number; y: number } | null = null;
    if (ph === 'bite') {
      const v = this.view.bobberPos.clone().project(this.camera);
      bitePos = { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    }
    this.hud.update(dt, s, this.session, bitePos);
    this.town.present(dt);
    this.hud.setGoal(this.town.goal());
    this.hud.setHint(this.town.blocking ? '' : this.hint());
    const fp = this.town.focusPrompt;
    this.hud.setPrompt(fp && !this.town.blocking ? `<kbd>${keyName(this.input.bindings.interact[0])}</kbd> ${fp}` : '');

    this.audio.update(dt, { reeling: !!fs && this.input.held('cast'), reelSpeed: rod(s.gear.rod).power / 3, tension, fighting: !!fs, sea: 0.5 });
    if (fs && tension > 0.9 && this.lastTension <= 0.9) this.audio.warn();
    this.lastTension = tension;

    this.renderer.render(dt);
  }

  private hint(): string {
    const ph = this.session.phase;
    if (!this.input.locked && !this.botInput) return 'Click to look around';
    switch (ph) {
      case 'idle': return '<kbd>LMB</kbd> hold to cast · <kbd>WASD</kbd> walk · <kbd>Shift</kbd> run';
      case 'charging': return 'Release in the bright band for a clean cast';
      case 'waiting': return 'Watch the bobber… click when it goes under · <kbd>RMB</kbd> reel in';
      case 'bite': return '<kbd>LMB</kbd> Hook it!';
      case 'fighting': return '<kbd>LMB</kbd> hold to reel · <kbd>A</kbd>/<kbd>D</kbd> steer against runs · let go when tension peaks';
      default: return '';
    }
  }

  async save() {
    const s = this.state;
    s.world.pos = [this.pos.x, this.pos.y, this.pos.z];
    s.world.yaw = this.yaw;
    try { await this.store.write(serialize(s)); } catch (e) { console.error('save failed', e); }
  }
}

const keyName = (code: string) => (code ? keyLabel(code) : '?');
const RARITY_GLOW = ['#D8D2C4', '#9BD06F', '#6FB7FF', '#C98CFF', '#FFC05C', '#7CFFD4'].map((c) => new Color(c));
