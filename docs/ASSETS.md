# Murmurwater — Asset Log

Every generated or third-party asset in the repo is listed here with its source, tool, licence and date.
Add a line in the same commit that adds the asset.

## Style references (`docs/art/refs/`)

Locked style reference images, generated against `docs/ART_BIBLE.md`. All 1344×752 PNG.

| File | Subject | Tool | Model | Job id | Date | Licence |
|---|---|---|---|---|---|---|
| `docs/art/refs/01-keyart-hearthbay.png` | Key art, Hearthbay at dusk | Higgsfield | gpt_image_2_6 | `4108234c-2d12-4d79-8b6d-783c8ccbb999` | 2026-11-12 | Generated for this project |
| `docs/art/refs/02-mossglass-fen.png` | Region: Mossglass Fen | Higgsfield | gpt_image_2_6 | `a04424e5-bec3-4ffd-bef5-5273330912fe` | 2026-11-12 | Generated for this project |
| `docs/art/refs/03-saltbone-reach.png` | Region: Saltbone Reach | Higgsfield | gpt_image_2_6 | `18e52ed2-184a-4289-b3d9-45d8ca7bec57` | 2026-11-12 | Generated for this project |
| `docs/art/refs/04-the-hush.png` | Region: The Hush | Higgsfield | gpt_image_2_6 | `b5c892bb-e95e-4139-b5bb-eeeb90ae2591` | 2026-11-12 | Generated for this project |
| `docs/art/refs/05-fish-sheet.png` | Fish design sheet (8 fish, common to uncanny) | Higgsfield | gpt_image_2_6 | `310aad53-baed-461f-9e42-84f76b3b197b` | 2026-11-12 | Generated for this project |
| `docs/art/refs/06-characters.png` | Character line-up (player, NPCs, cat) | Higgsfield | gpt_image_2_6 | `95b95d6e-78a9-4c14-a235-a53e220b3ece` | 2026-11-12 | Generated for this project |
| `docs/art/refs/07-boats.png` | Boat progression line-up (6 boats) | Higgsfield | gpt_image_2_6 | `c3f6bf62-ff14-42a2-bace-6beb75656e74` | 2026-11-12 | Generated for this project |
| `docs/art/refs/08-ui-mood.png` | UI mood: catch card and ledger | Higgsfield | gpt_image_2_6 | `ee9a135f-c659-4156-bb5b-8030e4dae273` | 2026-11-12 | Generated for this project |

## Concept images for 3D generation (`docs/art/concepts/`)

Clean single-subject concepts generated against the style references (the ref image was passed as an image reference), used as the source images for image-to-3D. Stored as WebP (2K originals re-encoded at quality 90). `views/` holds the per-view crops (front, facing-left, back, facing-right) cut from the character turnaround sheets with ImageMagick/Pillow. All: Higgsfield, gpt_image_2_6, quality high, 2026-11-12, generated for this project.

