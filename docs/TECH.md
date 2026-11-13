# Murmurwater — Technical Plan

Status: v2 (2026-11-12).

## Stack
- **Language:** TypeScript (strict).
- **Rendering:** three.js (WebGL2) with custom GLSL shaders for water, sky and toon lighting; `postprocessing` for bloom, tone mapping and grading.
- **Build:** Vite.
- **Desktop shell:** Electron, packaged for Windows (NSIS installer + portable exe) by electron-builder in GitHub Actions on `windows-latest`, published to GitHub Releases on tags `v*`.
- **Tests:** vitest (logic, saves, economy, data validation); Playwright with headless Chromium for screenshots and the automated playthrough bot.

Why: see DECISIONS.md 2026-11-12 "Engine".

## Architecture
```
src/
  core/        Pure game logic. No three.js, no DOM. Deterministic with seeded RNG.
    state.ts       GameState shape + defaults
    fishing.ts     cast/bite/hook/fight state machine and maths
    economy.ts     selling, prices, multipliers
    gear.ts, boats.ts, quests.ts, loot.ts, prestige.ts, automation.ts
    save.ts        versioned serialize/deserialize + migrations
  data/        JSON content (fish, rods, bait, lures, wearables, boats, regions, zones,
               quests, loot tables, relics, echo tree). Validated at load and in tests.
  render/      three.js scene: water, sky, islands, props, fish models, effects, camera.
  audio/       WebAudio mixer, music/ambience/sfx buses.
  ui/          DOM/CSS HUD and menus (crisp text at any UI scale).
  game/        Glue: input, game loop, controllers (player, boat, fishing presentation).
electron/      main process: window, settings for window mode, save file IO (userData).
tools/sim/     Progression simulator (imports src/core directly).
tests/         vitest.
e2e/           Playwright screenshot + bot scripts.
```

**Rule:** `core` owns all rules and numbers; `render`/`ui` only present state and send intents. The simulator and the bot both drive `core`, so what they verify is what ships.

## Game loop
Fixed-step simulation at 60 Hz for core logic (`core.tick(dt)`), variable-rate rendering with interpolation. Automation ticks only while the app is running; on load, elapsed real time is ignored (no offline earnings).

## Saves
- JSON, `{ version, savedAt, state }`.
- Electron: `%APPDATA%/Murmurwater/save.json`, written atomically (write temp → rename); before each write the previous file is copied to `save.bak.json`. Browser/dev fallback: localStorage.
- `migrations[v] (state) → state` for every version bump. Tests load fixture saves of every past version (`tests/fixtures/saves/v*.json`) and check they migrate cleanly.
- Autosave every 30 s and on key events; also on window close.

## Rendering budget (RTX 3060, 1080p/1440p, High)
- Target ≤ 8 ms GPU, ≤ 4 ms CPU per frame. Draw calls < 400 via instancing and merged static island geometry.
- Water: near grid 256² with Gerstner sums in vertex shader; far ring low-res.
- Shadows: one 2048 cascaded-ish directional shadow map on High (1024 Medium, off Low).
- Quality presets scale: pixel ratio, shadow size, water grid, post chain, view distance, particle counts.

## Testing and verification
- `npm test`: unit tests for core, data validation, save migrations, economy invariants.
- `npm run sim`: progression simulator; prints the time to each milestone and flags walls/exploits.
- `npm run e2e`: Playwright launches the Vite build in headless Chromium (SwiftShader), takes reference screenshots, and runs the bot through the core loop using the debug hook `window.__MW__` (dev/test builds only).
- Profiling: in-game frame-time graph (F3) and a scripted benchmark camera path that logs p50/p99 frame times.

