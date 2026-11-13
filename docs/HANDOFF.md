# Handoff

Last updated: 2026-11-13, phase 2 first slice (boats and free sailing), v0.2.0.

## Start here (new session)
1. Read `docs/DIRECTIVE.md` (the brief, verbatim) and this file.
2. Skim `docs/ROADMAP.md` for the phase checklist and `docs/DECISIONS.md` for why things are the way they are.
3. `npm ci && npm test && npm run typecheck`, then `npx vite build && npx vite preview --port 4173` and run the bots (below). `xvfb-run -a node e2e/electron-smoke.cjs` checks the desktop app loads every model, voice, sound and music file.

## Where things stand
- Hearthbay plays end to end: Mara's first jobs, selling at her stall, the shop and notice board, Wick's sketch, Pell's ferry to Gull Point, relighting the lamp, and back. Every quest fish is catchable from the dock.
- The cast is built to feel thrown (wind-up, whip, lure flight on an arc, line paying out, splash by power, camera kick, aim ring); fish shadows roam and one stalks the float before each bite.
- Generated models are in for the player, NPCs, Biscuit the cat, fish, skiff and harbour props (see `docs/ASSETS.md`); stand-ins remain only where a file is missing.
- Sound: 112 recorded effect files, 4 looping themes and 3 stings are wired in (`src/audio/audio.ts`); each one-shot keeps a synth stand-in for a missing file. All 52 voice lines are recorded.
- Sailing (v0.2.0): Pell gives the Keeper's Skiff when the lamp is relit. The player boards it from any shore, sails it freely inside Hearthbay Waters (Kettle Isle, the Teeth, Pip's Bar), fishes from it when it is still, finds places for the chart, travels between known moorings from the chart, and is turned back by the Murmur Fog at the edge. Two more story quests (hb-07 the kettle, hb-08 the Teeth flounder) use it; a sea chest waits on Pip's Bar.
- Settings are separate from the save (Electron `userData/settings.json`, browser localStorage). An unreadable save is quarantined, never overwritten.

