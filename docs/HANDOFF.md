# Handoff

Last updated: 2026-11-15, phase 2 second slice (economy, gear, Lantern Pots, the Drowned Bell), released as v0.3.0. The next slice is Mossglass Fen behind the Murmur Fog.

## Start here (new session)
1. Read `docs/DIRECTIVE.md` (the brief, verbatim) and this file.
2. Skim `docs/ROADMAP.md` for the phase checklist and `docs/DECISIONS.md` for why things are the way they are.
3. `npm ci && npm test && npm run typecheck`, then `npx vite build && npx vite preview --port 4173` and run the bots (below). `xvfb-run -a node e2e/electron-smoke.cjs` checks the desktop app loads every model, voice, sound and music file.

## Where things stand
- Hearthbay plays end to end: Mara's first jobs, selling at her stall, the shop and notice board, Wick's sketch, Pell's ferry to Gull Point, relighting the lamp, and back. Every quest fish is catchable from the dock.
- The cast is built to feel thrown (wind-up, whip, lure flight on an arc, line paying out, splash by power, camera kick, aim ring); fish shadows roam and one stalks the float before each bite.
- Generated models are in for the player, NPCs, Biscuit the cat, fish, skiff and harbour props (see `docs/ASSETS.md`); stand-ins remain only where a file is missing.
- Sound: 118 recorded effect files, 4 looping themes and 3 stings are wired in (`src/audio/audio.ts`); each one-shot keeps a synth stand-in for a missing file. All 52 voice lines are recorded.
- Sailing (v0.2.0): Pell gives the Keeper's Skiff when the lamp is relit. The player boards it from any shore, sails it freely inside Hearthbay Waters (Kettle Isle, the Teeth, Pip's Bar), fishes from it when it is still, finds places for the chart, travels between known moorings from the chart, and is turned back by the Murmur Fog at the edge. Two more story quests (hb-07 the kettle, hb-08 the Teeth flounder) use it; a sea chest waits on Pip's Bar.
- Economy and gear (v0.3.0): Mara's shelf has four pages (rods and bait with rod tuning, lures and creel, clothes, Lantern Pots); the satchel has a Gear page that totals everything and an Echoes page once the Bell is known. Hearthbay is tuned by the simulator: the skiff at about 23 minutes, pots at 43, the first ring of the Bell between 73 and 79.
- Lantern Pots (v0.3.0): set and hauled with F from shore, dock or the skiff; they trap journal fish on play time only, hold three and stop.
- The Drowned Bell (v0.3.0): the belfry stands on a shoal north-west of Gull Point. Pell's hb-09 finds it, hb-10 rings it; ringing turns the tide (coins and what they bought are taken, Echoes are paid on lifetime coins, the keeper wakes on the dock). Four more quests in all: hb-p1-pots, hb-08b-stall, hb-09-bell, hb-10-turning.
- Settings are separate from the save (Electron `userData/settings.json`, browser localStorage). An unreadable save is quarantined, never overwritten.

