# Handoff

Last updated: 2026-11-12, phase 1 (vertical slice), heading for v0.1.0.

## Start here (new session)
1. Read `docs/DIRECTIVE.md` (the brief, verbatim) and this file.
2. Skim `docs/ROADMAP.md` for the phase checklist and `docs/DECISIONS.md` for why things are the way they are.
3. `npm ci && npm test && npm run typecheck`, then `npx vite build && npx vite preview --port 4173` and `node e2e/story.cjs shots/story` (about 6 minutes on SwiftShader; prints STORY OK).

## Where things stand
- Hearthbay plays end to end: Mara's first jobs, selling at her stall, the shop and notice board, Wick's sketch, Pell's ferry to Gull Point, relighting the lamp, and back.
- Generated models are in for the player, NPCs, Biscuit the cat, fish, skiff and harbour props (see `docs/ASSETS.md`); stand-ins remain only where a file is missing.
- Settings are separate from the save (Electron `userData/settings.json`, browser localStorage).
- Voice lines: script in `docs/voice/` (`npm run voice`); recordings go in `public/audio/voice/` and are listed in `voiced.json`.

## Code map
- `src/core`: pure logic (fishing, economy, quests, saves, world heightfield, dock). Tested in Node.
- `src/data`: JSON content (fish, rods, baits, quests, NPCs, regions with places, NPC spots, critters, ferry points).
- `src/game`: glue (game loop, input, town: NPCs, talk, screens, cutscenes; settings).
- `src/render`: three.js (world scene, terrain, water, sky, avatar, NPC figures, cat, fish models, assets).
- `src/ui`: DOM HUD, dialogue and screens.
- `e2e`: story bot, playtest bot, pose sheet, shot tool, model inspector.

## Companion thread
The asset thread ("Generate and import game assets") makes models, clips and voice with Higgsfield and Blender and pushes them to main. It documents every file in `docs/ASSETS.md`.

## Known issues
- Steep harbour cliff shows large flat facets; Gull Point arrival faces a dark hillside; some houses float slightly.
- No voice recordings yet (lines play silently with subtitles).
- Story bot run is slow on SwiftShader (about 6 minutes).

## Next steps
Phase 1 checklist in ROADMAP: voice, art pass, profiling, v0.1.0 release and report. Then phase 2 (economy simulator, boats and sailing, automation, the Bell).
