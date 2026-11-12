/**
 * F3 performance overlay: frame rate, frame-time percentiles over the last 2 seconds, CPU time spent in
 * the game's own frame, draw calls and triangles. Lets a player report real numbers from their machine.
 */

export class PerfOverlay {
  private el: HTMLElement;
  private deltas: number[] = [];
  private cpu: number[] = [];
  private shown = false;
  private refresh = 0;

  constructor(parent: HTMLElement, private info: { calls: number; triangles: number }, private describe: () => string) {
    this.el = document.createElement('div');
    this.el.className = 'perf';
    parent.appendChild(this.el);
    window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); this.toggle(); } });
  }

  toggle() { this.shown = !this.shown; this.el.classList.toggle('on', this.shown); }

  /** dt: real seconds since the last frame; cpuMs: time the game's frame took on the CPU. */
  record(dt: number, cpuMs: number) {
    this.deltas.push(dt * 1000); this.cpu.push(cpuMs);
    if (this.deltas.length > 120) { this.deltas.shift(); this.cpu.shift(); }
    if (!this.shown || (this.refresh -= dt) > 0) return;
    this.refresh = 0.25;
    const s = this.stats();
    const info = this.info;
    this.el.textContent = `${s.fps.toFixed(0)} fps · frame p50 ${s.p50.toFixed(1)} ms · p99 ${s.p99.toFixed(1)} ms · cpu ${s.cpu.toFixed(1)} ms\n` +
      `${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris · ${this.describe()}`;
  }

  stats() {
    const d = [...this.deltas].sort((a, b) => a - b);
    const q = (p: number) => (d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))] : 0);
    const mean = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
    const cpu = this.cpu.reduce((a, b) => a + b, 0) / Math.max(1, this.cpu.length);
    return { fps: mean > 0 ? 1000 / mean : 0, p50: q(0.5), p99: q(0.99), cpu };
  }
}
