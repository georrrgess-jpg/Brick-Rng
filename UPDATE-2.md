# Update 2 — "Pop Rush"

The schematic for the second major update. It gives the game a pulse (a burning fuse you keep alive by popping),
something to chase every day (missions, a free pass, chests you buy with Coins you earned), four separate chest
types with their own openings, a mobile-first UI rebuilt from scratch, and plain words everywhere.

---

## 1. What changes, in one screen

| Area | Today (Shardfall) | Update 2 |
|---|---|---|
| Name | Shardfall | **Pop Rush** |
| Core pressure | 20 moves per round, no clock | **The Fuse**: a burning timer only popping refills. Stages speed it up. |
| Big moments | Combos, Line Blast | **Rush Mode** (x3 fever), stage-ups, last-5-seconds flare, near-death saves |
| Long-term goal | Levels and Geodes | **Coins**, **Daily missions**, a free **Rush Pass**, Daily Rush, trophies |
| Crates | One Geode with every cosmetic | **Four chests**, one per cosmetic type, each bought with Coins or earned |
| Opening | Tap a rock three times | **Hold to open**, physics-driven spin, reveals that scale with rarity |
| Words | Facets, Bursts, Arenas, Geodes, Shards, Fusion, Trackers | Skins, Pops, Boards, Fuses, Chests, Coins, Trade-up, Counters |
| Pause menu | Resume, Restart, Settings, Quit | + **End Run** (banks your score and Coins, goes to results) |
| Platform | Desktop-first web page | **Mobile-first PWA**: installable, offline, haptics, safe areas, 60 fps budget |

---

## 2. Name

**Pop Rush.** You pop bricks, the fuse makes it a rush. The word carries the whole vocabulary:
Rush Mode (fever), Rush Pass (the free reward track), Daily Rush (the seeded daily run), Rush Meter.
Logo: "POP" as three bouncing bricks, "RUSH" in a slanted, speed-streaked wordmark.

Runners-up: **Popstorm**, **Brick Rush**.

---

## 3. Core loop: keep the fuse lit

The tap-a-group rule is unchanged. Everything around it now pushes.

**The Fuse** burns across the top of the board from right to left, ending at a bomb.
- It starts full (**30 seconds** of burn at stage 1). When it reaches the bomb, the run ends.
- Every pop adds time: `+1s`, plus `+0.4s` for each brick beyond the second (a 6-brick pop adds 2.6s). Line Blast
  adds +5s. The fuse can never exceed full, so burning time is wasted time: the player is pushed to keep popping.
- Pops under 4 bricks still count. Small pops keep you alive; big pops get you ahead. No pop is ever punished.

**Stages** keep the run climbing. A stage bar fills with score; when it fills:
- The fuse refills to full, the burn speed rises **12%**, and the score multiplier goes up by **+0.5x**
  (shown as a big "x2.5" tag on the HUD).
- A short stage wipe plays (board flashes, number slams in). Stages 3 and 6 add a new brick color.
- From stage 4, **Fuse bricks** appear now and then: a brick with a countdown (5). Each pop anywhere ticks it down;
  at 0 it bursts and burns 5 seconds off the fuse. Pop it (it joins any group of its color) to defuse it for +3s.
  Stage goals: `2,000 × 1.4^(stage-1)`.

**Rush Mode** is the payoff. The Rush Meter fills with consecutive pops of 4+ (same combo rule as today) and drains
slowly otherwise. Full meter → **8 seconds of Rush**: every pop is **x3**, the fuse freezes, bricks tint with the
equipped Fuse style, the music doubles tempo, every pop during Rush adds +0.5s to Rush. Then the meter resets.

**Tension beats**
- Fuse below 25%: the fuse glows orange and the heartbeat starts. Below 5 seconds: red flare, vignette pulse,
  screen edge sparks, "FUSE!" callout once.
- Popping 6+ bricks when the fuse is under 10% shows "SAVED!" and a white flash.
- Fuse out: the bomb pops, the board shatters outward, slow-motion for 0.6s, then results.