## Code map
- `src/core`: pure logic (fishing, economy, quests, saves, world heightfield, dock, `boat.ts` handling, `seaways.ts` route finding, `landing.ts` where a boat floats and a person can step off). Tested in Node.
- `src/data`: JSON content (fish, rods, baits, boats, relics, quests, NPCs, regions with places, NPC spots, critters, ferry points, chart places, moorings, chests).
- `src/game`: glue (game loop, camera, input, town: NPCs, talk, screens, cutscenes; `sailing.ts`: the player's boat, boarding, the helm, discovery, fast travel; settings).
- `src/render`: three.js (world scene, terrain, water with fish shadows, sky, avatar, fishing view: lure, line, float, splashes; `boat-rig.ts`: hull, sail, wake, spray, tiller, where the person sits and stands; NPC figures, cat, fish models, assets).
- `src/audio`: mixer, sound bank, music.
- `src/ui`: DOM HUD (with the helm compass), dialogue and screens (`chart.ts` paints the chart).
- `e2e`: the bots.

## Bots (need `npx vite build && npx vite preview --port 4173`)
| Bot | What it proves |
|---|---|
| `story.cjs` | The whole Hearthbay chain through the real game, quest fish really caught, save and reload (STORY OK) |
| `sail.cjs` | The skiff from Pell, sailed with the real helm keys along routes through the water: Kettle Isle, the kettle, home, the Teeth, a flounder from the boat, the chest on Pip's Bar, the chart and fast travel, running at a beach, the Murmur Fog, a save made at sea (SAIL OK). Helpers in `sail-helpers.cjs` |
| `play.cjs` | Core loop: cast, hook, fight, land, sell |
| `walk.cjs` | Walking with the real keys: props, houses and people are solid, everyone is reachable; shots of the dock, night, lighthouse and conversations |
| `shadows.cjs` | A shadow reaches the float before the bite; top-down and in-game frames |
| `audio.cjs` | Every sound loads, the game triggers the recordings, night brings the night theme, mix levels (peak and RMS) |
| `cast.cjs` | Frame-by-frame sheets of a cast from three cameras (for judging feel) |
| `poses.cjs`, `shot.cjs` | Player pose sheet; one screenshot with `?cam=x,y,z&look=x,y,z` |
| `electron-smoke.cjs` | The packaged entry boots and has every model, voice, sound and music file |

## Companion thread
The asset thread ("Generate and import game assets") makes models, clips, voice, music and sound with Higgsfield, Blender and CC0 sources and pushes them to main. It documents every file in `docs/ASSETS.md`.

## Known issues
- The sailing sounds, the murmur and the open-water theme were levelled by measurement; nobody has heard them in play.
- Seated at the tiller, the hem of the coat passes through the thwart (it cannot fold), and a stowed oar lies beside the right hip.
- The sail bot is slow on SwiftShader (about 10 minutes at medium quality, run alone). Run the Chromium bots one at a time: two at once on this 4-core, 13 GB machine ran 15 to 40 times slower and one was killed for memory.
- Steep harbour cliff shows large flat facets; Gull Point arrival faces the hillside; some houses float slightly.
- Nobody has heard the mix: levels are set by measurement (`e2e/audio.cjs`). To check by ear: line snap, bite dunk, hook set, the day theme's instruments, music against voices; Mara's "Your aunt's, it was" and "stall", Pell's "Gull Point".
- Frame times on the RTX 3060 target are unmeasured (Lawson reads F3).
- On Windows, Esc both leaves mouse capture and opens the pause screen; watch for a flicker.
- Story bot run is slow on SwiftShader (about 8 minutes).

## Sailing, for whoever touches it next
- Conventions: forward is (sin h, cos h); a positive heading change is a turn to port; rudder +1 is the left key. North is −z, east is +x. The chart is north-up.
- `core/boat.ts` never lets the hull's sample points sit in less water than the draft: it slides along the shore, and when a turn is blocked it works the hull toward deeper water. `tests/boat.test.ts` holds it to that.
- A boat's place is saved in `boats.at`, whether the player is in it in `world.onBoat`, found places in `world.charted`. A save made in the middle of the step between boat and shore is written as already arrived.
- Landing and boarding share one reach, measured from the hull (`core/landing.ts`): a landing is never offered further off than `LANDING.reach`, and boarding reaches `LANDING.slack` further, so the player can always get back aboard from where she put them ashore. Before this rule a reviewer found shores on Kettle Isle and Hearthbay where the player was stranded for good. `tests/content.test.ts` drives the skiff at every island from all round to hold it.
- Content rules are tests: every boat must float at every mooring with somewhere to step off, reach every mooring, chart place and quest ground from the home dock, and every chest must be landable (`tests/content.test.ts`).
- Bots drive the boat with `window.bot.sailTo(x, z)` from `e2e/sail-helpers.cjs`, which follows `findRoute` with the helm keys. Set `g.skipRender = true` in long loops.
- The wake is foam in the water shader (`water.ts wakeFoam`) fed by the track `boat-rig.ts Wake` records; there is no wake mesh. The Murmur Fog's look is `WorldScene.murk` (scene fog plus the sky's `uMurk`).
- Sea chests are data (`regions.json chests`: place, coins, baits, a line of text); `town.ts openChest` pays them once (flag `chest:<id>`), and `world-scene.ts` swaps the shut model for the open one.
- `Heightfield.shapeAt` and `landing.ts solid` run hundreds of times a frame at sea: keep them free of allocation.

## Next steps
The rest of phase 2 in ROADMAP: economy simulator and gear tuning (baits, lures, wearables), automation that only earns while the game is open, the Drowned Bell (prestige), Mossglass Fen behind the Murmur Fog (the fog lamp is the gate), more chests and crates. Act on Lawson's feedback from v0.2.0 first.
