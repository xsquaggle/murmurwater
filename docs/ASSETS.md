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

## 3D models (`public/models/`)

Image-to-3D from the concepts above, then optimized with the scripts in `docs/art/pipeline/` (weld, simplify, textures to WebP, orientation/scale/origin baked). All: Higgsfield `generate_3d`, model Tripo H3.1 (`tripo_h3_1_image_to_3d`, or `tripo_h3_1_multiview_to_3d` for characters), detailed geometry and texture, 2026-11-12, generated for this project. Every model is +Y up, in metres, facing +Z, with one material and one 1024 px WebP base-colour texture (player: 2048 px). Contact sheets are in `docs/art/sheets/<id>.webp`.

| File | Tris | Size (x, y, z) m | Origin | Glow map | Concept | 3D job id |
|---|---|---|---|---|---|---|
| `characters/player.glb` | 14,078 | 1.11 x 1.70 x 0.56 (A-pose) | feet | no | `player-sheet` | `7dcfd897-9c3f-4b47-aeac-431ec680999f` |
| `fish/butterperch.glb` | 2,958 | 0.54 x 0.79 x 1.00 | centre | no | `butterperch` | `fd9ea949-0241-4ba0-af03-fac94c86777a` |
| `fish/kettle-carp.glb` | 2,894 | 0.51 x 0.80 x 1.00 | centre | no | `kettle-carp` | `6166d97e-52c7-4417-965a-d504673da398` |
| `fish/lampjaw.glb` | 2,714 | 0.29 x 0.58 x 1.00 | centre | lure lantern, side lights | `lampjaw` | `3d6860a0-9b2a-4d88-b35e-5061b9babf09` |
| `fish/coral-snapper.glb` | 2,834 | 0.57 x 0.74 x 1.00 | centre | no | `coral-snapper` | `cbbb25c2-bf00-426e-92d6-54eac4192302` |
| `fish/moss-eel.glb` | 2,917 | 0.23 x 0.25 x 1.00 | centre | no | `moss-eel` | `a1a86978-8514-4aa0-9075-a2714368c0f8` |
| `fish/twofold-flounder.glb` | 2,832 | 0.42 x 0.93 x 1.00 | centre | no | `twofold-flounder` | `002c7237-f2a2-4d5f-9548-4f322d4f6f3c` |
| `fish/hollow-lantern.glb` | 2,847 | 0.33 x 0.77 x 1.00 | centre | lantern in the rib cage, eye | `hollow-lantern` | `521e59a9-5de6-4114-a776-086027764d40` |
| `fish/manyeye.glb` | 2,940 | 0.69 x 0.87 x 1.00 | centre | eyes | `manyeye` | `8e8f2a8a-34e3-4eb9-9a3e-9349037fdac6` |
| `boats/skiff.glb` | 5,728 | 2.33 x 2.16 x 4.00 | keel, centre | stern lantern | `skiff` | `be7b1c34-13e6-4d60-b9b6-e015989c1a9d` |
| `props/crate.glb` | 1,856 | 0.59 x 0.60 x 0.79 | base | no | `crate` | `d8862a17-b399-468c-926e-7779d6c328de` |
| `props/barrel.glb` | 1,886 | 0.82 x 0.90 x 0.83 | base | no | `barrel` | `622a5755-0592-42f7-a622-54827ad5f86a` |
| `props/tackle-box.glb` | 1,931 | 0.36 x 0.34 x 0.45 | base | no | `tackle-box` | `07bcc043-3a0b-40f3-8dd3-ff5295fcb53c` |
| `props/dock-lantern.glb` | 1,838 | 0.23 x 0.60 x 0.29 | top of the wall plate, back face | lantern glass | `dock-lantern` | `c4b6c49e-5d71-4cf9-9321-fe2931ba26b4` |

Fish are normalized to 1 m nose to tail along +Z, so the game scales each to its species length. Glow maps are an `emissiveTexture` on the same material with `KHR_materials_emissive_strength` 1.5, derived from the warm bright texels of the base colour; `docs/art/sheets/emissive-dark.webp` shows them with the lights off.

### Player rig and animation clips

Rigged and animated with Higgsfield `generate_3d`, model `meshy_rigging` (height 1.7 m), one job per clip, 2026-11-12. Each job returns its own skeleton, so `merge-anim.mjs` retargets every clip onto the skeleton of the first job. 24 joints (Hips, Spine02, Spine01, Spine, neck, Head, head_end, headfront, Left/Right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase), unit scale, rest pose is the A-pose. Clip frames are in `docs/art/sheets/player-clips.webp`.

| Clip | Length | Loops | Library action | Job id |
|---|---|---|---|---|
| `idle` | 6.03 s | yes | Idle_12 (252) | `3d514e05-df87-4b90-a2fc-1da81dd54885` |
| `idle_look` | 4.03 s | yes | Idle (0), looks around | `d8b9a10e-71af-47a8-b091-7cebfb1e8bc4` |
| `walk` | 4.20 s | yes, in place | Casual_Walk_inplace (613) | `e1447a8d-2286-4d30-a596-4ce71f96e863` |
| `run` | 0.83 s | yes, in place | Run_03 (15) | `7141b731-e678-4887-9df8-ea88fdbb9758` |
| `cast` | 2.47 s | no | Over_Shoulder_Throw (421), trimmed to wind-up and throw | `65af2772-9f1e-4f4d-b968-6f77d1c2ac6f` |
| `cheer` | 2.97 s | yes | Cheer_with_Both_Hands (303) | `5953ba38-30db-4099-9bae-1f30566c6fb4` |

