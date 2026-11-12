# Murmurwater — Roadmap

Phases are milestones; each ends with a build, a report in the project thread, a fresh reviewer pass and a HANDOFF update.

| # | Phase | Goal | Status |
|---|---|---|---|
| 0 | Pre-production | Vision, design, art bible, tech plan, repo, CI skeleton, style refs | Done (v0.0.1) |
| 1 | Vertical slice | Hearthbay at final quality: water, sky/time, lighthouse, dock, cast/bite/hook/fight feel, 8 fish, sell, 2 rods, first quest chain, save/load, settings, Windows build on a Release | **In progress** (v0.1.0) |
| 2 | Production A | Economy core + simulator, gear/bait/lures/wearables, boats + free sailing + discovery + fast travel, Mossglass Fen, automation, the Bell (prestige), notice board | |
| 3 | Production B | Saltbone Reach, The Hush, Sunken Lanterns; relics, chests, crates fully populated; story chain through act 4 | |
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
- [ ] Lighting pass for dusk (19:00 reads too dark near the ground)
- [ ] Sound effects and music (asset thread)
- [x] F3 performance overlay
- [ ] Frame profiling on the 3060 target (Lawson reads F3 on their PC)
- [ ] v0.1.0 Windows build on a Release, milestone report, fresh reviewer pass
