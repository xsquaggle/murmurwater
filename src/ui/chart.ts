/**
 * The chart: a parchment map of the region, drawn on a canvas from the terrain itself.
 *
 * North is up (the world's −z). Land the player has not yet found is only a faint stipple with a
 * question mark; found places are inked, tinted by height and named. The land and sea layer is drawn once
 * per set of known places and kept; the markers (boat, moorings, goal) are drawn over it each time.
 */

/** Terrain heights sampled on a square grid: sample (i, j) is at (x0 + i·cell, z0 + j·cell). */
export interface ChartRaster { x0: number; z0: number; cell: number; w: number; h: number; height: Float32Array }
/** An island's footprint, and the chart place it belongs to. */
export interface ChartIsland { place: string; x: number; z: number; rx: number; rz: number; rot: number }
export interface ChartView {
  title: string;
  raster: ChartRaster;
  islands: ChartIsland[];
  places: { id: string; name: string; kind: string; note: string; known: boolean }[];
  moorings: { id: string; name: string; place: string; x: number; z: number; known: boolean }[];
  /** The home dock: where it leaves the shore, which way it runs (forward = (sin, cos)) and how far. */
  dock: { x: number; z: number; rot: number; length: number } | null;
  you: { x: number; z: number; aboard: boolean };
  boat: { x: number; z: number; heading: number } | null;
  goal: { x: number; z: number } | null;
  /** The mooring the boat lies at, when a course can be set from here. */
  from: string | null;
  /** What lies past the edge of the chart. */
  hint: string;
}

const INK = [59, 42, 79] as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: readonly number[], b: readonly number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Bilinear height at world (x, z). */
function heightAt(r: ChartRaster, x: number, z: number): number {
  const fx = Math.min(r.w - 1.001, Math.max(0, (x - r.x0) / r.cell)), fz = Math.min(r.h - 1.001, Math.max(0, (z - r.z0) / r.cell));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * r.w + i;
  const a = r.height[k], b = r.height[k + 1], c = r.height[k + r.w], d = r.height[k + r.w + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** Normalised distance from an island's middle: under 1 is inside its footprint. */
function within(isl: ChartIsland, x: number, z: number): number {
  const dx = x - isl.x, dz = z - isl.z, c = Math.cos(isl.rot), s = Math.sin(isl.rot);
  return Math.hypot((dx * c - dz * s) / isl.rx, (dx * s + dz * c) / isl.rz);
}

let cache: { key: string; image: ImageData } | null = null;

/** The land and sea layer, W×H device pixels. */
function base(v: ChartView, W: number, H: number, known: Set<string>): ImageData {
  const key = `${W}x${H}:${[...known].sort().join(',')}`;
  if (cache?.key === key) return cache.image;
  const r = v.raster, spanX = (r.w - 1) * r.cell, spanZ = (r.h - 1) * r.cell;
  const hs = new Float32Array(W * H), faint = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const z = r.z0 + ((j + 0.5) / H) * spanZ;
    for (let i = 0; i < W; i++) {
      const x = r.x0 + ((i + 0.5) / W) * spanX;
      hs[j * W + i] = heightAt(r, x, z);
      // Uncharted: inside an unknown island's footprint (fading out round it) and outside every known one.
      let unknown = 0, charted = false;
      for (const isl of v.islands) {
        const d = within(isl, x, z);
        if (known.has(isl.place)) { if (d < 1.12) charted = true; } else unknown = Math.max(unknown, clamp01((1.55 - d) / 0.4));
      }
      faint[j * W + i] = charted ? 0 : unknown;
    }
  }
  const img = new ImageData(W, H), px = img.data;
  const paper = [236, 219, 182], shallow = [214, 226, 205], deep = [168, 198, 192];
  const beach = [240, 224, 180], low = [214, 196, 138], high = [168, 172, 112], crag = [148, 138, 120];
  const lw = Math.max(1, Math.round(W / 640));
  const isLand = (i: number, j: number) => hs[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))] > 0.12;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i, h = hs[k];
      let c: number[];
      if (faint[k] > 0 && h > 0.12) {
        // Somebody's rumour of land: a stipple, no shoreline.
        const dot = (i + j * 2) % (4 * lw) < lw && j % (2 * lw) < lw;
        c = dot ? mix(paper, INK, 0.45) : mix(paper, shallow, 0.25);
      } else if (h > 0.12) {
        const t = h < 1.6 ? mix(beach, low, clamp01((h - 0.3) / 1.3)) : h < 14 ? mix(low, high, clamp01((h - 1.6) / 9)) : mix(high, crag, clamp01((h - 14) / 10));
        // Light from the north-west, so slopes read as relief.
        const d = 2 * lw, slope = hs[Math.min(H - 1, j + d) * W + Math.min(W - 1, i + d)] - hs[Math.max(0, j - d) * W + Math.max(0, i - d)];
        const shade = Math.max(-26, Math.min(22, -slope * 9));
        c = [t[0] + shade, t[1] + shade, t[2] + shade * 0.8];
        // The shoreline, in ink.
        if (!isLand(i - lw, j) || !isLand(i + lw, j) || !isLand(i, j - lw) || !isLand(i, j + lw)) c = mix(c, INK, 0.78);
      } else {
        // Sea: paler over the shallows, in soft steps like soundings.
        const depth = -h, band = Math.min(4, Math.floor(depth / 5));
        c = mix(shallow, deep, clamp01(band / 4 + depth / 90));
        // Unsounded water round an uncharted place is left nearly bare paper.
        c = mix(paper, c, 0.82 - 0.5 * faint[k]);
      }
      // Paper: a little grain, and darker toward the edges.
      const n = ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) * 5;
      const ex = (i / W - 0.5) * 2, ey = (j / H - 0.5) * 2, vig = 1 - 0.2 * Math.pow(Math.max(Math.abs(ex), Math.abs(ey)), 5) - 0.05 * (ex * ex + ey * ey);
      px[k * 4] = (c[0] + n) * vig; px[k * 4 + 1] = (c[1] + n) * vig; px[k * 4 + 2] = (c[2] + n * 0.8) * vig; px[k * 4 + 3] = 255;
    }
  }
  cache = { key, image: img };
  return img;
}

