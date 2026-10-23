# Pop Rush Update 7: built for phones (plan)

**Status: plan. Nothing in the game has changed yet.** The plan is built from three audits of the Update 6 build (version 11 of the
game page), each grounded in screenshots, measurements or bot play. The detail is in `docs/update-7/`.

**What the owner asked for, in order of weight.**
1. **The UI on mobile devices perfect.** This is the main focus.
2. **Less stutter and lag on mobile, on practically any phone, without taking away visual appeal or the animations.**
3. **Chill mode more addictive.**
4. **Fine-tune and improve the game's logic.**
5. **Not an exorbitant amount of time.**

| Input | What it holds |
|---|---|
| `docs/update-7/audit-mobile-ui.md` | 26 findings (4 major, 15 minor, 7 polish) across every screen, sheet, run state and chest opening at nine phone sizes, Larger text and notch insets, plus touch-feel tests |
| `docs/update-7/perf-lowend.md` | Menus, runs, chests, startup and memory at 4x and 6x CPU slowdown; 11 ranked hot spots; a redesign of Auto graphics |
| `docs/update-7/chill-and-logic.md` | Chill measured with bots, a six-part Chill design prototyped against the engine, 14 logic findings (4 bugs) |
| `docs/update-7/audit-scripts/` | The scripts behind every number (`ui/`, `perf/`, `logic/`), so each fix can be checked the same way |

Numbers come from the same harness as Updates 4 to 6: Chromium with no GPU, phone-sized pages, CPU slowed 4x (a mid phone) and 6x
(a low-end Android phone). Absolute times are higher than on a phone; comparisons are what matter. The performance audit ran on a
shared, busy machine, so Phase 2 starts by re-measuring the baseline on a quiet one.

---

## 1. What the audits found

### 1.1 Mobile UI
- **390x844 and taller phones are clean.** No horizontal scroll anywhere, no sheet taller than the screen, no console errors, double
  taps and scroll-versus-tap are safe, and every Update 5 fix stayed fixed.
- **Small phones (320x568, 360x640) and notched phones in landscape are where it breaks:**
  - **The run screen at 320x568** sizes the whole HUD column by the board's height budget: bricks are 27px (46px on a 393x852 phone),
    the stage goal, goal pill and combo wrap or are cut, and Pause shrinks to 40px on every phone up to 720px tall.
  - **The chest reveal card at 320x568** puts the item art over the item name (a later CSS rule overrides the short-phone rule).
  - **The results in landscape on a notched iPhone** clip the Coins total to "+1," and wrap every row.
  - **Home at 320x568 with the Resume card** hides half of Play behind the tab bar.
  - The status bar title truncates, Shop chest cards are cramped, the Golden Chest shrinks to 28px before a type is picked, and the
    odds chips run together.
- **Touch feel:** sheets show a drag handle but cannot be swiped closed; many controls (segmented controls, chips, Pass tiles, Swap)
  give no press feedback; `touch-action` and `overscroll-behavior` do not reach the scrolling lists (double-tap zoom and
  pull-to-refresh risk on real phones); toasts land on the score during a run; the keyboard covers the save-code field.
- **Landscape and keyboard details:** the Pass track's notch margins are swapped, Chill wastes 65 to 139px under its HUD, Settings puts
  Performance mode near the bottom, and the reel covers its own caption.

### 1.2 Smoothness
- **Opening any sheet restyles the whole app** (1,300+ elements, a 584 ms first frame at 4x). The rule that pauses animations under an
  overlay matches every element instead of the 25 that animate.
- **Big moments do all their work on the tap frame.** With heavy loadouts a Rush start runs 434 ms of script in the tap handler,
  including a forced layout.
- **The results screen** is built and measured in one long task (up to 1.2 s).
- **Pops create and destroy dozens of layers** (30 → 78 per pop); handing them to the compositor is the biggest cost of every pop.
- **Chests:** the spin's first frame paints 44 cards at once (338 to 668 ms); the reveal paints a big card at once.
- **Menus rebuild on every visit** (Collection 379 to 726 ms), and the Collection's per-tile observer stalls scrolling.
- **Memory:** the menu background's three colour blobs hold about 60 MB of graphics memory at 3x density.
- **The run HUD writes to the page every frame** (the Rush label, the Rush bar width, the fuse rope).
- **Auto graphics is broken:** on a 60 Hz screen it can lower effects but can never raise them again, one slow moment or one session
  in iOS Low Power Mode lowers everything for good, and it switches everything at once.

