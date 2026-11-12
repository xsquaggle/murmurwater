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
