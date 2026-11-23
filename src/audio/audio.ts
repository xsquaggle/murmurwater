/**
 * Audio engine: mixer buses (master, music, sfx, voice, ambience), the recorded sound bank
 * (public/audio/sfx, see docs/ASSETS.md), looping music with crossfades, and a few procedural sounds.
 *
 * Every recorded one-shot has a small synth stand-in that plays if its file has not loaded (or is missing),
 * so the game is never silent. The cast charge creak, the line hum and the interface chimes are procedural
 * by design: they follow a value that changes every frame.
 */
import present from 'virtual:audio-list';

export type Bus = 'music' | 'sfx' | 'voice' | 'ambience';
export type Track = 'hearthbay-day' | 'hearthbay-night' | 'gull-point' | 'open-water';
export type Ground = 'wood' | 'cobble' | 'grass' | 'sand';

/** Recorded one-shots: [variations, volume]. Files are `audio/sfx/<name>_<n>.ogg`, n from 1. */
const SFX = {
  'cast-swish': [4, 0.95], 'reel-spin': [3, 0.5], 'bobber-plop': [3, 0.85], 'nibble': [4, 1.25], 'bite-dunk': [3, 1], 'hook-set': [3, 0.8],
  'line-creak': [3, 0.9], 'fish-splash': [4, 0.8], 'land-splash': [3, 0.75], 'coins': [4, 0.8], 'line-snap': [3, 0.9],
  'quest-accept': [3, 1.6], 'step-wood': [4, 0.42], 'step-cobble': [4, 0.4], 'step-grass': [4, 0.4], 'step-sand': [4, 0.4],
  'ui-open': [4, 0.7], 'ui-close': [4, 0.7], 'ui-click': [4, 0.4], 'page-turn': [3, 0.6], 'lamp-ignite': [3, 0.95], 'oars': [4, 0.75],
  'gulls': [4, 0.42], 'dock-creak': [4, 0.4], 'cat-meow': [3, 0.7],
  // Sailing
  'sail-flap': [3, 0.7], 'boat-bump': [3, 0.9], 'rope-creak': [3, 0.5], 'boat-board': [2, 0.8], 'chart-open': [2, 0.7],
  'chest-open': [2, 0.8],
  // Lantern Pots and the Drowned Bell
  'pot-set': [1, 0.8], 'pot-haul': [2, 0.85], 'bell-toll': [1, 1], 'echo-buy': [1, 0.8], 'tide-turn': [1, 0.9],
  // The sea-road and Mossglass Fen
  'fog-lamp-light': [1, 0.9], 'sea-road-chime': [3, 0.7], 'fog-cross': [1, 0.9], 'packet-box': [1, 0.8], 'reed-brush': [2, 0.6],
  // Hands aboard, the boatyard and the Puffin
  // (The cat's two are recorded 4 to 7 dB under the rest, held down by sharp peaks, and play at full gain for it.)
  'cat-catch': [2, 1], 'cat-eat': [1, 1], 'hollis-catch': [2, 0.75], 'hollis-thin': [1, 0.8], 'hollis-thick': [1, 0.8],
  'crew-basket-full': [1, 0.8], 'boatyard': [1, 0.9], 'sloop-sail': [1, 0.75],
  // Things fished up, the Keeper's Shelf and Moonpearls
  'find-drag': [2, 0.85], 'haul-knock': [3, 0.9], 'haul-snag': [2, 0.9], 'haul-free': [2, 0.7], 'find-surface': [2, 0.85],
  'crate-open': [2, 0.8], 'relic-found': [1, 0.9], 'rumour': [1, 0.7], 'pearl-set': [2, 0.8], 'pearl-lift': [1, 0.7],
} as const satisfies Record<string, readonly [number, number]>;
export type Sfx = keyof typeof SFX;
/** Seamless loops (first variation is used). */
const LOOPS = ['reel-click', 'waves-lap', 'cat-purr', 'hull-wash', 'murmur', 'fen-day', 'fen-night'] as const;
type Loop = (typeof LOOPS)[number];
/**
 * Sounds that have been asked for and may not be recorded yet (docs/briefs). Until its files are in the build
 * such a sound is not fetched and not counted as missing, and its synth stand-in plays; from the first build
 * after they land it is used, with nothing to change here.
 */
const PENDING: ReadonlySet<string> = new Set<string>([
  // docs/briefs/finds-assets.md: the five heard on every haul are in; these five are still to come
  'crate-open', 'relic-found', 'rumour', 'pearl-set', 'pearl-lift',
]);
const BUILT_IN: ReadonlySet<string> = new Set(present);
/** Is this sound to be loaded? Everything is, but a pending one whose first file is not in the build. */
const wanted = (name: string) => !PENDING.has(name) || BUILT_IN.has(`audio/sfx/${name}_1.ogg`);

