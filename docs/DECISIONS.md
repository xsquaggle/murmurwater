# Decision log

Newest first. Each entry: date, decision, why.

## 2026-11-12 — Recorded sound through a bank with synth stand-ins; the mix is measured
Every recorded one-shot (`public/audio/sfx/<name>_<n>.ogg`) plays through `AudioEngine.sfx`, which picks a variation other than the last one and drifts the pitch a little; if the file has not loaded the old synth version plays instead, so nothing is ever silent. Values that change every frame (cast charge creak, line hum) stay procedural. Music decodes one track at a time (a 140 s stereo track is about 50 MB decoded) and crossfades; it dips under voice lines. Why measured: nobody on the team can hear, so `e2e/audio.cjs` plays each sound over the music and sea bed and prints peak and RMS at the output; the rule is no clipping and foreground peaks at least 12 dB over the bed's average. Lawson's ear is the final check.

## 2026-11-12 — Conversation camera: a two-shot from the side
While talking, the camera swings about 55 degrees off the line between player and NPC, onto the side with a clear view (no prop or hill in the way), preferring the smaller swing, and swings back afterwards. Why: straight behind the player, the player's own back hid whoever they were talking to (worst with Wick, who is small).

## 2026-11-12 — Solid world by circles
Houses, the stall, the board, dock crates and villagers are circles `[x, z, radius]`; the player slides around them. Why: cheap, no physics engine, and good enough for a harbour of round-ish things. `e2e/walk.cjs` walks at each with the real keys so a blocker can never seal off someone you must talk to.

## 2026-11-12 — Story fish must be catchable where the story happens
Every fish a Hearthbay quest asks for lists the dock as a zone (tested), and the story bot catches them for real instead of being handed them. Why: the fresh reviewer found the Lampjaw could only be caught from a boat that does not exist yet, which the bot had hidden by granting the fish.

## 2026-11-12 — An unreadable save is quarantined, never overwritten
If both the save and its backup fail to parse, they are renamed `*.corrupt-<time>.json` and a new game starts with a notice; the backup only ever rotates a save that parses. Why: the old behaviour started a new game and the next autosave destroyed the evidence.

## 2026-11-12 — The cast: a pendulum lure, a real flight path, and the camera stays with the angler
The lure hangs half a metre off the rod tip as a pendulum while winding up, is slung for a tenth of a second on release, then flies a parabola whose height grows with power and distance; the line follows the path the lure flew and settles onto the water. The landing splash, float plunge and ripples scale with power. The camera's pivot stays on the player's head and only its aim point slides out towards the lure, with a small kick and a wider view on release. Why: Lawson said the cast "barely feels like it's getting thrown"; the old cast teleported a float along a fixed arc and slid the whole camera out over the water.

## 2026-11-12 — Fish shadows are drawn in the water shader
Fourteen shadows (thirteen roaming, one "biter") are positions and headings in uniform arrays; the water fragment shader draws each as a soft fish silhouette, wobbled by the ripple normal, darkening the water body under the surface highlights. The biter's distance from the float is driven by the fishing session's time to the next nibble or bite, so what you see is what is about to happen. Why: real meshes under a transparent water surface fight the depth fade and the foam; in the shader they sit under the surface for free and cost one loop.

## 2026-11-12 — Player rod: authored clips at rest, procedural while fishing
Walking about, the player plays the authored rod_idle/rod_walk/rod_run clips and the rod sits in the hand's RodSocket. While fishing, the rod's grip follows a sprung target driven by power, tension and the fish's run; two-bone IK brings the right fist onto the grip, turned so the socket lines up with the rod, and the left hand onto the reel. The body underneath plays the authored fishing stance (rod_wait) and leans with rod_lean_left/right. Why: the fight has to answer the fish frame by frame, which canned clips can't do, but the authored clips give the body weight and the fists a real grip. A landed fish uses the authored show_catch clip and sits in CatchSocket.

## 2026-11-12 — Voice lines are matched to their text by hash
`npm run voice` writes the script (docs/voice) from the quest and NPC data, with an FNV-1a hash of each line. Recordings are listed with that hash in public/audio/voice/voiced.json and the game plays a file only when its hash matches the line's current text. Why: dialogue will keep being edited, and a stale recording saying different words from the subtitle is worse than silence. The script also reports missing and stale recordings.

## 2026-11-12 — Gull Point by ferry, not a land bridge
Pell rows the player out once the relight quest starts (and always back). Why: the island is the payoff of the first arc, a short fade-and-arrive keeps the pacing tight before boats exist, and it introduces the skiff that becomes the first boat.

