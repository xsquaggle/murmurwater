// Fish shadows: the roaming shoal, then one cast followed from landing to the bite and into the fight.
//   node e2e/shadows.cjs <outdir>
// Needs `npx vite build && npx vite preview --port 4173` running. Writes <outdir>/<nn>-<label>-{game,top}.png
// and fails (exit 1) if the biter is not at the float when the bite comes.
const { chromium } = require('playwright');
(async () => {
  const outDir = process.argv[2] || 'shots/shadows';
  require('fs').mkdirSync(outDir, { recursive: true });
  const port = process.env.MW_PORT || 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=${process.env.MW_HOUR || 13}&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames >= 5, null, { timeout: 240000 });
  await page.evaluate(() => {
    const g = window.__MW__.game;
    g.halted = true; g.skipRender = true;
    g.pos.copy(g.world.dockEnd); g.yaw = -Math.PI / 2; g.camYaw = g.yaw; g.snapCamera();
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    window.__b = { NO, t: 0 };
    window.__tick = (inp) => { g.simulate(1 / 60, () => inp); g.presentOnce(1 / 60); window.__b.t += 1 / 60; };
    for (let i = 0; i < 240; i++) window.__tick(NO);
  });
  let n = 0;
  const shoot = async (label) => {
    const tag = `${String(n++).padStart(2, '0')}-${label}`;
    for (const cam of ['game', 'top']) {
      await page.evaluate((cam) => {
        const g = window.__MW__.game; const V = g.pos.constructor;
        const keepP = g.camera.position.clone(), keepQ = g.camera.quaternion.clone();
        if (cam === 'top') {
          // Above the float (or the water ahead of the dock), looking almost straight down.
          const out = g.session.phase === 'idle' || g.session.phase === 'charging';
          const c = out ? g.pos.clone().add(new V(Math.sin(g.yaw) * 10, 0, Math.cos(g.yaw) * 10)) : (g.view.hooked || g.view.target).clone();
          c.y = 0;
          g.debugCam = { pos: c.clone().add(new V(-Math.sin(g.yaw) * 1.5, out ? 22 : 11, -Math.cos(g.yaw) * 1.5)), look: c };
        }
        g.skipRender = false; g.presentOnce(0); g.skipRender = true;
        g.debugCam = null;
        g.camera.position.copy(keepP); g.camera.quaternion.copy(keepQ);
      }, cam);
      // Screenshots are evidence, not the test: on a slow software renderer a timeout is only a warning.
      try { await page.screenshot({ path: `${outDir}/${tag}-${cam}.png`, timeout: 120000 }); }
      catch (e) { console.warn(`shot ${tag}-${cam} skipped: ${e.message.split('\n')[0]}`); }
    }
  };
  const until = async (label, cond, input = 'NO', max = 3000) => {
    const info = await page.evaluate(([cond, input, max]) => {
      const g = window.__MW__.game, b = window.__b;
      const test = new Function('g', 'b', `return (${cond});`);
      const inp = input === 'hold' ? { ...b.NO, primary: true } : input === 'press' ? { ...b.NO, primary: true, primaryPressed: true } : input === 'release' ? { ...b.NO, primaryReleased: true } : b.NO;
      let k = 0;
      do { window.__tick(inp); k++; } while (!test(g, b) && k < max);
      const s = g.shadows.biter, t = g.view.target;
      return { phase: g.session.phase, frames: k, tug: +g.session.nextTug.toFixed(2), roaming: g.shadows.roaming, biter: s.mode, alpha: +s.alpha.toFixed(2), fromFloat: +Math.hypot(s.x - t.x, s.z - t.z).toFixed(2), len: +s.len.toFixed(2) };
    }, [cond, input, max]);
    console.log(label, JSON.stringify(info));
    await shoot(label);
    return info;
  };
  await shoot('roaming');
  await until('charge', 'true', 'press', 1);
  await until('charge-60', 'g.session.power >= 0.6', 'hold');
  await until('release', 'true', 'release', 1);
  await until('landed', 'g.session.phase === "waiting"');
  await until('rise', 'b.t0 === undefined ? (b.t0 = b.t, false) : b.t - b.t0 >= 0.8');
  await until('circling', 'g.session.nextTug < 3.2 || g.session.phase !== "waiting"');
  await until('close', 'g.session.nextTug < 1.2 || g.session.phase !== "waiting"');
  await until('lunge', 'g.session.nextTug < 0.2 || g.session.phase !== "waiting"');
  // Follow nibbles (if any) through to the bite.
  let guard = 0, info;
  do { info = await until('tug', 'g.session.nextTug < 0.05 || g.session.phase !== "waiting"'); } while (info.phase === 'waiting' && info.tug > 0.06 && guard++ < 6);
  info = await until('bite', 'g.session.phase !== "waiting"');
  let failed = null;
  if (info.phase !== 'bite') failed = 'no bite: ' + info.phase;
  else if (info.fromFloat > 1.2) failed = `biter was ${info.fromFloat} m from the float at the bite`;
  await until('hooked', 'true', 'press', 1);
  await until('fight', 'b.t1 === undefined ? (b.t1 = b.t, false) : b.t - b.t1 >= 1.5', 'hold');
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
  if (failed || logs.some((l) => l.startsWith('[pageerror]'))) { console.log('SHADOWS FAILED', failed || 'page error'); process.exit(1); }
  console.log('SHADOWS OK', outDir);
})();
