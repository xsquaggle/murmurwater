# Decision log

Newest first. Each entry: date, decision, why.

## 2026-11-23 — Weather keeps hours
The Reach's storms blow at the same hours of every day, so the weather is a function of the region and the hour and of nothing else. Why: it adds nothing to the save (the save stays at version 6, and nothing about loading, waiting or shutting the game can change the weather or be used to re-roll it); it can be learned, which makes the almanac a reward worth a job and the storm a plan and not an accident; the simulator and the game cannot disagree about it; and it suits a place whose whole character is that things there are counted. A day is 24 minutes, so the Deacon is four and a half minutes of play with a minute and a half of eye in the middle. Rejected: random storms with a forecast (a save version, a seed to protect from reloading, and a keeper who arrives in fair weather and never meets one).

## 2026-11-23 — A storm stops the automation and pays the hand
In a storm the Lantern Pots take nothing and the hands go below; the keeper's own line is never stopped, and while there is lightning the sea within a cast or two of her is struck every ten to eighteen seconds. Struck water bites in a third of the time and throws its dice with a great deal of luck, and the first fish hooked puts it out. Why: the brief's fixed point is that active skill is the best way to play and automation only helps. The Reach makes that a place: for nine hours of its day the only thing that earns is a person aiming a cast at a ring that will be gone in half a minute. The ring is seven metres in radius and comes down 13 to 34 m off, so it asks for a judged cast and sometimes for a few lengths under sail, never for luck. Nobody has tried it by hand yet: the numbers are the first thing to ask Lawson about.

## 2026-11-23 — The whale-road asks for a hull
The road to the Reach has a swell the skiff cannot take: she is stood on her end, turned back at the same place the fog turns a boat without a lamp, and told why; the chart refuses her with the reason. The Puffin takes it. Why: v0.5.0 made the second boat a comfort (speed, a berth) and nothing needed her. Now she is the way to the third water, the same way the Fog Lamp was the way to the second, and the rule is one number on the road and one on the boat, so a later boat and a later road cost nothing.

## 2026-11-23 — The Reach is slate, and bone has a light of its own by night
The first pictures of the Reach by day were a sunny blue sea with bones in it, which is Hearthbay with props. Its fair days are now a pale overcast over slate water, its storms darker slate with rain across, and the eye of the Deacon gold: the one warm light in the region, and only for a minute and a half a day. By night it was near black, because there is no lamp out on the water there and no tree to glow; the moon is turned up and anything marked bone (the Ribs, the Jaw, the vertebrae) is given a faint cold light so the landmarks a keeper steers by can be seen. Why not lamps: the Reach is the place nobody keeps any more.

## 2026-11-23 — Struck water is drawn by the water and by sprites, not by a model
The asset thread built a ring of fire as a model. It is not used: the swell in a storm stands up more than the flames are tall, and a flat ring lies half under one wave and in the air over the next. The water's own shader draws twelve bright places on a circle, and twelve flames stand over them as sprites that each ride their own bit of sea. It is blue, with white only at its hottest, because the first version was white and from the deck could not be told from foam.