## 2026-11-12 — Save v2: the notice board's state lives in the save
The board's generated jobs, their refresh timer and serial are saved, with a v1 → v2 migration and fixtures for both. Why: a reload must not reroll or refresh jobs (that would be an exploit and feel random).

## 2026-11-12 — Harbour layout: walkable deck to the shore, landing with stall and board
The dock deck runs back onto the shore so there is no gap to fall through, and widens into a landing that carries Mara's stall and the notice board. NPC spots, places and ferry landings are all checked walkable by a unit test. Why: v0.0.1 could strand the player on the dock; the landing gives the harbour a centre the player returns to.

## 2026-11-12 — Voiced dialogue (Lawson)
Every NPC line is voiced with Higgsfield text-to-speech, one consistent voice per character, generated from the dialogue data files so the text and audio never drift. Lines stay short (see DESIGN §10.4), which suits voicing. Sound effects come from ForgeGUI's sound-effect generator and from procedural WebAudio (reel clicks, line hum, water), music from the music generators. Voice files are tracked in docs/ASSETS.md and regenerated by a script when a line changes.

## 2026-11-12 — Higgsfield credits: no spending limit (Lawson)
Lawson lifted the cap on spending *existing* Higgsfield credits and asked for the highest-fidelity models I can reach ("as if they've had three fidelity passes"; cartoony is fine). Buying credits or plans still needs their approval. Consequence: generated 3D is now the default for hero assets (player, NPCs, boats, landmarks, set-piece fish), each taken through generate → clean-up → restyle-to-palette → optimize. The procedural-fish decision below is re-opened: I will A/B a generated fish against the procedural one and keep whichever reads better in game.

## 2026-11-12 — Subagent model policy (Lawson's standing rule)
Every subagent runs on Opus 5.5 at extra-high (xhigh) effort by default. Fable 5.2 is used for a subagent only where the work needs it (3D modelling, the hardest coding). Why: Lawson's instruction in the project thread.

## 2026-11-12 — Procedural fish models from parameters
Fish are built in code from a per-species shape description (body profile, fins, eyes, colours) rather than one generated mesh each. Why: ~60+ species must look like one game and stay in palette; code guarantees consistency, costs no credits, makes Strange traits (extra eyes, inverted colours) trivial, and keeps the roster fully data-driven. Generators are reserved for hero assets (player, NPCs, boats, landmarks) where hand-modelling in code would look worse.

## 2026-11-12 — Prestige keeps story, gear ownership and the map
The Drowned Bell resets coins and upgrade *levels* but keeps owned gear, boats, relics, story and discovered regions. Why: rebirth should feel like a fast, powerful rerun, not a punishment; resetting story or the chart would create the dead stretches the directive forbids.

## 2026-11-12 — No offline earnings; automation only while open
Directive fixed point. Load ignores elapsed real time.

## 2026-11-12 — Working title "Murmurwater"
Evokes the humming sea at the centre of the mystery, cozy and slightly wrong. "Lanternwake" was considered and dropped: the name is already used by games on itch.io.

## 2026-11-12 — Engine: three.js + TypeScript + Vite, packaged with Electron
Considered Godot 4, three.js/Electron, Babylon.js/Electron, Tauri.
- **Testability:** my session can run headless Chromium with WebGL2 (SwiftShader verified) and take real screenshots of the actual renderer; logic runs in Node under vitest with no engine. Godot headless cannot render without a GPU here, so visual verification would be weaker.
- **Visual ceiling:** custom GLSL water/sky/toon shaders and a postprocessing chain reach the target stylized look; on an RTX 3060 WebGL2 is far from the bottleneck for low-poly scenes.
- **Build reliability:** electron-builder on GitHub's windows-latest runner is a well-trodden path to an installer and portable exe.
- **Tauri** rejected: WebView2 rendering/perf varies by machine; Electron ships a known Chromium.
- **Babylon.js** is equally capable; three.js chosen for its smaller core, shader control and ecosystem.
Trade-off accepted: larger download (~100 MB) than a Godot export.

## 2026-11-12 — Repo setup
The session cannot create repositories, so Lawson created `xsquaggle/murmurwater` (public, empty) on request.

## 2026-11-12 — 3D-Assets repo checked
`xsquaggle/3D-Assets` holds one model (`crate_input.glb`). Will evaluate it for the crate loot prop against the art bible.