**Power-ups** (today's Boosters, renamed): Hammer, Beam, Prism. Still earned from the charge bar, still free to use.
New: using a power-up adds +2s fuse. Before a run, Coins can buy **Boosts** for that run only:
Long Fuse (+10s start, 150 Coins), Head Start (begin with one Hammer, 100), Double Coins (x2 Coins from the run, 200).

**Modes**
- **Rush** (default): endless, as above.
- **Daily Rush**: the same game on a seed shared by everyone that day, one attempt, x2 Coins, its own best-score
  card and a share image ("I reached stage 7 in today's Rush").
- **Chill**: no fuse, 20 moves per round (today's rules). Unlocked at level 3 so new players meet the Rush first.

Why this is entertaining: there is always a clock to beat, a stage to reach, a Rush to trigger, and a run-end that
is spectacular rather than quiet. Short runs (2–4 minutes) suit phones and make "one more go" natural.

---

## 4. Coins, missions, the Rush Pass

**Coins** are the one currency. No real money anywhere.
| Earned from | Coins |
|---|---|
| Score | 1 per 100 points |
| Each stage reached | 25 × stage |
| Daily Rush | x2 on the run |
| Daily mission (3 per day) | 60–120 each |
| Weekly mission | 400 + a Golden Chest |
| Duplicate item | Common 40 · Rare 100 · Epic 250 · Legendary 600 · Mythic 1,500 |
| Trophies (one-time) | 100–500 |

A decent run earns 300–600 Coins, so a chest every run or two early on, and the dearer chests take a few runs.
Coins are spent on chests, run Boosts, and one mission re-roll per day (50).

**Missions** (daily set of three, resets at local midnight; one weekly):
"Pop 40 blue bricks", "Reach stage 4", "Trigger Rush Mode twice in one run", "Pop a group of 10+", "Use 3 power-ups",
"Score 15,000 in Daily Rush", weekly: "Reach stage 8" or "Pop 2,000 bricks". Progress bars live on the Missions tab
and tick on the results screen.

**Rush Pass** (free, 30 tiers, one per level; a new pass every 6 weeks with a new item set):
Coins on most tiers, a chest of each type on tiers 5/10/15/20, an exclusive Epic at 25 and an exclusive
**Mythic** at 30 that only ever comes from the pass. The pass panel on the Home screen always shows the next reward
and the XP left to it, so there is always something close.

**Trophies**: one-time goals with Coins and a Profile badge: first Rush Mode, stage 5, stage 10, 100 pops of 8+,
every Common skin owned, a full chest type collected, and so on.

---

## 5. Chests: four types, four openings

Each cosmetic type has its own chest. A chest only ever contains its own type, and the odds on the chest are the odds.

| Chest | Contains | Cost | Look and opening ritual |
|---|---|---|---|
| **Brick Chest** | Skins (how bricks look) | 300 | A crate built from bricks. Hold to open: the bricks shake loose and burst apart. |
| **Pop Chest** | Pops (particles and sound of every pop) | 250 | A paper firework drum with a fuse. Hold to open: the fuse burns down and it bangs open. |
| **Board Chest** | Boards (frame, scene, Line Blast beam) | 400 | A flat treasure chest with a glass lid. Hold to open: the lid frosts, cracks, shatters. |
| **Fuse Chest** | Fuses (fuse look, bomb, Rush Mode theme) | 250 | A steel canister with a dial. Hold to open: the dial spins up, steam vents, the lid blows. |
| **Golden Chest** | Pick a type; Epic or better guaranteed | Weekly mission / pass only | Gold version of the chosen chest, with a drum roll. |

**Rarity**: Common 60% · Rare 25% · Epic 10% · Legendary 4% · Mythic 1% (Golden: Epic 70 · Legendary 25 · Mythic 5).
Every drop also rolls a **Shine** (Plain 55%, Glossy 30%, Holo 12%, Prism 3%) and a 10% chance of a **Counter**
(the item counts a stat while equipped). Skins keep a pattern seed.

**Duplicates** pay Coins (table above). **Trade-up**: 5 items of one rarity → 1 of the next, same chest type.

**Odds, made legible.** Every chest card and every opening screen shows the same panel:
- One stacked bar, left to right from Common to Mythic, each segment in its rarity color with the percentage
  inside the segment (or above it when the segment is thin).
- Under it, one row per rarity: color chip, name, "1 in 2 / 1 in 4 / 1 in 10 / 1 in 25 / 1 in 100", and the number
  of items of that rarity you still don't own from this chest.
- One plain sentence at the top: "Most Brick Chests give a Common skin. About 1 in 100 gives a Mythic."
- Tap "See everything inside" for the full item list grouped by rarity with owned ticks and a live preview.
No decimals, no weights, nothing hidden.

---

## 6. The opening and the spin (the showpiece)

One spin engine, four themed stages. Built on physics, not a CSS easing curve.

1. **Chest arrives.** It drops onto a themed pedestal; its type is obvious from the shape and color. The odds
   panel sits beneath it.
2. **Hold to open.** A ring fills around the thumb (1.2s). The chest shakes harder as the ring fills, seams glow,
   the sound rises in pitch, the phone pulses (haptics). Letting go early lets it settle back. At full ring: the
   chest-specific burst (bricks fly / firework bang / glass shatters / lid blows), a flash, and the strip slides in
   through the debris.
3. **The spin.** The strip moves with real velocity and friction: a launch speed, a constant decel, a computed
   friction so it stops exactly on the predetermined item (jitter within the card), and a spring settle if it
   overshoots. Ticks are triggered by the actual card edge crossing the marker; tick pitch and haptic strength
   follow the speed. Cards tilt in 3D with the speed and blur slightly above a threshold. In the final second the
   strip crawls across the last two cards (the tease). Tap to skip after 1.5s. Brick and Fuse chests spin
   horizontally; Pop and Board chests spin vertically, so each chest feels different.
   Cards show the real item: a three-brick row for Skins, a looping pop for Pops, a mini board for Boards, a
   burning fuse segment for Fuses.
4. **Reveal, scaled by rarity.**
   Common: the card flips, a soft chime. Rare: flip plus a ring and a blue flash. Epic: the screen dims, the card
   zooms, confetti. Legendary: blackout, a one-second sting, the card rises in slow motion through a lens flare and
   a shockwave, red-gold rays, screen shake. Mythic: full-screen takeover, spotlight sweep, the item plays its
   signature moment live, long confetti, a unique chord.
5. **Try it.** A 3×3 mini board with the item equipped pops once on its own. Buttons: **Equip**, **Keep**, or
   **Sell for N Coins** for a duplicate. Opening several chests runs them back to back without returning to the shop.

Reduced motion: no hold ring (one tap), a 2-second spin, no shake, no blackout.

---

## 7. Items that are worth wanting

Every item has three parts: an **idle look**, a **signature moment** (something only it does during play), and a
**Mythic-only takeover** for the top tier. Series 2, "Arcade", ships 28 items.

| Chest | Common | Rare | Epic | Legendary | Mythic |
|---|---|---|---|---|---|
| Brick | Candy, Slate | Marble, Glass | Neon | Magma (cracks breathe; pops erupt) | **Supernova** (bricks pulse with light; pops leave star trails) |
| Pop | Embers, Petals | Glass | Pixels | Lightning (bolts from the tap) | **Fireworks** (every 8+ pop launches a real firework above the board) |
| Board | Deep Sea, Foundry | Night Market | Orbit | Thunderhead (lightning behind the board every few pops) | **Hologrid** (the board is a floating hologram; Line Blasts scan the grid) |
| Fuse | Rope, Wire | Neon tube | Ice (fuse freezes over in Rush) | Plasma (arcs along the fuse; Rush tints the board violet) | **Dragon** (the fuse is a dragon's breath; Rush Mode is a roar and a fire sweep) |
| Pass | | | Chrome skin (tier 25) | | **Prism Heart** skin (tier 30): bricks refract the board behind them |

Rules for every item: readable at phone size, all seven brick colors still distinct with each Skin, nothing that
hides the group highlight, and every signature moment is under 600ms so it never slows play.

---

## 8. UI overhaul (mobile-first)

**Identity.** Bold, high-contrast arcade: near-black ink background, hot gradient accents (coral → violet) used
only for the fuse, Rush and primary buttons; chunky rounded display type (Fredoka) with Nunito for UI text; large
rounded cards; consistent 24px icon set drawn in-house. One committed dark look.

**Structure.** Five screens on a bottom tab bar within thumb reach: **Play**, **Shop** (chests, Boosts), **Collection**
(Skins / Pops / Boards / Fuses tabs, equip, Trade-up), **Missions** (daily, weekly, Rush Pass), **Profile** (level,
trophies, best scores, settings). The Play screen shows the three modes as cards, the next pass reward, and today's
missions summary.

**The run screen**, top to bottom: fuse bar with bomb (full width, the most important thing on screen), stage
tag and multiplier, score, the board, Rush Meter, three power-up slots. Pause lives in the top-left; nothing else
competes with the board.

**Pause menu**: Resume · Restart · **End Run** (two-step: "End this run? Your score and Coins are kept.") ·
Settings · Quit to menu.

**Results screen** in order: score with stage reached, "new best" ribbon, Coins earned (counting up), mission
progress ticks, XP bar with level-ups and pass rewards popping in, then Play again / Daily / Shop.

**Feel rules**: every tap gets a response within 100ms; every number that changes counts up; every screen change
is a slide or scale, never a cut; every button has pressed, disabled and loading states; text never truncates.

---

## 9. Mobile plan

- **PWA**: `manifest.webmanifest` (name, icons 192/512/maskable, portrait orientation, standalone display, theme
  color), a service worker that precaches the whole game so it runs offline and launches instantly from the home
  screen, an "Add to home screen" prompt on the Profile tab after the second run.
- **Layout**: portrait-first, `dvh` units, safe-area insets on every edge, board sized from the shortest side,
  landscape puts the HUD beside the board. Minimum 48px touch targets; the tab bar is 64px.
- **Input**: pointer events only, `touch-action: none` on the board, no double-tap zoom, no pull-to-refresh, hold
  gestures with movement tolerance, Android back button closes overlays (history state), haptics through
  `navigator.vibrate` with a setting.
- **Performance budget**: 60 fps on a 2020 mid-range phone. Board is 64 DOM nodes, everything else is canvas;
  particles capped at 400 and auto-reduced when frame time exceeds 20ms for a second ("low-end mode");
  all animation on transform and opacity; fonts preloaded; total download under 400KB.
- **Lifecycle**: the fuse pauses when the app is hidden; audio context resumes on first touch; state is saved
  every stage and on `visibilitychange`, so a killed app resumes at the last stage.
- **Later store path**: the same code wraps in Capacitor for iOS/Android without changes; this update keeps the web
  build as the source of truth.

---

## 10. Technical plan

```
js/fuse.js        fuse timer (rAF-based, pause-aware), stage logic, Rush Mode, Fuse bricks
js/engine.js      Rush and Chill rules share board code; score, multiplier, power-ups
js/economy.js     Coins, chest prices, Boosts, duplicates, Trade-up
js/missions.js    daily/weekly mission generation (seeded by date), progress, rewards
js/pass.js        Rush Pass tiers, seasons, trophies
js/chests.js      chest types, odds, drop roll (decided before any animation)
js/spin.js        physics spin engine (horizontal/vertical), ticks, haptics, skip
js/openings.js    the four chest rituals + rarity reveal tiers + try-it board
js/items.js       Series 2 data (idle, signature moment, takeover hooks)
js/skins.js       applies Skin / Pop / Board / Fuse; signature-moment dispatcher
js/music.js       synthesized loop with tempo tied to stage and Rush
js/screens/*.js   play, shop, collection, missions, profile, run, results, pause
js/storage.js     schema v3 + migration from v2 (Shards → Coins 1:1; items keep their new type names)
sw.js, manifest.webmanifest, icons/
tests/            fuse sim (time-stepped bot), economy/mission tests, Playwright mobile emulation,
                  spin landing test (1,000 spins land on the chosen card), fps probe
```

---

## 11. Build order

1. **Fuse and stages** — timer, refill rules, stage-ups, fuse-out ending, results with Coins. *Playable Rush.*
2. **Rush Mode, Fuse bricks, tension beats** — meter, fever, countdown bricks, low-fuse effects, saves.
3. **Economy and chests** — Coins, four chest types, Golden Chest, drop roll, duplicates, Trade-up, odds panel.
4. **Spin engine and openings** — physics spin, the four rituals, reveal tiers, try-it, back-to-back opening.
5. **Items** — Series 2 with signature moments; every Skin checked against all seven colors on a phone.
6. **Missions, Rush Pass, trophies, Daily Rush** — generation, progress, rewards, share image.
7. **UI overhaul** — identity, tab bar, five screens, run screen, pause with End Run, results.
8. **Mobile** — PWA, service worker, safe areas, haptics, lifecycle, performance mode, device testing.
9. **Chill mode, music, polish** — Chill mode on the old rules, synthesized music, sound pass, tutorial, bundle.

Each phase ends playable and committed.

---

## 12. Quality bar (the build is not done until this holds)

The implementing model keeps working, without being asked, until every item below is true. "Working" is the
baseline; the standard is a game that looks and feels like a paid, professionally made title.

**Menus must be visually stunning.** The Home screen and every functioning menu (Shop, Collection, Missions,
Profile, Pause, Results, chest openings) are designed screens, not lists of buttons:
- Each screen has a clear focal point (the mode cards on Home, the chests in the Shop, the equipped item in the
  Collection), a visible hierarchy (one big thing, a few medium things, small supporting text), and breathing room.
- Backgrounds are alive but quiet: slow parallax, drifting light, ambient particles tied to the equipped Board;
  never a flat fill, never busy enough to fight the content.
- Every screen enters with a choreographed sequence (background first, then the focal element, then the rest
  staggered by 40–60ms), and leaves the same way in reverse. No screen ever just appears.
- Cards, buttons and panels share one radius scale, one shadow scale, one spacing scale. Nothing is "close enough".
- Icons are drawn in one style and weight. Text is set on a type scale with no odd sizes.
- Each screen is screenshotted on a phone-size viewport and reviewed against this list before moving on.

**Animations must be thoroughly designed, not just present.** For every animation in the game:
- It has a purpose (shows cause and effect, directs attention, or rewards), a timing chosen for that purpose
  (fast for feedback at 100–250ms, slow for reward at 600–1,500ms), and an easing that matches real motion
  (ease-out for things arriving, ease-in for things leaving, springs for bounces, constant acceleration for falls).
- It is layered: a primary motion, a secondary follow-through (squash, overshoot, settle), and an accent (flash,
  particles, sound, haptic) where the moment deserves it.
- It never blocks input longer than it needs to, never stacks into a mess when triggered repeatedly, and never
  jitters, pops or snaps between frames. Interrupting it mid-way (a tap, a screen change) leaves nothing stuck.
- The chest openings and spins are the showpiece: each is reviewed frame by frame from a recording, and tuned until
  the shake, burst, spin, crawl and reveal read as one continuous, satisfying motion.

**Functionality must be as polished as the look.** Every button does exactly what its label says, every state
(empty, loading, disabled, error, success) is designed, every number is correct and counts up, every overlay
can be closed the way it was opened and with the back gesture, and a bot-driven run of the whole UI (play, end,
shop, open, equip, missions, pass, settings, pause, End Run) passes with zero console errors and zero visual
mismatches before the work is called done.

**Process.** Each phase ends with a visual review pass: screenshots and frame captures of every new screen and
animation, a written list of what is not yet at standard, and fixes for all of it. The phase is not complete while
that list has entries. The model does not ask whether to keep polishing; it keeps polishing until the list is
empty, then moves on.

---

## 13. Acceptance checklist

- [ ] A new player's first run lasts under 3 minutes and ends in a spectacular fuse-out, never a quiet stop.
- [ ] Rush Mode triggers at least once in most runs past stage 2.
- [ ] Every chest's odds are understood from the panel alone (tested by asking: "what are the chances of a Legendary?").
- [ ] The spin lands on the pre-decided item in 1,000 automated spins; ticks never stack into a buzz.
- [ ] Every item is visibly different in play within one pop of equipping it; Legendary and Mythic have a moment
      nothing else has.
- [ ] 60 fps on a mid-range phone during a 12-brick pop with the Fireworks Pop equipped.
- [ ] Installable, works offline, resumes a killed run at the last stage.
- [ ] No word a 10-year-old would need explained: Skins, Pops, Boards, Fuses, Chests, Coins, Shine, Counter, Trade-up.
- [ ] End Run from pause banks score and Coins and shows the same results screen as a fuse-out.
- [ ] v2 saves migrate with Coins, items and level intact.

---

## 14. Decisions taken (change any before build starts)

- Cosmetics still give no scoring advantage; run Boosts are the only paid-with-Coins edge, and they are temporary.
- One currency (Coins). XP and levels stay as progression; the pass rides on levels.
- Chests are bought with Coins or earned from missions and the pass. No keys, no real money.
- Hold-to-open replaces tap-to-crack; the spin stays because it is the part players recognize and enjoy.
- Daily Rush is local-only (one seed per day, personal best); a shared leaderboard needs a backend and is out of scope.
- Rarity names go back to Common / Rare / Epic / Legendary / Mythic.

---

## 15. Implementation status (Update 2 shipped as Pop Rush 2.0)

Everything in sections 1 to 12 is built and covered by tests. Deviations from the plan, and why:

| Plan | Built | Why |
|---|---|---|
| Stage goal growth and Coin rates as drafted | Goal 8,000 x 1.5 per stage; fuse burns 1.15x faster per stage; Rush bar gain 9 + 3 per extra brick; Coins = score / 600 + 12 per cleared stage | Tuned with time-stepped bots so a casual run lasts about 2 minutes (stage 4), an average one reaches stage 6 and a sharp one stage 8, with 3 to 5 Rush Modes per run (`tests/sim.js`) |
| 28 droppable items | 28 droppable + 2 Rush Pass exclusives (Chrome at tier 25, Prism Heart at tier 30) = 30 items | The pass needs real rewards; pass items never drop from chests |
| Play as a button on the tab bar | Play is a raised center disc between Collection and Missions | Keeps the thumb target large and the order Shop, Collection, Play, Missions, Profile |
| Hold ring around the thumb | The ring sits around the Hold button and the chest also accepts the press | The thumb covers a ring drawn at the touch point; the button keeps it visible |
| Odds as one stacked bar | Five chips (percent, rarity, "1 in N") on the opening screen, bar plus rows on the Shop and the odds sheet | Thin Legendary and Mythic slivers were unreadable at phone size |
| Closing during the spin | Back or X while spinning skips to the result; the drop is saved at the burst | Nothing can be lost and nothing is charged for backing out before the burst |
| Item saved when you press Keep | The item is saved at the burst; Equip, Sell and Done act on the saved copy | An app kill or crash mid-reveal can never lose an item |

Added beyond the plan: item sheets play a live demo of the item, the Golden Chest has its own burst, Boards have
frame details and animated scene layers (GPU transforms, no repaint), fireworks are a real particle type, and the
reel scales card size and physics to the screen so the spin feels the same on every phone.

Verification: `node tests/logic.js`, `sim.js`, `spin.js` (1,000 landings), `stress.js`, `flow.js`, `moments.js` and
`lifecycle.js` (migration, resume after reload, offline through the service worker) all pass with no console errors;
screens were reviewed at 360x640, 390x844, 430x932, 768x1024, 844x390 and 1280x800, and every chest opening and the
Legendary and Mythic reveals were reviewed frame by frame from recordings.
