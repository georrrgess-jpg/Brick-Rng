# Update 5 audit: the menus (input to Phases 2 and 3)

Audit of every screen and sheet outside the board, made on the Update 4.1 build before Update 5 started. Read-only: nothing in
the game was changed. The scripts that produced the evidence are in `audit-scripts/menus/` (they write screenshots and frame
sheets to `$AUDIT_OUT`, default the system temp folder; the screenshots themselves are not kept in the repository). File and line
references are to the Update 4.1 code.

**Scope.**
- Home: new and returning player, the Resume card, the chests banner, all seven streak states.
- Shop: each chest card, the odds sheet, buying with and without enough Coins, the Golden Chest, a completed set.
- Collection: type tabs, rarity filters, the equipped header, item and locked sheets, Try it.
- Missions with swap and done states, the Pop Pass with reward sheets, Trophies.
- Profile: every setting, Graphics, Larger text, save code and restore, Help, Reset.
- Help: coach cards and banners, what's-new, the Coins sheet, the level badge, toasts.
- The Boosts sheet (run 4) and the results screen.

**Sizes.** 360x640, 393x852, 430x932, 844x390 and 1280x800, plus 393x852 with Larger text, Reduce Motion and Graphics: Smooth.
Safe areas were simulated by setting `--sat/--sab/--sal/--sar` to iPhone 15 Pro values, so they are approximate.

**Test player.** A returning player at level 6 with 900 Coins and 12 runs, 5 items per type with mixed Shines, a waiting Brick
Chest and Golden Chest, a 2-day streak and a saved run. A brand-new player with help on was also tested.

**Limits.** Timings come from Chromium without a GPU, so they are good for comparisons only. Safari, VoiceOver, haptics and the
edge-swipe Back gesture were not tested.

**Counts.** 60 findings: 0 blocker, 12 major, 31 minor, 17 polish. There were no console errors in any scenario, and
`tests/uiaudit.js` passes.

## 1. Bugs and visual errors

