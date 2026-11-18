# Lantern Peak - research findings

Genre-level research only. Nothing from any existing game (names, characters, art, music, layouts, look) is reused. Claims are tagged sourced / inference inside each part.

## Part 1 â€” What made 1990s kids' math adventure games feel good

**Evidence note.** Claims tagged *(sourced)* come from pages actually read (see Sources). Claims tagged *(inference)* are genre-level design reasoning from general knowledge, not verified in a source I read. Sound design and session pacing in particular had almost no citable material (see the end of this section).

### 1. The exploration loop

The mid-90s kids' learning-adventure genre followed a recognisable shape. A hub (a map, a building, a camp) gave the child a sense of place. Activity "rooms" or puzzle stations hung off it. Each station yielded an item, a part, or a rescued character. Carrying that back to the hub advanced a larger goal.

- Super Solvers-era titles (The Learning Company, 1993) had the player travel to different worlds, collect vehicle parts in mazes, race a rival, and open locked doors by answering puzzles. Puzzle types could be independently adjusted for skill level *(sourced, game-database summaries; moderate reliability)*.
- Zoombinis (1996) strings logic mini-games along a mountain path, with campsites where the player regroups. Later entries added checkpoints and alternate routes *(sourced)*.
- JumpStart-style point-and-click adventures move between static screens through hot spots that trigger characters, items, songs, or mini-games *(sourced)*.
- Oregon Trail and Carmen Sandiego are cited by critics as the best balance of learning and play *(sourced)*.

The hub-and-spoke structure matters. The child chooses what to do next (a sense of control), and the stations stay small and self-contained.

### 2. Collecting and reward

Collectibles gave the maths a purpose. Gems, parts, and rescued creatures are visible, countable, and persistent. One Super Solvers title tied 100% completion to a collectible in each stage plus speed ranks *(sourced, low-tier source)*. *(Inference:)* collecting works for 6â€“10-year-olds because it is concrete (you can see the pile grow), it is completionist (empty slots invite filling), and it is revisitable (a trophy room lets a child show it off). Rank promotions are the same idea at a larger scale.

Learning science adds a caveat. In Habgood and Ainsworth's comparison, rewards that came from the game world itself (a correct division answer changing what happened in combat) worked better than gold stars and separate quizzes *(sourced, via KQED summary)*. The best reward is therefore a consequence in the world, not a sticker.

### 3. Character voice feedback

Documented specifics are thin, but the direction is clear:

- Earlier maths software punished errors with loud, harsh sounds. Math Blaster's publisher deliberately aimed to avoid that and keep kids engaged *(sourced)*.
- Reader Rabbit-style titles handled mistakes gently, which reviewers felt encouraged timid children, with small animations for correct answers and supportive commentary between activities *(sourced, review summary)*.
- *(Inference:)* the helper character is a coach who never scolds. A wrong answer is met with a neutral "not quite, try again," then a hint, then (after repeated misses) a worked demonstration. Praise lines rotate through many variants so they do not grate.

One reviewer anecdote suggests feedback can be gamed by guessing *(sourced, single comment)*. Hint ladders, not answer-reveals, reduce this.

### 4. Sound design

I could not source detail on chimes, pickup sounds, or MIDI music for specific titles. *(Inference, reasonable but unverified:)* short, bright, high-register sounds (a rising two-note chime, a sparkle) are quickly recognised, rarely fatiguing, and mask no speech. A distinct sound per event type (pickup, correct, delivery, rank-up) teaches the child the game's grammar without reading. Ambient loops should be quiet and low-density so voiced instructions stay audible.

### 5. Pacing

No source I read gave session lengths. *(Inference:)* the design pattern is short stations (1â€“3 minutes), a reward at the end of each, and a larger milestone every 10â€“15 minutes, so a child can stop at any natural break. Alternating free movement with a maths puzzle prevents quiz fatigue. Critics note that the 1990s market flooded shelves with low-variation drill titles *(sourced)*; variety of station type is the main antidote.

### 6. Intrinsic integration versus "chocolate-covered broccoli"

The critique: learning is a tax the child pays to return to the fun *(sourced)*. Amy Bruckman's 1999 paper used "chocolate-dipped broccoli" with Math Blaster as the example, while some sources credit Brenda Laurel (2001) with "covered"; attribution is disputed *(sourced, conflicting)*. Math Blaster itself is arcade drill: the player fires at the correct answer, and its own Wikipedia entry calls it drill and practice *(sourced)*.

