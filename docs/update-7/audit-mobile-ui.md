# Update 7 audit: the UI on mobile devices (input to the Update 7 plan)

Audit of every tab screen, every sheet, the run in each state, Chill, the five chest openings and the reveal card, on phone-sized
viewports, made on the Update 6 build (version 10 of the game page). Read-only: nothing in the game was changed. The scripts that
produced the evidence are in `audit-scripts/ui/` (they write screenshots to `$AUDIT_OUT/shots`, default the system temp folder; the
screenshots are not kept in the repository). File and line references are to the Update 6 code.

**Scope.** Home (with and without the Resume card), Shop, Collection (items, Hats, the Tower), Missions (Daily, Pop Pass, Trophies),
Profile; the sheets: Settings (with Performance mode), Before you start (Boosts), Daily, Coins, odds (Brick and Golden), item, fuse
item, locked, spotlight, hat, locked hat, Pass reward (Coins and item), season claim, trophy, save code, restore, the Welcome and Pass
tip cards, What's new, Reset; the run at start, press preview, after a pop, with a seven-digit score and a combo, the Rush start
and Rush, the stage wipe, Last Spark, Pause, the results (top and bottom); Chill at start, round clear, the next round, out of moves
and its results; Brick, Pop, Board, Fuse and Golden Chest openings (ready, Golden picker before and after a pick, holding, reel,
reveal card).

**Sizes.** 320x568, 360x640, 375x667, 390x844, 393x852, 412x915, 430x932, 667x375 and 844x390, all as touch phones (Playwright
`isMobile` + `hasTouch`, device scale 2). Also 393x852 and 320x568 with Larger text, and 393x852 and 844x390 with simulated
iPhone 15 Pro insets (59/34 portrait; 59 left and right and 21 bottom in landscape, with a drawn island and home bar).

**Method.** Screenshots of every state, read by eye on contact sheets; a geometry pass on each (`lib.js` `AUDIT`: horizontal
scroll, clipped or ellipsised text, text off screen, controls under 44px, controls under the insets, controls covered by something
else, sheets that scroll); measurements of the Play button against the tab bar, the run's board and brick size and the Pause button
at every size (`measure.js`); touch tests with real touch events through CDP (`touch.js`): press states with `:active` forced on
every visible control, double taps 90 ms apart on every spending or starting button, drags that start on tappable cards, long press,
re-tapping a tab, a swipe on a sheet handle, an on-screen keyboard over the two text fields, and the Pass track in landscape with
insets.

**Limits.** Chromium without a GPU, not Safari: iOS behaviour (double-tap zoom with `user-scalable=no` ignored, focus zoom, the
keyboard panning a fixed layout, rubber-band) is reasoned from the code and marked "verify on device". The keyboard was simulated by
shrinking the layout by 336px. Haptics, VoiceOver and real notch geometry were not tested. A first-time tip card that opened during
boot in two parallel runs was a harness race (the tests mark the tips seen just after boot), not a game bug.

**Counts.** 26 findings: 0 blocker, 4 major, 15 minor, 7 polish. No console errors in any scenario. No horizontal page scroll at any
size, and no sheet taller than the screen.

**Is any size fundamentally broken?** No menu screen is. Two layouts are structurally wrong: the **run screen at 320x568** (the whole
column is sized by the height budget, so the board is 216px with 27px bricks and every HUD row is squeezed to 216px; U-1), and the
**results in landscape on a notched phone** (the Coins total is clipped and every row wraps; U-3). 390x844 and taller are clean.

## Findings, most severe first