| ID | Sev | Where | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|---|
| M-B1 | major | Collection, every grid render (tab, type, filter, after Equip), all sizes | `@keyframes cardIn` is defined in screens.css:154 and again in chest.css:190. chest.css loads later and wins, so Collection cards play the chest-reveal flip (`translateY(70px) rotateY(180deg) scale(0.8)`): they rise 70px and spin edge-on with mirrored text | frame sheets of a segment switch; computed keyframes on `.icard` | Give each a unique name (`icardIn`, `rvCardIn`); add a test that fails on duplicate `@keyframes` names |
| M-B2 | major | Home hero, always visible | `@keyframes sparkFlick` collides: chest.css:60 (`50% { transform: scale(1.35) }`) overrides screens.css:42, which held the spark at `translate(108px, 6px)`. The bomb's spark swings between the wick and a point about 90px up and to the left, above "MAIN MODE" | frame sheet of the hero spark | Rename one (same test as M-B1) |
| M-B3 | major | Home hero, returning player: overflow is 18px at 360x640 and 3px at 375x667. With Larger text: 71px at 360, 56px at 375, 38px at 393, 1px at 430 | The Play button and the bomb overflow the card and are clipped, the Play label sits about 17px off centre, and with Larger text the bomb is cut in half. Cause: `.hero` uses `grid-template-columns: 1fr 112px`, and the `1fr` grows to the minimum width of the stats | screenshots at 360 and 360 with Larger text | `minmax(0, 1fr) 112px`, and let `.hero-stats` wrap |
| M-B4 | major | Shop chest cards, after any chest without an Epic | The pity line always reads "Epic or better guaranteed within 8 chests", even with 3 of 8 pips filled. The aria-label and the odds sheet both say 5 | screens.js:257 prints `N` instead of `st.pityIn` | Print `st.pityIn` |
| M-B5 | major | Home in landscape (844x390, 932x430, 667x375), and 360x640 with Resume | Play's bottom edge is at 420 on a 390px screen. With the Resume card it is fully off screen (442 to 506). At 360x640 with Resume, only 26px of Play shows, the rest behind the tab bar. Update 4 promised that Play is never below the fold | fold measurements, landscape screenshots | In landscape, a two-column hero beside the logo; or put the Resume row inside the hero |
| M-B6 | major | Every bottom sheet at 844x390 | The sheet is capped at 90dvh (351px) with the actions pinned, so very little of the body shows: item sheet 135 of 315px (preview cut, description hidden), Boosts 185 of 356px (about 1.5 of 3 boosts), Coins 197 of 410px. There is no scrollbar or cue that it scrolls | landscape sheet screenshots | In landscape, a centred sheet up to 560px wide with two columns, and a fade edge where more content scrolls |
| M-B7 | major | All sheets and coach cards (keyboard, desktop, screen readers) | Focus stays on the button that opened the sheet. Tab walks the Home content behind the `aria-modal` sheet. Escape closes the sheet but does not return focus | ui.js:162-205; every Tab stop measured behind the sheet | Focus the sheet on open, trap Tab inside it, return focus on close, and make the page behind `inert` |
| M-B8 | minor | Collection cards, Pass tiles, Profile trophy badges | Clickable `div` and `span` elements with no tabindex (6 cards, 30 tiles, 4 badges), so a keyboard user cannot equip an item or open a Pass reward | screens.js:347, 450, 552 | Use buttons, or `tabindex=0` with key handlers |
| M-B9 | minor | Results | The results are not on the Back stack. Escape does nothing and Android Back would leave the page | run.js:852-887 | Push a Back entry that goes Home |
| M-B10 | minor | Results "Next:" line | Says "Stage 5 would be a new record" when the best stage is 5 and the run reached 4; that would only tie | retention.js:141 | Use the best stage + 1 |
| M-B11 | minor | Collection type segment, Larger text at 360 (2px at 393) | "Boards 5/11" overlaps "Fuses" | overflow measurement | Drop the counts from the segment (see M-I13), or let labels wrap |
| M-B12 | minor | Rarity chips, Larger text at 393 and 360 | The chips run off the right edge ("Myt…") with no scroll cue; Update 4 promised they wrap | screenshots | `flex-wrap: wrap` |
| M-B13 | minor | Larger text | `zoom: 1.14` applies only to `.scroll` and `.sheet-body`, so sheet titles, sheet actions, tab labels, the top bar, toasts and the results stay at normal size and sheets mix two sizes | base.css:258 | A root font size or a type-scale variable instead of zoom |
| M-B14 | minor | Play, Pause, End run with no pops | Still pays "First run of the day" (+20 Coins, +60 XP), counts as a run and toward "Play N runs", and lights the streak | runs 12 to 13, streak 1 to 2, score 0, XP +60 | Treat `pops === 0` like `bankSilently`: no payout, no run counted |
| M-B15 | minor | Results level-up banner | Reads "Level 7! 45 Coins" without the "+", while trophies and streak read "+50 Coins". `grant()` returns 0 for Coin rewards | run.js:821, progress.js:73-83 | Return the paid Coins from `grant()`, and write every line as "+N Coins" |
| M-B16 | minor | Home streak card | Shows "Week complete! … One missed day is forgiven." The promise "the weeks you finished stay" has nothing visible behind it: `weeks` is never shown and the ring resets | screens.js:139-143 | Drop the shield line once the week is done; show "Weeks: N" |
| M-B17 | minor | Missions, a completed weekly challenge | Keeps the lightning icon and the reward price, with no Done or Paid label, unlike the daily missions | screenshot | The daily done style: a check and "Paid · Golden Chest in the Shop" |
| M-B18 | minor | Boosts sheet, then the run | "You need 5 more Coins…" and "Paid 40 Coins…" toasts stay about 2.4s over the run's score and fuse | frame sheet of Boosts to Start | Clear menu toasts when a run starts, or show the message in the run's message band |
| M-B19 | minor | Item sheet preview | The demo particles are drawn on the global `#fx` canvas (z-index 70, above sheets at 40) and spill over the description and the Equip button | screenshots at 360, 844 and with insets | Clip the demo to its preview well |
| M-B20 | minor | Desktop 1280x800 | Sheets span all 1280px and their buttons are 1240px wide, while every screen column is 560px | sheet width measured at 1280 | `max-width: 560px; margin-inline: auto` above 700px |
| M-B21 | minor | Desktop, Pop Pass track | A vertical mouse wheel does not scroll the track (scrollLeft stays at 350), and there are no arrows or drag | measured | Map the wheel to horizontal scroll and add arrows on wide screens |
| M-B22 | polish | Opening odds chips at 393 | In the Epic chip, "1 in 10" wraps and sits left-aligned | screenshot | `nowrap`, centred |
| M-B23 | polish | Home hero stats, 360 to 393 | "RECENT AVG" wraps onto two lines, so its number sits lower than Best and Stage | screenshot | Shorten to "Avg", or align the numbers on one baseline |
| M-B24 | polish | Reward sheet for a claimed Coins tier | Says "Coins go into your balance right away" under "Claimed" | screens.js:399 | "Paid when you reached level N" |
| M-B25 | polish | Coins sheet opened from the Shop | "Go to the Shop" only closes the sheet, because the router ignores a move to the current screen | screens.js:54, ui.js:244 | Hide or relabel it when already on the Shop |
| M-B26 | polish | Toasts | At `sat + 70px` they cover the Missions segment ("New mission!") and, in landscape, the Coins sheet title | frame sheets | A slot that covers no controls; place toasts above an open sheet |