None of the fixes needs a visual change: the work moves off the tap frame, happens earlier (during the hold, while the reel slows), is
done once instead of every visit, or is drawn more cheaply in the same way.

### 1.3 Chill
- **Flat, then a wall.** Rounds 1 to 5 are always cleared with 10 to 17 of the 20 moves left; every run then ends on round 6 to 9
  (casual 7.1, average 8.5, sharp 8.7), so playing much better is worth about two rounds.
- **Nothing carries over.** The game already computes stars per round and throws them away. A personal best is beaten in only 3 to 5%
  of runs whatever the rules, so "beat your best" cannot carry the mode; it needs targets that keep moving.
- **Chill pays about half of Rush per minute** and cannot move 4 of the 9 daily mission kinds.

### 1.4 Logic
- **Bugs.**
  - *Resume relights the fuse:* resuming a saved run sets the fuse to at least 6 seconds, so Save and leave during the Last Spark is a
    free save (bots doing it reach stage 7.7 instead of 5.2).
  - *Chill Save and leave throws the run away* (no Coins, XP or streak), and a restored Chill run would come back with 20 moves.
  - *Chill results always show 0:00.*
  - *Chill ends "Out of moves" while power-ups that would clear the round are still in hand* (60% of casual runs).
  - *Save and leave in a Daily reseeds the board*, so it is no longer everyone's board.
- **Economy after the Coin doubling.** All 84 chest items are owned after 6.5 to 8.5 hours of play (Update 5: 10 to 11 hours), and then
  Coins have no use. Missions and run goals are now worth half of what they were relative to a run. Restarting after stage 4 or 5
  pays 15 to 45% more a minute than playing the run out.
- **Smaller rules.** Rush Start can lower a sharp player's score (its Rush counts toward the Rush escalation); trophies count Chill
  rounds as stages (Hot Streak comes free from Chill); combos past 4 are mostly luck.

---

## 2. Targets: how we will know it worked

| Area | Target | Checked by |
|---|---|---|
| Mobile UI | Every audit finding fixed or recorded with a reason; at 320x568, 360x640, 375x667, 390x844 to 430x932, 667x375 and 844x390 (with and without insets and Larger text): no clipped or overlapping text, no wrapped HUD pill, every control at least 44px | `tests/uiaudit.js` and `tests/visual.js` extended to those sizes, the run states and the chest openings; contact sheets read by eye |
| Run on a small phone | Bricks at least 32px at 320x568 (27 today), Pause 44px everywhere | New run-geometry checks |
| Touch | Every control has press feedback (also with Reduce Motion); sheets close with a swipe down; no double-tap zoom or pull-to-refresh paths | `touch.js` from the audit, turned into a test |
| Smoothness, menus | Sheet first frame down at least 60%; a repeat visit to Collection or Shop down at least 50%; no scroll frame over 50 ms at 4x | `perf/menus.js`, new `tests/perfbudget.js` budgets |
| Smoothness, runs | Tap to next paint under 150 ms at 4x on the default loadout (quiet machine); heavy-loadout Rush start under 300 ms wall; results end frame down 50%; idle run under 12 ms main-thread CPU a frame at 4x | `perf/runprof.js`, `perf/tapjs.js`, budgets |
| Smoothness, chests | Spin and reveal first frames under 150 ms at 4x | `perf/chestprof.js`, budget |
| Memory | About 60 MB less layer memory on the menus | `perf/startup.js` |
| Visuals | Nothing visibly removed on Auto or Pretty: side-by-side frame sheets before and after for the run, a Rush start, a chest reveal and every tab | Contact sheets, `tests/moments.js`, `tests/u5-*.js` |
| Auto graphics | Comes back up on a 60 Hz phone; Low Power Mode never lowers effects; steps one tier at a time | A simulator test (`gfxsim.js` turned into a test) |
| Chill | Rounds reached about 9.4 / 10.2 / 11.0 for casual / average / sharp (7.1 / 8.5 / 8.7 today), with a wider spread; 3-star clears 30 to 65% (73 to 87% today); no run ends with a usable power-up in hand | `tests/balance.js` Chill section (from `chill-proto.js`) |
| Logic | The four bugs covered by tests; catalogue in about 10 hours of play; a mission worth about one run; restarting no better than +10% a minute | `tests/engine.js`, `tests/logic.js`, `logic/economy.js` |

---

## 3. The plan

Five phases, in order of the owner's priorities, kept small enough that the build stays a matter of hours rather than days. Each
phase ends with its tests green, a commit and a push.