/** `pick` chooses the variation (0 is the first, and it wraps) instead of leaving it to chance. */
interface SfxOpts { gain?: number; rate?: number; at?: number; vary?: number; bus?: Bus; dur?: number; pick?: number }
export interface AudioState {
  reeling: boolean; reelSpeed: number; tension: number; fighting: boolean; sea: number;
  /** Cast charge 0..1, or -1 when not charging. */
  charge?: number;
  /** Which music should be playing: a track, null for none, or undefined to leave it as it is. */
  music?: Track | null;
  /** 0 (night) .. 1 (full day): gulls call by day. */
  day?: number;
  /** Standing on the dock: it creaks now and then. */
  onDock?: boolean;
  /** 0..1 closeness to the cat: it purrs when you stand by it. */
  purr?: number;
  /** Aboard a boat: 0..1 how fast she is going (the wash along the hull), or undefined ashore. */
  hull?: number;
  /** 0..1: the murmur at the edge of the region. */
  murmur?: number;
  /** In a fen: frogs and insects instead of gulls. */
  fen?: boolean;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private analyser!: AnalyserNode;
  private noiseBuf!: AudioBuffer;
  private reelGain!: GainNode; private reelTimer = 0; private reelRate = 0;
  private humOsc!: OscillatorNode; private humGain!: GainNode;
  private seaGain!: GainNode; private seaFilter!: BiquadFilterNode;
  private chargeGain!: GainNode; private chargeFilter!: BiquadFilterNode; private chargeOsc!: OscillatorNode; private chargeTone!: GainNode;
  private washGain!: GainNode; private washFilter!: BiquadFilterNode;
  private murmurGain!: GainNode; private murmurLfo = 0;
  volumes = { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9, ambience: 0.6 };
  private files = new Map<string, AudioBuffer>();

  // Sound bank
  private bank = new Map<string, AudioBuffer>();
  private lastPick = new Map<string, number>();
  private bankLoad: Promise<string[]> | null = null;
  private loops = new Map<Loop, { src: AudioBufferSourceNode; gain: GainNode }>();
  /** How many times each sound has played (for the audio bot and for debugging). */
  readonly played: Record<string, number> = {};

  // Music
  private musicDuck!: GainNode;
  private track: Track | null = null;
  private trackGen = 0;
  private playing: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private voices = 0;

  private gullTimer = 6; private creakTimer = 4; private ropeTimer = 5;

  /** Must be called from a user gesture (browser autoplay rules). */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048; this.master.connect(this.analyser);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    comp.connect(this.master);
    for (const b of ['music', 'sfx', 'voice', 'ambience'] as Bus[]) { const g = ctx.createGain(); g.connect(comp); this.buses[b] = g; }
    this.musicDuck = ctx.createGain(); this.musicDuck.connect(this.buses.music);
    this.applyVolumes();
    // Shared noise buffer
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Sea bed: a soft wash of filtered noise under the recorded waves.
    const sea = ctx.createBufferSource(); sea.buffer = this.noiseBuf; sea.loop = true;
    this.seaFilter = ctx.createBiquadFilter(); this.seaFilter.type = 'lowpass'; this.seaFilter.frequency.value = 500;
    this.seaGain = ctx.createGain(); this.seaGain.gain.value = 0.12;
    sea.connect(this.seaFilter).connect(this.seaGain).connect(this.buses.ambience); sea.start();
    // Line hum
    this.humOsc = ctx.createOscillator(); this.humOsc.type = 'sawtooth'; this.humOsc.frequency.value = 110;
    const humF = ctx.createBiquadFilter(); humF.type = 'bandpass'; humF.frequency.value = 900; humF.Q.value = 4;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    this.humOsc.connect(humF).connect(this.humGain).connect(this.buses.sfx); this.humOsc.start();
    this.reelGain = ctx.createGain(); this.reelGain.gain.value = 0.5; this.reelGain.connect(this.buses.sfx);
    // Rod loading up as a cast is charged: a tightening creak that rises with power.
    const creak = ctx.createBufferSource(); creak.buffer = this.noiseBuf; creak.loop = true;
    this.chargeFilter = ctx.createBiquadFilter(); this.chargeFilter.type = 'bandpass'; this.chargeFilter.frequency.value = 260; this.chargeFilter.Q.value = 7;
    this.chargeGain = ctx.createGain(); this.chargeGain.gain.value = 0;
    creak.connect(this.chargeFilter).connect(this.chargeGain).connect(this.buses.sfx); creak.start();
    this.chargeOsc = ctx.createOscillator(); this.chargeOsc.type = 'triangle'; this.chargeOsc.frequency.value = 150;
    this.chargeTone = ctx.createGain(); this.chargeTone.gain.value = 0;
    this.chargeOsc.connect(this.chargeTone).connect(this.buses.sfx); this.chargeOsc.start();
    // Water along the hull while sailing: a brighter wash that grows with speed.
    const wash = ctx.createBufferSource(); wash.buffer = this.noiseBuf; wash.loop = true;
    this.washFilter = ctx.createBiquadFilter(); this.washFilter.type = 'bandpass'; this.washFilter.frequency.value = 700; this.washFilter.Q.value = 0.5;
    this.washGain = ctx.createGain(); this.washGain.gain.value = 0;
    wash.connect(this.washFilter).connect(this.washGain).connect(this.buses.ambience); wash.start(0, 0.7);
    // The murmur at the edge of the map: a low fifth that beats slowly, under a breath of noise.
    this.murmurGain = ctx.createGain(); this.murmurGain.gain.value = 0; this.murmurGain.connect(this.buses.ambience);
    for (const [f, g] of [[58.3, 0.5], [87.6, 0.32], [116.9, 0.12]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(this.murmurGain); o.start();
    }
    const breath = ctx.createBufferSource(); breath.buffer = this.noiseBuf; breath.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 320; bf.Q.value = 1.4;
    const bg = ctx.createGain(); bg.gain.value = 0.35; breath.connect(bf).connect(bg).connect(this.murmurGain); breath.start(0, 1.3);
    void this.preload();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    for (const b of ['music', 'sfx', 'voice', 'ambience'] as Bus[]) this.buses[b].gain.value = this.volumes[b];
  }

  // ---- sound bank ----
  private async decode(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx; if (!ctx) return null;
    try { const r = await fetch(url); if (!r.ok) return null; return await ctx.decodeAudioData(await r.arrayBuffer()); }
    catch { return null; }
  }

