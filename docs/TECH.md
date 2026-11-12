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
- **Bots:** `e2e/story.cjs` (whole Hearthbay chain), `e2e/play.cjs` (core loop and selling), `e2e/poses.cjs` (player pose sheet), `e2e/shot.cjs` (one screenshot with `?cam=x,y,z&look=x,y,z`).