### Phase 0. Bugs first (small)
- **Resume:** save the Last Spark and Rush state in the run snapshot, restore the fuse exactly, and replace the 6-second top-up with a
  clock that waits for the first pop after a resume.
- **Chill Save and leave:** save Chill runs (with moves left and round) like Rush runs; resume them.
- **Chill clock:** count time in Chill so the results show the real duration.
- **Out of moves:** see Phase 3 ("Last chance"); the power-ups fire before a round is judged.
- **Daily resume:** keep the Daily's board generator on its original seed after a resume.
- Tests for each in `tests/engine.js` and `tests/u5-run.js`.

### Phase 1. The UI on phones (the main phase)
1. **A run screen built for small phones** (U-1, U-6, U-7, U-13): HUD rows take the full width and only the board follows the height
   budget; on heights under 620px the score sits beside the fuse readout and the power-up slots and message band slim down, so bricks
   are at least 32px at 320x568; Pause stays 44px; HUD texts never wrap; Chill gets its own, larger board (it has no fuse, stage strip or
   Rush bar).
2. **The money screens** (U-2, U-3): the reveal card keeps its name clear of the art at every height (the short-phone rule actually
   applies, and the art sizes to its box); the results in landscape make room for the notch insets and never clip a number.
3. **Small-phone menus** (U-4, U-9, U-10, U-11, U-12, U-17, U-24): Play above the tab bar with Resume at 320x568 (a one-row logo and a
   slim Resume row on short screens); a status bar title that fits and a compact Coins pill for big balances; compact Shop chest cards
   under 360px; a Golden Chest of at least 96px before a pick (and a side-by-side layout in landscape); readable odds chips; Performance
   mode moved near the top of Settings and the volume sliders folded into their toggles; tip cards that fit without scrolling.
4. **Touch feel** (U-14, U-15, U-16, U-18, U-19): swipe down to close any bottom sheet (a real drag with a flick); one shared press
   state for every control that lacks one, also under Reduce Motion; `touch-action` and `overscroll-behavior` on every scroller; no
   toasts over the score in a run (messages go to the run's own message band or wait for the results).
5. **Keyboard and landscape** (U-5, U-8, U-20, U-21, U-22, U-23, U-25, U-26): the save-code field and its button stay above the
   keyboard (`visualViewport`, 16px text so iOS does not zoom); the Pass track's notch margins; 44px "See everything inside"; a soft
   backdrop behind the reveal card's text; lighter dim text for contrast; the reel caption in landscape; Done on the name keyboard;
   the item preview's particles clipped while the sheet scrolls.
6. **Tests that keep it this way:** the audit's sweep, run-state, chest and touch scripts become `tests/u7-mobile.js`, covering the
   nine sizes, insets and Larger text, and failing on clipped text, small controls or covered controls.

### Phase 2. Smooth on any phone, same look
Re-measure the baseline on a quiet machine first, then prototype and measure each fix with the audit's script before keeping it.
1. **Sheets** stop restyling the whole app: pause only the elements that actually animate.
2. **Big moments** (Rush start, stage clear, Last Spark, set flourishes, skin and scene moments) do only the essential on the tap frame;
   decorative layers start one or two frames later, under the flash, and read positions from a geometry cache instead of forcing layout.
3. **The results screen** builds in two parts and stops measuring every card in the same task.
4. **Pops:** one animation per falling brick (the landing squash folded into the fall), fewer short-lived layers per pop.
5. **Animated skin decorations** no longer drag a second layer for the sheen above them (checked side by side).
6. **Chests:** build and paint the reel during the hold, and the reveal card while the reel slows down.
7. **Menus** render when their data changes, not on every visit; offscreen cards use `content-visibility: auto` (with the current
   behaviour as the fallback on older Safari); the Collection's per-tile observer is replaced by a cheaper one.
8. **Memory:** the menu's colour blobs become tiny canvases scaled up (same soft look, about 60 MB less).
9. **The run HUD** writes to the page only when a value changes; the Rush bar animates with `scaleX`; the fuse's steady burn runs on the
   compositor.
10. **Particles:** pre-baked spark sprites, and counts that follow the measured frame time instead of a fixed setting.
11. **Auto graphics as a quality ladder:** detect the screen's refresh rate (so 30 fps Low Power Mode and 120 Hz both read correctly),
    track calm and busy frames separately, step down one small tier at a time starting with what nobody notices (canvas resolution,
    ambient loops pausing for half a second after a pop, particle count), step back up after 20 good seconds, never change in the middle
    of a pop or a reveal, and offer (never force) Performance mode only as the last step.
12. **Budgets:** `tests/perfbudget.js` gains the new targets and 6x cases so the gains cannot slip back.

### Phase 3. Chill, more addictive
Prototyped with bots (section 2 of `chill-and-logic.md`):
1. **A longer, gentler ladder:** goals `2400 x 1.13^(round-1)` (2400, 2700, 3050, ...) instead of `1200 x 1.30^(round-1)`; the wall
   moves from round 7 to 9 out to round 9 to 11, and skill matters more.
2. **Banked moves:** half the moves left at a clear (at most +5) carry into the next round ("20 + 3"); the rest still shatter for points.
3. **Big pops buy moves:** a pop of 10+ gives +1 move, a Line Blast +2, with a "+1 move" chip that flies to the counter like the fuse's
   time chips.
4. **The Lucky brick (Chill only):** once a round, one new brick wears a gold ring; popping it gives 1 to 3 moves.
5. **Last chance:** power-ups in hand fire before an out-of-moves round is judged, and once per run, running out within 15% of the goal
   gives "So close: 3 more moves".
6. **Stars that count:** 3 stars for a round cleared in half its moves, 2 in three quarters. Stars show on the round clear and the
   results, are kept, and fill a **Star Road** on the Chill card (40 Coins every 50 stars, a free chest every 300). A **Daily Chill**
   mission card ("Clear round 9", "Earn 20 stars in one run", "Make 3 pops of 10+"). Chill rounds pay their stage Coins up to round 12,
   plus 1 Coin a star.
7. **Knock-on fixes:** trophies stop counting Chill rounds as Rush stages (Chill gets its own, e.g. "Reach round 12 in Chill" and
   "300 stars"); the skill rating stays Rush-only.

With these, bots play 9.4 / 10.2 / 11.0 rounds instead of 7.2 / 8.5 / 8.7 and a run lasts 5 to 8 minutes instead of 3 to 4.5.

### Phase 4. Logic and economy fine-tuning
1. **A Coin sink for finished collections: Shine upgrades.** Spend Coins on an owned item to raise its Shine one step (Plain → Glossy →
   Holo → Prism), from the item sheet. It gives Coins a purpose after the catalogue is done without making chests cheaper.
2. **Missions and run goals** pay double, so each is again worth about one run.
3. **Playing the run out pays:** stage Coins continue to stage 12 (today they stop at 7) and a run that the fuse ends earns a small
   completion bonus, so restarting early is never better than +10% a minute.
4. **Boosts:** Rush Start's Rush no longer counts toward the Rush escalation; Head Start gets a reason to exist (for example a charged
   Beam instead of a Hammer).
