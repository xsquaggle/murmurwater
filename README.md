# Murmurwater

A cozy-but-weird fishing incremental for Windows PC. Stylized low-poly 3D, built with three.js and Electron.

> Status: vertical slice (Hearthbay). See `docs/ROADMAP.md`.

## Play it on Windows
1. Open the [Releases page](https://github.com/xsquaggle/murmurwater/releases) and take the newest release.
2. Download either file:
   - `Murmurwater-<version>-portable.exe`: double-click to play, nothing is installed.
   - `Murmurwater-<version>-setup.exe`: installs the game with Start-menu and desktop shortcuts.
3. The app isn't code-signed yet, so Windows SmartScreen may warn you. Choose **More info**, then **Run anyway**.

Your save lives in `%APPDATA%\Murmurwater\save.json` (with a `save.bak.json` backup) and your settings in `settings.json` next to it.

## Controls (rebindable in Settings)
| Action | Keys |
|---|---|
| Walk / run | W A S D (arrow keys), Left Shift |
| Look around | Mouse (click the game to capture it) |
| Cast, hook, reel | Hold left mouse or Space; release in the bright band for a clean cast |
| Steer a fighting fish | A / D |
| Reel in / cancel | Right mouse or Q |
| Talk / interact | E |
| Satchel (catch, gear, journal, quests) | Tab or I; J opens the journal |
| Pause and settings | Esc |
| Performance overlay (fps, frame times) | F3 |

## Develop
```
npm ci
npm run dev           # play in the browser at http://localhost:5173
npm test              # unit tests (quests, talk, saves, layout, economy)
npm run typecheck
npm run sim           # economy and fight simulator
npm run voice         # voice script (docs/voice) and recording status
npm run electron:dev  # build and run the desktop app
npm run dist:win      # Windows installer and portable exe (on Windows)
```
Bots (need `npx vite build && npx vite preview --port 4173` running): `node e2e/story.cjs shots/story` plays the whole Hearthbay story, `node e2e/play.cjs shots` the core loop, `node e2e/poses.cjs shots/poses` renders the player's poses.

Releases are built by the **Release** workflow in GitHub Actions (run it by hand with a tag such as `v0.1.0`); release notes come from `docs/release-notes/<tag>.md`.

## Docs
- `docs/DIRECTIVE.md`: the project brief
- `docs/DESIGN.md`: game design
- `docs/ART_BIBLE.md`: the look
- `docs/TECH.md`: technical plan
- `docs/ASSETS.md`: every generated model, clip and sound, with sources and licences
- `docs/ROADMAP.md`: phases and status
- `docs/DECISIONS.md`: decision log
- `docs/HANDOFF.md`: where things stand
