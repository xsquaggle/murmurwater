// Helpers the sailing bot runs inside the page: the granted starting state, walking, boarding, a pilot that
// steers along a route through the water with the real helm keys, beaching, and fishing.
module.exports.install = (page) => page.evaluate(() => {
    const MW = window.__MW__, g = MW.game, s = g.state; g.paused = true; g.halted = true;
    // The story so far: the lamp has just been lit, and the player stands on Gull Point with Pell.
    s.quests.done.push('hb-01-salt', 'hb-02-supper', 'hb-03-proper-rod', 'hb-04-drawing', 'hb-05-dark-lamp');
    s.quests.active['hb-06-relight'] = {};
    s.flags.push('shop-open', 'board-open', 'has-lampjaw-light', 'lamp-lit', 'met-pell', 'met-mara');
    s.gear.rods.push('harbour-rod'); s.gear.rod = 'harbour-rod'; s.gear.rodLevels['harbour-rod'] = 0;
    MW.quests.onQuestEvent(s, { type: 'visit', place: 'lighthouse-lamp' });
    g.world.lighthouseLit = true; g.refreshSession();
    const land = g.world.region.ferry['gull-point'];
    g.pos.set(land.x, g.groundAt(land.x, land.z) ?? 1, land.z);
    g.town.arrive(); g.world.placeFerry('gull-point'); g.snapCamera();

    const NO = { primary: false, primaryPressed: false, primaryReleased: false, steer: 0, cancel: false };
    const sail = g.sailing;
    const keys = {};
    const key = (k, on) => { if (!!keys[k] !== on) { keys[k] = on; g.input.simulate(k, on); } };
    const release = () => { for (const k of Object.keys(keys)) key(k, false); };
    /** One thirtieth of a second of game; every third one is presented (not drawn) so the camera and the wake keep up. */
    let ticks = 0;
    const tick = () => { g.simulate(1 / 30); if (++ticks % 3 === 0) g.presentOnce(0.1); };
    const clear = () => MW.clearance(sail.env, sail.def, sail.boat.x, sail.boat.z, sail.boat.heading);
    window.bot = {
      log: { minClear: Infinity, bumps: 0, top: 0 },
      status: (id) => MW.quests.questStatus(s, id),
      tap(k) { g.input.simulate(k, true); g.simulate(1 / 60); g.input.simulate(k, false); g.simulate(1 / 60); },
      interact() { this.tap('KeyE'); return g.town.dialogue.isOpen || g.town.screens.isOpen; },
      readAll() {
        const d = g.town.dialogue; let k = 0;
        while (d.isOpen && k++ < 60) { d.advance(); g.simulate(0.05); g.presentOnce(1 / 60); const c = [...document.querySelectorAll('.dlg-choice')].map((b) => b.textContent); if (c.length) return c; }
        return [];
      },
      choose(label) {
        this.readAll();
        const i = [...document.querySelectorAll('.dlg-choice')].findIndex((b) => b.textContent.includes(label));
        if (i < 0) return false;
        g.town.dialogue.pick(i); g.simulate(0.1); return true;
      },
      /** Walk with the forward key toward (x, z) until `until()` or `seconds` pass. Returns the prompt shown. */
      walk(x, z, seconds, until) {
        g.skipRender = true;
        key('KeyW', true);
        // Held up by someone or something in the way: step round it, one side and then the other.
        let px = g.pos.x, pz = g.pos.z, held = 0, round = 0, side = 1;
        for (let t = 0; t < seconds; t += 1 / 30) {
          g.camYaw = Math.atan2(x - g.pos.x, z - g.pos.z) + (round > 0 ? side * 1.25 : 0);
          tick();
          if (until ? until() : Math.hypot(x - g.pos.x, z - g.pos.z) < 0.5) break;
          round -= 1 / 30;
          held = Math.hypot(g.pos.x - px, g.pos.z - pz) < 0.02 ? held + 1 / 30 : 0;
          px = g.pos.x; pz = g.pos.z;
          if (held > 0.5 && round <= 0) { round = 0.9; side = -side; held = 0; }
        }
        release(); g.simulate(0.3); g.presentOnce(1 / 30); g.skipRender = false;
        return g.town.focusPrompt;
      },
      /** Walk to the water's edge by the boat and climb in. */
      board() {
        const p = this.walk(sail.boat.x, sail.boat.z, 25, () => sail.boardable && (g.town.focusPrompt ?? '').startsWith('Board'));
        if (!(p ?? '').startsWith('Board')) return { ok: false, prompt: p, d: sail.distanceTo(g.pos) };
        this.tap('KeyE'); for (let i = 0; i < 60 && !sail.aboard; i++) tick();
        return { ok: sail.aboard, prompt: p };
      },
      /** Sail to (x, z) along a route through the water, steering with the helm keys. */
      sailTo(x, z, opts = {}) {
        const route = MW.findRoute(sail.env, sail.def, [sail.boat.x, sail.boat.z], [x, z]);
        if (!route) return { ok: false, why: 'no route' };
        const stopR = opts.stopR ?? 5, end = route[route.length - 1];
        let i = 0, t = 0, still = 0, backing = 0;
        g.skipRender = true;
        for (; t < (opts.maxTime ?? 300); t += 1 / 30) {
          const b = sail.boat;
          // Stuck against something: back off for a moment with the helm over, as anyone would.
          still = Math.abs(b.speed) < 0.15 ? still + 1 / 30 : 0;
          if (still > 2.5 && backing <= 0) { backing = 2; still = 0; this.log.backedOff = (this.log.backedOff ?? 0) + 1; }
          if (backing > 0) { backing -= 1 / 30; key('KeyW', false); key('KeyS', true); key('KeyA', false); key('KeyD', true); tick(); this.log.minClear = Math.min(this.log.minClear, clear()); continue; }
          while (i < route.length - 1 && Math.hypot(route[i][0] - b.x, route[i][1] - b.z) < 11) i++;
          const left = Math.hypot(end[0] - b.x, end[1] - b.z);
          if (left < stopR) break;
          let err = Math.atan2(route[i][0] - b.x, route[i][1] - b.z) - b.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
          key('KeyA', err > 0.05); key('KeyD', err < -0.05);
          const cap = left < 12 ? 1.6 : left < 30 ? 3 : 99;
          key('KeyW', Math.abs(err) < 1.1 && b.speed < cap); key('KeyS', b.speed > cap + 1.2);
          tick();
          const c = clear();
          this.log.minClear = Math.min(this.log.minClear, c); this.log.top = Math.max(this.log.top, b.speed);
          if (opts.until && opts.until()) break;
        }
        release();
        // Check her way: astern until she is nearly still.
        for (let k = 0; k < 150 && Math.abs(sail.boat.speed) > 0.35; k++) { key('KeyS', sail.boat.speed > 0); key('KeyW', sail.boat.speed < 0); tick(); }
        release(); for (let k = 0; k < 20; k++) tick();
        g.skipRender = false;
        return { ok: t < (opts.maxTime ?? 300), seconds: Math.round(t), metres: Math.round(MW_len(route)), left: Math.hypot(end[0] - sail.boat.x, end[1] - sail.boat.z) };
      },
      /** Creep toward the nearest shore until there is somewhere to step off, as a player would beach her. */
      land() {
        let best = null, bd = Infinity;
        for (let r = 2; r < 40 && !best; r += 1) for (let a = 0; a < 48; a++) {
          const x = sail.boat.x + Math.sin(a / 48 * Math.PI * 2) * r, z = sail.boat.z + Math.cos(a / 48 * Math.PI * 2) * r;
          if (g.groundAt(x, z) !== null && r < bd) { bd = r; best = [x, z]; }
        }
        if (!best) return { ok: false, why: 'no shore within 40 m' };
        g.skipRender = true;
        for (let t = 0; t < 30 && !sail.canLand; t += 1 / 30) {
          const b = sail.boat;
          let err = Math.atan2(best[0] - b.x, best[1] - b.z) - b.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
          key('KeyA', err > 0.08); key('KeyD', err < -0.08); key('KeyW', Math.abs(err) < 0.7 && b.speed < 1.2);
          tick(); this.log.minClear = Math.min(this.log.minClear, clear());
        }
        release(); for (let k = 0; k < 45; k++) tick();
        g.skipRender = false;
        if (!sail.canLand) return { ok: false, why: 'never close enough to land', speed: sail.boat.speed };
        const prompt = g.town.focusPrompt;
        this.tap('KeyE'); for (let i = 0; i < 90 && sail.riding; i++) tick();
        // From where she put the player ashore she must be boardable again without taking a step.
        return { ok: !sail.aboard && g.groundAt(g.pos.x, g.pos.z) !== null, prompt, island: g.town.island, boardable: sail.boardable, hull: sail.distanceTo(g.pos) };
      },
      /** Cast and play fish until `fishId` is landed (at most `max` catches). Returns catches used, or -1. */
      fishFor(fishId, max, hour) {
        const before = s.journal[fishId]?.caught ?? 0;
        for (let n = 1; n <= max; n++) {
          if (hour !== undefined) s.hour = hour;
          if (s.hold.length >= s.holdCapacity - 1) s.hold.length = 0;
          g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
          let guard = 0;
          while (g.session.phase === 'charging' && g.session.power < 0.88 && guard++ < 200) g.simulate(1 / 60, () => ({ ...NO, primary: true }));
          g.simulate(1 / 60, () => ({ ...NO, primaryReleased: true }));
          guard = 0;
          while (['casting', 'waiting'].includes(g.session.phase) && guard++ < 60 * 40) g.simulate(1 / 60, () => NO);
          if (g.session.phase !== 'bite') { g.simulate(1, () => NO); n--; if (guard === 0) return -2; continue; }
          g.simulate(0.15, () => NO);
          g.simulate(1 / 60, () => ({ ...NO, primary: true, primaryPressed: true }));
          guard = 0;
          while (g.session.phase === 'fighting' && guard++ < 60 * 60) g.simulate(1 / 60, (gg) => { const f = gg.session.fight; if (!f) return NO; return { ...NO, primary: f.thrash <= 0 && f.tension < 0.7, steer: f.run ? -f.run : 0 }; });
          g.simulate(2.6, () => NO);
          if ((s.journal[fishId]?.caught ?? 0) > before) { g.botInput = null; return n; }
        }
        g.botInput = null;
        return -1;
      },
      mooring: (id) => g.world.region.moorings.find((m) => m.id === id),
      npc(id) { const p = g.town.npcs.get(id).fig.root; return { x: p.position.x, z: p.position.z, visible: p.visible }; },
      state: () => ({ x: sail.boat.x, z: sail.boat.z, heading: sail.boat.heading, speed: sail.boat.speed, aboard: sail.aboard, island: g.town.island, charted: [...s.world.charted], coins: s.coins, hour: s.hour, prompt: g.town.focusPrompt }),
    };
    const MW_len = (r) => { let d = 0; for (let i = 1; i < r.length; i++) d += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return d; };
  });
