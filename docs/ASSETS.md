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

Clean single-subject concepts generated against the style references (the ref image was passed as an image reference), used as the source images for image-to-3D. Stored as WebP (2K originals re-encoded at quality 90). `views/` holds the per-view crops (front, facing-left, back, facing-right) cut from the character turnaround sheets with ImageMagick/Pillow. All: Higgsfield, gpt_image_2_6, quality high, 2026-11-12 (the last four rows 2026-11-13), generated for this project.

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
| `sail-rig.webp` | Sail rig for the skiff: flat side elevation on a transparent ground (2K), used for the model's proportions and as its texture | 01 | `39e82bdb-1125-49cc-8562-3629e424bf81` |
| `chest.webp` | Prop: small sea chest, lid closed (1K) | 01 | `efd3d6a2-8be3-4cb2-a008-25ea0512654e` |
| `buoy.webp` | Prop: red and white marker buoy with a bell (1K) | 01 | `06d5a4f9-bc17-4d3c-80d3-7d9d92bb378a` |
| `jetty.webp` | Prop: short landing stage on long piles (1K) | 01 | `782916cd-93b2-4048-8081-2a9902cf714a` |

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
| `boats/sail-rig.glb` | 1,092 | 0.21 x 3.49 x 2.32 | mast foot | no | `sail-rig` | built in code, no 3D job (see below) |
| `props/chest.glb` | 1,860 | 0.85 x 0.49 x 0.52 (body 0.66 wide, rope handles beyond) | base centre, lock on +Z | no | `chest` | `a459bd33-43af-415d-a0db-75dacd4cf31b` |
| `props/buoy.glb` | 1,892 | 0.87 x 1.81 x 0.87 | waterline, on the axis: 1.20 m above it, 0.61 m below | no | `buoy` | `e544a9f1-80bc-442e-8a17-4d1860ce02af` |
| `props/jetty.glb` | 3,770 | 2.39 x 3.70 x 6.00 | centre of the deck, 0.90 m below the deck top; piles reach 2.00 m below the origin | no | `jetty` | `c6bb7b79-e4fa-4583-b180-25c8b745ba08` |

Fish are normalized to 1 m nose to tail along +Z, so the game scales each to its species length. Glow maps are an `emissiveTexture` on the same material with `KHR_materials_emissive_strength` 1.5, derived from the warm bright texels of the base colour; `docs/art/sheets/emissive-dark.webp` shows them with the lights off.

Notes: the fish stall is the second run of its job (the first, `c941c034-4adf-48ff-b2f8-9cec702029ba`, came back with a blank grey texture and was discarded); its bounds were fitted to 2.6 x 2.4 x 1.45 m with a mild non-uniform scale (`--fit`), about 15 % shallower than generated. The sketchbook has a 512 px texture and was fitted to 0.24 x 0.25 x 0.055 m (thinner than generated) so it sits between Wick's hands. Biscuit is two sculpts, standing and sitting, because the two poses do not deform into each other cleanly; the game swaps models when the cat sits.

Phase 2 props (2026-11-13): the chest, buoy and jetty are Tripo H3.1 with detailed texture and standard geometry. The buoy floats with its drum half under: the origin is at the middle of the drum. The jetty's deck is 2.1 m wide (2.4 m over the piles) and 5.8 m long, its two tall mooring posts (to 1.70 m) are at the +Z end and the rope ladder is on the -X side; below 0.5 m its piles and braces were stretched by a quarter (`--cut 0.5 --legs 2`) so that they reach 2 m under the origin, and it keeps 3,770 triangles, above the 2,000 prop budget, because it is a 6 m structure.

`boats/sail-rig.glb` is built in code by `docs/art/pipeline/build-sail-rig.mjs` from the painted side elevation `sail-rig.webp`: the picture is measured for the proportions and is also the texture (its transparent surround filled from the nearest paint). Mast (a lathe, 3.03 m to the cap), boom and yard (ten-sided tubes), the boom's jaw and a two-sided 12 x 10 sail grid, one mesh and one material. The sail lies in the Y-Z plane and the picture is the view from +X; the boom points to -Z, is 2.24 m long, and rises from 1.10 m above the mast foot at the mast to 1.45 m at its tip so that it clears a seated head; the yard's peak is at 3.49 m. Morph target 0, `belly`, fills the sail: weight 1 (the default) bellies it 0.22 m toward +X, -1 toward -X, 0 leaves it flat. `docs/art/sheets/sail-rig-on-skiff.webp` shows it stepped on the skiff's floor at (0, 0.66, 0.95).

