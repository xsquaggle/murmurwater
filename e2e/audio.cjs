// Audio bot: checks that every recorded sound loads, that playing the game triggers the recordings (not
// the synth stand-ins), and measures the mix so nothing clips and nothing is buried.
//   node e2e/audio.cjs            (needs `npx vite build && npx vite preview --port 4173`)
// Prints a level table (peak and RMS, 0..1 at the master output) and exits 1 on failure.
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  // A reload waits for the old page to let go of its renderer: slow on a software GPU, so give it time.
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=15&quality=low`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

  // 1. Everything loads.
  const load = await page.evaluate(async () => {
    const g = window.__MW__.game; g.paused = true; g.halted = true; g.skipRender = true;
    g.audio.start();
    const missing = await g.audio.preload();
    return { missing, state: g.audio.ctx.state, rate: g.audio.ctx.sampleRate };
  });
  check(load.missing.length === 0, `all recorded sounds load (${load.missing.length ? 'missing: ' + load.missing.join(', ') : 'none missing'})`);
  console.log(`audio context: ${load.state}, ${load.rate} Hz`);

  // 2. Playing the game triggers the recordings.
  const played = await page.evaluate(async () => {
    const g = window.__MW__.game;
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    // Walk the dock, then the shore.
    const walk = (x, z, sec) => { g.input.simulate('KeyW', true); for (let t = 0; t < sec; t += 1 / 60) { g.camYaw = Math.atan2(x - g.pos.x, z - g.pos.z); g.simulate(1 / 60); g.presentOnce(1 / 60); } g.input.simulate('KeyW', false); g.simulate(0.2); };
    const dock = g.world.region.landmarks.dock, end = g.world.dockEnd;
    g.pos.set(dock.x - 2, g.groundAt(dock.x - 2, dock.z), dock.z); g.snapCamera();
    walk(end.x, end.z, 5);
    const sp = g.world.region.landmarks.spawn;
    for (const [x, z] of [[sp.x + 30, sp.z + 4], [dock.x + 14, dock.z - 6], [dock.x + 24, dock.z - 14]]) { const y = g.groundAt(x, z); if (y === null) continue; g.pos.set(x, y, z); g.snapCamera(); walk(x + 6, z - 4, 3); }
    // Fish until three are landed.
    g.pos.set(end.x, g.groundAt(end.x, end.z), end.z); g.yaw = -Math.PI / 2; g.snapCamera(); g.simulate(0.3);
    let landed = 0;
    for (let attempt = 0; attempt < 12 && landed < 3; attempt++) {
      g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
      let guard = 0;
      while (g.session.phase === 'charging' && g.session.power < 0.88 && guard++ < 200) { g.simulate(1 / 60, () => ({ ...NO, primary: true })); g.presentOnce(1 / 60); }
      g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
      guard = 0;
      while (['casting', 'waiting'].includes(g.session.phase) && guard++ < 60 * 40) { g.simulate(1 / 60, () => NO); g.presentOnce(1 / 60); }
      if (g.session.phase !== 'bite') { g.simulate(1, () => NO); continue; }
      g.simulate(0.15, () => NO);
      g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
      guard = 0;
      while ((g.session.phase === 'fighting' || g.session.phase === 'hauling') && guard++ < 60 * 60) { g.simulate(1 / 60, (gg) => { const f = gg.session.fight, h = gg.session.haul; if (h) return { ...NO, primary: !h.snag && !h.warned && h.tension < 0.7 }; if (!f) return NO; return { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 }; }); g.presentOnce(1 / 60); }
      if (g.session.phase === 'landed') landed++;
      g.simulate(2.6, () => NO);
    }
    g.botInput = null;
    // Sell to Mara (coins), open and close the journal (interface sounds).
    g.town.openScreen('journal'); g.presentOnce(1 / 60); document.querySelector('.sc-tab:not(.on)')?.click(); g.town.closeScreens();
    for (let i = 0; i < 30; i++) g.presentOnce(1 / 30);
    return { landed, played: { ...g.audio.played } };
  });
  console.log('landed', played.landed, JSON.stringify(played.played));
  for (const name of ['step-wood', 'cast-swish', 'reel-spin', 'bobber-plop', 'bite-dunk', 'hook-set', 'land-splash', 'ui-open', 'ui-close', 'page-turn']) {
    check((played.played[name] ?? 0) > 0, `${name} played (${played.played[name] ?? 0})`);
  }
  check(['step-grass', 'step-sand', 'step-cobble'].some((n) => played.played[n] > 0), 'a footstep off the dock played');

  // 3. The mix, in real time: the bed (music, waves) alone, then each foreground sound over it.
  //    Needs a running audio clock; a machine with no audio output at all only gets the checks above.
  if (load.state !== 'running') {
    console.warn('audio clock is not running here: mix measurement skipped');
    console.log(problems.length ? 'AUDIO FAILED\n' + problems.join('\n') : 'AUDIO OK (load and triggers only)');
    await browser.close();
    process.exit(problems.length ? 1 : 0);
  }
  const measure = (label, fn, seconds) => page.evaluate(async ([fn, seconds]) => {
    const g = window.__MW__.game, a = g.audio;
    new Function('a', 'g', fn)(a, g);
    let peak = 0, sum = 0, n = 0;
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) { const l = a.level(); peak = Math.max(peak, l.peak); sum += l.rms * l.rms; n++; await new Promise((r) => setTimeout(r, 20)); }
    return { peak, rms: Math.sqrt(sum / n) };
  }, [fn, seconds]).then((r) => ({ label, ...r }));
  const rows = [];
  await page.waitForFunction(() => window.__MW__.game.audio.played['music:hearthbay-day'] > 0, null, { timeout: 60000 }).catch(() => {});
  check(await page.evaluate(() => window.__MW__.game.audio.played['music:hearthbay-day'] > 0), 'the day theme started');
  await page.waitForTimeout(4500); // let the music fade in
  // Night falls: the night theme takes over; then back to day for the measurements.
  const night = await page.evaluate(async () => {
    const g = window.__MW__.game; g.state.hour = 23; for (let i = 0; i < 10; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); }
    for (let i = 0; i < 300 && !g.audio.played['music:hearthbay-night']; i++) await new Promise((r) => setTimeout(r, 100));
    const ok = g.audio.played['music:hearthbay-night'] > 0;
    g.state.hour = 15; for (let i = 0; i < 10; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); }
    for (let i = 0; i < 300 && g.audio.played['music:hearthbay-day'] < 2; i++) await new Promise((r) => setTimeout(r, 100));
    return ok;
  });
  check(night, 'the night theme takes over after dark');
  await page.waitForTimeout(5000);
  rows.push(await measure('bed: music + waves', '', 4));
  rows.push(await measure('cast (hard, clean)', 'a.cast(0.95, 1.1, true)', 1.4));
  rows.push(await measure('cast (soft)', 'a.cast(0.3, 0.8, false)', 1.2));
  rows.push(await measure('plop (hard)', 'a.plop(0.95)', 0.8));
  rows.push(await measure('nibble', 'a.nibble()', 0.6));
  rows.push(await measure('bite', 'a.bite()', 0.9));
  rows.push(await measure('hook (perfect)', 'a.hook(true)', 0.8));
  rows.push(await measure('thrash splash', 'a.splash(1.2)', 1.4));
  rows.push(await measure('reel (2 s)', 'window.__reel = setInterval(() => a.update(1 / 60, { reeling: true, reelSpeed: 0.6, tension: 0.6, fighting: true, sea: 0.5 }), 16)', 2));
  await page.evaluate(() => { clearInterval(window.__reel); const a = window.__MW__.game.audio; a.update(1 / 60, { reeling: false, reelSpeed: 0, tension: 0, fighting: false, sea: 0.5 }); });
  await page.waitForTimeout(400);
  rows.push(await measure('line strain', 'a.strain()', 0.9));
  rows.push(await measure('land + common catch', 'a.landSplash(); a.catchFanfare(0)', 2));
  rows.push(await measure('land + rare catch', 'a.landSplash(); a.catchFanfare(3)', 4.2));
  rows.push(await measure('line snap', 'a.snap()', 0.7));
  rows.push(await measure('coins (8 fish)', 'a.coin(8)', 1.2));
  rows.push(await measure('quest accept', 'a.questAccept()', 1.4));
  rows.push(await measure('quest done', 'a.questDone()', 3.8));
  rows.push(await measure('step wood (run)', 'a.step("wood", true)', 0.4));
  rows.push(await measure('step grass (walk)', 'a.step("grass", false)', 0.5));
  rows.push(await measure('ui click', 'a.click()', 0.3));
  rows.push(await measure('gulls', 'a.sfx("gulls", { bus: "ambience" })', 2));
  // The sea-road and the Fen: the new one-shots, then the Fen's own air by day and by night.
  rows.push(await measure('fog lamp lights', 'a.fogLampLight()', 1.6));
  rows.push(await measure('road chimes (three, rising)', 'a.roadChime(0); setTimeout(() => a.roadChime(1), 500); setTimeout(() => a.roadChime(2), 1000)', 2.8));
  rows.push(await measure('the crossing', 'a.fogCross()', 5));
  rows.push(await measure('packet box (a sale)', 'a.packetBox(5)', 2));
  rows.push(await measure('reeds on the hull', 'a.reedBrush(1)', 1.4));
  const synth = await page.evaluate(() => { const p = window.__MW__.game.audio.played; return ['fog-lamp-light', 'sea-road-chime', 'fog-cross', 'packet-box', 'reed-brush'].filter((n) => !(p[n] > 0)); });
  check(synth.length === 0, `the sea-road and Fen recordings play (${synth.length ? 'stand-ins instead: ' + synth.join(', ') : 'all five'})`);
  const fen = await page.evaluate(() => {
    const g = window.__MW__.game, s = g.state;
    s.boats.owned.push('skiff'); s.boats.current = 'skiff'; s.echoUpgrades['fog-lamp'] = 1;
    const ok = g.enterRegion('mossglass-fen', false);
    g.pos.set(-846.5, g.groundAt(-846.5, -616.5) ?? 1.5, -616.5); g.snapCamera(); s.hour = 12;
    for (let i = 0; i < 10; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); }
    return ok;
  });
  check(fen, 'the keeper is set down on Sedge Landing');
  await page.waitForTimeout(7000); // the day theme fades out and the fen's loop comes up
  const fenDay = await measure('bed: the Fen by day', '', 8);
  await page.evaluate(() => { const g = window.__MW__.game; g.state.hour = 23; for (let i = 0; i < 10; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); } });
  await page.waitForTimeout(7000);
  const fenNight = await measure('bed: the Fen by night', '', 8);
  rows.push(fenDay, fenNight);
  // Saltbone Reach: the bolt going in, thunder, the cone and the Kettles; then its own sea on a fair day, and the
  // Deacon at his height with a bolt close by.
  rows.push(await measure('a bolt into the sea 40 m off', 'a.lightning(40)', 6));
  rows.push(await measure('thunder far off', 'a.thunder(600)', 7.5));
  rows.push(await measure('the storm cone', 'a.stormCone()', 1.4));
  rows.push(await measure('the Kettles boom', 'a.swellBoom(1)', 3.4));
  const synthReach = await page.evaluate(() => { const p = window.__MW__.game.audio.played; return ['lightning-strike', 'thunder-near', 'thunder-far', 'storm-cone', 'swell-boom'].filter((n) => !(p[n] > 0)); });
  check(synthReach.length === 0, `the Reach's recordings play (${synthReach.length ? 'stand-ins instead: ' + synthReach.join(', ') : 'all five'})`);
  const atHour = (h) => page.evaluate((h) => { const g = window.__MW__.game; g.state.hour = h; g.world.hour = h; g.rushSky?.(0); for (let i = 0; i < 10; i++) { g.state.hour = h; g.simulate(1 / 30); g.presentOnce(1 / 30); } return { power: g.world.weather.power, rain: g.world.weather.rain, loops: ['reach-day', 'storm-rain', 'storm-wind'].filter((n) => g.audio.loops.has(n)) }; }, h);
  const reach = await page.evaluate(() => {
    const g = window.__MW__.game;
    const ok = g.enterRegion('saltbone-reach', false);
    const end = g.world.dockEnd; g.pos.set(end.x, g.groundAt(end.x, end.z) ?? 1.5, end.z); g.snapCamera();
    return ok;
  });
  check(reach, 'the keeper is set down on the quay of Tryworks Landing');
  await atHour(12); await page.waitForTimeout(7000);
  const reachFair = await measure('bed: the Reach on a fair day', '', 8);
  const blowing = await atHour(14.75); await page.waitForTimeout(7000);
  const deacon = await measure('bed: the Deacon at his height', '', 8);
  const bolt = await measure('a bolt 30 m off in the Deacon', 'a.lightning(30)', 6);
  rows.push(reachFair, deacon, bolt);
  const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1).padStart(6) : '  -inf');
  console.log('\nlevel at the master output          peak dBFS   RMS dBFS');
  for (const r of rows) console.log(`  ${r.label.padEnd(30)} ${db(r.peak)}     ${db(r.rms)}`);
  const bed = rows[0];
  check(bed.rms > 0.004, `the music and sea bed is audible (RMS ${db(bed.rms)} dBFS)`);
  check(rows.every((r) => r.peak < 0.97), `nothing clips (loudest peak ${db(Math.max(...rows.map((r) => r.peak)))} dBFS)`);
  // Foreground sounds should peak well clear of the bed's average level (12 dB or more).
  for (const r of rows.slice(1)) if (!/step|click|gulls|reel|bed:|reeds|chimes|far off|cone/.test(r.label)) check(r.peak > bed.rms * 4, `${r.label} stands out over the bed`);
  // The Fen ashore has no music: its bed is the frogs and insects, heard but well under a voice or a catch.
  for (const r of [fenDay, fenNight]) check(r.rms > 0.0015 && r.rms < 0.12 && r.peak < 0.8, `${r.label} is there and is not loud (RMS ${db(r.rms)}, peak ${db(r.peak)} dBFS)`);

  // The Reach has no music either: its sea is heard and is not loud; a storm is plainly louder without drowning
  // the game; a bolt close by stands out of the storm and does not clip.
  check(blowing.power > 0.9 && blowing.rain > 0.9 && blowing.loops.length === 3, `the Deacon is at his height, with the recorded sea, rain and wind (${JSON.stringify(blowing)})`);
  check(reachFair.rms > 0.0015 && reachFair.rms < 0.12 && reachFair.peak < 0.8, `${reachFair.label} is there and is not loud (RMS ${db(reachFair.rms)}, peak ${db(reachFair.peak)} dBFS)`);
  check(deacon.rms > reachFair.rms * 1.3 && deacon.rms < 0.25 && deacon.peak < 0.9, `${deacon.label} is louder than a fair day and does not drown the game (RMS ${db(deacon.rms)}, peak ${db(deacon.peak)} dBFS)`);
  check(bolt.peak > deacon.rms * 2.5 && bolt.peak < 0.97, `${bolt.label} stands out of the storm and does not clip (peak ${db(bolt.peak)} dBFS)`);
  // The bite is the sound the game is played by: it must stand clear of the storm's own peaks.
  const bite = rows.find((r) => r.label === 'bite');
  check(!!bite && bite.peak > deacon.peak * 1.25, `the bite stands clear of the storm (${db(bite?.peak ?? 0)} against the storm's peak of ${db(deacon.peak)} dBFS)`);

  if (errors.length) problems.push('page errors: ' + errors.join(' | '));
  console.log(problems.length ? 'AUDIO FAILED\n' + problems.join('\n') : 'AUDIO OK');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