Evidence for the alternative: in Habgood and Ainsworth's Zombie Division study, children who played the intrinsically integrated version scored higher on a division test and chose to play it about seven times longer when given a choice *(sourced, via KQED summary)*. A 2022 pre-registered study (n=210) replicated higher learning and attributed it to attention: players focus on what the task needs *(sourced, via search summary; not read directly)*.

Zoombinis is a useful positive example: sorting, graphing, algebraic and hypothesis-testing skills are the puzzle mechanics themselves, goals are stated clearly, and wrong guesses stay visible in a pile so the child can learn from them *(sourced)*.

Manipulatives-as-mechanics ideas (*inference*): a clock that must be set to open a gate; coins that pay a toll; a balance scale that must be level to cross; bridges built from counted planks; crystals grouped into tens to power a lift.

### 7. Adaptive difficulty and learning science

- Era games typically offered selectable levels. Reader Rabbit's later A.D.A.P.T. system assessed ability and adjusted levels, help, and progress tracking *(sourced)*. Reviewers describe difficulty rising gradually *(sourced)*.
- The WWC elementary-maths practice guide recommends immediate, supportive feedback when children cannot explain concepts or execute procedures *(sourced)*.
- Interleaved (mixed) practice shows benefits in an IES-funded study, though in grade 7, not elementary *(sourced, search summary; extrapolating to ages 6â€“10 is an inference)*.
- Not verified here: specific mastery-streak thresholds and spaced-repetition intervals for ages 6â€“10.

### 8. Accessibility for young kids

*(Inference; not sourced in this pass.)* Large targets (at least 64 px, ideally larger), spoken instructions with a replay button, icons over text, no countdown timers on maths, and no fail states. Zoombinis' limited-attempt design is a counter-example to avoid for grades 1â€“2 because lost characters punish the child *(sourced description; judgment is mine)*.

---

## Design takeaways for our original game

1. **Hub plus small stations.** A free-roam hub with 4â€“6 short activity stations; each takes 1â€“3 minutes and ends with a tangible item.
2. **Make the maths the mechanic.** The action that moves the world is the maths action (set the clock, level the scale, count the planks). Avoid "answer a quiz to unlock a door" as the default.
3. **Consequence rewards over stickers.** A correct answer changes the world visibly (bridge appears, lantern lights); stars are secondary.
4. **Deliver-to-hub loop.** Items collected in stations are needed at a hub location, giving each trip a purpose and a payoff moment.
5. **Persistent trophy room.** Collected items appear on shelves; empty slots show what is missing; the child can revisit and replay the reward animation.
6. **Ranks as a long arc.** Promotions every several deliveries, each with a bigger celebration and a new cosmetic.
7. **Coach, not judge.** The helper never says "wrong." Miss 1: gentle retry. Miss 2: hint. Miss 3: show a worked example and let the child redo a fresh variant.
8. **Many voice lines.** At least 6â€“8 variants per praise category, no immediate repeats, short (under 2 seconds), and rarely on every action.
9. **Event-specific short sounds.** One bright sound per event class (pickup, correct, delivery, rank-up), under about 1 second; separate quiet ambient loops per zone; duck music under speech.
10. **No timers, no fail states.** Nothing is lost on a miss. Speed, if used, is an optional bonus never shown as pressure.
11. **Quietly adaptive difficulty.** Raise after a short success streak (for example 3â€“4 clean answers), ease and scaffold after two misses; also let a grown-up pick a grade band.
12. **Mixed practice.** Within a session, interleave problem types the child has already met instead of long blocks of one skill; this is a hypothesis to test, not a proven fix at this age.
13. **Voiced instructions, icon-first UI.** Every instruction spoken with a replay button; big targets; text only as a supplement.
14. **Visible working-out.** Show wrong attempts non-judgmentally (a Zoombinis-like visible history is a good idea) so children can reason from them.
15. **Natural stopping points.** A milestone every 10â€“15 minutes with a save-and-celebrate screen so sessions end on a high.
16. **Vary station types.** Mix movement/exploration, counting, measuring, and pattern tasks so no single drill dominates.
17. **Optional challenge tiers.** Offer a harder variant of each station that awards a distinct collectible, so completionists have a goal without forcing difficulty on others.
18. **Playtest with children.** Treat pacing numbers and praise frequency as hypotheses; log retries and abandonment per station.