Checked and fine: no console errors; `uiaudit` (text 12px or larger, targets 44px or larger) passes; portrait insets look right;
tapping outside and browser Back close sheets and history stays flat; Restore asks twice and rejects bad codes; Reset asks twice.

## 2. Intuitiveness

### Taps for common tasks (393x852)

| Task | Today | Could be |
|---|---|---|
| Start a run (runs 1 to 3) | 1 | 1 |
| Start a run (from run 4) | 2 (Play, Start); 3 from another tab | 1, with a remembered-Boosts chip on Home |
| Open a waiting chest | scroll, then banner, Open free, hold, Done (plus the coach card the first time) | 2, with a Shop tab badge or a banner above the fold that opens the chest |
| Equip an item | 3 (Collection, card, Equip); 1 from a reveal | 2 |
| Try an item, then equip it | Collection, card, Try it, 10 s, scroll, card, Equip: 5 taps, a scroll and the wait | 3 and the wait, if the item sheet reopens after Try it |
| Claim a Pass reward | 0 (paid at once, with no visible moment); 2 to see it | 1 claim moment |
| Change the sound | Profile, scroll about a screen, toggle: 2 taps and a scroll; 3 in a run | 2, with a gear in the top bar |
| Swap a mission | 2, with no confirm, and 30 Coins charged at once | 2, plus an undo toast |

### Findings

