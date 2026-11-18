# Lantern Peak — style guide

Original look. Inspired by the general craft of mid-1990s 4:3 edutainment (painted backdrops, chunky outlined sprites), not by any one title. All art is drawn in code (Canvas 2D) into textures and sprite sheets at boot; nothing is downloaded.

## Canvas and framing
- Game canvas **1280 x 960** (a 640x480 design grid at 2x). All numbers below are in game pixels (1280x960).
- Ground line of the play layer sits around y 640–700. Bottom HUD bar is 120 px tall (y 840–960). Safe margin 32 px.
- Hero is about 150 px tall (~16% of screen). Collectibles 64–90 px. Touch targets at least 110 px.

## Palette (shared ramps; never pure black or pure white)
| Ramp | Dark → light |
|---|---|
| Ink / outline | `#1d1a3a` `#2e2a5c` |
| Night-violet (snow shadow) | `#3b3a7a` `#5b5fb0` `#8a92d8` `#b9c3f0` |
| Snow | `#c9d6f5` `#e6eeff` `#fff8ea` (lit snow is warm cream) |
| Ice cyan | `#1f7fa8` `#39b6d8` `#8fe6f2` `#d6fbff` |
| Pine | `#143d3a` `#1f6b52` `#3fa06a` `#8fd18a` |
| Rock | `#4a4368` `#6d6690` `#9a94b8` |
| Sky day | `#3a6fd8` `#6fa8f0` `#b6dcff` `#ffe9c9` |
| Sky dusk | `#2b2360` `#6a3d8f` `#d86a8a` `#ffb37a` |
| Lantern warm (interactables only) | `#b3261e` `#e8472b` `#ff8a1f` `#ffc93c` `#fff1a8` |
| Berry / magenta (interactables only) | `#8f1d6b` `#d83a9a` `#ff8fcf` |
| Goat cream | `#b89a7a` `#e9d6b8` `#fff6e3` |
| Wood (UI) | `#5a3320` `#8a5530` `#c58a4a` `#eec07a` |

Rules: scenery stays cool (violet, blue, cyan, pine). Warm lantern and berry ramps are reserved for things you can touch: presents, gems, lanterns, buttons, Juniper's scarf. Farther layers are lighter, bluer and lower contrast.

## Sprites
- Outline: 5 px on the hero, 4 px on props, 3 px on small items; colour `#1d1a3a` (ink), rounded joins. Lit top-left edges may use `#2e2a5c`.
- Shading: base + one cool shadow + one small warm highlight, light from upper left. Flat tones, no gradients on sprites.
- Proportions: head 40–45% of height, big eyes with a catchlight, short legs, round silhouettes.
- Soft elliptical ground shadow (`#3b3a7a`, 35% alpha) under every character and item.

## Animation (sprite frames step at 10–12 fps; game runs at 60)
| Clip | Frames | Timing |
|---|---|---|
| Idle | 4 | 320 ms each, blink every 3–5 s |
| Walk | 6 | 100 ms each |
| Jump | 4 (crouch, rise, apex, fall) + land squash | crouch held 120 ms; squash 15% |
| Cheer | 4 | high pose held 500 ms |
| Gem twinkle | 4 | 120 ms, staggered phases |
| Present | idle wobble 2 → shake 3x80 ms → 150 ms pause → burst | lid pops, ribbon flies, sparkle fan |

## Backgrounds and effects
- Layers and scroll factors: sky 0.0–0.1, far peaks 0.2, mid ridge 0.4, near pines 0.7, play layer 1.0, foreground drifts 1.25.
- Skies are banded gradients (8 bands), no smooth ramps.
- Snow: 3 particle layers (small slow, medium, large fast, low alpha), sine drift, about 90 flakes.
- Pickup burst: 10 star particles over 400 ms. Confetti: 50 pieces in lantern and berry colours.
- Screen shake is not used on wrong answers; the item gives a small "no" wobble instead.

## UI
- Wood-and-snow frames: panels are wood (`#8a5530`) with a 6 px ink outline, a 4 px light bevel on top-left, and a snow cap on top.
- Buttons: rounded 24 px corners, lantern-orange face, 6 px bottom "lip" that collapses when pressed.
- Font: a rounded system stack (`"Baloo 2", "Fredoka", "Nunito", "Trebuchet MS", "Verdana", sans-serif` — no web-font download; falls back to system fonts), white or cream with a 6 px ink stroke. Minimum text size 36 px; numbers in puzzles 56 px or more.
- HUD: bottom bar with lantern count, gem count, present slots for the zone, a Juniper hint button, and a mute toggle top-right.