### Player rig and animation clips

Rigged with Higgsfield `generate_3d`, model `meshy_rigging` (height 1.7 m), one job per library clip, 2026-11-12. Each job returns its own skeleton, so `merge-anim.mjs` retargets every clip onto the skeleton of the first job. `author-anim.mjs` then adds four finger joints and two sockets and bakes the hand-authored fishing and boat clips defined in `player-clips.mjs` (analytic two-bone IK, 30 fps); those clips are original work with no generation job. Clip frames are in `docs/art/sheets/player-clips.webp`; `boat_sit` is in `docs/art/sheets/player-boat-sit.webp`, alone and on the skiff.

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
| `boat_sit` | 4.00 s | yes | Authored on the rest pose: seated on a thwart 0.35 m above the origin, feet flat at the origin's height, right hand back on a tiller, left hand on the thigh, slight sway | none |

`boat_sit` (added 2026-11-13 with `author-anim.mjs --only boat_sit`, which leaves every other clip bit for bit as it was): the underside of the thighs is 0.33 m above the origin, so the character settles 2 cm into a seat at 0.35 m. Both feet and the tiller hand hold still while the body sways over them. The grip (`RodSocket`) stays within 4 mm of (-0.26, 0.50, -0.26) from the origin, with its +Y pointing forward along (0.05, 0.08, 1.00): a tiller is a bar on that line, coming from astern, 0.26 m to the right of the character's centre line and 0.15 m above the seat. The hem of the coat hangs to about 0.25 m, below the seat, as it does not fold. `skin-pose.mjs` measures a posed character (underside, joints, sockets) and `anim-diff.mjs` compares the clips of two files.

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

## Music (`public/audio/music/`)

Three seamless loops and three stings, OGG Vorbis (quality 6), 44.1 kHz stereo, levelled to about -18 LUFS with a plain gain. All: Higgsfield `generate_audio`, model `elevenlabs_music_v2_5` (ElevenLabs Music), instrumental, 2026-11-12 (`sting-discover` 2026-11-13), generated for this project. The exact prompts are in `docs/art/pipeline/audio/generated.json`.

| File | Length | Loudness, peak | Made from | Job id |
|---|---|---|---|---|
| `hearthbay-day.ogg` | 139.98 s loop | -17.9 LUFS, -2.9 dBFS | 165 s generation, cut from 13.33 s to 153.32 s (fourteen 10 s phrases at 96 BPM in 6/8), 0.15 s crossfade | `e6dcbcf2-9be1-41b2-8395-9fb72b304c4b` |
| `hearthbay-night.ogg` | 103.98 s loop | -17.9 LUFS, -7.7 dBFS | 150 s generation, cut from 38.04 s to 142.04 s (thirteen 8 s phrases), 2 s crossfade | `902cb5bf-cbaa-422b-b7f3-115d9f18eb85` |
| `gull-point.ogg` | 128.99 s loop | -18.0 LUFS, -3.9 dBFS | 150 s generation, cut from 12 s to 141 s, 8 s crossfade | `748e8e91-f358-4b1f-8255-1731191aed48` |
| `sting-quest.ogg` | 3.60 s | -18.0 LUFS, -2.5 dBFS | first 3.6 s of a 4 s generation, 0.6 s fade out | `24856db4-a821-4e32-891e-aecbfc20e2fe` |
| `sting-rare.ogg` | 4.00 s | -18.0 LUFS, -6.0 dBFS | first 4 s of a 6 s generation, 1.6 s fade out | `1c9215c3-ab7b-497b-914d-43ffab7f3abd` |
| `sting-discover.ogg` | 3.00 s | -17.9 LUFS, -2.0 dBFS | a 6 s generation that came back in C major, played 12.2 % faster so that it sounds a tone higher, in D major; its first 3 s, 0.9 s fade out | `ff9ad421-4f3c-4d27-8a1b-669200dc51db` |

