# Asset brief: Saltbone Reach (v0.7.0)

For the asset thread. Written 2026-11-23 by the game thread. The design is in `docs/DESIGN.md` §10.3d.

**Money.** Nothing here may cost new credits (4.84 are left and Lawson has not answered about buying more). Everything below is to be made the credit-free way: built in code with `kit.mjs` and `paintkit.py`, CC0 recordings, synthesis. If something cannot be made well that way, say so and leave it: the game shows an honest stand-in until then.

**The look.** Storm slate and bone cream, with shafts of gold light (`docs/ART_BIBLE.md`, concept 03). Deep grey water with a long swell. No trees anywhere: slate, shingle, bone, sea-thrift, lichen. The bones are far too big to be a whale's and nobody says so. Cozy first, strange second: Oake's quay should look like somewhere you would be given tea. Same chunky low-poly hand as the harbour props and the belfry.

**Conventions** as before: glTF, +Y up, metres, front toward +Z, one base material per model, WebP base colour. Lit panes and lamp glass are a second material named `Glass` (the game sets its `emissiveIntensity`). Anything standing in water has its origin at the waterline and carries on at least 2.5 m below it: the swell here uncovers more than the Fen's did.

Work down the list in this order; push each group to main as it is done and tell me the commit and anything I need to know to wire it (node names, sizes, which way it faces). I am on branch `wip/reach` and will merge main. Until a model lands the game draws a plain stand-in built in `src/render/reach-scene.ts`.

## 1. What makes the Reach look like the Reach (needed first)
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/rib-a.glb` | One great rib standing out of the sea: a curved tusk of weathered bone, thick at the foot, tapering to a blunt tip that leans in over the channel. Cream bone, grey-green at the waterline with weed and limpets, cracked and pitted, lichen in orange dabs high up | 13 m above the water, foot 1.6 m thick, the tip overhangs 7 m toward +X; 2.5 m below the origin; ≤500 tris | Eighteen are instanced in two facing rows (the game mirrors it for the other row), so it must read well from the side and from underneath. Origin at the waterline in the middle of the foot. |
| `props/rib-b.glb` | The same kind, broken off at two thirds with a jagged end, a gull's nest in the break | 8 m; ≤400 tris | Three or four of the eighteen. |
| `props/vertebra.glb` | A single vertebra lying awash, the size of a cart: a drum of bone with three stubby wings | 2.6 m across, 1.4 m high, 1 m below the origin; ≤350 tris | Scattered as stepping stones and half buried on beaches. |
| `props/sea-thrift.glb` | A cushion of sea-thrift: a low green dome with a dozen pink flower heads on short stalks, built from geometry (no alpha cards) | 0.7 m across, 0.3 m tall; ≤120 tris | Several hundred are instanced on the slate. UV v runs 0 at the foot to 1 at the flower heads (the game sways them by it). |

## 2. Tryworks Landing
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/whaleboat-house.glb` | Captain Oake's house: low dry-stone walls with an upturned whaleboat for a roof (clinker planks, tarred, the keel uppermost), a plank door in the +Z end, one small lit window, a stove pipe through the hull with a cowl, a bench by the door, a row of glass net floats on the wall | 7.5 × 3 m, ridge 3.2 m; ≤2,000 tris | Origin on the ground under the middle. Window and floats are `Glass` (window warm #FFC98A; floats sea green, unlit). |
| `props/tryworks.glb` | The cold tryworks: a squat brick furnace with two great iron pots set in its top, one cracked and planted with thrift, a rusted chimney, a long-handled skimmer leaning on it | 3 × 1.8 m, 1.5 m high, chimney to 2.6 m; ≤900 tris | Nothing has been boiled here in forty years: rust, moss, no soot. |
| `props/storm-mast.glb` | Oake's weather mast: a spar with a yard, three canvas storm cones hanging from it on halyards (one up, two down), a wind vane in the shape of a whale on top | 6 m; ≤500 tris | The vane is a child node `Vane` with its pivot on the spar. The top cone is a child node `Cone` (the game hoists it when a storm is near). |
| `props/harpoon-rack.glb` | A rack of six harpoons and two lances, points up, all with their heads wrapped in sailcloth and tied | 2 m wide, 2.4 m tall; ≤400 tris | She keeps them clean and has not thrown one since. |

