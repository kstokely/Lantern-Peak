# Lantern Peak — game design

## Story and cast (all original)
- **Lantern Peak**: a snowy mountain whose village holds a Lantern Festival every winter.
- **Juniper**, a cream-coloured mountain goat with a red scarf. The player controls Juniper, and Juniper is also the voiced guide who talks to the child.
- **Bluster**, a grumpy little storm cloud (the light antagonist). He sneezed a great wind that blew the festival lanterns, presents and gems up the mountain and froze the trail. He is never scary; at the summit he just wants to be invited to the festival.
- **Trail friends** (word-problem characters): Pip the snow hare, Marlow the marmot shopkeeper, Odette the owl clock-keeper.

## Core loop
1. Walk and hop along a side-scrolling zone (about 3 screens wide) with parallax and snowfall.
2. Find **gems** (6 per zone) and **wrapped presents** (4 per zone) on the ground and on ledges.
3. Touch a gem: a quick one-question "frost lock" pops up. Touch a present: it opens a math **mini game** (3 rounds).
4. Solving it bursts the present open and puts a **lantern** inside your pack.
5. Carry the 4 lanterns to the **camp sled** at the right end of the zone. Delivering them lights the camp, thaws the gate and unlocks the next zone.
6. The summit finale: light the great festival lantern, Bluster joins the party, confetti.

Gems are optional extras; they fill a trophy shelf on the map screen. Nothing is ever lost, there are no timers, and there is no fail state.

## Zones
| # | Zone | Look | Mini games in its presents | Ladder offset |
|---|---|---|---|---|
| 1 | Lantern Meadow | village edge, day sky, gentle hills | Gem Sort, Ice Bridge, Trail Friend, Coin Shop | +0 |
| 2 | Frostpine Forest | tall pines, soft blue light | Coin Shop, Clock Tower, Ice Bridge, Trail Friend | +0 |
| 3 | Glimmer Caves | cyan ice cave, crystals | Ice Bridge, Gem Sort, Pie Share, Ice Bridge | +1 |
| 4 | Clocktower Ridge | windy ridge at dusk, old clock tower | Clock Tower, Pie Share, Coin Shop, Trail Friend | +1 |
| 5 | Summit | night sky, aurora, festival lantern | Ice Bridge, Pie Share, Clock Tower, Trail Friend | +2 |

## Mini games (the math is the mechanic)
| Mini game | Strand | What the child does |
|---|---|---|
| **Gem Sort** | place value / counting | Drag hundreds, tens and ones gems into a crate to build the target number (or count a pile at low levels). |
| **Ice Bridge** | multiplication (add/sub below level 4, division mixed in higher) | Pick the plank with the right answer to lay the next piece of an ice bridge; Juniper crosses when it is complete. Arrays of snowballs illustrate the fact. |
| **Pie Share** | fractions | Slice and serve berry pie: tap slices to show a fraction, pick the bigger one, or pick an equal one. |
| **Clock Tower** | time | Drag the clock hands to set the time, or read the clock, or work out elapsed time. |
| **Coin Shop** | money | Drop coins on Marlow's counter to pay an exact price, or pick the right change. |
| **Trail Friend** | word problems | A friend tells a short story problem (pictures at low levels); pick or type the answer. |
| **Frost Lock** (gems) | counting, add/sub, mult/div facts | One quick multiple-choice question. |

Each mini game runs 3 rounds. Wrong-answer ladder: 1st miss gentle retry, 2nd miss shows the hint, 3rd miss shows a worked answer and moves to a fresh problem. A round counts as "first try" only if answered with no miss.

## Profiles and saving
- Up to 6 profiles, each with a name, a scarf colour and a starting grade (1st–4th). Stored in `localStorage` (key `lanternPeak.v1`).
- Saved per profile: per-strand level, streak counters, collected gems and presents per zone, delivered zones, totals.

## Adaptive difficulty
- 12 levels (see research part 3). Start level by grade: 1st → 1, 2nd → 4, 3rd → 7, 4th → 10.
- Tracked **per strand**. Level used for a problem = strand level + zone offset, clamped to 1–12.
- Up one level after **3 first-try correct answers in a row** in that strand. Down one level after **2 problems in a row missed** (a problem counts as missed when the first try was wrong). A strand never drops more than 2 below the grade start.
- Strands not yet taught at a level fall back to the nearest taught strand (for example Pie Share below level 2 becomes halves-of-shapes at level 2).
- A small level badge in the mini-game corner shows the current level so a grown-up can see it moving.

