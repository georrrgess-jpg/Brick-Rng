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
  reaches the bomb the run ends. The fuse burns faster for the first eight stages and then stops speeding up, and from
  stage 6 a pop of 3+ always pays at least 1.4 seconds, so a long run is never lost to the clock alone.
- **Last Spark**: once per run, when the fuse hits zero you get 2.5 seconds to land a pop of 4+. Do it and the fuse comes back.
- **Score to beat**: your best score sits under the score all run, with a gap that closes as you play. Results tell you
  how close you came, and **Beat it** starts the next run.
- **Stages** have a score goal. Clear it and the fuse refills, the score multiplier goes up and a new color joins.
- **Rush Mode**: pops of 4+ fill the Rush bar. When it is full the fuse freezes for 8 seconds and every pop scores x3.
- **Fuse bricks** (from stage 4) count down. Pop them in a group to defuse them for +3 seconds, or they burst and cost 5.
- **Power-ups** are earned by charging the bar with big pops: **Hammer** (3x3), **Beam** (a row and a column) and
  **Prism** (every brick of one color).
- Modes: **Rush** (the main run), **Daily Rush** (one seeded board a day) and **Chill** (the relaxed 20-move rounds).

## Coins, chests and Skins
- Runs pay **Coins** and **XP**. Missions, trophies and the free 30-tier **Pop Pass** (a horizontal track with a spotlight
  on your next reward) pay more.
- Spend Coins in the Shop on one of four chests. Each chest holds one kind of item, and the odds are shown on the chest.
- **A chest never gives you an item you already own.** The odds are renormalised over what you have not found, every 8th
  chest of a type without an Epic or better guarantees one, and a finished set says Complete.

| Chest | Cost | Holds | What it changes |
|---|---|---|---|
| Brick Chest | 350 | **Skins** | how every brick looks |
| Pop Chest | 300 | **Pops** | the effect and sound of every pop |
| Board Chest | 450 | **Boards** | the frame and scene behind your bricks |
| Fuse Chest | 300 | **Fuses** | your fuse, your bomb and Rush Mode |
| Golden Chest | earned | any one type | Epic or better, guaranteed |

- Open a chest by **holding** it. The ring fills, the chest rattles and leaks light, then it bursts and the reel spins.
  Brick and Fuse chests spin sideways, Pop and Board chests spin up and down. Every item has a bright badge in its
  rarity color, so the reel is easy to read at speed.
- Rarity: Common 60% · Rare 25% · Epic 10% · Legendary 4% · Mythic 1% (Golden Chests: Epic 70%, Legendary 25%, Mythic 5%).
  Each drop also rolls a **Shine** (Plain, Glossy, Holo, Prism).
- There are 58 items. Series 3 "Carnival" adds 10 skins, 10 pops, 4 boards and 4 fuses.
- Cosmetics never change scoring. Run Boosts (Long Fuse 25, Head Start 15, Rush Start 20 Coins) are a purchase: the
  sheet before a run shows each price, the total and what you will have left, and nothing is charged until you press Start.
- Every menu shows a short **tip card** the first time you open it (Profile > Help shows them again).

## Layout
```
index.html          screens + layers
sw.js               offline cache (service worker)
manifest.webmanifest, icons/   install as an app
css/base.css        design tokens, buttons, sheets, tab bar
css/screens.css     Home, Shop, Collection, Missions, Profile
css/run.css         the run screen: fuse, board, Rush, results
css/chest.css       chest stage, chest parts and idle life, hold ring, reel, reveals
css/skins.css       Skins, Boards, Fuses, previews (Series 1 and 2)
css/s3-skins.css css/s3-scenes.css    Series 3 skins, boards and fuses
css/badges.css      item badges (rarity frame and art, the still version used in the reel)
css/coach.css       the first-time tip cards
js/rng.js board.js config.js boosters.js items.js chests.js engine.js storage.js pass.js progress.js missions.js
                    pure logic, runs in Node (tests use it)
js/audio.js music.js fx.js    synthesized sound and music, canvas particles, fireworks
js/skins.js         applies the loadout, previews, signature moments (Series 3 plugs in via handlers)
js/s3-skins.js s3-pops.js s3-scenes.js   Series 3 moments and pop recipes
js/badges.js        the item badge (used in the reel, Collection, Pass, reveals)
js/coach.js         first-time tip cards and the what's-new card
js/view.js          board renderer and board animations (WAAPI)
js/ui.js            router, sheets, toasts, haptics
js/chestart.js      chest artwork: each chest is a stack of parts so the rituals move them with plain transforms
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
node tests/logic.js     # items, live odds, no-duplicate drops, pity, completion, Coins, XP, pass, trophies, missions, v2/v3 migration
node tests/engine.js    # fuse rules: burn cap, pop floors, Last Spark, Boosts, reshuffle refund (no browser)
node tests/sim.js       # time-stepped bots: pacing, run length, Coin income and hours to complete the catalogue
node tests/spin.js      # 1,000 reel landings land exactly on the winning card (no browser)
node tests/stress.js    # a bot plays the real UI (Rush, Chill, Daily, pause, End Run); DOM must equal engine state
node tests/flow.js      # every chest opens end to end, equip, a finished set cannot be opened, back out, reduced motion
node tests/chests.js    # each chest's parts move on hold and burst (the fuse needle included); records a video and a frame sheet
node tests/spinperf.js  # frame time of the reel under a 4x CPU throttle
node tests/badgesheet.js <dir>   # every item as a badge, in every shine, for review
node tests/moments.js   # every signature moment plays without errors
node tests/gallery.js <dir> [type]   # screenshots every skin, board and fuse for review
```
UI tests use Playwright's Chromium (paths in `tests/lib.js`). Progress is stored in `localStorage` under
`poprush.v4`. Saves from earlier versions are migrated on first launch: Update 1 (Shardfall) Shards become Coins, and
Update 2 duplicates are collapsed to one copy and refunded in Coins.
