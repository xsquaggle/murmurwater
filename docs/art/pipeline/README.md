# Asset pipeline scripts

The scripts that turn generated meshes into the GLBs in `public/models/`. They are kept here for reproducibility and are not part of the game build.

Setup, in any scratch folder: create `tools/`, copy these files into it, then
`npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp three gl-matrix playwright`.

| Script | What it does |
|---|---|
| `splitsheet.py` | Cuts a character turnaround sheet into four square views (front, facing-left, back, facing-right) at one shared scale, for multi-view image-to-3D. |
| `optimize.mjs` | Static meshes: weld, simplify to a triangle budget, drop normal/ORM maps, bake orientation, scale and origin into the vertices (`--fit w,h,d` for a mild non-uniform fit), build an emissive map, compress textures to WebP. |
| `merge-anim.mjs` | Characters: merges several single-clip auto-rig outputs of the same mesh into one GLB with named clips. Each auto-rig job returns a different skeleton, so clips are retargeted through the skinning matrices onto the first file's skeleton. Also removes the armature's 0.01 scale so the skeleton is in metres. Per-clip flags: `:inplace` removes root drift, `:anchor` starts the clip over the model origin, `:trim=a-b` keeps part of it. |
| `emissive.mjs` | Shared by the two scripts above: builds the glow map from warm bright texels, optionally limited to a 3D box. |
| `author-anim.mjs` + `wick-clips.mjs` | Wick's sketchbook clips: the same solver without finger joints (`--fingers 0`), arms authored on top of the library idle, look and talk clips, plus the `BookSocket` empty. `node author-anim.mjs wick.glb out.glb wick-clips.mjs --fingers 0`. |
| `author-anim.mjs` + `player-clips.mjs` | Player fishing clips. Adds four finger joints (found from the hand geometry) and the `RodSocket` and `CatchSocket` empties, then bakes clips described as pose specs (hips, spine, look target, hand targets solved with two-bone IK, finger curl) on top of the rest pose or a frame of a library clip. `node author-anim.mjs player.glb out.glb player-clips.mjs --drop cast`. |
| `rig-cat.mjs` | Biscuit: builds a quadruped skeleton, skin weights (geometric segmentation plus Laplacian diffusion) and procedural walk, idle and sit clips. `node rig-cat.mjs stand in.glb out.glb` (or `sit`). |
| `render.mjs` + `viewer.html` | Renders a turntable contact sheet (or frames of a clip) with three.js in headless Chromium and prints triangle count, bounds and clip list. `dark=1` shows only the emissive parts; `rod=1` and `fish=1` draw a debug rod and fish on the sockets; `focus=x,y,z,r` fixes the camera target. |
| `clip-sheet.sh`, `pose-sheet.sh` | Clip strips (one row per clip, six frames) and pose comparisons, built on `render.mjs` and ImageMagick. |

Conventions for every model: glTF, +Y up, metres, front (face, mouth, bow) toward +Z, one material, base-colour texture in WebP (`EXT_texture_webp`), metallic 0, roughness 0.9, no mesh compression.

## Voice lines (`voice/`)

The scripts that turn generated speech into the files in `public/audio/voice/`. Setup: Python 3 with `torch transformers soundfile numpy scipy faster-whisper speechbrain`, ffmpeg with libmp3lame and libsoxr, and Playwright for the browser check. Raw takes are not kept in the repo; each line's job id is in `takes.json` and `docs/ASSETS.md`.