## Audio
- Sound effects: correct chime, wrong bonk (soft), gem pickup, present shake and burst, footsteps, camp jingle, win fanfare, button click, wind ambience.
- Music: one cheerful original loop, quiet, ducked under voice.
- Voice: Juniper lines for welcome, praise (several), gentle retry (several), hint intro, present opened, camp reached, zone intros, summit win.
- Audio starts on the first click/tap. Mute toggle is always visible and remembered.

## Controls
- Keyboard: arrows or A/D to walk, Up/W/Space to jump.
- Mouse/touch: tap or hold anywhere in the world to walk there; tap above Juniper (or a ledge item) to hop; big on-screen left, right and jump buttons. Tap a gem, present or the sled when near to use it.
- Juniper auto-hops small steps so young players do not get stuck.

---

# Expansion (v2): store, Flurries, tools, areas

Goal: make the mountain less linear and give gems a purpose. All names, creatures and items below are our own.

## Gems are money
- **Loose gems** (small, no question): worth 1, scattered everywhere, respawn slowly on revisits.
- **Frost gems** (big, Frost Lock question): worth 5 and fill the trophy shelf (6 per camp, as before).
- Bonus gems: +2 for each mini-game round answered first try, +10 for befriending a Flurry, +20 for lighting a camp.
- The HUD shows the gem purse. Gems are never lost.

## Areas: three per camp
Each camp (zone) now has a **Trail** (main area with the sled and gate) and two **side areas** entered through doorways on the trail. Each area holds 2 presents, so a camp has 6 presents; **any 4 lanterns** light the camp and open the next one, and all 6 earn a gold star. The child chooses which areas to do, and can come back later with new tools.

| Camp | Side area A | Side area B |
|---|---|---|
| 1 Lantern Meadow | Bramble Hollow (open) | High Shelf (needs Spring Hooves) |
| 2 Frostpine Forest | Hush Grove (open) | Frozen Den (needs Ice Chisel) |
| 3 Glimmer Caves | Crystal Gallery (needs Glow Lantern) | Echo Pool (needs Ice Chisel) |
| 4 Clocktower Ridge | Gear Loft (needs Spring Hooves) | Windy Hollow (needs Glow Lantern) |
| 5 The Summit | Aurora Shelf (needs Spring Hooves) | Star Cavern (needs Glow Lantern and Ice Chisel) |

A locked doorway shows the tool it needs; Juniper says what to buy.

## Marlow's Trading Post (the store)
Reached from the map and from a stall on every Trail. Stock grows as camps are lit.

| Item | Price | Available from | What it does |
|---|---|---|---|
| Cocoa Flask (holds up to 3) | 15 each | Camp 1 | In a mini game: a free hint that does not count as a miss |
| Spring Hooves | 40 | Camp 1 | Higher jump: reaches high ledges and upper doorways |
| Chime Bell | 60 | Camp 1 | Lets Juniper befriend Flurries |
| Glow Lantern | 70 | Camp 2 lit | Lights dark areas and reveals hidden loose gems |
| Ice Chisel | 80 | Camp 2 lit | Breaks ice walls in front of side areas |
| Swift Scarf | 90 | Camp 3 lit | Walk faster |
| Gem Magnet | 100 | Camp 3 lit | Nearby loose gems fly to Juniper |
| Silver Bell (upgrade) | 110 | Camp 3 lit | Flurries hear the bell from farther away |
| Trail Map | 120 | Camp 4 lit | Map screen shows which areas still hide presents, gems and Flurries |
| Hats and scarves (cosmetic) | 25–60 | various | Juniper wears them |

Buying is confirm-then-buy with a clear "not enough gems yet: you need N more" message (a small subtraction the child can check).