## 3. Places out on the water
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/the-jaw.glb` | The Jaw: the front half of a skull lying on a reef, far too big, with the two lower jawbones reaching out along the water to make the arms of a cove. Eye socket high on each side, a row of peg teeth, weed below the tide line | 26 m long, 16 m wide across the jaws, 9 m high; 2.5 m below the origin; ≤2,400 tris | The cove between the jawbones opens toward +Z and is 9 m wide: a boat lies in it. Origin at the waterline in the middle of the cove's mouth. |
| `props/tally-stone.glb` | Isolde's Tally Stone: a slate slab set upright in a cairn, as tall as a door, cut all over with strokes in fives (carve them into the texture: thousands), a dead lantern at its foot, a tin box wedged in the cairn | slab 2.1 × 1.2 m, cairn 2 m across; ≤700 tris | The tin box is a child node `LogBox`. The strokes face +Z. |
| `props/rib-mark.glb` | A brass plate let into bone, the size of a hand, with a ring bolt beside it and a frayed end of rope | plate 0.3 m; ≤80 tris | It is fixed to the ninth rib at head height above the water; the keeper reads it from the boat. |
| `props/struck-ring.glb` | Not a model of a thing: a flat ring on the water, 7 m across, of twelve short licks of pale fire | ≤200 tris | Only if it is quick: the game draws struck water with its own shader ring and can do without. |

## 4. Ten fish
As before: 1 m from nose (+Z) to tail (−Z), ≤3,000 tris (far fewer is fine), one material; a part that glows is painted into the emissive map. Lengths are for proportions. These are cold-water fish: steel, pewter, bone, with one note of colour each.
| File (`models/fish/…`) | Fish | Look |
|---|---|---|
| `bonefin-herring.glb` | Bonefin Herring, common, 0.30 m | A slim silver herring whose fins are bare white spines with no web, like little combs. |
| `slate-pout.glb` | Slate Pout, common, 0.34 m | Blunt and sulky, slate grey with a paler belly, a pushed-out lower lip, one chin whisker. |
| `thrift-wrasse.glb` | Thrift Wrasse, common, 0.26 m | Stout little wrasse, grey-green with a scatter of thrift-pink spots and pink lips. |
| `ribfish.glb` | Ribfish, uncommon, 0.85 m | Long and flat-sided, pale cream, with eleven dark curved bars down each side exactly like a ribcage; small head. |
| `kettle-cod.glb` | Kettle Cod, uncommon, 0.75 m | A pot-bellied cod, iron black above with rust freckles, a mouth like a spout. |
| `squall-mackerel.glb` | Squall Mackerel, rare, 0.55 m | A mackerel drawn in a hurry: steel blue, white zigzags along the back like rain on a window, a forked tail swept right back. |
| `lantern-ling.glb` | Lantern Ling, rare, 1.20 m | A long ling, dark umber, with one barbel under the chin that ends in a small warm light (emissive, amber). |
| `thunderback.glb` | Thunderback, epic, 1.30 m | A great halibut seen from above: slate, with one jagged white fork of lightning across its back that glows faintly (emissive, pale blue-white). Both eyes on top. |
| `old-greyback.glb` | Old Greyback, legendary, 1.70 m | A huge deep-bodied bass the colour of the swell, with barnacles along the back, a notched tail, one old harpoon scar, and a pale calm eye. |
| `the-lull.glb` | The Lull, uncanny, 1.10 m | Smooth, pale, almost round, with its eyes shut and no mouth to speak of; a slow violet sheen (violet is the game's colour for the uncanny). It looks asleep. |

## 5. Captain Brannagh Oake
A retired whaler, seventy or so: broad, short, slow, weather-coloured. A dark blue pilot coat with brass buttons done up to the neck, a knitted cap, a grey plait down her back, sea boots, a short clay pipe in her mouth that is never lit, big hands. She stands on her quay as if it might move. She needs `idle` (takes the pipe out, looks at the sky, puts it back), `talk` and `wave`, on the same 24-joint skeleton as the others, root node `oake`. Built in code like Dr. Calloway and Mister Hollis, if she can be made not to read as either of them. File: `models/characters/oake.glb`.

## 6. Sound (CC0 and synthesis; nobody has heard any of these, so say which most want an ear)
| Name | What | Length |
|---|---|---|
| `reach-day_1`, `reach-night_1` | The Reach's bed: a long slow swell on shingle, wind over bare rock, a few far gulls by day; at night the swell and a wire humming | loops, about 36 s |
| `storm-rain_1` | Hard rain on the sea, no thunder in it | loop, about 20 s |
| `storm-wind_1` | A gale in rigging: a moan that rises and falls, no synthetic noise bed (the fen's lesson) | loop, about 24 s |
| `thunder-near_1`, `_2` | A crack and a long roll, close | about 5 s |
| `thunder-far_1` to `_3` | A roll a long way off | about 6 s |
| `lightning-strike_1`, `_2` | A bolt going into the sea a cast away: a split, a hiss of steam | about 1.6 s |
| `struck-water_1` | Struck water while it lasts: a faint fizz and a singing note, quiet | loop, about 6 s |
| `storm-cone_1` | A canvas cone run up a halyard: a squeak of a block and a soft thump | about 1 s |
| `swell-boom_1`, `_2` | The swell going into one of the Kettles: a deep hollow boom and a suck back | about 3 s |

## 7. Waits on credits (do not make)
The Reach's music, and a voice for Captain Oake's lines (about 40). Listed here so they are not forgotten.
