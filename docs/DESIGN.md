# Murmurwater — Game Design Document

Status: pre-production draft v1 (2026-11-12). Owner: Claude (director). Living document.

## 1. Vision

**One line:** A warm, lantern-lit fishing incremental on an archipelago that is quietly being dreamed by something under the sea.

**The fantasy:** You are the new keeper of a dark lighthouse on a cozy island chain. You fish, sell, gear up, sail out and chart new isles, and the numbers climb. But the deeper you fish, the stranger the catch: fish with too many eyes, fish that hum the tune the baker was whistling, a reflection of a second moon that isn't in the sky. The cozy surface is real, and so is what is underneath.

**Pillars**

1. **Fishing is a skill, and it feels wonderful.** Casting, the bite, the hook and the fight are tactile, readable and juicy. Playing by hand is always the best way to earn.
2. **Always a next goal.** Every minute the player knows what they are saving for, where they are sailing next and which mystery they are chasing.
3. **Cozy on top, uncanny underneath.** Warm light, soft music, friendly people; the weirdness arrives in small, specific, unexplained details and grows with progress.
4. **The sea is a place.** Sailing is free and physical. The world is charted by going there, not by menu.
5. **Respect the player.** No offline accrual, no dark patterns, no grind walls, saves are sacred, nothing is rushed.

**Reference genre:** the simulator-incrementals on Steam (fish, sell, upgrade, rebirth, automate), lifted with action-game feel and an explorable 3D world. Not a clicker.

## 2. Core loops