## Code map
- `src/core`: pure logic (fishing, economy, quests, saves, world heightfield, dock, `boat.ts` handling, `seaways.ts` route finding, `landing.ts` where a boat floats and a person can step off, `gear.ts` the one fold of every bonus into `stats()`, `pots.ts`, `bell.ts`). Tested in Node.
- `src/data`: JSON content (fish, rods, baits, boats, relics, quests, NPCs, regions with places, NPC spots, critters, ferry points, chart places, moorings, chests).
- `src/game`: glue (game loop, camera, input, town: NPCs, talk, screens, cutscenes; `sailing.ts`: the player's boat, boarding, the helm, discovery, fast travel; `potfield.ts`: pots in the world; `trade.ts`: every buy, tune, wear and Echo button; settings).
- `tools/sim`: the economy simulator (`npm run sim`).
- `src/render`: three.js (world scene, terrain, water with fish shadows, sky, avatar, fishing view: lure, line, float, splashes; `boat-rig.ts`: hull, sail, wake, spray, tiller, where the person sits and stands; NPC figures, cat, fish models, assets).
- `src/audio`: mixer, sound bank, music.
- `src/ui`: DOM HUD (with the helm compass), dialogue and screens (`chart.ts` paints the chart).
- `e2e`: the bots.

## Bots (need `npx vite build && npx vite preview --port 4173`)
| Bot | What it proves |
|---|---|
| `story.cjs` | The whole Hearthbay chain through the real game, quest fish really caught, save and reload (STORY OK) |
| `sail.cjs` | The skiff from Pell, sailed with the real helm keys along routes through the water: Kettle Isle, the kettle, home, the Teeth, a flounder from the boat, the chest on Pip's Bar, the chart and fast travel, running at a beach, the Murmur Fog, a save made at sea (SAIL OK). Helpers in `sail-helpers.cjs` |
| `tide.cjs` | The second half of Hearthbay: the pot job, F to set and haul from the dock and from the boat, every page of the shelf, the Gear page, the belfry by boat and its chest, the first ring of the Bell, what the tide took and kept, an Echo spent, the lines after a Turning, save and reload (TIDE OK) |
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
- 35 lines are not voiced: the four new jobs and the nine lines people say after a Turning. `npm run voice` lists them; the asset thread records them once Lawson has answered about credits (4.84 Higgsfield credits were left on 2026-11-13, a line costs about half a credit).
- The six new sounds (`pot-set`, `pot-haul` x2, `bell-toll`, `echo-buy`, `tide-turn`) are in and levelled by measurement; nobody has heard them in play. A sound asked for but not yet delivered goes in `PENDING` in `src/audio/audio.ts` so its stand-in plays and the smoke test does not look for it.
- No person has played the v0.3.0 slice. Its timings are the simulator's.
- Echoes have ten upgrades to go on and nothing else until the fog lamp exists.
- In the simulator a clumsy keeper (skill 0.4) earns about what a practised one (0.7) does over three hours, and only the best (0.95) pulls ahead, by 10 to 15%. Either the simulated clumsy keeper fights too well or skill pays too little. Worth a look alongside Lawson's feedback on how the fishing feels; `tests/sim.test.ts` only holds that the best is never behind.
- The goal line after the story counts all nine Hearthbay fish (the Manyeye among them) while the journal page counts the eight ordinary ones.
- The sailing sounds, the murmur and the open-water theme were levelled by measurement; nobody has heard them in play.
- Seated at the tiller, the hem of the coat passes through the thwart (it cannot fold). The oars stowed in the skiff model lie beside the helmsman's right hip and at the standing player's knee; the asset thread has offered to move them.
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
- The sail rig has two morph targets, `belly` (0) and `furl` (1). `Sailing.restT` decides when the sail is down: nobody aboard, or still for 1.2 s with no call for way. It is the player's sign that she has settled and a cast will be allowed.
- Sea chests are data (`regions.json chests`: place, coins, baits, a line of text); `town.ts openChest` pays them once (flag `chest:<id>`), and `world-scene.ts` swaps the shut model for the open one.
- `Heightfield.shapeAt` and `landing.ts solid` run hundreds of times a frame at sea: keep them free of allocation.

## Gear, pots and the Bell, for whoever touches them next
- Add a bonus by adding an effect to data (`gear.json`, `echoes.json`, `relics.json`) and, if it is a new kind, one line in `core/gear.ts stats()`. Do not add bonuses anywhere else: the Gear page and the simulator read `stats()`.
- After any tuning change run `npm run sim` and `npx vitest run tests/sim.test.ts`. The tests are the tuning targets; change a target on purpose or not at all.
- Pots tick in `Game.step` through `PotField.step` and only there. Nothing may earn outside the fixed step: no offline earnings is a fixed point of the brief.
- A pot lands further out the higher the keeper stands (`PotField.findSpot`), so it shows past a dock's edge. The prompt sits low while a pot is in reach so it does not cover the float. A press of F hauls or sets; an empty pot is taken up by holding F (`TAKE_UP_HOLD`).
- A fishing session keeps the gear it was cast with. `Game.refreshSession()` rebuilds it at once when the rod is idle and otherwise marks it stale, and the step rebuilds it the moment the line is in. The hook spends `session.ctx.bait.id`, not whatever is on the hook now.
- The v0.3.0 reviewer's proof scripts showed how to test this slice without a browser: small `tsx` scripts against `src/core` and `src/game/talk.ts`.
- `ringBell(state)` in `core/bell.ts` is the whole Turning as far as the save goes; `Town.ringBell()` is the cutscene around it and applies the quest event without a toast until the fade lifts. A new thing the tide should take or keep goes in the core function and in `tests/gear.test.ts`.
- The belfry model leans toward its +X and its bell swings about Z. `world-scene.ts` turns it so its +Z opening faces the rope post, leads the rope from the clapper (`RopeSocket`) over that sill, and re-lays the inside length every frame while the bell moves.
- Bots that play this slice use `window.tide` helpers defined at the top of `e2e/tide.cjs`.
- Two traps for bots, both met while finishing this slice. The game saves as the page leaves (`beforeunload`), so a bot that plants a save in `localStorage` must stop `game.save` first or its own game lands on top. And a job handed in can run straight on into the giver's next offer, where there is no goodbye to pick: turn the offer down first (`e2e/sail.cjs` after the flounder).

## Next steps
The rest of phase 2 in ROADMAP: Mossglass Fen behind the Murmur Fog (the fog lamp, bought with Echoes, is the gate), a second boat, deckhands, more chests, crates and relics. Voice the 35 new lines when credits allow. Act on Lawson's feedback from v0.3.0 first.