## Originality guardrails

**Must NOT copy** (from the titles studied):
- Names, mascots, and characters: Super Solvers and its cast, Zoombinis (and their trait-based look), Reader Rabbit, JumpStart characters, Math Blaster's mascots, Carmen Sandiego, Oregon Trail terminology.
- Signature mechanics that define a title: Zoombinis' trait-sorting trek with a team that can be lost; Math Blaster's cannon-fires-at-the-answer drill; Super Solvers' part-collecting race against a named rival; Reader Rabbit's songs-as-narrative structure.
- Specific puzzle names, level layouts, maps, rank titles, soundtrack motifs, catchphrases, and UI skins from any of these games.
- A snowy-mountain setting with identical beats to any existing title; keep our world's geography, cast, and puzzle set new.

**Fine to use (generic genre conventions):**
- Hub-and-spoke exploration, activity stations, collectibles, deliver-to-hub loops, trophy rooms, rank ladders.
- A friendly guide character (our own design), gentle retry, hints, praise variety.
- Short chimes and cheerful loops, voiced instructions, big buttons, level selection, adaptive difficulty.
- Manipulatives (clocks, coins, scales, counters) as puzzle tools; intrinsic integration as a principle.

## Sources

- https://en.wikipedia.org/wiki/Edutainment (read, partial): history and criticism of edutainment; thin on the 1990s boom.
- https://en.wikipedia.org/wiki/Zoombinis (read): gameplay, puzzle skills, limited attempts, campsites, visible wrong guesses.
- https://en.wikipedia.org/wiki/Math_Blaster! (read): arcade drill structure, reviewer praise, no adaptive difficulty described.
- https://en.wikipedia.org/wiki/JumpStart_(series) (read): point-and-click hot-spot structure.
- https://en.wikipedia.org/wiki/Reader_Rabbit (read): A.D.A.P.T. adaptive learning technology (1999).
- https://tedium.co/2017/04/13/edutainment-math-blaster-chocolate-covered-broccoli/ (read): edutainment critique, harsh-sound feedback history, titles cited as best balanced.
- https://www.kqed.org/mindshift/20765/whats-the-secret-sauce-to-a-great-educational-game (read): Habgood and Ainsworth intrinsic integration findings.
- https://www.toontalk.com/English/easydoit.htm (read): discussion on edutainment, control, intrinsic motivation.
- Web search results only (not opened): Giant Bomb / GOG / Lutris pages on Super Solvers: Gizmos & Gadgets (gameplay summary); SuperKids reviews of Reader Rabbit (gentle mistake handling); Zombie Division case study at https://shura.shu.ac.uk/id/eprint/10652 and the 2022 Cutting and Iacovides study at https://eprints.whiterose.ac.uk/189921 ; WWC practice guide at https://ies.ed.gov/ncee/wwc/practiceguide/26 (immediate feedback); IES interleaved-practice study at https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice?ID=1790 ; Bruckman/Laurel attribution via artsjournal.org and canvas.net pages.


## Part 2 â€” The era's 2D art and animation style

Scope note: web sources I read cover dithering, hue shifting, outlines, parallax and frame counts. Era-specific numbers (sprite sizes vs 640x480, HUD share, UI bevels, particle sizes) are not documented in any source I found; those are marked *(craft knowledge, unverified)* and should be treated as defaults to tune by eye.