**Moment-to-moment (10–60 s):** pick a spot → cast (aim + charge) → wait, read nibbles → hook the real bite on time → fight (reel against tension, counter the fish's runs) → catch reveal (size, rarity, any Strange trait) → into the hold.

**Session loop (5–20 min):** fill the hold → sell at a dock (or keep for quests/journal) → buy/upgrade gear, bait, boat parts → take quests from the board and NPCs → sail to a better spot or a new island.

**Run loop (60–150 min):** push a region's economy → hit the limit of what coins can buy → **Ring the Drowned Bell** (prestige) → the tide turns, the islands forget, you keep your Echoes → buy permanent Echo upgrades → race back faster and further.

**Arc loop (10–15 h):** five regions, each with its own fish, NPCs, mystery beat, boat requirement and a story climax → final descent → ending → postgame.

## 3. Fishing (the heart)

### 3.1 Cast
- Third-person camera behind the player. The mouse moves a reticle on the water.
- Hold **LMB** to charge: a power meter fills and wobbles near the top; releasing in the bright band ("sweet spot") gives a **Clean Cast** (bonus bite speed and slightly better rarity roll for this cast).
- Cast range comes from the rod's **Reach**. Overcharged casts wobble off target.
- The lure arcs through the air (verlet line), splashes, ripples.

### 3.2 Wait and bite
- Each spot has a fish table (region + zone + time of day + weather + bait).
- After a randomized wait (shortened by bait, lure, Clean Cast, hotspot), fish approach as shadows.
- **Nibbles:** 0–3 small bobs. Hooking on a nibble spooks the fish (reset wait, small penalty).
- **Bite:** the bobber plunges, a splash and a sharp sound. The player has a reaction window (rarer fish = shorter window) to click **LMB**. Timing grade: Perfect (first 35% of window) / Good / Late (miss).
- Perfect hooks start the fight with the fish at lower stamina and raise the **Rhythm** streak.

### 3.3 Fight
State: `distance` (fish to rod, 0 = landed), `tension` (0–1), `fish stamina`, `fish run direction`.
- **Hold LMB to reel:** pulls the fish in at rod Power, raises tension.
- **Release:** tension relaxes, fish swims away (distance grows) slowly.
- **Runs:** the fish periodically bolts left or right (telegraphed by a splash and a line hum). Hold **A/D** (or move the mouse) *against* the run to steer; steering correctly halves tension gain and drains fish stamina; steering wrong spikes tension.
- **Thrash:** strong fish thrash (camera shake, spray). Reeling during a thrash spikes tension hard; wait it out.
- **Snap:** tension at 1.0 for longer than the rod's grace time breaks the line (lose the fish and the lure keeps, bait lost).
- **Slack:** tension near 0 for too long lets the fish throw the hook.
- **Landing:** distance hits 0 → lift and catch-reveal moment (slow-mo, light burst, card with name, size, weight, rarity, Strange trait, value, "NEW!" if first catch).
- Rod **Control** widens the safe tension band; **Power** reels faster; fish **Strength**, **Stamina** and **Temper** (run frequency) define difficulty.

### 3.4 Rhythm (active-play bonus)
Consecutive successful catches with no snaps build Rhythm (up to ×1.5 value at 10 stacks, decays if idle 60 s). This keeps hand-fishing clearly ahead of automation.

### 3.5 Catch values
`value = species base × size factor × rarity × Strange trait × Rhythm × gear/relic/Echo multipliers`.
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary, **Uncanny** (story-tied, unique behaviour).
- Strange traits (rare modifiers, ~3% base): Glimmering (×2), Hollow (×3), Two-Faced (×4), Humming (×5), Inverted (×8). Shown with a subtle shader effect on the fish model. More traits unlock with story.

## 4. Automation (unlocks ~45 min in)
Earns only while the game is open. Nothing accrues while closed (no offline earnings, by design).

**Lantern Pots (built, v0.3.0).** A pot is a wicker trap under a cork float with a small lantern on it. The player sets it by hand (F) in open water from a shore, a dock or over the side of the skiff, and it fishes on the game's own clock while the player does something else.
- A pot only traps fish that are **already in the journal** and that live in the zone it sits in, so automation follows active play and never gets ahead of it. Set where the journal knows nothing, its lantern stays dim and the game says so.
- One fish about every 50 s, rarer fish half as likely per tier as on a rod, worth 50% of a hand-caught one. No Strange traits, no Rhythm.
- It holds 3 and **stops when it is full**, so it pays for coming back, not for waiting. A full pot beats slowly, shows on the compass, the chart and as a marker, and the HUD counts fish over room.
- Hauling (F again, in reach on foot or from the boat) puts the fish in a separate pot basket that sells at the stall with the rest. An empty pot is taken up by holding F, and set somewhere else.
- The first pot is a gift from Mara for a job (about 43 minutes in); two more can be bought (3 in all), and each rank of the Echo upgrade Lamp Minder adds one (6 at most). Lamp Minder does nothing until the keeper has a pot. Upgrades on her shelf: Brighter wicks (10% faster, 6 levels), Deeper baskets (+1 fish, 4 levels), Sweeter bait (+15% value, 4 levels).
- Tuned by the simulator so pots are 10 to 25% of income for a player who keeps fishing.

**Deckhands (v0.5.0).** Odd crew recruited through quests (a cat named Biscuit, a fog-person called Mister Hollis). Each fishes from the boat while she lies still, into a crew basket that stops them when it is full: see 10.3c.

## 5. Gear
Rarity colours for gear: Common (driftwood grey), Fine (moss green), Rare (lagoon blue), Heirloom (lantern amber), Uncanny (violet).

| Slot | Count | Source | Effect |
|---|---|---|---|
| Rod | 1 equipped | Shops per region, quests | Reach, Power, Control, Luck. Upgradable 0–10 with coins. |
| Bait | 1 stack active | Shops, crates | Consumable. Bite speed and species affinity. |
| Lure | 1 equipped | Chests, quests, shops | Permanent special effect (e.g. +size, attracts Strange, faster bite at night). |
| Wearables | Hat, Coat, Boots, Charm | Chests, quests, relic sets | Stat boosts; 2-piece and 4-piece set bonuses. |

Rods reset on prestige? **No** — see 8.2. Rod *upgrade levels* do reset.

**As built (v0.3.0).** Every number a piece of gear changes goes through one fold, `stats()` in `core/gear.ts`, which the game, the satchel's Gear page and the simulator all read.
- **Rod tuning** 0 to 10 at Mara's: each level adds power, control, a little reach, grace and luck; the price starts at 15% of the rod's price and grows 1.9 times a level.
- **Bait** has a ground: Sandworm for bottom feeders, Brine Shrimp for reef fish, Glowgrub for night fish and rare ones. Breadcrumbs are free and endless.
- **Lures** ride the line above the bait, one at a time, and never wear out: Brass Spinner (bigger fish), Paper Moth (faster bites after dark), Tin Minnow (rarer fish; found, not sold).
- **Creel**: five steps from the aunt's basket (12 slots) to the Keeper's Ice Chest (40), each also raising what fish sell for by 10%. The hold is the creel plus the boat plus a coat's pockets.
- **Wearables**: hat, coat, boots, charm. Four plain ones on the shelf; four of **the keeper's own things** are found (Mara's job, the belfry chest, Pell, Wick's journal page) and count as a set: 2 worn, fish sell for 5% more; 4 worn, rarer fish and two more Rhythm stacks.
- Luck compounds by tier, `(1 + luck)^tier`, so it matters most for the rarest fish.


## 6. Boats and the sea
- The sea is one continuous 3D map: five regions arranged around the center, the Still Eye.
- Boats: **Skiff** (start), **Puffin** sloop, **Tern** cutter, **Heron** trawler, **Moth** (lamp-boat), **The Keeper's Ferry** (story). Stats: Speed, Hull (rough-water rating), Lamp (fog rating), Hold size.
- Regions are gated by **conditions**, not walls: rough water (Hull) and the Murmur Fog (Lamp). Entering without the rating, the boat is pushed back gently while the sea "murmurs" (audio + UI hint naming what's needed).
- **Discovery:** sailing within range of an island or zone marks it on the chart, plays a discovery sting and grants a small reward. Discovered docks are **fast-travel** points (from the chart, any dock to any dock).
- Steering: W/S throttle, A/D rudder, wake and spray, boat bobs on the same wave function the water uses.
- Fish from the boat anywhere, or from docks/shore.

**Where the regions lie (designed 2026-11-15).** One set of coordinates for the whole sea: north is −z, east is +x, Hearthbay's centre is (0, 0). The Still Eye is at (0, −1200) and the five regions stand on a ring of 1,200 m around it, each 700 m across its radius, so neighbours just touch. Mossglass Fen is the next one round to the west, centred on (−1141, −829), north-west of Hearthbay. The Drowned Bell lies on the line between them.
- Only the region the player is in is built. The last 110 m of every region is Murmur Fog, so between two regions there are about 230 m of fog, and the change from one to the other is made in the thick of it, where nothing can be seen.
- **The sea-road.** Without a fog lamp the fog turns a boat back, as before. With one, a double line of old iron lights shows in the fog between two regions, and along that road the murmur lets the boat through. Everywhere else the fog still turns her back: the lamp does not open the sea, it shows the road.
- **The Fog Lamp** is bought with Echoes (satchel, Echoes page: 8 Echoes, once, kept for good). It stands on the skiff's bow and lights itself in the fog.
- The chart has a page for each region the player has reached: "Sail here" goes to a known mooring of the water on the page, "Sail there" to one across the fog.

## 7. Loot
- **Crates** (common, fished up): bait, coins, small materials.
- **Chests** (rarer, fished up in specific zones; quest rewards): gear, Moonpearls, wearables.
- **Relics** (~30 unique): permanent collectibles with a passive bonus and a lore line. Shelved in the lighthouse. Some fished up in specific conditions, some from story quests. Relics are the mystery's breadcrumbs.
- **Moonpearls:** rare currency for gear star-ups and special purchases.

### 7.1 Things fished up (designed 2026-11-23, built as v0.6.0)
**What it is for.** Until now nothing ever came up on the line but fish, there were four relics, and Moonpearls were given and never used. This slice makes the sea keep things: a wait can end in something that is not alive, relics become a hunt with rumours to follow, and pearls get a job.

**A find on the line.** Once the keeper has landed a dozen fish, any cast may come down over something lying on the bottom. It is decided when the float lands, by dice counted in the save, so a find is never a fish dressed up. The dice move on only when the cast is used: a fish is hooked on it, or the thing is brought aboard, or a crate or chest goes with a broken line. A cast reeled straight back in, a bite missed, a find let go of half way up, or a game shut in the middle of a haul throws nothing, and the same thing lies there for the next cast, wherever it lands. So there is nothing to gain by casting and reeling in to hurry the dice along, or by loading the game again.
- **The tell.** No shadow circles and nothing nibbles. At the end of the wait the float is drawn slowly under and stays there. The keeper has about two and a half seconds to strike, and if they miss it the thing is still down there and draws the float under again a few seconds later.
- **How often.** Never for four casts after a find, then 7 in a hundred, one more with every cast that brings nothing, up to 30. That is about one cast in twelve of those that count, a find every seven to nine minutes for the simulator's keeper (who also walks, sails and dawdles; somebody fishing one spot without a pause meets one about every four), and a long dry spell cannot happen. No bait is used.
- **The haul.** It does not run and has no stamina: it is dead weight. Holding the reel brings it in and builds tension faster than a fish of that water would; letting go drops the tension quickly and lets the thing settle back a little, so the haul is pumped, a couple of seconds on and a breath off. Every three to six seconds of reeling it **knocks on the bottom** (a thud, a judder on the line and a gold ring on the water, six tenths of a second ahead). Let go of the reel at the knock and it slides over; reel on and it **catches**: while it is caught, reeling gains nothing and the tension climbs three times as fast, and it comes free when the reel has been let alone for four tenths of a second. Reeling on through a snag breaks the line. The last three metres are clear water, and there it is swung up out of the sea under the rod's tip. Resting costs a little line (it settles back slowly) and nothing else; only breaking loses it, and a relic is not lost even then: it is still down there. A find does not add to Rhythm and does not break it; a snapped line does, as always.
- **Crates** (most finds, any water): coins and a handful of a bait of that water. The coins are reckoned from the fish that cast would otherwise have brought a good hand: once to one and a half times the average fish of that spot with that gear, cast clean and hooked perfectly, at the Rhythm the catch would have had, and never less than the water's own floor. So a crate is never a tax on a good spot, a good rod or a good hand.
- **Sea chests** (about one find in three, and only in a region's chest water: the Teeth; the Standing Trees and the Sump): a Moonpearl, two to three and a half fish's worth of coins, better bait. The first chest fished up in a region also holds a piece of gear that is sold nowhere, and later ones may until the list is done: the Mirror Spoon (a lure that draws Strange fish) in Hearthbay, the Dowser's Bob (a charm: things on the bottom come to the line more often) in the Fen.
- **Relics** come up only in their own water (one of them in either of two) at their own hour, wrapped in oilcloth, and never before the time has come for somebody to speak of them: the rumour first, the relic after. In the right place at the right time a cast has about one chance in four of being the relic, and the chance grows with each cast that is not, so it takes about three casts and never more than eleven. The hunt is knowing where and when.

**Relics (twelve now).** Eight new ones, all fished up: in Hearthbay the keeper's spectacles (Lantern Cove at night), a cork float with two names on it (the Teeth, once the pots are open), next year's tide table (open water, after a Turning), a packet ticket (the home dock at first light, once the Fen is reached); in the Fen a jar of fen light (the Standing Trees at night), a second page of Isolde's logbook (the Sump, after Calloway's job there), a stopped watch (the Listening Post in the small hours, after listening), and the return half of a ticket (Sedge Landing, once Mister Hollis is aboard). Each is one line more of Isolde.

**The Keeper's Shelf** (a page of the satchel, from the first relic or rumour). Every relic of the waters the keeper has reached has a place on it. A found relic shows its gift and its line of lore. An unfound one shows a **rumour**, something somebody on the islands said, which names the water and the hour; a rumour arrives with a story beat and is announced when it does. A place nobody has spoken of yet is empty.

**Moonpearls are set, not spent.** Each relic on the Shelf has two hollows. A pearl set in one adds half the relic's gift again, two double it, and a pearl can be lifted out and set beside another relic at any time, for nothing. So pearls are a small loadout: luck for a legendary hunt, value for a day's selling. They come from story jobs and from fished-up sea chests, and are kept through a Turning with the relics.

**What the simulator holds** (`tests/sim.test.ts`, means over its seeds). A find every 7 to 16 casts; finds bring 3 to 14% of coins over the test's seeds (about a tenth; 5 to 17% over ten); the keeper who meets finds and follows rumours earns more than one for whom nothing ever comes up, by about a fifth on average with the relics' gifts counted, though seed by seed the two differ by more than that either way; hauling is under 5% of the time spent fishing (about 2%); a practised hand breaks no more than one line on a haul in four hours (none, in the runs so far, and a clumsy one none either); the first relic is fished up inside 45 minutes (minute 15 for a keeper who has done Wick's drawing job by the first night, about 40 for one who has not: the spectacles); at least eight relics in four hours and eleven of the twelve in seven; pearls four to seven after seven hours; going after rumours takes under a tenth of the keeper's time; a second tide earns what the first did in about half the time; and the times in 8.3 stand. `tests/finds.test.ts` holds the rules themselves: the reckoning of a crate against six hundred fish really landed in each of three waters, and that reeling in, missing, letting go and reloading throw no dice.

**As it is in the game.** Over a find the float goes down without a splash and the mark above it is slow and pale, with the line "Something heavy… strike!". The haul has its own gauge (tension and line, nothing to tire) and its own words at the knock and the snag. While the thing is deep it is a shadow under the line with silt coming up; in the last metres it is awash and then lifted. Crate and chest are the harbour's models (green ones from the Fen); the eight relics are small models of themselves, held up in two hands with their card. The first drag, haul, crate, relic and pearl each bring one line of explanation, once. Sounds: ten new ones, all recorded or synthesised without credits (CC0 sources, layered: `docs/ASSETS.md`; asked for in `docs/briefs/finds-assets.md`).

**Not in this slice.** A shelf to walk up to in the lighthouse (it has no inside yet), things for pots or crew to find, crates as notice-board pay, anything bought with pearls.

## 8. Progression and prestige

### 8.1 Currencies
- **Coins** — from selling fish. Reset on prestige.
- **Moonpearls** — rare, from chests/quests. Kept on prestige.
- **Echoes** — prestige meta-currency, permanent.

### 8.2 The Drowned Bell (prestige)
Unlocks after the region 1 story beat. Ringing it turns the tide: the islands forget.
- **Reset:** coins, rod upgrade levels, bait, Lantern Pot upgrades, boat upgrades, rotating quests.
- **Kept:** Echoes, owned rods/lures/wearables, boats owned (but boat upgrades reset), relics, journal, story progress, discovered regions and fast travel, deckhands.
- **Echoes earned:** `floor( k × (lifetime coins)^0.5 )` less the Echoes already given, so waiting never loses any. Bonuses for new species and story beats come later.
- **Echo tree** (permanent): value multipliers, faster reel, longer bite window, more pot slots, starting coins, extra Rhythm cap, etc.
- **Narrative:** people greet you as if you are new (with growing déjà vu lines each Turning). Some NPC dialogue and some fish exist only after N Turnings. The player is the only one who remembers — that is the point.

**As built (v0.3.0).**
- The Bell hangs in the Drowned Belfry, a church tower standing in the sea on a shoal north-west of Gull Point. Pell sends the player to find it (hb-09), explains it, then asks them to ring it (hb-10). Nothing about Echoes is shown before Pell has explained the Bell.
- `k = 0.15`, power 0.5, on **lifetime** coins. The first ring, at about 75 minutes and 9,000 coins earned, gives about 14.
- Taking the rope opens a page that says exactly what the tide takes, what stays, and how many Echoes the Bell will give. Ringing sells the catch on hand first, tolls twice, and the keeper wakes on the Hearthbay dock at first light with the skiff on her mooring.
- **Taken:** coins, rod tuning, the creel, bait, pot upgrades (pots in the water come home), boat upgrades, notice board jobs, Rhythm. **Kept:** rods, lures, wearables, boats, pots owned, relics, Moonpearls, journal, chart, story, Echoes and what they bought.
- Ten Echo upgrades in the satchel: Tidewise (fish sell for 15% more, 10 ranks), Quick Hands, Steady Line, Patient Float, Second Sight, Old Habits, Deep Pockets (coins at the start of each tide), Mara's Ledger (cheaper tuning), Lamp Minder (one more pot), Warm Lanterns (faster pots).
- After a Turning each of Mara, Pell and Wick has a line about nearly knowing the keeper, said once per tide.
- The Fog Lamp that opens Mossglass Fen is bought with Echoes (8, once): the first Turning is the gate to region 2.

### 8.3 Target arc (simulator-verified)
| Phase | Hours | Content |
|---|---|---|
| Hearthbay (R1) | 0–1.5 | Tutorial, lighthouse relit, the first relic fished up (about 15 min, or about 40 if Wick's drawing job is not done by the first night), first boat (about 22 min), Lantern Pots (about 43 min), Biscuit aboard (about 60), first Bell (about 77 min) |
| Mossglass Fen (R2) | 1.3–4 | Fog Lamp (about 77 min), the Fen reached (about 85), the wreck of the Puffin found (about 107), Calloway's jobs (done at about 145), the Fenwood Rod (about 160), the Mossglass page (about 200), the Puffin afloat and Mister Hollis aboard (about 212), the Listener (about 250 for a keeper who sits up for it), eleven or twelve of the twelve relics by the end |
| Saltbone Reach (R3) | 4–7 | Rough seas, whale-bone isles, storms |
| The Hush (R4) | 7–10 | Silent pale isles, aurora, the Choir |
| The Sunken Lanterns (R5) | 10–12.5 | Drowned town under glass-clear water |
| The Still Eye (finale) | 12.5–14 | Descent, the ending |
| Postgame: The Other Tide | 14+ | Night-mirror sea, Uncanny variants, deep Bell tiers |

## 9. Quests
- **Story quests:** chained, NPC-given, each beat a mix of "catch X", "bring Y", "go to Z", "find relic". Never more than a few lines of dialogue at a time.
- **Notice board (rotating):** 3 slots; each completes and is replaced; a slot also refreshes after 10 minutes of *play time*. Rewards scale with progress (coins, bait, crates, sometimes a chest).
- **Journal goals:** species collections per region; completing a page grants a relic or a wearable.

## 10. World and story

### 10.1 Setting
**The Murmur** — a warm archipelago where the sea hums at night. Lanterns, tea, salt-cod pies, gulls, cats on every dock. Nobody remembers when the lighthouse last shone.

### 10.2 The mystery (spoilers; revealed slowly)
The Murmur is a dream. Something vast — the islanders' old word for it is **the Sleeper** — lies beneath the Still Eye, and the archipelago and its fish are what it dreams. The lighthouse keepers have always tended the dream: the light keeps the dream warm, and the Drowned Bell, rung at the turn of a tide, lets the dream forget its bad parts. Forgetting is the cost; that is why everyone on the islands is a little forgetful, and why nobody remembers the last keeper clearly.

The last keeper, **Isolde Fenn**, noticed the dream souring (the uncanny fish are the Sleeper's bad thoughts) and went down to it. The player, newly arrived to run the bait shop "for a while", becomes the keeper by inches. Relics are Isolde's belongings and logbook pages; each region's climax shows the player another piece. In the finale, the player sails into the Still Eye where sea and sky mirror, fishes in the dark below, and lands not a monster but Isolde's lantern — and Isolde, who has become part of the dream. The ending: the player relights the lighthouse with it, the second moon sets for good, and the dream turns warm. Isolde chooses to stay below as the dream's keeper; the player becomes keeper above. The postgame opens **the Other Tide**: the Sleeper's dream at night, mirrored, where the Uncanny swim freely.

### 10.3 Characters (questgivers)
- **Mara Thimble** — harbormistress of Hearthbay, runs the tackle shop. Warm, brisk, hides that Isolde was her sister. (R1 hub)
- **Pell** — the ferryman who speaks in tide tables and remembers things that haven't happened. Gives the Bell. (R1/all)
- **Wick** — a kid who draws fish, sometimes fish you haven't caught yet. Journal quests.
- **Dr. Ines Calloway** — visiting naturalist in the Fen, cheerful skeptic, measures everything. (R2)
- **Captain Brannagh Oake** — retired whaler on the bone isles, knows the storms by name. (R3)
- **The Choir** — three sisters in the Hush who speak one sentence between them. (R4)
- **The Lamplighter** — a figure in the sunken town who only appears reflected. (R5)
- **Biscuit** the cat and **Mister Hollis** (fog-person) — deckhands with opinions.

### 10.3b Mossglass Fen (region 2, designed 2026-11-15)
**What it is.** A drowned wood and reed fen in still, shallow water so clear over green moss that it looks like glass. Moss-green haze by day; after dark the hanging moss, the lilies and some of the fish give off a cyan light. In the story it is the Sleeper's ear: everything here listens.
- **Places** (world coordinates): Sedge Landing (−874, −635), where the sea-road comes in: a jetty, Dr. Calloway's stilt hut and field table, Mara's packet box, a notice board. Glasswater (−1141, −789), a wide clear lagoon. The Reed Maze (−961, −1009), sandbars and channels. The Standing Trees (−1371, −889), lantern trees in the water. The Sump (−1301, −579), a hole with no bottom anyone has found. The Listening Post (−1471, −1129), Isolde's, on the far side.
- **Selling there.** Mara's packet box on the landing takes the catch at stall prices and opens her shelf. No new shopkeeper.
- **Fish** (ten): Reedling, Mudlark, Glassfin (common); Sedge Pike, Mossback Tench (uncommon); Glowbelly (rare, night), Stilt Gar (rare); Bottomless Eel (epic, the Sump); Old Mossglass (legendary); the Listener (uncanny, after the Listening Post). Worth five to seven times their Hearthbay rank.
- **Dr. Ines Calloway** measures everything and the numbers will not agree: the fen is bigger each time she paces it. Her jobs: A Sense of Scale, Clear as Glass, The Tape Runs Out, What Glows, The Sump, The Listening Post. The last gives a page of Isolde's logbook (the first the keeper finds).
- **Later in this region:** deckhands (Biscuit, Mister Hollis) and the second boat: see 10.3c.

**As built (v0.4.0, 2026-11-16).** Everything above is in the game. Numbers: common fish 30 to 44 coins, uncommon 135 and 155, the rares 360 and 400, the Bottomless Eel 950, Old Mossglass 3,000, the Listener 6,000 (hours 0 to 4, at the Post, only after the keeper has listened at the trumpet). The Fenwood Rod is 14,000, Marsh Worm 14, Glass Mayfly 22, the Glass Bead lure 5,000; all four join Mara's shelf everywhere once the Fen has been reached. Calloway's jobs pay 500, 900, her spare field hat, 2,500, 6,000, and 3,000 with the logbook page; the three chests 400, 500 and 800; the six chart places 200 to 800. With the same rod the Fen's best water pays a few times Hearthbay's best (a test holds it above 1.6 times). The notice board asks only for fish of the water the keeper is in. Filling the journal's Mossglass page (nine fish, the Listener not asked for) earns Calloway's tape measure. The water of the sea-road itself is the open water of whichever region the boat is in: only its common and uncommon fish bite there. Calloway's first job waits until Pell's road job has been taken, and the goal line prefers work that can be done in the water the keeper is in. Crossing does not deal a new notice board: the jobs nobody has taken are read again for the new water (same number of jobs, same timer). The journal says where and when each fish not yet caught bites, from the fish's own zone and hours; a fish that waits on a flag gives only its riddle until then. Not yet in: the Fen's own music, any voice for Calloway's lines.

### 10.3c Hands aboard: Biscuit, the Puffin and Mister Hollis (designed 2026-11-16, for v0.5.0)
**What it is for.** After the Mossglass page (about 165 minutes) the game ran out of things to want. This slice puts three wants in a row, each of which changes how the boat feels: somebody aboard, a bigger boat, and somebody stranger aboard.

**Deckhands.** A deckhand lives on the boat. While the boat lies still they fish the water under her on the game's own clock (never while the game is closed), whether the keeper is aboard, ashore or fishing beside them. Like a Lantern Pot they catch only fish already in the journal that live in that water, with no Strange traits, no Rhythm and no credit in the journal, and their catch goes into a **crew basket** that belongs to the boat and sells at the stall with the rest. The basket stops them when it is full (their clocks stop too), so a crew pays for coming back, not for waiting. Each boat has berths: the skiff one (a perch for a cat), the Puffin two (the perch and a side bench). Each hand has a berth of their own and is aboard when the boat has it; a hand without one waits at the boatyard.
- **Biscuit** (the dock cat). Hooks common and uncommon fish out with a paw, one about every 30 s, small ones mostly, worth half a hand-caught one, and **eats every fourth**. While the keeper fishes from the boat with her aboard she watches the water: her tail goes just before a bite, and the bite can be struck for 15% longer. She is won from Wick (*Whose Cat*: bring her one each of three fish of the home dock, Butterperch, Pebble Goby and Coral Snapper), once the pots are open. From then on she is on the boat, not the dock.
- **Mister Hollis** (a gentleman made of fog). Tall, narrow, in an oilskin and sou'wester with mittens and a carpet bag; where a face would be there is fog and two small warm lights. Very correct, forty years out of date, waiting on the old sea-road for a packet that stopped running. He fishes with a hand line **only after dark or in fog** (fog of 0.3 or more): one fish about every 45 s, up to epic, worth 70%, and he eats nothing. He has no luck of his own and **borrows the keeper's**: with a lucky rod in her hand, rare fish come to his line as they do to hers. By day in clear air he is thin, an outline, and does nothing. Calloway sends the keeper to him (*A Gentleman on the Road*, after What Glows): he stands on the water by the eighth light out from the Fen end, where the road's fog is thick at any hour, and is hailed from the boat. He will come only when the boat has a berth for him, which means the Puffin.
- Deckhands and their tallies are kept through a Turning; what is in the basket is not.

**The Puffin.** A sloop that went into the reeds the autumn the fog came down, and has lain on a bar in the Reed Maze since, with her mast down and a moorhen's nest in the cockpit. Calloway has her on a survey sheet and sends the keeper to look (*A Boat in the Reeds*, straight after the tape job; the wreck is looked over from the skiff, since the bar will not carry a person), and the news goes to Pell, who opens his boatyard: for **40,000 coins** he refits her (*Fitted Out*). She is faster than the skiff (9.5 against 7), slower to turn, carries 14 fish in her hold, has two berths and a crew basket of 20 (the skiff's is 8), and draws more water (0.6 m against 0.4), so some reed channels and bars the skiff slips over are shut to her; at a mooring too thin for her she lies at the nearest water that floats her. Boats are kept through a Turning. Pell keeps whichever boat is not in the water, and swaps them when asked at the home dock.

**Numbers the simulator holds** (ten seeds, a practised hand, `tests/sim.test.ts`). Biscuit aboard at about 50 minutes; the Puffin found at about 106 and afloat at about 220 (170 to 290, later for a keeper who rings the Bell often); Hollis aboard within a quarter of an hour of her. The crew bring **3 to 6% of all coins** for a keeper who keeps fishing (held between 2 and 10%), and crew and pots together stay under 35%. The first design asked 8 to 15% for the crew; by the time there is a crew, a hand-caught fish with Rhythm, a trait or a legendary's price behind it is worth so much that a share like that would have needed hands who fish better than the keeper. Hand-fishing stays the best coins a minute at every stage. The cat's job costs about five minutes on the way to the first Bell (now about 80 minutes), and saving for the Puffin puts the Fenwood Rod about a quarter of an hour later.

**Not in this slice.** Boat upgrades, a boatwright of her own, crew upgrades, more crew.

### 10.3d Saltbone Reach (region 3, designed 2026-11-23, for v0.7.0)
**What it is.** Deep grey water with a long swell on it, slate stacks, shingle, and the ribs of something standing out of the sea in a double row a furlong long, cream-white and taller than a mast. No trees: sea-thrift and lichen. Storm slate and bone cream, with gold light coming down through the cloud in shafts. In the story it is the Sleeper's breath: the swell here comes in for nine and goes out for nine and never hurries, and somebody has cut the count into a stone.

**Where.** The next region round to the east, centred on (1141, −829). **The whale-road** leaves Hearthbay north-east of Gull Point and is lit like the old sea-road, but the swell on it is more than a skiff will take: it opens only to a boat with the Fog Lamp and a hull of 2, which is the Puffin. The skiff is turned back with a line that says so, and the chart will not send her there either. So the Puffin is the gate, at about three and a half hours.

**Places** (world coordinates). Tryworks Landing (874, −635), where the road comes in: a stone quay, Captain Oake's house under an upturned whaleboat, the cold try-pots, Mara's packet box, a notice board. The Ribs (1131, −859), nine pairs of them over a channel a boat can sail up. The Jaw (1211, −1059), a skull the size of a chapel with a cove in its mouth. The Anvil (1441, −869), a flat-topped stack the lightning never misses. The Kettles (1311, −579), three round holes in a shingle bank where the swell booms. The Long Swell (891, −1059), the deep open water of the north-west. The Tally Stone (1471, −1159), Isolde's, on the far side: a slab cut with strokes in fives, thousands of them.

**Storms keep hours** (the region's own rule). The Reach has three storms and they come at the same hours every day, which is why Captain Oake can know them by name: **Old Margit** (half past five to half past seven in the morning: wind and rain, no lightning), **the Deacon** (two in the afternoon to half past six: the long one, with lightning, and an **eye** from half past three to five in which the sea lies down and the light comes through gold) and **Little Wren** (half past ten at night to one: dry lightning, hardly any rain). A day is 24 minutes of play, so there is a storm for about a third of it. The weather is worked out from the hour and nothing else: nothing new is saved, and loading a game cannot change it.
- In a storm the swell stands up, the light goes slate, rain comes across and the boat works harder. Some fish bite **only in a storm** (the Squall Mackerel), one only where there is lightning (the Thunderback), one only in the eye (the Lull). Fish hooked in a storm fight a little harder.
- **Struck water.** While there is lightning, a bolt comes down into the sea somewhere within a cast or two of the keeper every ten to eighteen seconds, and leaves the water lit for about half a minute: a ring of pale fire that fades. A cast that lands in it gets a bite in a few seconds, and what comes up is much more likely to be rare (the dice are thrown as if the keeper's luck were more than doubled). The first fish hooked there puts the ring out. This is for the hand only: pots and crew get nothing from it. It is the reason to be out in the Deacon and not tied up waiting for him to pass.
- **What stops in a storm.** While a storm blows (not in its eye) the Lantern Pots take nothing and the hands go below: their berths stand empty and the Crew page says why. Both start again in the eye or when it has passed. The keeper's own line is never stopped; that is the point of the place.
- **The storm cone.** A cone goes up the mast on the quay when a storm is on or due within the hour, and comes down when it has passed, as on any harbour wall.
- After Oake's first job the keeper has **her almanac**: the HUD names the storm that is on and says how long until the next (or until the eye), and the chart has a page for the Reach that lists the three, with their hours and a line on each.

**Fish** (ten). Bonefin Herring, Slate Pout, Thrift Wrasse (common); Kettle Cod (uncommon, the Kettles); Ribfish (rare, under the Ribs and in the Jaw), Squall Mackerel (rare, any storm), Lantern Ling (rare, the Jaw by night); Thunderback (epic, the Anvil while there is lightning); Old Greyback (legendary, the Long Swell); the Lull (uncanny: by the Tally Stone, in the eye of the Deacon, once the keeper has counted with the swell). Worth four to five times their Fen rank: the commons 120, 140 and 160, Kettle Cod 900, Ribfish 1,500 (rare: it lives in the shadow of the bones), Squall Mackerel 1,700, Lantern Ling 1,900, Thunderback 4,600, Old Greyback 14,000 (only between eleven and one, by day), the Lull 30,000.

**Captain Brannagh Oake.** A whaler who has not put a boat in the water for forty years and has not moved off the quay either. Broad, slow, weather-coloured, a pilot coat and a pipe she does not light. She gave it up the day she saw the ribs were older than the whales. She talks about the storms as neighbours ("Margit'll be gone by breakfast; she never stays"). Her jobs: Storms Keep Hours (eight fish of the Reach; 3,000 coins and the almanac), Through the Ribs (read the mark on the ninth rib from the boat, bring a Ribfish), Margit's Leavings (a Squall Mackerel in a storm; her sea boots), Where the Lightning Goes In (five fish from struck water; a Moonpearl), The Anvil (a Thunderback while there is lightning), The Count (count with the swell at the Tally Stone after dark; the third page of Isolde's logbook). Pell sends the keeper over (The Whale-Road, once the Puffin is afloat).

**Gear.** The Whalebone Rod (120,000, Mara's shelf once the Reach is reached), two baits (Lugworm for the bottom, Sand Eel for the fish that run), a lure that works in a storm (the Petrel Feather, 30,000: quicker bites and a little more luck, in a storm only), Oake's sea boots, a pilot coat for filling the journal's Saltbone page, and in the first sea chest fished up there St. Elmo's Bead, a charm: the lightning comes down nearer and oftener for whoever wears it.

**Things fished up there.** A salt crate, sea chests over the Anvil and the Kettles, and four relics with rumours: a scrimshaw tooth (the Jaw by night), a harpoon head with a ribbon tied on it (the Ribs), a storm glass (the Anvil, in a storm) and the nameboard of a boat nobody has built yet (the Long Swell at first light).

**Not in this slice.** The Reach's own music and any voice for Oake (credits), a third boat, boat upgrades, the swell tugging at a hooked fish's line (tried on paper; it wants a way to be seen before it is felt).

### 10.4 Writing rules
- Short lines. Never more than three dialogue boxes before control returns.
- Warm voice first; the weird line arrives last and is never explained on the spot.
- The player character is silent; choices are rare and small.
- **Every NPC line is voiced** (Higgsfield TTS, one fixed voice per character). Each line has an id in the dialogue data; audio files are named by that id. Subtitles always show; a voice volume slider sits beside music and SFX.

### 10.5 Audio plan
- **Voice:** Higgsfield-generated per line (see above). Short barks for shop greetings and catch reactions too.
- **Music:** one calm theme per region plus a night variant and a fight layer that fades in during a fight (generated, then trimmed into loops).
- **SFX:** ForgeGUI sound-effect generation for one-shots (splash, bite, coin, chest, bell), procedural WebAudio for continuous sounds (reel ratchet pitch tied to reel speed, line hum tied to tension, wind, waves).
- **Ambience:** per-region beds (gulls and lapping water, fen frogs and insects, storm wind, the Hush's near-silence).

## 11. Onboarding
- First 5 minutes: Mara walks you through cast → hook → fight on the Hearthbay dock with one fish species and big, generous windows; no menus.
- Systems unlock one at a time with an in-world prompt: sell (min 2), shop (min 4), bait (min 8), notice board (min 12), skiff (min 20), pots (min 45), the Bell (~90).
- The **Next Goal** tracker (top-left) always shows one clear objective, chosen from the story quest, then the cheapest meaningful upgrade.

## 12. PC features
Settings: resolution scale, window mode (windowed / borderless / fullscreen), graphics preset (Low / Medium / High / Ultra) with individual toggles (shadows, water quality, post effects, view distance), V-sync/frame cap, master/music/SFX/ambience volumes, key rebinding, UI scale, mouse sensitivity, invert, reduced camera shake. Controller: planned for beta (decision deferred, see DECISIONS).

## 13. Cut list / parking lot
- Multiplayer, leaderboards: out (solo only).
- Cooking, aquarium decoration: parked; revisit after alpha.
