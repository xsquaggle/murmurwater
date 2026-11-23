# Asset brief: the Hush (v0.8.0)

For the asset thread. Written 2026-11-23 by the game thread. The design is in `docs/DESIGN.md` §10.3e (on branch `wip/hush` until it is merged: `git show origin/wip/hush:docs/DESIGN.md`).

**Money.** Nothing here may cost new credits (4.84 are left and Lawson has not answered about buying more). Everything below is to be made the credit-free way: built in code with `kit.mjs` and `paintkit.py`, CC0 recordings, synthesis. If something cannot be made well that way, say so and leave it: the game shows an honest stand-in until then.

**The look.** `docs/art/refs/04-the-hush.png` is the target: low isles under snow the colour of pale lilac (snow in light about #E9E2F4, in shade about #B9A8D8), firs with a heavy pad of snow on every tier, grey-lilac stone, and water that is a dark mirror. By night an aurora in green (#6FE3B4) and violet (#A884F0) fills the sky and the water; the game draws the aurora, the mirror and the falling snow. The only warm thing anywhere is lamplight (#FFC98A): the Choir's lantern, the chapel windows, the stone lanterns on the quay. Nothing is jagged or windswept: every edge is rounded off by snow. Cozy first, strange second: the landing should look like somewhere you would be given soup. Same chunky low-poly hand as the harbour props.

**Conventions** as before: glTF, +Y up, metres, front toward +Z, one base material per model, WebP base colour. Lit panes and lamp glass are a second material named `Glass` (the game sets its `emissiveIntensity`). Anything standing in water has its origin at the waterline and carries on 1.5 m below it (this water is flat: there is no swell). Snow is modelled and painted on, not added by the game.

Work down the list in this order; push each group to main as it is done and tell me the commit and anything I need to know to wire it (node names, sizes, which way it faces). I am on branch `wip/hush` and will merge main. Until a model lands the game draws a plain stand-in.

## 1. What makes the Hush look like the Hush (needed first)
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/snow-fir-a.glb` | A grown fir under snow: a dark trunk, four or five tiers of boughs, each tier a chunky dark-green skirt with a thick rounded pad of snow lying on it, a snow cap on the tip. Built from geometry (no alpha cards) | 6.5 m tall, 3 m across the lowest tier; ≤450 tris | Several hundred are instanced, so it must read from far off as a white cone with dark green showing under each tier. Origin on the ground at the trunk. UV v runs 0 at the foot to 1 at the tip. |
| `props/snow-fir-b.glb` | A young fir, three tiers, leaning a little under its snow | 3.5 m; ≤280 tris | Mixed in with the first. |
| `props/frost-flower.glb` | The pale seed-head plant in the foreground of the reference: three or four bare stalks each ending in a round puff of frost, standing out of the snow | 0.7 m tall, 0.5 m across; ≤120 tris | Several hundred are instanced on the isles. UV v runs 0 at the foot to 1 at the heads (the game barely sways them). |
| `props/snow-rock.glb` | A rounded boulder of grey-lilac stone with a cap of snow, for shores and for standing alone in the water | 2.4 m across, 1.3 m above the origin, 1.5 m below; ≤160 tris | Scattered at many sizes and turns: no obvious front. |

## 2. Evensong Landing
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/chapel.glb` | The Choir's chapel: small, of grey-lilac stone, a steep slate roof deep in snow, a plank door in the +Z gable under a stone bell-cote that is plainly empty (the yoke and the rope are there, the bell is not), three narrow lit windows down each side, a stove pipe with a little smoke-blackened cowl, a bench by the door with three cushions | 8 × 5 m, ridge 6 m, bell-cote to 7.5 m; ≤2,200 tris | Origin on the ground under the middle. Windows are `Glass` (warm #FFC98A). The bell rope hangs down the gable to head height and ends in a frayed end: child node `Rope`. |
| `props/stone-lantern.glb` | A quay lantern of stone: a squat square pillar with a lit box on top under a little stone roof with a pad of snow | 1.3 m tall; ≤220 tris | Six or eight stand along the quay. The lit box is `Glass` (warm). |
| `props/hymn-board.glb` | A hymn board on a post: a dark wooden board with three rows of slide-in number cards (the numbers are 4, 4 and 4), a little gabled roof over it with snow | board 0.6 × 0.8 m, 2 m tall on its post; ≤200 tris | It stands by the chapel door, facing +Z. |

## 3. Places out on the water
| File | What | Size, budget | Notes |
|---|---|---|---|
| `props/needles-eye.glb` | The Needle's Eye: a natural arch of grey-lilac rock, as in the middle of the reference, snow lying thick on its top and on the two feet it stands on | 22 m long, 9 m thick, 12 m high; the opening is 9 m wide and 7.5 m high above the water; 1.5 m below the origin; ≤1,800 tris | A boat sails through the opening along Z, so the origin is at the waterline in the middle of the opening and the opening must be clear down to 2 m under water. |
| `props/dumb-bell.glb` | One of the Dumb Bells: a white-painted timber post standing in the water, with a short arm near the top from which hangs a bronze bell, green with verdigris, plainly without a tongue (you can see up into it). A band of raised letters round the bell's lip | post 3.4 m above the water, bell 0.7 m across; 1.5 m below the origin; ≤350 tris | Seven stand in a row, and smaller ones mark the road. The bell is a child node `Bell` with its pivot where it hangs. Front (+Z) is the side the arm is on. |
| `props/the-pipes.glb` | The Pipes, Isolde's place: a cliff face of pale stone columns side by side like the pipes of a church organ, tallest in the middle and stepping down to both sides, a rime of frost on every top, dark slots between them. At the foot a ledge with three seats cut out of the stone, side by side, worn smooth. Under the middle seat, a tin box | 18 m wide, 13 m tall in the middle and 5 m at the ends, 4 m deep; the ledge is 1 m above the water and 3 m deep; 1.5 m below the origin; ≤2,400 tris | The pipes and seats face +Z, over the water. The tin box is a child node `LogBox`. Origin at the waterline under the middle seat's front edge. |

## 4. Ten fish
As before: 1 m from nose (+Z) to tail (−Z), ≤3,000 tris (far fewer is fine), one material; a part that glows is painted into the emissive map. Lengths are for proportions. These are fish of cold still water: white, pewter, lilac, with one note of colour each.
| File (`models/fish/…`) | Fish | Look |
|---|---|---|
| `snow-smelt.glb` | Snow Smelt, common, 0.22 m | Slim and silver-white, nearly see-through at the fins, one fine lilac line from gill to tail. |
| `pale-dab.glb` | Pale Dab, common, 0.30 m | A small flatfish white as a plate, with two grey freckles and a put-upon look. |
| `hushling.glb` | Hushling, common, 0.26 m | A round-headed little cod, lilac-grey, with its mouth drawn very small and shut, as if it had just said "sh". |
| `fir-perch.glb` | Fir Perch, uncommon, 0.40 m | A perch with a dark green back and a white tip to every spine of its fins, like snow on a fir. |
| `glass-grayling.glb` | Glass Grayling, rare, 0.50 m | A grayling so pale it is almost clear (paint it very light, the bones just showing), with a great sail of a back fin that carries a faint wash of the aurora, green into violet (emissive, faint). |
| `bellmouth.glb` | Bellmouth, rare, 0.70 m | Deep-bodied, bronze going green in streaks like an old bell, with a round mouth that flares out at the lip exactly like one. |
| `aurora-char.glb` | Aurora Char, rare, 0.60 m | A char with an indigo back and a belly banded in green and violet that glows (emissive), white leading edges to its fins. |
| `whisper-sturgeon.glb` | Whisper Sturgeon, epic, 1.50 m | A long sturgeon, pale lilac-grey, five rows of white bony plates, four barbels like a drooping moustache, a tiny mouth underneath. |
| `old-hoarfrost.glb` | Old Hoarfrost, legendary, 1.80 m | A huge pike, white, feathered all over with frost patterns in pale blue, one milky eye, an old hook in the corner of its jaw with a faded ribbon on it. |
| `the-held-note.glb` | The Held Note, uncanny, 1.00 m | Smooth and pale, its body arched like a bow, its mouth open in a perfect round O, eyes closed; a slow violet sheen (violet is the game's colour for the uncanny). It looks as if it is about to sing. |

## 5. The Choir
Three sisters, Una, Twyla and Tress: old, upright, alike. Each wears a cream hooded cloak to the ground with a lilac diamond at the hem front and back, as in the reference; the hood is up and the face under it is in shadow but kind (a nose, a chin, closed smiling mouth, white hair at the temples). The game draws **one model three times** at three heights (1.0, 0.94 and 0.88), so make one sister, file `models/characters/choir.glb`, root node `choir`, on the same 24-joint skeleton as the others, with two things she may be holding as child nodes that the game shows or hides: `Lantern` in the right hand (a black iron lantern with four lit panes, `Glass`, warm) and `Book` held shut against the chest in both hands (a hymn book with a ribbon). With neither shown, her hands should be in her sleeves, or look as if they were. She needs `idle` (stands very still; now and then the head turns a little as if to a neighbour), `talk` (a small lift of the chin and a nod), `wave` (the hood dips) and, if it can be done, `breath`: she draws herself up as if to begin singing, holds it for a second, and lets it go.

## 6. Sound (CC0 and synthesis; nobody has heard any of these, so say which most want an ear)
The Hush is the quietest place in the game: its bed should be the nearest thing to silence that still tells the player the sound is on. Record at ordinary levels; the game sets how quiet.
| Name | What | Length |
|---|---|---|
| `hush-day_1`, `hush-night_1` | The Hush's bed. By day: air over snow, very far ice ticking, nothing alive. By night: even less, with a faint high glassy shimmer that comes and goes | loops, about 40 s |
| `stir_1` to `_3` | The water being stirred by a noise: one drop into a still pool, with a long soft tail | about 1.5 s |
| `glass_1` | The water coming back to glass: a finger on the rim of a wine glass, one note, very gentle | about 2.5 s |
| `fir-shed_1`, `_2` | Snow sliding off a fir bough and landing: a hiss and a soft thump | about 1.5 s |
| `step-snow_1` to `_4` | A footstep in dry snow: a squeak and a crunch (the same kind of file as `step-wood` and the others) | about 0.4 s |
| `bell-dumb_1` | A bell with no tongue touched by a boat hook: a dull knock and the ghost of a ring | about 1.5 s |
| `choir-breath_1`, `_2` | Three old women drawing breath together as if to begin a hymn, holding it, and letting it go without a note | about 2.5 s |
| `pipes-note_1` | The Pipes sounding once: a deep organ chord (low, with a fifth above it) that swells over five seconds and stops dead, leaving a long tail in the cold | about 10 s |
| `muffle_1` | Pell quieting the Puffin: felt wrapped and tied, a mallet on a wooden block through cloth | about 2 s |

## 7. Waits on credits (do not make)
The Hush's music, and voices for the Choir's lines (about 45, in three voices). Listed here so they are not forgotten.