How the loops are cut (`loop.py`): the loop is a stretch of the recording whose last moments are cross-faded into the audio that came just before the loop start, so the wrap point is the recording's own continuity. Start and end are chosen on phrase boundaries by matching harmony, timbre and onsets, then aligned to the waveform. Every file decodes in Chromium to exactly the sample count that was written, and the change in spectrum across each wrap is within the range of ordinary note onsets in the same track (`loop_check.py`).

Notes. The day and night themes are two generations from sibling prompts (same key centre, same described melody shape, day at 96 BPM and night much slower and sparser); the generator takes no reference audio, so the night theme is a relative of the day theme, not the same melody note for note. Automatic listening (key and tempo detection, AudioSet tags) hears the day theme in D major with plucked strings and a music box, and does not confirm the concertina; the night theme reads as D minor, celesta-like and lullaby; Gull Point as foghorn and singing bowl. Claude cannot hear, so these want a human ear. One generation was discarded: job `45f9a0ef-0b85-451a-99f1-53c1051e7de4` asked for both themes in one 340 s piece and came back 49 s long. A second take of the discovery sting (job `3334c776-2497-4cc3-afcf-89b2cbbc9e52`) was a single D major strum, too close to `sting-quest`, and was not used.

## Sound effects (`public/audio/sfx/`)

31 sounds in 1 to 4 variations each, 100 files named `<name>_<n>.ogg`, mono 44.1 kHz OGG Vorbis (quality 5), 149 s and 1.8 MB in total. Most are CC0 recordings from OpenGameArt, cut and levelled; fifteen clips were generated; the quest chime and the murmur are synthesised. The sailing sounds (`sail-flap`, `hull-wash`, `murmur`) were added on 2026-11-13. Built by `docs/art/pipeline/audio/sfx_build.py` from `sfx_manifest.py`, which holds every cut.

Levels: within one sound, every variation has the same loudness. One-shots aim at -17 dBFS RMS over their loudest 100 ms (footsteps and interface sounds 4 dB lower, the nibble 6 dB lower, the chime and page turn 3 dB lower) and never peak above -1 dBFS, so sounds with sharp transients (splashes, coins, page turns, clicks) sit a few dB under that; `sfx-index.json` lists each file's level. Loops: `waves-lap`, `cat-purr` and `murmur` at -22 LUFS, `reel-click` at -20 LUFS; `hull-wash` is mostly low in pitch, so its peak limit holds it at -23.9 LUFS.

Loops: `waves-lap_1/2` are exactly 20 s, `reel-click_1/2` exactly 1 s, `cat-purr_1/2` are the recordist's own loops, `hull-wash_1` is exactly 8.8 s, `murmur_1` exactly 11 s (every part of it runs a whole number of cycles in that time, so it has no seam to hide). All eight decode in Chromium to exactly their own length. One-shots end with 4 ms of silence because Chromium can return a short Vorbis file up to 128 samples short at the end.

