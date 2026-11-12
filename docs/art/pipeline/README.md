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