## CI
- `.github/workflows/ci.yml`: on push/PR — install, typecheck, test, simulate.
- `.github/workflows/release.yml`: run by hand (workflow_dispatch with a `tag` input, because the git proxy here can't push tags); builds on windows-latest and attaches the setup .exe and the portable .exe to a GitHub Release with the notes in `docs/release-notes/<tag>.md`.

## Content pipeline additions (v2)
- **Models:** `src/render/assets.ts` loads every GLB in `public/models` at boot and clones per use; a missing file falls back to a stand-in and is listed in `assets.missing`.
- **Talk:** `src/game/talk.ts` builds every conversation from quest and NPC data (pure, tested). Voice keys are `<npc>/<quest>.intro.<i>`, `.outro.<i>`, `.reminder`, `<npc>/bark.<i>`.
- **Voice:** `npm run voice` writes `docs/voice/SCRIPT.md` and `voice-lines.json` with a text hash per line; the game plays `public/audio/voice/<key>.mp3` only when `voiced.json` records the same hash.
- **Settings:** `src/game/settings.ts`, stored apart from the save (Electron `userData/settings.json`, else localStorage); Electron reads it at startup for window mode and resolution.
- **Sound:** `src/audio/audio.ts` loads `public/audio/sfx/<name>_<n>.ogg` into a bank at start (table `SFX`: variations and volume per sound), loops `reel-click`, `waves-lap` and `cat-purr`, and streams nothing: music in `public/audio/music` is decoded one track at a time and crossfaded by `setMusic`. Add a sound by dropping the files in, adding a row to `SFX` and a method that calls `sfx(name)` with a synth fallback.
- **Bots:** `e2e/story.cjs` (whole Hearthbay chain), `e2e/play.cjs` (core loop and selling), `e2e/walk.cjs` (collision and reachability on foot), `e2e/shadows.cjs` (fish shadow reaches the float), `e2e/audio.cjs` (sounds load, trigger and mix levels), `e2e/cast.cjs` (cast frame sheets), `e2e/poses.cjs` (player pose sheet), `e2e/shot.cjs` (one screenshot with `?cam=x,y,z&look=x,y,z`), `e2e/electron-smoke.cjs` (packaged entry has every asset).

## Sailing (v3, 2026-11-13)
- **Model:** `src/core/boat.ts` (pure): `stepBoat(state, spec, input, env, dt)` with `env = { depth(x, z), solid?(x, z), centre, radius, edge }` from `core/landing.ts boatEnv`. `clearance()` is the least water under the hull's sample points; it is never negative after a step.
- **Routes:** `src/core/seaways.ts findRoute` (A* on a 4 m grid of cells the hull floats in whichever way it lies). Used by content tests and the sail bot's pilot.
- **Glue:** `src/game/sailing.ts` (launching, boarding and stepping ashore by a short hop, helm input, discovery, the murmur, mooring and fast travel) and `src/render/boat-rig.ts` (hull mask so water does not show inside the hull, the generated sail rig with its belly and furl morphs (the sail comes down when she is left or lies still for 1.2 s, and goes up when way is called for), the wake track, spray, tiller, the seat and standing spots).
- **Save v3:** `boats.at` (x, z, heading), `world.charted`, `world.onBoat`; migration 2→3 and a v3 fixture.
- **Content:** a region has `chart` places (found by coming inside `r`), `moorings` (the first is home), `chests`, and an `edgeHint`.
- **Wake:** not a mesh. `boat-rig.ts Wake` records the stern's track (48 points, 5 s) into uniforms and `render/water.ts wakeFoam` draws it as foam in the water's own fragment shader, so it sits on the waves at every distance and quality.
- **Murmur Fog:** `core/boat.ts murmurAt` (0 at 110 m inside the region's radius, 1 at the edge) drives a current that outruns the boat, the hum (`audio.ts`), and the look: `WorldScene.murk` thickens and tints the scene fog and closes the sky in through the `uMurk` sky uniform, which the water's reflection shares. The helm shows speed made good over the ground (`Sailing.made`), so it falls to nothing as the fog holds her.
- **Terrain lookups:** `Heightfield.shapeAt` rejects shapes by a bounding circle and reuses one result object. It is called several hundred times a frame while sailing (hull samples, landing scan, camera), so it must not allocate.
- **Bot:** `e2e/sail.cjs` with `e2e/sail-helpers.cjs` (in CI at low quality). The helpers step the game at 30 Hz and present every third step. Run heavy bots one at a time: two Chromium bots at once on a 4-core machine with a 13 GB limit ran 15 to 40 times slower and one was killed for memory.