| ID | Sev | Where | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|---|
| M-I1 | major | Home and the tab bar | Waiting chests are hard to find. The "You have N chests to open" banner sits at y≈940, below the fold on an 852px phone. There is no Shop tab badge, and the Missions dot is switched off in code (`false &&`). A new player's welcome chest is never in view | screens.js:177, 481 | A Shop tab badge, the banner moved under the hero, and the Missions dot back on |
| M-I2 | major | Results, Coins card | It counts to 33 while the level, trophies, streak and missions pay 540 more, so the balance rose 573 and no total says so | balance 300 to 873 in one run | One "Coins earned" total with a breakdown, and the top-bar pill counting up |
| M-I3 | major | Results | Every level-up and trophy appears twice (a banner and a row at the bottom). The screen grows to 25 rows and XP, Missions and Coins fall below the fold | run.js:819-823, 849 | One compact banner per reward; trophies grouped |
| M-I4 | minor | Profile | The settings come after the hero, stats, Records and Trophies: the Sound toggle at y≈837 (behind the tab bar), Help at y≈1723 | measured | A gear button that opens a Settings sheet, or Settings first |
| M-I5 | minor | Locked item sheet, "Go to the Shop" | Lands at the top of the Shop; the named chest is at y=877 and not highlighted | screenshot | Scroll to and pulse that chest, or open it |
| M-I6 | minor | Item sheet, Try it | The practice board ends on the Collection with the scroll reset and the item sheet closed | run.js:173-182 | Reopen the item sheet |
| M-I7 | minor | Coach cards | "Let's pop" and "Open it" only dismiss the card, and the opening card covers the chest and its hold button | coach.js:16, 25 | "Let's pop" starts run 1; the opening card becomes a hint line |
| M-I8 | minor | Mission swap | One swap a day, but nothing says so: every swap button disappears after one swap, and also when Coins are under 30. One tap spends 30 Coins with no confirm | missions.js:63-65 | Disabled buttons that say why, and an undo toast |
| M-I9 | minor | Pop Pass | No claim moment: rewards are paid silently at level-up, and Pass chests appear in the Shop unannounced | screenshot | A claim reveal on the next Home or Pass visit |
| M-I10 | minor | Level naming | "Lv 6", then "LEVEL 6" next to "Next reward" on the Home Pass card, then "Pass level 7" for the same reward on the Pass | screenshots | Home card: "Next: Pass level 7" |
| M-I11 | minor | Button roles | The colour rules are broken in places: "Replace my progress" (destructive) is gold; a selected Boost's price turns green although it costs Coins; the results "Chests" button is gold even when the chest is free; chests you cannot afford look disabled but can be tapped | screenshots | A red danger style; green "Chests" when one is free; "Need 180 more" on the button |
| M-I12 | minor | Ready sheets | Chill's sheet has nothing to choose (an extra tap). "Beat it" and "Play again" never offer Boosts, while Play does | run.js:877 | Start Chill directly; offer the last Boosts on "Play again" |
| M-I13 | polish | Collection header | The count is shown twice (segment and ring); Update 4 §4.5 planned one | screenshot | The ring only (also fixes M-B11) |
| M-I14 | polish | Profile Trophies card | Shows the last 6 only, all with the same icon, and is not tappable | screens.js:552 | Reuse `TROPHY_ICON`; link to the Trophies tab |
| M-I15 | polish | Shop count badges | "1" and "2" read like step numbers, and "Open free x2" repeats the count | screenshot | The count on the button only |
| M-I16 | polish | Shop and the Coins sheet | Two lists of ways to earn Coins, worded differently. The Coins sheet suggests buying while free chests are waiting | screens.js:42-56, 271-277 | One shared list; mention free chests first |
| M-I17 | polish | Locked tiles | Every tile is the same "?" box, while the copy promises "dark shapes" | screenshot | A real dark silhouette |
| M-I18 | polish | New player's hero | "BEST 0 · STAGE -" mixes placeholders | screenshot | Consistent placeholders, or "Play your first run" |
| M-I19 | polish | Rarity filters | There is no "All" chip; clearing a filter means tapping the active chip again | screenshot | An "All" chip |
| M-I20 | polish | Profile name | Editable only through a dashed underline | screenshot | A pencil icon |
| M-I21 | polish | Chest hold | A short press gives no "keep holding" hint | first-chest script | A hint after an early release |

## 3. Animation