/** Draws the whole chart into the canvas (sized in CSS pixels by the caller; this sets its resolution). */
export function drawChart(canvas: HTMLCanvasElement, v: ChartView, cssW: number) {
  const r = v.raster, spanX = (r.w - 1) * r.cell, spanZ = (r.h - 1) * r.cell;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(cssW * dpr), H = Math.round(cssW * (spanZ / spanX) * dpr);
  canvas.width = W; canvas.height = H;
  canvas.style.width = `${cssW}px`; canvas.style.height = `${Math.round(H / dpr)}px`;
  const g = canvas.getContext('2d')!;
  const known = new Set(v.places.filter((p) => p.known).map((p) => p.id));
  g.putImageData(base(v, W, H, known), 0, 0);
  const u = W / 640; // drawing unit: 1 at the reference width
  const X = (x: number) => ((x - r.x0) / spanX) * W, Z = (z: number) => ((z - r.z0) / spanZ) * H;
  const ink = (a = 1) => `rgba(${INK[0]},${INK[1]},${INK[2]},${a})`;

  // A faint grid, a hundred metres to the square.
  g.strokeStyle = ink(0.07); g.lineWidth = u;
  g.beginPath();
  for (let x = Math.ceil(r.x0 / 100) * 100; x < r.x0 + spanX; x += 100) { g.moveTo(X(x), 0); g.lineTo(X(x), H); }
  for (let z = Math.ceil(r.z0 / 100) * 100; z < r.z0 + spanZ; z += 100) { g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); }
  g.stroke();

  // The dock: a plank's width of brown running out from the shore.
  if (v.dock) {
    const d = v.dock, ex = d.x + Math.sin(d.rot) * (d.length + 4), ez = d.z + Math.cos(d.rot) * (d.length + 4);
    g.lineCap = 'butt';
    g.strokeStyle = ink(0.9); g.lineWidth = 4.5 * u; g.beginPath(); g.moveTo(X(d.x), Z(d.z)); g.lineTo(X(ex), Z(ez)); g.stroke();
    g.strokeStyle = '#B88B5A'; g.lineWidth = 2.4 * u; g.beginPath(); g.moveTo(X(d.x), Z(d.z)); g.lineTo(X(ex) + Math.sin(d.rot) * -u, Z(ez) + Math.cos(d.rot) * -u); g.stroke();
  }

  // Names: on the land for a big island, under it for a small one.
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of v.places) {
    const isl = v.islands.filter((i) => i.place === p.id);
    if (!isl.length) continue;
    const cx = isl.reduce((a, i) => a + i.x, 0) / isl.length;
    const ext = (i: ChartIsland) => Math.hypot(i.rx * Math.sin(i.rot), i.rz * Math.cos(i.rot));
    const top = Math.min(...isl.map((i) => i.z - ext(i))), bottom = Math.max(...isl.map((i) => i.z + ext(i)));
    const big = bottom - top > 150;
    if (p.known) {
      g.font = `italic 700 ${Math.round((big ? 21 : 15) * u)}px "Fraunces Variable", Georgia, serif`;
      const y = big ? Z((top + bottom) / 2) : Z(bottom) + 13 * u;
      g.lineWidth = 4 * u; g.strokeStyle = 'rgba(240,226,190,.85)'; g.lineJoin = 'round';
      g.strokeText(p.name, X(cx), y);
      g.fillStyle = ink(0.92); g.fillText(p.name, X(cx), y);
    } else {
      g.font = `italic 700 ${Math.round(22 * u)}px "Fraunces Variable", Georgia, serif`;
      g.fillStyle = ink(0.5); g.fillText('?', X(cx), Z((top + bottom) / 2));
    }
  }

  // Keeps a marker on the sheet when what it marks lies off it.
  const pin = (x: number, z: number): [number, number] => [Math.min(W - 14 * u, Math.max(14 * u, X(x))), Math.min(H - 14 * u, Math.max(14 * u, Z(z)))];

  // Moorings: a ringed anchor.
  for (const m of v.moorings) {
    if (!m.known) continue;
    const [x, y] = pin(m.x, m.z);
    g.beginPath(); g.arc(x, y, 8.5 * u, 0, Math.PI * 2);
    g.fillStyle = m.id === v.from ? '#FFE2A0' : '#F6EBD2'; g.fill();
    g.lineWidth = 1.6 * u; g.strokeStyle = ink(); g.stroke();
    g.lineWidth = 1.5 * u; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y - 3.2 * u); g.lineTo(x, y + 4.6 * u);
    g.moveTo(x - 2.6 * u, y - 1.2 * u); g.lineTo(x + 2.6 * u, y - 1.2 * u);
    g.stroke();
    g.beginPath(); g.arc(x, y + 0.6 * u, 4 * u, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.arc(x, y - 4.4 * u, 1.3 * u, 0, Math.PI * 2); g.stroke();
  }

  // The goal: a four-pointed star.
  if (v.goal) {
    const [x, y] = pin(v.goal.x, v.goal.z);
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rad = (k % 2 ? 3.4 : 10.5) * u;
      g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
    g.fillStyle = '#FFB35C'; g.shadowColor = 'rgba(255,179,92,.9)'; g.shadowBlur = 10 * u; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 1.4 * u; g.strokeStyle = ink(); g.stroke();
  }

  // The boat, bow to her heading; a ring round whichever of boat or walker is the player.
  if (v.boat) {
    const [x, y] = pin(v.boat.x, v.boat.z);
    g.save(); g.translate(x, y); g.rotate(Math.PI - v.boat.heading);
    g.beginPath();
    g.moveTo(0, -9 * u); g.quadraticCurveTo(5.2 * u, -2 * u, 3.6 * u, 7 * u); g.lineTo(-3.6 * u, 7 * u); g.quadraticCurveTo(-5.2 * u, -2 * u, 0, -9 * u);
    g.closePath();
    g.fillStyle = '#E86F6F'; g.fill(); g.lineWidth = 1.5 * u; g.strokeStyle = ink(); g.stroke();
    g.restore();
  }
  {
    const at = v.you.aboard && v.boat ? v.boat : v.you;
    const [x, y] = pin(at.x, at.z);
    if (!v.you.aboard) { g.beginPath(); g.arc(x, y, 3.4 * u, 0, Math.PI * 2); g.fillStyle = ink(); g.fill(); }
    g.beginPath(); g.arc(x, y, (v.you.aboard ? 14 : 8) * u, 0, Math.PI * 2);
    g.setLineDash([3 * u, 3 * u]); g.lineWidth = 1.4 * u; g.strokeStyle = ink(0.8); g.stroke(); g.setLineDash([]);
  }

  // Compass rose and scale.
  {
    const x = 44 * u, y = H - 46 * u, rad = 24 * u;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fillStyle = 'rgba(240,226,190,.7)'; g.fill();
    g.lineWidth = 1.3 * u; g.strokeStyle = ink(0.7); g.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * rad * 0.92, y + Math.sin(a) * rad * 0.92);
      g.lineTo(x + Math.cos(a + Math.PI / 2) * rad * 0.16, y + Math.sin(a + Math.PI / 2) * rad * 0.16);
      g.lineTo(x + Math.cos(a - Math.PI / 2) * rad * 0.16, y + Math.sin(a - Math.PI / 2) * rad * 0.16);
      g.closePath();
      g.fillStyle = k === 0 ? '#E86F6F' : ink(0.75); g.fill();
    }
    g.font = `800 ${Math.round(13 * u)}px "Fraunces Variable", Georgia, serif`; g.fillStyle = ink(); g.textAlign = 'center';
    g.fillText('N', x, y - rad - 9 * u);
    const sw = (100 / spanX) * W, sx = W - 26 * u - sw, sy = H - 24 * u;
    g.lineWidth = 2 * u; g.strokeStyle = ink(0.85);
    g.beginPath(); g.moveTo(sx, sy - 4 * u); g.lineTo(sx, sy); g.lineTo(sx + sw, sy); g.lineTo(sx + sw, sy - 4 * u); g.stroke();
    g.font = `800 ${Math.round(11 * u)}px "Nunito Variable", system-ui, sans-serif`;
    g.fillText('100 m', sx + sw / 2, sy - 9 * u);
  }
  // A ruled border.
  g.strokeStyle = ink(0.55); g.lineWidth = 1.2 * u; g.strokeRect(6 * u, 6 * u, W - 12 * u, H - 12 * u);
}
