// Things-fished-up bot: the v0.6.0 tester's start (?tester=finds, src/data/tester/finds.json), through the real game.
// The keeper stands at the end of the home dock at nightfall with four relics, three Moonpearls never set and
// every rumour still to hear. She hears the rumours, reads the Keeper's Shelf, sets and lifts pearls, hauls a
// crate (missing the first strike, reeling through one knock into a snag and easing off at the next), hauls a
// sea chest for its pearl and its lure, breaks the line on one she is too greedy with, fishes the keeper's
// spectacles out of Lantern Cove by night with nothing forced (after three casts reeled straight in, which
// throw no dice), catches a fish to see that fish still bite, and last the game is started with its title card
// up to see that no rumour is told behind it.
// Exits 1 on any failure. Usage: node e2e/finds.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/finds';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
  const shot = async (name, frames = 8) => {
    await page.evaluate((n) => { const g = window.__MW__.game; g.skipRender = false; for (let i = 0; i < n; i++) g.presentOnce(1 / 30); g.skipRender = true; }, frames);
    await page.waitForTimeout(700);
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.goto(`http://localhost:${port}/?tester=finds&notitle&hour=21&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    g.paused = true; g.halted = true; g.skipRender = true;
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    const HOLD = { ...NO, primary: true };
    /** A careful hand: off the reel at the knock, while it is caught, and when the line is tight. */
    const careful = (gg) => { const h = gg.session.haul; return h ? { ...NO, primary: !h.snag && !h.warned && h.tension < 0.7 } : NO; };
    window.fb = {
      NO, HOLD, careful,
      /** Everything the game has said in a toast, in order (toasts fade; this does not). */
      said: [],
      /** Game time, presented (not drawn) as it goes, so the float and the line keep up. `until` stops it early. */
      run(seconds, policy, until) { for (let t = 0; t < seconds; t += 1 / 60) { g.simulate(1 / 60, policy ?? (() => NO)); g.presentOnce(1 / 60); if (until && until()) return t; } return seconds; },
      /** Charge to `power` and let go; returns once the float is on the water (or the cast came to nothing). */
      cast(power = 0.9) {
        g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
        let k = 0; while (g.session.phase === 'charging' && g.session.power < power && k++ < 300) g.simulate(1 / 60, () => HOLD);
        g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
        this.run(8, null, () => g.session.phase !== 'casting');
        return g.session.phase;
      },
      strike() { g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true })); g.presentOnce(1 / 60); return g.session.phase; },
      reelIn() { g.simulate(1 / 60, () => ({ ...NO, cancel: true })); this.run(1.5); return g.session.phase; },
      /** Haul with a careful hand until it is aboard or gone. */
      haulIn() { const t = this.run(90, careful, () => g.session.phase !== 'hauling'); this.run(0.4); return t; },
      card() { const c = document.querySelector('.catch-card'); return { cls: c?.className ?? '', text: c?.innerText ?? '' }; },
      fight() { const f = document.querySelector('.fight'); return { cls: f.className, label: f.querySelector('.fight-label').textContent, stamina: getComputedStyle(f.querySelector('.stamina')).display }; },
      bait: () => s.gear.baits[s.gear.bait],
      /** The Shelf page as the player reads it. */
      shelf() {
        g.town.openScreen('shelf');
        const places = [...document.querySelectorAll('.place')].map((e) => ({ state: e.classList.contains('found') ? 'found' : e.classList.contains('rumour') ? 'rumour' : 'empty', name: e.querySelector('b')?.textContent ?? '', gift: e.querySelector('.item-blurb')?.textContent ?? '', pearls: e.querySelectorAll('.hollow.on').length, open: e.querySelectorAll('.hollow:not(.on):not(:disabled)').length }));
        return { tabs: [...document.querySelectorAll('.sc-tab')].map((t) => t.textContent), head: document.querySelector('.shelf-head')?.innerText ?? '', inHand: document.querySelector('.shelf-n')?.textContent ?? '', places };
      },
      /** Click a hollow beside the relic of that name: an empty one sets a pearl, a filled one lifts it. */
      hollow(name, filled) {
        const place = [...document.querySelectorAll('.place.found')].find((e) => e.querySelector('b')?.textContent === name);
        const b = place?.querySelector(filled ? '.hollow.on' : '.hollow:not(.on)');
        if (!b || b.disabled) return false;
        b.click(); return true;
      },
    };
    const toast = g.hud.toast.bind(g.hud);
    g.hud.toast = (text, kind, hold) => { window.fb.said.push(text); return toast(text, kind, hold); };
  });
  const said = (re) => ev((src) => window.fb.said.some((t) => new RegExp(src).test(t)), re.source);

  // 1. Who she is.
  let r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state; g.presentOnce(1 / 30);
    const at = g.pos, dir = [Math.sin(g.yaw), Math.cos(g.yaw)];
    const zone = (d) => MW.quests && g.world.region.zones.filter((z) => Math.hypot(at.x + dir[0] * d - z.x, at.z + dir[1] * d - z.z) <= z.r).sort((a, b) => b.priority - a.priority)[0]?.id;
    return { start: MW.testerStart, version: s.version, relics: [...s.relics], pearls: s.moonpearls, set: Object.keys(s.pearls).length, finds: { ...s.finds }, boat: s.boats.current, crew: s.crew.hired.length,
      hour: s.hour, catches: s.lifetime.catches, missing: MW.assetsMissing, onDock: g.groundAt(at.x, at.z) !== null, zone16: zone(16), zone24: zone(24), rumours: s.flags.filter((f) => f.startsWith('rumour:')).length };
  });
  check(r.start === 'finds' && r.version === 6 && r.relics.length === 4 && r.pearls === 3 && r.set === 0 && r.finds.casts === 0 && r.finds.crates + r.finds.chests === 0 && r.boat === 'puffin' && r.crew === 2,
    `the finds start: save version ${r.version}, ${r.relics.length} relics, ${r.pearls} pearls and none set, nothing ever fished up, the ${r.boat} afloat with ${r.crew} hands`);
  check(r.onDock && r.zone24 === 'hb-bay' && r.hour >= 20 && r.rumours === 0, `she stands at the end of the dock at ${r.hour.toFixed(1)} h, a good cast from Lantern Cove (${r.zone16} at 16 m, ${r.zone24} at 24 m), no rumour heard yet`);
  check(Array.isArray(r.missing) && r.missing.length === 0, `no model is missing (${JSON.stringify(r.missing)})`);

  // 2. The rumours reach her while she stands there.
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.fb.run(5); return { flags: s.flags.filter((f) => f.startsWith('rumour:')), said: [...window.fb.said] }; });
  check(r.flags.length === 8 && r.said.some((t) => /8 rumours have reached you/.test(t)) && r.said.some((t) => /on the Shelf, in your satchel/.test(t)), `eight rumours reach her within a few seconds, and she is told where to read them (${r.said.length} lines said)`);

  // 3. The Keeper's Shelf, and pearls set and lifted.
  r = await ev(() => { const g = window.__MW__.game; const before = g.stats.value; const page = window.fb.shelf(); return { page, before }; });
  let found = r.page.places.filter((p) => p.state === 'found'), rumour = r.page.places.filter((p) => p.state === 'rumour');
  check(r.page.tabs.includes('Shelf') && r.page.places.length === 12 && found.length === 4 && rumour.length === 8 && /4 of 12/.test(r.page.head) && r.page.inHand.trim() === '3',
    `the Shelf page: ${found.length} relics standing, ${rumour.length} places with something said of them, ${r.page.inHand.trim()} pearls in hand`);
  check(found.every((p) => p.pearls === 0 && p.open === 2 && p.gift) && rumour.every((p) => /water|given/.test(p.name)), `every relic there has its gift in words and two empty hollows (${found.map((p) => p.gift).join('; ')})`);
  await shot('01-shelf', 4);
  const valueWas = r.before;
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, fb = window.fb;
    const a = fb.hollow("Calloway's Tape Measure", false), one = { n: s.pearls['calloway-tape'] ?? 0, value: g.stats.value, page: fb.shelf() };
    const b = fb.hollow("Calloway's Tape Measure", false), two = { n: s.pearls['calloway-tape'] ?? 0, value: g.stats.value, page: fb.shelf() };
    const c = fb.hollow("Wick's Drawing", false), three = { set: MW_set(), page: fb.shelf() };
    function MW_set() { return window.__MW__.relics.pearlsSet(s); }
    // Nothing left in hand: no hollow can be filled, and a third pearl cannot go beside a relic that has two.
    const d = fb.hollow("The Keeper's Kettle", false);
    // Lifted out again, it is in hand to set somewhere else.
    const e = fb.hollow("Wick's Drawing", true), lifted = { n: s.pearls['wicks-drawing'] ?? 0, free: window.__MW__.relics.pearlsFree(s), page: fb.shelf() };
    const f = fb.hollow("The Keeper's Kettle", false), moved = { kettle: s.pearls['keepers-kettle'] ?? 0, bite: g.stats.biteSpeed, page: fb.shelf() };
    return { a, b, c, d, e, f, one, two, three, lifted, moved, pearls: s.moonpearls };
  });
  const tape = (pg) => pg.places.find((p) => p.name === "Calloway's Tape Measure");
  check(r.a && r.one.n === 1 && r.one.value > valueWas + 0.02 && /9%/.test(tape(r.one.page).gift) && r.one.page.inHand.trim() === '2', `a pearl set beside the tape measure: fish sell for 9% more, not 6 (value ×${valueWas.toFixed(2)} to ×${r.one.value.toFixed(2)}), two left in hand`);
  check(r.b && r.two.n === 2 && /12%/.test(tape(r.two.page).gift) && tape(r.two.page).open === 0, `a second beside it: 12%, and it has no hollow left ("${tape(r.two.page).gift}")`);
  check(r.c && r.three.set === 3 && r.three.page.inHand.trim() === '0' && !r.d, 'with the third set there is none in hand, and an empty hollow does nothing');
  check(r.e && r.lifted.n === 0 && r.lifted.free === 1 && r.f && r.moved.kettle === 1 && r.pearls === 3, `a pearl lifted from the drawing is in hand again and goes beside the kettle: set, not spent (${r.pearls} pearls still hers)`);
  await shot('02-shelf-pearls', 4);
  await ev(() => window.__MW__.game.town.closeScreens());

  // 4. A crate comes down under the float: no nibble, no shadow, and the float is drawn under slowly.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, fb = window.fb;
    g.camYaw = g.yaw; fb.run(0.3);
    const before = { coins: s.coins, bait: fb.bait(), rhythm: s.rhythm, catches: s.lifetime.catches, casts: s.finds.casts };
    g.forcedFind = MW.finds.offerOf('crate', 'hearthbay', 240);
    const landed = fb.cast(0.9);
    const finding = g.session.finding ? { ...g.session.finding } : null, noBiteDue = g.session.biteIn === Infinity;
    let stalker = 0;
    const waited = fb.run(40, null, () => { if (g.shadows.biter.mode === 'stalk') stalker++; return g.session.phase === 'bite'; });
    // How far under the water's own surface the float is: the swell lifts and drops it by more than a find draws it down.
    const under = () => g.waveY(g.view.bobberPos.x, g.view.bobberPos.z) - g.view.bobberPos.y;
    const y0 = under();
    fb.run(1.4);
    const el = document.querySelector('.bite');
    return { before, landed, finding, noBiteDue, stalker, waited, phase: g.session.phase, sank: under() - y0, heavy: el.classList.contains('heavy') && el.classList.contains('on'), hint: document.querySelector('.hint')?.textContent ?? '', casts: s.finds.casts };
  });
  const before = r.before;
  check(r.landed === 'waiting' && r.finding?.kind === 'crate' && r.noBiteDue && r.stalker === 0, 'the float lands over a crate: nothing alive comes to it (no shadow stalks, no bite is due)');
  check(r.phase === 'bite' && r.sank > 0.15 && r.heavy && /Something heavy/.test(r.hint), `after ${r.waited.toFixed(1)} s the float is drawn under slowly (${r.sank.toFixed(2)} m in 1.4 s), the mark says heavy and the hint says "${r.hint.trim()}"`);
  check(await said(/float is going down slowly/), 'the first time, she is told what a slow float means');
  await shot('03-drag');

  // 5. She is too slow: it slides off, and is still there. The second time she strikes.
  r = await ev(() => {
    const g = window.__MW__.game, fb = window.fb;
    const t = fb.run(4, null, () => g.session.phase !== 'bite');
    const slipped = { phase: g.session.phase, finding: g.session.finding?.kind ?? null, t };
    const again = fb.run(8, null, () => g.session.phase === 'bite');
    fb.run(0.5);
    const phase = fb.strike();
    fb.run(0.8, fb.careful);
    return { slipped, again, phase, haul: g.session.haul ? { ...g.session.haul, find: g.session.haul.find.kind } : null, fight: fb.fight(), bait: fb.bait(), hint: document.querySelector('.hint')?.textContent ?? '' };
  });
  // (She had already watched it for 1.4 s. The time to strike is 2.6 s and what her gear adds to it.)
  check(r.slipped.phase === 'waiting' && r.slipped.finding === 'crate' && r.slipped.t + 1.4 > 2.5 && r.slipped.t + 1.4 < 4 && (await said(/it has settled again\. It is still down there/)), `left alone for ${(r.slipped.t + 1.4).toFixed(1)} s it settles again, and is still down there`);
  check(r.again > 2 && r.again < 5 && r.phase === 'hauling' && r.haul?.find === 'crate', `${r.again.toFixed(1)} s later the float goes down again, and the strike has it`);
  check(/haul/.test(r.fight.cls) && /on/.test(r.fight.cls) && r.fight.stamina === 'none' && /Haul it up/.test(r.fight.label) && r.bait === before.bait && /haul it up/.test(r.hint), `the gauge is the haul's (tension and line, no fish to tire: "${r.fight.label}"), and no bait went with the strike`);
  check((await said(/Something heavy!/)) && (await said(/let go when you feel it knock/)), 'she is told it is heavy, and the first time how to bring it up');
  await shot('04-haul');

  // 6. The knock, reeled through: it catches, and gives no line until the reel is let alone.
  r = await ev(() => {
    const g = window.__MW__.game, fb = window.fb, h = () => g.session.haul;
    const rest = (gg) => (gg.session.haul.tension < 0.6 ? fb.HOLD : fb.NO);
    const toKnock = fb.run(30, rest, () => !h() || h().warned);
    const knock = { warned: !!h()?.warned, label: fb.fight().label, tension: h()?.tension };
    fb.run(1.2, () => fb.HOLD, () => !h() || h().snag);
    const snag = { on: !!h()?.snag, label: fb.fight().label, d: h()?.distance, tension: h()?.tension };
    fb.run(0.3, () => fb.HOLD);
    const held = { d: h()?.distance, tension: h()?.tension, phase: g.session.phase };
    return { toKnock, knock, snag, held };
  });
  check(r.knock.warned && /knocks/.test(r.knock.label), `after ${r.toKnock.toFixed(1)} s of reeling it knocks on the bottom ("${r.knock.label}")`);
  check(r.snag.on && /Caught on the bottom/.test(r.snag.label) && r.held.phase === 'hauling' && Math.abs(r.held.d - r.snag.d) < 0.01 && r.held.tension > r.snag.tension + 0.02 && (await said(/caught on the bottom/)),
    `reeled through, it catches: no line comes in (${r.snag.d.toFixed(2)} m) and the tension climbs (${r.snag.tension.toFixed(2)} to ${r.held.tension.toFixed(2)})`);
  await shot('05-snag');
  r = await ev(() => {
    const g = window.__MW__.game, fb = window.fb, h = () => g.session.haul;
    const free = fb.run(2, null, () => !h().snag);
    // The next knock she lets go at: it slides over, and nothing catches.
    const rest = (gg) => (gg.session.haul.tension < 0.6 ? fb.HOLD : fb.NO);
    fb.run(30, rest, () => !h() || h().warned || h().distance < 3.2);
    const knocked = !!h()?.warned;
    if (knocked) fb.run(1.5, null, () => !h().warned);
    return { free, knocked, snag: !!h()?.snag, d: h()?.distance, phase: g.session.phase };
  });
  check(r.free > 0.3 && r.free < 0.7 && r.phase === 'hauling', `the reel let alone for ${r.free.toFixed(2)} s, it comes free`);
  check(!r.knocked || !r.snag, r.knocked ? 'at the next knock she lets go, and it slides over without catching' : `no second knock before it was in clear water (${r.d?.toFixed(1)} m)`);
  // Lifted clear of the water under the rod's tip, then aboard.
  r = await ev(() => { const g = window.__MW__.game, fb = window.fb; fb.run(60, fb.careful, () => !g.session.haul || g.session.haul.distance < 2.1); const h = g.session.haul; return h ? { d: h.distance, up: g.view.hooked.y - g.waveY(g.view.hooked.x, g.view.hooked.z) } : null; });
  check(!!r && r.up > 0.4, `in the last metres it is swung up out of the water (${r ? r.up.toFixed(2) : '?'} m clear at ${r ? r.d.toFixed(1) : '?'} m)`);
  await shot('06-lifted');
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, fb = window.fb;
    fb.haulIn();
    return { phase: g.session.phase, coins: s.coins, bait: fb.bait(), baits: { ...s.gear.baits }, rhythm: s.rhythm, catches: s.lifetime.catches, crates: s.finds.crates, card: fb.card(), shown: !!g.shown, hold: s.hold.length };
  });
  check(r.crates === 1 && r.coins >= before.coins + 18 && r.catches === before.catches && r.rhythm === before.rhythm, `the crate is aboard: ◉ ${r.coins - before.coins} in it, and it is not a catch (the tally and the Rhythm are as they were)`);
  check(/find/.test(r.card.cls) && /crate/.test(r.card.cls) && /on/.test(r.card.cls) && /A drift crate/.test(r.card.text) && /◉/.test(r.card.text) && r.shown, `she holds it up, and the card says what was in it ("${r.card.text.replace(/\n/g, ' / ').slice(0, 90)}")`);
  await shot('07-crate', 20);
  const afterCrate = r;

  // 7. A sea chest: a pearl, and the first one of a water always has its piece of gear in it.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, fb = window.fb;
    fb.run(4);
    const was = { pearls: s.moonpearls, lures: [...s.gear.lures], coins: s.coins };
    g.forcedFind = MW.finds.offerOf('chest', 'hearthbay', 240);
    fb.cast(0.9); fb.run(40, null, () => g.session.phase === 'bite'); fb.run(0.6); fb.strike();
    const t = fb.haulIn();
    return { was, t, pearls: s.moonpearls, lures: [...s.gear.lures], coins: s.coins, chests: s.finds.chests, card: fb.card(), free: MW.relics.pearlsFree(s) };
  });
  check(r.chests === 1 && r.pearls === r.was.pearls + 1 && r.free === 1 && r.lures.includes('mirror-spoon') && !r.was.lures.includes('mirror-spoon') && r.coins >= r.was.coins + 90,
    `a sea chest, hauled in ${r.t.toFixed(0)} s: ◉ ${r.coins - r.was.coins}, a Moonpearl (one in hand now) and the Mirror Spoon`);
  check(/chest/.test(r.card.cls) && /Moonpearl/.test(r.card.text) && /Mirror Spoon/.test(r.card.text) && (await said(/A Moonpearl\. Set it beside a relic/)), `the card lists them ("${r.card.text.replace(/\n/g, ' / ').slice(0, 110)}")`);
  await shot('08-chest', 20);

  // 8. Greed: the reel never let go. The line breaks, the thing goes back down, and the Rhythm with it.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, fb = window.fb;
    fb.run(4);
    s.rhythm = 3;
    const was = { coins: s.coins, snaps: s.lifetime.snaps, chests: s.finds.chests };
    g.forcedFind = MW.finds.offerOf('chest', 'mossglass-fen', 240);
    fb.cast(0.9); fb.run(40, null, () => g.session.phase === 'bite'); fb.run(0.6); fb.strike();
    const t = fb.run(90, () => fb.HOLD, () => g.session.phase !== 'hauling');
    fb.run(3);
    return { was, t, phase: g.session.phase, coins: s.coins, snaps: s.lifetime.snaps, chests: s.finds.chests, rhythm: s.rhythm };
  });
  check(r.t < 60 && r.snaps === r.was.snaps + 1 && r.coins === r.was.coins && r.chests === r.was.chests && r.rhythm === 0 && (await said(/Snap!/)) && r.phase === 'idle',
    `a heavy chest reeled without a rest: the line breaks in ${r.t.toFixed(0)} s, nothing is gained and the Rhythm is broken`);

  // 9. The keeper's spectacles, where Wick said: Lantern Cove, at night, nothing forced. First three casts reeled
  // straight back in: they throw no dice, and each comes down over the same thing. Then she fishes: a fish is
  // hooked and played, anything else is hauled, and each of those casts is counted.
  r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state, fb = window.fb;
    fb.run(3);
    const byDay = MW.relics.relicsHere(s, 'hearthbay', 'hb-bay', 12).map((x) => x.id), byNight = MW.relics.relicsHere(s, 'hearthbay', 'hb-bay', s.hour).map((x) => x.id), offDock = MW.relics.relicsHere(s, 'hearthbay', 'hb-dock', s.hour).map((x) => x.id);
    const strange = g.stats.strange, relics = s.relics.length, counted = s.finds.casts;
    // Cast and reel straight in, three times over.
    const peeked = [], dice = JSON.stringify(s.finds);
    for (let i = 0; i < 3; i++) { s.hour = 21.5; if (fb.cast(0.9) === 'waiting') peeked.push(g.session.finding ? g.session.finding.id : 'fish'); fb.reelIn(); }
    const idle = { same: peeked.length === 3 && new Set(peeked).size === 1, what: peeked[0], unmoved: JSON.stringify(s.finds) === dice };
    let casts = 0; const came = [];
    while (!s.relics.includes('isoldes-spectacles') && casts < 14) {
      s.hour = 21.5;
      if (s.hold.length >= g.holdCapacity - 1) s.hold.length = 0;
      if (fb.cast(0.9) !== 'waiting') { fb.run(2); continue; }
      casts++;
      const f = g.session.finding;
      came.push(!f ? 'fish' : f.kind === 'relic' ? f.id : f.kind);
      fb.run(45, null, () => g.session.phase === 'bite');
      if (!f) {
        fb.run(0.15); fb.strike();
        fb.run(120, (gg) => { const x = gg.session.fight; return x ? { ...fb.NO, primary: x.thrash <= 0 && x.tension < 0.7, steer: x.run ? -x.run : 0 } : fb.NO; }, () => g.session.phase !== 'fighting');
        fb.run(3.5);
        continue;
      }
      fb.run(0.5); fb.strike(); fb.haulIn();
      if (!s.relics.includes('isoldes-spectacles')) fb.run(3.5);
    }
    return { byDay, byNight, offDock, idle, casts, came, counted: s.finds.casts - counted, relics: s.relics.length - relics, strange: g.stats.strange - strange, card: fb.card(), near: { ...s.finds.near }, page: fb.shelf() };
  });
  check(r.byNight.includes('isoldes-spectacles') && !r.byDay.includes('isoldes-spectacles') && !r.offDock.includes('isoldes-spectacles'), 'the spectacles lie in Lantern Cove by night: not there by day, and not under the dock at any hour');
  check(r.idle.same && r.idle.unmoved, `three casts reeled straight back in throw no dice: each came down over the same thing (${r.idle.what}) and the save's count did not move`);
  check(r.relics === 1 && r.casts <= 12 && r.came.includes('isoldes-spectacles') && r.counted === r.casts, `fished for there after dark, they come up on cast ${r.casts}, every cast that hooked a fish or brought something up counted in the save (what came up: ${r.came.join(', ')})`);
  check(/relic/.test(r.card.cls) && /The Keeper's Spectacles/.test(r.card.text) && /Strange fish/.test(r.card.text) && Math.abs(r.strange - 0.01) < 1e-6 && r.near['isoldes-spectacles'] === undefined,
    `the card names them and their gift, and the gift is hers at once (${(r.strange * 100).toFixed(0)}% more Strange fish)`);
  found = r.page.places.filter((p) => p.state === 'found');
  check(found.length === 5 && /5 of 12/.test(r.page.head) && found.some((p) => p.name === "The Keeper's Spectacles") && (await said(/stands on the Shelf now/)), `they stand on the Shelf: ${found.length} of 12 places filled`);
  await ev(() => window.__MW__.game.town.closeScreens());
  await shot('09-relic', 12);
  await ev(() => { window.__MW__.game.town.openScreen('shelf'); });
  await shot('10-shelf-after', 4);
  await ev(() => window.__MW__.game.town.closeScreens());

  // 10. Fish still bite, and are still fish.
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, fb = window.fb;
    fb.run(5);
    const was = { catches: s.lifetime.catches, bait: fb.bait(), casts: s.finds.casts };
    let tries = 0;
    while (s.lifetime.catches === was.catches && tries++ < 4) {
      if (s.hold.length >= g.holdCapacity - 1) s.hold.length = 0;
      g.forcedFind = null;
      fb.cast(0.9);
      if (g.session.finding) return { bad: 'a find, with fish forced' };
      fb.run(45, null, () => g.session.phase === 'bite'); fb.run(0.15); fb.strike();
      fb.run(120, (gg) => { const f = gg.session.fight; return f ? { ...fb.NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 } : fb.NO; }, () => g.session.phase !== 'fighting');
      fb.run(1);
    }
    return { caught: s.lifetime.catches - was.catches, tries, card: fb.card(), casts: s.finds.casts - was.casts, fight: fb.fight() };
  });
  check(!r.bad && r.caught === 1 && !/find/.test(r.card.cls) && r.casts === 0, `a fish, played and landed as ever (${r.tries} cast${r.tries === 1 ? '' : 's'}; a cast a bot decides is not counted against the save's dice): "${(r.card?.text ?? '').split('\n')[1] ?? r.bad}"`);
  check(!/haul/.test(r.fight?.cls ?? 'haul'), 'the gauge is the fight\'s again');

  // 11. With the title card up (as the game is started by a person), nothing is told behind it: the rumours
  // wait for the click, and are told a moment after it.
  await page.goto(`http://localhost:${port}/?tester=finds&hour=21&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state;
    g.paused = true; g.halted = true; g.skipRender = true;
    window.said2 = [];
    const toast = g.hud.toast.bind(g.hud);
    g.hud.toast = (text, kind, hold) => { window.said2.push(text); return toast(text, kind, hold); };
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    window.run2 = (sec) => { for (let t = 0; t < sec; t += 1 / 60) g.simulate(1 / 60, () => NO); };
    window.run2(20);
    return { titled: document.body.classList.contains('titled'), card: !!document.querySelector('.title'), behind: g.behindTitle, rumours: s.flags.filter((f) => f.startsWith('rumour:')).length, said: [...window.said2] };
  });
  check(r.titled && r.card && r.behind && r.rumours === 0 && !r.said.some((x) => /rumour/i.test(x)), `twenty seconds behind the title card: no rumour is told and none is marked as told (${r.rumours} marked, ${r.said.length} messages)`);
  await page.click('.title');
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state;
    window.run2(4);
    return { titled: document.body.classList.contains('titled'), behind: g.behindTitle, rumours: s.flags.filter((f) => f.startsWith('rumour:')).length, said: [...window.said2] };
  });
  check(!r.titled && !r.behind && r.rumours === 8 && r.said.some((x) => /8 rumours have reached you/.test(x)) && r.said.some((x) => /on the Shelf, in your satchel/.test(x)), `after the click the eight rumours are told, with where to read them (${r.rumours} marked)`);

  check(errors.length === 0, `no errors on the page (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  console.log(problems.length ? `\nFINDS FAILED (${problems.length}):\n - ${problems.join('\n - ')}` : '\nFINDS OK');
  process.exit(problems.length ? 1 : 0);
})();