| ID | Sev | Where | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|---|
| M-A1 | major | Every tab switch | The old screen is removed at once and the new one starts at opacity 0, leaving 70 to 100ms of bare background. Content then staggers in at 55ms per block (Shop about 420ms, Profile about 1s), and the shared top bar animates in again on every tab | base.css:87-101, ui.js:246-262; frame sheets show +68 to +119ms empty | Lift the top bar out of the screens, cross-fade the outgoing screen, cap the stagger near 250ms |
| M-A2 | major | Results | The buttons appear 2.9s after a plain run and 3.9s after a run with banners, last in a 140ms stagger that includes rows below the fold | results timing script | The action bar within 600ms; stagger only the visible rows |
| M-A3 | minor | Segmented controls | `rerender()` forces content to opacity 1, so the content snaps while the thumb slides. The Graphics thumb jumps because Profile renders `--i` at the new index | ui.js:272, screens.js:556 | Animate the list region; slide the Graphics thumb from the previous index |
| M-A4 | minor | Shop to a chest opening | About 80 to 100ms of pure black: the app is hidden at once while the opening fades in from 0 | chest.css:4, 10, openings.js:265 | Hide the app only once the opening is opaque |
| M-A5 | minor | Results, "Chests" | Shows the Shop for about 200ms, then black, then the opening | frame sheet | Open the chest straight from the results |
| M-A6 | minor | "Beat it" after End run | The previous run's board shows for about 250ms, then empties and refills | frame sheet | Clear the board before the results fade |
| M-A7 | minor | Boosts sheet, Start | Home flashes for 250ms between the sheet and the run (a 250ms `setTimeout`) | screens.js:236-237 | No gap |
| M-A8 | minor | Results count-ups | The score counts for about 390ms before it is visible (the first visible frame already shows 20,967). The Coins count and the XP bar fill with its confetti run below the fold (the XP bar is at y 1015 to 1366 on an 852px screen) | run.js:866-870, 889-904 | Start each count when its row is on screen; move the XP bar up |
| M-A9 | minor | Reduce Motion | The stagger delays remain, so blocks pop in one by one with no fade over about 300ms | base.css:100, 224, run.js:865 | Zero the delays under `html.reduced` |
| M-A10 | minor | Home Play button | `playPulse` uses a gold lip and glow (`#a8620a`) on the pink button, so its edge flickers between pink and gold every 2.4s | screens.css:50 | Pulse in the button's own colours, or scale only |
| M-A11 | polish | Coin pill and level ring | Values snap (900 to 850 after a purchase) | frame sheet | Count with `BR.countTo` and a small coin bump |
| M-A12 | polish | Mission swap | The text changes instantly | frame sheet | Flip or slide the card |
| M-A13 | polish | Toasts | Long toasts wrap to two lines; three stack and cover about a third of a 360px screen | screenshot | One line, at most two toasts |

Keep as they are: bottom sheets sliding with a 0.5s ease-out and the dim fading in; coach cards on a spring; toggles sliding;
the tab indicator and segment thumbs on a spring; toasts springing in and floating out; the chest drop and the hold ring; the
order of the results reveals (only faster).

## 4. The five changes that would most improve the menus

1. **Fix the cheap, very visible bugs:** the two keyframe collisions and the hero grid (M-B1 to M-B3), plus a test that fails on
   duplicate `@keyframes` names.
2. **Make the results fast and honest:** buttons within 0.6s (M-A2), each reward shown once (M-I3), one Coins total that matches
   the balance (M-I2), count-ups and the XP bar in view (M-A8), and no payout for an empty run (M-B14).
3. **Show what is waiting:** a Shop tab badge, the chest banner above the fold and the Missions dot back on (M-I1); a Pass claim
   moment (M-I9); "Go to the Shop" lands on the right chest (M-I5); the item sheet reopens after Try it (M-I6).
4. **Smooth every handoff:** a fixed top bar and a cross-fade on tab switches (M-A1); animated segment content (M-A3); no black,
   Home or stale-board flashes (M-A4 to M-A7); Reduce Motion without the staggered pop-in (M-A9).
5. **Landscape, desktop and accessibility:** Play above the fold in landscape (M-B5); sheets of a sensible width with visible
   scrolling (M-B6, M-B20); focus management in sheets (M-B7) and focusable cards and tiles (M-B8); Back and Escape on the results
   (M-B9); Larger text that scales everything (M-B11 to M-B13).