### 1. Backgrounds
- **Look:** Mid-90s SVGA edutainment backgrounds read as painted: soft sky gradients, shapes built from broad value masses, little line work. VGA art was commonly scanned or painted, then reduced to 256 colours and touched up by hand; dithering was the tool for smooth transitions between palette entries (forum accounts, not authoritative).
- **Dither vs. gradient:** Dithering needs more steps as the contrast between the two blended colours grows. For high-contrast gradients, add intermediate palette steps rather than stretching one pattern. Dither patterns look coarse when scaled, so judge at final display size. For us: a canvas can do true gradients, so emulate the era with banded gradients (6-10 visible bands) plus an optional 2-pixel ordered dither on band edges, not smooth 8-bit ramps.
- **Depth layering:** Sky gradient, far peaks, mid ridges, near slope, foreground framing (trees, rocks), then the playable ground strip. Each layer is flatter and lower-contrast the farther it is.
- **Atmospheric perspective:** Painters' consensus is that colour cools and lightens with distance: shadow colour moves from blue-green to blue-violet to blue as space recedes. Far peaks should be close to the sky colour, with low contrast and few details.
- **Parallax:** Scroll-factor conventions are camera-relative multipliers: 1.0 matches the camera, below 1 reads as farther, 0 is static. Engine docs give a five-layer example of sky 0.1, high clouds 0.2, low clouds 0.3, hills 0.5, forest 0.7. Hobby tutorials use 0.05-0.3 for far layers. Many mid-90s adventure/edutainment games used single-screen painted backdrops with little or no parallax *(craft knowledge, unverified)*, so 3-5 layers is a generous budget and optional.

### 2. Palettes
- **256-colour effect:** VGA picked 256 colours from 262,144 (6-bit RGB). Whole scenes shared one palette, so artists built hue ramps and reused them across sky, snow, and characters. Result: cohesive, slightly banded, saturated scenes. Shared ramps are the single most transferable idea.
- **Hue shifting:** Shadows drift toward blue/purple, highlights toward yellow/orange, roughly 10-20 degrees of hue per ramp step, rather than merely darkening.
- **Snow:** Shadows on snow take sky colour: blue-violet by default, sometimes greener or cyan near ice. Sunlit snow is warm cream; warm light against cool shadow intensifies both. Some warm light also bounces into shadows, so shadow edges can carry a faint warm tint.
- **Pop colours:** Cool, desaturated-to-mid backgrounds with a small set of warm, high-saturation accents (red, orange, yellow, magenta) reserved for interactive objects and collectibles. Background never uses those accents at full saturation.
- **Kid-friendly:** High saturation but controlled value structure: big readable value contrast on interactables, soft contrast in scenery.