## 2026-11-23 — What the fresh review of v0.6.0 changed
A reviewer who had not seen the slice read the branch against the release notes. No crash, stranding, lost relic, duplication or damaged save; the migration and the haul on every rod held. What it did find changed the rules in four places, and the entries below are amended by this one.
- **A cast is counted when it is used.** The dice were thrown at every splash, and every splash counted as a dry cast. Reeling straight back in costs no bait and breaks no Rhythm, and a find gives itself away at once (no shadow comes to the float), so a keeper could cast, look, reel in and keep only finds: the reviewer's script made 43 finds and 13 pearls in half an hour at the Teeth against 2 pearls by fishing. Now the place is only looked at as the float lands (`peekFind`), and the count moves (`countCast`) when a fish is hooked on that cast, or the find is aboard, or a crate or chest goes with a broken line. A cast reeled in, a missed bite, a find let go of, and a game shut mid-haul throw nothing: the same thing lies there for the next cast. That also ends the loss of a crate to a crash in the middle of a haul. A relic is not lost with a broken line either: it is still there.
- **No water moves another's dice.** A relic's throw was made only where a relic lay, so the same cast at the dock and in the cove read different numbers for the crate, and loading and casting elsewhere was a re-roll (183 of 1,200 saves). Three throws are now always made in the same order: relic, box, chest.
- **A crate is worth a good hand's fish.** The floor was the average fish of the spot, which left out the luck of a clean cast, the perfect hook's tenth, the Strange fish both bring, and the Rhythm the catch itself would have added: for a practised hand a third of crates at the Teeth were worth less than the fish. It is reckoned now for the best a hand can make of the cast (`fishWorth`), and `tests/finds.test.ts` holds it to within a few per cent of six hundred fish really landed in each of three waters. Finds come to about 11% of all coins for it, where they were just under 10%.
- **The rumour first, the relic after.** Two relics had no story gate of their own and could be fished up by a new keeper before anybody had spoken of them. No relic comes to a line now until its rumour is due (`relicsHere` asks `hint.after`), whatever its own gate says.
- **Nothing is told behind the title card.** The world runs behind the title, and rumours due at load (every one of them, for a save from v0.5.0 or a tester's start) were told there, unseen and unheard, and marked as told. They wait for the click now (`Game.behindTitle`), and the finds bot starts the game with its title up to see it.
- **Tests that could not fail.** One compared a save's stats with themselves; one called a crate "never a wasted cast" by comparing two numbers in the data with two in the test; one named a given relic by hand; "earns no less than one who never does" passed at 15% less; "whoever is best is never behind" passed if nobody rang the Bell at all. Each now tests what it says. One was restated on purpose: "a second tide is quicker than the first" held every keeper's second ringing inside four fifths of the time to their first, and failed when a first tide got eleven minutes shorter while the second (a keeper who crosses to the Fen and saves for the Fenwood Rod before she rings) stayed as long as it had been. It now holds what it means: the second tide has earned everything the first did in under six tenths of the time (about half), is rung sooner than the first by every keeper, and by the usual keeper in under four fifths.
- **Words.** A find's card shows coins as every other card does. A find that is not struck "settles again"; it has no hook to slide off. One pearl beside the tide table read "1.5 more Rhythm stacks": the gift is now said as what it pays ("Rhythm builds 7.5% higher"). The release notes lost six loose or false claims (see the notes).
Left as they are, and written down in HANDOFF: the debug hook and `forcedFind` can be reached from the developer tools in the shipped app, as the rest of the hook always could; the Dowser's Bob brings finds about an eighth more often, not three tenths, because the wait after a find and the ceiling do not move; E still acts on whatever is in reach while a catch is held up and its prompt is hidden.

## 2026-11-23 — Finds are something on the line, decided as the float lands
Chests used to be things to sail to (three in the Fen, two in Hearthbay) and relics things handed over. v0.6.0 puts both in the water, where the game is played: now and then a cast comes down over a crate, a sea chest or a relic. What it comes down over is settled as the float lands, by dice counted in the save (`finds.casts`), and the count moves only when the cast is used, so the same cast of the same save meets the same thing and neither reloading nor casting again is a re-roll. There are none until a dozen fish have been landed (the first hour teaches fishing and nothing else), none for four casts after one, and never a long drought: the chance climbs a point a cast to three in ten. Why on the line and not a new kind of place: every reward in the game so far is reached by fishing or by sailing, and sailing already has its chests; the line had only fish on it.

## 2026-11-23 — A find is never a tax
A cast that meets a find is a cast that met no fish, so a find must be worth more than the fish it stood in for, on any rod, in any water, at any hour of the game. A crate's coins are therefore the larger of its own roll and one to one and a half times what a fish of that cast would fetch a good hand on that tackle (a chest, two to three and a half times), it spends no bait, and it neither adds to Rhythm nor breaks it unless the line snaps. The simulator plays every seed twice, with finds and without (`noFinds`), and `tests/sim.test.ts` holds that the keeper who meets them earns more on average (about a fifth, the relics' gifts included; seed by seed the two differ by more than that either way); finds come to about a tenth of all coins (5 to 17% by run over four hours), which is a bonus and not a second income.

## 2026-11-23 — The haul is not another fight
A box does not run. Giving it a stamina bar would have been the fish fight with a different picture, so it is the opposite skill: the fight asks for the reel to be held against a run, the haul asks for it to be let go. It is a dead weight wound up a little at a time; it knocks on the bottom 0.6 s before it catches, and the answer is to stop reeling. Reeling on catches it fast (tension climbs three times as quickly and nothing comes in) until the reel is left alone for 0.4 s. Resting loses nothing, the last three metres have no snag, and the thing is swung up clear of the water at the end so it can be seen. The first knock and the first snag each say once what to do. A line broken on a haul loses a crate or a chest for good; a relic is still down there, with every cast that missed it still counted toward the next. In the simulator hauling is about 2% of fishing time and an ordinary hand does not break a line on it.

## 2026-11-23 — Relics are heard of, then fished for
Eight new relics lie in a water, at an hour, after a point in the story (`relics.json where`). Somebody says so first: a rumour is told once when its time comes (a toast, and a place on the Shelf that reads "Still in the water" with the words). In its water at its hour a relic takes about three casts and never more than eleven (22 in a hundred, 8 more for every miss, remembered in the save), so following a rumour always pays within a few minutes, and it does not come up anywhere else, or twice, or before its rumour is due. An old save is told at once what its keeper has already earned the right to hear. The four older relics stay gifts and have a rumour that says who gives them.

