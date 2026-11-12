import { PerspectiveCamera, Vector3 } from 'three';
import regions from './data/regions.json';
import type { RegionDef } from './core/world';
import { Renderer, type Quality } from './render/renderer';
import { WorldScene } from './render/world-scene';

const params = new URLSearchParams(location.search);
const quality = (params.get('quality') as Quality) ?? 'high';
const canvas = document.getElementById('view') as HTMLCanvasElement;
const camera = new PerspectiveCamera(50, 16 / 9, 0.3, 9000);
const region = (regions.regions as unknown as RegionDef[])[0];

const t0 = performance.now();
const world = new WorldScene(region, (await import('./render/renderer')).QUALITY[quality]);
const renderer = new Renderer(canvas, quality, world.scene, camera);
const buildMs = performance.now() - t0;
if (params.has('hour')) world.hour = Number(params.get('hour'));

// Temporary prototype camera (replaced by the player/fishing camera in the vertical slice).
const focus = world.dockEnd.clone();
camera.position.copy(world.dockEnd).add(new Vector3(18, 7, 10));
camera.lookAt(world.dockEnd.clone().add(new Vector3(-40, 2, 0)));
const parseV = (s: string | null) => (s ? new Vector3(...s.split(',').map(Number)) : null);
const camP = parseV(params.get('cam')), lookP = parseV(params.get('look'));
if (camP) camera.position.copy(camP);
if (lookP) camera.lookAt(lookP);

window.addEventListener('resize', () => renderer.resize());

let last = performance.now();
let frames = 0;
const frameTimes: number[] = [];
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frameTimes.push(dt * 1000);
  if (frameTimes.length > 600) frameTimes.shift();
  world.update(dt, camera, focus);
  renderer.render(dt);
  frames++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Debug/test hook (used by e2e screenshots and the bot).
(window as any).__MW__ = {
  get frames() { return frames; },
  buildMs,
  world, camera, renderer,
  setHour(h: number) { world.hour = h; },
  setCamera(p: number[], l: number[]) { camera.position.set(p[0], p[1], p[2]); camera.lookAt(l[0], l[1], l[2]); },
  frameStats() { const s = [...frameTimes].sort((a, b) => a - b); return { p50: s[Math.floor(s.length * 0.5)], p99: s[Math.floor(s.length * 0.99)] }; },
};