5. **Combos:** the tile director helps a combo past 4 a little more often, so long combos come from skill more than luck (checked with
   `tests/balance.js`).
6. **Small counting edges** from section 3 of the logic audit.
7. The economy is re-simulated (`logic/economy.js`, `tests/sim.js`) against the targets in section 2.

### Phase 5. Finish
The full test suite with the performance budget, the README and these notes (a "What shipped" section with before and after numbers),
the service worker version, the single-file bundle, and the published game page. Then the owner's step: play on a real iPhone and a
real Android phone, small and large.

---

## 4. Decisions for the owner

The plan proceeds with the recommendation in each case unless the owner says otherwise.

| Question | Recommendation | Alternative |
|---|---|---|
| Chill runs get longer (5 to 8 minutes instead of 3 to 4.5) | Keep the gentler ladder (`2400 x 1.13`): longer runs are part of why it pulls you back | A steeper ladder (`2200 x 1.15`) keeps runs about 20 seconds shorter |
| A Coin sink now that Coins are doubled | Shine upgrades on owned items | Leave Coins as they are and accept that the collection is done in about a week of play |
| Sheet handles | Make them swipe to close | Remove the handle |

## 5. Not in this update
- New cosmetics.
- Loading board-scene CSS lazily and tracking down detached DOM after tab visits (audit items H12 and H13): worth doing, but they
  touch every cosmetic file; kept for a later update unless Phase 2 has time left.
- Anything Safari-only that cannot be reproduced in the harness: those findings are fixed in the standard way and flagged for the
  real-device check.

## 6. Size of the work
Phase 1 is the largest (mostly CSS, a sheet-drag helper and a new test), then Phase 2 (each fix is small, but each is measured before and
after), then Phase 3 (engine rules plus four small pieces of UI). Phases 0 and 4 are small. The estimate is several hours of build time
in total, about half of it on Phases 1 and 2, with a commit and push at the end of every phase.