### 3. Sprites
- **Outlines:** Pure black outlines can overpower shadowed areas. The alternative, "selective outlining", uses a darker shade of the neighbouring fill (about one ramp step down, and lighter where the form is lit); solid black is still a legitimate stylistic choice, and internal lines can be soft-outlined either way. Our plan: coloured dark-navy/plum outline (never #000) on characters and interactables, lighter ramp-tone outline on lit edges.
- **Scale** *(craft knowledge, unverified)*: Hero character roughly 12-20% of the 480 px screen height (60-95 px), props 25-60 px, collectibles 24-40 px with larger-than-life readability.
- **Proportions** *(craft knowledge, unverified)*: Head 1/2 to 1/3 of body height, eyes large with big highlights, short limbs, rounded silhouettes. Silhouette should read at 50% scale.
- **Shading:** 2-3 tones plus a highlight: base, shadow (hue-shifted cool), optional deeper shadow, and a small warm highlight placed upper-left. Dithering is rarely usable on small animated sprites because there are too few pixels; use flat tones.

### 4. Animation
- **Frame counts (sources agree on ranges):** idle 2-4 frames with long holds (idle breathing about 300-500 ms per phase); walk 4-8 frames (4 for small sprites, 6-8 for 32 px and up); run or walk loops of 6 work well in most cases; jump 3-6 frames (anticipation, takeoff, peak, fall, land).
- **Timing:** One tutorial plays an 8-frame cycle at 80 ms per pose (12.5 fps) and a 4-frame cycle at 160 ms (about 6 fps): fewer frames means the same loop duration at slower playback. Walk cycles commonly land at 100-150 ms per frame. Anticipation poses are held longer (about 120-200 ms) than the action itself (30-60 ms per frame).
- **Squash and stretch:** On sprites around 12-16 px, it is only 1-2 px; scale proportionally for larger sprites (about 10-20% on landing squash, 10% on stretch). Preserve volume: wider when shorter.
- **On twos:** Drawing on twos means each pose is held for two display frames; on a 60 fps game this equals 30 fps of poses, but sprite animation at 10-15 fps (every 4-6 game frames) is the common feel for this era *(craft knowledge, unverified)*.
- **Celebrate/pickup:** Anticipation (crouch, 80-120 ms), pop up with stretch, hold pose with arms up (400-600 ms), settle.

### 5. Effects *(craft knowledge, unverified except where stated)*
- **Collectible sparkle:** 4-point star twinkle cycling 4 frames at 100-150 ms, 2-4 stars per item, staggered phases.
- **Pickup burst:** 8-12 particles radiating over 300-500 ms, easing out, ending with a quick scale-down.
- **Confetti:** 30-60 rectangles 4-8 px, saturated palette colours, gravity plus horizontal flutter via rotating width.
- **Snow layers:** 2-3 layers: far (1-2 px, slow 20-40 px/s), mid (2-3 px), near (4-6 px, fast 80-120 px/s, partially blurred or low alpha); sinusoidal drift with different phases per flake.
- **Chest/present:** 2-3 anticipation shakes (about 2-3 px rotation or offset, 80 ms each), pause, lid burst with stretch, light rays or sparkle fan.
- **Shake/bounce:** UI bounces use overshoot to 110% then settle; screen shake 2-4 px for 150-250 ms, rarely used for kids.

### 6. UI *(craft knowledge, unverified)*
- Chunky beveled buttons: 2-3 px light bevel on top-left, dark on bottom-right, large icon plus short label; pressed state shifts 2 px down and flips the bevel.
- Frames: wood, stone or ice themed to the location. Panels have inner/outer double border.
- HUD: bottom bar about 60-80 px tall (12-17% of 480) with inventory slots, counters, and a hint/helper icon. Counters in big rounded display fonts with a dark outline and 2 px offset drop shadow.
- Dialog: speech bubble or portrait panel at the bottom or top, big text (24 px or more at 640x480), no more than 2 lines.

### 7. Framing
- 4:3 composition: horizon or main ground line in the lower third to lower 40% (y of roughly 300-340 of 480); sky and distant peaks fill the upper half; interactable objects sit on the ground band with room above for sparkles.
- Character about 15% of screen height keeps room for scenery; close-up moments (dialog) can use a larger portrait.

## Translatable rules

1. Canvas 640x480; design at native size and scale up by integers only; keep layout inside a 16 px safe margin.
2. Shared palette of about 64-96 hand-chosen colours organised as 8-10 hue ramps of 5-7 steps; no colour outside a ramp.
3. Ramp steps shift hue 10-20 degrees each: shadows toward blue-violet, highlights toward warm yellow.
4. Snow shadow colour: blue-violet (around hue 250-270, saturation 30-45%); snow light: warm cream (not pure white); ice: cyan.
5. Background layers, back to front: sky gradient, far peaks, mid ridge, near slope, ground strip, foreground framing; each farther layer is lighter, bluer and lower contrast.
6. Parallax factors: sky 0.1, far peaks 0.2, mid ridge 0.4, near slope 0.7, play layer 1.0, foreground 1.3. Allow static single-screen backdrops.
7. Sky and big gradients use 6-10 visible bands, optional 2 px ordered-dither on band edges.
8. Interactables use warm saturated accents (red, orange, yellow, magenta) with saturation at least 20% above anything in the background.
9. Outline thickness 2 px on a 64-90 px hero (about 2-3% of sprite height), 1 px for sprites under 32 px; colour is a dark ramp tone, never pure black.
10. Shading is 3 tones plus a highlight; light from the upper left; highlights placed on top-left planes and eye catchlights.
11. Head height is 35-50% of total character height; eyes at least 25% of head width each.
12. Idle: 4 frames, 300-500 ms per phase, with a 2-frame blink (80-120 ms) every 3-5 s.
13. Walk: 6 frames at 100-130 ms per frame (about 8-10 fps); draw on twos at 60 fps game.
14. Jump: anticipation (1 frame, 120-160 ms), rise (1-2 frames), apex (1 frame), fall (1 frame), land squash (1-2 frames, 80-100 ms); landing squash 10-20% height.
15. Pickup celebrate: 3-5 frames with a hold of 400-600 ms at the high pose.
16. Sprite animation steps at 10-15 fps while the game loop runs 60 fps; use holds, not extra frames, to adjust timing.
17. Sparkles: 4-frame twinkle at 100-150 ms with staggered phases; pickup burst 8-12 particles over 300-500 ms.
18. Snow particles: 3 layers (1-2 px slow, 2-3 px medium, 4-6 px fast), sinusoidal drift, with total count 60-120.
19. Chest/present opening: 2-3 shakes of 80 ms, then 100-200 ms pause, then burst.
20. UI: 2-3 px bevel, bottom HUD 60-80 px, display font 24 px or more with 2 px outline and 2 px drop shadow; buttons at least 48 px tall for kids.

## Originality guardrails

**Generic era conventions (fine):** painted gradient skies, layered mountain silhouettes, blue-violet snow shadows, warm accent colours on pickups, dark-coloured outlines, big-head/big-eye characters, 4-8 frame walk cycles, beveled wood/ice UI frames, bottom HUD with counters, sparkle stars, confetti, 4:3 framing.

**Too close to a specific title (avoid):** any recognisable character design, mascot silhouette or costume, or one title's exact colour scheme and logo treatment; a copied HUD layout (exact inventory shape, icon set, font) or a recognisable level composition and backdrop; reproducing a specific game's animation quirks (signature pickup cry, idle gag); and naming or mimicking cast, location or item names. Use our own character shapes, our own palette ramps, and our own UI shapes. Do not trace or reference-match screenshots.

## Sources
- https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation (read: idle/run frame counts, 80 ms vs 160 ms timings)
- https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html (read: scroll factor example 0.1-0.7)
- https://pixelparmesan.com/dithering-for-pixel-artists (read: dithering limits, steps vs contrast)
- https://www.adventuregamestudio.co.uk/forums/index.php?msg=239002 (search summary only: VGA workflow forum discussion)
- https://www.sprite-ai.art/blog/sprite-animation-frames (search summary only: frame count ranges)
- https://lospec.com/articles/pixel-art-outlines-part-2-using-color (search summary only: selective outlining)
- https://tinywarriorgames.com/2018/12/21/game-development-pixel-art-hue-shifting (search summary only: hue shifting)
- https://theartistsroad.net/articles/winterpleinairpastel (search summary only: snow shadow colour)
- https://kemstudios.blogspot.com/2017/12/painting-shadows-on-snow-in-winter.html (search summary only: snow shadows)


## Part 3 â€” Grade 1â€“4 math scope and a 12-level ladder

Basis: Common Core State Standards for Mathematics (grade introductions and the OA, NBT, MD domains on thecorestandards.org). Number ranges marked "(design)" are our own pacing choices inside the standard's limits.

### Scope by grade (start / middle / end)

**Grade 1**
- Counting and number sense: start counts to 20 and compares within 20. Middle counts to 100 by 1s and 10s. End counts to 120 and reads or writes numerals to 120. Place value is tens and ones; 11â€“19 is "a ten and some ones"; compare two-digit numbers with >, <, =.
- Add/subtract: start â‰¤10, middle â‰¤20 (make-ten, count on, fact families), end adds within 100 (two-digit plus one-digit or a multiple of ten, no regrouping needed) and subtracts multiples of 10.
- Time: hour and half hour.
- Fractions: halves and fourths of shapes (geometry only).
- Word problems: one-step add/sub within 20, three addends with sum â‰¤20, unknown in any position.
- Multiplication, division, money: not yet taught.

**Grade 2**
- Number sense: hundreds. Skip count by 5s, 10s and 100s. Numbers to 1000, expanded form, compare three-digit numbers.
- Add/subtract: start fluent within 20 (mental) and within 100 (strategies); middle within 100 with regrouping; end within 1000 (with and without regrouping), plus mentally +/-10 and +/-100.
- Multiplication foundation: even/odd, arrays up to 5 rows by 5 columns, repeated addition. Equal groups are a precursor only.
- Fractions: halves, thirds, fourths of shapes ("a third of").
- Time: nearest 5 minutes, a.m./p.m.
- Money: pennies, nickels, dimes, quarters, dollar bills; word problems using $ and Â¢.
- Word problems: one- and two-step within 100.

**Grade 3**
- Number sense: round to nearest 10 or 100. Place value is stable to 1000.
- Add/subtract: fluent within 1000.
- Multiplication: meaning of equal groups and arrays; fluent facts Ã—0â€“10 (products â‰¤100) by end of year; one-digit Ã— multiples of 10 (e.g. 7 Ã— 40).
- Division: related to multiplication (unknown factor); facts within 100; sharing versus grouping.
- Fractions: unit fractions, fractions on a number line, equivalence of simple fractions (e.g. 1/2 = 2/4), compare with the same numerator or denominator. Denominators are 2, 3, 4, 6, 8.
- Time: nearest minute, elapsed time in minutes.
- Money: not a separate standard; reinforced in word problems (our design: dollar/cents sums).
- Word problems: one-step Ã—/Ã· within 100; two-step using all four operations.

**Grade 4**
- Number sense: whole numbers to 1,000,000, place value (each place is 10Ã— the one to its right), compare, round to any place.
- Add/subtract: fluent multi-digit with the standard algorithm, to 1,000,000.
- Multiplication: up to 4-digit Ã— 1-digit, 2-digit Ã— 2-digit.
- Division: up to 4-digit Ã· 1-digit with remainders (interpret the remainder in context).
- Fractions: equivalent fractions, compare unlike fractions (benchmark 1/2 or common denominators), add/subtract like denominators including mixed numbers, whole number Ã— fraction, tenths/hundredths as decimals. Denominators are 2, 3, 4, 5, 6, 8, 10, 12, 100.
- Time and money: convert units of time; money as decimals ($ and Â¢), making change and multi-step dollar-and-cents problems.
- Word problems: multi-step with all four operations, remainders, multiplicative comparison ("3 times as many").

### 12-level difficulty ladder

| Lvl | Counting / number sense | Add & subtract | Multiplication | Division | Fractions | Time | Money | Word problems |
|---|---|---|---|---|---|---|---|---|
| 1 (G1 start) | count/compare to 20; count on | aÂ±b, â‰¤10 | â€” | â€” | â€” | â€” | â€” | picture one-step, â‰¤10 |
| 2 (G1 mid) | to 100 by 1s/10s; tens and ones | aÂ±b â‰¤20, make-ten | â€” | â€” | halves of shapes | hour | â€” | one-step â‰¤20, any unknown |
| 3 (G1 end) | to 120; compare 2-digit | two-digit Â± one-digit/ten, â‰¤100 (no regroup) | â€” | â€” | halves/fourths of shapes | half hour | â€” | one-step â‰¤20; 3 addends â‰¤20 |
| 4 (G2 start) | 3-digit place value; skip count 5s/10s | â‰¤100 mixed, no regroup | even/odd; arrays â‰¤2Ã—5 | â€” | halves/thirds/fourths of shapes | 5 min | pennies, dimes (to 50Â¢) | one-step â‰¤100 |
| 5 (G2 mid) | to 1000; skip count 100s | â‰¤100 with regroup | arrays â‰¤5Ã—5, repeated add | â€” | name equal shares | 5 min, a.m./p.m. | all coins, total â‰¤$1 | two-step â‰¤100 |
| 6 (G2 end) | compare/order 3-digit | â‰¤1000, regroup, Â±10/Â±100 | equal groups Ã—2, Ã—5, Ã—10 | share equally â‰¤20 (intro) | â€” | 5 min, quarter/half past | $ and Â¢ mixed, â‰¤$5 | two-step â‰¤100, any structure |
| 7 (G3 start) | round to 10/100 | â‰¤1000 fluent | Ã—2, Ã—3, Ã—4, Ã—5, Ã—10 | Ã· same facts; share/group | unit fractions 1/2â€“1/8 | nearest minute | dollars and cents, total â‰¤$10 | Ã—/Ã· one-step, facts â‰¤5 |
| 8 (G3 mid) | place value to 1000 | â‰¤1000, mental Â±10/100 | Ã—0â€“10 with 6, 7, 8, 9; unknown factor | Ã· facts â‰¤50 | fractions on number line; 1/2 = 2/4 | elapsed time â‰¤60 min | change from $5/$10 | Ã—/Ã· one-step, facts to 10 |
| 9 (G3 end) | multiples of 10; round | â‰¤1000 in two-step | Ã—0â€“10 fluent mixed; 1-digit Ã— 10s | Ã· facts â‰¤100 mixed | compare (same numerator/denominator); equivalence â‰¤8ths | elapsed time across hours | change and price totals â‰¤$20 | two-step, four operations |
| 10 (G4 start) | to 10,000 / 100,000 place value; round any place | multi-digit Â± to 100,000 | 2â€“4-digit Ã— 1-digit | 2â€“3-digit Ã· 1-digit, no remainder | equivalent fractions; compare via benchmark | units of time, elapsed incl. h:min | decimal $, change, multi-item totals | multi-step, Ã—/Ã· comparison ("3 times as many") |
| 11 (G4 mid) | to 1,000,000; compare | Â±, up to 6-digit | 2-digit Ã— 2-digit | 3â€“4-digit Ã· 1-digit, remainders | add/subtract like denominators â‰¤12ths | convert hr/min/sec | change, discounts, â‰¤$100 | multi-step with remainders |
| 12 (G4 end) | to 1,000,000; read/write | multi-step Â±, to 1,000,000 | 4-digit Ã— 1-digit; 2Ã—2-digit mixed | 4-digit Ã· 1-digit with remainder | mixed numbers, Ã—whole number; tenths/hundredths | elapsed time mixed units | decimal-money multi-step | multi-step four-operation, interpret remainder |

Levels 7â€“12 emphasise multiplication and division as the main progression; at 10â€“12 keep one fact-fluency item per session so earlier skills stay warm (spiral review).

### Default starting levels
- "1st grade" starts at Level 1.
- "2nd grade" starts at Level 4.
- "3rd grade" starts at Level 7.
- "4th grade" starts at Level 10.

Adaptive suggestion: place the child with 6â€“8 warm-up questions across strands; promote after about 4 of 5 correct and demote after 2 misses in a row, tracking each strand separately (a child can be at Level 8 in multiplication but 6 in time).

### Pedagogy notes
- Counting and number sense: off-by-one answers (n-1, n+1), counting the starting number, and tens/ones swaps (35 vs 53). Use as distractors. Hint: number line, ten-frames, "start at 7, hop 3 more".
- Add/subtract: forgetting to regroup/carry or borrow, subtracting smaller from larger digit in each column (52 âˆ’ 38 gives 26 instead of 14), and adding instead of subtracting in "how many left". Hint: make a ten first, then place-value blocks, "friendly numbers" (round up, adjust).
- Multiplication: confusing Ã— with +, 6Ã—7 = 48 style neighbouring-fact errors (Â±one group), and dropping a zero in multi-digit. Hint: arrays and equal groups, skip counting, "Ã—9 trick", break 7 Ã— 8 into 5Ã—8 + 2Ã—8, area model for 2Ã—2-digit.
- Division: reversing divisor and dividend, ignoring the remainder or making it greater than the divisor, and treating division as subtraction one time only. Hint: "how many groups of 4 in 24?", check by multiplying back, a remainder must be smaller than the divisor.
- Fractions: adding numerators AND denominators (1/4 + 2/4 = 3/8), thinking bigger denominator means bigger fraction (1/8 > 1/4), unequal parts counted as equal. Hint: fraction strips, number line, "same-size pieces" check, compare with 1/2.
- Time: confusing hour and minute hands, reading 5-minute marks as 1 (the "3" is 15, not 3), crossing the hour in elapsed time, a.m./p.m. mix-ups. Hint: analog clock with labelled minute numbers, number-line of elapsed time, jump to the next hour first.
- Money: counting all coins as 1Â¢ each, quarter vs dime size/value ("bigger coin is worth more"), losing the decimal in change. Hint: count the biggest coins first, skip counting 25s/10s/5s, "count up" from the price to make change.
- Word problems: key-word traps ("more", "left"), operating on the wrong numbers, and unanswered second step. Hint: draw or show a bar model, restate the question, read aloud with a prompt "what do we know / what do we find?", answer-check with estimate.

### Sources
- https://www.thecorestandards.org/Math/Content/1/OA/
- https://www.thecorestandards.org/Math/Content/1/introduction/
- https://www.thecorestandards.org/Math/Content/2/introduction/
- https://www.thecorestandards.org/Math/Content/2/MD/
- https://www.thecorestandards.org/Math/Content/3/introduction/
- https://www.thecorestandards.org/Math/Content/3/MD/
- https://www.thecorestandards.org/Math/Content/4/introduction/
- https://www.thecorestandards.org/Math/Content/4/NBT/

