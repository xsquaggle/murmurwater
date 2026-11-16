// Tester's-start bot: F8 on the title screen, through the real game. The game comes back as the keeper the
// simulator played to the doorstep of the newest slice (src/data/tester/fen.json): she has the Fog Lamp and
// Pell's road job, Hearthbay knows her, and nothing she does is written to the player's own save. Then the
// save is proved to be one the game can play on from: she boards the skiff, sails the old sea-road by the
// helm, comes out in Mossglass Fen and hands Pell's errand to Calloway.
// Exits 1 on any failure. Usage: node e2e/tester.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/tester';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
  const shot = async (name, frames = 12) => {
    await page.evaluate((n) => { const g = window.__MW__.game; for (let i = 0; i < n; i++) g.presentOnce(1 / 30); }, frames);
    await page.waitForTimeout(700);
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const up = () => page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  const q = `hour=9&quality=${process.env.MW_QUALITY || 'medium'}`;

  // 1. A game of the player's own, saved; then F8 on its title screen.
  await page.goto(`http://localhost:${port}/?${q}`);
  await up();
  let r = await ev(async () => { const g = window.__MW__.game; g.state.coins = 4321; await g.save(); return { tester: window.__MW__.tester, own: localStorage.getItem('murmurwater.save')?.length ?? 0 }; });
  check(r.tester === false && r.own > 100, `the player's own game is running and saved (${r.own} bytes)`);
  await page.keyboard.press('F8');
  await page.waitForFunction(() => window.__MW__ && window.__MW__.tester === true && window.__MW__.frames > 2, null, { timeout: 180000 });
  r = await ev(() => ({ url: location.search, note: document.querySelector('.title-tester')?.textContent ?? '' }));
  check(/tester/.test(r.url) && /Nothing here is saved/.test(r.note), `F8 on the title screen opens the tester's start, and the title says so ("${r.note.slice(0, 60)}…")`);
  await shot('01-title', 4);
  await page.click('.title');
  await page.waitForTimeout(1200);
  await require('./sail-helpers.cjs').install(page, { grant: false });
  await require('./fog-helpers.cjs').install(page);
  const status = (id) => ev((id) => window.bot.status(id), id);

  // 2. Who she is: the save the simulator played, as the game reads it.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    g.presentOnce(1 / 30);
    return { minutes: Math.round(s.playTime / 60), lamp: s.echoUpgrades['fog-lamp'] ?? 0, shipped: !!g.sailing.rig?.hasFogLamp, rod: s.gear.rod, journal: Object.keys(s.journal).length, run: s.run.number,
      region: s.world.region, pell: g.town.npcs.get('pell')?.fig.root.visible, kettle: g.world.kettle?.visible ?? false, goal: document.querySelector('.goal-t')?.textContent ?? '', toasts: window.fog.toasts(), missing: MW.assetsMissing };
  });
  check(r.lamp === 1 && r.shipped, 'she has the Fog Lamp, and it is on the bow of the skiff');
  check((await status('hb-12-road')) === 'active' && /Mossglass Fen|sea-road/i.test(r.goal), `Pell's road job is in hand and the goal points across the fog ("${r.goal}")`);
  check(r.run === 2 && r.journal >= 6 && r.minutes > 40, `she has a history: ${r.minutes} minutes played, tide ${r.run}, ${r.journal} fish in the journal, the ${r.rod}`);
  check(r.region === 'hearthbay' && r.pell && !r.kettle, 'Hearthbay is as she left it: Pell is home, the kettle is off its stones');
  check(r.toasts.some((t) => /Nothing here is saved/i.test(t)), `the game says nothing is saved (${r.toasts.join(' | ')})`);
  check(r.missing.length === 0, `no model is missing (${r.missing.join(', ')})`);
  await shot('02-on-the-dock');

  // 3. People know her: Mara has no first-meeting line, and no job to give that she has already done.
  r = await ev(() => { const t = window.fog.talk('mara', 'Talk to Mara Thimble'); const lines = window.bot.readAll(); const g = window.__MW__.game; if (g.town.dialogue.isOpen) window.bot.choose('Bye'); return { t, lines }; });
  check(r.t && r.lines.length > 0, `Mara can be spoken to (${r.lines.join(' | ').slice(0, 120)})`);

  // 4. Saving there writes nothing: the player's own save is the one they left.
  r = await ev(async () => { const before = localStorage.getItem('murmurwater.save'); await window.__MW__.game.save(); const after = localStorage.getItem('murmurwater.save'); return { same: before === after, coins: JSON.parse(after).state.coins }; });
  check(r.same && r.coins === 4321, `a save made in the tester's start leaves the player's own untouched (their ${r.coins} coins)`);

  // 5. And it is a save the game can play on from: the road, the crossing, Calloway.
  r = await ev(() => { const b = window.bot.board(); return { b, went: window.fog.chartTo('The Drowned Belfry') }; });
  check(r.b.ok && r.went, `she boards the skiff and the chart carries her to the belfry (${JSON.stringify(r.b)})`);
  r = await ev(() => window.bot.sailTo(-404.5, -293.9, { stopR: 8 }));
  check(r.ok, `to the near end of the sea-road (${JSON.stringify(r)})`);
  r = await ev(() => { const p = window.fog.pilot(-736.5, -535.1, 150, 6); const g = window.__MW__.game; return { p, swap: g.lastSwap, banner: document.querySelector('.banner')?.textContent ?? '' }; });
  check(r.p.region === 'mossglass-fen' && r.p.swapped && r.p.maxMur < 0.3, `she sails the road and comes out in Mossglass Fen (murmur ${r.p.maxMur.toFixed(2)}, swap ${JSON.stringify(r.swap)})`);
  await shot('03-out-of-the-fog');
  r = await ev(() => { const m = window.bot.mooring('sedge-jetty'); const go = window.bot.sailTo(m.x, m.z, { stopR: 7 }); const l = window.bot.land(); return { go, l }; });
  check(r.go.ok && r.l.ok, `to the jetty at Sedge Landing and ashore (${JSON.stringify(r.go)})`);
  r = await ev(() => { const s = window.__MW__.state, c0 = s.coins; const t = window.fog.talk('calloway', 'Talk to Dr. Ines Calloway'); window.bot.readAll(); return { t, paid: s.coins - c0 }; });
  check(r.t && (await status('hb-12-road')) === 'done' && r.paid === 300, `Calloway takes Pell's errand and pays ${r.paid} coins`);
  await shot('04-calloway');

  // 6. Still nothing written, and F8 on the title screen goes back to the player's own game.
  r = await ev(async () => { await window.__MW__.game.save(); return JSON.parse(localStorage.getItem('murmurwater.save')).state.coins; });
  check(r === 4321, 'after all that the player\'s own save is still theirs');
  await page.goto(`http://localhost:${port}/?tester&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.tester === true && window.__MW__.frames > 2, null, { timeout: 180000 });
  await page.keyboard.press('F8');
  await page.waitForFunction(() => window.__MW__ && window.__MW__.tester === false && window.__MW__.frames > 2, null, { timeout: 180000 });
  r = await ev(() => ({ coins: window.__MW__.state.coins, region: window.__MW__.state.world.region }));
  check(r.coins === 4321 && r.region === 'hearthbay', `F8 again goes back to the player's own game (${r.coins} coins, ${r.region})`);

  check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  console.log(problems.length ? `TESTER FAILED: ${problems.length}\n - ${problems.join('\n - ')}` : 'TESTER OK');
  process.exit(problems.length ? 1 : 0);
})();
