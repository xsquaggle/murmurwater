// Sailing bot: takes the skiff from Pell, sails it with the real helm keys along routes found through the
// water, lands, finishes the two sailing quests, fishes from the boat at the Teeth, uses the chart to travel
// home, and checks the shore, the region's edge and a save made at sea. Exits 1 on any failure.
// Shortcuts: it starts from a granted state (the lamp just lit, on Gull Point) and pins the clock for fishing.
// Usage: node e2e/sail.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/sail';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // A reload waits for the old page to let go of its renderer: slow on a software GPU, so give it time.
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
  const shot = async (name, frames = 20) => {
    await page.evaluate((n) => { const g = window.__MW__.game; for (let i = 0; i < n; i++) g.presentOnce(1 / 30); }, frames);
    await page.waitForTimeout(700);
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  const q = `notitle&hour=10&quality=${process.env.MW_QUALITY || 'medium'}`;
  await page.goto(`http://localhost:${port}/?fresh&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });

  await require('./sail-helpers.cjs').install(page);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const status = (id) => ev((id) => window.bot.status(id), id);

  // 1. Pell hands over the skiff on Gull Point and sends the player west.
  check((await status('hb-06-relight')) === 'ready', 'the lamp is lit and Pell is waiting to hear of it');
  let pell = await ev(() => window.bot.npc('pell'));
  let r = await ev((p) => window.bot.walk(p.x, p.z, 10, () => window.__MW__.game.town.focusPrompt === 'Talk to Pell'), pell);
  check(r === 'Talk to Pell', `Pell is on Gull Point to be talked to (prompt: ${r})`);
  await ev(() => window.bot.interact());
  let choices = await ev(() => window.bot.readAll());
  check((await status('hb-06-relight')) === 'done', 'handing in the relight gives the skiff');
  let st = await ev(() => ({ owned: window.__MW__.state.boats.owned, floats: window.__MW__.clearance(window.__MW__.game.sailing.env, window.__MW__.game.sailing.def, window.__MW__.game.sailing.boat.x, window.__MW__.game.sailing.boat.z, window.__MW__.game.sailing.boat.heading) }));
  check(st.owned.includes('skiff') && st.floats >= 0, `the skiff is in the water off the landing (clearance ${st.floats.toFixed(2)} m)`);
  check(choices.some((c) => c.includes('do it')) && !choices.some((c) => /Hearthbay|Gull/.test(c)), `Pell offers the kettle errand and no more ferry rides (${choices.join(' | ')})`);
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-07-kettle')) === 'active', 'A Kettle on the Shore is under way');
  await shot('01-skiff-given');

  // 2. Walk down to her and climb in.
  r = await ev(() => window.bot.board());
  check(r.ok, `walked to the skiff and boarded with E (${JSON.stringify(r)})`);
  await shot('02-aboard-gull');

  // 3. Casting is refused while she has way on.
  r = await ev(() => {
    const g = window.__MW__.game; g.skipRender = true; g.input.simulate('KeyW', true); for (let i = 0; i < 90; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); }
    g.skipRender = false;
    const speed = g.sailing.boat.speed;
    g.input.simulate('Space', true); g.simulate(1 / 30); const phase = g.session.phase; g.input.simulate('Space', false); g.input.simulate('KeyW', false); g.simulate(0.2);
    return { speed, phase };
  });
  check(r.speed > 2 && r.phase === 'idle', `no casting under way (${r.speed.toFixed(1)} m/s, rod ${r.phase})`);

  // 4. West to Kettle Isle: found on the way in, then beach her and step off.
  const kettle = await ev(() => window.bot.mooring('kettle-beach'));
  const before = await ev(() => window.bot.state());
  r = await ev((m) => window.bot.sailTo(m.x, m.z, { stopR: 4 }), kettle);
  check(r.ok, `sailed from Gull Point to Kettle Isle: ${r.metres} m in ${r.seconds} s`);
  await shot('03-kettle-isle-ahead');
  st = await ev(() => window.bot.state());
  check(st.charted.includes('kettle-isle') && st.coins > before.coins, `Kettle Isle went on the chart and paid (${st.coins - before.coins} coins)`);
  r = await ev(() => window.bot.land());
  check(r.ok && r.prompt === 'Step ashore', `stepped ashore on Kettle Isle (${JSON.stringify(r)})`);
  check(r.island === 'kettle-isle', `the game knows which island this is (${r.island})`);
  check(r.boardable, `she can be boarded again from where she put the player ashore on Kettle Isle (${r.hull?.toFixed(1)} m from the hull)`);
  await shot('04-ashore-kettle');

  // 5. The kettle.
  const camp = await ev(() => window.__MW__.game.world.region.places.find((p) => p.id === 'keepers-kettle'));
  r = await ev((p) => window.bot.walk(p.x, p.z, 40, () => window.__MW__.game.town.focusPrompt === 'Take the kettle'), camp);
  check(r === 'Take the kettle', `walked up the beach to the kettle (prompt: ${r})`);
  await shot('05-kettle-camp');
  await ev(() => window.bot.tap('KeyE'));
  check((await status('hb-07-kettle')) === 'ready' && (await ev(() => !window.__MW__.game.world.kettle.visible)), 'taking the kettle finishes the errand and it leaves its stones');

  // 6. Home to the dock, and Pell is there now.
  r = await ev(() => window.bot.board());
  check(r.ok, `back aboard from the beach (${JSON.stringify(r)})`);
  const home = await ev(() => window.bot.mooring('hearthbay-dock'));
  r = await ev((m) => window.bot.sailTo(m.x, m.z, { stopR: 3 }), home);
  check(r.ok, `sailed home: ${r.metres} m in ${r.seconds} s`);
  await shot('06-home-dock');
  r = await ev(() => window.bot.land());
  check(r.ok && r.island === 'hearthbay' && r.boardable, `stepped off at the Hearthbay dock, in reach of her (${JSON.stringify(r)})`);
  pell = await ev(() => window.bot.npc('pell'));
  check(pell.visible && Math.hypot(pell.x - home.x, pell.z - home.z) < 12, 'Pell has gone home to the dock');
  r = await ev((p) => window.bot.walk(p.x, p.z, 10, () => window.__MW__.game.town.focusPrompt === 'Talk to Pell'), pell);
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  check((await status('hb-07-kettle')) === 'done' && (await ev(() => window.__MW__.state.relics.includes('keepers-kettle'))), 'Pell takes the news and the kettle stays with the keeper');
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 7. Mara wants a flounder from the Teeth.
  const mara = await ev(() => window.bot.npc('mara'));
  r = await ev((p) => window.bot.walk(p.x, p.z, 40, () => window.__MW__.game.town.focusPrompt === 'Talk to Mara'), mara);
  check(r === 'Talk to Mara', `walked up the dock to Mara (prompt: ${r})`);
  await ev(() => { window.bot.interact(); });
  choices = await ev(() => window.bot.readAll());
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-08-teeth')) === 'active', `What Bites at the Teeth is under way (${choices.join(' | ')})`);
  r = await ev(() => window.bot.board());
  check(r.ok, `boarded at the dock (${JSON.stringify(r)})`);
  r = await ev(() => { const at = window.__MW__.quests.QUESTS_BY_ID.get('hb-08-teeth').objectives[0].at; return window.bot.sailTo(at[0], at[1], { stopR: 10 }); });
  check(r.ok, `sailed to the Teeth: ${r.metres} m in ${r.seconds} s`);
  st = await ev(() => window.bot.state());
  check(st.charted.includes('the-teeth'), `the Teeth are on the chart (${st.charted.join(', ')})`);
  await shot('07-the-teeth');

  // 8. Fish from the boat: she stays put, and the flounder is there.
  r = await ev(() => {
    const g = window.__MW__.game, b = g.sailing.boat, x0 = b.x, z0 = b.z;
    // Aim at the deepest water nearby.
    let best = 0, bd = -1;
    for (let a = 0; a < 16; a++) { const yaw = (a / 16) * Math.PI * 2; const d = g.world.hf.depth(b.x + Math.sin(yaw) * 14, b.z + Math.cos(yaw) * 14); if (d > bd) { bd = d; best = yaw; } }
    g.camYaw = best; g.simulate(0.6);
    const casts = window.bot.fishFor('twofold-flounder', 60, 12);
    return { casts, drift: Math.hypot(b.x - x0, b.z - z0), depth: bd };
  });
  check(r.casts > 0, `a Twofold Flounder came up at the Teeth after ${r.casts} catches (water ${r.depth.toFixed(0)} m deep)`);
  check(r.drift < 6, `the skiff held still while fishing (drifted ${r.drift.toFixed(1)} m)`);
  check((await status('hb-08-teeth')) === 'ready', 'the flounder finishes the errand');
  await shot('08-fishing-from-the-boat');

  // 8b. Pip's Bar on the way back: found, landed on, and the chest in its sand opened once.
  const chest = await ev(() => window.__MW__.game.world.region.chests[0]);
  r = await ev((c) => window.bot.sailTo(c.x, c.z, { stopR: 5 }), chest);
  check(r.ok, `sailed to Pip's Bar: ${r.metres} m in ${r.seconds} s`);
  st = await ev(() => window.bot.state());
  check(st.charted.includes('pips-bar'), `Pip's Bar is on the chart (${st.charted.length} places)`);
  r = await ev(() => window.bot.land());
  check(r.ok && r.boardable, `stepped ashore on the bar, in reach of her (${JSON.stringify(r)})`);
  r = await ev((c) => window.bot.walk(c.x, c.z, 30, () => window.__MW__.game.town.focusPrompt === 'Open the chest'), chest);
  check(r === 'Open the chest', `walked along the bar to the chest (prompt: ${r})`);
  await shot('08b-chest-on-the-bar');
  const purse = (await ev(() => window.bot.state())).coins;
  await ev(() => window.bot.tap('KeyE'));
  r = await ev((id) => { const g = window.__MW__.game, c = g.world.chests.get(id); g.simulate(0.3); return { coins: g.state.coins, grubs: g.state.gear.baits.glowgrub ?? 0, open: c.open.visible && !c.shut.visible, prompt: g.town.focusPrompt }; }, chest.id);
  check(r.coins === purse + chest.coins && r.open && r.prompt !== 'Open the chest', `the chest opens once and pays (${r.coins - purse} coins, ${r.grubs} glowgrubs, prompt now: ${r.prompt})`);
  await shot('08c-chest-open');
  r = await ev(() => window.bot.board());
  check(r.ok, `back aboard from the bar (${JSON.stringify(r)})`);

  // 9. The chart: no course can be set from open water; from a mooring it can.
  await ev(() => window.__MW__.game.town.openScreen('chart'));
  await shot('09-chart-at-sea', 2);
  r = await ev(() => ({ open: window.__MW__.game.town.screens.current, buttons: [...document.querySelectorAll('.chart-place .btn')].map((b) => b.disabled) }));
  check(r.open === 'chart' && r.buttons.length >= 2 && r.buttons.every((d) => d), `at sea the chart shows places but sets no course (${JSON.stringify(r)})`);
  await ev(() => window.__MW__.game.town.closeScreens());
  const gull = await ev(() => window.bot.mooring('gull-landing'));
  r = await ev((m) => window.bot.sailTo(m.x, m.z, { stopR: 6 }), gull);
  check(r.ok, `sailed to the Gull Point mooring: ${r.metres} m in ${r.seconds} s`);
  await shot('10-gull-mooring');
  await ev(() => window.__MW__.game.town.openScreen('chart'));
  await shot('11-chart-moored', 2);
  const hourBefore = (await ev(() => window.bot.state())).hour;
  const clicked = await ev(() => { const row = [...document.querySelectorAll('.chart-place')].find((e) => e.textContent.includes('Hearthbay')); const b = row?.querySelector('.btn'); if (!b || b.disabled) return false; b.click(); return true; });
  check(clicked, 'at a mooring the chart offers "Sail here" for Hearthbay');
  await ev(() => { const g = window.__MW__.game; g.skipRender = true; for (let i = 0; i < 150; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); } g.skipRender = false; });
  st = await ev(() => window.bot.state());
  check(st.aboard && Math.hypot(st.x - home.x, st.z - home.z) < 8, `the chart carried her home (${st.x.toFixed(0)}, ${st.z.toFixed(0)})`);
  // The five seconds the bot waits move the clock 0.08 h by themselves; the passage is charged on top.
  const passed = (st.hour - hourBefore + 24) % 24;
  check(passed > 0.3 && passed < 4, `the passage took some of the day (${passed.toFixed(2)} h)`);
  await shot('12-after-fast-travel');
  r = await ev(() => window.bot.land());
  check(r.ok, 'ashore at home');
  r = await ev((p) => window.bot.walk(p.x, p.z, 40, () => window.__MW__.game.town.focusPrompt === 'Talk to Mara'), mara);
  await ev(() => { window.bot.interact(); window.bot.readAll(); });
  check((await status('hb-08-teeth')) === 'done', 'Mara takes the flounder');
  await shot('13-mara-flounder');
  await ev(() => { const d = window.__MW__.game.town.dialogue; if (d.isOpen) window.bot.choose('Bye'); });

  // 10. Shore: full speed at the beach stops her without putting her on the sand.
  r = await ev(() => {
    const g = window.__MW__.game, sail = g.sailing;
    window.bot.board();
    const m = window.bot.mooring('kettle-beach');
    sail.moorAt({ ...m, x: m.x + 60, z: m.z }); sail.boat.heading = -Math.PI / 2; // 60 m off the beach, bow on
    let min = Infinity, hit = 0;
    g.input.simulate('KeyW', true);
    for (let i = 0; i < 30 * 20; i++) { g.simulate(1 / 30); min = Math.min(min, window.__MW__.clearance(sail.env, sail.def, sail.boat.x, sail.boat.z, sail.boat.heading)); hit = Math.max(hit, Math.abs(sail.boat.speed)); }
    g.input.simulate('KeyW', false); g.simulate(0.5);
    return { min, hit, depth: g.world.hf.depth(sail.boat.x, sail.boat.z), x: sail.boat.x };
  });
  check(r.min >= -1e-6 && r.depth > 0.3 && r.hit > 5, `ran at the beach at ${r.hit.toFixed(1)} m/s and stopped afloat (least clearance ${r.min.toFixed(2)} m, ${r.depth.toFixed(2)} m of water under her)`);
  await shot('14-run-aground');

  // 11. The edge of the map: the murmur turns her back, with a word of why.
  r = await ev(() => {
    const g = window.__MW__.game, sail = g.sailing, R = g.world.region.radius;
    sail.moorAt({ x: -(R - 150), z: 40, heading: -Math.PI / 2 });
    let far = 0, murmur = 0;
    g.skipRender = true;
    g.input.simulate('KeyW', true);
    for (let i = 0; i < 30 * 40; i++) { g.simulate(1 / 30); if (i % 3 === 0) g.presentOnce(0.1); far = Math.max(far, Math.hypot(sail.boat.x, sail.boat.z)); murmur = Math.max(murmur, sail.murmur); }
    g.input.simulate('KeyW', false); g.skipRender = false;
    return { far, murmur, R, toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ') };
  });
  check(r.far < r.R - 5 && r.murmur > 0.5, `forty seconds at full sail toward the edge got to ${r.far.toFixed(0)} m of ${r.R} (murmur ${r.murmur.toFixed(2)})`);
  await shot('15-murmur-edge');

  // 11b. The real water, boulders and all: she floats at every mooring with somewhere to step off that is
  // within boarding reach, and every mooring can be sailed to from home. (The unit tests have no boulders.)
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, sail = g.sailing, reg = g.world.region, home = reg.moorings[0], bad = [];
    for (const m of reg.moorings) {
      const c = MW.clearance(sail.env, sail.def, m.x, m.z, m.heading);
      const l = MW.landingSpot((x, z) => g.groundAt(x, z), m, (x, z) => g.clearOfBodies(x, z, 0.5));
      if (c < 0) bad.push(`${m.id}: aground (${c.toFixed(2)})`);
      if (!l) bad.push(`${m.id}: nowhere to step off`);
      else if (MW.hullDistance(m, l.x, l.z) > MW.LANDING.reach || !g.clearOfBodies(l.x, l.z, 0.5)) bad.push(`${m.id}: landing out of reach or in a crowd`);
      if (m !== home && !MW.findRoute(sail.env, sail.def, [home.x, home.z], [m.x, m.z])) bad.push(`${m.id}: no way there from home`);
    }
    return { bad, n: reg.moorings.length, rocks: g.world.rocks.length };
  });
  check(r.bad.length === 0, `all ${r.n} moorings float, land and connect in the real water with its ${r.rocks} boulders (${r.bad.join('; ') || 'no faults'})`);

  // 11c. A save made in the middle of the step between boat and shore counts as arrived.
  r = await ev(async () => {
    const g = window.__MW__.game, sail = g.sailing, s = g.state;
    // On the empty beach of Kettle Isle: at the home dock Pell stands nearer than the hull, and E talks to him.
    sail.moorAt(g.world.region.moorings.find((m) => m.id === 'kettle-beach'));
    for (let i = 0; i < 45; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); }
    const out = { canLand: sail.canLand };
    window.bot.tap('KeyE'); g.simulate(0.1);
    out.midAshore = sail.busy; await g.save();
    out.ashore = { onBoat: s.world.onBoat, ground: g.groundAt(s.world.pos[0], s.world.pos[2]) !== null };
    for (let i = 0; i < 90 && sail.riding; i++) g.simulate(1 / 30);
    g.simulate(0.3); g.presentOnce(1 / 30);
    out.boardable = sail.boardable; out.prompt = g.town.focusPrompt;
    window.bot.tap('KeyE'); g.simulate(0.1);
    out.midAboard = sail.busy; await g.save();
    out.aboard = { onBoat: s.world.onBoat };
    for (let i = 0; i < 90 && !sail.aboard; i++) g.simulate(1 / 30);
    out.end = sail.aboard;
    return out;
  });
  check(r.canLand && r.midAshore && !r.ashore.onBoat && r.ashore.ground, `saved mid-step ashore: the save has the player on the shore (${JSON.stringify(r.ashore)})`);
  check(r.boardable && r.midAboard && r.aboard.onBoat && r.end, `saved mid-step aboard: the save has the player in the boat (${JSON.stringify(r.aboard)}, prompt was: ${r.prompt})`);

  // 12. A save made at sea comes back at sea.
  const log = await ev(() => window.bot.log);
  check(log.minClear >= -1e-6, `the hull never left the water on any passage (least clearance ${log.minClear.toFixed(2)} m, top speed ${log.top.toFixed(1)} m/s)`);
  const saved = await ev(async () => { const g = window.__MW__.game; g.sailing.moorAt({ x: -220, z: 120, heading: 1 }); await g.save(); return window.bot.state(); });
  await page.goto(`http://localhost:${port}/?keepfresh&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  r = await ev(() => { const g = window.__MW__.game; g.paused = true; g.halted = true; const b = g.sailing.boat, c = g.world.region.chests[0], cm = g.world.chests.get(c.id); return { aboard: g.sailing.aboard, x: b.x, z: b.z, px: g.pos.x, pz: g.pos.z, done: g.state.quests.done.length, version: g.state.version, pell: g.town.npcs.get('pell').fig.root.position.x, chestFlag: g.state.flags.includes(`chest:${c.id}`), chestOpen: cm.open.visible && !cm.shut.visible }; });
  check(r.aboard && Math.hypot(r.x - saved.x, r.z - saved.z) < 1 && Math.hypot(r.px - r.x, r.pz - r.z) < 2, `reloaded aboard where she was left (${r.x.toFixed(0)}, ${r.z.toFixed(0)})`);
  check(r.done === 8, `the story is still told after a reload (${r.done} quests done)`);
  check(r.chestFlag && r.chestOpen, 'the chest on the bar is still open and empty after a reload');
  await shot('16-reloaded-at-sea');

  if (errors.length) problems.push('page errors: ' + errors.join(' | '));
  if (problems.length) { console.error('SAIL FAILED:\n - ' + problems.join('\n - ')); await browser.close(); process.exit(1); }
  console.log('SAIL OK');
  await browser.close();
})();