| File | Subject | Style ref | Job id |
|---|---|---|---|
| `player-sheet.webp` | Player turnaround, A-pose | 06 | `55f9574e-8af9-4a0e-b09e-7e6ea263342a` |
| `mara-sheet.webp` | Mara turnaround, A-pose | 06 | `52636b3a-f572-40a9-8424-43b920b3e0bb` |
| `pell-sheet.webp` | Pell turnaround, A-pose | 06 | `499896cd-2c3d-4247-9eb1-57d85d7f2bdc` |
| `biscuit-stand-sheet.webp` | Biscuit the cat, standing turnaround | 06 | `082de302-2478-4405-beee-2c5ff424ff15` |
| `biscuit-sit-sheet.webp` | Biscuit the cat, sitting turnaround | 06 | `3dec1f05-a7ce-4d56-9c44-ee11604f1a68` |
| `butterperch.webp` | Fish: butterperch | 05 | `11f42a5c-5782-41b3-965f-49f84c45083c` |
| `kettle-carp.webp` | Fish: kettle-carp | 05 | `66795142-9bc2-42b7-ba66-d338b72b2853` |
| `lampjaw.webp` | Fish: lampjaw | 05 | `e9bc330e-fce0-4cdd-bb4a-90d6f2281f78` |
| `coral-snapper.webp` | Fish: coral-snapper | 05 | `066e06b4-4e27-4fd9-82ed-56856e7fafc1` |
| `moss-eel.webp` | Fish: moss-eel (straightened for animation) | 05 | `0a311627-b79c-4254-8b2a-6558f97f79b5` |
| `twofold-flounder.webp` | Fish: twofold-flounder | 05 | `e1046001-70d7-46ab-a827-4341cca2e0a4` |
| `hollow-lantern.webp` | Fish: hollow-lantern | 05 | `6b3fc659-f925-4549-9f88-0e2192d892b0` |
| `manyeye.webp` | Fish: manyeye | 05 | `9ffd4d0d-2b7e-494a-b7d7-6523886f24c3` |
| `skiff.webp` | Boat: skiff with stern lantern post | 07 | `90000b95-5146-448c-a7b7-d59ac3229c82` |
| `crate.webp` | Prop: dock crate | 01 | `643ee574-e76d-4a8e-8fb5-3244df353f1c` |
| `barrel.webp` | Prop: barrel | 01 | `c493297a-47b5-48b1-a324-b59dae8130f1` |
| `tackle-box.webp` | Prop: tackle box | 01 | `a18897ae-98ac-4da9-b2ac-ce749281efa2` |
| `dock-lantern.webp` | Prop: hanging dock lantern | 01 | `ccc06ba8-8d67-4e6e-b121-f740d5dc1dc4` |
| `wick-sheet.webp` | Wick turnaround, A-pose | 06 | `21c086b2-91fb-4f58-8cc6-70287c98fb9a` |
| `fish-stall.webp` | Mara's fish stall | 01 | `2b9973b2-8198-478f-94c8-fc1a077e1aa2` |
| `notice-board.webp` | Notice board with shingled roof | 01 | `5538ca1e-25a4-4a8c-9465-25a428cb47fc` |
| `pebble-goby.webp` | Fish: pebble-goby | 05 | `abbb6a48-ece5-49d7-9055-899d67b569f7` |
| `sketchbook.webp` | Prop: Wick's sketchbook | 06 | `4004874e-3736-42e7-8432-a3bca16cb077` |

## 3D models (`public/models/`)

Image-to-3D from the concepts above, then optimized with the scripts in `docs/art/pipeline/` (weld, simplify, textures to WebP, orientation/scale/origin baked). All: Higgsfield `generate_3d`, model Tripo H3.1 (`tripo_h3_1_image_to_3d`, or `tripo_h3_1_multiview_to_3d` for characters), detailed geometry and texture, 2026-11-12, generated for this project. Every model is +Y up, in metres, facing +Z, with one material and one 1024 px WebP base-colour texture (player: 2048 px). Contact sheets are in `docs/art/sheets/<id>.webp`.

