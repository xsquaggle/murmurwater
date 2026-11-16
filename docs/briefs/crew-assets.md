# Asset brief: hands aboard (v0.5.0)

For the asset thread. Written 2026-11-16 by the game thread. The design is in `docs/DESIGN.md` §10.3c: two deckhands (Biscuit the cat, Mister Hollis the fog-person) and a second boat, the sloop Puffin.

**Money.** As for the Fen: nothing here may cost new credits. Everything is to be made the credit-free way (built in code, CC0 recordings, synthesis). If something cannot be made well that way, say so and leave it; the game shows an honest stand-in until then.

**Conventions** as before: glTF, +Y up, metres, front toward +Z, one base material `main` per model, WebP base colour, a lit part is a second material `Glass`. New in this brief: **sockets**. The game no longer wants to measure a boat by hand, so a boat carries empty child nodes with fixed names, and the game reads their positions and facing (+Z of the node is "forward" for whoever goes there). Please give me the numbers you chose as well, in your message.

Work down the list in this order; push each group to main as it is done and tell me the commit. I am on branch `wip/crew` and merge main.

## 1. The Puffin (needed first)
A small, stout gaff sloop, the sort a ferryman's brother would have sailed for crab pots: beamy, cheerful, a little comic, in the same chunky hand as the skiff. Open cockpit aft with side benches and a tiller; a short foredeck with a low cuddy forward of the mast (a cat sits on its roof); a stern lantern on a short post. Colours from `docs/ART_BIBLE.md`: bone-white topsides, an ink-dark sheer strake, a coral boot-top and rudder, oiled wood inside; **tanbark** (red-brown) sails with one cream patch. Her name board `PUFFIN` on the transom.

| File | What | Size, budget |
|---|---|---|
| `boats/puffin.glb` | The hull, deck, rudder and fittings, no mast and no sails | 5.4 m long, 2.0 m beam, 0.6 m draft, about 0.55 m of freeboard amidships; ≤3,500 tris |
| `boats/puffin-rig.glb` | Mast, standing rigging, gaff mainsail on a boom, a jib | mast about 5.2 m above its foot; ≤1,000 tris |

