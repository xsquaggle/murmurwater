// Hands-aboard bot: the v0.5.0 tester's start (?tester=crew, src/data/tester/crew.json), through the real game. The
// keeper has the cat signed on, the wreck of the Puffin found and the price of her refit. She watches Biscuit
// fish from the skiff, looks the wreck over from the boat, pays Pell at his boatyard, sails the Puffin, takes
// Mister Hollis off the sea-road, sees him fish after dark and not by day, fills the crew basket, sells it with
// her own catch, and changes boats at the yard (which leaves Mister Hollis ashore: the skiff has one berth), and
// then changes them twelve times more to see that nothing is left behind on the graphics card.
// Exits 1 on any failure. Usage: node e2e/crew.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/crew';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
  const shot = async (name, frames = 10) => {
    await page.evaluate((n) => { const g = window.__MW__.game; for (let i = 0; i < n; i++) g.presentOnce(1 / 30); }, frames);
    await page.waitForTimeout(700);
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const j = (o) => JSON.stringify(o);

  await page.goto(`http://localhost:${port}/?tester=crew&notitle&hour=9&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await require('./sail-helpers.cjs').install(page, { grant: false });
  await require('./fog-helpers.cjs').install(page);
  // What this bot adds to the helpers: the hour, the Crew page as the player reads it, a walk up to somebody.
  await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    window.crew = {
      hour(h) { s.hour = h; g.world.hour = h; g.rushSky?.(0); window.fog.wait(1); },
      /** The Crew page: the summary and each hand's line. */
      page() {
        g.town.openScreen('crew');
        const sum = Object.fromEntries([...document.querySelectorAll('.sum-i')].map((e) => [e.querySelector('span').textContent, e.querySelector('b').textContent]));
        const hands = Object.fromEntries([...document.querySelectorAll('.item.hand')].map((e) => [e.querySelector('.item-top b').firstChild.textContent, e.querySelector('.have').textContent]));
        g.town.closeScreens();
        return { sum, hands };
      },
      pill() { g.presentOnce(1 / 30); const p = document.querySelector('.pill.crew'); return { text: p?.textContent ?? '', shown: !!p && p.style.display !== 'none', full: !!p?.classList.contains('full') }; },
      /** Everything the game has said in a toast, in order (toasts fade; this does not). */
      said: [],
      /** Walk up to somebody and hear them out, turning down any new job, until they offer what they always do. Returns those choices. */
      hub(id, starts) {
        const p = window.bot.npc(id); window.bot.walk(p.x, p.z, 40, () => (g.town.focusPrompt ?? '').startsWith(starts));
        if (!window.bot.interact()) return null;
        let c = window.bot.readAll();
        for (let k = 0; k < 3 && c.some((x) => /Not just now/.test(x)); k++) { window.bot.choose('Not just now'); c = window.bot.readAll(); }
        return c;
      },
      /** The last few boat's lengths, slowly: toward a spot until she is within `within` metres of it. */
      creep(x, z, within) { const b = g.sailing.boat; g.skipRender = true; for (let k = 0; k < 1800 && Math.hypot(x - b.x, z - b.z) > within; k++) { let err = Math.atan2(x - b.x, z - b.z) - b.heading; err = Math.atan2(Math.sin(err), Math.cos(err)); g.input.simulate('KeyA', err > 0.05); g.input.simulate('KeyD', err < -0.05); g.input.simulate('KeyW', b.speed < 1.6); g.input.simulate('KeyS', b.speed > 2.4); g.simulate(1 / 30); } for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) g.input.simulate(key, false); g.skipRender = false; },
      /** Bring her to rest. */
      stop() { const b = g.sailing.boat; g.skipRender = true; for (let k = 0; k < 400 && Math.abs(b.speed) > 0.3; k++) { g.input.simulate('KeyS', b.speed > 0); g.input.simulate('KeyW', b.speed < 0); g.simulate(1 / 30); } g.input.simulate('KeyS', false); g.input.simulate('KeyW', false); window.fog.wait(1.5); g.skipRender = false; return Math.abs(b.speed); },
      /** Who sits where: the figures the hands have put in the boat's berths. */
      berths() { const rig = g.sailing.rig; return [0, 1].map((i) => { const b = rig.berth(i); return b ? b.children.length : -1; }); },
      tally: (id) => ({ ...(s.crew.tally[id] ?? { fish: 0, coins: 0, eaten: 0 }) }),
    };
    const toast = g.hud.toast.bind(g.hud);
    g.hud.toast = (text, kind) => { window.crew.said.push(text); return toast(text, kind); };
  });
  const status = (id) => ev((id) => window.bot.status(id), id);
  const crewPage = () => ev(() => window.crew.page());

  // 1. Who she is.
  let r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state; g.presentOnce(1 / 30);
    return { start: MW.testerStart, coins: s.coins, hired: s.crew.hired, boats: s.boats.owned, rig: g.sailing.rig?.boatId, flags: s.flags.filter((f) => /puffin|boatyard/.test(f)),
      goal: document.querySelector('.goal-t')?.textContent ?? '', missing: MW.assetsMissing, dockCat: g.town.critters.some((c) => c.cat.root.visible) };
  });
  check(r.start === 'crew' && r.coins >= 40000 && r.hired.join() === 'biscuit' && r.boats.join() === 'skiff' && r.rig === 'skiff', `the crew's start: ${r.coins} coins, ${r.hired} signed on, the ${r.boats} in the water`);
  check(r.flags.includes('puffin-found') && r.flags.includes('boatyard-open') && !r.flags.includes('puffin-afloat') && (await status('hb-13-refit')) === 'active' && /Puffin/.test(r.goal), `the Puffin is found and Pell has named his price ("${r.goal}")`);
  check(r.missing.length === 0, `no model is missing (${r.missing.join(', ')})`);
  check(!r.dockCat, 'the cat is not on the dock any more: she has signed on');

  // 2. Biscuit at her work: in her berth, fishing while the skiff lies at the dock, idle under way.
  r = await ev(() => { const b = window.bot.board(); window.fog.wait(2); return { b, berths: window.crew.berths(), pill: window.crew.pill() }; });
  check(r.b.ok && r.berths[0] > 0 && r.berths[1] === -1, `aboard the skiff Biscuit has the one berth (${j(r.berths)})`);
  check(r.pill.shown && /^\d+\/8$/.test(r.pill.text), `the crew basket is on the HUD (${r.pill.text})`);
  await shot('01-biscuit-aboard');
  let before = await ev(() => window.crew.tally('biscuit'));
  r = await ev(() => { window.fog.wait(100); const g = window.__MW__.game; return { t: window.crew.tally('biscuit'), hold: g.state.crew.hold.length, env: g.hands.env }; });
  let page1 = await crewPage();
  check(r.env.still && r.t.fish + r.t.eaten - before.fish - before.eaten >= 2 && r.hold >= 1, `lying still at the dock she lands fish: ${r.t.fish - before.fish} kept, ${r.t.eaten - before.eaten} eaten in 100 seconds, ${r.hold} in the basket`);
  check(page1.hands.Biscuit === 'Fishing' && page1.sum.Boat === 'The Keeper\'s Skiff' && page1.sum.Berths === '1 of 1 taken', `the Crew page says so (${j(page1)})`);
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, b = g.sailing.boat, h0 = b.heading; g.skipRender = true;
    // Straight out from the dock: three seconds to gather way, then fifteen under sail with the clocks watched.
    const run = (sec) => { let slowest = 99; for (let i = 0; i < 30 * sec; i++) { let e = h0 - b.heading; e = Math.atan2(Math.sin(e), Math.cos(e)); g.input.simulate('KeyA', e > 0.03); g.input.simulate('KeyD', e < -0.03); g.simulate(1 / 30); slowest = Math.min(slowest, Math.abs(b.speed)); } return slowest; };
    g.input.simulate('KeyW', true); run(3);
    const t0 = window.crew.tally('biscuit'), n0 = s.crew.clocks.biscuit.t, slowest = run(15), still = g.hands.env.still, t1 = window.crew.tally('biscuit'), n1 = s.crew.clocks.biscuit.t;
    for (const k of ['KeyW', 'KeyA', 'KeyD']) g.input.simulate(k, false); g.skipRender = false;
    return { slowest, still, caught: t1.fish + t1.eaten - t0.fish - t0.eaten, clock: [n0, n1] };
  });
  check(r.slowest > 1 && !r.still && r.caught === 0 && r.clock[0] === r.clock[1], `under way for 15 seconds she fishes for nothing, and her clock stands still (${j(r)})`);
  page1 = await crewPage();
  check(/lie still/.test(page1.hands.Biscuit), `and the Crew page says what she waits for ("${page1.hands.Biscuit}")`);
  r = await ev(() => { window.crew.stop(); const m = window.bot.mooring('hearthbay-dock'); return window.bot.sailTo(m.x, m.z, { stopR: 5 }); });
  check(r.ok, `back to the dock mooring (${j(r)})`);

  // 3. The wreck, looked over from the boat.
  r = await ev(() => ({ went: window.fog.chartTo('Sedge Landing jetty'), region: window.__MW__.state.world.region }));
  check(r.went && r.region === 'mossglass-fen', 'the chart carries her to Sedge Landing');
  r = await ev(() => { const go = window.bot.sailTo(-1034, -1001, { stopR: 2.5, maxTime: 300 }); window.crew.hour(10.5); const g = window.__MW__.game; return { go, prompt: g.town.focusPrompt, lies: g.world.waitingProps.some((p) => p.flag === 'puffin-afloat' && p.shown) }; });
  check(r.go.ok && r.prompt === 'Look over the wreck' && r.lies, `in the pocket of open water beside her the wreck can be looked over from the skiff (${j(r.go)}, "${r.prompt}")`);
  await ev(() => window.bot.tap('KeyE'));
  await page.waitForTimeout(400);
  r = await ev(() => window.crew.said);
  check(r.some((t) => /PUFFIN, on the transom/.test(t)), `and what is read there is told (${r.slice(-1)[0]?.slice(0, 100)})`);
  await shot('02-the-wreck');
  r = await ev(() => { const m = window.bot.mooring('sedge-jetty'); const go = window.bot.sailTo(m.x, m.z, { stopR: 5, maxTime: 300 }); return { go, went: window.fog.chartTo('Hearthbay dock'), region: window.__MW__.state.world.region }; });
  check(r.go.ok && r.went && r.region === 'hearthbay', `back to the jetty, and the chart carries her home (${j(r.go)})`);

  // 4. Pell's boatyard: the refit is paid for, and in the morning the Puffin lies off the dock.
  r = await ev(() => { const l = window.bot.land(); const c = window.crew.hub('pell', 'Talk to Pell'); return { l, c }; });
  check(r.l.ok && !!r.c && r.c.some((c) => /About the Puffin/.test(c)), `ashore, Pell reminds her of the price and will talk about the Puffin (${(r.c ?? []).join(' | ')})`);
  r = await ev(() => { const s = window.__MW__.state, g = window.__MW__.game; const ok = window.bot.choose('About the Puffin'); g.simulate(0.2); const cards = [...document.querySelectorAll('.item.boat')].map((e) => ({ name: e.querySelector('.item-top b').textContent, btn: e.querySelector('.btn').textContent, off: e.querySelector('.btn').disabled })); return { ok, cards, coins: s.coins }; });
  check(r.ok && r.cards.length === 2 && r.cards[0].btn === 'In the water' && /^Fit her out/.test(r.cards[1].btn) && !r.cards[1].off, `the boatyard shows both boats, and the Puffin's refit can be paid for (${j(r.cards)})`);
  await shot('03-boatyard', 3);
  const coins0 = r.coins;
  r = await ev(() => { const g = window.__MW__.game, s = g.state; document.querySelector('.item.boat .btn.gold').click(); window.fog.wait(11); g.presentOnce(1 / 30);
    return { coins: s.coins, owned: s.boats.owned, current: s.boats.current, afloat: s.flags.includes('puffin-afloat'), rig: g.sailing.rig.boatId, model: g.sailing.rig.isModel, hour: s.hour, berths: window.crew.berths(), pill: window.crew.pill(), toasts: window.crew.said.slice(-4), screen: g.town.screens.isOpen }; });
  check(coins0 - r.coins === 40000 && r.owned.join() === 'skiff,puffin' && r.current === 'puffin' && r.afloat, `forty thousand coins are paid and the Puffin is hers (${r.coins} left)`);
  check(r.rig === 'puffin' && r.model && !r.screen && r.hour > 7 && r.hour < 9, `it is the next morning and she lies off the dock, the made model (${r.hour.toFixed(1)} h)`);
  check(r.berths[0] > 0 && r.berths[1] === 0 && /\/20$/.test(r.pill.text), `Biscuit has moved to the Puffin's first berth, the second is empty, and the basket is the bigger one (${j(r.berths)}, ${r.pill.text})`);
  check(r.toasts.some((t) => /The Puffin is afloat/.test(t)), `the game says so (${r.toasts.join(' | ').slice(0, 120)})`);
  check((await status('hb-13-refit')) === 'ready' && (await status('fen-s1-gentleman')) === 'ready', 'Pell\'s job is ready to hand in, and with a berth of his own aboard so is the gentleman\'s');
  await shot('04-puffin-afloat');
  r = await ev(() => { const lines = window.crew.hub('pell', 'Talk to Pell') ?? []; const g = window.__MW__.game; if (g.town.dialogue.isOpen) window.bot.choose('Bye'); return { lines }; });
  check((await status('hb-13-refit')) === 'done' && r.lines.some((c) => /About the boats/.test(c)), `Pell is told she floats, and now talks of the boats (${r.lines.join(' | ')})`);

  // 5. The Puffin under sail: quicker than the skiff, and the wreck is gone from the flats.
  r = await ev(() => { const b = window.bot.board(); const g = window.__MW__.game; const sp = g.sailing.def.speed; const go = window.fog.chartTo('The Drowned Belfry'); return { b, sp, go }; });
  check(r.b.ok && r.b.prompt === 'Board the Puffin' && r.sp > 8 && r.go, `she boards the Puffin and the chart carries her to the belfry (${j(r.b)})`);
  r = await ev(() => { window.bot.log.top = 0; const go = window.bot.sailTo(-404.5, -293.9, { stopR: 8 }); return { go, top: window.bot.log.top }; });
  check(r.go.ok && r.top > 7.5, `under sail she makes ${(r.top * 1.94).toFixed(1)} knots on the way to the sea-road (the skiff's best is 13.6)`);
  await ev(() => { const g = window.__MW__.game; g.input.simulate('KeyW', true); window.fog.wait(5); });
  await shot('05-under-sail', 4);
  await ev(() => { window.__MW__.game.input.simulate('KeyW', false); });

  // 6. Mister Hollis, at the eighth light: hailed from the boat, he comes aboard.
  r = await ev(() => { const p = window.fog.pilot(-622.1, -421.0, 150, 15); window.crew.creep(-622.1, -421.0, 6.5); const left = window.crew.stop(); const g = window.__MW__.game, b = g.sailing.boat, h = g.town.npcs.get('hollis'); g.presentOnce(1 / 30);
    return { region: p.region, prompt: g.town.focusPrompt, stands: !!h && h.fig.root.visible, fog: g.hands.env?.fog ?? 0, at: [Math.round(b.x), Math.round(b.z)], speed: left, off: h ? Math.hypot(h.fig.root.position.x - b.x, h.fig.root.position.z - b.z) : -1 }; });
  check(r.region === 'mossglass-fen' && r.stands && r.prompt === 'Hail Mister Hollis' && r.fog > 0.3, `on the Fen's side of the road a gentleman stands on the water, and can be hailed from the boat (${j(r)})`);
  r = await ev(() => window.__MW__.game.world.waitingProps);
  check(r.length === 1 && r[0].flag === 'puffin-afloat' && !r[0].shown, `the wreck no longer lies on the flats (${j(r)})`);
  await shot('06-the-gentleman');
  r = await ev(() => { const open = window.bot.interact(); const g = window.__MW__.game; const name = document.querySelector('.dlg-name')?.textContent ?? ''; const c = window.bot.readAll(); if (g.town.dialogue.isOpen) window.bot.choose('Bye'); window.fog.wait(2);
    const h = g.town.npcs.get('hollis'); return { open, name, c, hired: g.state.crew.hired, stands: !!h && h.fig.root.visible, berths: window.crew.berths() }; });
  await page.waitForTimeout(1700);
  const told = await ev(() => window.crew.said.slice(-4));
  check(r.open && r.name === 'Mister Hollis' && (await status('fen-s1-gentleman')) === 'done' && r.hired.join() === 'biscuit,hollis', `he accepts the berth (${r.hired})`);
  check(!r.stands && r.berths[0] > 0 && r.berths[1] > 0 && told.some((t) => /Mister Hollis goes aboard the Puffin/.test(t)), `he is off the road and in the second berth (${j(r.berths)}; ${told.join(' | ').slice(0, 120)})`);
  page1 = await crewPage();
  check(page1.sum.Berths === '2 of 2 taken' && /Fishing|Nothing/.test(page1.hands['Mister Hollis']), `in the fog there is enough of him to fish, even by day (${j(page1.hands)})`);

  // 7. Out of the fog by day he is too thin to hold a line; after dark he fishes, and better than the cat.
  r = await ev(() => { const p = window.fog.pilot(-404.5, -293.9, 150, 10); const m = window.bot.mooring('belfry-shoal'); const go = window.bot.sailTo(m.x, m.z, { stopR: 6 }); window.crew.hour(11); window.fog.wait(3); const g = window.__MW__.game; return { region: p.region, go, env: g.hands.env }; });
  page1 = await crewPage();
  check(r.region === 'hearthbay' && r.go.ok && r.env.fog < 0.3 && /Too light/.test(page1.hands['Mister Hollis']) && page1.hands.Biscuit === 'Fishing', `at the belfry at eleven in the morning he is too thin to fish and the cat is not (${j(page1.hands)})`);
  await shot('07-thin-by-day');
  before = await ev(() => window.crew.tally('hollis'));
  r = await ev(() => { window.crew.hour(21.5); const g = window.__MW__.game, s = g.state; const n0 = s.crew.hold.length; window.fog.wait(150); const mine = s.crew.hold.slice(n0); return { t: window.crew.tally('hollis'), cat: window.crew.tally('biscuit'), hold: s.crew.hold.length, best: Math.max(0, ...mine.map((f) => f.value)) }; });
  page1 = await crewPage();
  check(r.t.fish - before.fish >= 2 && page1.hands['Mister Hollis'] === 'Fishing', `after dark he lands fish: ${r.t.fish - before.fish} in 150 seconds, worth ${r.t.coins - before.coins} coins`);
  await shot('08-after-dark');

  // 8. The basket fills, they stop, and the stall takes it with the keeper's own catch.
  r = await ev(() => { const g = window.__MW__.game, s = g.state; g.skipRender = true; let t = 0; for (; t < 1500 && s.crew.hold.length < 20; t += 5) { s.hour = 22; g.simulate(5); } g.skipRender = false; window.fog.wait(1); const n = s.crew.hold.length; const c0 = { t: 0, ...s.crew.clocks.hollis }; window.fog.wait(60);
    return { t, n, after: s.crew.hold.length, clock: [c0.t, s.crew.clocks.hollis?.t ?? 0], pill: window.crew.pill(), toasts: window.crew.said.slice(-6), worth: s.crew.hold.reduce((a, f) => a + f.value, 0) }; });
  page1 = await crewPage();
  check(r.n === 20 && r.after === 20 && r.pill.full && r.pill.text === '20/20', `the crew basket fills in ${Math.round(r.t / 60)} more minutes of lying still, and stays at twenty (${r.pill.text})`);
  check(r.toasts.some((t) => /crew basket is full/.test(t)) && /full/.test(page1.hands.Biscuit) && /full/.test(page1.hands['Mister Hollis']) && /full/.test(page1.sum['Crew basket']), `the game says it is full, and so does the Crew page (${j(page1.hands)})`);
  const worth = r.worth;
  r = await ev(() => { window.crew.hour(9); const went = window.fog.chartTo('Hearthbay'); const l = window.bot.land(); const s = window.__MW__.state; const c0 = s.coins, other = s.hold.length + s.pots.hold.length; const c = window.crew.hub('mara', 'Talk to Mara') ?? []; const sold = window.bot.choose('Sell my catch'); window.fog.wait(1); const g = window.__MW__.game; if (g.town.dialogue.isOpen) window.bot.choose('Bye');
    return { went, l, c, other, sold, got: s.coins - c0, left: s.crew.hold.length, pill: window.crew.pill() }; });
  check(r.went && r.l.ok && r.c.some((c) => c.includes(`Sell my catch (${20 + r.other} fish)`)), `home again, Mara offers to buy the twenty with whatever else is aboard (${r.c.join(' | ')})`);
  check(r.sold && r.got >= worth && (r.other > 0 || r.got === worth) && r.left === 0 && r.pill.text === '0/20' && !r.pill.full, `she pays ${r.got} coins (the basket was worth ${worth}), and the basket is empty`);

  // 9. Changing boats at the yard: the skiff has one berth, so Mister Hollis waits ashore; and back again.
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.crew.hub('pell', 'Talk to Pell'); const ok = window.bot.choose('About the boats'); g.simulate(0.2);
    const btns = [...document.querySelectorAll('.item.boat .btn')].map((b) => b.textContent); [...document.querySelectorAll('.item.boat .btn')].find((b) => b.textContent === 'Take her out')?.click(); window.fog.wait(5);
    return { ok, btns, current: s.boats.current, rig: g.sailing.rig.boatId, berths: window.crew.berths(), pill: window.crew.pill() }; });
  page1 = await crewPage();
  check(r.ok && r.btns.join() === 'Take her out,In the water' && r.current === 'skiff' && r.rig === 'skiff', `Pell brings the skiff round (${r.btns.join(' | ')})`);
  check(r.berths[0] > 0 && r.berths[1] === -1 && /Ashore/.test(page1.hands['Mister Hollis']) && page1.sum.Berths === '1 of 1 taken' && /\/8$/.test(r.pill.text), `in the skiff the cat has the berth and Mister Hollis is ashore (${j(page1.hands)})`);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.crew.hub('pell', 'Talk to Pell'); window.bot.choose('About the boats'); g.simulate(0.2);
    [...document.querySelectorAll('.item.boat .btn')].find((b) => b.textContent === 'Take her out')?.click(); window.fog.wait(5); return { current: s.boats.current, rig: g.sailing.rig.boatId, berths: window.crew.berths() }; });
  check(r.current === 'puffin' && r.rig === 'puffin' && r.berths[0] > 0 && r.berths[1] > 0, `and the Puffin again, with both hands aboard (${j(r.berths)})`);
  await shot('09-both-aboard');

  // 10. Changing boats again and again leaves nothing behind on the graphics card: the hull, her rig and the
  // hands' figures (their own materials, his line, their bones) are freed each time. One pair of changes first,
  // so that anything made once and kept is already made; then two rounds of six. Something else in the bay may
  // be drawn for the first time during one round (a count that goes up once), but what is not freed goes up in both.
  r = await ev(() => { const g = window.__MW__.game;
    const mem = () => { for (let i = 0; i < 4; i++) g.presentOnce(1 / 30); const m = g.renderer.gl.info.memory; return [m.geometries, m.textures]; };
    const change = () => { window.crew.hub('pell', 'Talk to Pell'); window.bot.choose('About the boats'); g.simulate(0.2); [...document.querySelectorAll('.item.boat .btn')].find((b) => b.textContent === 'Take her out')?.click(); window.fog.wait(5); };
    const six = () => { for (let i = 0; i < 6; i++) change(); return mem(); };
    change(); change(); const a = mem(), b = six(), c = six();
    return { a, b, c, rig: g.sailing.rig.boatId, berths: window.crew.berths() }; });
  const grew = (x, y) => y[0] > x[0] || y[1] > x[1];
  check(r.rig === 'puffin' && r.berths[0] > 0 && r.berths[1] > 0 && !(grew(r.a, r.b) && grew(r.b, r.c)), `twelve more changes of boat leave nothing behind on the graphics card (geometries and textures: ${j(r.a)}, ${j(r.b)} after six, ${j(r.c)} after twelve)`);

  // 11. A conversation left open with the window not in front: the world stands still behind it (pots and crew
  // with it), and goes on when the window is in front again.
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.crew.hub('pell', 'Talk to Pell'); const open = g.town.dialogue.isOpen;
    // (The helpers hold the game paused and step it by hand: for this it is let run as it does for a player.)
    const run = () => { const t0 = s.playTime; g.paused = false; for (let i = 0; i < 6; i++) g.frame(0.1); g.paused = true; return +(s.playTime - t0).toFixed(3); };
    const front = run(); window.dispatchEvent(new Event('blur')); const away = run(); window.dispatchEvent(new Event('focus')); const back = run();
    if (g.town.dialogue.isOpen) window.bot.choose('Bye');
    // With no conversation open, losing the window does not stop frames that are asked for (the pause screen is the mouse's business).
    window.dispatchEvent(new Event('blur')); const closed = run(); window.dispatchEvent(new Event('focus'));
    return { open, front, away, back, closed }; });
  check(r.open && r.front > 0.5 && r.away === 0 && r.back > 0.5 && r.closed > 0.5, `the world stands still behind a conversation while the window is not in front (${j(r)})`);

  check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  console.log(problems.length ? `CREW FAILED: ${problems.length}\n - ${problems.join('\n - ')}` : 'CREW OK');
  process.exit(problems.length ? 1 : 0);
})();
