# Asset brief: things fished up (v0.6.0)

For the asset thread. Written 2026-11-23 by the game thread. The design is in `docs/DESIGN.md` §7.1: now and then a cast comes down over something that is not a fish (a crate, a sea chest, a relic in oilcloth). The float is drawn slowly under, the strike takes a dead weight, and it is hauled up a little at a time: it knocks on the bottom as a warning, catches fast if the reel is not let go, and is swung up out of the water under the rod at the end. Relics stand on the Keeper's Shelf, a page in the satchel, and Moonpearls are set in hollows beside them.

**Money.** Nothing here may cost new credits. Lawson has not yet answered about buying more, so everything below is made the credit-free way (CC0 recordings, layering, synthesis). If a sound cannot be made well that way, say so and leave it: the game plays its stand-in until then.

**Nothing is waiting on you.** Every sound below has a stand-in in the game already (`src/audio/audio.ts`, the block "things fished up"), and each name is in `PENDING`, so the build is whole without the files. A sound is used from the first build after its `_1` file lands; nothing in the code needs to change. The models (crate, sea chest, the oilcloth bundle, eight small relics) are done in code in `src/render/find-models.ts`: no models are asked for.

**Conventions** as before: mono OGG in `public/audio/sfx/`, named `<name>_<n>.ogg`, levelled like the rest of the bank (`sfx_build.py`), 4 ms of trailing silence, sources logged in `docs/ASSETS.md`. The count of variations is fixed in the game's table: please make exactly that many.

## Sounds

| Name | Files | What | Length |
|---|---|---|---|
| `find-drag` | `_1`, `_2` | The float drawn slowly under by a dead weight: one long, low gulp of water, with no splash and no snatch. It must not be mistaken for the bite (`bite-dunk`), which is quick and bright. | 0.8 to 1.2 s |
| `haul-knock` | `_1`, `_2`, `_3` | The thing on the line knocks on the sea bed, felt up the line: one dull, woody thud, muffled as if under water, with a short low ring after it. It is the player's cue to let go of the reel, so it must be plain over the reel and the sea. | 0.3 to 0.5 s |
| `haul-snag` | `_1`, `_2` | It has caught fast on the bottom: a heavy thud and the line and rod taking the strain (a taut creak rising). Worse news than the knock, and clearly a different sound. | 0.7 to 1 s |
| `haul-free` | `_1`, `_2` | It comes free of the bottom, or slides over what it knocked on: a soft scrape and a few bubbles, the strain going out of the line. Gentle; a relief. | 0.5 to 0.8 s |
| `find-surface` | `_1`, `_2` | A heavy box swung up out of the sea: it breaks the surface and the water runs off it in a stream, then drips. Heavier and longer than `land-splash`. | 1.2 to 1.6 s |
| `crate-open` | `_1`, `_2` | A wet wooden crate prised open: a lid levered, a nail squeal or a crack of wood, things shifting inside. No coins (the game plays its own). | 0.7 to 1 s |
| `relic-found` | `_1` | A relic in the hands. A short sting, not a tune: a struck glass or a small bell with a long tail, and under it one low note a little out of tune with it, as if something far down had answered. Cozy first, strange second; it sits beside `sting-rare` and `bell-toll` in the same world. | 2.5 to 3.5 s |
| `rumour` | `_1` | Word of a thing still in the water: a page turned, and one soft high note after it. Quiet; it plays over ordinary play and must not startle. | about 1 s |
| `pearl-set` | `_1`, `_2` | A Moonpearl set into a small hollow in wood: a tiny hard tick and a clear, glassy ring. | 0.5 to 0.8 s |
| `pearl-lift` | `_1` | The pearl lifted out again: the same ring, shorter and falling. | 0.3 to 0.5 s |

Work down the table in that order (the first five are heard on every haul). Push each group to main as it is done and tell me the commit. If you have a view on the game's stand-ins after hearing the real ones described, say so: nobody has yet listened to either.