**Hull.** Origin on the centreline, half way along her, **at the waterline**; bow toward +Z. (The skiff's origin is at her keel and the game sinks her by hand; not again.) The core rules treat her as 5.4 × 2.0 m drawing 0.6 m, so keep the hull inside that box.

Sockets (empty nodes) on the hull:
| Node | What goes there |
|---|---|
| `Helm` | The player, seated, steering. Their origin is on the sole and the clip `boat_sit` puts them on a seat **0.465 m above it**, so there must be a bench top that high above the sole at this spot. Put it 0.26 m to port of the centreline, as on the skiff. |
| `Tiller` | A **child mesh node**, the tiller bar, pivot at the rudder head. With the helm amidships its grip end should be at 0.62 m above the sole at `Helm`, 0.09 m aft of `Helm`, on the centreline: that is where the seated clip's hand is. The game turns this node about Y. |
| `Stand` | The player on their feet to fish: on the cockpit sole, clear of the boom when the sail is furled on it. |
| `MastStep` | The mast foot: the rig's origin goes here. |
| `BowStem` | The stem head: the foot of the Fog Lamp's crook (`props/fog-lamp.glb`, origin at its foot) goes here. |
| `Lantern` | The stern lantern's flame: the game puts a light here. The lantern's panes are `Glass` (warm, #FFC98A). |
| `Crew1` | A cat: on the cuddy roof or foredeck, facing forward or out to starboard, where she can look over the side. Her origin is on the surface. |
| `Crew2` | Mister Hollis, seated on the port side bench amidships, **facing out to port** with a hand line over the side. His origin is on the sole; see his `sit` clip below for the seat height, which is yours to choose. |

And one more child mesh, `HullMask`: a flat lid closing the top of the hull at the gunwale, following her outline. The game gives it a material of its own that keeps the sea from showing inside her (her sole is below the waterline). It is never seen.

**Rig.** Origin at the mast foot. Mast, shrouds and forestay are plain children of the root and do not move. Two mesh nodes move:
- `Main`: boom, gaff and mainsail, pivot on the mast, boom pointing aft (−Z). The game swings it about Y. Morph targets, in this order as on the skiff's rig: 0 `belly` (default 1, the sail filled), 1 `furl` (default 0; at 1 the gaff is down on the boom with the cloth rolled between).
- `Jib`: the jib on the forestay. Morph 0 `belly` (the game sets it from −1 to 1, so it must fill to either side), 1 `furl` (rolled up along the stay).
The boom, furled, must leave `Stand` clear for a person 1.75 m tall, or pass beside them.

Also tell me, for the **skiff**, the point where a cat would best sit (her one berth): position and facing in the skiff's own coordinates. I will place Biscuit there by hand.

## 2. The Puffin as she is found
| File | What | Size, budget |
|---|---|---|
| `props/puffin-wreck.glb` | The same hull, forty years on a sandbar in the reeds: heeled about 20° to starboard, the mast broken and lying along her, paint gone grey-green, weed and barnacles up to her old waterline, reeds grown through a sprung plank, and **a moorhen's nest in the cockpit** (a bowl of reed with three speckled eggs). The name board `PUFFIN` still readable | ≤2,500 tris |

Origin on the ground under her middle; she sits on a bar that is about 0.2 m under the water, so carry her keel and the weed 0.6 m below the origin.

## 3. Mister Hollis
A gentleman made of fog, waiting forty years on the old sea-road for the packet boat. Very tall and narrow (about 2.0 m with his hat), a long buttoned oilskin, a sou'wester, a muffler, mittens, and a carpet bag he never puts down. **Where a face would be there is fog, and in it two small warm lights.** No skin shows anywhere: cuffs meet mittens, collar meets muffler. He should be faintly comic and entirely polite, never frightening: the lights are kind. Violet is the game's colour for the uncanny, so let the fog in his hat and the lining of his coat lean violet-grey; the oilskin itself is a worn sea-green or yellow-grey that will not be taken for the player's yellow coat.

File `models/characters/hollis.glb`, on the same 24-joint skeleton as Mara and Calloway (root node `hollis`, mesh node `hollis-mesh`), ≤8,000 tris. Three materials: `main`; `Fog` for the face (the game makes it soft and lets it thin by day: give it a pale violet-grey base colour and leave it opaque); `Glass` for the two lights (warm, #FFD9A0).

Clips:
- `idle` (standing, on the road and ashore): he looks along the road for the packet, checks a pocket watch, puts it away.
- `talk`: small, correct gestures; he touches his hat brim.
- `sit` (aboard, loop): seated upright, bag on his knees, one mittened hand holding a hand line out over the side. Tell me the seat height above his origin.
- `pull` (aboard, once, about 2 s): he draws the line in hand over hand and something small comes over the side. The game puts the fish in his hand: a child node `LineHand` on the hand that holds the line.
- `wave` (as the others have).

## 4. Biscuit at work
Biscuit (`characters/biscuit.glb` standing, `biscuit-sit.glb` sitting) is a generated, rigged model. If you can author clips for her in code as you did for the player's `boat_sit`:
- on the sitting model, `watch` (loop): she leans to look over the side, ears forward, and her tail tip goes;
- on the standing model, `swat` (once, about 1 s): a quick paw down over the edge and back, something flicked aboard;
- on the sitting model, `eat` (once, about 2.5 s): head down, working at something between her paws.
If the rig will not take it well, say so and I will do it with what she has (the game can tip and bob her whole body).

## 5. Sound (CC0 and synthesis)
| Name | What | Length |
|---|---|---|
| `cat-catch_1`, `_2` | Biscuit hooks a fish out: a small quick splash, a wet flap on wood, a chirrup | about 1 s |
| `cat-eat_1` | She eats one: small crunching and a purr | about 2 s |
| `hollis-catch_1`, `_2` | Mister Hollis lands a fish: line drawn through a mitten, a soft drip, and one low, breathy note as if the fog had said "ah" | about 1.5 s |
| `hollis-thin_1` | Dawn: he thins. A long outward breath and the note falling away | about 2.5 s |
| `hollis-thick_1` | Dusk or fog: he is there again. The same, reversed in feeling: a breath in, the note arriving | about 2.5 s |
| `crew-basket-full_1` | The crew basket is full: a wicker creak and two knocks on wood | under 1 s |
| `boatyard_1` | Pell's refit, heard under a black screen: mallet on wood, a saw, a plane, then a hull sliding into water | 5 to 6 s |
| `sloop-sail_1` | The Puffin's bigger sail filling: a deeper thump of canvas and a creak of gaff jaws | about 1.2 s |

## 6. Lines
About 45 new lines (Wick, Pell, Calloway, Mister Hollis) will be in `docs/voice/SCRIPT.md` once the quests are written; I will tell you. They stay text until Lawson has answered about credits. Mister Hollis will want a voice of his own then: slow, courteous, a little far away.
