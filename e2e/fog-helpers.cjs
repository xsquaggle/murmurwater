// Helpers for bots that cross the fog: installs `window.fog` in the page (after sail-helpers' `window.bot`).
// wait(seconds), toasts(), talk(npc, prompt), chartTo(name), pilot(x, z, maxT, stopAt).
exports.install = (page) => page.evaluate(() => {
    const MW = window.__MW__, g = MW.game, s = g.state; g.paused = true; g.halted = true;
    window.fog = {
      wait(seconds) { g.skipRender = true; for (let t = 0; t < seconds; t += 1 / 30) { g.simulate(1 / 30); if (Math.round(t * 30) % 6 === 0) g.presentOnce(0.2); } g.skipRender = false; },
      toasts: () => [...document.querySelectorAll('.toast')].map((t) => t.textContent),
      talk(id, prompt) { const p = window.bot.npc(id); window.bot.walk(p.x, p.z, 40, () => (g.town.focusPrompt ?? '') === prompt); return window.bot.interact(); },
      /** The chart's own button: by a place's name here, or a mooring's name across the fog. */
      chartTo(name) {
        g.town.openScreen('chart');
        const near = [...document.querySelectorAll('.chart-place:not(.far)')].find((e) => e.querySelector('b')?.textContent === name);
        const far = [...document.querySelectorAll('.chart-far-row')].find((e) => e.querySelector('span')?.textContent === name);
        const b = (near ?? far)?.querySelector('.btn'); if (!b || b.disabled) { g.town.closeScreens(); return false; }
        b.click(); this.wait(5); return true;
      },
      /** A plain pilot for the sea-road (the route finder knows one region's water at a time). */
      pilot(tx, tz, maxT, stopAt) {
        const sail = g.sailing; g.skipRender = true;
        let t = 0, maxFog = 0, maxMur = 0, lamp = 0, swapped = null; const region0 = s.world.region;
        for (; t < maxT; t += 1 / 30) {
          const b = sail.boat; if (Math.hypot(tx - b.x, tz - b.z) < stopAt) break;
          let err = Math.atan2(tx - b.x, tz - b.z) - b.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
          g.input.simulate('KeyA', err > 0.05); g.input.simulate('KeyD', err < -0.05); g.input.simulate('KeyW', true);
          const fogBefore = sail.fog;
          g.simulate(1 / 30);
          if (s.world.region !== region0 && !swapped) swapped = { fog: fogBefore, x: b.x, z: b.z };
          if (Math.round(t * 30) % 3 === 0) g.presentOnce(0.1);
          maxFog = Math.max(maxFog, sail.fog); maxMur = Math.max(maxMur, sail.murmur); lamp = Math.max(lamp, sail.rig.fogLit ?? 0);
        }
        for (const k of ['KeyA', 'KeyD', 'KeyW']) g.input.simulate(k, false);
        g.skipRender = false;
        return { t: Math.round(t), x: sail.boat.x, z: sail.boat.z, region: s.world.region, maxFog, maxMur, lamp, swapped };
      },
    };
  });
