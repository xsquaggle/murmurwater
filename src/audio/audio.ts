/**
 * Audio engine: mixer buses (master, music, sfx, voice, ambience) and procedural sounds.
 * Continuous sounds (reel ratchet, line hum, sea) are procedural by design.
 * One-shot sounds here are TEMPORARY synth versions until generated SFX files land in public/audio/sfx.
 */
export type Bus = 'music' | 'sfx' | 'voice' | 'ambience';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private noiseBuf!: AudioBuffer;
  private reelGain!: GainNode; private reelTimer = 0; private reelRate = 0;
  private humOsc!: OscillatorNode; private humGain!: GainNode;
  private seaGain!: GainNode; private seaFilter!: BiquadFilterNode;
  volumes = { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9, ambience: 0.6 };
  private files = new Map<string, AudioBuffer>();

  /** Must be called from a user gesture (browser autoplay rules). */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    comp.connect(this.master);
    for (const b of ['music', 'sfx', 'voice', 'ambience'] as Bus[]) { const g = ctx.createGain(); g.connect(comp); this.buses[b] = g; }
    this.applyVolumes();
    // Shared noise buffer
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Sea bed: looping filtered noise with slow swells.
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
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    for (const b of ['music', 'sfx', 'voice', 'ambience'] as Bus[]) this.buses[b].gain.value = this.volumes[b];
  }

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

  // ---- one-shots (TEMPORARY synth) ----
  whoosh(power: number) { this.noise(0.35 + power * 0.2, 600, 0.8, 0.25 + power * 0.2, 'bandpass', 2400); }
  splash(size = 1) { this.noise(0.5 * size + 0.2, 1400, 0.7, 0.35 * size, 'lowpass', 300); this.noise(0.15, 3000, 1.5, 0.15 * size, 'highpass'); }
  plop() { this.tone(520, 0.12, 0.25, 'sine', 0, 180); this.noise(0.2, 900, 1, 0.12, 'lowpass', 300); }
  nibble() { this.tone(300 + Math.random() * 80, 0.06, 0.12, 'sine', 0, 200); }
  bite() { this.noise(0.4, 1800, 0.8, 0.45, 'lowpass', 250); this.tone(180, 0.25, 0.3, 'triangle', 0, 70); }
  hook(perfect: boolean) { this.tone(perfect ? 880 : 660, 0.12, 0.3, 'triangle'); if (perfect) this.tone(1320, 0.18, 0.2, 'sine', 0.06); this.noise(0.08, 2500, 2, 0.2); }
  snap() { this.tone(1400, 0.4, 0.35, 'sawtooth', 0, 90); this.noise(0.25, 4000, 1, 0.3, 'highpass'); }
  lose() { this.tone(330, 0.3, 0.15, 'triangle', 0, 220); }
  warn() { this.tone(740, 0.08, 0.15, 'square'); this.tone(740, 0.08, 0.15, 'square', 0.12); }
  coin(n = 1) { for (let i = 0; i < Math.min(8, n); i++) this.tone(1568 + (i % 3) * 200, 0.12, 0.12, 'square', i * 0.05); }
  catchFanfare(rarity: number) {
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const n = 3 + rarity;
    for (let i = 0; i < n; i++) this.tone(scale[i % scale.length] * (i >= 6 ? 2 : 1), 0.35, 0.16, 'triangle', i * 0.07);
    if (rarity >= 5) for (let i = 0; i < 4; i++) this.tone(311 * (1 + i * 0.5), 1.2, 0.08, 'sine', 0.3 + i * 0.1); // uncanny undertone
  }
  click() { this.tone(1200, 0.03, 0.08, 'square'); }

  // ---- continuous ----
  update(dt: number, s: { reeling: boolean; reelSpeed: number; tension: number; fighting: boolean; sea: number }) {
    const ctx = this.ctx; if (!ctx) return;
    // Reel ratchet: clicks at a rate tied to reel speed.
    this.reelRate = s.reeling ? 10 + s.reelSpeed * 9 : 0;
    if (this.reelRate > 0) {
      this.reelTimer -= dt;
      if (this.reelTimer <= 0) {
        this.reelTimer = 1 / this.reelRate;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200 + Math.random() * 600; f.Q.value = 6;
        const g = ctx.createGain(); this.env(g, t, 0.001, 0.22, 0.025);
        src.connect(f).connect(g).connect(this.reelGain); src.start(t, Math.random()); src.stop(t + 0.04);
      }
    }
    const humTarget = s.fighting ? Math.max(0, s.tension - 0.45) * 0.18 : 0;
    this.humGain.gain.setTargetAtTime(humTarget, ctx.currentTime, 0.05);
    this.humOsc.frequency.setTargetAtTime(90 + s.tension * 260, ctx.currentTime, 0.05);
    this.seaGain.gain.setTargetAtTime(0.1 + 0.05 * Math.sin(ctx.currentTime * 0.4) + s.sea * 0.05, ctx.currentTime, 0.5);
    this.seaFilter.frequency.setTargetAtTime(380 + 220 * (0.5 + 0.5 * Math.sin(ctx.currentTime * 0.31)), ctx.currentTime, 0.5);
  }

  /** Loads and plays a file (voice lines, generated SFX, music). Missing files are ignored silently. */
  async play(url: string, bus: Bus = 'sfx', gain = 1): Promise<AudioBufferSourceNode | null> {
    const ctx = this.ctx; if (!ctx) return null;
    let buf = this.files.get(url);
    if (!buf) {
      try { const r = await fetch(url); if (!r.ok) return null; buf = await ctx.decodeAudioData(await r.arrayBuffer()); this.files.set(url, buf); }
      catch { return null; }
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.buses[bus]); src.start();
    return src;
  }
}