| File | Tris | Size (x, y, z) m | Origin | Glow map | Concept | 3D job id |
|---|---|---|---|---|---|---|
| `characters/player.glb` | 14,078 | 1.11 x 1.70 x 0.56 (A-pose) | feet | no | `player-sheet` | `7dcfd897-9c3f-4b47-aeac-431ec680999f` |
| `characters/mara.glb` | 14,269 | 1.12 x 1.60 x 0.59 (A-pose) | feet | no | `mara-sheet` | `91d1e727-3e75-47a4-af68-6f367a77fa9f` |
| `characters/pell.glb` | 13,896 | 1.15 x 1.88 x 0.75 (A-pose) | feet | hand lantern | `pell-sheet` | `dfb779a3-05c1-4861-8ec2-d1458f8b9501` |
| `characters/wick.glb` | 12,860 | 0.79 x 1.25 x 0.48 (A-pose) | feet | no | `wick-sheet` | `133831b3-7f36-42d3-97ad-25fa271a66a3` |
| `characters/biscuit.glb` | 7,514 | 0.29 x 0.55 x 0.47 (standing, to the tail tip) | feet | no | `biscuit-stand-sheet` | `ff65ea63-ffb6-474d-9a32-49c25cf6f9d4` |
| `characters/biscuit-sit.glb` | 5,749 | 0.33 x 0.45 x 0.31 (sitting) | base | no | `biscuit-sit-sheet` | `7df5fd5e-8374-44bd-b907-f3d047d7845b` |
| `fish/butterperch.glb` | 2,958 | 0.54 x 0.79 x 1.00 | centre | no | `butterperch` | `fd9ea949-0241-4ba0-af03-fac94c86777a` |
| `fish/kettle-carp.glb` | 2,894 | 0.51 x 0.80 x 1.00 | centre | no | `kettle-carp` | `6166d97e-52c7-4417-965a-d504673da398` |
| `fish/lampjaw.glb` | 2,714 | 0.29 x 0.58 x 1.00 | centre | lure lantern, side lights | `lampjaw` | `3d6860a0-9b2a-4d88-b35e-5061b9babf09` |
| `fish/coral-snapper.glb` | 2,834 | 0.57 x 0.74 x 1.00 | centre | no | `coral-snapper` | `cbbb25c2-bf00-426e-92d6-54eac4192302` |
| `fish/moss-eel.glb` | 2,917 | 0.23 x 0.25 x 1.00 | centre | no | `moss-eel` | `a1a86978-8514-4aa0-9075-a2714368c0f8` |
| `fish/twofold-flounder.glb` | 2,832 | 0.42 x 0.93 x 1.00 | centre | no | `twofold-flounder` | `002c7237-f2a2-4d5f-9548-4f322d4f6f3c` |
| `fish/hollow-lantern.glb` | 2,847 | 0.33 x 0.77 x 1.00 | centre | lantern in the rib cage, eye | `hollow-lantern` | `521e59a9-5de6-4114-a776-086027764d40` |
| `fish/manyeye.glb` | 2,940 | 0.69 x 0.87 x 1.00 | centre | eyes | `manyeye` | `8e8f2a8a-34e3-4eb9-9a3e-9349037fdac6` |
| `fish/pebble-goby.glb` | 2,912 | 0.44 x 0.52 x 1.00 | centre | no | `pebble-goby` | `01c438b2-c45e-48cc-9a8f-93893900ae02` |
| `boats/skiff.glb` | 5,728 | 2.33 x 2.16 x 4.00 | keel, centre | stern lantern | `skiff` | `be7b1c34-13e6-4d60-b9b6-e015989c1a9d` |
| `props/crate.glb` | 1,856 | 0.59 x 0.60 x 0.79 | base | no | `crate` | `d8862a17-b399-468c-926e-7779d6c328de` |
| `props/barrel.glb` | 1,886 | 0.82 x 0.90 x 0.83 | base | no | `barrel` | `622a5755-0592-42f7-a622-54827ad5f86a` |
| `props/tackle-box.glb` | 1,931 | 0.36 x 0.34 x 0.45 | base | no | `tackle-box` | `07bcc043-3a0b-40f3-8dd3-ff5295fcb53c` |
| `props/dock-lantern.glb` | 1,838 | 0.23 x 0.60 x 0.29 | top of the wall plate, back face | lantern glass | `dock-lantern` | `c4b6c49e-5d71-4cf9-9321-fe2931ba26b4` |
| `props/fish-stall.glb` | 6,454 | 2.60 x 2.40 x 1.45 | base centre | no | `fish-stall` | `73c896bf-54f8-41a2-9d6f-8e50decd1f69` |
| `props/notice-board.glb` | 2,817 | 1.75 x 2.20 x 0.98 | base centre | no | `notice-board` | `a22e9d6d-7ed3-4da4-a3cc-71f2fadc5c87` |
| `props/sketchbook.glb` | 914 | 0.24 x 0.25 x 0.055 | centre, cover on +Z | no | `sketchbook` | `3d645d40-ba8f-41e2-9531-2100077904f1` |

