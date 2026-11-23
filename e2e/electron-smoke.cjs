// Electron smoke test: launches the packaged app entry (dist/ via electron/main.cjs), waits for the game to
// boot, and fails if any model, the voice index, a recorded sound or a music file can't load, or if the tester's
// starts (F8 on the title screen, three times) do not come up or touch the save. Linux CI: run under xvfb-run.
const { _electron: electron } = require('playwright');
(async () => {
  const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, MW_SMOKE: '1' } });
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error' || /stand-ins/.test(m.text())) errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForFunction(() => window.__MW__ && window.__MW__.frames > 3, null, { timeout: 180000 });
  const r = await win.evaluate(async () => {
    const g = window.__MW__.game;
    const voiced = await fetch('audio/voice/voiced.json').then((x) => x.json()).then((v) => Object.keys(v).length).catch((e) => 'fetch failed: ' + e.message);
    // Every recorded sound and every music file must be inside the packaged app.
    const sounds = await g.audio.preload();
    const music = [];
    for (const m of ['hearthbay-day', 'hearthbay-night', 'gull-point', 'open-water', 'sting-quest', 'sting-rare', 'sting-discover']) {
      const ok = await fetch(`audio/music/${m}.ogg`).then((x) => x.ok).catch(() => false);
      if (!ok) music.push(m);
    }
    return { url: location.href, missing: window.__MW__.assetsMissing ?? null, npcs: [...g.town.npcs.keys()], voiced, sounds, music };
  });
  console.log(JSON.stringify(r));
  // The tester's starts: F8 on the title screen brings the game back as the keeper of the newest slice (the
  // Puffin afloat, four relics, three pearls never set), F8 again as the one before (the cat aboard, the Puffin
  // found, her price in the purse), a third time as the oldest (the Fog Lamp and Pell's road job), and saving in
  // any of them writes nothing to the player's own save.
  const testerUp = (id) => win.waitForFunction((id) => window.__MW__ && window.__MW__.tester === true && window.__MW__.testerStart === id && window.__MW__.frames > 3, id, { timeout: 180000 });
  const untouched = () => win.evaluate(async () => {
    const before = (await window.mwNative.readSave()).main;
    await window.__MW__.game.save();
    return before === (await window.mwNative.readSave()).main;
  });
  await win.keyboard.press('F8');
  await testerUp('finds');
  const f = await win.evaluate(() => {
    const MW = window.__MW__, s = MW.state;
    return { url: location.href, relics: s.relics.length, pearls: s.moonpearls, boat: s.boats.current, version: s.version, told: document.querySelector('.title-tester')?.textContent ?? '', missing: MW.assetsMissing };
  });
  f.untouched = await untouched();
  console.log(JSON.stringify(f));
  await win.keyboard.press('F8');
  await testerUp('crew');
  const c = await win.evaluate(() => {
    const MW = window.__MW__, s = MW.state;
    return { url: location.href, coins: s.coins, crew: s.crew.hired, yard: s.flags.includes('boatyard-open'), refit: MW.quests.questStatus(s, 'hb-13-refit'), told: document.querySelector('.title-tester')?.textContent ?? '', missing: MW.assetsMissing };
  });
  c.untouched = await untouched();
  console.log(JSON.stringify(c));
  await win.keyboard.press('F8');
  await testerUp('fen');
  const t = await win.evaluate(() => {
    const MW = window.__MW__, s = MW.state;
    return { url: location.href, lamp: s.echoUpgrades['fog-lamp'] ?? 0, road: MW.quests.questStatus(s, 'hb-12-road'), told: document.querySelector('.title-tester')?.textContent ?? '', missing: MW.assetsMissing };
  });
  t.untouched = await untouched();
  console.log(JSON.stringify(t));
  const testerOk = f.relics === 4 && f.pearls === 3 && f.boat === 'puffin' && f.untouched && /1 of 3/.test(f.told) && f.missing.length === 0
    && c.coins >= 40000 && c.crew.includes('biscuit') && c.yard && c.refit === 'active' && c.untouched && /2 of 3/.test(c.told) && c.missing.length === 0
    && t.lamp === 1 && t.road === 'active' && t.untouched && /3 of 3/.test(t.told) && t.missing.length === 0;
  if (!testerOk) console.log("a tester's start is wrong");
  await app.close();
  const ok = Array.isArray(r.missing) && r.missing.length === 0 && typeof r.voiced === 'number' && r.voiced > 0
    && r.sounds.length === 0 && r.music.length === 0 && errors.length === 0 && testerOk;
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  console.log(ok ? 'ELECTRON OK' : 'ELECTRON FAILED');
  process.exit(ok ? 0 : 1);
})();