  /** Loads every recorded sound; resolves with the names of files that could not be loaded. Safe to call twice. */
  preload(): Promise<string[]> {
    if (!this.ctx) this.start();
    if (this.bankLoad) return this.bankLoad;
    const names: string[] = [];
    for (const [name, [n]] of Object.entries(SFX)) if (wanted(name)) for (let i = 1; i <= n; i++) names.push(`${name}_${i}`);
    for (const l of LOOPS) if (wanted(l)) names.push(`${l}_1`);
    const missing: string[] = [];
    const queue = [...names];
    const worker = async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        const buf = await this.decode(`audio/sfx/${key}.ogg`);
        if (buf) this.bank.set(key, buf); else missing.push(key);
      }
    };
    this.bankLoad = Promise.all(Array.from({ length: 8 }, worker)).then(() => { this.startLoops(); return missing; });
    return this.bankLoad;
  }

  private startLoops() {
    const ctx = this.ctx; if (!ctx) return;
    for (const l of LOOPS) {
      const buf = this.bank.get(`${l}_1`); if (!buf || this.loops.has(l)) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(gain).connect(this.buses[l === 'reel-click' ? 'sfx' : 'ambience']); src.start();
      this.loops.set(l, { src, gain });
    }
  }

  /** Plays a recorded sound (a different variation from last time). Returns false if it isn't loaded. */
  sfx(name: Sfx, o: SfxOpts = {}): boolean {
    const ctx = this.ctx; if (!ctx) return false;
    const [n, vol] = SFX[name];
    let i = o.pick !== undefined ? 1 + (((o.pick % n) + n) % n) : 1 + Math.floor(Math.random() * n);
    if (o.pick === undefined && n > 1 && i === this.lastPick.get(name)) i = 1 + (i % n);
    const buf = this.bank.get(`${name}_${i}`);
    if (!buf) return false;
    this.lastPick.set(name, i);
    this.played[name] = (this.played[name] ?? 0) + 1;
    const t = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const vary = o.vary ?? 0.04;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
    const g = ctx.createGain(); const level = vol * (o.gain ?? 1);
    g.gain.setValueAtTime(level, t);
    src.connect(g).connect(this.buses[o.bus ?? 'sfx']); src.start(t);
    if (o.dur !== undefined) { g.gain.setValueAtTime(level, t + o.dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + o.dur); src.stop(t + o.dur + 0.02); }
    return true;
  }

  // ---- synth helpers ----
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private noise(dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass', sweepTo?: number, at = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); this.env(g, t, 0.005, peak, dur);
    src.connect(f).connect(g).connect(this.buses.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, peak: number, type: OscillatorType = 'sine', at = 0, slideTo?: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); this.env(g, t, 0.01, peak, dur);
    o.connect(g).connect(this.buses.sfx); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- fishing ----
  /** The throw: the rod's swish, then the reel paying out for the length of the flight; a chime for a clean cast. */
  cast(power: number, flight: number, clean: boolean) {
    if (!this.sfx('cast-swish', { gain: 0.6 + 0.5 * power, rate: 0.9 + 0.22 * power })) {
      this.noise(0.16 + power * 0.1, 700, 0.9, 0.3 + power * 0.3, 'bandpass', 5200);
      this.noise(0.09, 2600, 0.7, 0.1 + power * 0.14, 'highpass', undefined, 0.07);
    }
    if (!this.sfx('reel-spin', { gain: 0.5 + 0.5 * power, rate: 0.95 + 0.25 * power, at: 0.07, dur: flight })) {
      this.noise(flight, 2400 + power * 1200, 2.5, 0.04 + power * 0.05, 'bandpass', 1300, 0.08);
      // Free-spooling reel: ticks that thin out as the lure runs out of speed.
      const n = Math.round(flight * 26);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        this.noise(0.012, 3300 + Math.random() * 500, 6, 0.1 * (1 - 0.6 * k) * (0.5 + 0.5 * power), 'bandpass', undefined, 0.08 + flight * (1 - Math.pow(1 - k, 1 / 1.3)));
      }
    }
    if (clean) { this.tone(988, 0.1, 0.1, 'sine', 0.02); this.tone(1480, 0.22, 0.09, 'sine', 0.09); }
  }
  /** The charge entering the sweet spot. */
  sweetTick() { this.tone(1760, 0.05, 0.08, 'sine'); }
  /** A fish thrashing at the surface; `size` around 1. */
  splash(size = 1) {
    if (this.sfx('fish-splash', { gain: 0.35 + 0.5 * size, rate: 1.1 - 0.12 * size })) return;
    this.noise(0.5 * size + 0.2, 1400, 0.7, 0.35 * size, 'lowpass', 300); this.noise(0.15, 3000, 1.5, 0.15 * size, 'highpass');
  }
  /** The fish coming out of the water at the end of a fight. */
  landSplash() { if (!this.sfx('land-splash')) this.splash(0.8); }
  /** The lure hitting the water; `size` 0..1 is how hard it was thrown. */
  plop(size = 0.5) {
    if (this.sfx('bobber-plop', { gain: 0.6 + 0.55 * size, rate: 1.08 - 0.2 * size })) return;
    this.tone(560 - 160 * size, 0.12 + 0.05 * size, 0.2 + 0.12 * size, 'sine', 0, 170 - 40 * size);
    this.noise(0.2 + 0.25 * size, 1000 + 500 * size, 0.8, 0.1 + 0.2 * size, 'lowpass', 280);
    this.noise(0.1, 3200, 1.2, 0.05 + 0.1 * size, 'highpass');
  }
  nibble() { if (!this.sfx('nibble', { vary: 0.08 })) this.tone(300 + Math.random() * 80, 0.06, 0.12, 'sine', 0, 200); }
  bite() { if (!this.sfx('bite-dunk')) { this.noise(0.4, 1800, 0.8, 0.45, 'lowpass', 250); this.tone(180, 0.25, 0.3, 'triangle', 0, 70); } }
  hook(perfect: boolean) {
    if (!this.sfx('hook-set', { rate: perfect ? 1.08 : 1 })) { this.tone(perfect ? 880 : 660, 0.12, 0.3, 'triangle'); this.noise(0.08, 2500, 2, 0.2); }
    if (perfect) { this.tone(1320, 0.18, 0.12, 'sine', 0.05); this.tone(1976, 0.22, 0.07, 'sine', 0.11); }
  }
  snap() { if (!this.sfx('line-snap')) { this.tone(1400, 0.4, 0.35, 'sawtooth', 0, 90); this.noise(0.25, 4000, 1, 0.3, 'highpass'); } }
  lose() { this.tone(330, 0.3, 0.15, 'triangle', 0, 220); }
  warn() { this.tone(740, 0.08, 0.12, 'square'); this.tone(740, 0.08, 0.12, 'square', 0.12); }
  /** The line close to breaking. */
  strain() { this.sfx('line-creak', { gain: 1, vary: 0.1 }); this.warn(); }
  catchFanfare(rarity: number) {
    // Rare and better get the recorded sting; everything keeps a short rising run so common fish still feel good.
    if (rarity >= 2) void this.play('audio/music/sting-rare.ogg', 'music', 0.9);
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const n = rarity >= 2 ? 3 : 3 + rarity;
    for (let i = 0; i < n; i++) this.tone(scale[i % scale.length], 0.35, rarity >= 2 ? 0.09 : 0.16, 'triangle', i * 0.07);
    if (rarity >= 5) for (let i = 0; i < 4; i++) this.tone(311 * (1 + i * 0.5), 1.2, 0.08, 'sine', 0.3 + i * 0.1); // uncanny undertone
  }

  // ---- town ----
  coin(n = 1) {
    if (this.sfx('coins', { gain: 0.7 + 0.04 * Math.min(8, n) })) { if (n >= 5) this.sfx('coins', { gain: 0.6, at: 0.16, rate: 1.06 }); return; }
    for (let i = 0; i < Math.min(8, n); i++) this.tone(1568 + (i % 3) * 200, 0.12, 0.12, 'square', i * 0.05);
  }
  click() { if (!this.sfx('ui-click')) this.tone(1200, 0.03, 0.08, 'square'); }
  uiOpen() { this.sfx('ui-open'); }
  uiClose() { this.sfx('ui-close'); }
  pageTurn() { if (!this.sfx('page-turn', { vary: 0.08 })) this.click(); }
  questAccept() { if (!this.sfx('quest-accept')) { this.tone(880, 0.12, 0.3, 'triangle'); this.tone(1320, 0.18, 0.2, 'sine', 0.06); } }
  /** A quest's objectives are met: the accept chime, a third higher. */
  questReady() { if (!this.sfx('quest-accept', { rate: 1.26, vary: 0, gain: 0.85 })) { this.tone(1108, 0.12, 0.3, 'triangle'); this.tone(1661, 0.18, 0.2, 'sine', 0.06); } }
  /** A quest handed in. */
  questDone() { void this.play('audio/music/sting-quest.ogg', 'music', 1).then((s) => { if (!s) this.catchFanfare(1); }); }
  lampIgnite() { this.sfx('lamp-ignite', { vary: 0 }); }
  oars() { if (!this.sfx('oars')) { this.splash(0.4); return; } this.sfx('oars', { at: 0.9, gain: 0.8 }); }
  step(ground: Ground, running: boolean) { this.sfx(`step-${ground}`, { gain: running ? 1 : 0.75, vary: 0.09 }); }
  meow() { this.sfx('cat-meow', { bus: 'ambience', gain: 1 }); }

  // ---- sailing ----
  /** Stepping into or out of a boat: a foot on the boards and the hull knocking. */
  boatBoard() {
    if (this.sfx('boat-board')) return;
    this.tone(92, 0.16, 0.34, 'sine', 0, 58); this.noise(0.09, 420, 1.2, 0.2, 'lowpass');
    this.tone(74, 0.2, 0.2, 'sine', 0.13, 50); this.noise(0.3, 900, 0.7, 0.07, 'lowpass', 300, 0.1);
  }
  /** The hull striking a shore, a rock or the dock; `hard` 0..1. */
  boatBump(hard = 0.5) {
    if (this.sfx('boat-bump', { gain: 0.5 + 0.6 * hard, rate: 1.1 - 0.2 * hard })) return;
    this.tone(70 + 30 * (1 - hard), 0.22 + 0.15 * hard, 0.3 + 0.35 * hard, 'sine', 0, 42);
    this.noise(0.12, 300, 1, 0.14 + 0.2 * hard, 'lowpass'); this.noise(0.5, 1200, 0.7, 0.05 + 0.12 * hard, 'lowpass', 300, 0.04);
  }
  /** The sail swinging across. */
  sailFlap() {
    if (this.sfx('sail-flap', { vary: 0.1 })) return;
    this.noise(0.1, 500, 0.6, 0.22, 'lowpass', 180); this.noise(0.16, 380, 0.6, 0.16, 'lowpass', 140, 0.11);
  }
  /** A halyard run through its block: the sail coming down. */
  ropeCreak() { if (!this.sfx('rope-creak', { gain: 0.9, vary: 0.1 })) this.noise(0.25, 700, 0.8, 0.08, 'bandpass', 500); }
  chartOpen() { if (!this.sfx('chart-open')) this.pageTurn(); }
  /** A sea chest's lid: a creak with the clink of what is inside (the recording has both). */
  chestOpen() { if (!this.sfx('chest-open')) this.coin(8); }
  // ---- things fished up ----
  /** The float drawn slowly under by something that is not a fish: a long low gulp. */
  drag() { if (!this.sfx('find-drag')) { this.noise(0.9, 320, 0.8, 0.2, 'lowpass', 110); this.tone(110, 0.8, 0.13, 'sine', 0, 68); } }
  /** The strike has it: the rod takes a dead weight. */
  haulStart() { this.sfx('line-creak', { gain: 0.8, rate: 0.8, vary: 0.05 }); this.tone(82, 0.32, 0.24, 'sine', 0.02, 50); }
  /** It knocks on the bottom, felt up the line: the warning to let go of the reel. */
  knock() {
    if (this.sfx('haul-knock', { vary: 0.07 })) return;
    // Only if the recording will not play. Not the hull's bump: the player knows that sound as something else.
    this.tone(96, 0.16, 0.34, 'sine', 0, 60); this.noise(0.08, 380, 1.2, 0.18, 'lowpass');
    this.tone(196, 0.09, 0.1, 'triangle', 0, 150);
  }
  /** It has caught fast. */
  snag() {
    if (this.sfx('haul-snag')) return;
    this.sfx('line-creak', { gain: 1.1, rate: 0.74, vary: 0.05 });
    this.tone(70, 0.32, 0.34, 'sine', 0, 44); this.noise(0.2, 300, 1, 0.2, 'lowpass');
  }
  /** It comes free of the bottom, or slides over what it knocked on. */
  eased() { if (!this.sfx('haul-free', { vary: 0.08 })) { this.tone(330, 0.16, 0.07, 'sine', 0, 262); this.noise(0.35, 1200, 0.7, 0.07, 'lowpass', 400); } }
  /** A heavy thing breaking the surface with the water running off it. */
  findUp() { if (!this.sfx('find-surface')) { this.landSplash(); this.noise(0.9, 1800, 0.6, 0.11, 'bandpass', 500, 0.15); } }
  /** A crate prised open, or a sea chest's lid: wood, and what is inside. */
  crateOpen(chest: boolean) {
    if (chest) { this.chestOpen(); return; }
    if (!this.sfx('crate-open')) { if (!this.sfx('chest-open', { rate: 1.22, gain: 0.7 })) this.noise(0.18, 900, 1.2, 0.2, 'bandpass', 400); this.coin(3); }
  }
  /** A relic in the hands: a glass note, and under it something that is not quite in tune. */
  relicFound() {
    if (this.sfx('relic-found')) return;
    [622.25, 932.33, 1244.5, 1864.66].forEach((f, i) => this.tone(f, 1.1, 0.1, 'sine', i * 0.13));
    for (let i = 0; i < 3; i++) this.tone(311 * (1 + i * 0.5), 1.6, 0.07, 'sine', 0.35 + i * 0.12);
    this.tone(2489, 0.5, 0.04, 'triangle', 0.5);
  }
  /** Something is said of a thing still in the water. */
  rumour() {
    if (this.sfx('rumour')) return;
    this.sfx('page-turn', { gain: 0.8, rate: 0.9 });
    this.tone(587.33, 0.5, 0.07, 'sine', 0.06); this.tone(880, 0.8, 0.05, 'sine', 0.22);
  }
  /** A Moonpearl set into the hollow beside a relic, and lifted out again. */
  pearlSet() { if (!this.sfx('pearl-set', { vary: 0.06 })) { this.noise(0.03, 3000, 2, 0.08); this.tone(1568, 0.26, 0.12, 'sine', 0.01); this.tone(2349.3, 0.45, 0.07, 'sine', 0.07); } }
  pearlLift() { if (!this.sfx('pearl-lift')) { this.tone(2349.3, 0.14, 0.08, 'sine'); this.tone(1568, 0.3, 0.09, 'sine', 0.05); } }

  // ---- Lantern Pots and the Drowned Bell ----
  /** A pot going into the water: the float's plop and the basket sinking after it. */
  potSet() { if (!this.sfx('pot-set')) { this.plop(0.9); this.noise(0.5, 500, 0.7, 0.12, 'lowpass', 160, 0.12); } }
  /** A pot coming up: water running off wicker, and fish. */
  potHaul(fish = 1) {
    if (this.sfx('pot-haul', { gain: 0.8 + 0.05 * Math.min(6, fish) })) return;
    this.noise(0.55, 900, 0.6, 0.28, 'bandpass', 2600); this.splash(0.5 + 0.1 * Math.min(5, fish));
  }
  /** A fish finding its way into a pot nearby: barely there. */
  potCatch(gain = 1) { if (!this.sfx('nibble', { gain: 0.5 * gain, rate: 0.7, vary: 0.1 })) this.tone(240, 0.08, 0.05 * gain, 'sine', 0, 150); }
  /** The Drowned Bell: one stroke, long in dying. Synthesised from a bell's partials until the recording lands. */
  bellToll(gain = 1) {
    if (this.sfx('bell-toll', { gain, vary: 0 })) return;
    const f = 174.6;
    for (const [ratio, peak, dur] of [[0.5, 0.3, 5.5], [1, 0.26, 4.5], [1.19, 0.2, 3.6], [1.5, 0.14, 2.8], [2, 0.16, 2.4], [2.51, 0.08, 1.6], [3.01, 0.06, 1.2], [4.1, 0.04, 0.8]] as const) this.tone(f * ratio, dur, peak * gain, 'sine');
    this.noise(0.05, 2400, 1.2, 0.2 * gain, 'bandpass');
  }
  /** The tide turning: the sea drawing a long way back. */
  tideTurn() {
    if (this.sfx('tide-turn', { vary: 0 })) return;
    this.noise(3.4, 220, 0.5, 0.4, 'lowpass', 1400); this.noise(2.6, 1800, 0.7, 0.12, 'bandpass', 300, 1.2);
    this.tone(87.3, 3.6, 0.16, 'sine', 0.2, 58);
  }
  /** An Echo spent: a figure that sounds as if it were being remembered rather than played. */
  echoBuy() {
    if (this.sfx('echo-buy')) return;
    [880, 659.25, 783.99, 1174.66].forEach((fr, i) => { this.tone(fr, 0.7, 0.1, 'sine', i * 0.09); this.tone(fr * 1.003, 0.9, 0.05, 'triangle', i * 0.09 + 0.22); });
  }

  // ---- the sea-road and Mossglass Fen ----
  /** The Fog Lamp lighting itself: a soft whoomp and a glassy ring. */
  fogLampLight() {
    if (this.sfx('fog-lamp-light', { vary: 0 })) return;
    this.noise(0.35, 260, 0.7, 0.3, 'lowpass', 90); this.tone(110, 0.3, 0.16, 'sine', 0, 70);
    this.tone(1567.98, 1.1, 0.07, 'sine', 0.08); this.tone(2349.32, 0.8, 0.04, 'sine', 0.1); this.tone(3135.96, 0.5, 0.02, 'sine', 0.12);
  }
  /** A light of the sea-road answering as the boat passes: one far, glassy bell note. `i` picks the note. */
  roadChime(i = 0, gain = 1) {
    if (this.sfx('sea-road-chime', { gain, vary: 0.01, pick: i })) return; // the three recordings rise: A, B, D
    const f = [1046.5, 1174.66, 1396.91][((i % 3) + 3) % 3];
    this.tone(f, 1.5, 0.075 * gain, 'sine'); this.tone(f * 2.76, 0.5, 0.022 * gain, 'sine'); this.tone(f * 0.5, 1.2, 0.03 * gain, 'sine', 0.02);
  }
  /** The middle of the crossing: a low breath of wind with the murmur under it, swelling and falling. */
  fogCross() {
    if (this.sfx('fog-cross', { vary: 0 })) return;
    this.noise(4.2, 240, 0.5, 0.26, 'lowpass', 520); this.tone(65.4, 4.2, 0.12, 'sine', 0.3, 61); this.tone(98, 3.6, 0.07, 'sine', 0.6, 92);
  }
  /** Mara's packet box taking a catch: lid, rope, coins. */
  packetBox(n = 3) {
    // The recording is latch and lid, rope, then coins from 0.85 s: with nothing sold it stops before the coins.
    if (this.sfx('packet-box', n > 0 ? {} : { dur: 0.8 })) return;
    this.tone(120, 0.12, 0.22, 'sine', 0, 80); this.noise(0.3, 700, 0.8, 0.08, 'bandpass', 500, 0.1); this.coin(n);
  }
  /** A hull pushing through reeds. */
  reedBrush(gain = 1) { if (!this.sfx('reed-brush', { gain, vary: 0.12 })) this.noise(0.7, 2600, 0.6, 0.1 * gain, 'bandpass', 1500); }

  // ---- hands aboard, the boatyard and the Puffin (each with a synth stand-in for a build without its recording) ----
  /** Biscuit hooks a fish out: a small quick splash, a wet flap on wood, a chirrup. */
  catCatch(gain = 1) {
    if (this.sfx('cat-catch', { gain, vary: 0.06 })) return;
    this.noise(0.14, 2400, 0.8, 0.16 * gain, 'bandpass', 900); this.noise(0.07, 500, 1, 0.14 * gain, 'lowpass', 220, 0.2);
    this.tone(880, 0.09, 0.05 * gain, 'triangle', 0.36, 1320); this.tone(1320, 0.1, 0.04 * gain, 'triangle', 0.45, 1560);
  }
  /** One for her: small crunching, and a purr under it. */
  catEat(gain = 1) {
    if (this.sfx('cat-eat', { gain, vary: 0.05 })) return;
    for (let i = 0; i < 6; i++) this.noise(0.05, 3200 - i * 150, 1.4, 0.07 * gain, 'bandpass', undefined, 0.15 + i * 0.27);
    this.tone(27, 1.9, 0.09 * gain, 'sawtooth', 0.1);
  }
  /** Mister Hollis lands one: line drawn through a mitten, a drip, and one low breathy note, as if the fog had said "ah". */
  hollisCatch(gain = 1) {
    if (this.sfx('hollis-catch', { gain, vary: 0.04 })) return;
    this.noise(0.5, 1500, 0.6, 0.06 * gain, 'bandpass', 700); this.tone(1400, 0.06, 0.04 * gain, 'sine', 0.62, 900);
    this.noise(0.9, 420, 2.2, 0.1 * gain, 'bandpass', 360, 0.7); this.tone(196, 0.9, 0.05 * gain, 'sine', 0.75, 185);
  }
  /** Dawn: he thins. A long breath out, the note falling away. */
  hollisThin() {
    if (this.sfx('hollis-thin', { vary: 0 })) return;
    this.noise(2.3, 700, 0.8, 0.09, 'bandpass', 240); this.tone(220, 2.2, 0.05, 'sine', 0.1, 147);
  }
  /** Dusk or fog: he is there again. A breath in, the note arriving. */
  hollisThick() {
    if (this.sfx('hollis-thick', { vary: 0 })) return;
    this.noise(2.1, 260, 0.8, 0.09, 'bandpass', 760); this.tone(147, 2.2, 0.05, 'sine', 0.2, 220);
  }
  /** The crew basket is full: a wicker creak and two knocks on wood. */
  basketFull() {
    if (this.sfx('crew-basket-full', { vary: 0.03 })) return;
    this.noise(0.22, 900, 3, 0.1, 'bandpass', 600);
    for (const at of [0.3, 0.48]) { this.tone(180, 0.08, 0.2, 'sine', at, 120); this.noise(0.04, 1200, 1, 0.08, 'bandpass', undefined, at); }
  }
  /** Pell's refit, heard under a black screen: mallet, saw, plane, and a hull sliding into the water. */
  boatyard() {
    if (this.sfx('boatyard', { vary: 0 })) return;
    for (const at of [0.2, 0.75, 1.3]) { this.tone(150, 0.1, 0.26, 'sine', at, 90); this.noise(0.05, 1500, 1, 0.1, 'bandpass', undefined, at); }
    for (let i = 0; i < 4; i++) this.noise(0.26, i % 2 ? 1300 : 1900, 1.5, 0.11, 'bandpass', i % 2 ? 1900 : 1300, 1.9 + i * 0.3);
    this.noise(0.7, 2600, 0.8, 0.07, 'bandpass', 3400, 3.3);
    this.noise(1.5, 300, 0.6, 0.22, 'lowpass', 900, 4.2); this.noise(0.5, 1600, 0.7, 0.14, 'bandpass', 500, 5.3);
  }
  /** The Puffin's bigger sail filling: a deeper thump of canvas and a creak of gaff jaws. */
  sloopSail() {
    if (this.sfx('sloop-sail', { vary: 0.08 })) return;
    if (!this.sfx('sail-flap', { rate: 0.72, gain: 1.15, vary: 0.06 })) { this.noise(0.16, 320, 0.6, 0.26, 'lowpass', 120); this.noise(0.22, 260, 0.6, 0.18, 'lowpass', 100, 0.14); }
    if (!this.sfx('rope-creak', { rate: 0.8, gain: 0.6, at: 0.25 })) this.noise(0.3, 600, 2, 0.06, 'bandpass', 420, 0.3);
  }

  /** A new place on the chart: a short rising figure (the recorded sting once it exists). */
  discover() {
    const synth = () => { [587.33, 739.99, 880, 1174.66].forEach((f, i) => this.tone(f, 0.5, 0.12, 'triangle', i * 0.11)); this.tone(293.66, 1.1, 0.07, 'sine', 0.05); };
    if (PENDING.has('sting-discover')) synth();
    else void this.play('audio/music/sting-discover.ogg', 'music', 0.9).then((src) => { if (!src) synth(); });
  }

  /** Is this recorded sound (by the name of its files, less the number) in the build? */
  static recorded(name: string): boolean { return BUILT_IN.has(`audio/sfx/${name}_1.ogg`); }

  // ---- music ----
  /** Crossfades to a looping track. Only one track is kept decoded at a time. */
  setMusic(track: Track | null) {
    const ctx = this.ctx; if (!ctx || track === this.track) return;
    this.track = track;
    const gen = ++this.trackGen, now = ctx.currentTime;
    const old = this.playing; this.playing = null;
    if (old) { old.gain.gain.cancelScheduledValues(now); old.gain.gain.setTargetAtTime(0, now, 0.9); old.src.stop(now + 4); }
    if (!track) return;
    void this.decode(`audio/music/${track}.ogg`).then((buf) => {
      if (!buf || gen !== this.trackGen || !this.ctx) return;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 3.5);
      src.connect(gain).connect(this.musicDuck); src.start();
      this.playing = { src, gain };
      this.played[`music:${track}`] = (this.played[`music:${track}`] ?? 0) + 1;
    });
  }

  // ---- continuous ----
  update(dt: number, s: AudioState) {
    const ctx = this.ctx; if (!ctx) return;
    const now = ctx.currentTime;
    // Cast charge (−1 or absent = not charging).
    const c = s.charge ?? -1;
    this.chargeGain.gain.setTargetAtTime(c >= 0 ? 0.04 + 0.2 * c : 0, now, c >= 0 ? 0.03 : 0.015);
    this.chargeFilter.frequency.setTargetAtTime(260 + 1500 * Math.max(0, c) ** 2, now, 0.03);
    this.chargeTone.gain.setTargetAtTime(c >= 0 ? 0.015 + 0.06 * c : 0, now, c >= 0 ? 0.03 : 0.015);
    this.chargeOsc.frequency.setTargetAtTime(150 + 290 * Math.max(0, c), now, 0.03);
    // Reel: the recorded ratchet loop, faster with a stronger rod; a synth ratchet until it has loaded.
    const reel = this.loops.get('reel-click');
    if (reel) {
      reel.gain.gain.setTargetAtTime(s.reeling ? 0.55 : 0, now, s.reeling ? 0.02 : 0.04);
      reel.src.playbackRate.setTargetAtTime(0.9 + s.reelSpeed * 0.4, now, 0.05);
    } else {
      this.reelRate = s.reeling ? 10 + s.reelSpeed * 9 : 0;
      if (this.reelRate > 0) {
        this.reelTimer -= dt;
        if (this.reelTimer <= 0) {
          this.reelTimer = 1 / this.reelRate;
          const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200 + Math.random() * 600; f.Q.value = 6;
          const g = ctx.createGain(); this.env(g, now, 0.001, 0.22, 0.025);
          src.connect(f).connect(g).connect(this.reelGain); src.start(now, Math.random()); src.stop(now + 0.04);
        }
      }
    }
    const humTarget = s.fighting ? Math.max(0, s.tension - 0.45) * 0.18 : 0;
    this.humGain.gain.setTargetAtTime(humTarget, now, 0.05);
    this.humOsc.frequency.setTargetAtTime(90 + s.tension * 260, now, 0.05);
    // Sea: recorded lapping waves over a quiet wash that breathes.
    const waves = this.loops.get('waves-lap');
    if (waves) waves.gain.gain.setTargetAtTime(s.fen ? 0.3 : 0.8, now, 1.5); // a fen's water hardly laps
    const wash = waves ? 0.35 : 1;
    this.seaGain.gain.setTargetAtTime(wash * (0.1 + 0.05 * Math.sin(now * 0.4) + s.sea * 0.05), now, 0.5);
    this.seaFilter.frequency.setTargetAtTime(380 + 220 * (0.5 + 0.5 * Math.sin(now * 0.31)), now, 0.5);
    // Gulls by day, the dock creaking under you, the cat purring when you stand by it.
    this.gullTimer -= dt;
    if (this.gullTimer <= 0) {
      this.gullTimer = 14 + Math.random() * 30;
      if ((s.day ?? 0) > 0.35 && !s.fen) this.sfx('gulls', { bus: 'ambience', gain: 0.5 + Math.random() * 0.5, vary: 0.06 });
    }
    this.creakTimer -= dt;
    if (this.creakTimer <= 0) {
      this.creakTimer = 8 + Math.random() * 16;
      if (s.onDock) this.sfx('dock-creak', { bus: 'ambience', gain: 0.5 + Math.random() * 0.5, vary: 0.1 });
    }
    // Sailing: the wash along the hull, the rigging working, and the murmur at the edge of the map.
    const hull = s.hull ?? -1;
    const washLoop = this.loops.get('hull-wash');
    if (washLoop) { washLoop.gain.gain.setTargetAtTime(hull > 0 ? 0.9 * hull : 0, now, 0.3); washLoop.src.playbackRate.setTargetAtTime(0.85 + 0.3 * Math.max(0, hull), now, 0.3); }
    this.washGain.gain.setTargetAtTime(hull > 0 ? (washLoop ? 0.05 : 0.2) * hull * hull + 0.012 : 0, now, 0.25);
    this.washFilter.frequency.setTargetAtTime(520 + 900 * Math.max(0, hull), now, 0.25);
    if (hull >= 0) {
      this.ropeTimer -= dt * (0.4 + hull);
      if (this.ropeTimer <= 0) {
        this.ropeTimer = 4 + Math.random() * 7;
        if (!this.sfx('rope-creak', { bus: 'ambience', gain: 0.5 + 0.5 * Math.random(), vary: 0.12 })) this.sfx('dock-creak', { bus: 'ambience', gain: 0.3 + 0.3 * Math.random(), rate: 1.35, vary: 0.12 });
      }
    }
    const mur = s.murmur ?? 0;
    this.murmurLfo += dt;
    const murLoop = this.loops.get('murmur');
    if (murLoop) murLoop.gain.gain.setTargetAtTime(mur, now, 0.6);
    this.murmurGain.gain.setTargetAtTime((murLoop ? 0.25 : 1) * 0.3 * mur * (0.75 + 0.25 * Math.sin(this.murmurLfo * 0.9)), now, 0.4);
    const purr = this.loops.get('cat-purr');
    if (purr) purr.gain.gain.setTargetAtTime(0.9 * (s.purr ?? 0), now, 0.4);
    // A fen has its own air: one loop for the day and one for the night, crossing over at dusk and dawn.
    const day = s.day ?? 1;
    this.loops.get('fen-day')?.gain.gain.setTargetAtTime(s.fen ? 0.8 * Math.min(1, Math.max(0, (day - 0.3) / 0.3)) : 0, now, 1.2);
    this.loops.get('fen-night')?.gain.gain.setTargetAtTime(s.fen ? 0.8 * Math.min(1, Math.max(0, (0.7 - day) / 0.3)) : 0, now, 1.2);
    if (s.music !== undefined) this.setMusic(s.music);
    this.musicDuck.gain.setTargetAtTime(this.voices > 0 ? 0.45 : 1, now, 0.25);
  }

  /** Loads and plays a file (voice lines, stings). Missing files are ignored silently. Music ducks under voices. */
  async play(url: string, bus: Bus = 'sfx', gain = 1): Promise<AudioBufferSourceNode | null> {
    const ctx = this.ctx; if (!ctx) return null;
    let buf = this.files.get(url);
    if (!buf) {
      const got = await this.decode(url);
      if (!got) return null;
      buf = got; this.files.set(url, buf);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.buses[bus]);
    if (bus === 'voice') { this.voices++; src.onended = () => { this.voices = Math.max(0, this.voices - 1); }; }
    src.start();
    this.played[url] = (this.played[url] ?? 0) + 1;
    return src;
  }

  /** Output level right now: peak and RMS of the last ~46 ms, 0..1 (for the audio bot). */
  level(): { peak: number; rms: number } {
    if (!this.ctx) return { peak: 0, rms: 0 };
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let peak = 0, sum = 0;
    for (const v of a) { const m = Math.abs(v); if (m > peak) peak = m; sum += v * v; }
    return { peak, rms: Math.sqrt(sum / a.length) };
  }
}
