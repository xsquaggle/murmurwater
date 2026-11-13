// Electron smoke test: launches the packaged app entry (dist/ via electron/main.cjs), waits for the game to
// boot, and fails if any model, the voice index, a recorded sound or a music file can't load. Linux CI: run under xvfb-run.
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
  await app.close();
  const ok = Array.isArray(r.missing) && r.missing.length === 0 && typeof r.voiced === 'number' && r.voiced > 0
    && r.sounds.length === 0 && r.music.length === 0 && errors.length === 0;
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  console.log(ok ? 'ELECTRON OK' : 'ELECTRON FAILED');
  process.exit(ok ? 0 : 1);
})();
