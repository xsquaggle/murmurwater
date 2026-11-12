// Usage: node render.mjs <model.glb> <out.png> [key=value ...]   (keys: cell, cols, flat, clip, times, views, bg)
// Renders a turntable contact sheet of a GLB with three.js in headless Chromium and prints mesh stats.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [model, out, ...kv] = process.argv.slice(2);
const abs = path.resolve(model);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = u.pathname === '/__model.glb' ? abs : path.join(ROOT, decodeURIComponent(u.pathname));
  if (!p.startsWith(ROOT) && p !== abs) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const params = new URLSearchParams({ model: '/__model.glb' });
for (const s of kv) { const i = s.indexOf('='); params.set(s.slice(0, i), s.slice(i + 1)); }
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 2048, height: 1024 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/tools/viewer.html?${params}`);
await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
const info = await page.evaluate('window.__info');
await page.waitForTimeout(100);
await page.locator('canvas').screenshot({ path: out });
console.log(JSON.stringify(info));
await browser.close(); server.close();