| File | Length | Made from |
|---|---|---|
| `cast-swish_1.ogg` | 0.54 s | `qubodup-swosh` `swosh-40.flac` |
| `cast-swish_2.ogg` | 0.41 s | `qubodup-swosh` `swosh-42.flac` |
| `cast-swish_3.ogg` | 0.72 s | `qubodup-swosh` `swosh-29.flac` |
| `cast-swish_4.ogg` | 0.44 s | `qubodup-swosh` `swosh-43.flac` |
| `reel-spin_1.ogg` | 1.12 s | `fisheefects` `reel.wav` 1 to 2.9 s, played at 1.7x (played 1.35 to 1.7 times faster, so the reel whirrs, and faded out) |
| `reel-spin_2.ogg` | 1.00 s | `fisheefects` `reel.wav` 3.6 to 5.1 s, played at 1.5x (played 1.35 to 1.7 times faster, so the reel whirrs, and faded out) |
| `reel-spin_3.ogg` | 1.41 s | `fisheefects` `reel.wav` 6 to 7.9 s, played at 1.35x (played 1.35 to 1.7 times faster, so the reel whirrs, and faded out) |
| `bobber-plop_1.ogg` | 0.49 s | `fisheefects` `bloop.wav` |
| `bobber-plop_2.ogg` | 0.39 s | `skippy` `water.wav` |
| `bobber-plop_3.ogg` | 0.32 s | `skippy` `waterReentry.wav` |
| `nibble_1.ogg` | 0.34 s | `angeloyazar-drops` `water_drops_1.ogg` 0.28 to 0.62 s |
| `nibble_2.ogg` | 0.31 s | `angeloyazar-drops` `water_drops_1.ogg` 1.99 to 2.3 s |
| `nibble_3.ogg` | 0.31 s | `angeloyazar-drops` `water_drops_1.ogg` 3.66 to 3.97 s |
| `nibble_4.ogg` | 0.33 s | `angeloyazar-drops` `water_drops_1.ogg` 6.53 to 6.86 s |
| `bite-dunk_1.ogg` | 0.69 s | `fisheefects` `bloop.wav`, played at 0.7x + `peludo` `splash2_0.wav` 0.64 to 1.15 s (a plop slowed down for depth, with a small splash on top) |
| `bite-dunk_2.ogg` | 0.72 s | `skippy` `waterReentry.wav`, played at 0.6x + `ezwa` `water_splash-03.flac` (a plop slowed down for depth, with a small splash on top) |
| `bite-dunk_3.ogg` | 0.59 s | `skippy` `water.wav`, played at 0.65x + `peludo` `splash1_0.wav` 0.52 to 1.06 s (a plop slowed down for depth, with a small splash on top) |
| `hook-set_1.ogg` | 0.30 s | `qubodup-swosh` `swosh-17.flac`, played at 1.25x + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` (a rod swish played a little faster, with four quick clicks of the reel behind it) |
| `hook-set_2.ogg` | 0.46 s | `qubodup-swosh` `swosh-03.flac`, played at 1.25x + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` (a rod swish played a little faster, with four quick clicks of the reel behind it) |
| `hook-set_3.ogg` | 0.34 s | `qubodup-swosh` `swosh-15.flac`, played at 1.25x + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` + `kenney-ui` `tick_002.ogg` (a rod swish played a little faster, with four quick clicks of the reel behind it) |
| `line-creak_1.ogg` | 0.61 s | `kenney-rpg` `creak1.ogg` |
| `line-creak_2.ogg` | 0.78 s | `kenney-rpg` `creak2.ogg` |
| `line-creak_3.ogg` | 0.31 s | `kenney-rpg` `creak3.ogg` |
| `fish-splash_1.ogg` | 1.09 s | `ezwa` `water_splash-01.flac` |
| `fish-splash_2.ogg` | 1.75 s | `transitking` `wave_04_cc0-11505__transitking__wavesound.flac` |
| `fish-splash_3.ogg` | 1.03 s | `peludo` `splash2_0.wav` |
| `fish-splash_4.ogg` | 0.72 s | `ezwa` `water_splash-03.flac` |
| `land-splash_1.ogg` | 1.50 s | generated `fish-splash.b` 0 to 1.5 s |
| `land-splash_2.ogg` | 1.95 s | generated `fish-splash.a` 0.45 to 2.4 s |
| `land-splash_3.ogg` | 1.75 s | `transitking` `wave_01_cc0-11505__transitking__wavesound.flac` |
| `coins_1.ogg` | 0.73 s | `kenney-rpg` `handleCoins.ogg` |
| `coins_2.ogg` | 0.32 s | `kenney-rpg` `handleCoins2.ogg` |
| `coins_3.ogg` | 0.89 s | generated `coins.p` 0 to 0.9 s |
| `coins_4.ogg` | 0.71 s | generated `coins.a` 0.15 to 0.95 s |
| `line-snap_1.ogg` | 0.26 s | `kenney-rpg` `beltHandle1.ogg` + `qubodup-swosh` `swosh-17.flac`, played at 1.8x (a sharp snap with a fast whip of air right behind it) |
| `line-snap_2.ogg` | 0.33 s | `kenney-rpg` `bookClose.ogg` + `qubodup-swosh` `swosh-03.flac`, played at 1.8x (a sharp snap with a fast whip of air right behind it) |
| `line-snap_3.ogg` | 0.30 s | `kenney-rpg` `clothBelt2.ogg` 0 to 0.3 s + `qubodup-swosh` `swosh-01.flac`, played at 1.8x (a sharp snap with a fast whip of air right behind it) |
| `reel-click_1.ogg` | 1.00 s loop | `kenney-ui` `click_004.ogg` + `kenney-ui` `tick_002.ogg` + `fisheefects` `reel.wav` 2 to 3 s (12 evenly spaced clicks a second over a quiet bed of the recorded reel; exactly 1 s) |
| `reel-click_2.ogg` | 1.00 s loop | `kenney-ui` `tick_002.ogg` + `kenney-ui` `click_004.ogg` + `kenney-ui` `tick_001.ogg` + `fisheefects` `reel.wav` 5 to 6 s (16 evenly spaced clicks a second over a quiet bed of the recorded reel; exactly 1 s) |
| `quest-accept_1.ogg` | 1.25 s | synthesised: three rising notes of a D major chord on a soft mallet tone (synthesised in sfx_manifest.py, in the key of the Hearthbay theme) |
| `quest-accept_2.ogg` | 1.25 s | synthesised: three rising notes of a D major chord on a soft mallet tone (synthesised in sfx_manifest.py, in the key of the Hearthbay theme) |
| `quest-accept_3.ogg` | 1.25 s | synthesised: three rising notes of a D major chord on a soft mallet tone (synthesised in sfx_manifest.py, in the key of the Hearthbay theme) |
| `step-wood_1.ogg` | 0.23 s | `kenney-rpg` `footstep02.ogg` |
| `step-wood_2.ogg` | 0.26 s | `kenney-rpg` `footstep03.ogg` |
| `step-wood_3.ogg` | 0.32 s | `tinyworlds` `wood03.ogg` |
| `step-wood_4.ogg` | 0.24 s | `tinyworlds` `wood02.ogg` |
| `step-cobble_1.ogg` | 0.28 s | `kenney-rpg` `footstep04.ogg` |
| `step-cobble_2.ogg` | 0.24 s | `kenney-rpg` `footstep06.ogg` |
| `step-cobble_3.ogg` | 0.23 s | `kenney-rpg` `footstep07.ogg` |
| `step-cobble_4.ogg` | 0.26 s | `kenney-rpg` `footstep05.ogg` |
| `step-grass_1.ogg` | 0.36 s | generated `step-grass.a` 1.33 to 1.69 s |
| `step-grass_2.ogg` | 0.52 s | generated `step-grass.a` 1.7 to 2.22 s |
| `step-grass_3.ogg` | 0.37 s | generated `step-grass.a` 2.84 to 3.21 s |
| `step-grass_4.ogg` | 0.41 s | generated `step-grass.a` 3.19 to 3.6 s |
| `step-sand_1.ogg` | 0.54 s | `peludo` `sand_footsteps_0.mp3` 2 to 2.54 s |
| `step-sand_2.ogg` | 0.52 s | `peludo` `sand_footsteps_0.mp3` 2.62 to 3.14 s |
| `step-sand_3.ogg` | 0.52 s | `peludo` `sand_footsteps_0.mp3` 3.22 to 3.74 s |
| `step-sand_4.ogg` | 0.52 s | `peludo` `sand_footsteps_0.mp3` 3.84 to 4.36 s |
| `ui-open_1.ogg` | 0.15 s | `kenney-ui` `open_001.ogg` |
| `ui-open_2.ogg` | 0.32 s | `kenney-ui` `open_002.ogg` |
| `ui-open_3.ogg` | 0.32 s | `kenney-ui` `open_003.ogg` |
| `ui-open_4.ogg` | 0.33 s | `kenney-ui` `open_004.ogg` |
| `ui-close_1.ogg` | 0.15 s | `kenney-ui` `close_001.ogg` |
| `ui-close_2.ogg` | 0.32 s | `kenney-ui` `close_002.ogg` |
| `ui-close_3.ogg` | 0.32 s | `kenney-ui` `close_003.ogg` |
| `ui-close_4.ogg` | 0.33 s | `kenney-ui` `close_004.ogg` |
| `ui-click_1.ogg` | 0.10 s | `kenney-ui` `click_001.ogg` |
| `ui-click_2.ogg` | 0.02 s | `kenney-ui` `click_002.ogg` |
| `ui-click_3.ogg` | 0.01 s | `kenney-ui` `click_003.ogg` |
| `ui-click_4.ogg` | 0.03 s | `kenney-ui` `click_004.ogg` |
| `page-turn_1.ogg` | 0.66 s | `kenney-rpg` `bookFlip1.ogg` |
| `page-turn_2.ogg` | 0.42 s | `kenney-rpg` `bookFlip2.ogg` |
| `page-turn_3.ogg` | 0.21 s | `kenney-rpg` `bookFlip3.ogg` |
| `lamp-ignite_1.ogg` | 0.53 s | `themightyglider` `flame_0.ogg`, played at 0.85x |
| `lamp-ignite_2.ogg` | 1.16 s | `qubodup-flare` `ignition.flac` |
| `lamp-ignite_3.ogg` | 1.22 s | `themightyglider` `flame_0.ogg`, played at 0.7x + `qubodup-flare` `ignition.flac` |
| `oars_1.ogg` | 1.15 s | generated `oars.b` 0.05 to 1.2 s |
| `oars_2.ogg` | 1.30 s | generated `oars.b` 1.8 to 3.1 s |
| `oars_3.ogg` | 1.30 s | generated `oars.c` 1 to 2.3 s |
| `oars_4.ogg` | 1.60 s | generated `oars.c` 3.2 to 4.8 s |
| `gulls_1.ogg` | 4.77 s | `rangomango` `Seagull Big Ambient 2.wav` |
| `gulls_2.ogg` | 1.46 s | `rangomango` `Seagull Ambient 5.wav` |
| `gulls_3.ogg` | 3.90 s | `rangomango` `Seagull Ambient 1.wav` |
| `gulls_4.ogg` | 0.89 s | `rangomango` `Seagull Ambient 7.wav` |
| `dock-creak_1.ogg` | 2.68 s | `antumdeluge` `tree_creak.flac` 0.05 to 1.95 s, played at 0.7x |
| `dock-creak_2.ogg` | 1.50 s | generated `dock-creak.a` 0.85 to 2.4 s |
| `dock-creak_3.ogg` | 1.75 s | generated `dock-creak.b` 1.75 to 3.55 s |
| `dock-creak_4.ogg` | 1.38 s | generated `dock-creak.c` 1.95 to 3.4 s |
| `cat-meow_1.ogg` | 0.92 s | generated `cat-meow.b` 0.2 to 1.12 s |
| `cat-meow_2.ogg` | 1.60 s | generated `cat-meow.p` 0.36 to 1.96 s |
| `cat-meow_3.ogg` | 1.15 s | generated `cat-meow.a` |
| `sail-flap_1.ogg` | 0.95 s | generated `sail-flap.a` 0.25 to 1.2 s (one gust of a generated take, with the wind rumble below 80 Hz removed) |
| `sail-flap_2.ogg` | 0.80 s | generated `sail-flap.a` 1.2 to 2 s (one gust of a generated take, with the wind rumble below 80 Hz removed) |
| `sail-flap_3.ogg` | 1.55 s | generated `sail-flap.a` 2 to 3.55 s (one gust of a generated take, with the wind rumble below 80 Hz removed) |
| `waves-lap_1.ogg` | 20.00 s loop | `randommind` `VistulaShort_0.mp3` 234 to 254 s (20 s cut with a 2 s crossfade into the audio before the loop start) |
| `waves-lap_2.ogg` | 20.00 s loop | `randommind` `VistulaShort_0.mp3` 150 to 170 s (20 s cut with a 2 s crossfade into the audio before the loop start) |
| `cat-purr_1.ogg` | 5.65 s loop | `kerzoven` `cat_purrsleepy_loop.wav` (the author's loop with rumble below 35 Hz removed) |
| `cat-purr_2.ogg` | 8.31 s loop | `kerzoven` `cat_purractive_loop.wav` (the author's loop with rumble below 35 Hz removed) |
| `hull-wash_1.ogg` | 8.80 s loop | generated `hull-wash.b` 1.1 to 9.9 s (8.8 s cut with a 1 s crossfade into the audio before the loop start, rumble below 110 Hz removed) |
| `murmur_1.ogg` | 11.00 s loop | synthesised: ten humming voices on an open fifth of D (D2, A2 and D3, each a few cents apart with a vibrato of its own, and one note that slides between A3 and B flat), with slowly changing vowels, over a breath of low noise (synthesised in sfx_manifest.py; every part runs a whole number of cycles in 11 s, so there is no seam) |

CC0 packs, all from OpenGameArt (licence on each page: CC0 1.0; Fisheefects is offered under CC0, CC-BY 4.0 and OGA-BY 3.0, used here under CC0), downloaded 2026-11-12:

| Short name | Pack | Author | Page | Files used |
|---|---|---|---|---|
| `angeloyazar-drops` | Object Dropping into Water | angeloyazar | https://opengameart.org/content/object-dropping-into-water-0 | `water_drops_1.ogg` |
| `antumdeluge` | Tree Creaking | AntumDeluge | https://opengameart.org/content/tree-creaking | `tree_creak.flac` |
| `ezwa` | 6 Short water splashes | ezwa | https://opengameart.org/content/6-short-water-splashes | `water_splash-01.flac`, `water_splash-03.flac` |
| `fisheefects` | Fisheefects | You're Perfect Studio (sounds by Memoraphile) | https://opengameart.org/content/fisheefects | `bloop.wav`, `reel.wav` |
| `kenney-rpg` | 50 RPG sound effects | Kenney | https://opengameart.org/content/50-rpg-sound-effects | `beltHandle1.ogg`, `bookClose.ogg`, `bookFlip1.ogg`, `bookFlip2.ogg`, `bookFlip3.ogg`, `clothBelt2.ogg`, `creak1.ogg`, `creak2.ogg`, `creak3.ogg`, `footstep02.ogg`, `footstep03.ogg`, `footstep04.ogg`, `footstep05.ogg`, `footstep06.ogg`, `footstep07.ogg`, `handleCoins.ogg`, `handleCoins2.ogg` |
| `kenney-ui` | Interface Sounds | Kenney | https://opengameart.org/content/interface-sounds | `click_001.ogg`, `click_002.ogg`, `click_003.ogg`, `click_004.ogg`, `close_001.ogg`, `close_002.ogg`, `close_003.ogg`, `close_004.ogg`, `open_001.ogg`, `open_002.ogg`, `open_003.ogg`, `open_004.ogg`, `tick_001.ogg`, `tick_002.ogg` |
| `kerzoven` | Cat Purr & Meow | Kerzoven | https://opengameart.org/content/cat-purr-meow | `cat_purractive_loop.wav`, `cat_purrsleepy_loop.wav` |
| `peludo` | Water Splash and sand footsteps | Peludo | https://opengameart.org/content/water-splash-and-sand-footsteps | `sand_footsteps_0.mp3`, `splash1_0.wav`, `splash2_0.wav` |
| `qubodup-flare` | Flare ignition | qubodup | https://opengameart.org/content/flare-ignition | `ignition.flac` |
| `qubodup-swosh` | Swish - bamboo stick weapon swhoshes | qubodup | https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes | `swosh-01.flac`, `swosh-03.flac`, `swosh-15.flac`, `swosh-17.flac`, `swosh-29.flac`, `swosh-40.flac`, `swosh-42.flac`, `swosh-43.flac` |
| `randommind` | Sea and river wave sounds | RandomMind | https://opengameart.org/content/sea-and-river-wave-sounds | `VistulaShort_0.mp3` |
| `rangomango` | Solo Seagull Sound Effects | Rango Mango | https://opengameart.org/content/solo-seagull-sound-effects | `Seagull Ambient 1.wav`, `Seagull Ambient 5.wav`, `Seagull Ambient 7.wav`, `Seagull Big Ambient 2.wav` |
| `skippy` | Skippy Fish Water Sound Collection | jcpmcdonald | https://opengameart.org/content/skippy-fish-water-sound-collection | `water.wav`, `waterReentry.wav` |
| `themightyglider` | Catching fire | themightyglider | https://opengameart.org/content/catching-fire | `flame_0.ogg` |
| `tinyworlds` | Different steps on wood, stone, leaves, gravel and mud | TinyWorlds | https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud | `wood02.ogg`, `wood03.ogg` |
| `transitking` | Water Waves | transitking | https://opengameart.org/content/water-waves | `wave_01_cc0-11505__transitking__wavesound.flac`, `wave_04_cc0-11505__transitking__wavesound.flac` |

The gull recordings are the least direct source: the pack's page says they were cut from a video "with full permission to share, commercial free use, no attribution required" and publishes them as CC0. Swap them if a recording with a firmer origin is wanted.

Generated clips (Higgsfield `generate_audio`, model `mirelo_text_to_audio`, 2026-11-12 and, for the sailing sounds, 2026-11-13, generated for this project):

| Clip | Prompt | Seconds | Job id |
|---|---|---|---|
| `cat-meow.a` | Cat meowing | 2 | `857c5e4f-ae6c-4420-a566-1e961158eda3` |
| `cat-meow.b` | Kitten meow | 2 | `3f4685ab-edf7-4e85-b2ab-8ccf2a20e86b` |
| `cat-meow.p` | Cat meowing | 2 | `26e620ba-b2bd-43ad-b370-15a7b07c66b9` |
| `coins.a` | Coins clinking | 2 | `8455807b-6efb-4b89-abd5-76ebe4a9d32b` |
| `coins.p` | Coins clinking | 2 | `e037b6f6-4293-4f97-870a-2bfb0f5badd1` |
| `dock-creak.a` | Wood creaking | 4 | `4a3aba0f-2182-4106-beb6-51a4ac076238` |
| `dock-creak.b` | Old wooden boat creaking | 4 | `b182b2c7-5bc2-4f22-b1f8-9051f359bcdb` |
| `dock-creak.c` | Wood creaking | 4 | `874e39b9-857f-4700-9699-dd73d86017cb` |
| `fish-splash.a` | Fish splashing in water | 3 | `c1b915a7-b293-43c5-af7f-d6a94f950c45` |
| `fish-splash.b` | Fish splashing in water | 3 | `ba8fa6b0-f661-4afa-bbd3-f5e7a527c6ec` |
| `hull-wash.b` | Boat moving through water, steady gurgling bow wash | 10 | `b9836f23-1bc7-4ec4-8c04-94364642ace9` |
| `oars.b` | Rowing a boat, oars splashing | 5 | `13029ce9-f776-483d-ad5b-db55cbe5180f` |
| `oars.c` | Rowing a boat, oars splashing | 5 | `a1d235f0-d6b9-4302-b630-5a3ee4131769` |
| `sail-flap.a` | Sail flapping in the wind | 5 | `50ddc212-e03b-4855-a199-86411c940cc9` |
| `step-grass.a` | Footsteps on grass | 4 | `84505621-1f49-46e3-bae0-5bd648c96ae3` |

Checks (`sfx_check.py`, results in `sfx-check.json`): two listeners that are not people. CLAP is asked which of 35 descriptions each file fits best (one for each sound, including four sailing sounds that are still to come): 54 of 100 files put their own description first and 85 put it in the top three; the rest are neighbours of something similar (a wood step next to a knock, `bite-dunk` next to `bobber-plop`). AudioSet tags agree for the animal, water, coin, creak, swish and reel sounds (for example Meow 0.87 to 0.94, Purr 0.85 and 0.92, Squawk 0.74 to 0.93 for three of the four gulls, Whoosh 0.27 to 0.48, Rattle 0.24 to 0.48 for `reel-spin`, Ocean and Waves for `waves-lap`). `line-snap` is the one neither listener recognises as a snapping line (it reads as a crack and a whip); it and the layered sounds (`bite-dunk`, `hook-set`) are the first to check by ear. Of the sailing sounds, two of the three `sail-flap` cuts put their own description first and the third puts it third (tags: wind, flap); `hull-wash_1` reads as a boat on water (tags Ocean 0.45, Boat 0.39) but sits nearer the descriptions of rowing and boarding than its own (ninth), so it also wants a human ear. `murmur_1` puts its own description first; the tags hear ambient music (0.68) and a human listener should say whether it is a hum or an organ: CLAP scores it 0.32 for a low eerie wordless hum, 0.33 for an organ chord and 0.24 for a choir humming a low note.
