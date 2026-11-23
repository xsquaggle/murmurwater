# Murmurwater — Roadmap

Phases are milestones; each ends with a build, a report in the project thread, a fresh reviewer pass and a HANDOFF update.

| # | Phase | Goal | Status |
|---|---|---|---|
| 0 | Pre-production | Vision, design, art bible, tech plan, repo, CI skeleton, style refs | Done (v0.0.1) |
| 1 | Vertical slice | Hearthbay at final quality: water, sky/time, lighthouse, dock, cast/bite/hook/fight feel, 8 fish, sell, 2 rods, first quest chain, save/load, settings, Windows build on a Release | Done (v0.1.0) |
| 2 | Production A | Economy core + simulator, gear/bait/lures/wearables, boats + free sailing + discovery + fast travel, Mossglass Fen, automation, the Bell (prestige), notice board | Done but for voices and music that wait on credits (v0.2.0: boats; v0.3.0: economy, gear, Lantern Pots, the Bell; v0.4.0: Mossglass Fen; v0.5.0: deckhands and the Puffin; v0.6.0: things fished up, relics and the Keeper's Shelf) |
| 3 | Production B | Saltbone Reach, The Hush, Sunken Lanterns; relics, chests, crates fully populated; story chain through act 4 | Under way (v0.7.0: Saltbone Reach) |
| 4 | Alpha (content complete) | Still Eye finale + ending + postgame; all fish/gear/quests in; automated full playthrough passes | |
| 5 | Beta (balance + polish) | Simulator-tuned 10–15 h arc, audio pass, VFX pass, perf pass, onboarding pass, controller decision, reviewer playtests | |
| 6 | Release 1.0 | Final Windows build on GitHub Release, README, final report | |

## Phase 0 checklist (done)
- [x] Stack + working title; repo; DIRECTIVE saved; DESIGN, ART_BIBLE, TECH, ROADMAP, DECISIONS, HANDOFF v1
- [x] Scaffold (Vite + TS + three + Electron), CI test workflow, release workflow
- [x] Rendering prototype reviewed against the art bible; fishing feel prototype with tests
- [x] Style reference images locked; first Windows build on a Release (v0.0.1)

## Phase 1 checklist (vertical slice)
- [x] Generated player, 9 fish, skiff, harbour props, Mara, Pell, Wick, Biscuit, stall, notice board
- [x] Player animation: authored rod clips + procedural rod and IK while fishing; show-catch
- [x] Quest engine, Hearthbay story chain (6 quests), notice board jobs, relics; save v2 with migration
- [x] Town: NPCs with idle/talk/wave/sit, dialogue with choices, shop, satchel (hold, gear, journal, quests), pause, settings with key rebinding
- [x] Ferry to Gull Point; lighting the lighthouse lamp
- [x] Story bot plays the whole chain; playtest bot; unit tests for quests, talk, saves, layout
- [x] Voice lines for all 40 lines (asset thread, Higgsfield)
- [x] Art pass: finer terrain with softer facets, cobble and dirt detail, Gull Point path, house footings
- [x] Lighting: brighter dusk and night fill, a lantern glow on the player at night, lit lighthouse with a beam
- [x] Sound effects and music (asset thread), wired in with an audio bot that measures the mix
- [x] Cast feel pass (thrown lure, line, splash, camera, sound) and fish shadows that stalk the float
- [x] Fresh reviewer pass and fixes: quest fish reachable, solid props, save safety, input, conversation camera
- [x] F3 performance overlay
- [ ] Frame profiling on the 3060 target (Lawson reads F3 on their PC)
- [x] v0.1.0 Windows build on a Release, milestone report

## Phase 2 checklist
- [x] Boats and free sailing: handling model, boarding and landing, helm camera and compass, wake, sail, fishing from the boat (v0.2.0)
- [x] Discovery, the chart, fast travel between moorings, the Murmur Fog at the region's edge (v0.2.0)
- [x] Story quests 7 and 8 (the kettle, the Teeth), first relic from a place, first sea chest (v0.2.0)
- [x] Sailing bot; content tests that every mooring, place, quest ground and chest can be reached by boat
- [x] Economy simulator and tuning; rod tuning, baits, lures, creel and wearables as real choices (v0.3.0)
- [x] Automation that only earns while the game is open: Lantern Pots (v0.3.0)
- [x] The Drowned Bell (prestige): the belfry, Echoes and their ten upgrades, the Turning (v0.3.0)
- [x] Story quests 8b, 9 and 10 and the pot job; tide bot; save v4 (v0.3.0)
- [x] Mossglass Fen behind the fog: the Fog Lamp (Echoes), the sea-road, the region, Dr. Calloway's six jobs, ten fish, Mara's packet box, the chart across regions (v0.4.0)
- [x] Fog bot; region tests (roads, terrain, the hand-over at the crossing); the simulator plays through the Fen (v0.4.0)
- [x] Deckhands (Biscuit, Mister Hollis) who fish from the boat while the game is open, the crew basket, the second boat (the Puffin) and Pell's boatyard; save v5 (v0.5.0)
- [x] Crew bot; two tester's starts; the simulator hires the crew and buys the Puffin (v0.5.0)
- [x] Dr. Calloway's model, built in code by the asset thread (v0.4.0)
- [ ] The Fen's music, voices for the 121 unvoiced lines (wait on credits)
- [x] Things fished up: crates, sea chests and relics on the line, the haul, eight new relics with rumours, the Keeper's Shelf, Moonpearls set beside relics; save v6 (v0.6.0)
- [x] Finds bot; a third tester's start; the simulator hauls, follows rumours and sets pearls (v0.6.0)

## Phase 3 checklist
- [x] Saltbone Reach: the whale-road and its swell, the region, storms that keep hours, struck water, Captain Oake's six jobs, ten fish, the Whalebone Rod, the almanac; no new save state (v0.7.0)
- [x] Reach bot; a fourth tester's start; the simulator crosses to the Reach and fishes its storms (v0.7.0)
- [ ] Captain Oake's model and the Reach's recorded sounds (asset thread, groups 5 and 6)
- [ ] The Hush
- [ ] The Sunken Lanterns
- [ ] The story chain through act 4
- [ ] Voices and music for everything since v0.3.0 (wait on credits)