| File | What it does |
|---|---|
| `takes.json` | One entry per line: the take that was kept, its generation job id, the voice id, the text hash and the exact prompt (delivery direction in square brackets, then the line). |
| `add.py` | `add.py <key>=<result url> ...` downloads a take to `raw/<speaker>__<line>.t<n>.mp3` and notes it in `jobs.json`. |
| `process.py` | Chosen take to finished file: speaker tuning (Pell lower and slower, Wick raised into a child's voice), cut to the speech, limiter, -16 LUFS measured on the encoded MP3, mono 44.1 kHz 128 kbps. `--all-takes` writes every take to `alt/` for comparison. |
| `check.py` + `analyze.py` | The "ears": for every file, perceived age and child probability (wav2vec2 age-gender model), pitch, pace, a transcript compared with the script (faster-whisper `small.en`), silence at both ends, loudness and peak. |
| `second.py` | A second transcript with a larger recogniser (`medium.en`), listing only the lines that differ from the script. |
| `spk.py` | Speaker-embedding similarity of every take to its character's average, to catch takes that drift from the voice. |
| `browser-check.cjs` | Decodes every file listed in `voiced.json` in headless Chromium, the game's runtime, and reports silence at both ends and peaks. |

To redo a line after its text changes: generate it with the same voice id and a direction in the style of `takes.json`, `add.py` the result, set the take in `takes.json`, run `process.py <key>`, run the checks, copy `final/<key>.mp3` to `public/audio/voice/` and put the new hash in `voiced.json`.

## Music and sound effects (`audio/`)

The scripts behind `public/audio/music/` and `public/audio/sfx/`. Setup: Python 3 with `numpy scipy soundfile librosa torch transformers py7zr`, ffmpeg with libvorbis, and Playwright for the browser check. Downloads and raw generations are not kept in the repo. To rerun, copy this folder to `<work>/tools/` and put the sources beside it: `<work>/oga/<pack>/` (written by `oga_page.py --get`), the two Kenney packs unzipped to `<work>/cc0/kenney-interface/` and `<work>/cc0/kenney-rpg/`, generated clips in `<work>/sfx/raw/` and `<work>/music/raw/` (written by `get.py`). Archives inside a pack are unpacked next to themselves into `<name>.x/`.

| File | What it does |
|---|---|
| `generated.json` | Every generated clip: name, job id, model, prompt and length asked for (music and sound effects). |
| `get.py` | `get.py <music|sfx> <name>=<result url> ...` downloads a generation to `<kind>/raw/<name>.mp3` and notes its job id. |
| `oga_search.py`, `oga_page.py` | Search OpenGameArt for CC0 sound effects; print a page's author, licences and files, and with `--get` download them to `oga/<slug>/` with a `SOURCE.json`. |
| `ears.py` | The "ears": AudioSet tags (AST) and CLAP audio-to-text matching for any clip. |
| `survey.py`, `events.py`, `ev.py` | One line per file in a folder (length, peak, tags); the separate sound events inside a clip and their times. |
| `audition.py` | Try a candidate cut or layering before it goes in the manifest: its CLAP rank among the 28 sound descriptions and its tags. |
| `listen_music.py` | Tempo, key, tags and level of a music track, window by window. |
| `loop.py` | Cut a seamless music loop: candidate start and end points on phrase boundaries, crossfade into the audio before the loop start, seam report. |
| `master_music.py` | Loops and stings to -18 LUFS OGG Vorbis, checking that the decoded length is the length written. |
| `sfx_manifest.py` | What every sound effect is made from: source file, cut, speed, layers, level. Also the pack list and the synthesised chime. |
| `sfx_build.py` | Builds every effect in the manifest: cut, layer, trim to the sound, level, encode, and write `index.json`. Output is byte-identical from run to run. |
| `sfx_check.py`, `sfx-check.json` | CLAP rank and AudioSet tags of every finished effect. |
| `loop_check.py` | Whether a loop's wrap point stands out from the rest of the loop. |
| `browser-check.cjs` | Decodes every music and effect file in headless Chromium and prints channels, sample rate and exact length. |
| `assets_md.py`, `sfx-index.json` | The per-file source tables in `docs/ASSETS.md`, written from the build's index. |

Two things learned the hard way. Chromium's Vorbis decoder can return a short file up to 128 samples short at the end, so one-shots carry 4 ms of trailing silence and loops are rotated until they decode to exactly their length (a loop sounds the same from any starting point). And generation is hit and miss for mechanical sounds: short caption-like prompts work for common sounds (a cat, coins, water, rowing, creaking wood, steps on grass) and fail for a reel, a whoosh or a plop, which is why those come from CC0 recordings.
