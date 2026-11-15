# Asset brief: Mossglass Fen (v0.4.0)

For the asset thread. Written 2026-11-15 by the game thread. The design is in `docs/DESIGN.md` §6 (where the regions lie, the sea-road, the Fog Lamp) and §10.3b (the Fen).

**Money.** Nothing here may cost new credits. Lawson has not yet answered about buying more, so everything below is to be made the credit-free way (built in code with `kit.mjs` and `paintkit.py`, CC0 recordings, synthesis). If something cannot be made well that way, say so and leave it: the game shows an honest stand-in until then.

**The look.** Moss-green haze, still shallow water as clear as green glass, bioluminescent cyan after dark (`docs/ART_BIBLE.md`). Cozy first, strange second. Same chunky low-poly hand as the harbour props and the belfry.

**Conventions** as before: glTF, +Y up, metres, front toward +Z, one base material per model, WebP base colour. A part that should light up after dark is a second material named `Glow` (plants, fish) or `Glass` (lamps): the game sets its `emissiveIntensity`, so give it an emissive colour and map and leave intensity at 1. Anything standing in water has its origin at the waterline and carries on at least 1.5 m below it, because the depth under it varies.

Work down the list in this order; push each group to main as it is done and tell me the commit. I will wire each in as it lands.

## 1. The crossing (needed first)
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/fog-lamp.glb` | The Fog Lamp for the skiff's bow: a curved iron crook holding a caged lantern | 0.9 m tall, lantern 0.28 m; ≤350 tris | Origin at the foot of the crook (it is fixed to the bow stem). Lantern panes are `Glass`, cyan-white (#BFF6FF). |
| `props/sea-road-light.glb` | A light of the old sea-road: an iron spar standing out of the sea with a caged lamp on top, barnacled, leaning a few degrees, a collar of cork floats at the waterline | 3.2 m above the water, 2 m below; ≤500 tris | About twenty stand in two lines in the fog. Lamp panes are `Glass`, cyan (#7FF0E0). They are dark until a boat with the Fog Lamp comes near. |

## 2. What makes the Fen look like the Fen
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/lantern-tree-a.glb` | A drowned tree: flared, buttressed trunk with knees, flat crown, long strands of moss hanging from the boughs | 11 m tall, crown 7 m across; ≤1,200 tris | About eighty are instanced. The hanging moss is `Glow` (#7FF0D0). Roots carry on 1.5 m below the origin. |
| `props/lantern-tree-b.glb` | The same kind, leaning and half dead, few strands | 8 m; ≤900 tris | |
| `props/reeds-a.glb`, `props/reeds-b.glb` | A clump of reeds and bulrushes, built from blades (no alpha cards) | 1.2 m across, 1.6 to 2.2 m tall, 0.6 m below the origin; ≤160 tris each | Several hundred are instanced. UV v must run 0 at the foot to 1 at the tip of every blade: the game sways them by it. |
| `props/lily-glow.glb` | Five to seven lily pads and two closed buds, lying on the water | 1.6 m across; ≤120 tris | Buds are `Glow` (#9FF5E6). |

## 3. Sedge Landing and the Listening Post
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/stilt-hut.glb` | Dr. Calloway's field hut: a plank hut on four stilts with a reed thatch, a narrow deck across the front (+Z), a ladder down from the deck, a lantern by the door, a lit window, a rain gauge and a wind vane on the rail | hut 3 × 3 m, floor 2.2 m above the origin; ≤2,000 tris | Origin on the ground under the middle. Lantern and window are `Glass` (warm, #FFC98A). |
| `props/field-kit.glb` | Her field table: a folding table with a fish-measuring board, a brass scale, specimen jars and a notebook; beside it a brass theodolite on a tripod | table 1.2 × 0.6 m, tripod 1.4 m; ≤900 tris | |
| `props/packet-box.glb` | Mara's packet box: a stout lidded sea crate on short legs, a brass scale pan on the lid, "M.T." and a fish stencilled on the front, and a pennant on a pole in the red and cream stripes of her stall | crate 0.9 × 0.6 × 0.6 m, pole 1.8 m; ≤700 tris | The pennant is a child node `Pennant` with its pivot at the pole, so the game can stir it. |
| `props/listening-post.glb` | Isolde's listening post: a weathered plank platform on short piles; on it a great brass ear trumpet on a swivel stand, pointed down at the water; a stool, a dead lantern, a tin box for the logbook | platform 2.4 m square, horn 1.6 m long with a 0.9 m bell; ≤1,500 tris | The tin box is a child node `LogBox`. |

## 4. Ten fish
As the Hearthbay fish: 1 m from nose (+Z) to tail (−Z), ≤3,000 tris (far fewer is fine), one material; a part that glows is painted into the emissive map. Lengths below are for you to judge proportions by.
| File (`models/fish/…`) | Fish | Look |
|---|---|---|
| `reedling.glb` | Reedling, common, 0.28 m | Pencil-thin, pale straw green with dark upright bars like reed shadows, a small upturned mouth. |
| `mudlark.glb` | Mudlark, common, 0.30 m | Squat and wide-mouthed, warm brown with a cream throat and short whiskers; a cheerful face. |
| `glassfin.glb` | Glassfin, common, 0.24 m | Leaf-shaped and nearly clear: palest aqua, a darker line for the spine, a bright cyan edge to the fins. |
| `sedge-pike.glb` | Sedge Pike, uncommon, 0.80 m | Long and flat-snouted, olive with bark mottling; it is pretending to be a log, and a sprig of sedge grows on its back. |
| `mossback-tench.glb` | Mossback Tench, uncommon, 0.50 m | Round-backed, bronze-green, with a hump of bright moss and two tiny white flowers on it. |
| `glowbelly.glb` | Glowbelly, rare, 0.40 m | Plump; dark teal above, and a belly that is a lit lantern (emissive, warm cyan). |
| `stilt-gar.glb` | Stilt Gar, rare, 0.90 m | A needle-nosed gar, slate green, with long thin fins hanging down like stilts. |
| `bottomless-eel.glb` | Bottomless Eel, epic, 1.60 m | A very long eel, ink black going to deep green, pale eyes; the tail thins to a thread. |
| `old-mossglass.glb` | Old Mossglass, legendary, 1.10 m | A great carp of bottle-green glass with gold-rimmed scales and whiskers; a darker shape shows inside it; faint glow. |
| `the-listener.glb` | The Listener, uncanny, 1.00 m | Pale and smooth with no eyes, and two wide round fins like ears or gramophone horns; a violet cast (violet is the game's colour for the uncanny). |

## 5. Dr. Ines Calloway
A visiting naturalist: brisk, cheerful, practical. Wide-brimmed sun hat, round spectacles, a waxed field coat with too many pockets, rolled sleeves, tall boots, a measuring tape round her neck, a satchel. She needs `idle` and `talk` clips like Mara and Pell.

A generated character needs credits we do not have. If you can make her well without them (for instance from one of the rigged characters you already have, reshaped and repainted so that she does not read as the same person, with the hat, spectacles and satchel added), do. If the result would look like a recolour, leave her: she stays a stand-in figure until Lawson answers. Tell me which.
File: `models/characters/calloway.glb`.

## 6. Sound (CC0 and synthesis)
| Name | What | Length |
|---|---|---|
| `fog-lamp-light_1` | The Fog Lamp lighting itself: a soft whoomp and a glassy ring | about 1.2 s |
| `sea-road-chime_1` to `_3` | One far, glassy bell note each, a little apart in pitch: a sea-road light answering as the boat passes | about 1.5 s |
| `fog-cross_1` | The middle of the crossing: a low breath of wind with the murmur under it, swelling and falling | 4 to 5 s |
| `packet-box_1` | The packet box taking a catch: lid, rope creak, coins | about 1.5 s |
| `reed-brush_1`, `_2` | A hull pushing through reeds | about 1 s |
| loop `fen-day` | Ambience for the Fen by day: frogs, insects, slow drips, a far bird | 30 to 40 s, seamless |
| loop `fen-night` | By night: crickets, deeper frogs, and something far off that might be humming | 30 to 40 s, seamless |

Tell me where the two loops go and how they are named (the game has no recorded ambience loops yet).

## 7. Music
A day theme and a night theme for the Fen need about 40 credits by the route that worked, so they wait for Lawson. If you see a credit-free way to a theme that would stand beside the Hearthbay ones, tell me before spending time on it.
