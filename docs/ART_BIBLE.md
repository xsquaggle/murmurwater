# Murmurwater — Art Bible

Status: v1 (2026-11-12). Every asset, shader and UI element is judged against this page.

## 1. The look in one paragraph
Stylized low-poly, flat-shaded 3D lit like a painting at golden hour. Chunky, slightly soft silhouettes; deep teal water that glows turquoise in the shallows; warm amber lantern light against dusky violet shadow. Air you can see: fog, god rays, drifting motes, spray. The world is warm, but there is always one thing slightly wrong in frame — a reflection that doesn't match, a fish shadow too large, a lantern burning under the water.

## 2. Palette ("Lantern Dusk")
All colours are authored in sRGB and live in `src/render/palette.ts`. Do not invent new hues; tint from these.

| Role | Name | Hex |
|---|---|---|
| Deep water | Abyss Teal | `#0B2E36` |
| Mid water | Murmur Teal | `#17595E` |
| Shallows | Lagoon | `#3FA7A0` |
| Foam / highlight | Seafoam | `#D8F3E6` |
| Warm light | Lantern | `#FFB35C` |
| Warm light, hot | Wick | `#FFE2A0` |
| Shadow | Dusk Violet | `#3B2A4F` |
| Shadow, light | Heather | `#7A6390` |
| Sand / paper | Bone Cream | `#F2E3C6` |
| Rock | Slate | `#5C6670` |
| Foliage | Moss | `#6F8F4E` |
| Foliage, dark | Pine | `#2F4E3A` |
| Wood | Driftwood | `#8A6A4F` |
| Accent | Coral Rose | `#E86F6F` |
| Uncanny | Wrong Cyan | `#7CFFD4` |
| Uncanny | Dream Violet | `#B48CFF` |

Rules: warm light / cool shadow, always. Saturation peaks only on lights, rare fish and UI accents. The two Uncanny colours appear only on uncanny things.

**Region accents** (each region shifts the grade, not the palette):
Hearthbay = amber dusk; Mossglass Fen = moss-green fog, bioluminescent cyan; Saltbone Reach = storm slate, bone cream; The Hush = pale lilac, aurora; Sunken Lanterns = deep teal with underwater amber; Still Eye = mirror violet.

## 3. Shapes
- **Cozy things** (houses, boats, NPCs, common fish): rounded, bottom-heavy, chunky bevels, 6–12 sided cylinders, gently leaning.
- **Uncanny things**: too-symmetrical or wrongly asymmetrical, thin and tall, extra eyes/fins, sharp facets.
- **Scale:** the player is ~1.7 m; doors and docks are slightly oversized for coziness.
- **Poly budget:** props 50–800 tris, fish 150–600, boats 600–2,500, hero landmarks (lighthouse) up to 5,000, islands procedural.

## 4. Materials and lighting
- Flat shading (faceted normals), vertex colours from the palette, no photo textures. Subtle per-face colour jitter (±3% value) to avoid plastic.
- Lighting: one sun/moon directional with soft shadows, a hemisphere light (sky colour above, sea colour below), and point lights for lanterns that flicker.
- Lit with a gentle toon ramp (three-band diffuse with soft edges) plus rim light for silhouettes against the sky.
- Emissive only for lights, eyes and Uncanny things; bloom picks them up.
- Post: ACES-like filmic tone map, bloom, light vignette, warm/cool split grade per region and time of day, optional SSAO-style contact darkening on High+.

## 5. Water (hero element)
- Gerstner-sum waves on a dense near-field grid with distance LOD.
- Colour by depth (Lagoon → Murmur Teal → Abyss Teal) using the scene depth buffer.
- Banded stylized foam at shorelines and around objects (depth-difference), wave-crest foam, boat wakes.
- Fresnel sky reflection, a sharp stylized sun/moon glint, soft refraction wobble of what's beneath.
- The Uncanny detail: in places the reflection shows things that aren't there (second moon, lit windows on dark islands).

## 6. Sky, time and weather
- Day cycle of ~24 real minutes (dawn → day → golden hour → dusk → night), skybox shader with gradient, sun disk, stars, two moons at night (one only in reflections, until late game).
- Weather: Clear, Haze, Rain, Storm (Saltbone), Fog (Fen), Aurora (Hush). Weather changes the fish table.

## 7. Effects
Splash on lure entry, ripples, bite plunge burst, line tension shimmer, reel-in spray, catch-reveal light burst with rarity colour, coin sparkle, fog wisps, fireflies over the Fen, rain streaks and drop rings, sea spray at the boat bow.

## 8. UI
- Paper-and-brass feel: Bone Cream panels with soft ink outlines, Dusk Violet text, Lantern highlights. Rounded corners 10–14 px.
- Typography: a warm serif for titles ("Fraunces", OFL) and a clean humanist sans for numbers and body ("Nunito", OFL), bundled locally.
- Numbers format with short suffixes (1.2K, 3.4M) and tick up when they change.
- The HUD stays minimal while fishing; menus slide in like a ledger.

## 9. Style references
`docs/art/refs/` holds the locked style reference images (generated 2026-11-12 against this bible; see docs/ASSETS.md). They are **canon**: generated assets are compared against them before they go in.

| Ref | Locks |
|---|---|
| 01-keyart-hearthbay | The target screenshot: saturated violet-to-orange golden-hour sky, rocky cliffs with stone walls and heather, glowing lighthouse, dock lanterns, clear teal water with rocks visible below, sea stacks and an arch, second moon only in the reflection |
| 02-mossglass-fen | Region 2 mood: fog layers, cyan-tipped reeds, stilt houses |
| 03-saltbone-reach | Region 3: whale-bone isles, storm slate, shaft of gold light |
| 04-the-hush | Region 4: aurora, glass-still pale sea, the Choir |
| 05-fish-sheet | Fish style and the eight Hearthbay species (butterperch, kettle carp, lampjaw, coral snapper, moss eel, twofold flounder, hollow lantern, manyeye) |
| 06-characters | Player (mustard raincoat, teal beanie), Mara, Pell, Wick, Dr. Calloway, Biscuit |
| 07-boats | Boat line-up: skiff, sloop, cutter, trawler, lantern boat, ferry |
| 08-ui-mood | Paper-and-brass UI panels, catch card |

**Lessons from comparing the first engine renders to ref 01 (2026-11-12):** our sky was too washed out (needs violet zenith, orange horizon), islands too soft and sandy (need cliffs, big chunky shore rocks, stone walls, heather, paths and fences), crest foam read as blobs, and close-up detail (foam rings at posts, hanging lanterns, smoke) carries the cozy feeling.

## 10. Asset pipeline rules
- **Fidelity bar (Lawson, 2026-11-12):** models should look as if they have had three fidelity passes. Cartoony is welcome; crude is not. Higgsfield credits already on the account may be spent freely; never buy credits or plans without asking.
- Raw generations are source material: decimate, re-colour to palette vertex colours, flat-shade, check scale, then export GLB to `public/models/`.
- Every third-party or generated asset is recorded in `docs/ASSETS.md` with source, tool, licence and date.
