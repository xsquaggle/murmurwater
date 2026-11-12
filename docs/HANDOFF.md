# Handoff

Last updated: 2026-11-12, end of phase 1 (vertical slice), v0.1.0.

## Start here (new session)
1. Read `docs/DIRECTIVE.md` (the brief, verbatim) and this file.
2. Skim `docs/ROADMAP.md` for the phase checklist and `docs/DECISIONS.md` for why things are the way they are.
3. `npm ci && npm test && npm run typecheck`, then `npx vite build && npx vite preview --port 4173` and run the bots (below). `xvfb-run -a node e2e/electron-smoke.cjs` checks the desktop app loads every model, voice, sound and music file.

## Where things stand
- Hearthbay plays end to end: Mara's first jobs, selling at her stall, the shop and notice board, Wick's sketch, Pell's ferry to Gull Point, relighting the lamp, and back. Every quest fish is catchable from the dock.
- The cast is built to feel thrown (wind-up, whip, lure flight on an arc, line paying out, splash by power, camera kick, aim ring); fish shadows roam and one stalks the float before each bite.
- Generated models are in for the player, NPCs, Biscuit the cat, fish, skiff and harbour props (see `docs/ASSETS.md`); stand-ins remain only where a file is missing.
- Sound: 95 recorded effect files, 3 looping themes and 2 stings are wired in (`src/audio/audio.ts`); each one-shot keeps a synth stand-in for a missing file. All 40 voice lines are recorded.
- Settings are separate from the save (Electron `userData/settings.json`, browser localStorage). An unreadable save is quarantined, never overwritten.

## Code map
- `src/core`: pure logic (fishing, economy, quests, saves, world heightfield, dock). Tested in Node.
- `src/data`: JSON content (fish, rods, baits, quests, NPCs, regions with places, NPC spots, critters, ferry points).
- `src/game`: glue (game loop, camera, input, town: NPCs, talk, screens, cutscenes; settings).
- `src/render`: three.js (world scene, terrain, water with fish shadows, sky, avatar, fishing view: lure, line, float, splashes; NPC figures, cat, fish models, assets).
- `src/audio`: mixer, sound bank, music.
- `src/ui`: DOM HUD, dialogue and screens.
- `e2e`: the bots.

## Bots (need `npx vite build && npx vite preview --port 4173`)
| Bot | What it proves |
|---|---|
| `story.cjs` | The whole Hearthbay chain through the real game, quest fish really caught, save and reload (STORY OK) |
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
- The Hollow Lantern is only at the Teeth (needs a boat): Hearthbay journal is 8 of 9 until phase 2.
- Steep harbour cliff shows large flat facets; Gull Point arrival faces the hillside; some houses float slightly.
- Nobody has heard the mix: levels are set by measurement (`e2e/audio.cjs`). To check by ear: line snap, bite dunk, hook set, the day theme's instruments, music against voices; Mara's "Your aunt's, it was" and "stall", Pell's "Gull Point".
- Frame times on the RTX 3060 target are unmeasured (Lawson reads F3).
- On Windows, Esc both leaves mouse capture and opens the pause screen; watch for a flicker.
- Story bot run is slow on SwiftShader (about 6 minutes).

## Next steps
Phase 2 in ROADMAP: economy simulator and tuning, boats and free sailing (the skiff first), automation that only earns while the game is open, the Bell (prestige), Mossglass Fen. Act on Lawson's feedback from v0.1.0 first.
