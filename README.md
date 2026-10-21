# Pop Rush

Pop bricks to keep the fuse lit. Every pop buys you time, big pops fill the Rush bar, and a full bar turns the board
into a x3 fever. Stages get faster, the goals get bigger, and the best runs earn Coins for **chests** full of skins
for your bricks, your pops, your board and your fuse.

**Play:** open `index.html` in any modern browser. No build step, no dependencies, works offline from `file://`.
Serve the folder as-is (for example GitHub Pages) and it also installs as an app on phones (manifest + service worker).
`python3 tools/bundle.py out.html` produces a single self-contained file.

## How to play
- **Tap** a group of 2+ touching same-color bricks. On touch, press to preview (it shows the points and the seconds
  you will gain), release to pop, slide away to cancel.
- **The fuse** burns down all the time. Every pop adds seconds: bigger pops add more, a Line Blast adds 5. When the fuse
  reaches the bomb the run ends. The fuse burns faster every stage.
- **Stages** have a score goal. Clear it and the fuse refills, the score multiplier goes up and a new color joins.
- **Rush Mode**: pops of 4+ fill the Rush bar. When it is full the fuse freezes for 8 seconds and every pop scores x3.
- **Fuse bricks** (from stage 4) count down. Pop them in a group to defuse them for +3 seconds, or they burst and cost 5.
- **Power-ups** are earned by charging the bar with big pops: **Hammer** (3x3), **Beam** (a row and a column) and
  **Prism** (every brick of one color).
- Modes: **Rush** (the main run), **Daily Rush** (one seeded board a day) and **Chill** (the relaxed 20-move rounds).

## Coins, chests and Skins
- Runs pay **Coins** and **XP**. Missions, trophies and the 30-tier **Rush Pass** pay more.
- Spend Coins in the Shop on one of four chests. Each chest holds one kind of item, and the odds are shown on the chest.

| Chest | Cost | Holds | What it changes |
|---|---|---|---|
| Brick Chest | 300 | **Skins** | how every brick looks |
| Pop Chest | 250 | **Pops** | the effect and sound of every pop |
| Board Chest | 400 | **Boards** | the frame and scene behind your bricks |
| Fuse Chest | 250 | **Fuses** | your fuse, your bomb and Rush Mode |
| Golden Chest | earned | any one type | Epic or better, guaranteed |

- Open a chest by **holding** it. The ring fills, the chest shakes harder, then it bursts and the reel spins.
  Brick and Fuse chests spin sideways, Pop and Board chests spin up and down.
- Rarity: Common 60% · Rare 25% · Epic 10% · Legendary 4% · Mythic 1%. Each drop also rolls a **Shine**
  (Plain, Glossy, Holo, Prism) and a 10% chance of a **Counter** that tracks a stat while it is equipped.
- Duplicates can be **sold** for Coins, or five items of one rarity can be **traded up** into one of the next rarity.
- Cosmetics never change scoring. Run Boosts (Long Fuse, Head Start, Double Coins) are bought with Coins and last one run.

## Layout
```
index.html          screens + layers
sw.js               offline cache (service worker)
manifest.webmanifest, icons/   install as an app
css/base.css        design tokens, buttons, sheets, tab bar
css/screens.css     Home, Shop, Collection, Missions, Profile
css/run.css         the run screen: fuse, board, Rush, results
css/chest.css       chest stage, hold ring, reel, reveals
css/skins.css       Skins, Boards, Fuses, previews
js/rng.js board.js config.js boosters.js items.js chests.js engine.js storage.js pass.js progress.js missions.js
                    pure logic, runs in Node (tests use it)
js/audio.js music.js fx.js    synthesized sound and music, canvas particles, fireworks
js/skins.js         applies the loadout, previews, signature moments
js/view.js          board renderer and board animations (WAAPI)
js/ui.js            router, sheets, toasts, haptics
js/chestart.js      chest artwork (SVG)
js/spin.js          reel physics (solved landing) and the reel strip
js/openings.js      hold to open, bursts, spin, rarity reveals
js/screens.js       the five tab screens and the odds panel
js/run.js           the run controller (HUD, input, Rush, stages, results)
js/main.js          boot and settings
tools/bundle.py     single-file bundle
tests/              logic, balance bots, spin physics, Playwright UI tests
```

## Tests
```
node tests/logic.js     # items, odds, Coins, XP, pass, chests, Trade-up, trophies, missions, v2 migration (no browser)
node tests/sim.js       # time-stepped bots: pacing, stage speed and Rush balance (no browser)
node tests/spin.js      # 1,000 reel landings land exactly on the winning card (no browser)
node tests/stress.js    # a bot plays the real UI (Rush, Chill, Daily, pause, End Run); DOM must equal engine state
node tests/flow.js      # every chest opens end to end, equip, sell, back out, reduced motion, Trade-up
node tests/moments.js   # every signature moment plays without errors
node tests/gallery.js <dir> [type]   # screenshots every skin, board and fuse for review
```
UI tests use Playwright's Chromium (paths in `tests/lib.js`). Progress is stored in `localStorage` under
`poprush.v3`; an Update 1 (Shardfall) save is migrated on first launch (Shards become Coins, items keep their ids).
