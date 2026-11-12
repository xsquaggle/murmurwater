// Frame-by-frame look at one cast, from the gameplay camera and from the side:
//   node e2e/cast.cjs <outdir> [releasePower=0.88]
// Needs `npx vite build && npx vite preview --port 4173` running. Writes <outdir>/<nn>-<label>-{game,side,close}.png.
const { chromium } = require('playwright');
(async () => {
  const outDir = process.argv[2] || 'shots/cast';
  const releaseAt = Number(process.argv[3] || 0.88);
  require('fs').mkdirSync(outDir, { recursive: true });
  const port = process.env.MW_PORT || 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=${process.env.MW_HOUR || 15}&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames >= 5, null, { timeout: 240000 });
  await page.evaluate(() => {
    const g = window.__MW__.game;
    g.halted = true; g.skipRender = true;
    g.pos.copy(g.world.dockEnd); g.yaw = -Math.PI / 2; g.camYaw = g.yaw; g.snapCamera();
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    window.__cast = { NO, t: 0, state: 'settle' };
    // One real frame: fixed step with bot input, then present.
    window.__tick = (inp) => { g.simulate(1 / 60, () => inp); g.presentOnce(1 / 60); window.__cast.t += 1 / 60; };
    for (let i = 0; i < 90; i++) window.__tick(NO);
  });
  let n = 0;
  const shoot = async (label) => {
    const tag = `${String(n++).padStart(2, '0')}-${label}`;
    for (const cam of ['game', 'side', 'close']) {
      await page.evaluate((cam) => {
        const g = window.__MW__.game; const V = g.pos.constructor;
        const keepP = g.camera.position.clone(), keepQ = g.camera.quaternion.clone();
        if (cam === 'side') {
          const d = new V(Math.sin(g.yaw), 0, Math.cos(g.yaw)), right = new V(-Math.cos(g.yaw), 0, Math.sin(g.yaw));
          const look = g.pos.clone().addScaledVector(d, 2.6); look.y += 2.0;
          g.debugCam = { pos: look.clone().addScaledVector(right, 8.5).add(new V(0, 0.6, 0)), look };
        } else if (cam === 'close') {
          const d = new V(Math.sin(g.yaw), 0, Math.cos(g.yaw)), right = new V(-Math.cos(g.yaw), 0, Math.sin(g.yaw));
          const look = g.pos.clone(); look.y += 1.5;
          g.debugCam = { pos: look.clone().addScaledVector(right, 3.6).addScaledVector(d, 1.6).add(new V(0, 0.5, 0)), look };
        }
        g.skipRender = false; g.presentOnce(0); g.skipRender = true;
        g.debugCam = null;
        g.camera.position.copy(keepP); g.camera.quaternion.copy(keepQ);
      }, cam);
      await page.screenshot({ path: `${outDir}/${tag}-${cam}.png`, timeout: 180000 });
    }
  };
  // Run frames until a condition holds, then shoot.
  const until = async (label, cond, input = 'NO', max = 600) => {
    const info = await page.evaluate(([cond, input, max]) => {
      const g = window.__MW__.game, c = window.__cast;
      const test = new Function('g', 'c', `return (${cond});`);
      const inp = input === 'hold' ? { ...c.NO, primary: true } : input === 'press' ? { ...c.NO, primary: true, primaryPressed: true } : input === 'release' ? { ...c.NO, primaryReleased: true } : c.NO;
      let k = 0;
      do { window.__tick(inp); k++; } while (!test(g, c) && k < max);
      return { phase: g.session.phase, power: +g.session.power.toFixed(2), frames: k, flightK: +g.view.flightK.toFixed(2) };
    }, [cond, input, max]);
    console.log(label, JSON.stringify(info));
    await shoot(label);
  };
  const after = async (label, seconds) => {
    await page.evaluate(() => { window.__cast.mark = window.__cast.t; });
    await until(label, `c.t - c.mark >= ${seconds} - 1e-6`);
  };
  await shoot('idle');
  await until('charge-start', 'true', 'press', 1);
  await until('charge-30', 'g.session.power >= 0.3', 'hold');
  await until('charge-60', 'g.session.power >= 0.6', 'hold');
  await until('charge-full', `g.session.power >= ${releaseAt}`, 'hold');
  await until('release', 'true', 'release', 1);
  await after('whip-2f', 2 / 60);
  await after('whip-4f', 2 / 60);
  await after('launch', 3 / 60);
  await after('flight-a', 4 / 60);
  await after('flight-b', 8 / 60);
  await after('flight-c', 12 / 60);
  await until('flight-late', 'g.view.flightK >= 0.85 || g.session.phase !== "casting"');
  await until('landed', 'g.session.phase !== "casting"');
  await after('splash-4f', 4 / 60);
  await after('splash-12f', 8 / 60);
  await after('settle-a', 0.35);
  await after('settle-b', 1.0);
  // Reel in.
  await page.evaluate(() => { const c = window.__cast; window.__tick({ ...c.NO, cancel: true }); });
  await after('retrieve-a', 0.1);
  await after('retrieve-b', 0.3);
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
  console.log('cast frames written to', outDir);
})();