Fish are normalized to 1 m nose to tail along +Z, so the game scales each to its species length. Glow maps are an `emissiveTexture` on the same material with `KHR_materials_emissive_strength` 1.5, derived from the warm bright texels of the base colour; `docs/art/sheets/emissive-dark.webp` shows them with the lights off.

Notes: the fish stall is the second run of its job (the first, `c941c034-4adf-48ff-b2f8-9cec702029ba`, came back with a blank grey texture and was discarded); its bounds were fitted to 2.6 x 2.4 x 1.45 m with a mild non-uniform scale (`--fit`), about 15 % shallower than generated. The sketchbook has a 512 px texture and was fitted to 0.24 x 0.25 x 0.055 m (thinner than generated) so it sits between Wick's hands. Biscuit is two sculpts, standing and sitting, because the two poses do not deform into each other cleanly; the game swaps models when the cat sits.

### Player rig and animation clips

Rigged with Higgsfield `generate_3d`, model `meshy_rigging` (height 1.7 m), one job per library clip, 2026-11-12. Each job returns its own skeleton, so `merge-anim.mjs` retargets every clip onto the skeleton of the first job. `author-anim.mjs` then adds four finger joints and two sockets and bakes the hand-authored fishing clips defined in `player-clips.mjs` (analytic two-bone IK, 30 fps); those clips are original work with no generation job. Clip frames are in `docs/art/sheets/player-clips.webp`.

Skeleton: 28 joints, unit scale, rest pose is the A-pose. Hips, Spine02, Spine01, Spine, neck, Head, head_end, headfront, Left/Right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase, plus `RightFingers`, `RightFingerTips`, `LeftFingers`, `LeftFingerTips` (the four fused fingers of each hand; local +X is the curl axis, a positive rotation closes the hand; 70° + 65° is a fist around a 2.5 cm radius handle). Every clip keys the finger joints.

Sockets (empty nodes, children of `RightHand`):

