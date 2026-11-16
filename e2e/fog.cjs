// Fog bot: the way to Mossglass Fen, through the real game. Pell asks for a lamp; without one the Murmur Fog
// turns the skiff back; eight Echoes buy the Fog Lamp from the satchel; the skiff sails the old sea-road with
// the real helm, the waters change in the thick of the fog, and she comes out in the Fen. There: the landing
// goes on the chart, Calloway takes Pell's errand and has work of her own, a fish off the jetty counts for
// it, Mara's packet box buys the catch and has its own shelf, the notice board has Fen jobs, the stake and
// the ear trumpet can be read, a save made in the Fen loads in the Fen, and the chart carries her home
// across the fog and back. Last, a save from before the Fen loads with nothing of the Fen on its shelf.
// Exits 1 on any failure.
// Shortcuts: it starts from a granted state (the first Turning done, Echoes in hand), and is set down beside
// the stake and the ear trumpet instead of sailing to them.
// Usage: node e2e/fog.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/fog';
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
  const q = `notitle&hour=9&quality=${process.env.MW_QUALITY || 'medium'}`;
  await page.goto(`http://localhost:${port}/?fresh&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  await require('./sail-helpers.cjs').install(page);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const status = (id) => ev((id) => window.bot.status(id), id);
  const helpers = () => require('./fog-helpers.cjs').install(page);

  // The story so far, granted: the Bell has been rung once, and there are Echoes to spend.
  await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    delete s.quests.active['hb-06-relight'];
    s.quests.done.push('hb-06-relight', 'hb-07-kettle', 'hb-08-teeth', 'hb-08b-stall', 'hb-p1-pots', 'hb-09-bell', 'hb-10-turning');
    s.flags.push('hb-lighthouse-lit', 'pell-home', 'kettle-taken', 'met-wick', 'pots-open', 'bell-found', 'tide-turned');
    s.boats.owned = ['skiff']; s.boats.current = 'skiff'; s.relics.push('keepers-kettle');
    s.world.charted.push('gull-point', 'kettle-isle', 'the-teeth', 'drowned-belfry');
    s.run.number = 2; s.echoes = 9; s.lifetime.echoes = 9; s.lifetime.coins = 3600; s.coins = 400;
    const end = g.world.dockEnd;
    g.pos.set(end.x + 1.5, g.groundAt(end.x + 1.5, end.z) ?? 1.4, end.z); g.yaw = -Math.PI / 2;
    g.sailing.launch(); g.town.arrive(); g.refreshSession(); g.snapCamera(); g.simulate(0.3);
  });
  await helpers();
  const A = [-404.5, -293.9], B = [-736.5, -535.1];
  const at = (k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];

  // 1. Pell has a job that only Echoes can do. The far shelf is not Mara's to sell yet.
  let r = await ev(() => window.fog.talk('pell', 'Talk to Pell'));
  let choices = await ev(() => window.bot.readAll());
  check(r && choices.some((c) => c.includes('do it')), `Pell has work after the first Turning (${choices.join(' | ')})`);
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-11-lamp')) === 'active', 'A Lamp for the Fog is under way');
  r = await ev(() => { const g = window.__MW__.game; g.town.openScreen('shop'); const names = [...document.querySelectorAll('.item b')].map((e) => e.textContent); g.town.closeScreens(); return names; });
  check(r.length > 3 && !r.some((n) => /Marsh Worm|Fenwood|Glass Mayfly/i.test(n)), `nothing from the Fen is on Mara's shelf yet (${r.length} things)`);

  // 2. Without the lamp: out to the old sea-road by the belfry, and the fog turns her back.
  r = await ev(() => { const b = window.bot.board(); return { b, went: window.fog.chartTo('The Drowned Belfry'), st: window.bot.state() }; });
  check(r.b.ok && r.went && r.st.aboard, `aboard, and the chart carries her to the belfry (${JSON.stringify(r.b)})`);
  r = await ev(() => window.bot.sailTo(-404.5, -293.9, { stopR: 8 }));
  check(r.ok, `she sails to the near end of the sea-road (${JSON.stringify(r)})`);
  r = await ev(([x, z]) => ({ p: window.fog.pilot(x, z, 45, 6), toasts: window.fog.toasts(), road: window.__MW__.game.world.seaRoad?.alight ?? 0 }), at(0.6));
  check(r.p.region === 'hearthbay' && !r.p.swapped && r.p.maxMur > 0.3, `with no lamp the Murmur Fog turns her back (murmur ${r.p.maxMur.toFixed(2)}, still in ${r.p.region})`);
  check(r.toasts.some((t) => /murmur|fog|lamp/i.test(t)), `and the game says why (${r.toasts.join(' | ')})`);
  check(r.road === 0, `the road's lights stay dark for her (${r.road} alight)`);
  await shot('01-turned-back');

  // 3. Eight Echoes for the Fog Lamp, from the satchel; it goes on the bow.
  await ev(() => window.__MW__.game.town.openScreen('echoes'));
  await shot('02-echoes-page', 2);
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, e0 = s.echoes;
    const row = [...document.querySelectorAll('.item.echo')].find((e) => e.textContent.includes('Fog Lamp'));
    const text = row?.textContent ?? ''; row?.querySelector('.btn')?.click();
    const again = [...document.querySelectorAll('.item.echo')].find((e) => e.textContent.includes('Fog Lamp'));
    const out = { text, e0, e1: s.echoes, has: s.echoUpgrades['fog-lamp'], againDisabled: again?.querySelector('.btn')?.disabled ?? true };
    g.town.closeScreens(); window.fog.wait(1);
    return { ...out, shipped: g.sailing.rig.hasFogLamp };
  });
  check(r.has === 1 && r.e0 - r.e1 === 8, `the Fog Lamp costs 8 Echoes (${r.e0} to ${r.e1}; "${r.text.slice(0, 60)}…")`);
  check(r.againDisabled, 'and can be had only once');
  check(r.shipped, 'it is shipped on the bow of the skiff');
  check((await status('hb-11-lamp')) === 'ready', 'Pell\'s job is ready to hand in');

  // 4. Home, the lamp shown to Pell, and the road job taken.
  // (Out of the fog by the road first: the route finder does not plan from inside it.)
  r = await ev(([x, z]) => { window.fog.pilot(x, z, 60, 8); const back = window.bot.sailTo(-295, -206.5, { stopR: 10 }); return { back, went: window.fog.chartTo('Hearthbay') }; }, A);
  check(r.back.ok && r.went, `back to the belfry mooring and home by the chart (${JSON.stringify(r.back)})`);
  r = await ev(() => { const l = window.bot.land(); const g = window.__MW__.game; const grubs0 = g.state.gear.baits.glowgrub ?? 0; const t = window.fog.talk('pell', 'Talk to Pell'); window.bot.readAll(); return { l, t, grubs: (g.state.gear.baits.glowgrub ?? 0) - grubs0 }; });
  check((await status('hb-11-lamp')) === 'done' && r.grubs === 6, `Pell sees the lamp and gives 6 glowgrubs (${JSON.stringify(r.l)})`);
  choices = await ev(() => { const g = window.__MW__.game; if (!g.town.dialogue.isOpen) window.bot.interact(); return window.bot.readAll(); });
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-12-road')) === 'active', `The Old Sea-Road is under way (${choices.join(' | ')})`);
  r = await ev(() => { window.__MW__.game.presentOnce(1 / 30); return document.querySelector('.goal-t')?.textContent ?? ''; });
  check(/Mossglass Fen|sea-road/i.test(r), `the goal points at the sea-road ("${r}")`);

  // 5. The crossing, by the helm: the road lights come up, the lamp lights itself, and the waters change
  // in the thick of the fog.
  r = await ev(() => { const b = window.bot.board(); return { b, went: window.fog.chartTo('The Drowned Belfry') }; });
  check(r.b.ok && r.went, 'back out to the belfry');
  r = await ev(() => window.bot.sailTo(-404.5, -293.9, { stopR: 8 }));
  check(r.ok, 'to the near end of the sea-road again');
  const t0 = Date.now();
  r = await ev(([x, z]) => ({ p: window.fog.pilot(x, z, 60, 6), road: window.__MW__.game.world.seaRoad?.alight ?? 0 }), at(0.4));
  check(r.p.region === 'hearthbay' && r.p.maxFog > 0.4 && r.p.maxMur < 0.3 && r.road > 0, `with the lamp the road opens: fog ${r.p.maxFog.toFixed(2)}, murmur ${r.p.maxMur.toFixed(2)}, ${r.road} road lights alight`);
  check(r.p.lamp > 0.5, `the Fog Lamp has lit itself (${r.p.lamp.toFixed(2)})`);
  await shot('03-on-the-sea-road');
  r = await ev(([x, z]) => { const g = window.__MW__.game, before = { ready: g.prep.readyFor, spent: Math.round(g.prep.spent), longest: +g.prep.longest.toFixed(1) }; const p = window.fog.pilot(x, z, 60, 6); const s = window.__MW__.state; return { p, before, swap: g.lastSwap, flags: s.flags.includes('reached:mossglass-fen'), discovered: s.world.discovered, coins: s.coins }; }, at(0.66));
  const coinsInTheFog = r.coins;
  check(r.p.region === 'mossglass-fen' && r.p.swapped, `half way along, the waters are Mossglass Fen (${JSON.stringify(r.p.swapped)})`);
  check(r.p.swapped && r.p.swapped.fog >= 0.95, `the change happens in the thick of the fog (fog ${r.p.swapped?.fog.toFixed(2)})`);
  check(r.before.ready === 'mossglass-fen' && r.swap.readyBefore === 1 && r.swap.finishing < 30, `the Fen's ground was made ready on the way, a little at a time (${JSON.stringify(r.before)})`);
  // (Made at the crossing the ground alone took a second here; the limit leaves room for a slower machine.)
  check(r.swap.terrain < 30 && r.swap.scene < 500, `so the change itself is short: ${r.swap.scene} ms (${JSON.stringify(r.swap)})`);
  check(r.flags && r.discovered.includes('mossglass-fen'), 'the Fen is a place the keeper has been');
  r = await ev(([x, z]) => ({ ...window.fog.pilot(x, z, 60, 6), banner: document.querySelector('.banner')?.textContent ?? '' }), at(1.0));
  check(r.region === 'mossglass-fen' && r.maxMur < 0.3, `she comes out of the fog on the Fen side (${Math.round(r.x)}, ${Math.round(r.z)})`);
  check(/Mossglass Fen/.test(r.banner), `the Fen is named as she comes out ("${r.banner}")`);
  console.log(`     crossing: ${((Date.now() - t0) / 1000).toFixed(0)} s of bot time`);
  await shot('04-out-of-the-fog');

  // 6. Sedge Landing: on the chart, and Pell's errand is ready for Calloway.
  r = await ev((c0) => { const s = window.__MW__.state; const m = window.bot.mooring('sedge-jetty'); const go = window.bot.sailTo(m.x, m.z, { stopR: 7 }); return { go, charted: s.world.charted.includes('sedge-landing'), paid: s.coins - c0, goal: document.querySelector('.goal-t')?.textContent ?? '' }; }, coinsInTheFog);
  check(r.go.ok, `the route finder knows the Fen's water: to the jetty in ${r.go.seconds} s (${JSON.stringify(r.go)})`);
  check(r.charted && r.paid === 200, `Sedge Landing goes on the chart and pays ${r.paid} coins`);
  check((await status('hb-12-road')) === 'ready' && /Calloway/.test(r.goal), `the road job is to be handed to Calloway ("${r.goal}")`);
  await shot('05-sedge-jetty');
  r = await ev(() => window.bot.land());
  check(r.ok, `she can be landed at the jetty (${JSON.stringify(r)})`);

  // 7. Calloway takes the errand, pays for Pell, and has work of her own.
  r = await ev(() => { const s = window.__MW__.state, c0 = s.coins, w0 = s.gear.baits['marsh-worm'] ?? 0; const t = window.fog.talk('calloway', 'Talk to Dr. Ines Calloway'); const who = document.querySelector('.dlg-name')?.textContent ?? ''; window.bot.readAll(); return { t, who, paid: s.coins - c0, worms: (s.gear.baits['marsh-worm'] ?? 0) - w0, prompt: window.__MW__.game.town.focusPrompt }; });
  check(r.t && /Calloway/.test(r.who), `Calloway can be walked up to and spoken with (${r.who}; ${r.prompt})`);
  check((await status('hb-12-road')) === 'done' && r.paid === 300 && r.worms === 10, `she takes the errand: ${r.paid} coins and ${r.worms} marsh worms`);
  await shot('06-calloway');
  choices = await ev(() => { const g = window.__MW__.game; if (!g.town.dialogue.isOpen) window.bot.interact(); return window.bot.readAll(); });
  await ev(() => window.bot.choose('do it'));
  check((await status('fen-01-scale')) === 'active', `A Sense of Scale is under way (${choices.join(' | ')})`);
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 8. A fish off the jetty is a Fen fish, and counts for her.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, end = g.world.dockEnd;
    window.bot.walk(end.x, end.z, 30, () => Math.hypot(g.pos.x - end.x, g.pos.z - end.z) < 1.2);
    const L = g.world.region.landmarks.dock; g.camYaw = L.rot ?? 0; window.fog.wait(0.6);
    const before = Object.keys(s.journal);
    let casts = 0; for (let i = 0; i < 6 && s.hold.length < 2; i++) { window.bot.fishFor('nothing', 1, 10); casts++; }
    return { casts, hold: s.hold.map((c) => c.fishId), fresh: Object.keys(s.journal).filter((k) => !before.includes(k)), progress: s.quests.active['fen-01-scale'], zone: g.session.zone ?? null, at: [g.pos.x, g.pos.z] };
  });
  check(r.hold.length >= 2, `two fish off the end of the jetty in ${r.casts} casts (${r.hold.join(', ')})`);
  check(r.hold.every((id) => /reedling|mudlark|glassfin|sedge-pike|mossback-tench|glowbelly|stilt-gar|bottomless-eel|old-mossglass|the-listener/.test(id)), 'and they are fish of the Fen');
  check(Object.values(r.progress ?? {})[0] >= 2, `they count for Calloway (${JSON.stringify(r.progress)})`);
  await shot('07-fen-fish');

  // 9. Mara's packet box: its card is read once, it buys the catch, and it has a shelf in the lid.
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, p = g.world.region.places.find((x) => x.id === 'packet-box');
    const prompt = window.bot.walk(p.x, p.z, 40, () => (g.town.focusPrompt ?? '').includes('packet box'));
    const open = window.bot.interact(); g.town.dialogue.advance(); const first = document.querySelector('.dlg-text')?.textContent ?? '';
    const c0 = s.coins, n0 = s.hold.length; const ch = window.bot.readAll();
    const sold = window.bot.choose('Sell'); const after = window.bot.readAll();
    return { prompt, open, first, ch, sold, coins: s.coins - c0, n0, left: s.hold.length, after };
  });
  check(/packet box/.test(r.prompt ?? '') && r.open, `the box on the landing can be opened (${r.prompt})`);
  check(r.first.length > 10, `Mara's card is in the lid ("${r.first.slice(0, 60)}…")`);
  check(r.sold && r.coins > 0 && r.left === 0, `it buys the catch: ${r.n0} fish for ${r.coins} coins (${r.ch.join(' | ')})`);
  check(r.after.some((c) => /shelf/i.test(c)), `and there is a shelf in the lid (${r.after.join(' | ')})`);
  r = await ev(() => { const ok = window.bot.choose('shelf'); const g = window.__MW__.game; const names = [...document.querySelectorAll('.item b')].map((e) => e.textContent); const open = g.town.screens.isOpen; return { ok, open, names }; });
  check(r.ok && r.open && r.names.some((n) => /Marsh Worm/i.test(n)), `the shelf has the Fen's own goods (${r.names.filter((n) => /Marsh|Fenwood|Mayfly|Bead/i.test(n)).join(', ')})`);
  await shot('08-packet-box-shelf', 2);
  r = await ev(() => { const g = window.__MW__.game; g.town.closeScreens(); if (g.town.dialogue.isOpen) window.bot.choose('Shut'); window.fog.wait(0.4); window.bot.interact(); const again = document.querySelector('.dlg-text')?.textContent ?? ''; const ch = window.bot.readAll(); window.bot.choose('Shut'); return { again, ch, open: g.town.dialogue.isOpen }; });
  check(!r.open && r.ch.some((c) => /Sell|shelf/i.test(c)), `opened again it goes straight to business (${r.ch.join(' | ')})`);

  // 10. The notice board has work for these waters.
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, p = g.world.region.places.find((x) => x.id === 'notice-board');
    const prompt = window.bot.walk(p.x, p.z, 40, () => /board/i.test(g.town.focusPrompt ?? ''));
    window.bot.interact(); const open = g.town.screens.isOpen;
    const jobs = s.quests.board.quests.map((q) => q.title ?? q.kind ?? q.id); const text = document.querySelector('.screen-card')?.textContent ?? '';
    g.town.closeScreens();
    return { prompt, open, jobs, text: text.slice(0, 300), fen: s.quests.board.quests.every((q) => !q.objective.fish || /reedling|mudlark|glassfin|sedge-pike|mossback-tench|glowbelly|stilt-gar/.test(q.objective.fish)) };
  });
  check(r.open && r.jobs.length > 0, `the notice board opens with ${r.jobs.length} jobs (${r.prompt})`);
  check(r.fen, `and any fish they ask for are fish of the Fen (${r.text.replace(/\s+/g, ' ').slice(0, 200)})`);
  await shot('09-landing', 4);

  // 11. Calloway's stake (set down beside it): a place to read, which counts for the job that asks for it.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, p = g.world.region.places.find((x) => x.id === 'survey-stake');
    s.quests.done.push('fen-01-scale', 'fen-02-glass'); delete s.quests.active['fen-01-scale']; s.quests.active['fen-03-tape'] = {};
    const sx = p.x + 1.6, sz = p.z + 1.2;
    g.pos.set(sx, g.groundAt(sx, sz) ?? 1, sz); g.town.arrive(); g.snapCamera(); g.camYaw = Math.atan2(p.x - sx, p.z - sz); window.fog.wait(0.6);
    const prompt = g.town.focusPrompt; window.bot.tap('KeyE'); window.fog.wait(0.5);
    return { prompt, ground: g.groundAt(sx, sz), seen: s.flags.includes('seen:survey-stake') };
  });
  // Its lines come by the clock on the wall, one after the other.
  await page.waitForTimeout(400);
  r.first = await ev(() => window.fog.toasts());
  await page.waitForTimeout(3000);
  r.then = await ev(() => window.fog.toasts());
  check(r.prompt === 'Read the tape on the stake', `the stake offers to be read (${r.prompt}; ground ${r.ground})`);
  check([...r.first, ...r.then].some((t) => /I\.C\. 7/.test(t)) && r.then.some((t) => /humming/.test(t)), `and reads out line by line (${[...new Set([...r.first, ...r.then])].join(' | ').slice(0, 160)})`);
  check(r.seen && (await status('fen-03-tape')) === 'ready', 'reading it finishes The Tape Runs Out');
  await shot('10-the-stake');

  // 12. The ear trumpet at the Listening Post (set down beside it): heard in the dark, and it leaves a mark.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, p = g.world.region.places.find((x) => x.id === 'ear-trumpet');
    g.pos.set(p.x, g.groundAt(p.x, p.z) ?? 0.4, p.z); g.town.arrive(); g.snapCamera(); window.fog.wait(0.6);
    const prompt = g.town.focusPrompt; window.bot.tap('KeyE'); window.fog.wait(1.2);
    const fade = document.querySelector('.fade'); const dark = !!fade && fade.classList.contains('on'); const line1 = fade?.textContent ?? '';
    window.fog.wait(5); const line2 = document.querySelector('.fade')?.textContent ?? '';
    return { prompt, dark, line1, line2, ground: g.groundAt(p.x, p.z) };
  });
  check(r.prompt === 'Put your ear to the trumpet', `the trumpet offers to be listened at (${r.prompt}; ground ${r.ground})`);
  check(r.dark && /cold brass/.test(r.line1) && /breathing in/.test(r.line2), `the screen goes dark and the lines come one at a time ("${r.line1}" then "${r.line2.slice(0, 50)}…")`);
  await shot('11-listening', 2);
  r = await ev(() => { window.fog.wait(14); const s = window.__MW__.state; const fade = document.querySelector('.fade'); return { heard: s.flags.includes('fen-heard'), seen: s.flags.includes('seen:ear-trumpet'), light: !!fade && !fade.classList.contains('on') }; });
  check(r.heard && r.seen, 'having listened is remembered (the Listener can hear the keeper now)');
  check(r.light, 'and the light comes back');
  await shot('12-listening-post');

  // 13. Home across the fog by the chart, and back again: no helm needed once the road is known.
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, end = g.world.dockEnd;
    g.pos.set(end.x, g.groundAt(end.x, end.z) ?? 1.4, end.z); g.town.arrive(); g.snapCamera(); window.fog.wait(0.4);
    const b = window.bot.board();
    g.town.openScreen('chart');
    const far = [...document.querySelectorAll('.chart-far-row')].map((e) => e.querySelector('span')?.textContent);
    const roads = document.querySelector('.chart-edge')?.textContent ?? '';
    g.town.closeScreens();
    return { b, far, roads, moored: g.sailing.mooredAt()?.id ?? null };
  });
  check(r.b.ok && r.moored === 'sedge-jetty', `aboard at the jetty (${JSON.stringify(r.b)}; moored at ${r.moored})`);
  check(r.far.includes('Hearthbay dock') && r.far.includes('The Drowned Belfry'), `the Fen's chart lists the moorings across the fog (${r.far.join(', ')})`);
  await ev(() => window.__MW__.game.town.openScreen('chart'));
  await shot('13-chart-of-the-fen', 2);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; g.town.closeScreens(); const went = window.fog.chartTo('Hearthbay dock'); const m = window.bot.mooring('hearthbay-dock'); return { went, region: s.world.region, built: g.world.region.id, d: Math.hypot(g.sailing.boat.x - m.x, g.sailing.boat.z - m.z), aboard: g.sailing.aboard, mara: !!g.town.npcs.get('mara'), dark: document.querySelector('.fade')?.classList.contains('on') }; });
  check(r.went && r.region === 'hearthbay' && r.built === 'hearthbay' && r.d < 12 && r.aboard, `the chart carries her home across the fog (${JSON.stringify(r)})`);
  check(r.mara && !r.dark, 'Hearthbay is itself again, Mara and all');
  await shot('14-home-again');
  r = await ev(() => { const g = window.__MW__.game; g.town.openScreen('shop'); const names = [...document.querySelectorAll('.item b')].map((e) => e.textContent); g.town.closeScreens(); return names; });
  check(r.some((n) => /Marsh Worm/i.test(n)) && r.some((n) => /Fenwood/i.test(n)), 'now that the Fen is known, Mara\'s stall at home stocks its goods too');
  r = await ev(() => { const g = window.__MW__.game, s = g.state; const went = window.fog.chartTo('Sedge Landing jetty'); const m = window.bot.mooring('sedge-jetty'); return { went, region: s.world.region, built: g.world.region.id, d: m ? Math.hypot(g.sailing.boat.x - m.x, g.sailing.boat.z - m.z) : -1 }; });
  check(r.went && r.region === 'mossglass-fen' && r.built === 'mossglass-fen' && r.d >= 0 && r.d < 12, `and back to the Fen (${JSON.stringify(r)})`);

  // 14. A save made in the Fen loads in the Fen.
  r = await ev(() => window.bot.land());
  check(r.ok, `ashore at Sedge Landing again (${JSON.stringify(r)})`);
  const saved = await ev(() => { const g = window.__MW__.game, s = g.state; return g.save().then(() => ({ coins: s.coins, done: s.quests.done.length, at: [g.pos.x, g.pos.z] })); });
  await page.goto(`http://localhost:${port}/?notitle&quality=low&keepfresh`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 1, null, { timeout: 180000 });
  r = await ev(() => { const g = window.__MW__.game, s = g.state; return { region: s.world.region, built: g.world.region.id, coins: s.coins, done: s.quests.done.length, lamp: s.echoUpgrades['fog-lamp'], props: g.world.region.props?.length ?? 0, ground: g.groundAt(g.pos.x, g.pos.z), at: [g.pos.x, g.pos.z], boat: [g.sailing.boat.x, g.sailing.boat.z], calloway: !!g.town.npcs.get('calloway')?.fig.root.visible, shipped: g.sailing.rig?.hasFogLamp }; });
  check(r.region === 'mossglass-fen' && r.built === 'mossglass-fen' && r.ground !== null && Math.hypot(r.at[0] - saved.at[0], r.at[1] - saved.at[1]) < 2, `the reload wakes in the Fen where the keeper stood (${JSON.stringify(r)})`);
  check(r.coins === saved.coins && r.done === saved.done && r.lamp === 1 && r.calloway, 'with its coins, its story, the lamp and Calloway at her table');
  check(Math.hypot(r.boat[0] + 820.9, r.boat[1] + 604.1) < 40, `and the skiff still at the jetty (${r.boat.map(Math.round)})`);
  await shot('15-reloaded-in-the-fen');

  // 15. A save from the version before the Fen loads as it was: at home, with nothing of the Fen on the shelf.
  const old = require('fs').readFileSync(require('path').join(__dirname, '../tests/fixtures/saves/v4.json'), 'utf8');
  const was = JSON.parse(old).state;
  await ev((text) => { window.__MW__.game.save = () => Promise.resolve(); localStorage.removeItem('murmurwater.test.bak'); localStorage.setItem('murmurwater.test', text); }, old);
  await page.goto(`http://localhost:${port}/?notitle&quality=low&keepfresh`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 1, null, { timeout: 180000 });
  r = await ev(() => { const g = window.__MW__.game, s = g.state; g.town.openScreen('shop'); const names = [...document.querySelectorAll('.item b')].map((e) => e.textContent); g.town.closeScreens(); return { v: s.version, region: s.world.region, built: g.world.region.id, coins: s.coins, done: s.quests.done.length, journal: Object.keys(s.journal).length, far: names.filter((n) => /Marsh Worm|Fenwood|Glass Mayfly/i.test(n)), reached: s.flags.filter((f) => f.startsWith('reached:')) }; });
  check(r.region === 'hearthbay' && r.built === 'hearthbay' && r.coins === was.coins && r.done === was.quests.done.length && r.journal === Object.keys(was.journal).length, `a save from before the Fen loads as it was (${JSON.stringify(r)})`);
  check(r.far.length === 0, 'with nothing of the Fen on its shelf');
  check(errors.length === 0, `no page errors (${errors.join(' | ').slice(0, 600)})`);
  if (problems.length) { console.error(`FOG FAILED: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`); await browser.close(); process.exit(1); }
  console.log('FOG OK');
  await browser.close();
})();