## 2026-11-23 — Moonpearls are set, not spent
Pearls had nothing to buy. They are now set in hollows beside a relic on the Keeper's Shelf (two each, half the relic's gift again for each) and can be lifted and set elsewhere for nothing, at any time. Why not spend them: there are few (four to seven in seven hours for the simulator's keeper), a spent pearl on a relic that turns out dull would be a regret, and choosing which gifts to double, and changing it for the water or the job in hand, is a decision the game did not have. All pearls a keeper already had are free to set after the migration. Sea chests fished up are the main source from here on (one each).

## 2026-11-23 — The find models are built in code, and the sounds have stand-ins
The crate and chest reuse the library's models (tinted mossy in the Fen: the wood's colour pulled most of the way to moss with a little emission, because multiplying a painted texture only darkens it). The oilcloth bundle and the eight relics as held up are small shapes built in `find-models.ts`, since no credits may be spent and each is a few dozen faces seen for four seconds. Ten sounds are asked of the asset thread the credit-free way (`docs/briefs/finds-assets.md`); each had a stand-in made from sounds already in the bank or synthesised, and was in `PENDING` until its first file was in the build, so nothing reported it missing. All ten landed before the release (18 files: CC0 recordings layered, the relic's note synthesised; `docs/ASSETS.md`), so v0.6.0 ships with none of the stand-ins in use.

## 2026-11-23 — A third tester's start, and bots may force a find
F8 now steps through three starts, newest first: things fished up (nightfall on the end of the home dock, a good cast from the first relic), hands aboard, Mossglass Fen. Bots and scratch scripts set `game.forcedFind` to an offer (or to `null` for a fish) to choose what the next cast meets; a forced cast does not touch the save's dice or its count. The finds bot fishes one relic unforced, so the dice themselves are played through the real game, and starts the game once with its title card up.

## 2026-11-22 — What the fresh review of v0.5.0 changed
A reviewer who had not seen the slice read the branch against the release notes. Nothing serious, and nothing that earns while the game is closed; ten smaller things, of which these changed the game:
- **A berth of one's own.** Berths were handed out by a hand's place in the list, so with no cat Mister Hollis was given the cat's perch (the cuddy roof in the Puffin, a half-thwart in the skiff, hanging in the air above either). Each hand now names their berth in `crew.json` (`berth`: the cat 0, Mister Hollis 1) and is aboard only in a boat that has it. The skiff has the perch alone, so he needs the Puffin with or without a cat, which is what Calloway says of him and what the release notes had claimed. The earlier entry below is amended by this one.
- **Signed on is not on the road.** With no berth in the skiff he was shown on the sea-road again and could be hailed, while the Crew page said he was ashore. Somebody who has signed on is aboard or at the boatyard, never where they used to wait.
- **Figures are freed.** Every boat swap and every hire dropped the crew's figures without freeing what they had made (materials, the line, bone textures, a fish in a mitten), and a swap built them twice. They are freed with the hull, and who is seen aboard goes by the hull in the water, so they are built once.
- **Half a wait, not a whole one.** A clock that came due over water the journal knows nothing of threw the whole interval away (it happened for a quarter of a second after every crossing, because the zone under the keel was a moment stale). It now tries again in half the time, and the zone is looked up at once in a new water.
- **Saves.** A v4 save whose boat in the water was not marked as owned now keeps the boat instead of leaving the keeper in the sea beside it. An unreadable main save was saved over once the backup had loaded: it is kept aside first. The old-save tests gained a save made in Mossglass Fen by v0.4.0's own simulator.
- **The window not in front.** Leaving the window frees the mouse, which opens the pause screen, except in a conversation, where the mouse is free already: the world went on behind it, pots and crew included, until the basket was full. It now stands still.
- **The test that could not fail.** "Nothing is earned while the game is closed" loaded a save a week later and compared, but the load reads no clock. It now also holds the frame-time cap (`core/clock.ts`) and reads the source of `src/core` and `src/game` for anything that looks at a wall clock or at the hour a save was made.
- **The notes.** Six claims were loose or wrong (who needs the Puffin, where a hand without a berth is, the crew's share, the Fen start's age, "anywhere after dark" a few minutes after a refit that ends at half past seven in the morning, when Pell's yard opens) and were corrected before release.
Left as they are, and written down in HANDOFF: the figures and a few sounds are still chosen by a hand's id in code, and the crew keep fishing through a cutscene or a fade (as the pots do).

## 2026-11-22 — Mister Hollis thins by dither, not by fading
By daylight there is not enough of him to hold a line, and he was first drawn faded to an eighth. Two things were wrong with that, both from how the boat is drawn. The well of a boat is kept dry by a lid that writes depth and no colour, drawn before the sea; a blended figure is drawn after it, so everything of him below the gunwale was cut off, and what was left was drawn before the sea and painted over by it. He is now thinned in the solid pass: a 4 by 4 ordered dither removes what faces the eye and keeps his edges, in the colour of fog, so he sits whole in the well as an outline and comes back from the edges inward at dusk. Why not move the lid or split him at it: either works only for one boat and one seat. Only the fog of his face is still blended, and it is drawn after the sea.

## 2026-11-22 — Two tester's starts, newest first
F8 on the title screen now steps through a start for each slice that has one (hands aboard, then Mossglass Fen) and then back to the player's own game, and the title says which one is up. The older start is kept because it is the only quick way to the first crossing of the fog, which a later save has already made.

## 2026-11-22 — Deckhands earn a twenty-fifth, not a tenth
The first design asked the crew for 8 to 15% of all coins. The simulator showed that by the time there is a crew, a fish caught by hand with Rhythm, a trait or a legendary's price behind it is worth so much that a share like that needs hands who fish better than the keeper. The crew are held to between 2 and 10% (3 to 4% in practice), and crew and pots together under 35%, so fishing by hand stays the best coins a minute at every stage, which is a fixed point of the brief. What makes them worth having is the basket: it fills while the keeper does something else nearby and pays for coming back to sell it, and it stops when full, so leaving the game open all night earns twenty fish and no more.

## 2026-11-22 — Who is aboard is worked out, and the basket is the keeper's
A save holds who is hired and one basket. Who sits in a berth is worked out when asked, and nothing records a seat: each hired hand is aboard when the boat has the berth that is theirs (at first this was the hired hands in a fixed order cut to the boat's berths; see the review entry above). Swapping boats therefore cannot lose a hand or a fish: the basket comes too, and if it holds more than the smaller boat's size the hands simply wait until it is sold. Mister Hollis will not sit where a cat has sat, which is the story's way of saying the skiff's one berth is the cat's perch.

## 2026-11-22 — The wreck is read from the boat
The Puffin lies on a bar that will not carry a person, in reeds. Look-at places can now be read from the helm (`fromBoat`) once the boat has all but stopped, and can stand only until a flag is set (`until`: she is gone from the bar when she is afloat). The reeds are kept back from her so she can be seen, and the bar was left with one pocket of open water beside her so the skiff can get alongside.

## 2026-11-16 — A tester's start, played by the simulator
The Fen is 75 minutes into the game, and each slice from here lies further in. Nobody can be asked to play an hour to look at five new minutes, so the title screen has a way in: F8 loads a save at the start of the newest slice. The save is not written by hand. The simulator's keeper plays to that point by the real rules and her state is written out (`npm run tester-save`), so it is a save the game could really have made: her journal, her gear, her Echoes spent the way the model spends them, no coins after the Turning. A test makes it again and compares, so it cannot fall behind the rules. In a tester's start the save store keeps nothing, which is the whole of the safety: the player's own save is never read or written. Why F8 and not a button: it is for whoever is checking the build, and a player should not find a door past the first hour by accident.

## 2026-11-16 — What the fresh review of v0.4.0 changed
A reviewer who had seen none of the work read the slice before release and found twelve things; all were fixed before the tag. The decisions among them:
- **Water outside every zone is the region's open water.** `zoneAt` used to answer null there, and the fishing and pot tables read null as "every zone": past the last zone, on the sea-road, every Fen fish bit, the Sump's eel and Old Mossglass among them. Null is gone: `zoneAt` falls back to `openZone(region)`, and a test fishes the whole road and finds only common and uncommon fish. Chosen over drawing a zone round the road because the mistake could be made again by any region with a gap.
- **The goal line prefers the water the keeper is in, and Calloway waits on Pell's road job.** With hb-11 not handed in, the goal said "Return to Pell" for the whole Fen story, and a keeper who skipped hb-12 was greeted as a stranger by Calloway after doing all six of her jobs. `currentGoal` now puts a hand-in here first, then the active job, then an offer here, then anything across the fog; `fen-01` requires `hb-12-road`, which is ready the moment it is taken if the landing is already found.
- **Crossing reads the notice board again; it does not deal a new one.** Redrawing the untaken jobs at each crossing (the entry below) made the road a free re-roll with a fresh timer. `localiseBoard` now makes the same jobs again for the new water from the same serial: same kinds, same timer, and there and back gives the board that was left.
- **Journal hints come from data.** The hint under a fish not yet caught was written for Hearthbay's zones by hand and was wrong for every Fen fish. `fishHint` builds it from the zone's `hint` and the fish's hours; a fish behind a flag (the Manyeye, the Listener) keeps its riddle until the flag is set, and then says where and when like any other. This is also the answer to the simulator knowing more than a player: the journal now tells a person what the model keeper acts on.
- **A dead band at the swap, and the far water is started only by a boat heading for it.** The swap was at exactly half way, so a boat idling there changed regions every few frames, and after every crossing the water just left was at once built again behind her. `SWAP_BAND` is 1.5% of the road either side; `regionAhead` takes the boat's heading.
- **The ground is built in turns of a few milliseconds, measured at the cells the game uses.** The step test ran at a 5 m cell with a 120 ms bound; at the real 2 m cell three turns took 16 to 26 ms, each a dropped frame while under sail. Faces now go into blocks of typed memory and are copied out a few blocks a turn (longest turn 3 ms at 2 m; the whole build is a third quicker too), and the test steps the Fen at 4, 2.5 and 2 m.
- **A full pot across the fog says which water it is in**, instead of being silent or sending the keeper looking for it here.
- Left as designed: one notice-board event can stand on more than one accepted job.

## 2026-11-16 — Dr. Calloway is built in code
There were no credits for a generated model, so the asset thread built her from parts in its kit (the way the Fen's props are made), on Mara's 24-joint skeleton with three clips of her own. Beside Mara, Pell and the player she reads as one of the cast. She replaced the stand-in with no change to game code but her entry in the model list. If credits are bought later there is no need to redo her.

## 2026-11-16 — The next water is made ready on the way to it
Building the Fen's ground at the moment of crossing froze the game for a second (measured: 1,000 ms, 95% of it the terrain). The terrain builder is now a generator that can be run a few milliseconds a frame (`terrainSteps`), and `RegionPrep` runs it for the region a sea-road leads to as soon as the skiff is on that road; the chart's "Sail here" gives it a bigger share during the fade. At the swap the finished ground is handed over, and what is left (water, flora, props) takes 78 ms here in software rendering. If the ground is not ready it is finished on the spot, so the worst case is the old pause, never a wrong world. Why not a worker: the builder reads the heightfield and three.js types directly, and stepping it on the main thread needed no second copy of either.

## 2026-11-16 — The sea bed is its own mesh, drawn coarse where it is flat
The Fen is mostly shallow water over a nearly flat bed, and at the lattice the land needs it came to 624,000 triangles, drawn twice because the ground casts shadows: 1.8 million a frame. The ground is now two meshes. Faces wholly under the water are the bed, which receives shadows and casts none. Where a 4 by 4 block of bed cells is flat for its depth it is drawn as one fan about its middle, with the fine lattice's own vertices kept on any side that meets a finely drawn neighbour, so there are no cracks (a test walks every edge). The Fen now draws 0.76 million triangles a frame on Medium, Hearthbay 0.44 million. Below 18 m the bed is left out: the water hides it.

## 2026-11-16 — The notice board belongs to the water the keeper is in
The first run of the Fen bot found the board at Sedge Landing asking for Hearthbay fish. Arriving in a region (`arriveIn`) now redraws the jobs nobody has taken, so a board only asks for what swims nearby. A job already taken is kept and can be finished anywhere. (Later the same day: the redraw became a re-reading of the same jobs, see the review entry above.)

## 2026-11-16 — The simulated keeper fills the journal once the story is told
The simulator said nobody ever landed the Listener or finished the Mossglass page. That was a fact about the model player, not the game: she fished only where the coins were best, and planned an outing without looking at the clock. With no story job left she now goes after the fish missing from the journal, sets out early for one that keeps hours, and does not sit up for it while a better rod is still to be earned. With that, the page comes about a quarter of an hour after Calloway's last job, and nine keepers in ten have the Listener inside seven hours, most of them about an hour and a quarter after the Post. A liking for glowgrub was tried for the Listener and taken out again: with the Fenwood Rod's luck it made one bite in six at the Post an uncanny fish, which is a farm, not a rumour.

## 2026-11-15 — One sea, one set of coordinates, one water built at a time
The five regions stand on a ring round the Still Eye in a single coordinate space, so a mooring, a chest or a sea-road end means the same thing to the save, the chart, the route finder and the simulator. Only the water the keeper is in is built; the change is made half way along the sea-road, in the thick of the fog where nothing can be seen, so there is no loading screen and no seam to look at. Considered and dropped: building both neighbours at once (twice the triangles for a view the fog hides) and a loading screen (the directive asks for free sailing).

## 2026-11-15 — The lamp shows the road; it does not open the sea
With the Fog Lamp the fog still turns a boat back everywhere except along the sea-road, a double line of lights that only wake to the lamp. Why: a lamp that simply switched the fog off would leave 230 m of empty grey to cross in any direction and nothing to steer by. A road gives the crossing a shape, something to follow, and a place for the swap; and later roads can ask for more than a lamp.

## 2026-11-15 — No new shopkeeper in the Fen: Mara's packet box
Selling in the Fen goes through a crate of Mara's on the landing, at stall prices, with her shelf in the lid. Why: one shop to learn, one voice to record, and Calloway stays what she is (somebody who measures, not somebody who sells). Goods marked `from: "reached:<region>"` appear on every shelf once that region has been reached, at home as well: the first design kept Fen goods to the box, and it only meant a sail across the fog to buy bait.

## 2026-11-15 — Lists of what is in the build are made at build time
`vite.config.ts` lists the models and sounds under `public/` into two virtual modules. A sound or model that has been asked for and not delivered is "pending": its stand-in plays and no test looks for it; the day its file is in the build it is used, with no change to the code. Why: the asset thread pushes to main on its own clock, and a delivery should not wait on somebody editing a list.

## 2026-11-15 — Pots copy the journal, stop when full, and are set by hand
Automation had to stay behind active play and earn only while the game is open. A Lantern Pot traps only fish the player has already caught and written in the journal, at half the value, with rare fish half as likely per tier; it holds three and stops. So a pot never discovers anything, never out-earns the rod (the simulator holds it to 10 to 25% of income), and pays for coming back to it, not for leaving the game running. Pots tick in the game's fixed step and nowhere else: nothing accrues while closed. Rejected: a rate that runs forever (rewards idling), a pot that rolls the zone's whole table (finds fish for the player), offline catch-up.

## 2026-11-15 — The Bell pays on lifetime coins, less what it has already given
Echoes are `floor(0.15 × sqrt(lifetime coins))` minus the Echoes already paid. Because the count only ever grows with coins earned, ringing early and often never loses anything and waiting never loses anything: there is no best moment to work out, only a choice about what you want now. The Bell's page says exactly what will be taken, what stays and what it will give before the rope is pulled. Rejected: paying on this run's coins (punishes ringing late, invites spreadsheet play).

## 2026-11-15 — The first Turning is the gate to the next region
The fog lamp that opens Mossglass Fen will cost Echoes, so every player rings the Bell once before leaving Hearthbay, about 75 minutes in. The Turning takes coins and what coins bought (tuning, creel, bait, pot upgrades) and leaves everything found or owned outright (rods, lures, clothes, pots, boats, relics, journal, chart, story). A second tide is quicker than the first; a test holds that.

## 2026-11-15 — Gear numbers go through one fold
Every bonus from rod tuning, bait, lure, creel, clothes and their set, relics, Echoes and the boat is added up in `stats()` and nowhere else. The game, the Gear page and the simulator read the same object, so what the page says is what the sea does and what the simulator tuned. Luck compounds by rarity tier, so it matters most where fish are rarest.

## 2026-11-15 — A press hauls or sets; taking a pot up is a held key
The reviewer pointed out that right after a haul the same key on the same pot meant "take it out of the water", so a double press undid the player's own work, and a pot in hand could not be set anywhere near an empty one. A press now only ever hauls or sets. An empty pot comes up when F is held for 0.6 s, and the prompt says so.

## 2026-11-15 — Turning a job down never closes the stall
"Not just now" used to end the conversation. Once Mara had two jobs to offer after the flounder, a player who did not want the pot job could no longer reach "Sell my catch", which also blocked the story. Declining now falls through to whatever else the person does (Mara buys and shows the shelf, Pell rows). Found by the fresh reviewer; `tests/talk.test.ts` and the tide bot hold it.

## 2026-11-15 — A cast keeps what it went out with
Bait, lure and night-only gear are fixed when the line goes out. A change made while it is out (a bait picked in the satchel, nightfall, a stack running out) takes hold when the line is in again, and the hook spends the bait the cast actually used. Before, a player could cast on Glowgrub, switch to breadcrumbs during the wait, and keep the grub.

## 2026-11-15 — A pot lands where it can be seen
The first run in a browser showed a pot set from the dock landing under the dock's edge, behind the keeper and under the prompt. The higher the keeper stands the further out the pot now lands, a little to the side away from the rod, and the prompt drops low while a pot is in reach. Pots have their own key (F) so hauling one from the boat never fights with stepping ashore (E).

## 2026-11-13 — Sailing is an arcade model with a hard rule about the bottom
The skiff has a throttle, a rudder that bites with speed, drag, and a set of hull sample points that may never sit in less water than her draft (`core/boat.ts`). She slides along a shore instead of stopping dead, and when a turn is blocked she is worked toward deeper water so the helm alone always gets her off. No wind direction. Why: feel first. Tacking against a true wind would make every errand slower and add nothing a fishing game needs; a boat that wedges in the shallows is the worst thing sailing can do, so the rule that prevents it is a test.

## 2026-11-13 — Places are found by sailing to them; fast travel only between moorings
A chart place is added (and pays once) when the boat comes inside its circle. From a mooring the chart can carry the boat to any mooring whose place is known, and the passage costs time of day. Why: the directive asks for free sailing and discovery with a clear next goal. Finding a place has to be done by hand once; after that the crossing should not be a chore. Open water cannot start a passage, so the chart is never an escape from the fog or a shortcut past sailing somewhere new.

## 2026-11-13 — Pell's ferry ends when the player has a boat
With a skiff owned Pell offers no more rides and stands at the Hearthbay dock (flag `pell-home`) once the player has sailed anywhere but Gull Point. Why: two ways to cross the same water would leave the player's boat stranded on the wrong island, and Pell giving up his boat is the story beat.

## 2026-11-13 — One reach for stepping ashore and for climbing back in
A landing is only offered within 6.4 m of the hull, and boarding reaches 0.6 m further than that, both measured from the hull and not from the middle of the boat. Why: the two used different measures (7.5 m from the middle to land, 6 m from the hull to board), and the fresh reviewer found shelving shores on Kettle Isle and Hearthbay where the player could step off and never get back aboard, with Pell's ferry gone and no mooring near. A test now runs the skiff at every island from all round.

## 2026-11-13 — The Twofold Flounder lives only at the Teeth
It used to bite anywhere in open water, so "What Bites at the Teeth" could be finished without going there. Why: the errand is the reason to sail to the Teeth, and deep water there should hold what the rest of the bay does not.

## 2026-11-13 — The wake is drawn by the water, not on it
The skiff's wake is foam computed in the water shader from her recorded track, not a ribbon mesh laid over the surface. Why: the ribbon was depth-tested against water whose real height (depth fade, level of detail, sideways wave motion) the CPU cannot match, so from above most of it was hidden and what showed looked like two rails.

## 2026-11-13 — The region's edge is the Murmur Fog
Inside the last 110 m of the region the sea hums, a pale violet fog closes in from the horizon up, and the boat is slowed and then pushed back; the chart says a fog lamp is needed. Why: an invisible wall is the cheapest edge and the worst; this one can be seen coming, is part of the mystery and names the next gate (Mossglass Fen).

## 2026-11-13 — The camera comes in beside tall ground instead of climbing it
If the ground between the player and the camera stands more than 2.5 m above the sight line, the camera moves in along the line. Why: fishing beside the Teeth put the camera on top of a sea stack, looking straight down.

## 2026-11-13 — The camera looks the way the player faces, not at the player
The camera sits to one side of the player (0.9 m walking, 1.5 m fishing) and the point it looks at is moved sideways by the same amount, so the view is parallel to the player's facing and to the cast. Why: Lawson reported that casts "tend to go off to the left". Measured: the camera looked back at the player's head from its offset, which turned the view 10 degrees away from the cast; the player stood dead centre and the landing ring sat 12 to 16 percent of the half-screen to the left. Now the difference is 0 degrees and the ring sits within 7 percent of centre. `e2e/play.cjs` fails if the view and the cast differ by more than 1.5 degrees or the landing mark leaves the middle of the screen.

## 2026-11-12 — Recorded sound through a bank with synth stand-ins; the mix is measured
Every recorded one-shot (`public/audio/sfx/<name>_<n>.ogg`) plays through `AudioEngine.sfx`, which picks a variation other than the last one and drifts the pitch a little; if the file has not loaded the old synth version plays instead, so nothing is ever silent. Values that change every frame (cast charge creak, line hum) stay procedural. Music decodes one track at a time (a 140 s stereo track is about 50 MB decoded) and crossfades; it dips under voice lines. Why measured: nobody on the team can hear, so `e2e/audio.cjs` plays each sound over the music and sea bed and prints peak and RMS at the output; the rule is no clipping and foreground peaks at least 12 dB over the bed's average. Lawson's ear is the final check.

## 2026-11-12 — Conversation camera: a two-shot from the side
While talking, the camera swings about 55 degrees off the line between player and NPC, onto the side with a clear view (no prop or hill in the way), preferring the smaller swing, and swings back afterwards. Why: straight behind the player, the player's own back hid whoever they were talking to (worst with Wick, who is small).

## 2026-11-12 — Solid world by circles
Houses, the stall, the board, dock crates and villagers are circles `[x, z, radius]`; the player slides around them. Why: cheap, no physics engine, and good enough for a harbour of round-ish things. `e2e/walk.cjs` walks at each with the real keys so a blocker can never seal off someone you must talk to.

## 2026-11-12 — Story fish must be catchable where the story happens
Every fish a Hearthbay quest asks for lists the dock as a zone (tested), and the story bot catches them for real instead of being handed them. Why: the fresh reviewer found the Lampjaw could only be caught from a boat that does not exist yet, which the bot had hidden by granting the fish.

## 2026-11-12 — An unreadable save is quarantined, never overwritten
If both the save and its backup fail to parse, they are renamed `*.corrupt-<time>.json` and a new game starts with a notice; the backup only ever rotates a save that parses. Why: the old behaviour started a new game and the next autosave destroyed the evidence.

## 2026-11-12 — The cast: a pendulum lure, a real flight path, and the camera stays with the angler
The lure hangs half a metre off the rod tip as a pendulum while winding up, is slung for a tenth of a second on release, then flies a parabola whose height grows with power and distance; the line follows the path the lure flew and settles onto the water. The landing splash, float plunge and ripples scale with power. The camera's pivot stays on the player's head and only its aim point slides out towards the lure, with a small kick and a wider view on release. Why: Lawson said the cast "barely feels like it's getting thrown"; the old cast teleported a float along a fixed arc and slid the whole camera out over the water.

## 2026-11-12 — Fish shadows are drawn in the water shader
Fourteen shadows (thirteen roaming, one "biter") are positions and headings in uniform arrays; the water fragment shader draws each as a soft fish silhouette, wobbled by the ripple normal, darkening the water body under the surface highlights. The biter's distance from the float is driven by the fishing session's time to the next nibble or bite, so what you see is what is about to happen. Why: real meshes under a transparent water surface fight the depth fade and the foam; in the shader they sit under the surface for free and cost one loop.

## 2026-11-12 — Player rod: authored clips at rest, procedural while fishing
Walking about, the player plays the authored rod_idle/rod_walk/rod_run clips and the rod sits in the hand's RodSocket. While fishing, the rod's grip follows a sprung target driven by power, tension and the fish's run; two-bone IK brings the right fist onto the grip, turned so the socket lines up with the rod, and the left hand onto the reel. The body underneath plays the authored fishing stance (rod_wait) and leans with rod_lean_left/right. Why: the fight has to answer the fish frame by frame, which canned clips can't do, but the authored clips give the body weight and the fists a real grip. A landed fish uses the authored show_catch clip and sits in CatchSocket.

## 2026-11-12 — Voice lines are matched to their text by hash
`npm run voice` writes the script (docs/voice) from the quest and NPC data, with an FNV-1a hash of each line. Recordings are listed with that hash in public/audio/voice/voiced.json and the game plays a file only when its hash matches the line's current text. Why: dialogue will keep being edited, and a stale recording saying different words from the subtitle is worse than silence. The script also reports missing and stale recordings.

## 2026-11-12 — Gull Point by ferry, not a land bridge
Pell rows the player out once the relight quest starts (and always back). Why: the island is the payoff of the first arc, a short fade-and-arrive keeps the pacing tight before boats exist, and it introduces the skiff that becomes the first boat.

## 2026-11-12 — Save v2: the notice board's state lives in the save
The board's generated jobs, their refresh timer and serial are saved, with a v1 → v2 migration and fixtures for both. Why: a reload must not reroll or refresh jobs (that would be an exploit and feel random).

## 2026-11-12 — Harbour layout: walkable deck to the shore, landing with stall and board
The dock deck runs back onto the shore so there is no gap to fall through, and widens into a landing that carries Mara's stall and the notice board. NPC spots, places and ferry landings are all checked walkable by a unit test. Why: v0.0.1 could strand the player on the dock; the landing gives the harbour a centre the player returns to.

## 2026-11-12 — Voiced dialogue (Lawson)
Every NPC line is voiced with Higgsfield text-to-speech, one consistent voice per character, generated from the dialogue data files so the text and audio never drift. Lines stay short (see DESIGN §10.4), which suits voicing. Sound effects come from ForgeGUI's sound-effect generator and from procedural WebAudio (reel clicks, line hum, water), music from the music generators. Voice files are tracked in docs/ASSETS.md and regenerated by a script when a line changes.

## 2026-11-12 — Higgsfield credits: no spending limit (Lawson)
Lawson lifted the cap on spending *existing* Higgsfield credits and asked for the highest-fidelity models I can reach ("as if they've had three fidelity passes"; cartoony is fine). Buying credits or plans still needs their approval. Consequence: generated 3D is now the default for hero assets (player, NPCs, boats, landmarks, set-piece fish), each taken through generate → clean-up → restyle-to-palette → optimize. The procedural-fish decision below is re-opened: I will A/B a generated fish against the procedural one and keep whichever reads better in game.

## 2026-11-12 — Subagent model policy (Lawson's standing rule)
Every subagent runs on Opus 5.5 at extra-high (xhigh) effort by default. Fable 5.2 is used for a subagent only where the work needs it (3D modelling, the hardest coding). Why: Lawson's instruction in the project thread.

## 2026-11-12 — Procedural fish models from parameters
Fish are built in code from a per-species shape description (body profile, fins, eyes, colours) rather than one generated mesh each. Why: ~60+ species must look like one game and stay in palette; code guarantees consistency, costs no credits, makes Strange traits (extra eyes, inverted colours) trivial, and keeps the roster fully data-driven. Generators are reserved for hero assets (player, NPCs, boats, landmarks) where hand-modelling in code would look worse.

## 2026-11-12 — Prestige keeps story, gear ownership and the map
The Drowned Bell resets coins and upgrade *levels* but keeps owned gear, boats, relics, story and discovered regions. Why: rebirth should feel like a fast, powerful rerun, not a punishment; resetting story or the chart would create the dead stretches the directive forbids.

## 2026-11-12 — No offline earnings; automation only while open
Directive fixed point. Load ignores elapsed real time.

## 2026-11-12 — Working title "Murmurwater"
Evokes the humming sea at the centre of the mystery, cozy and slightly wrong. "Lanternwake" was considered and dropped: the name is already used by games on itch.io.

## 2026-11-12 — Engine: three.js + TypeScript + Vite, packaged with Electron
Considered Godot 4, three.js/Electron, Babylon.js/Electron, Tauri.
- **Testability:** my session can run headless Chromium with WebGL2 (SwiftShader verified) and take real screenshots of the actual renderer; logic runs in Node under vitest with no engine. Godot headless cannot render without a GPU here, so visual verification would be weaker.
- **Visual ceiling:** custom GLSL water/sky/toon shaders and a postprocessing chain reach the target stylized look; on an RTX 3060 WebGL2 is far from the bottleneck for low-poly scenes.
- **Build reliability:** electron-builder on GitHub's windows-latest runner is a well-trodden path to an installer and portable exe.
- **Tauri** rejected: WebView2 rendering/perf varies by machine; Electron ships a known Chromium.
- **Babylon.js** is equally capable; three.js chosen for its smaller core, shader control and ecosystem.
Trade-off accepted: larger download (~100 MB) than a Godot export.

## 2026-11-12 — Repo setup
The session cannot create repositories, so Lawson created `xsquaggle/murmurwater` (public, empty) on request.

## 2026-11-12 — 3D-Assets repo checked
`xsquaggle/3D-Assets` holds one model (`crate_input.glb`). Will evaluate it for the crate loot prop against the art bible.
