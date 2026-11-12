// Drives the real game in headless Chromium through the core loop and captures screenshots.
// Fails (exit 1) on page errors, soft-locks or if no fish is landed and sold.
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=17.3`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 3, null, { timeout: 120000 });
  const shot = async (name) => { await page.evaluate(() => { const g = window.__MW__.game; for (let i = 0; i < 3; i++) g.presentOnce(1 / 60); }); await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); };
  // Walk to the end of the dock (teleport) and face the sea.
  await page.evaluate(() => { const g = window.__MW__.game; g.paused = true; g.pos.copy(g.world.dockEnd); g.yaw = -Math.PI / 2; g.camYaw = g.yaw; g.simulate(0.5); });
  const result = await page.evaluate(() => {
    const g = window.__MW__.game;
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    const log = [];
    let landed = 0, lost = 0;
    for (let attempt = 0; attempt < 12 && landed < 5; attempt++) {
      // Charge to the sweet spot and release.
      g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
      let guard = 0;
      while (g.session.phase === 'charging' && g.session.power < 0.88 && guard++ < 200) g.simulate(1 / 60, () => ({ ...NO, primary: true }));
      g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
      // Wait for the bite (ignore nibbles).
      guard = 0;
      while (['casting', 'waiting'].includes(g.session.phase) && guard++ < 60 * 40) g.simulate(1 / 60, () => NO);
      if (g.session.phase !== 'bite') { log.push('no bite: ' + g.session.phase); continue; }
      g.simulate(0.15, () => NO);
      g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
      // Fight with a sensible policy.
      guard = 0;
      while (g.session.phase === 'fighting' && guard++ < 60 * 120) {
        g.simulate(1 / 60, (gg) => { const f = gg.session.fight; if (!f) return NO; return { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 }; });
      }
      if (g.session.phase === 'landed' || g.state.lifetime.catches > landed) landed = g.state.lifetime.catches; else lost++;
      g.simulate(1.2, () => NO);
      if (g.session.phase !== 'idle') g.simulate(2, () => NO);
      if (g.session.phase !== 'idle') log.push('stuck after fight in ' + g.session.phase);
    }
    g.botInput = null;
    return { landed, lost, hold: g.state.hold.length, log };
  });
  console.log(JSON.stringify(result));
  // Mid-fight screenshot: cast, hook, run a few seconds of fight.
  await page.evaluate(() => {
    const g = window.__MW__.game; const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
    while (g.session.phase === 'charging' && g.session.power < 0.6) g.simulate(1 / 60, () => ({ ...NO, primary: true }));
  });
  await shot('play-1-charging');
  await page.evaluate(() => { const g = window.__MW__.game; const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true })); let k = 0; while (g.session.phase !== 'bite' && k++ < 3000) g.simulate(1 / 60, () => NO); });
  await shot('play-2-bite');
  await page.evaluate(() => { const g = window.__MW__.game; const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true })); g.simulate(2.5, (gg) => { const f = gg.session.fight; return f ? { ...NO, primary: f.tension < 0.75, steer: f.run ? -f.run : 0 } : NO; }); });
  await shot('play-3-fight');
  await page.evaluate(() => { const g = window.__MW__.game; const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    let k = 0; while (g.session.phase === 'fighting' && k++ < 6000) g.simulate(1 / 60, (gg) => { const f = gg.session.fight; return f ? { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 } : NO; });
    g.simulate(0.4, () => NO); });
  await shot('play-4-catch');
  // Sell: walk up to Mara, take her first job so her stall menu opens, then pick "Sell".
  const sold = await page.evaluate(() => {
    const g = window.__MW__.game; g.botInput = null;
    const f = g.town.npcs.get('mara').fig.root.position;
    for (let a = 0; a < 12; a++) { const x = f.x + Math.cos(a) * 1.6, z = f.z + Math.sin(a) * 1.6; if (g.groundAt(x, z) !== null) { g.pos.set(x, g.groundAt(x, z), z); g.yaw = Math.atan2(f.x - x, f.z - z); break; } }
    g.snapCamera(); g.simulate(0.3);
    const talk = () => { g.input.simulate('KeyE', true); g.simulate(1 / 60); g.input.simulate('KeyE', false); g.simulate(1 / 60); };
    const choices = () => { const d = g.town.dialogue; let k = 0; while (d.isOpen && k++ < 60) { d.advance(); g.simulate(0.05); g.presentOnce(1 / 60); const c = [...document.querySelectorAll('.dlg-choice')].map((b) => b.textContent); if (c.length) return c; } return []; };
    const pick = (label) => { const i = choices().findIndex((c) => c.includes(label)); if (i >= 0) { g.town.dialogue.pick(i); g.simulate(0.1); } return i >= 0; };
    const before = g.state.coins;
    talk();
    if (!pick('Sell')) { pick('do it'); if (!g.town.dialogue.isOpen) talk(); pick('Sell'); }
    g.simulate(0.3);
    return { before, after: g.state.coins, hold: g.state.hold.length };
  });
  console.log('sold', JSON.stringify(sold));
  await shot('play-5-sold');
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
  const ok = result.landed >= 3 && sold.after > sold.before && errors.length === 0 && result.log.every((l) => !l.startsWith('stuck'));
  console.log(ok ? 'PLAYTHROUGH OK' : 'PLAYTHROUGH FAILED');
  process.exit(ok ? 0 : 1);
})();
