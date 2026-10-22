# Pop Rush

Pop bricks to keep the fuse lit. Every pop buys you time, big pops fill the Rush bar, and a full bar turns the board
into a x3 fever. Stages get faster, the goals get bigger, and the best runs earn Coins for **chests** full of skins
for your bricks, your pops, your board and your fuse.

**Play:** open `index.html` in any modern browser. No build step, no dependencies, works offline from `file://`.
Serve the folder as-is (for example GitHub Pages) and it also installs as an app on phones (manifest + service worker).
`python3 tools/bundle.py out.html` produces a single self-contained file.

## How to play
- **Tap** a group of 2+ touching same-color bricks. On touch, press to preview (it shows the points, the seconds you will gain
  and the combo), release to pop, slide away to cancel. On a keyboard the arrow keys move a cursor and Enter pops; P pauses,
  1 to 3 use power-ups, R plays again from the results.
- **The fuse** burns down all the time. Every pop adds seconds: bigger pops add more, a Line Blast adds 5. When the fuse
  reaches the bomb the run ends. The fuse burns 20% faster each stage for the first eight stages and then stops speeding up, and from
  stage 6 a pop of 3+ always pays at least 1.4 seconds, so a long run is never lost to the clock alone.
- **Last Spark**: once per run, when the fuse hits zero you get 2.5 seconds to land a pop of 4+. Do it and the fuse comes back.
- **Score to beat**: your best score sits under the score all run, with a gap that closes as you play. Results tell you
  how close you came, and **Beat it** starts the next run.
- **The board deals fairly.** New bricks are chosen by a tile director (`js/director.js`): they tend to join the big blocks
  already on the board, a pop of 4 or more is almost always on offer, the board is never just pairs, and every so often it
  sets up a big one. How much it helps follows the player: more when the fuse is low or a run has gone dry, less when they
  are cruising, and less past the stage they usually reach, so a new best is still earned. Daily gives everyone the same
  refills for the same taps.
- **Stages** have a score goal. Clear it and the fuse refills, the score multiplier goes up and a new color joins.
- **Rush Mode**: pops of 4+ fill the Rush bar. When it is full the fuse freezes for 8 seconds and every pop scores x3.
- **Fuse bricks** (from stage 4) count down. Pop them in a group to defuse them for +3 seconds, or they burst and cost 5.
- **Power-ups** are earned by big pops of 4+: the next empty slot fills as you play and shows its charge. **Hammer** (3x3),
  **Beam** (a row and a column) and **Prism** (every brick of one color).
- **The run screen** is labelled: *Stage 3 · score of goal · x4.5 points* (the real multiplier, Rush included), the fuse with
  its bomb Fizz, the Rush bar, the three power-up slots, and a message band under them for hints, the combo, the run goal and
  Last Spark, so nothing covers the board.
- **Run goal**: every Rush run shows one small goal ("Make a Line Blast"). Reaching it pays 10 to 20 Coins.
- **Daily streak**: finish a run each day to light the 7-day ring on Home. Day 3 pays 120 Coins; day 7 pays 200 Coins and a
  Golden Chest. One missed day a week is forgiven, and a broken week only restarts the ring (finished weeks stay).
- **Records** (Profile) keep your best score, stage, biggest pop and the last 20 Rush runs. **Try it** (item sheet) puts any
  item on a ten-second practice board without saving anything.
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
- Help is short: two cards (Welcome, whose button starts the first run, and the Pop Pass), a hint line on the first chest opening
  (it never covers the chest or the hold button) and a one-line banner with a close button on the other screens (Profile > Help
  shows them again). The first three runs start straight away; the Boosts sheet comes from run 4. After that the sheet remembers your
  last choice: Home shows a chip that starts the next run with the same Boosts in one tap, and a run started with no Boosts makes Play
  one tap too (the chip beside it opens the sheet).
- **Menus (Update 5)**: the status bar (level ring, title, a gear that opens Settings, Coins) lives outside the screens and never
  moves; tabs cross-fade with a short stagger; the Shop tab shows how many chests are waiting and the Missions tab a dot for new
  missions; Home puts the chests banner under the hero and opens a chest in one tap; an item is worn from the circle on its card.
  Sheets take keyboard focus, keep Tab inside, make the page behind inert and give focus back; on desktop and in landscape they are
  centred dialogs of at most 560px in two columns that fade where they scroll. Larger text is one type scale (`--ts`), not zoom.
  Colours mean one thing: green is free, gold spends Coins, red cannot be undone, hot pink is the one main action.

