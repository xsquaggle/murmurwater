/** The game: owns state, world, player, fishing, UI and audio, and runs the fixed-step loop. */
import { Color, PerspectiveCamera, Vector3 } from 'three';
import { Renderer, QUALITY, type Quality } from '../render/renderer';
import { WorldScene } from '../render/world-scene';
import { Avatar, type PlayerAvatar, type Pose } from '../render/avatar';
import { ModelAvatar } from '../render/model-avatar';
import { makeFish, type FishObject } from '../render/fish-models';
import { FishingView } from '../render/fishing-view';
import { FishShadows } from '../render/fish-shadows';
import { Fx } from '../render/fx';
import { DAY_LENGTH_S } from '../render/daycycle';
import { Hud } from '../ui/hud';
import { PerfOverlay } from '../ui/perf';
import { Town } from './town';
import { defaultSettings, keyLabel, type Settings } from './settings';
import { relicBonus } from '../core/quests';
import { AudioEngine, type Ground } from '../audio/audio';
import { Input } from './input';
import { Rng } from '../core/rng';
import { FishingSession, type FishingInput, type SpotInfo } from '../core/fishing';
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
  readonly shadows: FishShadows;
  session: FishingSession;
  readonly pos = new Vector3();
  yaw = 0;
  private camYaw = 0; private camPitch = 0.28; private camDist = 5.2;
  private camTarget = new Vector3();
  /** Where the camera looks: the player's head, or out over the water toward the lure or fish while fishing. */
  private camAim = new Vector3();
  private acc = 0;
  private time = 0;
  private speed = 0;
  private rngSeed: number;
  private saveTimer = 0;
  private castYaw = 0;
  private lastTension = 0;
  private shake = 0;
  /** Cast feedback: a field-of-view punch and a forward lunge of the camera on release, both decaying fast. */
  private fovBase = 55; private fovKick = 0; private camKick = 0;
  private lastCast = { power: 0, clean: false };
  private wasSweet = false;
  private aimV = new Vector3();
  private wakeT = 0;
  /** Bots: step and update everything but skip drawing (for frames between screenshots). */
  skipRender = false;
  private talkSwing = 0;
  private stride = 0.5;
  private talkSwingWant: number | null = null;
  private idleSince = 0;
  frames = 0;
  perf: PerfOverlay | null = null;
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
    this.perf = new PerfOverlay(uiRoot, this.renderer.frameInfo, () => {
      const c = this.renderer.gl.domElement;
      return `${this.town.settings.quality} quality · ${c.width}×${c.height}`;
    });
    this.world.hour = state.hour;
    this.world.scene.add(this.avatar.root, this.fx.group);
    this.view = new FishingView(this.fx, (x, z) => this.waveY(x, z), (x, z) => Math.max(this.world.hf.height(x, z), this.world.dockDeckAt(x, z) ?? -99, this.waveY(x, z)));
    this.world.scene.add(this.view.group);
    this.shadows = new FishShadows((x, z) => this.world.hf.depth(x, z), state.seed);
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
    this.camAim.copy(this.camTarget);
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
      const real = (now - last) / 1000;
      const dt = Math.min(0.1, real);
      last = now;
      if (!this.halted) {
        const t0 = performance.now();
        this.frame(dt);
        this.perf?.record(real, performance.now() - t0);
      }
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
      let nx = this.pos.x + Math.sin(a) * this.speed * dt, nz = this.pos.z + Math.cos(a) * this.speed * dt;
      // Slide around houses, the stall, crates and people instead of walking through them.
      for (const [bx, bz, br] of this.blockers()) {
        const dx = nx - bx, dz = nz - bz, d = Math.hypot(dx, dz), min = br + 0.35;
        if (d < min && d > 1e-4) { nx = bx + (dx / d) * min; nz = bz + (dz / d) * min; }
      }
      const gy = this.groundAt(nx, nz);
      if (gy !== null && Math.abs(gy - this.pos.y) < 1.2) {
        this.stride += Math.hypot(nx - this.pos.x, nz - this.pos.z);
        this.pos.x = nx; this.pos.z = nz;
        // A footfall every stride, on whatever is underfoot.
        const running = this.speed > 4.6;
        if (this.stride > (running ? 1.15 : 0.8)) { this.stride = 0; this.audio.step(this.groundUnder(), running); }
      }
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
    // A tick as the charge enters the sweet spot, so it can be timed by ear.
    const sweet = this.session.inSweetSpot;
    if (sweet && !this.wasSweet) this.audio.sweetTick();
    this.wasSweet = sweet;

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
          this.audio.cast(e.power, e.flight, e.clean);
          this.view.beginCast(this.pos, this.castYaw, e.distance, e.flight, e.power, e.clean);
          this.lastCast = { power: e.power, clean: e.clean };
          this.fovKick = 3.5 + 5 * e.power; this.camKick = 0.25 + 0.5 * e.power;
          this.shake = Math.max(this.shake, 0.1 + 0.25 * e.power);
          if (e.clean) this.hud.toast('Clean cast!', 'good');
          break;
        }
        case 'splash':
          this.audio.plop(this.lastCast.power); this.shake = Math.max(this.shake, 0.08 + 0.2 * this.lastCast.power);
          this.shadows.scatter(this.view.target.x, this.view.target.z, 3 + 3 * this.lastCast.power);
          break;
        case 'nibble': this.audio.nibble(); this.view.nibble(); this.shadows.nibble(); break;
        case 'bite': this.audio.bite(); this.shake = 0.25; break;
        case 'hook': {
          const b = s.gear.bait;
          if (b !== 'breadcrumb' && isFinite(s.gear.baits[b] ?? 0)) {
            s.gear.baits[b] = Math.max(0, (s.gear.baits[b] ?? 0) - 1);
            if (s.gear.baits[b] === 0) { s.gear.bait = 'breadcrumb'; this.hud.toast(`Out of ${bait(b).name}: back to breadcrumbs`); }
          }
        }
          this.audio.hook(e.grade === 'perfect'); this.hud.toast(e.grade === 'perfect' ? 'Perfect hook!' : 'Hooked!', e.grade === 'perfect' ? 'gold' : 'good'); this.shake = 0.35; break;
        case 'tooEarly': this.shadows.spook(); this.hud.toast(e.spooked ? 'Too early — you spooked it' : 'Wait for the bobber to go under', 'bad'); break;
        case 'missed': this.shadows.spook(); this.audio.lose(); this.hud.toast('It got away… keep watching', 'bad'); break;
        case 'runWarn': this.audio.warn(); break;
        case 'run': this.shake = 0.2; break;
        case 'thrash': this.shake = 0.6; this.audio.splash(1.2); if (this.view.hooked) this.shadows.scatter(this.view.hooked.x, this.view.hooked.z, 5); break;
        case 'landed': {
          const res = addCatch(s, e.catch);
          this.town.questEvent({ type: 'catch', fishId: e.catch.fishId, weight: e.catch.weight, trait: e.catch.trait, perfect: e.catch.perfectHook });
          const r = rarityIndex(e.catch.fishId);
          this.audio.catchFanfare(r);
          this.audio.landSplash();
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

  /**
   * Conversation camera: a two-shot from one side of the line between the speakers, so the player never
   * stands in front of who they are talking to. Returns the extra yaw; picks the side with a clear view,
   * then the smaller swing.
   */
  private pickTalkSwing(mid: Vector3, npc: Vector3): number {
    const axis = Math.atan2(npc.x - this.pos.x, npc.z - this.pos.z);
    let best = 0, bestCost = Infinity;
    for (const side of [1, -1]) {
      const yaw = axis + side * 0.95;
      let swing = yaw - this.camYaw; swing = Math.atan2(Math.sin(swing), Math.cos(swing));
      let cost = Math.abs(swing);
      for (const d of [1.4, 2.3, 3.3, 4.2]) {
        const x = mid.x - Math.sin(yaw) * d, z = mid.z - Math.cos(yaw) * d;
        for (const [bx, bz, br] of this.world.blockers) if (Math.hypot(x - bx, z - bz) < br + 0.3) cost += 10;
        if (this.world.hf.height(x, z) > mid.y - 0.4) cost += 10;
      }
      if (cost < bestCost) { bestCost = cost; best = swing; }
    }
    return best;
  }

  /** What the player is walking on, for footsteps. */
  private groundUnder(): Ground {
    const { x, z } = this.pos;
    if (this.world.dockDeckAt(x, z) !== null) return 'wood';
    const surf = this.world.hf.surfaceAt(x, z);
    if (surf.kind === 'cobble' && surf.w > 0.4) return 'cobble';
    if (surf.kind === 'dirt' && surf.w > 0.4) return 'sand';
    return this.world.hf.height(x, z) < 1.2 ? 'sand' : 'grass';
  }

  /** Solid things near the player: the world's fixed props plus whoever is standing about. */
  private *blockers(): Iterable<readonly [number, number, number]> {
    yield* this.world.blockers;
    yield* this.town.bodies();
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

    // Camera: orbits behind the player. While fishing it stays over the shoulder and looks out over the
    // water, half-way to the lure or the fish, so the angler, the line and the float share the frame; it
    // chases the lure through its flight.
    const head = this.pos.clone().add(new Vector3(0, 1.6, 0));
    const fishingView = ph === 'fighting' || ph === 'waiting' || ph === 'bite' || ph === 'casting';
    const aim = head.clone(), pivot = head.clone();
    if (fishingView) aim.lerp(this.view.bobberPos, ph === 'fighting' ? 0.45 : ph === 'casting' ? 0.5 : 0.56);
    // In conversation: closer and lower, centred between the two and aimed below their heads, so both
    // stand clear above the dialogue box.
    const talk = fishingView ? null : this.town.talkingTo;
    if (talk) {
      pivot.lerp(_talk.set(talk.x, talk.y + 1.5, talk.z), 0.5); aim.copy(pivot); aim.y -= 0.6;
      if (this.talkSwingWant === null) this.talkSwingWant = this.pickTalkSwing(pivot, talk);
    } else this.talkSwingWant = null;
    this.talkSwing += ((this.talkSwingWant ?? 0) - this.talkSwing) * Math.min(1, dt * 4);
    this.camTarget.lerp(pivot, Math.min(1, dt * 5));
    this.camAim.lerp(aim, Math.min(1, dt * (ph === 'casting' ? 10 : 4)));
    const camYaw = fishingView ? this.castYaw : this.camYaw + this.talkSwing;
    const dist = talk ? Math.min(this.camDist, 4.6) : this.camDist + (ph === 'fighting' ? 2.2 : ph === 'waiting' || ph === 'bite' ? 2.4 : fishingView ? 1.6 : 0);
    // Low behind the angler for the throw, so the lure climbs against the sky; then it cranes up to look down
    // on the float, where the fish shadows are.
    const watching = ph === 'waiting' || ph === 'bite';
    const pitch = talk ? Math.max(0.1, Math.min(this.camPitch, 0.2)) : watching ? Math.max(0.46, Math.min(0.75, this.camPitch + 0.12)) : fishingView ? Math.max(0.16, Math.min(0.6, this.camPitch)) : this.camPitch;
    const shoulder = fishingView ? 1.5 : talk ? 0 : 0.9;
    const want = new Vector3(
      this.camTarget.x - Math.sin(camYaw) * Math.cos(pitch) * dist + Math.cos(camYaw) * shoulder,
      this.camTarget.y + Math.sin(pitch) * dist + 0.3,
      this.camTarget.z - Math.cos(camYaw) * Math.cos(pitch) * dist - Math.sin(camYaw) * shoulder,
    );
    this.camKick *= Math.exp(-dt * 5); this.fovKick *= Math.exp(-dt * 4);
    want.x += Math.sin(this.castYaw) * this.camKick * this.shakeScale; want.z += Math.cos(this.castYaw) * this.camKick * this.shakeScale;
    const ground = this.world.hf.height(want.x, want.z);
    want.y = Math.max(want.y, Math.max(ground, this.waveY(want.x, want.z)) + 0.6);
    this.camera.position.lerp(want, Math.min(1, dt * 6));
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const tension = fs?.tension ?? 0;
    const sh = (this.shake * 0.08 + Math.max(0, tension - 0.8) * 0.03 + (ph === 'charging' ? Math.max(0, this.session.power - 0.75) * 0.05 : 0)) * this.shakeScale;
    this.camera.lookAt(this.camAim.x + (Math.random() - 0.5) * sh, this.camAim.y + (Math.random() - 0.5) * sh, this.camAim.z);
    if (this.debugCam) { this.camera.position.copy(this.debugCam.pos); this.camera.lookAt(this.debugCam.look); }
    // Field of view: closes in as the cast winds up, punches wide on release, tightens with line tension.
    const fovWant = 55 + (ph === 'fighting' ? -4 * tension : 0) + (ph === 'charging' ? -5 * this.session.power : 0) + (ph === 'waiting' || ph === 'bite' ? -7 : 0);
    this.fovBase += (fovWant - this.fovBase) * Math.min(1, dt * (ph === 'charging' ? 9 : 4));
    const fov = this.fovBase + this.fovKick * this.shakeScale;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    // Where the cast being charged would land.
    if (ph === 'charging') {
      const reach = this.session.reachAt(this.session.power);
      const dist = this.session.ctx.spot(reach).distance ?? reach;
      if (dist > 0) {
        this.aimV.set(this.pos.x + Math.sin(this.castYaw) * dist, 0, this.pos.z + Math.cos(this.castYaw) * dist);
        this.view.aim({ target: this.aimV, power: this.session.power, sweet: this.session.inSweetSpot }, this.pos);
      }
    }
    this.view.lureHidden = !this.avatar.rodOut;
    this.view.update(dt, this.session, tip, this.pos);
    // Fish shadows: roaming around the player, and one closing on the float before each nibble and bite.
    const hooked = this.view.hooked;
    this.shadows.update(dt, {
      cx: this.pos.x, cz: this.pos.z,
      lure: ph === 'waiting' || ph === 'bite' ? this.view.target : null,
      nextTug: this.session.nextTug, biting: ph === 'bite',
      fish: fs && hooked ? { x: hooked.x, z: hooked.z, len: Math.max(1.2, Math.min(3.2, fs.fish.length * 3.6)) } : null,
    }, this.world.water.fishA, this.world.water.fishB, this.world.water.fishField);
    // The biter stirs the surface as it comes: slow rings while it circles, a quick wake when it darts.
    const bt = this.shadows.biter;
    this.wakeT -= dt;
    if (bt.mode === 'stalk' && bt.alpha > 0.5 && this.wakeT <= 0) {
      const near = Math.hypot(bt.x - this.view.target.x, bt.z - this.view.target.z) < 3.2;
      this.wakeT = bt.speed > 3 ? 0.07 : near ? 0.5 : 1.1;
      this.fx.ripples.spawn(this.aimV.set(bt.x, 0, bt.z), Math.min(1.3, 0.55 + 0.14 * bt.speed), bt.speed > 3 ? 0.5 : 0.9);
    }
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

    const night = this.world.light.night;
    this.audio.update(dt, {
      reeling: !!fs && this.input.held('cast'), reelSpeed: rod(s.gear.rod).power / 3, tension, fighting: !!fs, sea: 0.5,
      charge: ph === 'charging' ? this.session.power : -1,
      // The night theme comes in once the sky is properly dark and leaves at first light.
      music: this.town.island === 'gull-point' ? 'gull-point' : night > 0.6 ? 'hearthbay-night' : night < 0.4 ? 'hearthbay-day' : undefined,
      day: 1 - night, onDock: this.world.dockDeckAt(this.pos.x, this.pos.z) !== null, purr: this.town.catCloseness(),
    });
    if (fs && tension > 0.9 && this.lastTension <= 0.9) this.audio.strain();
    this.lastTension = tension;

    if (!this.skipRender) this.renderer.render(dt);
  }

  private hint(): string {
    const ph = this.session.phase;
    if (!this.input.locked && !this.botInput) return 'Click to look around';
    // Named from the current bindings, so rebinding a key changes the hint too.
    const b = this.input.bindings;
    const k = (a: keyof typeof b) => `<kbd>${shortKey(b[a][0])}</kbd>`;
    const moves = [b.forward[0], b.left[0], b.back[0], b.right[0]];
    const walk = moves.join() === 'KeyW,KeyA,KeyS,KeyD' ? '<kbd>WASD</kbd>' : moves.map((c) => `<kbd>${shortKey(c)}</kbd>`).join('');
    switch (ph) {
      case 'idle': return `${k('cast')} hold to cast · ${walk} walk · ${k('sprint')} run`;
      case 'charging': return 'Release in the bright band for a clean cast';
      case 'waiting': return `Watch the water… hook it when the float goes under · ${k('cancel')} reel in`;
      case 'bite': return `${k('cast')} Hook it!`;
      case 'fighting': return `${k('cast')} hold to reel · ${k('steerLeft')}/${k('steerRight')} steer against runs · let go when tension peaks`;
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

const _talk = new Vector3();
const keyName = (code: string) => (code ? keyLabel(code) : '?');
/** Compact key names for the hint line. */
const shortKey = (code: string) => ({ Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl' } as Record<string, string>)[code] ?? keyName(code);
const RARITY_GLOW = ['#D8D2C4', '#9BD06F', '#6FB7FF', '#C98CFF', '#FFC05C', '#7CFFD4'].map((c) => new Color(c));
