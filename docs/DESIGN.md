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
- **Lantern Pots:** placeable traps at discovered zones. Each pot rolls a catch from the zone's table every N seconds at reduced rarity and value (×0.25 baseline). Upgrades: speed, capacity, quality. Slots per region.
- **Deckhands:** odd crew recruited through quests (a cat named Biscuit, a fog-person called Mister Hollis, etc.). Each fishes passively from the boat or dock, with a specialty (a species family or a rarity nudge).
- Automation catches go to a separate **Pot Hold** that the player collects and sells. Automation is roughly 15–30% of active earn rate at matched progress, tuned by the simulator.

## 5. Gear
Rarity colours for gear: Common (driftwood grey), Fine (moss green), Rare (lagoon blue), Heirloom (lantern amber), Uncanny (violet).

| Slot | Count | Source | Effect |
|---|---|---|---|
| Rod | 1 equipped | Shops per region, quests | Reach, Power, Control, Luck. Upgradable 0–10 with coins. |
| Bait | 1 stack active | Shops, crates | Consumable. Bite speed and species affinity. |
| Lure | 1 equipped | Chests, quests, shops | Permanent special effect (e.g. +size, attracts Strange, faster bite at night). |
| Wearables | Hat, Coat, Boots, Charm | Chests, quests, relic sets | Stat boosts; 2-piece and 4-piece set bonuses. |

Rods reset on prestige? **No** — see 8.2. Rod *upgrade levels* do reset.

## 6. Boats and the sea
- The sea is one continuous 3D map: five regions arranged around the center, the Still Eye.
- Boats: **Skiff** (start), **Puffin** sloop, **Tern** cutter, **Heron** trawler, **Moth** (lamp-boat), **The Keeper's Ferry** (story). Stats: Speed, Hull (rough-water rating), Lamp (fog rating), Hold size.
- Regions are gated by **conditions**, not walls: rough water (Hull) and the Murmur Fog (Lamp). Entering without the rating, the boat is pushed back gently while the sea "murmurs" (audio + UI hint naming what's needed).
- **Discovery:** sailing within range of an island or zone marks it on the chart, plays a discovery sting and grants a small reward. Discovered docks are **fast-travel** points (from the chart, any dock to any dock).
- Steering: W/S throttle, A/D rudder, wake and spray, boat bobs on the same wave function the water uses.
- Fish from the boat anywhere, or from docks/shore.

## 7. Loot
- **Crates** (common, fished up): bait, coins, small materials.
- **Chests** (rarer, fished up in specific zones; quest rewards): gear, Moonpearls, wearables.
- **Relics** (~30 unique): permanent collectibles with a passive bonus and a lore line. Shelved in the lighthouse. Some fished up in specific conditions, some from story quests. Relics are the mystery's breadcrumbs.
- **Moonpearls:** rare currency for gear star-ups and special purchases.

## 8. Progression and prestige

### 8.1 Currencies
- **Coins** — from selling fish. Reset on prestige.
- **Moonpearls** — rare, from chests/quests. Kept on prestige.
- **Echoes** — prestige meta-currency, permanent.

### 8.2 The Drowned Bell (prestige)
Unlocks after the region 1 story beat (~1.5 h). Ringing it turns the tide: the islands forget.
- **Reset:** coins, rod upgrade levels, bait, Lantern Pot upgrades, boat upgrades, rotating quests.
- **Kept:** Echoes, owned rods/lures/wearables, boats owned (but boat upgrades reset), relics, journal, story progress, discovered regions and fast travel, deckhands.
- **Echoes earned:** `floor( k × (lifetime coins this run)^0.5 )` plus bonuses for new species and story beats. The formula is tuned in the simulator.
- **Echo tree** (permanent): value multipliers, faster reel, longer bite window, more pot slots, starting coins, auto-sell, extra Rhythm cap, etc.
- **Narrative:** people greet you as if you are new (with growing déjà vu lines each Turning). Some NPC dialogue and some fish exist only after N Turnings. The player is the only one who remembers — that is the point.

### 8.3 Target arc (simulator-verified)
| Phase | Hours | Content |
|---|---|---|
| Hearthbay (R1) | 0–1.5 | Tutorial, lighthouse relit, first boat, first Bell |
| Mossglass Fen (R2) | 1.5–4 | Fog lamp, Dr. Calloway, deckhands |
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

### 10.4 Writing rules
- Short lines. Never more than three dialogue boxes before control returns.
- Warm voice first; the weird line arrives last and is never explained on the spot.
- The player character is silent; choices are rare and small.

## 11. Onboarding
- First 5 minutes: Mara walks you through cast → hook → fight on the Hearthbay dock with one fish species and big, generous windows; no menus.
- Systems unlock one at a time with an in-world prompt: sell (min 2), shop (min 4), bait (min 8), notice board (min 12), skiff (min 20), pots (min 45), the Bell (~90).
- The **Next Goal** tracker (top-left) always shows one clear objective, chosen from the story quest, then the cheapest meaningful upgrade.

## 12. PC features
Settings: resolution scale, window mode (windowed / borderless / fullscreen), graphics preset (Low / Medium / High / Ultra) with individual toggles (shadows, water quality, post effects, view distance), V-sync/frame cap, master/music/SFX/ambience volumes, key rebinding, UI scale, mouse sensitivity, invert, reduced camera shake. Controller: planned for beta (decision deferred, see DECISIONS).

## 13. Cut list / parking lot
- Multiplayer, leaderboards: out (solo only).
- Cooking, aquarium decoration: parked; revisit after alpha.
