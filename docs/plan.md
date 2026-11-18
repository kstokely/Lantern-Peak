# Lantern Peak — phased plan

Status key: [ ] not started, [x] done and checked.

## Phase 0 — groundwork
- [x] Research (docs/research.md)
- [x] Style guide, design, plan
- [x] Project skeleton (Vite + TypeScript + Phaser 3 + Vitest) and shared contracts (src/types.ts, src/art/keys.ts)

## Phase 1 — playable zone 1, end to end
- [x] Math engine: 12 levels x 8 strands; 50 unit tests re-solve 28,800 generated problems
- [x] Adaptive difficulty + profiles + save
- [x] Code-drawn art: Juniper, gems, presents, lantern, sled, gate, friends, Bluster, 5 zones of parallax, UI kit, manipulatives
- [x] World scene: walk/hop, tap-to-move, pickups, HUD, snow, delivery at the sled
- [x] Frost Lock + Ice Bridge mini games
- [x] Audio manager, mute toggle, 32 ElevenLabs clips (15 reused, 17 new)
- [x] Browser check of zone 1 (profile, gem, present, save across reload, level up and down, delivery)

## Phase 2 — the rest of the mountain
- [x] Gem Sort, Coin Shop, Clock Tower, Pie Share, Trail Friend mini games
- [x] World fixes: pickups only when landed, drop through ledges, hint button, zone intro lines, Bluster in every zone
- [x] Zones 2–5 layouts, map screen with trophy shelf, summit finale

## Phase 3 — check and ship
- [x] Art polish pass (Juniper jump frames, Marlow, gate, crate, place-value gems)
- [x] Math tests green; full browser play-through of all 5 zones and all 7 mini games
- [x] Fix findings; static build; published as a Claude artifact
- [ ] Play-test inside the artifact frame and on a real touch device

