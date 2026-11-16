// Electron smoke test: launches the packaged app entry (dist/ via electron/main.cjs), waits for the game to
// boot, and fails if any model, the voice index, a recorded sound or a music file can't load, or if the tester's
// start (F8 on the title screen) does not come up or touches the save. Linux CI: run under xvfb-run.
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
  // The tester's start: F8 on the title screen brings the game back as a keeper with the Fog Lamp and Pell's
  // road job, and saving there writes nothing to the player's own save.
  await win.keyboard.press('F8');
  await win.waitForFunction(() => window.__MW__ && window.__MW__.tester === true && window.__MW__.frames > 3, null, { timeout: 180000 });
  const t = await win.evaluate(async () => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    const before = (await window.mwNative.readSave()).main;
    await g.save();
    const after = (await window.mwNative.readSave()).main;
    return { url: location.href, lamp: s.echoUpgrades['fog-lamp'] ?? 0, road: MW.quests.questStatus(s, 'hb-12-road'), untouched: before === after, told: !!document.querySelector('.title-tester'), missing: MW.assetsMissing };
  });
  console.log(JSON.stringify(t));
  const testerOk = t.lamp === 1 && t.road === 'active' && t.untouched && t.told && t.missing.length === 0;
  if (!testerOk) console.log("the tester's start is wrong");
  await app.close();
  const ok = Array.isArray(r.missing) && r.missing.length === 0 && typeof r.voiced === 'number' && r.voiced > 0
    && r.sounds.length === 0 && r.music.length === 0 && errors.length === 0 && testerOk;
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  console.log(ok ? 'ELECTRON OK' : 'ELECTRON FAILED');
  process.exit(ok ? 0 : 1);
})();
