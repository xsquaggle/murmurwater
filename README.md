# Murmurwater

A cozy-but-weird fishing incremental for Windows PC. Stylized low-poly 3D, built with three.js and Electron.

> Status: three waters, two boats, a crew, things on the bottom that are not fish, and weather. Hearthbay with a boat of your own, gear worth choosing, Lantern Pots and the Drowned Bell; a lamp for the fog and Mossglass Fen beyond it; a cat and a gentleman of fog who fish from your boat, and the Puffin to carry them; crates, sea chests and relics hauled up on the line, and the Keeper's Shelf to stand them on; and over the whale-road Saltbone Reach, where three storms keep hours and the best fishing is where the lightning has just gone into the sea (v0.7.0). See `docs/ROADMAP.md`.

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
| Talk / interact, board the boat, step ashore | E |
| Sail | W fills the sail, S checks her and backs water, A / D put the tiller over |
| Set or haul a Lantern Pot (hold to take an empty one up) | F |
| Chart (once you have a boat) | M |
| Satchel (catch, gear, journal, quests, Echoes) | Tab or I; J opens the journal |
| Pause and settings | Esc |
| Performance overlay (fps, frame times) | F3 |

## Develop
```
npm ci
npm run dev           # play in the browser at http://localhost:5173
npm test              # unit tests (quests, talk, saves, layout, economy, the boat, the sea, the ground, the weather, the simulator's bands)
npm run typecheck
npm run sim           # economy and fight simulator
npm run voice         # voice script (docs/voice) and recording status
npm run electron:dev  # build and run the desktop app
npm run dist:win      # Windows installer and portable exe (on Windows)
```
Tester's starts: F8 on the title screen opens a save at the start of the newest slice, F8 again the slices before it one at a time, and at last your own game (nothing in a tester's start is saved, and your own save is not touched). `npm run tester-save` makes those saves again from the simulator.

Bots (need `npx vite build && npx vite preview --port 4173` running):
- `node e2e/story.cjs shots/story` plays the whole Hearthbay story
- `node e2e/sail.cjs shots/sail` takes the skiff round Hearthbay Waters with the real helm keys
- `node e2e/tide.cjs shots/tide` Lantern Pots, the shelf, the Drowned Bell and the first Turning
- `node e2e/fog.cjs shots/fog` the Fog Lamp, the sea-road and Mossglass Fen
- `node e2e/crew.cjs shots/crew` the cat at work, Pell's boatyard, the Puffin, Mister Hollis (from the tester's start)
- `node e2e/finds.cjs shots/finds` the Shelf and its pearls, a crate and a chest hauled up, a relic fished from Lantern Cove by night (from the tester's start)
- `node e2e/reach.cjs shots/reach` the whale-road, Saltbone Reach, Captain Oake, a storm with its struck water and its eye (from the tester's start)
- `node e2e/play.cjs shots` the core loop
- `node e2e/walk.cjs shots/walk` walks into everything solid and up to everyone
- `node e2e/shadows.cjs shots/shadows` follows a fish shadow to the bite
- `node e2e/audio.cjs` checks every sound loads and measures the mix
- `node e2e/cast.cjs shots/cast` frame-by-frame sheets of a cast; `node e2e/poses.cjs shots/poses` the player's poses

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
