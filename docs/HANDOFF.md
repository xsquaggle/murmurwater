# Handoff

Last updated: 2026-11-16, phase 2 third slice (the Fog Lamp, the sea-road, Mossglass Fen), released as v0.4.0. The next slice is deckhands and the second boat.

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
- Mossglass Fen (v0.4.0): the second region, north-west across the Murmur Fog. Pell's hb-11 asks for the Fog Lamp (8 Echoes, satchel), hb-12 sends the keeper down the old sea-road past the belfry. At Sedge Landing: Dr. Calloway (six jobs, fen-01 to fen-06), Mara's packet box (sells and has her shelf), a notice board that asks for Fen fish. Ten fish, the Fenwood Rod, two baits, a lure, two wearables, two relics, three chests, six chart places, the Mossglass page of the journal. In the simulator: the lamp at about 75 minutes, the Fen at 80, Calloway's last job at 150, the page at 165, the Listener for nine keepers in ten inside seven hours.
- Settings are separate from the save (Electron `userData/settings.json`, browser localStorage). An unreadable save is quarantined, never overwritten.

## Code map
- `src/core`: pure logic (fishing, economy, quests, saves, world heightfield, dock, `boat.ts` handling, `seaways.ts` route finding, `landing.ts` where a boat floats and a person can step off, `gear.ts` the one fold of every bonus into `stats()`, `pots.ts`, `bell.ts`, `content.ts` with the regions, sea-roads and `regionAhead`, `flora.ts` where trees stand in the water). Tested in Node.
- `src/data`: JSON content (fish, rods, baits, boats, relics, quests, NPCs, regions with places, NPC spots, critters, ferry points, chart places, moorings, chests).
- `src/game`: glue (game loop, camera, input, town: NPCs, talk, screens, cutscenes; `sailing.ts`: the player's boat, boarding, the helm, discovery, fast travel; `potfield.ts`: pots in the world; `trade.ts`: every buy, tune, wear and Echo button; settings).
- `tools/sim`: the economy simulator (`npm run sim`).
- `src/render`: three.js (world scene, terrain, water with fish shadows, sky, avatar, fishing view: lure, line, float, splashes; `boat-rig.ts`: hull, sail, wake, spray, tiller, the Fog Lamp, where the person sits and stands; NPC figures, cat, fish models, assets; `looks.ts`: a region's colours; `sea-road.ts`: the lights in the fog; `fen-scene.ts`: reeds, the grove, lilies, night lights; `fen-props.ts`: data-driven props with stand-ins; `region-prep.ts`: the next region's ground made ahead of the crossing).
- `src/audio`: mixer, sound bank, music.
- `src/ui`: DOM HUD (with the helm compass), dialogue and screens (`chart.ts` paints the chart).
- `e2e`: the bots.

## Bots (need `npx vite build && npx vite preview --port 4173`)
| Bot | What it proves |
|---|---|
| `story.cjs` | The whole Hearthbay chain through the real game, quest fish really caught, save and reload (STORY OK) |
| `sail.cjs` | The skiff from Pell, sailed with the real helm keys along routes through the water: Kettle Isle, the kettle, home, the Teeth, a flounder from the boat, the chest on Pip's Bar, the chart and fast travel, running at a beach, the Murmur Fog, a save made at sea (SAIL OK). Helpers in `sail-helpers.cjs` |
| `tide.cjs` | The second half of Hearthbay: the pot job, F to set and haul from the dock and from the boat, every page of the shelf, the Gear page, the belfry by boat and its chest, the first ring of the Bell, what the tide took and kept, an Echo spent, the lines after a Turning, save and reload (TIDE OK) |
| `fog.cjs` | The way to Mossglass Fen: Pell's lamp job, the fog turning her back without it, the Fog Lamp bought with Echoes, the sea-road sailed with the real helm, the change of waters in the thick of the fog (and that the ground was ready before it), Calloway, fish off the jetty, the packet box and its shelf, the Fen's notice board, the stake, the ear trumpet, the chart across the fog both ways, a save made in the Fen, a v4 save from before the Fen (FOG OK). Helpers `window.fog` at the top of the file |
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
- 90 of 142 lines are not voiced: all of Calloway, Pell's hb-11 and hb-12, and the 35 from v0.3.0. `npm run voice` lists them; the asset thread records them once Lawson has answered about credits (4.84 Higgsfield credits were left on 2026-11-13, a line costs about half a credit). The decision card about buying credits is still open in the project thread.
- Calloway is a stand-in figure (`npc-figure.ts`, key `npc:calloway` in `PENDING_MODELS`). The asset thread is trying her in code; a generated model waits on credits.
- The Fen has no music of its own: ashore only the fen's ambience plays, under sail by day the open-water theme. Themes wait on credits.
- The ten Fen sounds (`fog-lamp-light`, `sea-road-chime` x3, `fog-cross`, `packet-box`, `reed-brush` x2, loops `fen-day` and `fen-night`) and the six from v0.3.0 are in and levelled by measurement; nobody has heard them in play. A sound asked for but not yet delivered goes in `PENDING` in `src/audio/audio.ts` so its stand-in plays and the smoke test does not look for it; it is used from the build its first file is in.
- No person has played the v0.3.0 or v0.4.0 slices. Their timings are the simulator's.
- The Fen draws about 0.76 M triangles a frame on Medium (Hearthbay 0.44 M), most of it reeds and the grove with their shadows. Unmeasured on the 3060.
- Where the Sump's deep water meets the shallows the bed shows coarse facets. Reed sheaves are coarse at arm's length.
- A keeper who buys the lamp and sails to the Fen before taking hb-12 from Pell is offered fen-01 by Calloway first. hb-12, taken later, is ready at once (a place already found counts when a job is taken) and is handed to Calloway. Harmless, but the order reads oddly.
- The route finder knows one region's water at a time and does not plan from inside the fog: bots pilot along the road and back to a road end first (`window.fog.pilot`).
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

## Regions and the Fen, for whoever touches them next
- One coordinate space for the whole sea. A region is a disc (`centre`, `radius` 700) in `regions.json`; its last 110 m is fog. A sea-road (`ROADS` in `core/content.ts`: ends `a` and `b`, `halfWidth`, the two regions) is the only way through, and only with the Fog Lamp. `tests/roads.test.ts` holds that the road joins quiet water to quiet water, that the murmur lifts only down its middle, that the region changes half way along and only on the road, and that a boat with the lamp gets across while one without is turned back.
- Only the active region is built. `Game.enterRegion(id)` tears down the old `WorldScene` and builds the new one in the same three.js scene; `arriveIn(state, id)` in `core/quests.ts` is the save's side of it (region, discovered, the `reached:<id>` flag, a fresh notice board). The swap happens at half way along the road, or under the fade of a chart journey.
- The pause at the swap is short because the ground is already made: `Game.step` asks `regionAhead` while the skiff is on a road and `RegionPrep.pump` builds the terrain a few milliseconds a frame (`terrainSteps`, a generator). `Game.lastSwap` records what the swap cost; the fog bot holds `readyBefore === 1`. Anything new that is slow to build for a region should be given to `RegionPrep` the same way, not built in the `WorldScene` constructor.
- The ground is two meshes: the land (casts shadows) and the bed below the waterline as its child (does not), with flat bed drawn as coarse fans. `tests/terrain.test.ts` checks every face looks up and no edge is left open. The lattice is jittered, so a cell picks whichever diagonal does not make a sliver.
- Goods, places and props are data. `from: "reached:<region>"` on a rod, bait or lure puts it on every shelf once that region is reached. A look-at place (`places` with `prompt`, `text`, `flag`, `dark`) is the stake and the ear trumpet. A region's `props` name a model in `fen-props.ts SPECS`, which has a stand-in for each; `block` gives it a solid circle. An NPC with `thing: true` is not a person (the packet box): it has no voice, its one line is read the first time only, and it has its own sound.
- A quest can be handed in to someone other than its giver (`receiver`); `handsInTo(q)` is who.
- Reeds and other thin leaves use `fen-scene.ts swaying()`: lit mostly as if facing the sky, plus light through the leaf toward a low sun (taken from the sun's strength more than its hue, or dusk turns them crimson).
- The water shader has a float `uTurbid` (clearness); `uMurk` is the sky's vec4 for the fog and the two must not share a name (a redefinition made the water vanish in both regions, and only a browser shows it).
- Audio in the Fen: `AudioState.fen` turns the gulls off, lowers the lapping and brings up `fen-day` and `fen-night`, which cross over at dusk and dawn. The three road chimes are picked in order (`sfx(..., { pick })`) so a row of lights plays a rising tune.
- The simulated keeper (`tools/sim/player.ts`) crosses to the Fen for jobs and for better fishing, takes her pots up first, and after the story fills the journal. `tests/sim.test.ts` holds the Fen's bands.

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
The rest of phase 2 in ROADMAP: deckhands (Biscuit and Mister Hollis, who fish from the boat or dock while the game is open), the second boat, more chests, crates and relics. Voice the 90 unvoiced lines, give the Fen its music and Calloway her model when credits allow. Act on Lawson's feedback on v0.2.0 to v0.4.0 first: none has come yet.
