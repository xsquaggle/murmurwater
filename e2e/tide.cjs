// Tide bot: the second half of Hearthbay, through the real game. Takes the Lantern Pot job from Mara, sets
// the pot with the pot key, lets it fish, hauls it and sells; buys from every page of the shelf; wears and
// tunes things from the satchel; finds the Drowned Bell by boat, opens the chest on its shoal, rings the
// Bell, wakes on the dock with Echoes, spends one, and checks what the tide kept and what it took. Then
// saves, reloads and checks again. Exits 1 on any failure.
// Shortcuts: it starts from a granted state (the flounder handed in, the skiff owned), is given the coins a
// full stall would have earned, and travels home by the chart.
// Usage: node e2e/tide.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/tide';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  const q = `notitle&hour=9&quality=${process.env.MW_QUALITY || 'medium'}`;
  await page.goto(`http://localhost:${port}/?fresh&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  await require('./sail-helpers.cjs').install(page);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const status = (id) => ev((id) => window.bot.status(id), id);

  // The story so far, granted: the skiff is the keeper's, the kettle is found, Mara has had her flounder.
  await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    delete s.quests.active['hb-06-relight'];
    s.quests.done.push('hb-06-relight', 'hb-07-kettle', 'hb-08-teeth');
    s.flags.push('hb-lighthouse-lit', 'pell-home', 'kettle-taken', 'met-wick');
    s.boats.owned = ['skiff']; s.boats.current = 'skiff'; s.relics.push('keepers-kettle');
    s.world.charted.push('gull-point', 'kettle-isle', 'the-teeth');
    s.coins = 300; s.lifetime.coins = 2400; s.run.coins = 2400;
    const end = g.world.dockEnd;
    g.pos.set(end.x + 1.5, g.groundAt(end.x + 1.5, end.z) ?? 1.4, end.z); g.yaw = -Math.PI / 2;
    g.sailing.launch(); g.town.arrive(); g.refreshSession(); g.snapCamera(); g.simulate(0.3);
    window.tide = {
      /** Let the game run: `seconds` of play, presenting now and then so floats and the HUD keep up. */
      wait(seconds) { g.skipRender = true; for (let t = 0; t < seconds; t += 1 / 30) { g.simulate(1 / 30); if (Math.round(t * 30) % 6 === 0) g.presentOnce(0.2); } g.skipRender = false; },
      pots: () => ({ owned: s.pots.owned, placed: s.pots.placed.map((p) => ({ zone: p.zone, fish: p.fish.length, x: p.x, z: p.z })), hold: s.pots.hold.length, near: !!g.pots.near, spot: !!g.pots.spot, prompt: g.pots.prompt, pill: document.querySelector('.pill.pots b')?.textContent, pillShown: document.querySelector('.pill.pots')?.style.display !== 'none' }),
      toasts: () => [...document.querySelectorAll('.toast')].map((t) => t.textContent),
      click(sel, text) { const b = [...document.querySelectorAll(sel)].find((e) => !text || e.textContent.includes(text)); if (!b || b.disabled) return false; b.click(); return true; },
      talk(npc) { const p = window.bot.npc(npc); window.bot.walk(p.x, p.z, 40, () => g.town.focusPrompt === `Talk to ${MW.quests.npc(npc).name.split(' ')[0]}`); return window.bot.interact(); },
    };
  });

  // 1. Three fish off the dock, so the journal has something for a pot to copy.
  let r = await ev(() => { const g = window.__MW__.game; g.camYaw = -Math.PI / 2; g.simulate(0.5); const s = g.state; let n = 0; for (let i = 0; i < 8 && Object.keys(s.journal).length < 2; i++) { window.bot.fishFor('nothing', 1, 10); n++; } return { kinds: Object.keys(s.journal), casts: n }; });
  check(r.kinds.length >= 2, `the journal knows ${r.kinds.join(', ')} from the dock`);

  // 2. Mara: a full stall (main), then the pot job (side), which comes with a pot.
  r = await ev(() => window.tide.talk('mara'));
  let choices = await ev(() => window.bot.readAll());
  check(r && choices.some((c) => c.includes('do it')), `Mara has work (${choices.join(' | ')})`);
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-08b-stall')) === 'active', 'A Full Stall is under way');
  await ev(() => { window.bot.interact(); });
  choices = await ev(() => window.bot.readAll());
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-p1-pots')) === 'active', `Lanterns in the Water is under way (${choices.join(' | ')})`);
  r = await ev(() => window.tide.pots());
  check(r.owned === 1 && r.placed.length === 0, `Mara handed over a Lantern Pot (${JSON.stringify(r)})`);
  await shot('01-pot-job');

  // 3. Down the dock, face the water, and the pot key sets it. A second press with none in hand says so.
  r = await ev(() => {
    const g = window.__MW__.game, end = g.world.dockEnd;
    window.bot.walk(end.x - 0.4, end.z, 30);
    g.camYaw = -Math.PI / 2; window.tide.wait(1);
    const before = window.tide.pots();
    const hint = document.querySelector('.hint')?.textContent ?? '';
    window.bot.tap('KeyF'); window.tide.wait(0.5);
    return { before, after: window.tide.pots(), hint, toasts: window.tide.toasts() };
  });
  check(r.before.spot && /Lantern Pot/.test(r.hint), `at the dock end the hint offers to set a pot (${r.hint})`);
  check(r.after.placed.length === 1 && r.after.placed[0].zone === 'hb-dock', `F set the pot in the water off the dock (${JSON.stringify(r.after.placed)})`);
  check(r.after.pillShown && r.after.pill === '0/3', `the HUD counts the pot (${r.after.pill})`);
  check(r.toasts.some((t) => t.includes('It fishes while you do')), `and says so (${r.toasts.join(' | ')})`);
  await shot('02-pot-set');

  // 4. It fishes while the game runs, and stops when it is full.
  r = await ev(() => { window.tide.wait(60); const mid = window.tide.pots(); window.tide.wait(120); return { mid, full: window.tide.pots(), toasts: window.tide.toasts() }; });
  check(r.mid.placed[0].fish === 1, `a minute in, the pot has trapped ${r.mid.placed[0].fish} fish`);
  check(r.full.placed[0].fish === 3 && r.full.pill === '3/3', `three minutes in it is full and has stopped (${r.full.placed[0].fish} fish, pill ${r.full.pill})`);
  await ev(() => window.tide.wait(60));
  check((await ev(() => window.tide.pots())).placed[0].fish === 3, 'a full pot traps no more');
  await shot('03-pot-full');

  // 5. Haul it from the dock with the pot key; the fish go to the pot basket and the job is done.
  r = await ev(() => { const p = window.tide.pots(); window.bot.tap('KeyF'); window.tide.wait(0.4); return { prompt: p.prompt, after: window.tide.pots(), toasts: window.tide.toasts(), hold: window.__MW__.state.hold.length }; });
  check(/Haul the Lantern Pot \(3 fish\)/.test(r.prompt ?? ''), `in reach the prompt offers to haul it (${r.prompt})`);
  check(r.after.hold === 3 && r.after.placed[0].fish === 0, `hauled: three fish in the pot basket, the pot empty and fishing again (${JSON.stringify(r.after)})`);
  check((await status('hb-p1-pots')) === 'ready', 'hauling three fish finishes the pot job');
  await shot('04-pot-hauled');

  // 6. Mara: the job, then selling. Pot fish sell with the rest.
  const purse = await ev(() => window.__MW__.state.coins);
  await ev(() => { window.tide.talk('mara'); window.bot.readAll(); });
  check((await status('hb-p1-pots')) === 'done' && (await ev(() => window.__MW__.state.flags.includes('pots-open'))), 'Mara takes the news and opens the pot shelf');
  choices = await ev(() => window.bot.readAll());
  check(choices.some((c) => /Sell my catch \(\d+ fish\)/.test(c)), `she will buy the catch, pot fish and all (${choices.join(' | ')})`);
  await ev(() => window.bot.choose('Sell'));
  r = await ev(() => ({ coins: window.__MW__.state.coins, hold: window.__MW__.state.hold.length, pot: window.__MW__.state.pots.hold.length }));
  check(r.coins > purse + 60 && r.hold === 0 && r.pot === 0, `sold: ${r.coins - purse - 60} coins for the catch on top of the 60 for the job`);

  // 7. The shelf, page by page, with coins a full stall would have brought.
  await ev(() => { const s = window.__MW__.state; s.coins += 9000; window.bot.readAll(); window.bot.choose('good shelf'); });
  check((await ev(() => window.__MW__.game.town.screens.current)) === 'shop', 'the shelf opens');
  await shot('05-shop-rods', 2);
  r = await ev(() => { const g = window.__MW__.game, s = g.state, before = g.stats.rod.power; const b = [...document.querySelectorAll('.item')].find((e) => e.textContent.includes('In hand'))?.querySelector('.tune .btn'); b?.click(); return { ok: !!b, level: s.gear.rodLevels[s.gear.rod], before, after: g.stats.rod.power }; });
  check(r.ok && r.level === 1 && r.after > r.before, `tuning the rod in hand: level ${r.level}, power ${r.before.toFixed(2)} to ${r.after.toFixed(2)}`);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.tide.click('.shop-bar .sc-tab', 'Lures'); [...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Brass Spinner'))?.querySelector('.btn.gold')?.click(); return { lure: s.gear.lure, lures: s.gear.lures, size: g.stats.size }; });
  check(r.lure === 'brass-spinner' && r.lures.length === 1 && r.size > 0, `bought the Brass Spinner and it went on the line (size +${r.size})`);
  await shot('06-shop-tackle', 2);
  r = await ev(() => { const s = window.__MW__.state; const row = [...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Wicker Creel')); row?.querySelector('.btn.gold')?.click(); return { creel: s.gear.creel, hold: window.__MW__.game.stats.hold, value: window.__MW__.game.stats.value }; });
  check(r.creel === 1 && r.hold === 20, `bought the Wicker Creel: ${r.hold} slots with the skiff's four, fish sell for ${Math.round((r.value - 1) * 100)}% more`);
  r = await ev(() => { window.tide.click('.shop-bar .sc-tab', 'Clothes'); const s = window.__MW__.state; for (const name of ['Wool Cap', 'Tarred Boots']) [...document.querySelectorAll('.item')].find((e) => e.textContent.includes(name))?.querySelector('.btn.gold')?.click(); return { worn: s.gear.worn, owned: s.gear.wearables }; });
  check(r.worn.hat === 'wool-cap' && r.worn.boots === 'tar-boots', `bought a cap and boots and they went straight on (${JSON.stringify(r.worn)})`);
  await shot('07-shop-clothes', 2);
  r = await ev(() => { const ok = window.tide.click('.shop-bar .sc-tab', 'Lantern Pots'); const s = window.__MW__.state; const g = window.__MW__.game; const before = g.stats.potSpeed; [...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Another Lantern Pot'))?.querySelector('.btn.gold')?.click(); [...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Brighter wicks'))?.querySelector('.btn.gold')?.click(); return { ok, owned: s.pots.owned, levels: s.pots.levels, before, speed: g.stats.potSpeed }; });
  check(r.ok && r.owned === 2 && r.levels.speed === 1 && r.speed > r.before, `the pot shelf: a second pot and brighter wicks (pots fill ${Math.round((r.speed - 1) * 100)}% faster)`);
  await shot('08-shop-pots', 2);
  await ev(() => window.__MW__.game.town.closeScreens());

  // 8. The satchel: what the gear adds up to; a click takes the cap off and puts it back.
  await ev(() => window.__MW__.game.town.openScreen('gear'));
  await shot('09-satchel-gear', 2);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; const sums = [...document.querySelectorAll('.sum-i')].map((e) => e.textContent); const b0 = g.stats.biteSpeed; window.tide.click('.wear-slot .chip', 'Wool Cap'); const off = { worn: s.gear.worn.hat, bite: g.stats.biteSpeed }; window.tide.click('.wear-slot .chip', 'Wool Cap'); return { sums, b0, off, on: s.gear.worn.hat, tabs: [...document.querySelectorAll('.sc-tab')].map((e) => e.textContent) }; });
  check(r.sums.length >= 7 && r.off.worn === null && r.off.bite < r.b0 && r.on === 'wool-cap', `the Gear page totals the gear (${r.sums.slice(0, 6).join(', ')}) and a click takes the cap off and on`);
  check(!r.tabs.includes('Echoes'), 'no Echoes page before the Bell is known');
  await ev(() => window.__MW__.game.town.closeScreens());

  // 9. A full stall, granted: the coins it asks for go over the counter.
  await ev(() => { const MW = window.__MW__, s = MW.state; MW.quests.onQuestEvent(s, { type: 'sell', count: 40, coins: 6000 }); s.lifetime.coins += 6000; s.run.coins += 6000; });
  check((await status('hb-08b-stall')) === 'ready', 'six thousand coins of fish fills the stall');
  await ev(() => { window.tide.talk('mara'); window.bot.readAll(); });
  r = await ev(() => ({ worn: window.__MW__.state.gear.worn.hat, owned: window.__MW__.state.gear.wearables.includes('keepers-souwester') }));
  check((await status('hb-08b-stall')) === 'done' && r.owned, `Mara gives the keeper's sou'wester (hat worn: ${r.worn})`);
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 10. Pell sends the keeper to the Drowned Bell.
  await ev(() => { window.tide.talk('pell'); });
  choices = await ev(() => window.bot.readAll());
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-09-bell')) === 'active', `The Drowned Bell is under way (${choices.join(' | ')})`);
  r = await ev(() => window.bot.board());
  check(r.ok, `boarded at the dock (${JSON.stringify(r)})`);

  // 11. From the boat: the second pot goes over the side, and the first can be hauled from aboard.
  r = await ev(() => {
    const g = window.__MW__.game, sail = g.sailing;
    g.input.simulate('KeyW', true); window.tide.wait(2.2); g.input.simulate('KeyW', false);
    for (let i = 0; i < 200 && Math.abs(sail.boat.speed) > 0.5; i++) g.simulate(1 / 30);
    window.tide.wait(0.5);
    const spot = window.tide.pots().spot;
    window.bot.tap('KeyF'); window.tide.wait(0.4);
    return { spot, pots: window.tide.pots(), aboard: sail.aboard };
  });
  check(r.aboard && r.spot && r.pots.placed.length === 2, `from the boat F sets the second pot over the side (${r.pots.placed.length} in the water)`);
  await shot('10-pot-from-boat');
  r = await ev(() => { window.tide.wait(55); const p = window.tide.pots(); const had = p.placed[1].fish; window.bot.tap('KeyF'); window.tide.wait(0.3); return { prompt: p.prompt, had, after: window.tide.pots() }; });
  check(r.had >= 1 && /Haul/.test(r.prompt ?? '') && r.after.hold === r.had, `hauled ${r.had} fish over the side without leaving the boat (${r.prompt})`);

  // 12. North-west past Gull Point to the belfry.
  const shoal = await ev(() => window.bot.mooring('belfry-shoal'));
  const before = await ev(() => window.bot.state());
  r = await ev((m) => window.bot.sailTo(m.x, m.z, { stopR: 4, maxTime: 400 }), shoal);
  check(r.ok, `sailed from the dock to the Drowned Belfry: ${r.metres} m in ${r.seconds} s`);
  let st = await ev(() => window.bot.state());
  check(st.charted.includes('drowned-belfry') && st.coins > before.coins, `the Drowned Belfry went on the chart and paid (${st.coins - before.coins} coins)`);
  await ev(() => { const g = window.__MW__.game; g.lookToward(g.world.bellPos, 0.05); });
  await shot('11-belfry-from-the-boat');
  r = await ev(() => window.bot.land());
  check(r.ok && r.boardable, `stepped ashore on the shoal, in reach of her (${JSON.stringify(r)})`);

  // 13. The chest on the shoal holds the keeper's boots.
  const chest = await ev(() => window.__MW__.game.world.region.chests.find((c) => c.id === 'belfry-chest'));
  r = await ev((c) => window.bot.walk(c.x, c.z, 30, () => window.__MW__.game.town.focusPrompt === 'Open the chest'), chest);
  await ev(() => window.bot.tap('KeyE'));
  r = await ev(() => { const s = window.__MW__.state; window.__MW__.game.simulate(0.3); return { boots: s.gear.wearables.includes('keepers-boots'), toasts: window.tide.toasts() }; });
  check(r.boots && r.toasts.some((t) => t.includes('The Keeper’s Boots') || t.includes("The Keeper's Boots")), `the chest gives the keeper's boots (${r.toasts.join(' | ')})`);

  // 14. Along the shoal to the bell rope: looking at it is enough for Pell.
  const bell = await ev(() => window.__MW__.game.world.region.places.find((p) => p.id === 'drowned-bell'));
  r = await ev((p) => window.bot.walk(p.x, p.z, 40, () => (window.__MW__.game.town.focusPrompt ?? '').includes('bell')), bell);
  check(r === 'Look at the bell', `walked the shoal to the bell rope (prompt: ${r})`);
  await ev(() => { const g = window.__MW__.game; g.lookToward(g.world.bellPos, -0.1); });
  await shot('12-at-the-bell');
  await ev(() => window.bot.tap('KeyE'));
  check((await status('hb-09-bell')) === 'ready', 'seeing the bell finishes the errand');
  await ev(() => { const g = window.__MW__.game, b = g.world.region.landmarks.belfry; g.debugCam = { pos: g.pos.clone().set(b.x - 16, 5.5, b.z + 15), look: g.pos.clone().set(b.x, 5.5, b.z) }; });
  await shot('13-belfry');
  await ev(() => { const g = window.__MW__.game, b = g.world.region.landmarks.belfry; g.state.hour = 21.5; g.simulate(0.2); g.debugCam = { pos: g.pos.clone().set(b.x - 13, 4, b.z + 20), look: g.pos.clone().set(b.x, 6, b.z) }; });
  await shot('14-belfry-night');
  await ev(() => { const g = window.__MW__.game; g.debugCam = null; g.state.hour = 11; g.simulate(0.2); });

  // 15. Home by the chart; Pell says what the Bell is for, and hands over the whistle.
  r = await ev(() => window.bot.board());
  check(r.ok, `back aboard from the shoal (${JSON.stringify(r)})`);
  r = await ev((m) => window.bot.sailTo(m.x, m.z, { stopR: 5 }), shoal);
  await ev(() => { const g = window.__MW__.game; g.town.openScreen('chart'); });
  await shot('15-chart-with-pots', 2);
  const went = await ev(() => { const row = [...document.querySelectorAll('.chart-place')].find((e) => e.textContent.includes('Hearthbay')); const b = row?.querySelector('.btn'); if (!b || b.disabled) return false; b.click(); window.tide.wait(5); return true; });
  check(went, 'from the belfry mooring the chart carries her home');
  r = await ev(() => window.bot.land());
  check(r.ok && r.island === 'hearthbay', 'ashore at home');
  await ev(() => { window.tide.talk('pell'); window.bot.readAll(); });
  r = await ev(() => ({ found: window.__MW__.state.flags.includes('bell-found'), whistle: window.__MW__.state.gear.wearables.includes('keepers-whistle') }));
  check((await status('hb-09-bell')) === 'done' && r.found && r.whistle, 'Pell explains the Bell and gives the keeper\'s whistle');
  choices = await ev(() => window.bot.readAll());
  await ev(() => window.bot.choose('do it'));
  check((await status('hb-10-turning')) === 'active', `The Turning is under way (${choices.join(' | ')})`);
  await ev(() => window.__MW__.game.town.openScreen('gear'));
  await shot('16-satchel-keepers-things', 2);
  r = await ev(() => ({ set: document.querySelector('.set')?.textContent ?? '', tabs: [...document.querySelectorAll('.sc-tab')].map((e) => e.textContent) }));
  check(/The Keeper’s Things|The Keeper's Things/.test(r.set) && r.tabs.includes('Echoes'), `the satchel counts the keeper's things (${r.set.slice(0, 60)}) and has an Echoes page now`);
  await ev(() => window.__MW__.game.town.closeScreens());

  // 16. Back to the Bell by the chart, and ring it.
  r = await ev(() => window.bot.board());
  await ev(() => { const g = window.__MW__.game; g.town.sailTo('belfry-shoal'); window.tide.wait(5); });
  st = await ev(() => window.bot.state());
  check(st.aboard && Math.hypot(st.x - shoal.x, st.z - shoal.z) < 10, 'the chart carries her back to the belfry');
  r = await ev(() => window.bot.land());
  r = await ev((p) => window.bot.walk(p.x, p.z, 40, () => (window.__MW__.game.town.focusPrompt ?? '').includes('bell rope')), bell);
  check(r === 'Take hold of the bell rope', `at the rope the prompt has changed (${r})`);
  const beforeRing = await ev(() => { const s = window.__MW__.state; s.hold.push({ uid: s.nextUid++, fishId: 'butterperch', weight: 0.4, trait: null, value: 12, perfect: false }); return { coins: s.coins, lifetime: s.lifetime.coins, levels: { ...s.gear.rodLevels }, creel: s.gear.creel, pots: s.pots.placed.length, potLevels: { ...s.pots.levels }, wearables: [...s.gear.wearables], rods: [...s.gear.rods], lures: [...s.gear.lures], journal: Object.keys(s.journal).length, charted: s.world.charted.length, done: s.quests.done.length }; });
  await ev(() => window.bot.tap('KeyE'));
  check((await ev(() => window.__MW__.game.town.screens.current)) === 'bell', 'taking the rope opens the Bell’s page');
  await shot('17-bell-page', 2);
  r = await ev(() => ({ give: document.querySelector('.bell-give')?.textContent ?? '', can: !document.querySelector('.bell-btns .btn.gold')?.disabled }));
  check(r.can && /✺ \d+ Echo/.test(r.give), `it says what the Bell will give (${r.give.slice(0, 50)})`);
  await ev(() => { document.querySelector('.bell-btns .btn.gold').click(); const g = window.__MW__.game; for (let i = 0; i < 90; i++) { g.simulate(1 / 30); g.presentOnce(1 / 30); } });
  await shot('18-bell-struck', 4);
  await ev(() => window.tide.wait(11));
  await shot('19-first-morning');
  r = await ev(() => { const g = window.__MW__.game, s = g.state, d = g.world.dockEnd, b = g.sailing.boat, home = window.bot.mooring('hearthbay-dock'); return { run: s.run.number, echoes: s.echoes, coins: s.coins, levels: s.gear.rodLevels, creel: s.gear.creel, pots: s.pots.placed.length, owned: s.pots.owned, potLevels: s.pots.levels, wearables: s.gear.wearables, worn: s.gear.worn, rods: s.gear.rods, lures: s.gear.lures, journal: Object.keys(s.journal).length, charted: s.world.charted.length, done: s.quests.done.length, hold: s.hold.length, hour: s.hour, fromDock: Math.hypot(g.pos.x - d.x, g.pos.z - d.z), boatHome: Math.hypot(b.x - home.x, b.z - home.z), aboard: g.sailing.aboard, floats: g.pots.floats?.size, island: g.town.island, blocking: g.town.blocking, lifetime: s.lifetime.echoes, pill: document.querySelector('.pill.echoes b')?.textContent }; });
  const want = Math.floor(0.15 * Math.sqrt(beforeRing.lifetime + 12));
  check(r.run === 2 && r.echoes === want && r.lifetime === want, `the tide turned: tide ${r.run}, ${r.echoes} Echoes for ${beforeRing.lifetime + 12} coins earned (expected ${want})`);
  check(r.coins === 0 && r.creel === 0 && Object.values(r.levels).every((v) => v === 0) && r.pots === 0 && r.potLevels.speed === 0 && r.hold === 0, `it took the coins, the tuning, the creel, the wicks and brought the pots home (${JSON.stringify({ coins: r.coins, creel: r.creel, levels: r.levels, pots: r.pots })})`);
  check(r.owned === 2 && r.wearables.length === beforeRing.wearables.length && r.rods.length === beforeRing.rods.length && r.lures.length === beforeRing.lures.length && r.journal === beforeRing.journal && r.charted === beforeRing.charted && r.done === beforeRing.done, 'it left the pots, rods, lure, clothes, journal, chart and story');
  check(r.fromDock < 40 && r.island === 'hearthbay' && !r.aboard && r.boatHome < 12 && Math.abs(r.hour - 6.7) < 0.4 && !r.blocking, `the keeper wakes on the Hearthbay dock at first light with the skiff on her mooring (${r.fromDock.toFixed(0)} m from the dock end, boat ${r.boatHome.toFixed(1)} m from home, ${r.hour.toFixed(2)} h)`);
  check(r.pill === String(want), `the HUD shows the Echoes (${r.pill})`);
  check((await status('hb-10-turning')) === 'ready', 'ringing the Bell finishes The Turning');

  // 17. Spend an Echo: Tidewise makes every fish sell for more, for good.
  await ev(() => window.__MW__.game.town.openScreen('echoes'));
  await shot('20-echoes', 2);
  r = await ev(() => { const g = window.__MW__.game, s = g.state, v0 = g.stats.value, e0 = s.echoes; const row = [...document.querySelectorAll('.item.echo')].find((e) => e.textContent.includes('Tidewise')); row?.querySelector('.btn')?.click(); return { v0, v1: g.stats.value, spent: e0 - s.echoes, rank: s.echoUpgrades.tidewise }; });
  check(r.rank === 1 && r.spent === 1 && r.v1 > r.v0 + 0.14, `one Echo buys Tidewise: fish sell for ${Math.round((r.v1 - r.v0) * 100)}% more`);
  await ev(() => window.__MW__.game.town.closeScreens());

  // 18. People very nearly remember. Pell first (the story), then Mara's line for after a Turning.
  await ev(() => { window.tide.talk('pell'); window.bot.readAll(); });
  check((await status('hb-10-turning')) === 'done', 'Pell hears of the Turning');
  await ev(() => { if (window.__MW__.game.town.dialogue.isOpen) window.bot.choose('Bye'); });
  r = await ev(() => { window.tide.talk('mara'); const g = window.__MW__.game; g.town.dialogue.advance(); const first = document.querySelector('.dlg-text')?.textContent ?? ''; return { first, turned: window.__MW__.quests.npc('mara').turned }; });
  check(r.turned.includes(r.first), `Mara opens with a line about nearly knowing the keeper ("${r.first.slice(0, 50)}…")`);
  await shot('21-mara-after-the-turning');
  r = await ev(() => { window.bot.choose('Bye'); window.bot.interact(); window.__MW__.game.town.dialogue.advance(); const again = document.querySelector('.dlg-text')?.textContent ?? ''; window.bot.choose('Bye'); return { again, turned: window.__MW__.quests.npc('mara').turned }; });
  check(!r.turned.includes(r.again), 'and says it only once');

  // 19. Save, reload: the second tide is still the second tide.
  await ev(() => window.__MW__.game.save());
  await page.goto(`http://localhost:${port}/?notitle&quality=low&keepfresh`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 1, null, { timeout: 180000 });
  r = await ev(() => { const s = window.__MW__.state; return { v: s.version, run: s.run.number, echoes: s.echoes, tidewise: s.echoUpgrades.tidewise, owned: s.pots.owned, done: s.quests.done.length, worn: s.gear.worn }; });
  check(r.v === 4 && r.run === 2 && r.tidewise === 1 && r.owned === 2 && r.done === 12, `the reload keeps the second tide (${JSON.stringify(r)})`);
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);

  if (problems.length) { console.error(`TIDE FAILED: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`); await browser.close(); process.exit(1); }
  console.log('TIDE OK');
  await browser.close();
})();
