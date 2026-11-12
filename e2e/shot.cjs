// Usage: node e2e/shot.cjs <out.png> [query] [waitFrames]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'shots/shot.png';
  const query = process.argv[3] || '';
  const waitFrames = Number(process.argv[4] || 20);
  const port = process.env.MW_PORT || 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 720) } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${port}/?${query}`);
  const t = Date.now();
  await page.waitForFunction((n) => window.__MW__ && window.__MW__.frames >= n, waitFrames, { timeout: 240000 });
  const info = await page.evaluate(() => ({ build: window.__MW__.buildMs, stats: window.__MW__.frameStats(), calls: window.__MW__.renderer.gl.info.render.calls, tris: window.__MW__.renderer.gl.info.render.triangles }));
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ out, ms: Date.now() - t, ...info }));
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
