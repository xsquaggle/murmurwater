// Saltbone Reach bot: the v0.7.0 tester's start (?tester=reach, src/data/tester/reach.json), through the real game.
// The keeper has the Puffin afloat, both hands aboard and Pell's whale-road job. First she takes the skiff out to
// the whale-road and is turned back by its swell; then the Puffin takes it, and the waters change to the Reach
// half way along. At Tryworks Landing Captain Oake takes Pell's message and has work: eight fish of the Reach,
// for her almanac, which then shows on the screen. With the next storm due the cone goes up the mast on the quay.
// Out at the Ribs she reads the plate on the ninth rib from the boat. Then the Deacon comes up: the hands go
// below, bolts go into the sea near her and leave the water struck, a cast into struck water is marked so and
// puts it out when a fish is hooked; the eye comes over and the hands fish again; the eye closes and the storm
// blows out, and she is told what comes next. Last, a save made in the Reach loads in the Reach.
// Exits 1 on any failure. Usage: node e2e/reach.cjs [outdir]
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/reach';
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
  const q = `quality=${process.env.MW_QUALITY || 'medium'}`;
  const REACH_FISH = /^(bonefin-herring|slate-pout|thrift-wrasse|ribfish|kettle-cod|squall-mackerel|lantern-ling|thunderback|old-greyback|the-lull)$/;
  // The whale-road, Hearthbay's end to the Reach's.
  const A = [404.5, -293.9], B = [736.5, -535.1];
  const at = (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];

  await page.goto(`http://localhost:${port}/?tester=reach&notitle&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await require('./sail-helpers.cjs').install(page, { grant: false });
  await require('./fog-helpers.cjs').install(page);
  // What this bot adds to the helpers: the hour, what has been said, the Crew page, the weather pill, a cast.
  await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state;
    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    window.reach = {
      hour(h) { s.hour = h; g.world.hour = h; g.rushSky?.(0); window.fog.wait(1); },
      said: [],
      events: [],
      /** Everything said since `n` toasts ago, as one string. */
      since(n) { return window.reach.said.slice(n).join(' | '); },
      page() {
        g.town.openScreen('crew');
        const hands = Object.fromEntries([...document.querySelectorAll('.item.hand')].map((e) => [e.querySelector('.item-top b').firstChild.textContent, e.querySelector('.have').textContent]));
        g.town.closeScreens();
        return hands;
      },
      pill() { g.presentOnce(1 / 30); const p = document.querySelector('.pill.weather'); return { text: p?.textContent ?? '', shown: !!p && p.style.display !== 'none' && !p.hidden, cls: p?.className ?? '' }; },
      /** Walk up to somebody and hear them out. Returns the choices they end on. */
      hub(id, starts) {
        const p = window.bot.npc(id); window.bot.walk(p.x, p.z, 40, () => (g.town.focusPrompt ?? '').startsWith(starts));
        if (!window.bot.interact()) return null;
        return window.bot.readAll();
      },
      /** Who sits where, and whether they can be seen. */
      berths() { const rig = g.sailing.rig; return [0, 1].map((i) => { const b = rig.berth(i); return b ? b.children.filter((c) => c.visible).length : -1; }); },
      /** Bring her to rest. */
      stop() { const b = g.sailing.boat; g.skipRender = true; for (let k = 0; k < 400 && Math.abs(b.speed) > 0.3; k++) { g.input.simulate('KeyS', b.speed > 0); g.input.simulate('KeyW', b.speed < 0); g.simulate(1 / 30); } g.input.simulate('KeyS', false); g.input.simulate('KeyW', false); window.fog.wait(1.5); g.skipRender = false; return Math.abs(b.speed); },
      /** Face the deepest water a cast away. */
      aimDeep(d = 14) { const p = g.keeperAt(); let best = 0, bd = -1; for (let a = 0; a < 24; a++) { const yaw = (a / 24) * Math.PI * 2; const dd = g.world.hf.depth(p.x + Math.sin(yaw) * d, p.z + Math.cos(yaw) * d); if (dd > bd) { bd = dd; best = yaw; } } g.camYaw = best; g.simulate(0.6); return bd; },
      /** One cast at full charge, played to the end: where it came down, what it came down over, how long the bite took, what was landed. */
      cast(hour, power = 0.88) {
        if (hour !== undefined) s.hour = hour;
        if (s.hold.length >= g.holdCapacity - 1) s.hold.length = 0;
        const n0 = window.reach.events.length;
        g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
        let guard = 0;
        while (g.session.phase === 'charging' && g.session.power < power && guard++ < 200) g.simulate(1 / 60, () => ({ ...NO, primary: true }));
        g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
        guard = 0;
        while (g.session.phase === 'casting' && guard++ < 600) g.simulate(1 / 60, () => NO);
        const spot = { ...g.session.spot }, target = { x: g.view.target.x, z: g.view.target.z };
        let waited = 0;
        while (g.session.phase === 'waiting' && waited < 40) { g.simulate(1 / 60, () => NO); waited += 1 / 60; }
        if (g.session.phase !== 'bite') { g.simulate(1, () => NO); g.botInput = null; return { spot, target, waited, caught: null, phase: g.session.phase }; }
        g.simulate(0.15, () => NO);
        g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
        guard = 0;
        while ((g.session.phase === 'fighting' || g.session.phase === 'hauling') && guard++ < 60 * 60) g.simulate(1 / 60, (gg) => { const f = gg.session.fight, h = gg.session.haul; if (h) return { ...NO, primary: !h.snag && !h.warned && h.tension < 0.7 }; if (!f) return NO; return { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 }; });
        g.simulate(2.6, () => NO);
        g.botInput = null;
        const ev = window.reach.events.slice(n0).find((e) => e.type === 'catch');
        return { spot, target, waited: +waited.toFixed(2), caught: ev?.fishId ?? null, struckCatch: !!ev?.struck };
      },
    };
    const toast = g.hud.toast.bind(g.hud);
    g.hud.toast = (text, kind, ms) => { window.reach.said.push(text); return toast(text, kind, ms); };
    const qe = g.town.questEvent.bind(g.town);
    g.town.questEvent = (e) => { window.reach.events.push(e); return qe(e); };
  });
  const status = (id) => ev((id) => window.bot.status(id), id);
  const said = () => ev(() => window.reach.said.length);

  // 1. Who she is.
  let r = await ev(() => {
    const MW = window.__MW__, g = MW.game, s = g.state; g.presentOnce(1 / 30);
    return { start: MW.testerStart, hour: +s.hour.toFixed(2), boat: s.boats.current, rig: g.sailing.rig?.boatId, hired: s.crew.hired, region: s.world.region,
      goal: document.querySelector('.goal-t')?.textContent ?? '', missing: MW.assetsMissing, pill: window.reach.pill() };
  });
  check(r.start === 'reach' && r.boat === 'puffin' && r.rig === 'puffin' && r.hired.join() === 'biscuit,hollis' && r.region === 'hearthbay', `the Reach's start: at home in the ${r.boat} with ${r.hired.join(' and ')} (${r.hour} h)`);
  check((await status('hb-14-whale-road')) === 'active' && /whale-road|Reach/i.test(r.goal), `Pell's whale-road job is in hand ("${r.goal}")`);
  check(!r.pill.shown, 'with no almanac there is no weather on the screen');
  check(r.missing.length === 0, `no model is missing (${r.missing.join(', ')})`);

  // 2. The skiff on the whale-road: the swell turns her back, and she is told why.
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.reach.hub('pell', 'Talk to Pell'); const ok = window.bot.choose('About the boats'); g.simulate(0.2);
    [...document.querySelectorAll('.item.boat .btn')].find((b) => b.textContent === 'Take her out')?.click(); window.fog.wait(5);
    return { ok, current: s.boats.current, rig: g.sailing.rig.boatId }; });
  check(r.ok && r.current === 'skiff' && r.rig === 'skiff', `Pell brings the skiff round (${j(r)})`);
  r = await ev(([x, z]) => { const b = window.bot.board(); const go = window.bot.sailTo(x, z, { stopR: 8, maxTime: 400 }); return { b, go }; }, A);
  check(r.b.ok && r.go.ok, `the skiff to the near end of the whale-road (${j(r.go)})`);
  let n0 = await said();
  r = await ev(([x, z]) => { const p = window.fog.pilot(x, z, 70, 6); return { p, told: window.reach.said.slice(-6) }; }, at(0.7));
  check(r.p.region === 'hearthbay' && !r.p.swapped && r.p.maxMur > 0.3, `the swell turns the skiff back: she never leaves Hearthbay's water (murmur ${r.p.maxMur.toFixed(2)}, at ${Math.round(r.p.x)}, ${Math.round(r.p.z)})`);
  r = await ev((n) => window.reach.since(n), n0);
  check(/stands the skiff on her end/.test(r), `and the game says why ("${r.slice(0, 120)}")`);
  await shot('01-skiff-turned-back');
  // (Back out of the murmur by the helm first: the route finder plans only through water a boat may sail.)
  r = await ev(([x, z]) => { window.fog.pilot(x, z, 60, 10); const m = window.bot.mooring('hearthbay-dock'); const go = window.bot.sailTo(m.x, m.z, { stopR: 5, maxTime: 400 }); const l = window.bot.land(); return { go, l }; }, A);
  check(r.go.ok && r.l.ok, `home again and ashore (${j(r.go)})`);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; window.reach.hub('pell', 'Talk to Pell'); window.bot.choose('About the boats'); g.simulate(0.2);
    [...document.querySelectorAll('.item.boat .btn')].find((b) => b.textContent === 'Take her out')?.click(); window.fog.wait(5); return { current: s.boats.current, rig: g.sailing.rig.boatId, berths: window.reach.berths() }; });
  check(r.current === 'puffin' && r.berths[0] > 0 && r.berths[1] > 0, `and the Puffin again, both hands aboard (${j(r)})`);

  // 3. The Puffin takes the whale-road: the lights come up, and half way along the waters are the Reach.
  // (The morning again, so that she comes into the Reach by daylight and before the Deacon.)
  r = await ev(([x, z]) => { window.reach.hour(9); const b = window.bot.board(); const go = window.bot.sailTo(x, z, { stopR: 8, maxTime: 400 }); return { b, go }; }, A);
  check(r.b.ok && r.b.prompt === 'Board the Puffin' && r.go.ok, `the Puffin to the near end of the whale-road (${j(r.go)})`);
  r = await ev(([x, z]) => ({ p: window.fog.pilot(x, z, 60, 6), road: window.__MW__.game.world.seaRoad?.alight ?? 0 }), at(0.4));
  check(r.p.region === 'hearthbay' && r.p.maxMur < 0.3 && r.road > 0, `the road opens to her: murmur ${r.p.maxMur.toFixed(2)}, ${r.road} road lights alight`);
  await shot('02-on-the-whale-road');
  r = await ev(([x, z]) => { const p = window.fog.pilot(x, z, 60, 6); const s = window.__MW__.state, g = window.__MW__.game; return { p, swap: g.lastSwap, reached: s.flags.includes('reached:saltbone-reach'), discovered: s.world.discovered }; }, at(0.66));
  check(r.p.region === 'saltbone-reach' && r.p.swapped && r.reached && r.discovered.includes('saltbone-reach'), `half way along, the waters are Saltbone Reach (${j(r.p.swapped)})`);
  check(!!r.swap && r.swap.scene < 500, `and the change itself is short (${j(r.swap)})`);
  r = await ev(([x, z]) => ({ ...window.fog.pilot(x, z, 60, 6), banner: document.querySelector('.banner')?.textContent ?? '', built: window.__MW__.game.world.region.id }), at(1.0));
  check(r.region === 'saltbone-reach' && r.built === 'saltbone-reach' && r.maxMur < 0.3 && /Saltbone Reach/.test(r.banner), `she comes out on the Reach side, and it is named ("${r.banner}")`);
  await shot('03-the-reach');

  // 4. Tryworks Landing: on the chart, and Captain Oake takes Pell's message.
  r = await ev(() => { const s = window.__MW__.state; const m = window.bot.mooring('tryworks-quay'); const go = window.bot.sailTo(m.x, m.z, { stopR: 6, maxTime: 300 }); return { go, charted: s.world.charted.includes('tryworks-landing'), goal: document.querySelector('.goal-t')?.textContent ?? '' }; });
  check(r.go.ok && r.charted, `the route finder knows the Reach's water: to the quay in ${r.go.seconds} s, and Tryworks Landing is on the chart`);
  check((await status('hb-14-whale-road')) === 'ready' && /Oake/.test(r.goal), `the job is to be handed to Captain Oake ("${r.goal}")`);
  r = await ev(() => window.bot.land());
  check(r.ok, `she can be landed at the quay (${j(r)})`);
  await shot('04-tryworks-landing');
  r = await ev(() => { const s = window.__MW__.state, c0 = s.coins; const c = window.reach.hub('oake', 'Talk to Captain'); const who = document.querySelector('.dlg-name')?.textContent ?? ''; return { c, who, paid: s.coins - c0 }; });
  check(/Oake/.test(r.who) && (await status('hb-14-whale-road')) === 'done' && r.paid === 2000, `Captain Oake takes Pell's message and pays ${r.paid} coins (${r.who})`);
  await shot('05-captain-oake', 4);
  r = await ev(() => { const g = window.__MW__.game; if (!g.town.dialogue.isOpen) window.bot.interact(); const c = window.bot.readAll(); window.bot.choose('do it'); return c; });
  check((await status('reach-01-hours')) === 'active', `and asks for eight fish of the Reach (${r.join(' | ')})`);
  await ev(() => { const g = window.__MW__.game; if (g.town.dialogue.isOpen) window.bot.choose('Bye'); });

  // 5. Eight fish off the end of the quay, for the almanac; and then the weather is on the screen.
  r = await ev(() => {
    const g = window.__MW__.game, s = g.state, end = g.world.dockEnd;
    window.bot.walk(end.x, end.z, 30, () => Math.hypot(g.pos.x - end.x, g.pos.z - end.z) < 1.2);
    g.camYaw = g.world.region.landmarks.dock.rot ?? 0; window.fog.wait(0.6);
    const got = [];
    for (let i = 0; i < 24 && window.bot.status('reach-01-hours') !== 'ready'; i++) { const c = window.reach.cast(12); if (c.caught) got.push(c.caught); }
    return { got };
  });
  check((await status('reach-01-hours')) === 'ready' && r.got.length >= 8 && r.got.every((id) => REACH_FISH.test(id)), `eight fish of the Reach off the quay (${r.got.join(', ')})`);
  r = await ev(() => { const s = window.__MW__.state; window.reach.hour(12.2); const c = window.reach.hub('oake', 'Talk to Captain'); const g = window.__MW__.game; const after = g.town.dialogue.isOpen ? window.bot.readAll() : []; const took = after.some((x) => /do it/.test(x)) && window.bot.choose('do it'); if (g.town.dialogue.isOpen) window.bot.choose('Bye'); window.fog.wait(1); return { almanac: s.flags.includes('almanac'), took, pill: window.reach.pill() }; });
  check((await status('reach-01-hours')) === 'done' && r.almanac, 'Oake takes the fish and gives the keeper her almanac');
  check(r.pill.shown && /^☁?\s*Fair · the Deacon in \d+ min/.test(r.pill.text), `and the weather is on the screen ("${r.pill.text}")`);
  check((await status('reach-02-ribs')) === 'active', 'she has the next job: the plate on the ninth rib');
  r = await ev(() => { const g = window.__MW__.game; g.town.openScreen('chart'); const rows = [...document.querySelectorAll('.chart-storm')].map((e) => e.textContent); g.town.closeScreens(); return rows; });
  check(r.length === 3 && /Old Margit/.test(r[0]) && /half past five in the morning/.test(r[0]) && /The Deacon/.test(r[1]) && /eye from half past three in the afternoon/.test(r[1]) && /Little Wren/.test(r[2]), `the chart has the almanac's page: three storms and their hours (${r.join(' | ').slice(0, 160)})`);
  // With a storm due within the hour, the cone goes up the mast on the quay.
  r = await ev(() => { const g = window.__MW__.game; const w = g.world; const y0 = w.cone ? w.cone.obj.position.y : null; window.reach.hour(13.3); window.fog.wait(5); return { had: y0 !== null, up: w.cone ? +(w.cone.obj.position.y - w.cone.y0).toFixed(2) : null, pill: window.reach.pill().text }; });
  check(r.had && r.up > 2, `with the Deacon due, the storm cone is up the mast (${r.up} m; "${r.pill}")`);
  await shot('06-cone-up');

  // 6. The Ribs, from the boat: the plate on the ninth rib.
  // (Noon again: the sail to the Ribs takes an hour and a quarter of the day, and the Deacon is for step 7.)
  r = await ev(() => { const g = window.__MW__.game, end = g.world.dockEnd; window.reach.hour(12.3); window.bot.walk(end.x, end.z, 30, () => Math.hypot(g.pos.x - end.x, g.pos.z - end.z) < 1.2); const b = window.bot.board(); const go = window.bot.sailTo(1174, -937.4, { stopR: 5, maxTime: 300, until: () => (window.__MW__.game.town.focusPrompt ?? '').startsWith('Read the plate') }); window.reach.stop(); return { b, go, prompt: window.__MW__.game.town.focusPrompt }; });
  check(r.b.ok && r.go.ok && /Read the plate/.test(r.prompt ?? ''), `to the ninth rib, where the plate can be read from the boat (${j(r.go)}, "${r.prompt}")`);
  n0 = await said();
  await ev(() => window.bot.tap('KeyE'));
  await page.waitForTimeout(6200);
  r = await ev((n) => ({ told: window.reach.since(n), flag: window.__MW__.state.flags.includes('rib-read') }), n0);
  check(r.flag && /in for nine, out for nine/.test(r.told), `and what is cut there is told ("${r.told.slice(0, 160)}")`);
  await shot('07-the-ribs');

  // 7. The Deacon comes up: she is told, the hands go below, and the weather on the screen says so.
  r = await ev(() => { window.reach.aimDeep(); const n = window.reach.said.length; window.reach.hour(13.95); window.fog.wait(6); const g = window.__MW__.game;
    return { told: window.reach.since(n), w: { storm: g.storms.weather.storm?.id ?? null, power: +g.storms.weather.power.toFixed(2), thunder: g.storms.weather.thunder }, pill: window.reach.pill(), hands: window.reach.page(), berths: window.reach.berths(), hour: +window.__MW__.state.hour.toFixed(2) }; });
  check(r.w.storm === 'deacon' && /The Deacon is coming up/.test(r.told), `at two the Deacon comes up, and she is told (${r.hour} h: "${r.told.slice(0, 120)}")`);
  check(/hands have gone below/.test(r.told) && /Below, out of the storm/.test(r.hands.Biscuit) && /Below, out of the storm/.test(r.hands['Mister Hollis']) && r.berths[0] === 0 && r.berths[1] === 0, `the hands go below, their berths stand empty, and the Crew page says so (${j(r.hands)}, berths ${j(r.berths)})`);
  check(r.pill.shown && /storm/.test(r.pill.cls) && /The Deacon · the eye in/.test(r.pill.text), `the weather on the screen ("${r.pill.text}")`);

  // 8. Bolts go into the sea near her, a cast or two off, and leave the water struck.
  r = await ev(() => { const g = window.__MW__.game, b0 = g.storms.bolts; g.skipRender = true; let t = 0; for (; t < 60 && g.storms.bolts < b0 + 2; t += 1 / 30) { g.simulate(1 / 30); if (Math.round(t * 30) % 6 === 0) g.presentOnce(0.2); } g.skipRender = false;
    const p = g.keeperAt(); return { t: Math.round(t), bolts: g.storms.bolts - b0, struck: g.storms.struck.map((s) => ({ d: +Math.hypot(s.x - p.x, s.z - p.z).toFixed(1), depth: +g.world.hf.depth(s.x, s.z).toFixed(1) })), rain: +g.storms.weather.rain.toFixed(2) }; });
  check(r.bolts >= 2 && r.struck.length >= 1 && r.struck.every((s) => s.d >= 12 && s.d <= 36 && s.depth >= 2), `two bolts in ${r.t} s, each a cast or two off in open water (${j(r.struck)})`);
  check(r.rain > 0.3, `and it is raining (${r.rain})`);
  await ev(() => { const g = window.__MW__.game, b0 = g.storms.bolts; g.skipRender = true; for (let t = 0; t < 30 && g.storms.bolts === b0; t += 1 / 30) g.simulate(1 / 30); g.skipRender = false; });
  await shot('08-lightning', 2);

  // 9. A cast into struck water (a ring the lightning left, no more bolts while she casts): marked so, quick to
  // bite, and the first fish hooked there puts it out.
  r = await ev(() => { const g = window.__MW__.game, st = g.storms; st.nextBolt = 99;
    const ring = st.struck.filter((s) => s.out < 0).sort((a, b) => a.age - b.age)[0]; window.reach.ring = ring ?? null;
    if (!ring) return { none: true };
    const dx = ring.x - g.pos.x, dz = ring.z - g.pos.z; g.camYaw = Math.atan2(dx, dz); g.simulate(0.6);
    return { d: +Math.hypot(dx, dz).toFixed(1), age: +ring.age.toFixed(1), lit: g.world.struckDraw?.length ?? 0 }; });
  check(!r.none && r.age < 20, `a ring of struck water lies ${r.d} m off, ${r.age} s old`);
  await shot('09-struck-water', 4);
  r = await ev(() => { const g = window.__MW__.game, ring = window.reach.ring; if (!ring) return { none: true };
    const d = Math.hypot(ring.x - g.pos.x, ring.z - g.pos.z), power = Math.min(1, Math.max(0.05, (d / g.session.reachAt(1) - 0.25) / 0.75));
    const c = window.reach.cast(undefined, power); window.fog.wait(1.5);
    return { c, power: +power.toFixed(2), off: +Math.hypot(c.target.x - ring.x, c.target.z - ring.z).toFixed(1), out: ring.out, gone: !g.storms.struck.includes(ring) }; });
  check(!r.none && r.c.spot.struck === true && r.off < 7, `a cast at it comes down in it, ${r.off} m from its middle (${j(r.c?.spot)})`);
  check(!r.none && !!r.c.caught && r.c.struckCatch && r.c.waited < 8, `the fish from it is a fish from struck water, and quick to bite (${r.c?.caught}, ${r.c?.waited} s)`);
  check(!r.none && (r.out >= 0 || r.gone), 'and hooking it put the water out');

  // 10. The eye: the sea lies down, gold light comes through, the hands come up and fish.
  r = await ev(() => { const n = window.reach.said.length; window.reach.hour(15.65); window.fog.wait(8); const g = window.__MW__.game; return { told: window.reach.since(n), eye: g.storms.weather.eye, power: +g.storms.weather.power.toFixed(2), pill: window.reach.pill(), hands: window.reach.page(), berths: window.reach.berths() }; });
  check(r.eye > 0.5 && /eye of the Deacon is over you/.test(r.told), `the eye comes over, and she is told (power ${r.power}: "${r.told.slice(0, 100)}")`);
  check(r.pill.shown && /eye/.test(r.pill.cls) && /^.?\s*Eye of the Deacon · closes in/.test(r.pill.text), `the weather on the screen says so ("${r.pill.text}")`);
  check(!/Below/.test(r.hands.Biscuit) && !/Below/.test(r.hands['Mister Hollis']) && r.berths[0] > 0 && r.berths[1] > 0, `the hands are up again (${j(r.hands)})`);
  await shot('10-the-eye');

  // 11. The eye closes, and then the Deacon blows out: she is told, with the next storm by name.
  r = await ev(() => { const n = window.reach.said.length; window.reach.hour(17.2); window.fog.wait(4); const a = window.reach.since(n); const m = window.reach.said.length; window.reach.hour(18.7); window.fog.wait(4); return { closed: a, out: window.reach.since(m), pill: window.reach.pill(), storm: window.__MW__.game.storms.weather.storm?.id ?? null }; });
  check(/The eye has closed/.test(r.closed), `the eye closes ("${r.closed.slice(0, 80)}")`);
  check(r.storm === null && /The Deacon has blown out\. Next: Little Wren/.test(r.out) && /^.?\s*Fair · Little Wren in/.test(r.pill.text), `and the Deacon blows out ("${r.out.slice(0, 100)}"; "${r.pill.text}")`);

  // 12. A save made in the Reach loads in the Reach.
  const saved = await ev(() => { const g = window.__MW__.game, s = g.state; const text = JSON.stringify({ format: 'murmurwater-save', version: s.version, savedAt: new Date().toISOString(), state: s }, (_k, v) => (v === Infinity ? '__inf__' : v)); localStorage.removeItem('murmurwater.test.bak'); localStorage.setItem('murmurwater.test', text); return { coins: s.coins, done: s.quests.done.length, boat: [g.sailing.boat.x, g.sailing.boat.z] }; });
  await page.goto(`http://localhost:${port}/?notitle&keepfresh&hour=12&${q}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 1, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  r = await ev(() => { const g = window.__MW__.game, s = g.state; for (let i = 0; i < 4; i++) g.presentOnce(1 / 30); const p = document.querySelector('.pill.weather');
    return { region: s.world.region, built: g.world.region.id, coins: s.coins, done: s.quests.done.length, boat: [g.sailing.boat.x, g.sailing.boat.z], oake: !!g.town.npcs.get('oake')?.fig.root.visible, pill: p && p.style.display !== 'none' ? p.textContent : '', ribs: g.world.reach?.counts ?? null }; });
  check(r.region === 'saltbone-reach' && r.built === 'saltbone-reach' && r.coins === saved.coins && r.done === saved.done && Math.hypot(r.boat[0] - saved.boat[0], r.boat[1] - saved.boat[1]) < 30, `the reload wakes in the Reach with its coins and its story (${j({ ...r, saved })})`);
  check(r.oake && /Fair · the Deacon/.test(r.pill) && r.ribs && r.ribs.ribs > 0 && r.ribs.bones > 0, `with Oake on the quay, the almanac on the screen, and the Ribs and their bones (${j(r.ribs)})`);
  await shot('11-reloaded-in-the-reach');

  check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  console.log(problems.length ? `REACH FAILED: ${problems.length}\n - ${problems.join('\n - ')}` : 'REACH OK');
  process.exit(problems.length ? 1 : 0);
})();