## Layout
```
index.html          screens + layers
sw.js               offline cache (service worker)
manifest.webmanifest, icons/   install as an app
css/base.css        design tokens, buttons, sheets, tab bar
css/screens.css     Home, Shop, Collection, Missions, Profile, the status bar pieces (all text sizes are `calc(Npx * var(--ts))`: run tools/typescale.py)
css/run.css         the run screen: fuse, board, Rush, results
css/chest.css       chest stage, chest parts and idle life, hold ring, reel, reveals
css/skins.css       Skins, Boards, previews (Series 1 and 2)
css/s3-skins.css css/s3-scenes.css    Series 3 skins and boards
css/fuse.css        the fuse: Fizz, rope, flame, readout, chips, the urgency states (every fuse cosmetic is drawn from tokens)
css/badges.css      item badges (rarity frame and art, the still version used in the reel)
css/coach.css       the first-time tip cards
js/rng.js board.js config.js boosters.js items.js chests.js director.js engine.js storage.js pass.js progress.js missions.js retention.js
                    pure logic, runs in Node (tests use it); retention.js is the streak, run goals, records and next goal
js/audio.js         every sound effect, synthesized: pentatonic pops, a quiet low-passed SFX bus, loudness-tested
js/music.js         adaptive soundtrack: menu and run arrangements that crossfade on bar lines, stems that join per stage,
                    a tense low-fuse layer, a Rush key lift, ducking under big moments, no repeat within 10 minutes
js/fx.js            canvas particles, fireworks
js/skins.js         applies the loadout, previews, signature moments (Series 3 plugs in via handlers)
js/s3-skins.js s3-pops.js s3-scenes.js   Series 3 moments and pop recipes
js/fuse-art.js      the 11 fuse cosmetics as data (rope textures, flame, ember, particles, bomb body, face style, frost tint)
js/fuse.js          the shared fuse engine, BR.Fuse: rope, burning end, readout, time chips, urgency ramp, one small particle canvas
js/badges.js        the item badge (used in the reel, Collection, Pass, reveals)
js/coach.js         first-time tip cards and the what's-new card
js/view.js          board renderer and board animations (WAAPI)
js/ui.js            router (cross-fading tabs, badges), sheets (focus, inert, fade edge), toasts, haptics
js/chestart.js      chest artwork: each chest is a stack of parts so the rituals move them with plain transforms
js/spin.js          reel physics (solved landing) and the reel strip
js/openings.js      hold to open, bursts, spin, rarity reveals
js/screens.js       the five tab screens, the status bar (BR.Chrome), Settings and the other sheets, the odds panel
js/run.js           the run controller (HUD, input, Rush, stages, results)
js/main.js          boot, settings, the self-tuning Graphics setting, the error guard, the splash
tools/bundle.py     single-file bundle
tests/              logic, balance bots, spin physics, Playwright UI tests
```

## Tests
```
node tests/logic.js     # items, live odds, no-duplicate drops, pity, completion, Coins, XP, pass, trophies, missions, v2/v3 migration
node tests/engine.js    # fuse rules: burn cap, pop floors, Last Spark, Boosts, reshuffle refund (no browser)
node tests/sim.js       # time-stepped bots: pacing, run length, Coin income and hours to complete the catalogue
node tests/balance.js   # Update 5 balance targets: stage, run length, Rush share, Last Spark, combos, season pace, missions, goals (no browser)
node tests/season.js    # Pop Pass season track, Fizz Hats ownership, trophy rewards (no browser)
node tests/all.js       # the whole suite in order; --node for the no-browser suites, --perf to include the performance budget
node tests/director.js  # the tile director: dry spells, pairs-only boards, big-pop rhythm, help under pressure, Daily fairness
node tests/spin.js      # 1,000 reel landings land exactly on the winning card (no browser)
node tests/stress.js    # a bot plays the real UI (Rush, Chill, Daily, pause, End Run); DOM must equal engine state
node tests/flow.js      # every chest opens end to end, equip, a finished set cannot be opened, back out, reduced motion
node tests/coach.js     # tip cards: once each, never in a run, replayable, what's-new for returning players
node tests/chests.js    # each chest's parts move on hold and burst (the fuse needle included); records a video and a frame sheet
node tests/spinperf.js  # frame time of the reel under a 4x CPU throttle
node tests/audio.js [--quick]   # offline renders: peaks, loudness, pitch, timbre, music structure, never-late scheduler (~4 min)
node tests/badgesheet.js <dir>   # every item as a badge, in every shine, for review
node tests/moments.js   # every signature moment plays without errors
node tests/fusesheet.js <dir> [--quick]   # every fuse in every state (sheets) and frame strips of the time-gain chip, Last Spark, Rush start and end, stage-up, a Fuse brick; fails on a wrong state or a filter on the fuse
node tests/fuseperf.js [--fast] [--root=<old checkout>]   # main-thread cost of the fuse per frame under a 4x CPU throttle (budget 1.5 ms on a phone)
node tests/gallery.js <dir> [type]   # screenshots every skin, board and fuse for review
node tests/perfbudget.js [quick]   # frame times under a 4x CPU throttle against budgets: every menu, scrolling, a sheet, a tab switch, a run, a pop, the reel, startup
node tests/visual.js    # regressions that were once seen: the logo, odds text, Pass numbering, the bomb after a fuse-out, the run HUD at four phone sizes
node tests/uiaudit.js [--list]   # every screen and sheet: text is 12px or larger, controls are 44px or larger
node tests/tryit.js     # Try it leaves the loadout, a saved run and the run counter alone
node tests/u4cosmetics.js   # the older boards, skins and pops after the Update 4 touch-up
node tests/keyframes.js # no @keyframes name is defined twice (the later file would silently replace the first)
node tests/u5-menus.js  # menus: focus in sheets, tab badges, the fixed status bar, keyboard reach, hero overflow, landscape Play, sheet widths, Larger text, Reduce Motion, toasts, swaps, Boosts memory, the Pass track
```
UI tests use Playwright's Chromium (paths in `tests/lib.js`). Progress is stored in `localStorage` under
`poprush.v4`. Saves from earlier versions are migrated on first launch: Update 1 (Shardfall) Shards become Coins, and
Update 2 duplicates are collapsed to one copy and refunded in Coins.