## Flurries (creatures to befriend)
Bluster's wind left behind **Flurries**: small shy snow-sprites, 10 kinds (2 per camp, one common on the Trail and one rare in a side area), each with its own look and name. They wander and dart away. With the **Chime Bell**, ring it near one: it stops, listens, and asks one quick riddle (a Frost Lock question). Solve it and the Flurry becomes a friend: it joins the **Flurry Lodge** album on the map screen, gives 10 gems, and afterwards can be seen playing at that camp. Nothing is caged or carried; they come along because they want to.

## No multiple choice at the top
When a problem's effective level is **10 or higher**, answers are entered, never picked: a number pad for numbers, with extra keys for fractions (n/d), times (h:mm), remainders (q R r) and money ($ and cents). Problem kinds that are inherently a choice (pick the sign, pick the equal fraction) are replaced at those levels by entry forms (e.g. "3/4 = ?/8"). Manipulative answers (build the number, set the clock, pay with coins, fill the pie) are unchanged since they were never multiple choice.

## Right picture for the thing being counted
Counting and story pictures must draw the named thing (gems, pinecones, stars, lanterns, carrots, mittens, cocoa mugs, fish, acorns...), never a snowball stand-in.

## Ideas taken from the genre reference video (concept level only, our own form)
- **Pack bar:** the HUD always shows the gem purse, cocoa flasks, owned tools and the bell, so the child sees what they have.
- **Places to enter:** side areas and Marlow's stall are doorways on the trail, so a camp is a small neighbourhood, not a corridor.
- **New mini game, Snow Scale** (strands counting and addsub): a balance scale with snow weights. Either pick which side is heavier / make both sides equal by adding the missing weight (drag numbered weights on; the beam tilts live). Appears in side-area presents.
- **Clock Tower addition:** "Set the clock 25 minutes later / 2 hours 40 minutes earlier" (levels 8+), using the existing drag-the-hands clock.
- **Trophy room:** the Flurry Lodge doubles as the prize room, with shelves for frost gems, gold stars, hats and befriended Flurries.


## Hidden Dad mode (easter egg)
**Unlock:** on the New player screen, type the name **Dad** (any case, spaces trimmed). A fifth grade option, **Dad**, pops in with a sparkle and is selected; change the name and it disappears again. A profile created that way is saved with `dadMode: true` (grade stays 4 internally); its card shows a small "Dad mode" badge and "Dad Lv N". Existing profiles named Dad are not converted.

**Play:** the world, gems, store, tools, areas and lanterns are unchanged, but every present (3 rounds), frost gem and Flurry riddle (1 round) opens **Dad Lab** instead of the kids' mini games: a dark oscilloscope-style bench with a RADAR / SOFTWARE tag, the question, its constants, a small diagram or C code box, and a decimal answer pad (0-9 . ± ⌫ OK, plus the physical keyboard) with the unit beside the entry. Answers are numbers checked within half a unit of the requested last digit (exact for integers). Hints, cocoa, the worked solution after the third miss (formula + arithmetic), round pips and Juniper's cheering all work as usual.

**Progression:** a separate Dad level (starts at 1, no cap): +1 after 3 first-try rights in a row, −1 (not below 1) after 2 missed problems in a row; camp offsets add as usual. Gem rewards as for the kids.

**Ladder** (src/math/dad.ts; each tier keeps the earlier topics with harder numbers; past level 10 numbers get uglier, rounding tightens at 13/19/27 and the chained T6 topics grow more common):

| Tier | Radar | Software |
|---|---|---|
| T1 (L1-2) | echo delay → range, wavelength, PRI/PRF, duty cycle, average power | binary, hex, shifts, modulo, powers of two, integer ranges |
| T2 (L3-4) | unambiguous range, range resolution (B and τ), dB / dBm conversions, pulse compression | bitwise ops, two's complement, bit-field extraction, C integer division, unsigned wraparound |
| T3 (L5-6) | Doppler shift, v_max and blind speed, Doppler bin width, coherent gain, kTB noise | trace C code, binary-search probes, binary tree shape, Q-format |
| T4 (L7-8) | range-equation scaling, beamwidth 70λ/D, aperture gain, cross-range, range folding | buffers and data rates, FFT bins, aliasing, endianness, struct padding, hash buckets, checksums |
| T5 (L9-10) | FMCW beat, range bins/cells, time on target, staggered-PRF blind speed, two-PRF range (CRT), SAR resolution and aperture, full radar equation in dB | exact loop counts, recurrences, Amdahl, array/cache strides, IEEE-754 fields, ring buffers, Q15 multiply with saturation, FFT bit reversal |
| T6 (L11+) | PRF conflict Ru·v_max = λc/8, Doppler FFT sizing, link budget → range, aliased Doppler bin | real-time data budget, pipeline latency, FFT operation counts, DSP core sizing |