## Phase 4 — expansion (v2: store, Flurries, tools, areas)
- [x] Save v2: gem purse, tools, cocoa (max 3), hats + worn hat, 10 Flurries, per camp 6 presents over 3 areas, loose-gem pickup times (10 min respawn), broken ice walls; v1 saves migrate (old 4 presents -> slots 0-3, lit camps stay lit, purse credited 5 per frost gem + 20 per lit camp); tests/save.test.ts (11 tests, in-memory storage)
- [x] Economy in session.ts: loose 1, frost 5, +2 per first-try round, +10 Flurry, +20 camp lit; earn / spend / canAfford; store stock by lit camps (src/core/store.ts)
- [x] Three areas per camp, data-driven in scenes/zones.ts (Trail + 2 side areas, 2 presents each, 2 frost gems each, loose-gem lines and arcs, hidden gems, Flurry spawns, doorways); every mini game used, Snow Scale in 5 side areas
- [x] Doorway gates: high (Spring Hooves, isolated 280 px ledge), ice (Ice Chisel, crack animation, stays broken), dark (Glow Lantern, darkness overlay follows Juniper); lock badge + tool icon + Juniper's voiced line when locked
- [x] Swift Scarf (faster walk), Gem Magnet (260 px pull), Glow Lantern reveals hidden loose gems
- [x] Flurries: wander, dart away, bell button in the HUD (Chime Bell; Silver Bell = farther), 1-round Frost Lock, happy hop, +10, Lodge album, befriended ones play by the stall
- [x] Marlow's Trading Post scene (from the stall and the Map): cards, tabs, confirm-then-buy, "you need N more" with the subtraction, cocoa count, hats wear/unwear; Juniper wears the hat in the world
- [x] Flurry Lodge scene: album, frost gems and gold stars per camp, hats
- [x] HUD pack bar (purse, cocoa, tools, bell) + 6 lantern slots with the 4-lights-the-camp marker; Map: lanterns/6, gold star, Trail Map dots, Store and Lodge buttons
- [x] Cocoa Flask button in mini games (base.ts hook): free hint, not a miss
- [x] v2 sfx and voice lines wired (bell, buy, ice_crack, flurry, loose_gem rate-limited, door; v_need_*, v_flurry_*, v_area, v_camp4, v_star, v_cocoa, v_bought, m_welcome, m_thanks, m_need_gems)
- [x] Debug API: gotoArea, giveGems, giveTool, touchFlurry, touchDoor, ringBell, openStore, state() with purse/tools/area/flurries
- [x] Integration pass (real art everywhere): side-area backgrounds via ensureZoneArt/releaseZoneArt (one area's textures in memory at a time), Flurry album silhouettes, hats on Juniper by juniperHatAnchor in the World and the shop (updates the moment a hat is bought or worn), Lodge trophies laid out on LODGE_SHELVES, loose-gem and bell animations from ANIM2 keys; no placeholder texture is created at runtime (`__LP.debug.placeholders()` stays [])
- [x] QA pass over all 15 areas (tap navigation reaches every frost gem and present; every present opens its own mini game; all 8 mini games appear), gates (high / ice / dark, before and after the tool), tools (Swift Scarf 336 -> 450 px/s, Gem Magnet pulls from 230 px, Glow Lantern reveals hidden gems live), store (every tab, insufficient-gems dialog, hats), Lodge, Map, persistence (reload, v1 migration, mute), phone-landscape size, finale
- [x] Fixes from the QA pass: Snow Scale beam no longer shows the answer before Check, 36 px+ numbers at level 10+, money pad shows cents answers as "7¢", Flurries stay out of doorways and cannot steal a door/present/gem tap (input topOnly off), Marlow's bubble sits under the cards, first visit line saved in the profile (zone.seen), 10 distinct side-area layouts (tests/zones.test.ts checks reachability), Map label, thousands separators in choices and typed answers, sensible add/sub distractors, mini-game taps no longer lost to a 1-px mouse wiggle (drag threshold), tap-to-walk with the Spring Hooves no longer overshoots the stepping ledge
- [ ] Play-test the expansion with a child; tune prices and loose-gem density

## Phase 5 — hidden Dad mode
- [x] Type "Dad" on the New player screen to reveal a Dad grade; Dad Lab replaces every mini game with radar / software-engineering questions (60+ topics over 6 tiers, unbounded level, decimal pad with tolerance); tests/dad.test.ts (17 tests, independent solver, levels 1-30 x 300 seeds); browser-checked

## Known issues / judgment calls (not changed)
- The Store/Map buttons and dialog buttons can ignore a click that arrives within about 0.3 s of the scene or dialog opening (animation); a second click works. Seen only with automated clicks.
- Portrait phones: the game stays landscape and letterboxes to about a third of the screen height (text roughly 11-13 px); landscape phones are fine.
- The single "ones" gem in Gem Sort is small; pie slices are narrow tap targets at 9+ pieces.
- Locked-zone labels on the Map are low contrast.
- Store purse number does not live-update if gems change while the shop is open (only on tab change); cannot happen in normal play.
- An "implausible" add/sub choice can still be 10 away from a small answer (8 + 3 may offer 21); the rule is within max(12, half the answer).
- The darkness overlay is nearly (not fully) opaque so far gems are faintly visible; deliberate art choice.
- Frost Lock is still the silent fallback if a mini game scene is ever missing from the registry (none is today).

## Phase 6 — heroes, followers, camp music
- [x] Music by camp: audio.setMusic(place) (menu, shop, camp1..camp5), long tracks streamed through HTMLAudioElements into the music bus (never decoded; one element, two during the 1.5 s crossfade), place -> music.mp3 -> synth fallback, no restart when the place is unchanged; pure playlist logic in core/musicPlaylist.ts (second parts music_<place>b supported but not probed by default)
- [x] Wiring: Title/Profiles/Map/Lodge/Wardrobe = menu, Store = shop (camp music returns when the shop overlay closes), World = camp(zone+1) for all three areas, Finale = camp5
- [x] Flurry follower: save field, picked in the Lodge (tap a friend: Follow me / Stay here) and the Wardrobe; trails by position history, hops with the hero, happy pose on present / frost gem / camp lit, heart marker, not duplicated as stall decoration
- [x] Playable heroes: Pip / Marlow / Odette (2 presents of their mini game) and Bluster (Summit lit or finale) unlock by derivation from the saved present flags + ZONE_PRESENTS; unlock toast once (saved); Wardrobe scene (hero cards, accent colour, hats, follower, live preview); hero used in the World, Ice Bridge, Dad Lab, Store counter, Finale, Map, profile card; Juniper trots along as the guide when she is not the hero; core/heroArt.ts adapter with a tinted-Juniper fallback until the real hero sheets exist
- [x] Debug: __LP.debug.setHero / unlockAllHeroes / setFollower / setMusic / musicState, state() reports hero, unlockedHeroes, follower, music
- [x] tests/heroes.test.ts (unlock derivation, Dad mode, save sanitising, music playlist logic)
- [ ] Play-test the Wardrobe and followers with a child

## Phase 7 — platforming (design.md "v4")
- [x] Feel (core/physics.ts shared with the tests): full jump 960 px/s (rises 256 px; was 910/230), variable height (release = x0.45), coyote 120 ms (felt ~100 ms), jump buffer 120 ms, Spring Hooves 1110; Cloud Boots air jump with a puff; Feather Cape glide (fall capped at 150 px/s while jump held); ice inertia unless Grip Hooves; the HUD jump button / keys / debug input all hold
- [x] Pieces in src/scenes/world/: Terrain (ground with gaps + pit shaft and mist, solid rock blocks, ice strips, arrow signs, per-segment ground tile), Movers (cloud/log lifts with ease + pauses, crumbling ledges 0.9 s / regrow 3 s, tick-tock brass on a 1.6 s beat with 0.52 s blink, gear platforms, pendulums, aurora bridges 3.5 s solid incl. 0.9 s shimmer / 1.5 s gone, the helper cloud), Gusts (bounce pads 1250 / 1400 held, wind 2 s on / 2 s off with streaks, air-only push, 40% while walking, none standing), Checkpoints (light when passed, respawn, fall counter); pure timing in world/pieceLogic.ts; carried riding is resolved after the physics step (no slide, no jitter)
- [x] Falls: gap -> poof, float back to the last lit checkpoint (or entrance), 1.5 s grace; on climbs a fall from above a checkpoint to far below it floats back too; 3 falls in a stretch -> helper cloud at the stretch start ferries along a safe path ("Look, a helper cloud! Hop on!", v_helper)
- [x] Tall areas: per-area height (worldTop < 0), camera follows the surface stood on with look-up offset, mid/near layers sink with the climb (never a bottom gap), darkness/HUD/bubbles/hints adapt; sled and gate may stand high (camp 5)
- [x] Level design: camp 1 unchanged + 1 sign + 1 checkpoint; 12 new areas for camps 2-5 (camp 2 one screen, camps 3-4 two, camp 5 Trail a three-screen climb with the sled/gate on top); far-end exit doorways in most side areas; bonus stashes for Cloud Boots / Feather Cape
- [x] Store: Grip Hooves 90 (camp 2), Cloud Boots 130 (camp 3), Feather Cape 140 (camp 4) on the "More tools" tab; HUD pack bar squeezes up to 10 icons
- [x] Never stuck for gems: loose gems respawn 3 min after their saved pickup time (also on a 10 s timer in the area); Marlow's "Odd job: earn gems" at the stall and in the Trading Post (3 rounds, +2 per first try, +4 on finishing, unlimited, Dad Lab for Dad; m_oddjob / v_oddjob)
- [x] Tap-to-walk: hops rock steps, stops at gap edges; the hint points along the route (next checkpoint / sign)
- [x] Debug: listPieces, toCheckpoint, fall, hold, input (held-input sequences), oddJob, ageLoose; state() feetY, onGround, riding, checkpoint, fallsInStretch, helperCloud
- [x] Tests: tests/zones.test.ts physics-envelope reachability (simulated jumps over every surface, 78% for required items, 88% with the area's own tools, bonus with every tool, soft-lock check, no item in rock, a checkpoint before every gap, wait times, analyzer sanity cases); tests/platforming.test.ts (timers, crumble, helper trigger, store, odd jobs, loose respawn with save/load, purchase order, broke-child case)
- [ ] Play-test with a child, especially camps 4-5 (tick tower, pendulum, aurora timing)

Known issues (phase 7):
- The reachability model samples moving pieces at fixed positions and treats timed pieces as standable; real timing (crumble fuse, aurora/tick windows) is checked only by play.
- Riding companions hop onto lifts / gears / pendulums / the helper cloud beside the hero but simply follow the path on crumbles, ticks and auroras (they may float briefly when those vanish).
- A tap on a high target walks to the nearest planned hop; it does not ride lifts or bounce pads by itself.
- The camp 5 Trail is a long climb: the hint follows checkpoints and signs, not a full path search.
