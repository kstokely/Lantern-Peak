# Lantern Peak

An original 2D math adventure for kids in grades 1–4. Climb a snowy mountain
with Juniper the mountain goat, find presents, open them by solving math, and
light the lanterns at five camps on the way to the summit.

- Nine math mini games covering counting, addition, subtraction,
  multiplication, division, fractions, time, money and word problems
- Difficulty adapts per skill: it rises after a run of first-try answers and
  eases off after misses
- Player profiles saved in the browser, with a starting grade for each child
- A trading post with tools, friendly creatures to befriend, playable heroes
  and cosmetics
- Platforming that gets more involved the higher you climb, with no fail states
- Works with mouse, keyboard and touch

## Run it

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (normally http://localhost:5173).

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs the unit tests, including checks that every generated problem's answer is correct at every level |
| `npm run typecheck` | Type-checks the project |
| `npm run build` | Builds a static site into `dist/` that any web host can serve |
| `npm run preview` | Serves the built site locally |

## How it is made

TypeScript, [Phaser 3](https://phaser.io) and Vite. All of the art is drawn in
code at start-up (`src/art`), so there are no image files. Sound effects, voice
lines and music are in `public/audio`.

- [docs/design.md](docs/design.md) — game design
- [docs/style-guide.md](docs/style-guide.md) — art and UI rules
- [docs/research.md](docs/research.md) — genre and curriculum research
- [docs/plan.md](docs/plan.md) — build plan, status and known issues