| ID | Sev | Where (sizes) | What is wrong | Evidence | Proposed fix |
|---|---|---|---|---|---|
| U-1 | major | Run screen, Rush and Daily, 320x568 (and any portrait phone under about 600px tall); milder at 360x640 | The board size `--bw` is `min(100vw - 24px, 100dvh - 352px, 540px)` on short phones, and **every** row of the run takes that width (`.run > * { width: var(--bw) }`). At 320x568 the board is 216px, so bricks are **27px** (36px at 360x640, 39px at 375x667, 46px at 393x852), the column has 52px of empty space on each side, and the HUD is squeezed: the stage goal "640 / 4,500" wraps onto the stage bar, the goal pill wraps and is cut ("Goal reached:…"), the combo pill breaks onto two lines. | `measure.js`: board 216 / 288 / 315 / 369px; `shots/run-se1-*.png` (start, bigscore, rush); geometry in `run-se1.json` | Give the HUD rows the full width and let only the board follow the height: `.run > :not(.board-wrap) { width: min(calc(100vw - var(--sal) - var(--sar) - 24px), 540px) }` (css/run.css:125). On heights under 620px win back about 60px for the board: score beside the fuse readout in one row, power-up slots at 48px (run.css:247 sets 52px), message band 34px. Target: bricks of at least 32px at 320x568. Add 320x568 to the run checks in `tests/visual.js` and `tests/uiaudit.js` |
| U-2 | major | Chest reveal card, 320x568 (portrait heights under about 600px) | The item art covers the **item name** on the reveal card ("Lantern", "Confetti" are half hidden behind the art). The short-phone rule `.rv-card { height: min(40dvh, 300px) }` (css/chest.css:228) is overridden by the later global rule `.rv-card { width: min(70vw, 280px); height: min(46dvh, 380px) }` (chest.css:246), and the badge and live demo inside `.rv-art` keep their pixel size while the card is 224x261 | `shots/chest-se1-brick-4-reveal.png`, `chest-se1-pop-4-reveal.png`; `chest-se1.json` card [48,70,272,331]; fine at 360x640 | Move chest.css:246 above the media queries (or into them) so the short-phone height applies, and size the badge and demo from the art box (`container-type: size` on `.rv-art`, badge `min(100cqw, 100cqh)`), so the name and type line always keep their room. A check in `tests/u5-chests.js` that `.rv-name` is not overlapped at 320x568 |
| U-3 | major | Results, landscape on a notched phone (844x390 with 59px side insets; any iPhone with a notch or island in landscape) | The results column is capped at 520px **including** the safe-area padding, so the right column is about 150px wide: the Coins total "+1,285" is clipped to "+1,", every breakdown row ("Points +168 Coins") wraps to two lines, "Coins earned" wraps, and "Play again" breaks onto two lines. Without insets the same screen is fine | `shots/run-l844-insets-results.png`, `run-l844-insets-chill-results.png` | css/run.css:249 caps `.res-scroll, .res-actions` at `min(100%, 520px)`, and run.css:211/226 add `--sal`/`--sar` inside that width. In landscape use `width: min(100%, calc(640px + var(--sal) + var(--sar)))` (two columns need more than 520px), and `white-space: nowrap` on the row values and the total. Add 844x390 with insets to `tests/visual.js` |
| U-4 | major | Home with the Resume card, 320x568 | Play is cut by the tab bar and its label sits under the Home disc: 32 of its 56px show (16px with Larger text). The short-phone fix at css/screens.css:421 (drop the hero sentence) is enough for 360x640 (Play fully visible) but not 568px | `measure.js` homeResume visible 32/56 and 16/56 (Larger text); `shots/se1-home.png`, `se1-large-home.png` | Under `max-height: 600px` (portrait): the logo becomes one row as in landscape (screens.css:432) and loses its fuse line, and the Resume card becomes a slim one-line row (or a chip inside the hero, as M-B5 suggested). Extend the fold check in `tests/u5-menus.js` to 320x568 with Resume and Larger text |
| U-5 | minor | Restore from a code (Profile > Data), every portrait phone | The code field (y 588 to 698 at 393x852) and "Check the code" (782 to 834) sit in the bottom 336px that the on-screen keyboard covers. Nothing reacts to the keyboard (no `visualViewport` handling, no `interactive-widget` in the viewport meta), so on iOS the page pans to the field and the button stays under the keyboard: the player must close the keyboard to go on. When the layout does shrink (Android `resizes-content`) the sheet fits (82 to 516) with the button visible. The field is 13px, so iOS may also zoom on focus (verify on device) | `touch.js` D; `shots/touch-kb-restore.png` | Add `interactive-widget=resizes-content` to the viewport meta (index.html:5) for Android; for iOS a `visualViewport` resize listener that sets `--kb` (the covered height) and lifts `.sheet` by it (`bottom: var(--kb)`, `max-height` minus it). Set `.code-box` to 16px (css/screens.css:462). The name field is at the top of Profile and stays visible (91 to 135) |
| U-6 | minor | Chill run screen, every size | Chill hides the fuse, the stage strip and the Rush bar but keeps Rush's board size, so 65px (320x568) to 139px (844x390) sits empty under the message band while the bricks stay as small as in Rush (27px at 320x568) | `measure.js` chill.freeBelow 65 / 65 / 65 / 104 / 106 / 127 / 126 / 124 / 139px; `shots/run-se1-chill-start.png` | A Chill board size: `.run.chill { --bw: min(calc(100vw - var(--sal) - var(--sar) - 24px), calc(100dvh - var(--sat) - var(--sab) - 300px), 540px) }` (about 52px less HUD; tune per height band like run.css:240) |
| U-7 | minor | Run, Pause button, portrait heights up to 720px (320x568, 360x640, 375x667) | The run's most important control shrinks to 40x40 on short phones. `tests/uiaudit.js` audits the run only at 393x852, so it never sees this | `measure.js` pause 40x40; css/run.css:243 `.run-top .icon-btn { width: 40px; height: 40px; }` | Keep 44x44 (take the 4px from the row gap) and audit the run at 360x640 and 320x568 too |
| U-8 | minor | Pop Pass track, landscape with insets (every notched iPhone in landscape) | The track's bleed margins are swapped: `margin: 0 calc(var(--sal) * -1 - 16px) 0 calc(var(--sar) * -1 - 16px)` puts `--sal` on the right and `--sar` on the left. In landscape the screens set `--sal: 0` but keep `--sar: 59px`, so the track starts 53px under the tab rail (tier 1 and its NEXT tag are cut in half) and stops 64px short of the right edge | `touch.js` E: screen left 133, track left 80, first tile at 96; `shots/touch-land-track.png` | Swap the two terms (css/screens.css:327). Portrait and insetless landscape are unaffected |
| U-9 | minor | Status bar title, 320 wide | The title truncates: "Collecti…" even with a three-digit balance, "Colle…" and "Missi…" with a six-digit one, and with Larger text. The Coins pill grows with the balance and takes the room | `bignums.js`; `shots/bignum-320-*.png`, `se1-col.png` | Under 340px: title `clamp(18px, 5.6vw, 28px)` (css/base.css:102), the pill drops its coin padding, and balances from 10,000 show as "12.3k" in the pill only |
| U-10 | minor | Shop chest cards, 320 wide | The chest art column is a fixed 120px, so the text column is 128px: "Brick / Chest", "Common 60% · / Mythic 1%" and "Epic or better guaranteed within 8 chests" wrap to two or three lines, the "Open free ×2" button label breaks onto two lines, and each card is about 380px tall (the Shop is five screens of scrolling) | `shots/se1-shop-1.png` | Under 360px: `grid-template-columns: 84px 1fr` (css/screens.css:104) and an 84px chest (screens.css:119); `white-space: nowrap` on `.cc-act .btn` (screens.css:128) |
| U-11 | minor | Golden Chest opening before a pick, 320x568 and landscape | The Update 6 fix keeps the chest off the picker by shrinking it to the room left: at 320x568 the chest is **28x25px** (the header wraps to "Golden / Chest" plus a two-line subtitle, 110px), at 667x375 about 45px, so the moment's hero is a speck above four buttons | `chest-se1.json` picker.chest [146,111,174,136]; `shots/chest-se1-golden-0-pick.png`, `chest-l667-golden-0-pick.png`; fine at 360x640 (125px) | On short screens: a one-line header (title only, the subtitle is repeated by the hint under the hold button), hide the compact odds sentence until a type is picked, and in landscape put the chest on the left and the picker and hold button on the right (as the reveal does). Aim for a chest of at least 96px |
| U-12 | minor | Chest opening odds chips, 320 wide | The five chips are about 54px wide with 12px uppercase labels: "LEGENDARY" runs into "MYTHIC" ("LEGENDARYMYTHIC"), "COMMON" touches its chip's edges | `shots/chest-se1-brick-1-ready.png`; css/chest.css:240-244 | Under 360px: abbreviate (Com, Rare, Epic, Leg, Myth) or show percentages only with the rarity colour, or wrap to 3 + 2 |
| U-13 | minor | Run HUD texts on narrow columns: 320x568 portrait, both landscape sizes | "Combo x2.5" breaks onto two lines in its pill (320, 667x375, 844x390); Chill's "Round 1 · goal reached!" wraps inside its 28px pill and is cut (320); the stage goal "640 / 4,500" wraps onto the stage bar (320) | `shots/run-se1-bigscore.png`, `run-se1-chill-clear.png`, `run-l667-bigscore.png` | `white-space: nowrap` on `.combo b` (css/run.css:111), `.ss-goal` (run.css:141) and `.chill-goal span` (run.css:134); shorter Chill text ("Goal reached!"). Most of this goes away with U-1 |
| U-14 | minor | Toasts during a run, every size | Over a run, toasts use the top slot (js/ui.js:284, css/base.css:234), which is the score and Pause row in portrait and the board's top row in landscape. Seen with the automatic Graphics message "Effects lowered to keep it smooth" (js/main.js:20), which fires mid-run on a struggling phone, exactly when the player is watching the score | `shots/run-s393-bigscore.png`, `run-se1-bigscore.png`, `run-l844-rush.png` | In a run, show messages in the message band (it exists for that) or hold them for the results; make the Graphics change silent during a run and mention it on the results |
| U-15 | minor | Every bottom sheet (portrait) | Sheets show a drag handle but cannot be dragged: a 260px swipe down on the handle leaves the sheet open. On iOS and Android a handle means "swipe down to close" | `touch.js` C: stillOpen true | A pointer drag on `.sheet-handle` and `.sheet-head` that moves the sheet and closes it past 30% of its height or on a quick flick (js/ui.js Sheet.open); or drop the handle (css/base.css:217) so it does not promise it |
| U-16 | minor | Press feedback, every screen | Most controls press in (scale or a lip), but these do nothing on touch: the segmented controls (Daily / Pop Pass / Trophies, the Collection types, Graphics), the rarity filter chips, Pass tiles, the mission Swap button, "See all", the name pencil, "See everything inside" (odds sheet and opening), the Golden picker buttons and the tip close ×. With Reduce Motion on, every `.stg` card (the Rush hero, Resume, the chests banner, the Shop spotlight, the Tower entry, the Settings row) also loses its press scale, because `html.reduced .stg { transform: none !important }` (css/base.css:263) beats the `:active` transforms | `touch.js` A (`:active` forced through CDP on every visible control, computed styles compared) | One shared rule, e.g. `.seg button:active, .chip-btn:active, .pt:active, .reroll:active, .link-btn:active, .ph-edit:active, .op-see:active, .odds-more:active, .op-picker button:active, .tb-x:active { transform: scale(0.95); }`; scope the reduced rule to the entrance (`html.reduced .stg:not(:active)`) or use a brightness press there |
| U-17 | minor | Settings sheet, 320x568 and landscape | Settings is three screens long on a small phone: 426 of 906px show at 320x568, 249 of 609px at 667x375. Performance mode, the new row meant for older (often small) phones, is the second-to-last row, with Graphics under it | `sweep-se1.json` sh-settings; `shots/se1-sh-settings.png`, `l667-sh-settings.png` | Move Performance mode to the top of "Play and display" (js/screens.js:929), and fold each Volume slider into its toggle row (the slider shows only while the toggle is on) |
| U-18 | minor | Touch handling inside scrolling lists (verify on an iPhone) | `touch-action: manipulation` is set on `body` and `button` only (css/base.css:46, 49). It does not reach past a scroll container, so `.scroll`, `.sheet-body` and every non-button tappable in them (the Rush hero card, Collection cards, Pass tiles, which are `div`s) compute `auto`. iOS ignores `user-scalable=no`, so a quick double tap on a card can zoom the page and leave the fixed layout zoomed, and taps there may wait for a possible double tap | `touch.js` C: touch-action body manipulation, .scroll / .hero / .icard / .sheet-body auto | `.scroll, .sheet-body, .res-scroll, .res-rest { touch-action: pan-y; } .track { touch-action: pan-x pan-y; }` and `touch-action: manipulation` on `[data-act], [data-tier], .icard` |
| U-19 | minor | Scroll chaining and pull-to-refresh (verify on device; browser tab, not the installed app) | `overscroll-behavior: none` is only on `body` (css/base.css:46); `html` and the scrollers (`.scroll`, `.sheet-body`, `.track`, `.res-scroll`, `.res-rest`) have none. Pulling past the top of a screen can chain to the page and start Chrome's pull-to-refresh (a reload mid-session), and a horizontal overscroll on the Pass track can chain to back navigation | code reading | `html, body { overscroll-behavior: none; }`, `overscroll-behavior: contain` on the vertical scrollers and `overscroll-behavior-x: contain` on `.track` |
| U-20 | polish | Small targets outside the audited screens | "See everything inside" in every chest opening is 331x36 (css/chest.css:92 `min-height: 36px`); the restore field is 37 to 43px tall in landscape. `tests/uiaudit.js` does not visit openings or landscape sheets with insets | `chest-s393.json`, `sweep-l667.json` | `min-height: 44px`; add the chest openings (ready and reveal) to `tests/uiaudit.js` |
| U-21 | polish | Reveal card info, 320x568 and landscape | The NEW and Shine tags and the description sit directly on the "first look on the real board" scene and the confetti; on busy boards (Observatory, Alchemy Lab, Glass) parts of the sentence are hard to read | `shots/chest-se1-board-4-reveal.png`, `chest-se1-golden-4-reveal.png`, `chest-l667-pop-4-reveal.png` | A soft backdrop behind `.rv-info` (a dark rounded panel at about 70%), or fade the board scene under the info area |
| U-22 | polish | Inactive tab labels and other `--dim` text | `--dim` (#70658f) is 3.75:1 on the tab bar for the 12px tab labels, and 3.44:1 on cards for the 12px claim notes and locked-card hints (WCAG asks 4.5:1 for small text); in daylight on a phone the inactive tabs are faint | contrast computed from the tokens | A lighter text token, e.g. #8d82ad (4.6:1 on the bar), for `.tab`, `.claim-note`, `.ic-hint`; keep #70658f for strokes and icons |
| U-23 | polish | Chest reel caption, landscape | The reel covers its own caption: at 667x375 the "Pop Chest" line under "OPENING" is hidden behind the first reel card | `shots/chest-l667-pop-3-spin.png` | In landscape, drop the subtitle or move the caption above the reel frame |
| U-24 | polish | Tip cards and What's new, 320x568 and landscape | The centred cards scroll inside: Welcome shows 448 of 565px at 320x568 (the fourth line is under the fade), What's new 386 of 516px; at 667x375 the What's new title is cut by the top fade | `sweep-se1.json`, `sweep-l667.json`; `shots/se1-sh-coach-home.png`, `l667-sh-whatsnew.png` | On short screens a 56px coach icon (css/coach.css:4-6 uses 84px) and tighter line padding, so the four lines fit without scrolling |
| U-25 | polish | Profile name field | The keyboard's return key does nothing visible (the name saves on `change` but the field keeps focus, so the keyboard stays up); there is no `enterkeyhint` | js/screens.js:974, 1100 | `enterkeyhint="done"` and blur on Enter |
| U-26 | polish | Item sheet preview, 320x568 and landscape | Once the sheet body scrolls, the demo's particles still land outside the preview well (over the sheet title at 320x568, below the well at 667x375): the clip from M-B19 does not follow every case | `shots/se1-sh-item-end.png`, `l667-sh-item-end.png` | Clip the demo to the preview well's rectangle intersected with the sheet body's visible rectangle, updated on scroll (js/screens.js:687-689) |

## Checked and fine

- No horizontal scroll of the page, a screen or a sheet at any of the nine sizes, with or without Larger text.
- Portrait insets (393x852 with 59/34): the status bar sits under the island, the tab bar, sheet actions, the run, the results and
  every chest opening clear the home indicator. Landscape insets: the rail clears the island; only the results (U-3) and the Pass
  track (U-8) break.
- 390x844, 393x852, 412x915 and 430x932 have no layout findings: Play above the fold with Resume, bricks 46 to 51px, Pause 44px,
  every sheet's actions on screen, Larger text fits.
- Double taps 90 ms apart are safe: Play (the Boosts sheet opens once and stays), Start (one run), Beat it, Equip, a mission Swap
  (30 Coins charged once) and a Shop chest (opens once, nothing charged until the hold).
- Scroll versus tap: vertical drags that start on the Rush hero, a Collection card or a Shop chest button scroll and trigger nothing;
  a horizontal drag on a Pass tile scrolls the track and opens nothing.
- Long press: no text selection, no callout (`user-select: none`, `-webkit-touch-callout: none`, `contextmenu` cancelled); a long
  press on a card behaves like a tap. The board and the hold button have `touch-action: none`.
- Re-tapping the current tab scrolls it back to the top.
- The name field (22px) stays visible above a keyboard; text inputs allow selection.
- No console errors in any scenario.

**Update 5 findings that stayed fixed.** M-B3 (hero overflow, including Larger text at 360), M-B5 (Play above the fold in landscape and
at 360x640 with Resume; 320x568 is new, U-4), M-B6 (landscape sheets are centred two-column dialogs with fade edges), M-B11 and M-B12
(Collection segment and rarity chips with Larger text), M-B26 (toasts above the tab bar, at the top over sheets), R-6 (goal pill fits
at 360 and up), R-7 (Rush banner not clipped), R-8 (the Last Spark flame clears Pause), R-11 (landscape pause sheet in two columns),
C-5 (badges on reveal cards from the first frame), and the Update 6 Golden picker fix (the chest no longer covers the picker; its size
at 320x568 is U-11). M-B19 (item demo particles) is fixed in the resting state but not when the sheet scrolls (U-26).

## The five changes that would most improve the UI on phones

1. **A run screen built for small phones** (U-1, U-6, U-7, U-13): HUD rows at full width, a board that takes what the HUD leaves (and
   more in Chill), Pause at 44px, no wrapping HUD text. Add 320x568 and 360x640 to the run checks in `tests/visual.js` and
   `tests/uiaudit.js` so it stays that way.
2. **The two clipped money screens** (U-2, U-3): the reveal card's name and the landscape results on notched phones. Both are one or
   two CSS lines and both are seen on every chest or every run.
3. **320x568 menus** (U-4, U-9, U-10, U-11, U-12): Play above the tab bar with Resume, a status bar title that fits, compact Shop
   cards, a Golden Chest you can see, readable odds chips.
4. **Touch feel** (U-15, U-16, U-18, U-19, U-14): swipe-down sheets, a press state on every control, `touch-action` and
   `overscroll-behavior` on the scrollers, no toasts over the score.
5. **Keyboard and landscape details** (U-5, U-8, U-17, U-23, U-24): the restore field above the keyboard, the Pass track insets,
   Performance mode near the top of Settings, captions and tip cards that fit.

## Scripts

All in `audit-scripts/ui/`; run with `AUDIT_OUT=<folder>` (screenshots go to `<folder>/shots`).

| Script | What it does |
|---|---|
| `lib.js` | Launch a touch phone, simulated insets (variables plus a drawn island and home bar), a returning player, scroll screenshots, the geometry pass |
| `sweep.js <size> [large\|insets\|perf]` | Every tab (every scroll position) and every sheet at one size, with the geometry pass (`sweep-<tag>.json`) |
| `runstates.js <size> [insets\|large]` | The run in each state and Chill's round clear and out of moves (`run-<tag>.json` with HUD geometry) |
| `chests.js <size> [insets]` | The five openings: ready, Golden picker, hold, reel, reveal card (`chest-<tag>.json`) |
| `measure.js` | Play against the tab bar (with and without Resume, normal and Larger text), title fit, Tower back button, run board and brick size, Pause, Chill's spare height, at every size |
| `touch.js [A B C D E]` | Press states, double taps, scroll versus tap and long press, tab re-tap and the keyboard, the Pass track with landscape insets |
| `bignums.js` | The status bar with large Coin balances at 320 and 360 |
| `contact.py`, `summarize.py` | Contact sheets of screenshots; a summary of a `sweep-*.json` / `run-*.json` |

Size keys: `se1` 320x568, `s360`, `s375`, `s390`, `s393`, `s412`, `s430`, `l667` 667x375, `l844` 844x390.