- `RodSocket`: origin at the grip, +Y along the rod toward the tip, +X out of the palm (the character's left in a neutral hold; the reel goes on this side), +Z along the hand away from the wrist.
- `CatchSocket`: where the catch sits in the hold of `show_catch`, between both palms. A fish parented with identity rotation has its nose (+Z) to the character's left and +Y up.

| Clip | Length | Loops | Source | Job id |
|---|---|---|---|---|
| `idle` | 6.03 s | yes | Library: Idle_12 (252) | `3d514e05-df87-4b90-a2fc-1da81dd54885` |
| `idle_look` | 4.03 s | yes | Library: Idle (0), looks around | `d8b9a10e-71af-47a8-b091-7cebfb1e8bc4` |
| `walk` | 4.20 s | yes, in place | Library: Casual_Walk_inplace (613) | `e1447a8d-2286-4d30-a596-4ce71f96e863` |
| `run` | 0.83 s | yes, in place | Library: Run_03 (15) | `7141b731-e678-4887-9df8-ea88fdbb9758` |
| `cheer` | 2.97 s | yes | Library: Cheer_with_Both_Hands (303) | `5953ba38-30db-4099-9bae-1f30566c6fb4` |
| `rod_idle` | 6.03 s | yes | Authored on `idle`: rod held loosely upright | none |
| `rod_wait` | 6.03 s | yes | Authored on `idle`: rod forward at 45°, breathing | none |
| `rod_charge` | 1.00 s | scrubbed | Authored: rod forward at 30° to fully back over the right shoulder | none |
| `rod_cast` | 0.45 s | no | Authored: forward whip, last frame equals `rod_wait` frame 0 | none |
| `rod_reel` | 2.00 s | yes | Authored: rod raised 60°, left hand cranking, four cranks of 0.5 s | none |
| `rod_lean_left`, `rod_lean_right` | 1.00 s | static pose | Authored: body leaning against a run | none |
| `show_catch` | 1.20 s | no, holds the last frame | Authored: both hands lift the catch to chest height | none |
| `rod_walk` | 4.20 s | yes, in place | Authored on `walk`: right arm carries the rod | none |
| `rod_run` | 0.83 s | yes, in place | Authored on `run`: right arm carries the rod | none |

The earlier library `cast` clip (Over_Shoulder_Throw, job `65af2772-9f1e-4f4d-b968-6f77d1c2ac6f`) was dropped on 2026-11-12; a ball throw did not read as a rod cast.

### NPC rigs and clips

Same route as the player: `meshy_rigging`, one job per clip, merged with `merge-anim.mjs`; 24 joints, unit scale, rest pose is the A-pose. Clip frames are in `docs/art/sheets/<id>-clips.webp`. All clips stay over the model origin (`:anchor` removes the offset some library clips start with).

| Model | Clip | Length | Library action | Job id |
|---|---|---|---|---|
| `mara.glb` (1.6 m) | `idle` | 10.00 s | Idle_3 (243) | `ce378154-45b8-4b48-afd5-c57be4c69549` |
| | `talk` | 5.20 s | Talk_with_Left_Hand_on_Hip (309) | `38bd8d2f-a228-48ef-ab2b-1b33584c5e83` |
| | `wave` | 5.37 s | Big_Wave_Hello (28) | `e8ac1bcc-10ae-4dfe-b73e-fb3c6a874a06` |
| `pell.glb` (1.88 m) | `idle` | 2.03 s | Idle_9 (249) | `2028cb9c-bd49-4ee1-8302-91624a44ff5e` |
| | `talk` | 3.77 s | Talk_with_Right_Hand_Open (314) | `ed84de4f-5b5c-4daf-8c3a-8c9de3a8dfe1` |
| `wick.glb` (1.25 m) | `idle` | 6.03 s | Idle_12 (252) | `bc934eb3-1582-4380-8b89-85f3cbc995b0` |
| | `idle_look` | 4.03 s | Idle (0), turns to look behind | `3c7f0e23-fd41-432b-9247-bb316acc3387` |
| | `talk` | 4.00 s | Talk_with_Hands_Open (313) | `3cf8782b-7198-40ac-9535-5f7d6797b31c` |
| | `sit` | 10.70 s | Chair_Sit_Idle_M (33); hips about 0.375 m up, for a seat about 0.3 m high | `4470a36a-66e1-4393-8201-107c33e9d3d4` |
| | `book_idle`, `book_idle_look`, `book_talk` | 6.03 s, 4.03 s, 4.00 s | Authored on `idle`, `idle_look` and `talk` with `author-anim.mjs` + `wick-clips.mjs`: both hands hold the sketchbook by its side edges; he glances down at it once per idle loop and lifts and shakes it while talking | none |

Wick has one socket: `BookSocket`, an empty child of `LeftHand` at the sketchbook's centre in the `book_*` clips. Parent `props/sketchbook.glb` to it with identity transform (the cover faces the socket's +Z). The other clips are empty-handed, so detach or hide the book for them.

### Biscuit the cat

The auto-rigger only handles bipeds, so `rig-cat.mjs` builds the cat's skeleton, skin weights and clips in code (original work, no generation job). Weights come from a geometric segmentation of the mesh smoothed by Laplacian diffusion.

| Model | Joints | Clips |
|---|---|---|
| `biscuit.glb` | Root, Body, Hips, Chest, Head, Tail1 to Tail3, FrontLeftLeg, FrontRightLeg, HindLeftLeg, HindRightLeg | `walk` 0.72 s loop, in place, one stride covers about 0.17 m; `idle` 4.0 s loop |
| `biscuit-sit.glb` | Root, Body, Chest, Head | `sit` 5.0 s loop, breathing and a slow head sway |

## Voice lines (`public/audio/voice/`)

The 40 spoken lines listed in `docs/voice/voice-lines.json`, one file per line at `public/audio/voice/<key>.mp3` (mono, 44.1 kHz, 128 kbps MP3, 204 s in total), with `voiced.json` recording the text hash each file was made for. All: Higgsfield `generate_audio`, model `elevenlabs_v4` (ElevenLabs text to speech), preset voices from the Higgsfield voice library, 2026-11-12, generated for this project. Each character has one voice, used for every line:

