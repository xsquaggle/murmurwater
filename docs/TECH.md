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

## Economy, gear, Lantern Pots and the Bell (v4, 2026-11-15)
- **One fold for gear:** `src/core/gear.ts stats(state, env)` turns the rod and its tuning, bait, lure, creel, wearables and their set, relics, Echo upgrades and the boat into one `Stats` object (reach, power, control, luck, value, hold, bite speed, Rhythm cap, pot speed and so on). The game (`Game.stats`, refreshed by `refreshSession`), the satchel's Gear page and the simulator all read it; nothing else adds a bonus. Content is `src/data/gear.json` (tuning, creel, lures, wearables, sets, collections, pots) and `src/data/echoes.json` (the Bell's constants and the ten upgrades).
- **Pots:** `src/core/pots.ts` (pure): `placePot`, `tickPots(state, dt, hour, stats)`, `haulPot`, `takeUpPot`, `potKnows(state, zone, region)` (how many journal fish live where the pot sits). Pots tick in the game's fixed step and nowhere else, so nothing is earned while the game is closed. `src/game/potfield.ts` is the glue: the pot key (F), where a pot lands, the floats, the prompt, the toasts.
- **The Bell:** `src/core/bell.ts`: `echoesOnRing`, `canRing`, `ringBell(state)` (sells the catch on hand, pays Echoes, resets what the tide takes, puts the keeper on the Hearthbay dock at `bell.dawn`), `buyEcho`. The cutscene is `Town.ringBell()`; the belfry, its bell, rope and glow are in `render/world-scene.ts`.
- **Buying and wearing:** every shop and satchel button goes through `src/game/trade.ts trade(game, action)`, which calls the core rule, refreshes the stats, plays the sound, says what happened, checks for a job this finished, and saves.
- **Simulator:** `npm run sim -- [--minutes 180] [--seeds 5] [--skills 0.4,0.7,0.95] [--log] [--rates] [--nopots]` plays whole sessions with the real rules (`tools/sim/player.ts` is a keeper who fishes, sells, shops, takes jobs, sails, sets and hauls pots, and rings the Bell) in about a second each. `tests/sim.test.ts` holds the tuning: each system arrives in its time for a clumsy and a practised keeper, the story never stalls, pots earn a fair share and never more than the rod, a second tide is quicker than the first, each bait is best somewhere and none everywhere.
- **Save v4:** `holdCapacity` is gone (the hold's size comes from gear); new fields `gear.creel`, `pots` (owned, placed, hold, levels) and `lifetime.echoes` (Echoes paid out so far); the one old Echo upgrade becomes ranks of Tidewise. Migration 3→4 and a v4 fixture.
- **Quests:** new objective kinds `haul`, `sell` by coins, `visit` a place, `ring`; a quest can `give` a pot and put the clock on. `NpcDef.turned` lines are said once per tide after a Turning (flag `deja:<npc>`, cleared by the Bell). Voice keys `<npc>/turned.<i>`.
- **Bot:** `e2e/tide.cjs` (in CI at low quality) plays the pot job, every page of the shelf, the satchel, the belfry by boat, the first ringing and what the tide took and kept, then reloads.

## Regions, the sea-road and Mossglass Fen (v5, 2026-11-16)
- **One sea.** Every region is a disc in one coordinate space (`src/data/regions.json`: `center`, `radius`, `grade` for its light and colours, zones, places, moorings, chests, `props`, `groves`). `core/content.ts` has `regionAt(x, z)`, the sea-roads (`ROADS`: two ends, a half width, the two regions it joins), `roadPoint` and `roadOpen` (where a point lies on a road and how far the fog is lifted there), `regionAcross` and `crossingAt` (the swap), `roadToward(from, to)`, and `regionAhead(region, x, z, heading?)`: the region a road under the boat leads to (with a heading, only for a boat pointing along the road toward it). `zoneAt` never answers "no zone" inside a region: water outside every zone is the region's `openZone` (its widest, lowest-priority zone), so nothing that reads a zone can take null to mean every fish.
- **One region built.** `WorldScene` builds the region the keeper is in and nothing else. `Game.enterRegion(id)` swaps it: the old scene's meshes are disposed, the new region is built into the same three.js scene, the boat, pots and player carry over. The swap is made half way along a sea-road, where the fog is thickest, or under the fade of a journey by chart. `SWAP_BAND` (1.5% of the road either side of the middle) keeps a boat that drifts on the line from swapping back and forth. What is taken out of the scene for good goes through `assets.ts freeOwn(root)`, which frees geometry, materials, textures, instance tables and skeletons a thing made for itself and leaves the library's shared ones alone.
- **The fog and the lamp.** `core/boat.ts murmurAt` is lifted along a road for a boat with the Fog Lamp (`gear.ts hasFogLamp`: the Echo purchase `fog-lamp`); without one the road's lights stay dark and the fog turns her back as before. `render/sea-road.ts` draws the lights, which wake one after another ahead of the lamp; both regions build the same lights in the same places, so nothing moves at the swap.
- **Ground.** `render/terrain.ts terrainSteps(hf, cell, look)` is a generator that builds the ground a little at a time; `buildTerrain` runs it to the end. The result is two meshes: the land, which casts shadows, and as its child the bed (every face wholly under the water), which does not. Bed that is flat for its depth is drawn in 4 by 4 blocks as a fan about the middle vertex, keeping the fine lattice's vertices on any side that meets a finely drawn neighbour. Faces are written into blocks of typed memory (`CHUNK` faces each) as they are made and copied into the mesh a few blocks a turn; a turn makes at most `TURN_FACES` faces, and the sphere round each mesh is reckoned from the lattice. The longest turn measured here is 3 ms at a 2 m cell (it was 26 ms when faces went into plain lists). `tests/terrain.test.ts`: every face looks up, no edge is left open, the stepped build equals the whole one, the reckoned sphere holds every corner, and at the cells the game uses (4, 2.5, 2 m) the third-longest turn is under 16 ms.
- **Ready before the crossing.** `render/region-prep.ts RegionPrep`: `want(region, cell)`, `pump(budgetMs)` each fixed step (3 ms on a road, 9 ms during a chart fade), `take(id, cell)` at the swap (finishing on the spot if it must). `Game.lastSwap` records the cost of the last swap: `terrain`, `water`, `flora`, `rest`, `readyBefore`, `finishing`, `scene`, `game` in milliseconds. Measured in software rendering: 1,000 ms before, 78 ms after.
- **Looks.** `render/looks.ts lookOf(grade)` gives a region's ground, bed and water colours and how lively its sea is; `daycycle.ts GRADES` its light. The water shader takes clearness as `uTurbid`.
- **The Fen's growth.** `render/fen-scene.ts`: reed sheaves placed once in one draw call wherever the bed lies between about half a metre under and just above the water; finer clumps dealt from a pool round the player; the grove's lantern trees from `core/flora.ts` (the same trunks the boat strikes and the tests thread); lilies; drifting lights at night. `FenDressing.inReeds(x, z)` tells the boat when to hiss.
- **Data-driven props and places.** `render/fen-props.ts SPECS` maps a prop name to a model key and a stand-in built from plain shapes; `regions.json props` places them with a yaw and an optional solid circle. Look-at places (`prompt`, `text`, `flag`, `dark`) are read with E: they set a flag, can black the screen out line by line, and count as a visit for a job.
- **Quests.** `receiver` hands a job in to someone other than its giver; `requiresFlags` gates an offer (Calloway's on `reached:mossglass-fen`); `arriveIn(state, region)` is the one place a region change touches the save and it re-reads the untaken notice-board jobs for the new water (`localiseBoard`: same serial, same seed, same timer, so there and back gives the board the keeper left). `fen-01` also `requires` Pell's `hb-12-road`. `currentGoal` orders work as: ready to hand in to somebody here, the active main job, an offer from somebody here, then anything across the fog, then the journal. `content.ts fishHint(fish, flags)` writes the journal's hint from the zone's `hint` and the fish's hours; a fish with `requires` gives its own `hint` until the flag is set. Goods with `from: "reached:<region>"` join every shelf once that flag is set.
- **Asset lists.** `vite.config.ts assetLists()` provides `virtual:model-list` and `virtual:audio-list` (every `.glb` and `.ogg` under `public/`), so the game knows at build time what it has. `assets.ts PENDING_MODELS` and `audio.ts PENDING` name things asked for and not yet delivered: a stand-in is used and nothing reports them missing until their file is in the build. Both are empty as of v0.4.0.
- **Chart.** `ui/chart.ts` has a page for each region reached; "Sail there" to a mooring of another region goes through `Town.sailTo`, which prepares the far region during the fade.
- **Simulator.** The keeper buys the lamp with her first Echoes, crosses for jobs and for better fishing (taking her pots up first), and after the story fills the journal. `--minutes 420` shows the whole Fen.
- **Bot.** `e2e/fog.cjs` (in CI at low quality), with `window.fog` helpers: `pilot(x, z)` steers by the helm keys without the route finder (which knows one region's water at a time), `chartTo(name)`, `talk(npc, prompt)`, `toasts()`.
- **Tester's start.** `main.ts`: `?tester` (F8 on the title screen) loads `src/data/tester/fen.json` and uses a store that reads and writes nothing. `tools/tester-save.ts` makes the file by running the simulator's keeper (seed 1, skill 0.7) until Pell's road job is in hand; `tests/tester.test.ts` compares the file with a fresh run. The desktop smoke test presses F8 and checks the lamp, the job, and that saving there leaves the real save as it was.
- **Save.** Still version 4: a region reached is `world.discovered` plus the flag `reached:<id>`; the lamp is an Echo upgrade; places read are `seen:<id>` flags.