Debug: `__LP.debug.dad(level?, topic?)` selects or creates a Dad profile at that level and enters camp 1; the optional topic id forces the next Dad Lab question. tests/dad.test.ts re-solves every topic with an independent solver (levels 1-30 × 300 seeds).
---

# v3: heroes, followers, camp music

## Play as a friend you have helped
- Juniper is the starting hero. Helping a friend unlocks them as a playable hero:
  - **Pip** the snow hare: finish 2 Trail Friend (story) presents.
  - **Marlow** the marmot: finish 2 Coin Shop presents.
  - **Odette** the owl: finish 2 Clock Tower presents.
  - **Bluster** the storm cloud: light the Summit (see the finale).
- A **Wardrobe** screen (from the map) picks the hero, the accent colour (scarf, neckerchief or bow), the hat and the Flurry follower. Locked heroes show what help they still need ("Help Pip with 1 more story present").
- Every hero uses the same moves (walk, hop, cheer), the same tools, and every hat fits every hero.
- Juniper stays the voiced guide. When another hero is chosen, Juniper trots along behind and keeps talking.

## Flurry follower
- Any befriended Flurry can be chosen (Wardrobe or Lodge) to follow behind the hero: it bobs along, hops when the hero hops, and does its happy pose when a present opens. Purely cosmetic.

## Music by camp
- A longer track for each camp's mood, plus the map/menus and Marlow's shop; tracks crossfade when the place changes. Files: music_menu, music_camp1..music_camp5, music_shop (the old short loop stays as a fallback).

---

# v4: platforming that grows with the mountain

Goal: each camp higher up asks for more skilful climbing. Still no fail states: nothing is ever lost.

## Feel
- Variable jump height (tap = small hop, hold = full jump), about 0.1 s of "coyote time" after leaving an edge, and jump buffering, so jumps feel fair for small hands.
- Areas can be taller than the screen; the camera follows up and down.
- **Checkpoint lanterns** light as the hero passes. Falling into a gap is soft: a puff of snow floats the hero back to the last lit checkpoint.
- **Helper cloud:** after 3 falls in the same stretch, a smiling cloud appears there and carries the hero across. No message about failing; Juniper just says "Look, a helper cloud!"
- Wooden arrow signs show the way where a route goes up.

## Mechanics by camp
| Camp | New pieces | Shape |
|---|---|---|
| 1 Lantern Meadow | none (walking, hopping, ledges) | flat, one screen tall |
| 2 Frostpine Forest | rock terraces and steps, bounce pads, slow side-to-side lifts, first small gaps | gently hilly, one screen tall |
| 3 Glimmer Caves | slippery ice floors, crumbling ice ledges (they regrow), lifts that rise and fall | up to two screens tall |
| 4 Clocktower Ridge | wind gusts that push in pulses, tick-tock platforms that appear and vanish on a steady beat, turning gear platforms, pendulum swings | up to two screens tall, wider gaps |
| 5 The Summit | aurora bridges that fade in and out, plus every earlier piece in combination | a tall climb, up to three screens, ending at the summit lantern |

- The Trail and side area A of each camp use the camp's pieces at a moderate level; side area B (the tool-gated one) is the hardest and holds the most bonus gems.
- At least 4 of a camp's 6 presents are reachable with ordinary jumping (no optional tool); harder branches guard frost gems, loose-gem arcs, Flurries and the last presents.

## New tools at Marlow's
| Item | Price | Available from | What it does |
|---|---|---|---|
| Grip Hooves | 90 | Camp 2 lit | No sliding on ice |
| Cloud Boots | 130 | Camp 3 lit | A second jump in mid-air |
| Feather Cape | 140 | Camp 4 lit | Hold jump while falling to glide down slowly |

## Controls note
Tap-to-walk still works on simple ground. For climbing sections the on-screen arrows and jump button (or the keyboard) are the way; the hint button points along the route.