| Character | Preset voice | Voice id | Tuning after generation |
|---|---|---|---|
| Mara Thimble | Celine | `57ccb351-84d7-54ba-afd4-26b566ca6023` | none |
| Pell | Arthur | `30fc8796-ceb6-4a66-b3a7-4a145ef7f346` | pitch and formants 6 % lower, about 10 % slower (older, deeper) |
| Wick | Raina | `1c3a4775-9afb-52c1-a2bf-b6543231a9a1` | pitch and formants 10 % higher at 3 % faster tempo (an adult voice nudged toward a nine-year-old's; first delivered at 25 %, lowered after Lawson found it too high, with the four quest lines re-recorded in a calmer delivery) |

The voices were cast from trial takes of 14 library voices, measured for perceived age, accent and pace. Each line is sent with a short delivery direction in square brackets ahead of the text (the model acts on it and does not speak it); the exact prompt of every kept take is in `docs/art/pipeline/voice/takes.json`. 71 takes were recorded for the 40 lines: 31 were retakes or alternates, for a repeated word, a word two recognisers both misheard, quiet directions that pulled Mara's voice away from her other lines, second options for the lines heard first, and calmer, lower-pitched deliveries of Wick's lines.

Processing (`docs/art/pipeline/voice/process.py`): high-pass, the speaker tuning above, cut to the speech with 0.03 s before and 0.08 s after (clicks after the speech are dropped), limiter at -1.5 dBFS, gain set so the encoded file measures -16 LUFS.

Checks on the 40 finished files (`check.py`, `second.py`, `spk.py`, `browser-check.cjs` in the same folder): all decode in Chromium with at most 0.04 s of silence before and 0.08 s after the speech; loudness -15.9 to -16.1 LUFS, peaks at or below -1.2 dBFS; two speech recognisers transcribe every line as written apart from spellings of numbers and names; the age estimator hears Mara as 60 to 68 and Pell as 62 to 71, and hears Wick at the lower pitch as 18 to 23 (a 0.74 to 1.0 probability of being a child at the first, higher setting; his lines now sit at a median of 267 to 320 Hz); every take sits close to its own character's average voice (speaker similarity at least 0.72) and far from the other two (0.2 or less).

| Key | Take kept | Job id |
|---|---|---|
| `mara/hb-01-salt.intro.0` | 1 of 1 | `cd2343b4-5947-46bb-84da-72201af44e16` |
| `mara/hb-01-salt.intro.1` | 3 of 3 | `db311d4a-179a-46b7-9a63-dc5c45d468d6` |
| `mara/hb-01-salt.intro.2` | 1 of 1 | `d704f850-aa68-4804-97cc-6ebce43665fd` |
| `mara/hb-01-salt.reminder` | 1 of 1 | `802b9799-3e49-42ef-859d-c2420680b829` |
| `mara/hb-01-salt.outro.0` | 1 of 1 | `fea9ad38-409d-4e9e-ae96-ba0495cd1550` |
| `mara/hb-01-salt.outro.1` | 1 of 1 | `ef5dd4a5-50a8-4bba-b5e0-941dd3e26484` |
| `mara/hb-02-supper.intro.0` | 2 of 2 | `8de7c900-c8c6-4791-906b-3454bbcebb14` |
| `mara/hb-02-supper.intro.1` | 1 of 2 | `3d46f0e8-a760-477d-8d57-7acb56782953` |
| `mara/hb-02-supper.reminder` | 3 of 3 | `22ec1347-25c5-4be3-8d8d-b10ff7237765` |
| `mara/hb-02-supper.outro.0` | 2 of 2 | `a07f75a5-9338-44ce-9afd-64a8f1fe1448` |
| `mara/hb-02-supper.outro.1` | 1 of 1 | `77fb5919-70ee-44ac-acfa-c3c1c2aa652c` |
| `mara/hb-03-proper-rod.intro.0` | 1 of 1 | `36ebe715-7474-4c82-ac6f-22d81650ff2d` |
| `mara/hb-03-proper-rod.intro.1` | 1 of 1 | `59c068c9-6730-47fc-9a71-5807d6f2a97e` |
| `mara/hb-03-proper-rod.reminder` | 1 of 1 | `9831184d-a318-4635-8710-2f4836dd1353` |
| `mara/hb-03-proper-rod.outro.0` | 1 of 1 | `56330bea-0e4e-433c-b296-4a22cd22d2e5` |
| `wick/hb-04-drawing.intro.0` | 4 of 5 | `cea5b1b5-4c91-4e32-a418-ccd70e7b93e0` |
| `wick/hb-04-drawing.intro.1` | 3 of 4 | `7801945c-8950-4463-b5f4-2e22a4b2300f` |
| `wick/hb-04-drawing.reminder` | 2 of 3 | `d394bd2d-c5db-4e6c-968c-49a9162ecce1` |
| `wick/hb-04-drawing.outro.0` | 4 of 5 | `46ea73b7-522f-484b-a6f5-c2bfa102a115` |
| `pell/hb-05-dark-lamp.intro.0` | 1 of 1 | `6bb52020-bf97-4bcc-b394-4108eafaaeaa` |
| `pell/hb-05-dark-lamp.intro.1` | 1 of 1 | `9cbdda37-e8c5-4e96-b537-bb597f50db55` |
| `pell/hb-05-dark-lamp.intro.2` | 1 of 1 | `8b03eb9a-bfde-48e6-9237-31019654cd31` |
| `pell/hb-05-dark-lamp.reminder` | 1 of 1 | `875290ee-33fa-487f-9d60-9e233d3d1739` |
| `pell/hb-05-dark-lamp.outro.0` | 2 of 2 | `91306543-ddfe-4279-8391-28b3f031902f` |
| `pell/hb-06-relight.intro.0` | 1 of 1 | `fcbfa1c7-90cb-4dc6-8825-b26ba63f4bdb` |
| `pell/hb-06-relight.intro.1` | 1 of 1 | `6f404df8-e8c8-48a3-9573-bf7c1fb3cd76` |
| `pell/hb-06-relight.reminder` | 2 of 2 | `1053c4e4-5da2-4aeb-aa0e-a9ea41b1d68f` |
| `pell/hb-06-relight.outro.0` | 1 of 1 | `0310ec7e-b389-429b-95fe-70c4482e0e1d` |
| `pell/hb-06-relight.outro.1` | 1 of 1 | `d9479568-fab1-487d-82c4-40195f526564` |
| `pell/hb-06-relight.outro.2` | 1 of 1 | `6a7cbb93-2ca6-44be-af0b-cd79577ce481` |
| `mara/bark.0` | 1 of 1 | `96dffe35-2807-4627-b126-912edf4da1b8` |
| `mara/bark.1` | 1 of 1 | `2da9586a-90e3-440b-a1d3-0f6db986b432` |
| `mara/bark.2` | 2 of 2 | `e978b504-08c7-4170-b4d8-981f2c1f49ea` |
| `mara/bark.3` | 2 of 3 | `bf47c33b-0575-4e03-a53c-91f67abf12d9` |
| `wick/bark.0` | 3 of 3 | `7a62b293-1249-49ff-91a1-c471b5b5e369` |
| `wick/bark.1` | 2 of 3 | `aba51e0e-2590-44e8-9167-af7a6641d4a6` |
| `wick/bark.2` | 1 of 2 | `c2a779bf-5934-477a-a044-763c6b577011` |
| `pell/bark.0` | 2 of 2 | `306dc972-23d4-4499-bc13-b7f1640779d6` |
| `pell/bark.1` | 1 of 1 | `b4b663f4-6b42-4a17-a0f8-50e25e72b63c` |
| `pell/bark.2` | 1 of 1 | `d3b30d5f-7df2-4cbf-8da2-6175a768e122` |
