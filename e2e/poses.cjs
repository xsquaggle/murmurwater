// Renders the player in each pose from a close camera: node e2e/poses.cjs <outdir> [yawOffsetDeg]
const { chromium } = require('playwright');
(async () => {
  const outDir = process.argv[2] || 'shots/poses';
  const camYawDeg = Number(process.argv[3] || 35);
  require('fs').mkdirSync(outDir, { recursive: true });
  const port = process.env.MW_PORT || 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  // A reload waits for the old page to let go of its renderer: slow on a software GPU, so give it time.
  page.setDefaultNavigationTimeout(180000);
  const logs = [];
  page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=15&quality=medium`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames >= 5, null, { timeout: 240000 });
  const poses = [
    ['idle', {}], ['walk', { speed: 2.8 }], ['run', { speed: 4.6, pose: 'walk' }], ['charge-0', { pose: 'charge', power: 0.05 }], ['charge-1', { pose: 'charge', power: 1 }],
    ['cast', { pose: 'cast' }], ['wait', { pose: 'wait' }], ['fight-calm', { pose: 'fight', tension: 0.3, lateral: 0 }],
    ['fight-left', { pose: 'fight', tension: 0.8, lateral: 1, reeling: true }], ['fight-right', { pose: 'fight', tension: 0.6, lateral: -1, reeling: true }], ['show-catch', { pose: 'cheer', hold: 'coral-snapper' }],
  ];
  for (const [name, o] of poses) {
    await page.evaluate(([name, o, camYawDeg]) => {
      const g = window.__MW__.game; const V = g.pos.constructor;
      g.paused = true;
      const pose = o.pose || name;
      g.debugPose = { pose, ...o };
      const yaw = g.yaw + Math.PI + camYawDeg * Math.PI / 180;
      const look = new V(g.pos.x, g.pos.y + 1.05, g.pos.z);
      g.debugCam = { pos: new V(look.x + Math.sin(yaw) * 3.4, look.y + 0.5, look.z + Math.cos(yaw) * 3.4), look };
      if (o.hold && !g.__held) { g.__held = window.__MW__.makeFish(o.hold, 1.2); g.avatar.holdFish(g.__held.obj); }
      for (let i = 0; i < 45; i++) g.frame(1 / 30);
    }, [name, o, camYawDeg]);
    await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 });
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
  console.log('poses written to', outDir);
})();
