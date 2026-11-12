// Walk bot: walks with the real movement keys (no teleporting into place) and checks that solid things are
// solid and that everyone you must talk to can still be reached on foot. Also takes the "look at it" shots
// for the dock rails, the night lantern, the lighthouse beam, the talk camera and the notice board.
// Usage: node e2e/walk.cjs [outdir]. Exits 1 on failure.
const { chromium } = require('playwright');
(async () => {
  const port = process.env.MW_PORT || 4173;
  const outDir = process.argv[2] || 'shots/walk';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const problems = [];
  const shot = async (name) => {
    await page.evaluate(() => { const g = window.__MW__.game; for (let i = 0; i < 30; i++) g.presentOnce(1 / 30); });
    await page.waitForTimeout(700);
    try { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 120000 }); }
    catch (e) { console.warn(`shot ${name} skipped: ${e.message.split('\n')[0]}`); }
  };
  await page.goto(`http://localhost:${port}/?fresh&notitle&hour=15&quality=${process.env.MW_QUALITY || 'medium'}`);
  await page.waitForFunction(() => window.__MW__ && window.__MW__.frames > 2, null, { timeout: 180000 });

  await page.evaluate(() => {
    const g = window.__MW__.game; g.paused = true; g.halted = true;
    window.walk = {
      put(x, z) { g.pos.set(x, g.groundAt(x, z) ?? 1.5, z); g.snapCamera(); g.simulate(0.2); },
      /** Hold "forward" towards (x, z) for `seconds`; returns how close the player got and the closest blocker gap. */
      toward(x, z, seconds) {
        let gap = Infinity;
        g.skipRender = true;
        g.input.simulate('KeyW', true);
        for (let t = 0; t < seconds; t += 1 / 60) {
          g.camYaw = Math.atan2(x - g.pos.x, z - g.pos.z);
          g.simulate(1 / 60);
          for (const [bx, bz, br] of g.blockers()) gap = Math.min(gap, Math.hypot(g.pos.x - bx, g.pos.z - bz) - br);
        }
        g.input.simulate('KeyW', false); g.simulate(0.3);
        g.skipRender = false;
        return { left: Math.hypot(x - g.pos.x, z - g.pos.z), gap, prompt: g.town.focusPrompt, x: g.pos.x, z: g.pos.z };
      },
      place(id) { return g.world.region.places.find((p) => p.id === id); },
      npc(id) { const p = g.town.npcs.get(id).fig.root.position; return { x: p.x, z: p.z }; },
      look(yaw, pitch, dist) { g.camYaw = yaw; if (pitch !== undefined) g.camPitch = pitch; if (dist !== undefined) g.camDist = dist; g.snapCamera(); },
    };
  });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

  // 1. From the spawn point, walk at Mara's stall: you stop against it and can talk to her.
  const stall = await ev(() => window.walk.place('mara-stall'));
  const spawn = await ev(() => window.__MW__.game.world.region.landmarks.spawn);
  await ev((s) => window.walk.put(s.x, s.z), spawn);
  let r = await ev((p) => window.walk.toward(p.x, p.z, 14), stall);
  check(r.prompt === 'Talk to Mara', `walking to the stall offers "Talk to Mara" (got ${r.prompt}, ${r.left.toFixed(1)} m away)`);
  check(r.gap > 0.3, `the player stayed outside every solid thing on the way (closest ${r.gap.toFixed(2)} m)`);
  await shot('01-stall');

  // 2. The notice board, from the stall.
  const board = await ev(() => window.walk.place('notice-board'));
  r = await ev((p) => window.walk.toward(p.x, p.z, 6), board);
  check(r.prompt === 'Read the notice board', `walking to the board offers "Read the notice board" (got ${r.prompt})`);
  check(r.gap > 0.3, `did not walk through the board or the stall (closest ${r.gap.toFixed(2)} m)`);

  // 3. Every villager on Hearthbay: walk straight at them from four sides; you end beside them, never inside.
  //    Then talk from where the walk ended, for a look at the conversation camera.
  const ids = await ev(() => [...window.__MW__.game.town.npcs.entries()].filter(([, e]) => e.fig.root.visible).map(([id]) => id));
  const endTalk = () => ev(() => {
    const g = window.__MW__.game; const d = g.town.dialogue; let k = 0;
    while (d.isOpen && k++ < 80) { d.advance(); g.simulate(0.05); const b = document.querySelectorAll('.dlg-choice'); if (b.length) { d.pick(b.length - 1); g.simulate(0.1); } }
    g.simulate(0.8);
  });
  for (const id of ids) {
    const p = await ev((id) => window.walk.npc(id), id);
    let reached = false, inside = false, talked = false;
    for (let a = 0; a < 4; a++) {
      const sx = p.x + Math.cos(a * 1.571 + 0.4) * 5, sz = p.z + Math.sin(a * 1.571 + 0.4) * 5;
      const walkable = await ev(([x, z]) => window.__MW__.game.groundAt(x, z) !== null, [sx, sz]);
      if (!walkable) continue;
      await ev(([x, z]) => window.walk.put(x, z), [sx, sz]);
      r = await ev((q) => window.walk.toward(q.x, q.z, 4), p);
      if (r.left < 0.6) inside = true;
      if (!(r.prompt && r.prompt.startsWith('Talk to'))) continue;
      reached = true;
      if (talked) continue;
      talked = true;
      await ev(() => { const g = window.__MW__.game; g.input.simulate('KeyE', true); g.simulate(1 / 60); g.input.simulate('KeyE', false); g.simulate(1.5); });
      check(await ev(() => window.__MW__.game.town.dialogue.isOpen), `talking to ${id} opens a conversation`);
      await shot(`04-talk-${id}`);
      await endTalk();
    }
    check(reached, `${id} can be reached on foot`);
    check(!inside, `${id} is solid`);
  }

  // 4. A house: walk at the nearest one from the stall; you never get inside its footprint.
  const house = await ev(() => {
    const g = window.__MW__.game; let best = null;
    for (const b of g.world.blockers) if (b[2] > 3 && b[2] < 4) { const d = Math.hypot(b[0] - g.pos.x, b[1] - g.pos.z); if (!best || d < best.d) best = { x: b[0], z: b[1], r: b[2], d }; }
    return best;
  });
  if (house) {
    r = await ev((h) => window.walk.toward(h.x, h.z, Math.min(40, h.d / 3.6 + 4)), house);
    check(r.left > house.r, `the nearest house is solid (stopped ${r.left.toFixed(1)} m from its centre, radius ${house.r})`);
    await shot('05-house');
  }

  // 5. The dock: the landing is open (no rail across it) and the far end still lets you fish.
  const dockEnd = await ev(() => { const g = window.__MW__.game; return { x: g.world.dockEnd.x, z: g.world.dockEnd.z }; });
  const dock = await ev(() => window.__MW__.game.world.region.landmarks.dock);
  await ev((d) => window.walk.put(d.x + 4, d.z), dock);
  r = await ev((p) => window.walk.toward(p.x, p.z, 16), dockEnd);
  check(r.left < 2.5, `walked the dock from the shore to its end (${r.left.toFixed(1)} m short)`);
  await ev((d) => { window.walk.put(d.x - 1.5, d.z); window.walk.look(-Math.PI / 2, 0.32, 7); }, dock);
  await shot('06-dock-landing');

  // 6. Look-at-it shots: the lantern you carry at night, and the lighthouse once it is lit.
  await ev((s) => { const g = window.__MW__.game; g.state.hour = 23.5; window.walk.put(s.x - 4, s.z - 5); window.walk.look(0.6, 0.3, 6.5); }, stall);
  await shot('07-night-village');
  await ev((p) => { const g = window.__MW__.game; g.state.hour = 23.5; window.walk.put(p.x + 1, p.z); window.walk.look(-Math.PI / 2, 0.3, 6.5); }, dockEnd);
  await shot('08-night-dock');
  await ev((p) => { const g = window.__MW__.game; g.state.hour = 22.5; g.world.lighthouseLit = true; window.walk.put(p.x + 1, p.z); window.walk.look(-2.6, 0.12, 7); }, dockEnd);
  await shot('08-lighthouse-from-dock');
  const gull = await ev(() => window.walk.place('ferry-gull'));
  await ev((p) => { const g = window.__MW__.game; g.state.hour = 21.5; g.world.lighthouseLit = true; window.walk.put(p.x - 6, p.z - 3); window.walk.look(Math.atan2(-162 - (p.x - 6), -132 - (p.z - 3)), 0.1, 7); }, gull);
  await shot('09-lighthouse-gull-point');
  await ev(() => { const g = window.__MW__.game; const V = g.pos.constructor; g.debugCam = { pos: new V(-128, 9, -96), look: new V(-162, 24, -132) }; });
  await shot('09-lighthouse-beam');
  await ev(() => { const g = window.__MW__.game; g.debugCam = null; g.world.lighthouseLit = g.town.lampLit; });

  if (errors.length) problems.push('page errors: ' + errors.join(' | '));
  console.log(problems.length ? 'WALK FAILED\n' + problems.join('\n') : 'WALK OK');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
