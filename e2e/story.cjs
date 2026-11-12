// Story bot: plays the whole Hearthbay chain through the real game (talking, fishing, selling, the shop UI,
// the ferry, lighting the lamp), saves, reloads, and checks the story survived. Exits 1 on any failure.
// A few catches of specific species are injected as quest events (marked SHORTCUT) to keep the run short;
// everything else goes through the same code paths a player uses.
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/story';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const fail = async (msg) => { console.error('STORY FAILED:', msg, errors); await page.screenshot({ path: `${outDir}/failure.png` }); await browser.close(); process.exit(1); };
  const shot = async (name) => {
    await page.evaluate(() => { const g = window.__MW__.game; for (let i = 0; i < 24; i++) g.presentOnce(1 / 30); });
    // The bot runs game time far faster than real time; let CSS fades (dialogue, screen fade) finish so
    // the shot shows what a player would see.
    await page.waitForTimeout(900);
    // Screenshots are evidence, not the test: on a slow software renderer a timeout is only a warning.
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=16.5&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });

  // Helpers living in the page.
  await page.evaluate(() => {
    const g = window.__MW__.game; g.paused = true; g.halted = true;
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    const place = (id) => g.world.region.places.find((p) => p.id === id);
    window.bot = {
      goTo(x, z, yaw) { g.pos.set(x, g.groundAt(x, z) ?? 1.5, z); if (yaw !== undefined) { g.yaw = yaw; } g.snapCamera(); g.simulate(0.3); },
      goPlace(id) { const p = place(id); this.goTo(p.x, p.z); },
      goNpc(id) {
        const f = g.town.npcs.get(id).fig.root.position;
        for (let a = 0; a < 12; a++) { const x = f.x + Math.cos(a) * 1.6, z = f.z + Math.sin(a) * 1.6; if (g.groundAt(x, z) !== null) { this.goTo(x, z, Math.atan2(f.x - x, f.z - z)); return; } }
        throw new Error('no walkable spot next to ' + id);
      },
      interact() { g.input.simulate('KeyE', true); g.simulate(1 / 60); g.input.simulate('KeyE', false); g.simulate(1 / 60); return g.town.dialogue.isOpen || g.town.screens.isOpen; },
      /** Click through every line; returns the choice labels shown at the end. */
      readAll() {
        const d = g.town.dialogue; let k = 0;
        while (d.isOpen && k++ < 60) { d.advance(); g.simulate(0.05); g.presentOnce(1 / 60); const c = [...document.querySelectorAll('.dlg-choice')].map((b) => b.textContent); if (c.length) return c; }
        return [];
      },
      choose(label) {
        this.readAll();
        const btns = [...document.querySelectorAll('.dlg-choice')];
        const i = btns.findIndex((b) => b.textContent.includes(label));
        if (i < 0) return false;
        g.town.dialogue.pick(i); g.simulate(0.1); return true;
      },
      fish(n) {
        let landed = 0;
        for (let attempt = 0; attempt < n * 3 && landed < n; attempt++) {
          g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
          let guard = 0;
          while (g.session.phase === 'charging' && g.session.power < 0.88 && guard++ < 200) g.simulate(1 / 60, () => ({ ...NO, primary: true }));
          g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
          guard = 0;
          while (['casting', 'waiting'].includes(g.session.phase) && guard++ < 60 * 40) g.simulate(1 / 60, () => NO);
          if (g.session.phase !== 'bite') { g.simulate(1, () => NO); continue; }
          g.simulate(0.15, () => NO);
          g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
          guard = 0;
          while (g.session.phase === 'fighting' && guard++ < 60 * 60) g.simulate(1 / 60, (gg) => { const f = gg.session.fight; if (!f) return NO; return { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 }; });
          if (g.session.phase === 'landed') landed++;
          g.simulate(2.6, () => NO);
        }
        g.botInput = null;
        return landed;
      },
      fishFromDock(n) { this.goTo(g.world.dockEnd.x, g.world.dockEnd.z, -Math.PI / 2); return this.fish(n); },
      status(id) { return window.__MW__.quests.questStatus(g.state, id); },
    };
  });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const status = (id) => ev((id) => window.bot.status(id), id);
  const expectStatus = async (id, want) => { const s = await status(id); if (s !== want) await fail(`${id} is ${s}, expected ${want}`); };

  // 1. Meet Mara and take the first job.
  await ev(() => window.bot.goPlace('mara-stall'));
  await shot('01-harbour');
  if (!(await ev(() => window.bot.interact()))) await fail('could not talk to Mara');
  await page.evaluate(() => { window.__MW__.game.town.dialogue.advance(); });
  await shot('02-mara-intro');
  let choices = await ev(() => window.bot.readAll());
  if (!choices.some((c) => c.includes('do it'))) await fail('no accept choice: ' + choices);
  await ev(() => window.bot.choose('do it'));
  await expectStatus('hb-01-salt', 'active');

  // 2. Three fish off the end of the dock.
  const got = await ev(() => window.bot.fishFromDock(3));
  if (got < 3) await fail(`only landed ${got} fish`);
  await shot('03-fishing');
  await expectStatus('hb-01-salt', 'ready');

  // 3. Hand in; Mara offers the next job straight away; sell the catch through her.
  await ev(() => window.bot.goPlace('mara-stall'));
  await ev(() => window.bot.interact());
  choices = await ev(() => window.bot.readAll());
  await expectStatus('hb-01-salt', 'done');
  if (!choices.some((c) => c.includes('do it'))) await fail('Mara did not offer hb-02: ' + choices);
  await ev(() => window.bot.choose('do it'));
  await expectStatus('hb-02-supper', 'active');
  await ev(() => window.bot.fishFromDock(5));
  await ev(() => window.bot.goPlace('mara-stall'));
  await ev(() => window.bot.interact());
  choices = await ev(() => window.bot.readAll());
  if (!choices.some((c) => c.startsWith('1Sell'))) await fail('no sell option: ' + choices);
  await shot('04-sell-choice');
  await ev(() => window.bot.choose('Sell'));
  const afterSell = await ev(() => ({ hold: window.__MW__.state.hold.length, coins: window.__MW__.state.coins }));
  if (afterSell.hold !== 0 || afterSell.coins <= 25) await fail('selling failed ' + JSON.stringify(afterSell));
  choices = await ev(() => window.bot.readAll());
  await expectStatus('hb-02-supper', 'done');
  await ev(() => window.bot.choose('do it')); // hb-03: the proper rod
  await expectStatus('hb-03-proper-rod', 'active');

  // 4. The notice board is open now.
  await ev(() => window.bot.goPlace('notice-board'));
  await ev(() => window.bot.interact());
  if (!(await ev(() => window.__MW__.game.town.screens.current === 'board'))) await fail('notice board did not open');
  await page.click('.note .btn.gold');
  await shot('05-board');
  await ev(() => window.__MW__.game.town.closeScreens());

  // 5. Buy the Harbour Rod through the shop screen (coins topped up: the economy has its own simulator).
  await ev(() => { const g = window.__MW__.game; g.state.coins += 600; window.bot.goPlace('mara-stall'); window.bot.interact(); });
  choices = await ev(() => window.bot.readAll());
  if (!(await ev(() => window.bot.choose('good shelf')))) await fail('no shop option: ' + choices);
  if (!(await ev(() => window.__MW__.game.town.screens.current === 'shop'))) await fail('shop did not open');
  await page.click('.shop-col .item:nth-of-type(2) .btn.gold');
  await shot('06-shop');
  await ev(() => window.__MW__.game.town.closeScreens());
  await expectStatus('hb-03-proper-rod', 'ready');
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  await expectStatus('hb-03-proper-rod', 'done');
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 6. Wick's drawing (SHORTCUT: the snapper catch is injected).
  await ev(() => window.bot.goNpc('wick'));
  await ev(() => window.bot.interact());
  await shot('07-wick');
  await ev(() => { window.bot.readAll(); window.bot.choose('do it'); });
  await expectStatus('hb-04-drawing', 'active');
  await ev(() => window.__MW__.game.town.questEvent({ type: 'catch', fishId: 'coral-snapper', weight: 1.2, trait: null, perfect: false }));
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  await expectStatus('hb-04-drawing', 'done');
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 7. Pell: the dark lamp (SHORTCUT lampjaw), then the relight and the ferry.
  await ev(() => window.bot.goNpc('pell'));
  await ev(() => { window.bot.interact(); window.bot.readAll(); window.bot.choose('do it'); });
  await expectStatus('hb-05-dark-lamp', 'active');
  await ev(() => window.__MW__.game.town.questEvent({ type: 'catch', fishId: 'lampjaw', weight: 2, trait: null, perfect: true }));
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  await expectStatus('hb-05-dark-lamp', 'done');
  choices = await ev(() => window.bot.readAll());
  await ev(() => window.bot.choose('do it'));
  await expectStatus('hb-06-relight', 'active');
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  if (!(await ev(() => window.bot.choose('Gull Point')))) await fail('no ferry option');
  await ev(() => window.__MW__.game.simulate(4));
  const isl = await ev(() => window.__MW__.game.town.island);
  if (isl !== 'gull-point') await fail('ferry did not arrive: ' + isl);
  await shot('08-gull-point');

  // 8. Light the lamp at dusk.
  await ev(() => { const g = window.__MW__.game; g.state.hour = 19.6; window.bot.goPlace('lighthouse-lamp'); window.bot.interact(); g.simulate(7); });
  await expectStatus('hb-06-relight', 'ready');
  await ev(() => { const g = window.__MW__.game; const L = g.world.region.landmarks.lighthouse; g.debugCam = { pos: g.pos.clone().set(L.x + 26, 14, L.z + 40), look: g.pos.clone().set(L.x, 18, L.z) }; });
  await shot('09-lamp-lit');
  await ev(() => { window.__MW__.game.debugCam = null; });
  await ev(() => { window.bot.goNpc('pell'); window.bot.interact(); window.bot.readAll(); });
  await expectStatus('hb-06-relight', 'done');
  const end = await ev(() => { const s = window.__MW__.state; return { boats: s.boats.owned, lit: s.flags.includes('hb-lighthouse-lit'), pearls: s.moonpearls, done: s.quests.done.length }; });
  if (!end.lit || !end.boats.includes('skiff') || end.done !== 6) await fail('end state wrong ' + JSON.stringify(end));
  await ev(() => { window.bot.choose('Hearthbay'); window.__MW__.game.simulate(4); });
  if ((await ev(() => window.__MW__.game.town.island)) !== 'hearthbay') await fail('ferry home failed');

  // 9. Journal and settings screens render.
  await ev(() => window.__MW__.game.town.openScreen('journal'));
  await shot('10-journal');
  await ev(() => window.__MW__.game.town.openScreen('settings'));
  await shot('11-settings');
  await ev(() => window.__MW__.game.town.closeScreens());

  // 10. Save, reload, and the story is still done.
  await ev(() => window.__MW__.game.save());
  await page.goto(`http://localhost:${port}/?notitle&quality=low&keepfresh`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 1, null, { timeout: 180000 });
  const reloaded = await ev(() => window.__MW__.state.quests.done.length);
  if (reloaded !== 6) await fail('reload lost the story: ' + reloaded);
  if (errors.length) await fail('page errors');
  console.log(JSON.stringify(end));
  console.log('STORY OK');
  await browser.close();
})();
