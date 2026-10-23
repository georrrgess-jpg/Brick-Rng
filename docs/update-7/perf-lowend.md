# Update 7 audit: smooth on low-end phones without losing the look

Read-only investigation on the Update 6 build (`306e7c0`). No game file was changed. The scripts are in
`audit-scripts/perf/` and their raw output in `audit-scripts/perf/out/`. Every fix below keeps the same picture and the same
animations. None of them depends on Performance mode.

## How it was measured, and how far to trust it

- **Harness.** Chromium 1194 with no GPU (SwiftShader), a 393 x 852 page at deviceScaleFactor 3, isMobile and hasTouch, with
  the CPU slowed 4x (stands in for a mid phone) and 6x (low-end Android). Same harness as Updates 4 to 6.
- **The machine was shared.** Other sessions ran Playwright sweeps on the same 4 cores for the whole hour, with a load average
  of 17 to 22. Wall-clock frame times are therefore inflated, and they swing 30 to 50% between reruns.
  - Every run table therefore also gives **main-thread CPU per frame**. This is the renderer main thread's own thread time from
    the trace. It includes the emulated 4x/6x slowdown (6x reads about 1.5 times 4x), but it does not count time spent waiting
    for other processes. Use it to compare rows.
  - Wall times show the shape of a problem (which frame is the long one), not its exact size.
  - The Update 6 headline numbers (for example, a 25 ms average pop frame) came from a quiet machine, so they are not directly
    comparable with the wall times here.
- **Frame budget on this harness.** At 4x a run frame must stay under about 16 ms of main-thread CPU to keep 60 fps. At 6x,
  under about 16 ms means the work is roughly 1/6 of what a 4x phone would spend.
- **What "Commit" and "Layerize" are.**
  - Layerize: Chromium turning the paint into composited layers.
  - Commit: handing those layers and their property trees to the compositor.
  - Both grow with the number of composited layers and how many of them change.

## The ten fixes, ranked

The ranking weighs the measured cost, how many players hit it, and how safe the fix is. Gains are estimates for the harness
at 4x, worked out from the share of the frame the fix removes. Each needs a prototype measured with the same script before
it ships.

| # | Fix | Where | Evidence (4x unless noted) | Expected gain | Visible change |
|---|---|---|---|---|---|
| 1 | Sheets and the idle wake-up stop restyling the whole app: pause only the animated elements, not `#screens *` | Menus | Item sheet first frame 584 ms with 1,315 to 1,347 elements restyled (430 ms of style). Odds sheet 938 ms at 6x (1,102 elements). Cause: `html.under-overlay #screens *, ::before, ::after, .bg *` in `css/base.css:280` | Sheet first frame about 60 to 70% shorter (style pass about 1,300 to about 250 elements) | None |
| 2 | Big moments do their extra work after the tap frame, and read layout from a geometry cache | Runs | Spire Rush start: 434 ms of JS in the pointerup handler. Constellation `rushStart`/`SKY` takes 263 ms, most likely a style/layout pass forced by reading `innerWidth`; the function itself only builds a short SVG string. Sigil `runeFrame` takes 107 ms. A 717-element style pass is forced mid-handler | Rush tap frame about 1 s down to about 0.3 s wall. Stage clear about -40 ms of JS | None (sky and runes start 1 to 2 frames later, under the Rush flash) |
| 3 | Results build in two parts, without measuring the fold synchronously | Runs | The end frame is 290 to 1,234 ms wall with 793 to 1,139 elements styled. `showResults` takes 205 ms of JS, of which 191 ms is `getBoundingClientRect` on every `.rev` item (`js/run.js:1126-1128`) | End frame about 50 to 60% shorter | None |
| 4 | One animation per falling brick (fold the landing squash into the fall keyframes) and fewer short-lived layers per pop | Runs | Commit is the largest main-thread item in every pop: 12 to 29 ms CPU per frame, a quarter to a third of the frame. Layers go from 30 at rest to a peak of 78 in a default pop (121 to 146 with Spire). Each falling brick animates both `el` and `.face` | Commit in pops about -30 to 40% | None (same curve, same squash) |
| 5 | An animated skin decoration should not drag a second layer for the sheen above it | Runs | Idle Spire run: 94 layers, of which 21 are `b.deco` (Sigil `sgTurn`) and 21 are `b.sheen` promoted only because they overlap the deco (5.3 M device px). Commit 4.5 ms/frame at rest against 0.8 in Performance mode. At 6x the Spire idle frame is 46 ms of CPU | Idle Spire run about -3 to 5 ms/frame at 4x, layer count about halved | None if the prototype holds the look (see H5) |
| 6 | Chests: build and paint the reel during the hold, and the reveal card during the slow-down | Chests | Spin first frame 338 to 508 ms (668 ms at 6x: a 325 ms style pass plus 108 ms in `spin.js:151 step`). Reveal first frame 469 to 830 ms for the Brick Chest (Paint 587 ms) and 282 to 1,471 ms for the Golden Chest | Spin and reveal first frames under about 100 to 150 ms | None (the work happens while the player holds or watches the reel slow) |
| 7 | Menus render when their data changes, not on every visit; offscreen cards use `content-visibility: auto` | Menus | Tab first frames: Collection 379 to 486 ms (726 ms at 6x), Shop 140 to 318 ms, Home 91 to 183 ms. Every visit rebuilds the screen (purged 800 ms after leaving). The Collection makes 108 paint passes in its first 1.5 s (533 ms of paint CPU). A per-tile IntersectionObserver costs up to 133 ms in one scroll frame | Repeat visits about -50%. Collection scroll worst frame about -100 ms | None |
| 8 | The menu background stops holding about 60 MB of layers: blobs as tiny canvases scaled up, vignette folded in | Memory | Home holds 56 layers, 38.5 M device px (up to about 147 MB). Each blob is 767 x 767 css, so about 21 MB each at DSF 3. The Rush sky (`.s4-sky`) adds a full-screen layer of about 12 MB for 14 dots | About -60 MB of layer memory on Home and fewer raster tiles | None (soft gradients have no detail to lose) |
| 9 | The run HUD stops writing to the page every frame: compositor-driven fuse burn, diffed text, `scaleX` bars | Runs | Every frame: `rushLabel.textContent` (a layout), `rushFill.style.width` (a layout; the WAAPI width animation is the only non-compositable animation in a run), and the fuse rope and tip transforms written from JS (`js/run.js:337-338`, `js/fuse.js:574-586`). Idle run main CPU is 13.7 ms/frame (default) and 18.2 ms (Spire) at 4x | Idle run about -3 to 5 ms/frame. Rush about -2 ms/frame | None |
| 10 | Auto graphics becomes a graded, self-correcting quality ladder | All | The current sampler never comes back up on a 60 Hz phone, permanently lowers effects after one slow 3-second window or one Low Power Mode session, and switches everything at once (see section 5) | Capable phones keep full visuals. Weak phones lose the least visible effects first | Only on phones that need it, and gradually |

Next in line:
- **H10.** Pre-baked spark sprites drawn in two passes, plus particle counts that adapt to the measured frame time. Wishdust
  peaks at 234 particles and costs 71 ms CPU per pop frame against 52 for Classic.
- **H12.** Load the board-scene CSS lazily: about 800 KB of the 1.23 MB of CSS is scenes for boards the player is not
  wearing.
- **H13.** Find and drop detached DOM: about 900 nodes are still alive after visiting every tab once.

## 1. Measurements

### Menus (wall ms, harness; first frame = the frame that shows the new screen)

| Scenario | 4x | 6x | What the long frame did |
|---|---|---|---|
| Collection tab, first frame | 379 to 486 | 432 to 726 | Style 265 ms (494 elements), Paint 247 to 378 ms |
| Shop tab | 140 to 318 | 210 to 236 | Style 83 to 164 ms (556 to 726 elements), Paint up to 200 ms. At 6x one rAF callback took 135 ms |
| Home tab | 91 to 183 | 206 to 326 | Style 68 to 152 ms (268 to 352 elements) |
| Missions / Profile tab | 95 / 53 to 84 | 208 / 238 | Style, Layerize |
| Item sheet (over the Collection) | 584 | 432 | **1,315 to 1,347 elements restyled**, style 430 ms |
| Settings sheet / Odds sheet | 173 / 205 | 676 / 938 | Odds at 6x: 1,102 elements restyled |
| Collection scroll (touch fling), avg / worst | 17 to 35 / 38 to 148 | 32 / 201 | Worst frame: `IntersectionObserver` 133 ms |
| Shop scroll, avg / worst | 33 / 93 | 27 / 101 | Style, PrePaint |
| Home idle, avg frame | 18 to 19 | 37 | 26 compositor animations. About 6 main frames a second restyle all 29 animated elements |

### Runs (main-thread CPU per frame, then wall avg in brackets; daily board, six biggest pops, Rush start, stage clear, Last Spark, end)

| Loadout | Idle | Pops | Rush start | Stage clear | Last Spark | End and results build | Results on screen |
|---|---|---|---|---|---|---|---|
| Default, 4x | 13.7 (19 to 28) | 54.6 (118 to 196) | 35.3 | 44.2 | 46.9 | 53.7 (worst frame 290 to 753 wall) | 10.8 |
| Default, 6x | 21.9 (26) | 48.5 (55) | 65.2 | 57.1 | 78.4 | 80.4 (worst 725 CPU) | 19.4 |
| Spire set + hat, 4x | 18.2 (43) | 51.8 (124) | **72.2 (worst 429)** | 65.3 | 67.4 | **104.5 (worst frame 1,234 wall)** | 25.0 |
| Spire set + hat, 6x | **46.2 (53)** | 107 (166) | **190.8 (worst 1,073)** | 159 | 184 | 112.7 | 33.9 |
| Spire, Performance mode, 4x | 11.0 (17) | 32.0 (46) | 49.2 | 44.9 | 56.7 | 33.0 | 9.0 |
| Potion skin, Prism, 4x | 28.9 | 59.6 | 93.6 | 82.0 | 113.7 | 115.5 | 15.4 |
| Floating Isles + Hourglass + Sandfall, 4x | 19.3 | 46.3 | 66.0 | 93.7 (worst 523) | 60.2 | 135.3 | 21.4 |
| Alchemy set (Potion, Gold Leaf, Alchemy Lab, Elixir), 4x | 35.4 | 93.1 | 88.9 | 79.8 | 77.1 | 81.3 | 21.1 |

**Tap to next paint.** Measured with the Event Timing API, pointerup to the next paint, over 11 taps per run. On this loaded
machine it is dominated by input delay (the main thread still finishing the previous frame):

| Run | Tap to next paint | Input delay | Tap handlers |
|---|---|---|---|
| Default, 4x | 328 to 1,928 ms | 54 to 1,217 ms | 3 to 109 ms |
| Default, 6x | 192 to 720 ms | | 16 to 74 ms |
| Spire, 4x | 512 to 2,632 ms | | Rush start: 426 ms |
| Spire, Performance mode, 4x | 120 to 784 ms | | |

The handler numbers are the reliable part: most taps run 10 to 50 ms of script, and a Rush start with Spire runs 426 to 451 ms.

**The nine Moonwick pops** (4x, four pops each on the same board; main-thread CPU per pop frame, particle peak):

| Pop | CPU/frame (Commit) | Particle peak |
|---|---|---|
| Classic | 51.9 (13.8) | 112 |
| Fireflies | 63.2 (15.3) | 109 |
| **Wishdust** | **70.7 (17.3)** | **234** |
| Paper Birds | 44.8 (13.4) | 49 |
| Rune Burst | 56.3 (17.4) | 42 |
| Gold Leaf | 60.0 (20.3) | 92 |
| Sandfall | 59.9 (16.3) | 127 |
| **Whirlgate** | **65.5 (24.2)** | 70 |
| Constellation | 52.8 (15.1) | 67 |
| Wisps | 46.7 (13.1) | 16 |

The pops differ by at most about 35% from Classic. In every one of them the shared pop cost (Commit, style, the falling
bricks) is larger than the pop's own effect.

### Chests (wall ms; main CPU per frame in brackets)

| Phase | Brick 4x | Brick 6x | Golden 4x | Golden 6x |
|---|---|---|---|---|
| Holding, avg | 112 to 134 (CPU 37) | 96 (40) | 73 to 90 (29) | 60 |
| Spin, avg / worst (first frame) | 52 to 61 / 338 to 508 (CPU 28) | 98 / 668 (52) | 51 to 78 / 434 to 517 (27) | 51 / 452 (32) |
| Reveal first frames, worst | 469 to 830 (CPU 127, Paint 63/frame) | 557 (106) | 282 to 1,471 (67) | 410 (123) |
| After the reveal, worst | 258 to 451 | 736 (one 672 ms PrePaint) | 332 to 925 | 251 |

### Startup and memory

**Startup:**

| | 4x | 6x |
|---|---|---|
| App ready (from navigation) | 1,880 ms | 2,184 ms |
| First contentful paint | 852 ms | 1,232 ms |
| DOMContentLoaded | 1,646 ms | 1,805 ms |

- Main-thread CPU at 4x: script 396 + 272 ms (evaluate), style 320 ms (the biggest pass is 407 elements), HTML parse 317 ms.
- CSS parse: `s4-scenes.css` 24 ms (61 at 6x) and `u4-boards.css` 19 ms.
- Script evaluate: `ui.js` 77 ms and `fuse-art.js` 62 ms.
- The CSS is 1.23 MB in 19 files, about 3,270 `{` blocks.

**Memory:**

| Where | JS heap | DOM nodes (after forced GC) | Canvases | Layers | Device px (upper bound) |
|---|---|---|---|---|---|
| Home at start | 2.3 MB | 1,027 (615 elements) | 17, 3.1 MB | 56 (47 drawing) | 38.5 M (about 147 MB) |
| Home after visiting every tab | 2.6 MB | **1,942** | | | |
| Spire run | 3.1 MB | 3,191 (796 elements) | 92 (baked sprites, all small), 3.4 MB | 76 (94 to 121 in other samples) | 24.8 M |
| Spire run in Rush | | 3,303 | | | 34.2 M (about 131 MB) |

- JS heap and canvases are small. **Layers are the memory**: at DSF 3 every css pixel of a layer costs 9 device pixels
  (36 bytes).
- The upper bound assumes every layer is fully rasterized. The compositor tiles scrolling layers, so treat it as a ceiling.
  The non-scrolling full-screen layers (blobs, vignette, `#app`, the fx canvas, the Rush sky) are fully rastered.
- The chest memory step of `startup.js` did not complete in this session, because the page closed after the Rush sample. A
  separate repro of the same steps did not crash, so this is not a game bug as far as this audit can tell.

---

## 2. Hot spots, with evidence and fixes

### H1. Opening a sheet restyles the whole app (menus, everyone)
- **Evidence.** `paintprof.js` (WHAT=item) shows the item sheet's first style pass touching 1,347 elements: 522 ms wall and
  314 ms CPU at 4x.
  - The invalidation trace names `MAIN#screens | Invalidation set invalidates self` plus "Related style rule".
  - `css/base.css:280-281`: `html.under-overlay #screens *, html.under-overlay #screens *::before, ... html.under-overlay .bg *
    { animation-play-state: paused !important }`. A class on `<html>` combined with a descendant `*` makes the browser restyle
    every element under `#screens` and `.bg`, on open and again on close.
  - The same pattern is in `html.idle ... #screens *` (`css/base.css:313`), so the first touch after 20 idle seconds pays it on
    the tap frame.
- **Fix.**
  - Pause only what animates: list the animated menu selectors (about 25: `.blob`, `.mb`, `.hero-glow`, `.hero-art`, `.ba-spark`,
    `.hero-play`, `.cc-halo`, `.cc-art .chest`, `.dp-glow`, `.ch-glow`, `.ch-ico`, `.lb`, `.dot`, `.pt.next ...`; css/perf.css
    already lists most of them) as `html.under-overlay :is(...)`. The invalidation set then holds those classes only, and about
    30 elements restyle instead of 1,300.
  - Alternative: pause them from JS with `Animation.pause()` on a cached list. Never call `getAnimations()` on the tap frame.
  - Add a test that fails when a rule keyed on a root class has a bare `*` descendant.
- **Expected gain.** The sheet's first frame drops by the style share: about 584 to about 200 ms at 4x, and 938 to about 300 ms
  for the 6x odds sheet.
- **Visible change.** None: the same animations pause.

### H2. The tap frame does every effect of a big moment at once, and forces layout in the middle (runs, heavy loadouts)
- **Evidence.** `tapjs.js` with LOADOUT=spire, Rush start, gives 434 ms of inclusive JS in the pointerup handler:
  - `Skins.onEvent` takes 408 ms. Inside it, Constellation `rushStart` → `SKY` (`js/s4-pops.js:851-911`) takes 263 ms (the function only builds a two-constellation SVG string, so most of that is the style/layout pass forced by its `innerWidth`/`innerHeight` read), and
    Sigil's runes (`js/s4-skins.js:541`, `runeFrame`) take 107 ms.
  - `runprof.js` shows that frame with `EventDispatch 504 | UpdateLayoutTree 497 (717 elements)`: the class change for Rush is
    styled synchronously inside the handler, because the moment code reads layout.
  - The layout reads include `innerWidth`/`innerHeight` in `SKY`, `boardRect()` → `getBoundingClientRect` (`js/s4-pops.js:56`,
    `js/s4-skins.js:265-276`), and `#fuseFill`/`#bomb` rects (`js/skins.js:62-142`).
  - There are also restart-by-reflow calls: `void el.offsetWidth` at `js/s4-skins.js:291` and `js/skins.js:132`.
  - Stage clear: `sigilRipple` takes 43 ms, of which `boardRect` (getBoundingClientRect) is 31 ms.
- **Fix.**
  1. **Geometry cache.** `view.layout()` already caches the board origin (`_rc`). Extend it to one `BR.Geo` object (board
     rect, cell size, viewport size, fuse readout, bomb and tag rects) refreshed on layout/resize and after the run screen
     settles. All moment code reads from it.
  2. **Replace reflow restarts** with `BR.replay` (double rAF, as Update 6 did) or WAAPI.
  3. **Order the moment.** The tap frame does what the player must feel at once: the pop, the score, the Rush class and flash.
     The decorative layers (Constellation sky SVG, rune ring, tower moon, set flourishes) start in the next frame or two.
     Use a small `BR.later(fn, frames)` queue that runs at most one heavy job per frame.
  4. **Build the sky once.** `SKY()` can be built once per viewport size and cloned.
- **Expected gain.** The Spire Rush start frame goes from about 1 s wall (430 ms CPU) to about 300 ms at 4x: one style pass
  instead of two, the decoration spread over 2 to 3 frames. Every loadout with moment hooks gains on stage clears.
- **Visible change.** None. Each layer starts within 16 to 33 ms of the tap, under the Rush flash.

### H3. The results screen is built and measured in one long task (runs, everyone)
- **Evidence.**
  - The "end" frame in every run: 290 to 753 ms wall (default), 1,234 ms (Spire), 843 ms (Isles). It is
    `TimerFire/RunMicrotasks` (`endRun` → `showResults`) plus a style pass over 793 to 1,139 elements.
  - `tapjs.js`: `showResults` takes 205 ms, of which 191 ms is `getBoundingClientRect`. `js/run.js:1126-1128` measures every
    `.rev` item to decide which ones are on the fold, which forces style and layout of the whole new results DOM in the same
    task.
- **Fix.**
  1. Decide the fold without measuring: reveal order by index, with a CSS cap on the delay. An IntersectionObserver per item
     is also asynchronous.
  2. Insert the hero, score, Coins and XP first. Add the missions, trophies and next-goal blocks in the following frames, with
     `content-visibility: auto` and `contain-intrinsic-size` on the lower blocks.
  3. Build the HTML string during the fuse explosion, which already waits about a second, and insert it when the wait ends.
- **Expected gain.** About 50 to 60% off the end frame: no forced layout, and about 300 elements in the first pass instead of
  800 to 1,100.
- **Visible change.** None: the cards already reveal in order with a stagger.

### H4. Every pop creates and destroys dozens of layers, so Commit is the biggest cost of a pop (runs, everyone)
- **Evidence.**
  - Across all loadouts, Commit is the largest main-thread item in pop frames: 12 to 29 ms CPU per frame at 4x, against
    4 to 10 for style.
  - `poplayers.js`: a default run has 30 layers at rest and a peak of 78 during three pops. Spire goes 121 → 146.
  - `view.js` `_fall` (line 122) animates both the brick (`el`, translate) and its face (`.face`, the landing squash), so every
    falling brick is promoted twice for 0.3 to 0.5 s.
  - `_pop` animates `filter: brightness()` with transform/opacity on each popping face, which needs a render surface per brick.
  - `tapjs.js`: in a plain pop, `_fall` is 75 ms inclusive and `_make` 25 ms (at 4x, out of about 120 ms of pop JS).
- **Fix.**
  1. **One animation per falling brick.** Fold the squash into the brick's own fall keyframes: a scale about the bottom edge is
     `translate(x, y + h·(1 - sy)) scale(sx, sy)` with a top-left origin. The face then needs no animation and no layer, and
     there is half the layer churn in a refill.
  2. **Pre-build the spawn bricks.** Keep a small pool of brick elements (`_make` → reuse) so a refill does not parse
     `innerHTML` 6 to 30 times on the tap frame.
  3. **Prototype a cheaper flash.** A pre-made bright layer inside the face (`.face::after`, `plus-lighter`, opacity animated)
     gives the same `brightness(1 + a)` without a filter render surface: plus-lighter of the face over itself at opacity a is
     exactly c·(1 + a). Only adopt it if a side-by-side capture matches.
- **Expected gain.** Commit and Layerize in pop frames about -30 to 40%, which is about -6 to 10 ms CPU per pop frame at 4x.
- **Visible change.** None for (1) and (2). (3) only if the capture matches.

### H5. Animated skin decorations double their layer cost through the sheen (runs, animated skins)
- **Evidence.** `runlayers.js` on an idle Spire run shows 94 layers:
  - 21 `b.deco` (Sigil's `sgTurn` on the `.b3` bricks).
  - 21 `b.sheen`, 5.3 M device px. These are promoted only because they paint above a composited deco and overlap it.
  - 10 `.face` (hint pulse) and 3 full-screen layers.
  - The idle Spire run costs 18.2 ms CPU per frame at 4x (46 at 6x), with Commit 4.5 and Layerize 3.1. Performance mode, which
    stops the deco animations, takes the idle frame to 11.0 ms and Commit to 0.8.
- **Fix** (prototype both, keep the cheaper one that matches):
  - **(a) Fold the sheen into the face's paint for `.b3` bricks.** The in-run sheen already holds still (Update 6), so it can be
    one more background layer on `.face::before` *under* the deco only where the art allows. Where the highlight must sit over
    the deco, fold it into the deco's own element as a non-rotating child: the counter-rotating wrapper is a `translate`-only
    parent.
  - **(b) Draw the animated decorations of the board into one canvas** at about 30 fps from baked frames (each deco is a small
    vector glyph). This replaces 21 + 21 layers with 1, but the sheens above it would then need the same treatment as (a).
- **Expected gain.** About 40 fewer layers in an idle animated-skin run. Commit and Layerize at rest drop by about 3 to 5 ms per
  frame at 4x, which brings the Spire idle run under the 16 ms budget at 4x.
- **Visible change.** None intended. This is the one fix that needs a careful side-by-side check.

### H6. Chests: the spin's first frame paints 44 cards at once; the reveal paints a big card at once
- **Evidence** (`chestprof.js`).
  - **Spin's first frame:** 338 to 508 ms at 4x, 668 ms at 6x. That frame's work: style 325 ms, `step@spin.js:151` 108 ms
    (filling badge art in 4 ms slices, but the strip's first style and paint include everything already built), Layerize
    122 ms.
  - **Reveal first frames:** 469 to 830 ms (Brick, 4x), 282 to 1,471 ms (Golden, 4x). Paint is 63 to 80 ms CPU per frame plus a
    380-element style pass; one frame records 587 ms of paint.
  - **After the reveal:** one 672 ms PrePaint at 6x.
  - In the "holding" and late "spin" phases the main thread is mostly idle: 28 to 40 ms CPU per frame at 4x, and the spin's
    frames are compositor-driven.
- **Fix.**
  1. Build the reel strip and fill its art **during the hold**. The non-target cards do not depend on the roll, and the target
     card's art goes in first anyway.
  2. Keep the strip rendered but invisible, at `opacity: 0` under the chest rather than `visibility: hidden`, so its style,
     layout and first paint happen while the player holds. The spin then only flips the opacity.
  3. Build the reveal card and the item's `look` preview (`js/openings.js:598`) while the reel slows down (the item is known
     from the start of the spin), in the same invisible-but-rendered state.
- **Expected gain.** Spin and reveal first frames under about 100 to 150 ms at 4x. This is the single worst frame in the game
  today.
- **Visible change.** None.

### H7. Menus rebuild on every visit; the Collection paints and observes too much
- **Evidence.**
  - `js/ui.js` Router: a screen that is left is emptied after 800 ms (`el.textContent = ''`) and fully re-rendered on every
    visit.
  - Tab first frames are 140 to 486 ms at 4x, mostly style and paint of the whole new screen.
  - Collection (`paintprof.js`): 108 paint passes in its first 1.5 s, 533 ms of paint CPU, because every hydration step (4 cards
    per rAF, `js/screens.js:30`) repaints the scroll layer.
  - The `.scroll` layer is 393 x 2,849 css and `#colGrid` 362 x 2,353, so offscreen cards are recorded too.
  - The locked-tile IntersectionObserver (`js/screens.js:530`, rootMargin 900px, one target per tile) costs up to 133 ms in a
    single scroll frame.
- **Fix.**
  1. **Render on change.** Keep the last 2 to 3 visited screens with `content-visibility: hidden`, which keeps their style and
     layout state, plus a version stamp from `BR.Storage`. Re-render only when the data the screen shows changed. The DOM of a
     kept screen is a few hundred elements, small next to the layer memory in H8.
  2. **Skip offscreen cards.** `.icard`, `.lk`, the Shop chest cards and the Pass track cards get
     `content-visibility: auto; contain-intrinsic-size: auto <h>px`. Offscreen ones are then skipped for style, layout and
     paint, and the per-tile observer can go.
  3. **Hydrate in fewer, larger steps** in idle time (`requestIdleCallback` with a 4 ms budget per slice), so the scroll layer
     is repainted a handful of times instead of 108.
- **Expected gain.** Repeat tab visits about -50% (no rebuild). Collection first visit about -30% (less paint). Collection
  scroll worst frame about -100 ms.
- **Visible change.** None. The stagger entrance can still replay by class.

### H8. Layer memory on the menus (memory, low-RAM phones)
- **Evidence.** `menus.js` and `startup.js`, `LAYERS`:
  - Home holds 52 to 56 layers. The biggest are the three blobs, each 767 x 767 css (90vmax, `css/base.css:63-66`), about
    2,300 x 2,300 device px or about 21 MB each at DSF 3.
  - Then `#document`, `#app`, `.vignette`, `#tabbar` and `canvas#fx`, each the full 393 x 852.
  - Upper bound: about 147 MB on Home, 219 MB on the Collection.
  - In Rush the Constellation sky (`.s4-sky`, a full-screen SVG with 14 dots) and the 547 x 548 `#rushGlow` add another
    about 9 M device px.
- **Fix.**
  1. Each blob becomes a `<canvas>` of about 96 x 96 holding the same radial gradient, sized to 90vmax by CSS and animated by
     the same `drift` keyframes. The compositor scales the 37 KB bitmap, and a soft gradient upscales without visible
     difference (add 1-bit dither if banding shows).
  2. Fold the vignette into the `.bg` background so it does not need its own layer.
  3. Size the sky layer to the constellations' boxes, two small SVGs, instead of the full screen.
  4. Check why `#tabbar`/`button.tab` reports a full-screen layer: probably the `.tab.on svg` drop-shadow filter or the
     transition squashing with the indicator.
- **Expected gain.** About -60 MB of layer memory on Home and every menu, and less raster work when menus open.
- **Visible change.** None.

### H9. The run HUD writes to the page every frame (runs, everyone)
- **Evidence.**
  - `js/run.js:337-338` set `rushFill.style.width` and `rushLabel.textContent` every frame. Setting `textContent`, even to the
    same text, replaces the text node and dirties layout. In Rush the text changes 10 times a second but is written 60 times.
  - The only non-compositable animation in a run is a WAAPI `width` animation on `#rushFill` (`anims.js`, compositeFailed
    8224 'width').
  - `BR.Fuse.update` writes the rope's `scaleX` and the tip's `translate3d` from JS every frame while the fuse burns
    (`js/fuse.js:574-586`). That needs a main frame and a commit each frame, even though the burn is linear between events.
  - An idle run costs 13.7 ms CPU per frame at 4x (default) and 18.2 (Spire), with Layerize 3.4 and Commit 2.5 for the default.
- **Fix.**
  1. Write the label only when its string changes (`if (t !== last)`).
  2. Use `transform: scaleX()` for the rush fill instead of `width`.
  3. Hand the burn to the compositor: on each fuse event (pop, gain, freeze, Rush), start a linear WAAPI animation of the
     rope's scaleX and the tip's translate to the burn-out point over the remaining seconds. JS only touches them again at the
     next event. The readout digits and the 30 fps spark canvas stay as they are.
- **Expected gain.** Idle run main CPU about -3 to 5 ms per frame at 4x. On a phone this is the difference between waking the
  main thread 60 times a second and about 10.
- **Visible change.** None: the same linear burn, and the spring on gains stays in JS for its 0.4 s.

### H10. Particle drawing and particle counts (runs, flashy pops)
- **Evidence.**
  - `fx.loop` (`js/fx.js:219`) is 38 to 69 ms inclusive per profiled moment.
  - Each spark switches `globalCompositeOperation` to `lighter` and back and builds an `arc` path (`js/fx.js:~300`).
  - The whole 590 x 1,278 canvas is cleared every frame.
  - Wishdust peaks at 234 particles and is the costliest pop (70.7 ms CPU per frame).
  - Counts are fixed per setting (`budget`: 1 / 0.6 / 0.4).
- **Fix.**
  1. Bake a spark disc per colour once (the code already bakes sprites with `FX.bake`).
  2. Draw in two passes: everything `source-over`, then everything `lighter` with one state change.
  3. Clear only the dirty bounding box.
  4. Scale counts continuously (1.0 down to 0.6) from a running average of `fx.loop`'s own time, so a phone that keeps up keeps
     every spark.
- **Expected gain.** `fx.loop` about -40 to 50%. Heavy pops about -5 to 10 ms CPU per frame.
- **Visible change.** None at full count. The adaptive count only drops on phones that miss frames.

### H11. Smaller ones
- **Idle menus.**
  - About 6 main frames a second on Home (idle callbacks, timers) each restyle all 29 animated elements (`idleinval.js`):
    about 9 ms of style CPU per second unthrottled.
  - Fix: find the timer (an idle-callback chain shows as `FireIdleCallback` 5.3 ms/s) and stop it once the Home is up.
- **Collection tab entry.** `.icard ph` placeholders restyle with `DisplayLock` reasons on hydration; this is fine once H7 is
  in.
- **Detached DOM.** DOM nodes rise from 1,027 to 1,942 after visiting every tab once, even after a forced GC. Something keeps
  purged screens alive: a cached `NodeList`, the Collection's `_io`, or closures over old elements. Find it with a heap
  snapshot (`Detached HTMLDivElement`).
- **Startup.**
  - About 800 KB of the CSS is board scenes (`s4-scenes.css` 484 KB, `u4-boards.css` 206 KB, `s3-scenes.css` 112 KB), parsed
    at every start (24 to 61 ms) and held in memory, while one board is worn.
  - Loading the scene CSS for unequipped boards on the first Collection, Shop or chest visit (`<link media="print"
    onload>` or an injected link) cuts startup parse and the style-rule set every menu style pass searches.
  - `fuse-art.js` evaluation (62 ms at 4x) can wait until after the first frame.

---

## 3. Auto graphics (`BR.Gfx`, `js/main.js:8-25`): is it reacting well?

**No.**

### How it works today
- During a run on Auto, `run.js:250-254` averages the rAF interval over 180 frames (about 3 s). Each frame's dt is capped at
  0.1 s.
- If the average is above 26 ms (38 fps), `BR.autoLow` turns on. That is the whole Smooth bundle at once: s4-skins, sets and
  cosmetics go "calm", fewer particles, a lower-resolution fx canvas, no fuse effects and no convolver.
- It turns off again only if the average is **below 12.5 ms**, and only while lifetime `flips < 3`.
- The result is saved per device in localStorage.

`gfxsim.js` feeds the sampler typical averages:

| Situation | Decisions (H = full, L = lowered) |
|---|---|
| 60 Hz phone, smooth | HHHHHHHHHH |
| One slow 3-second window (30 ms), then smooth 60 Hz for 20 windows | LLLLLLLLLLLLLLLLLLLLL, lowered for good |
| Low Power Mode (rAF capped at 30 fps) for 3 windows, then normal 60 Hz | LLLLLLLLLLLLLLLLLLLLLLL, lowered for good |
| 120 Hz phone dips once, then 120 Hz | HLHHHHH (comes back only because 120 Hz frames are 8.3 ms) |
| Borderline 36 to 40 fps | HLLLLLLLLL |

### Problems
1. **The way back up does not exist on a 60 Hz screen.** A 60 Hz frame is 16.7 ms and the threshold is 12.5 ms. Most
   Android phones, iPhones without ProMotion, and every iPhone in Safari (which caps rAF at 60) can never get effects back.
2. **One bad moment is permanent.** It is saved in localStorage per device. A thermal dip, a background download, or Low
   Power Mode (iOS caps rAF at 30 fps) all count, and the 3-flip lifetime cap means even 120 Hz phones run out of chances.
3. **All or nothing.** One switch removes the moving board scene, skin moments, set flourishes, fuse effects and 40% of the
   particles. A phone that only struggled with particles loses everything.
4. **It measures rAF interval, not work.** It cannot see headroom (a phone at 15 ms of work and one at 5 ms both read
   16.7 ms) and it cannot tell which effect is expensive.
5. **It averages calm and busy frames.** Pops can run at 25 fps while the 3-second average still reads 40 fps, and the
   moments that matter are the pops.
6. **It never samples menus or chests**, where the worst frames are (H1, H6, H7).

### Proposed: a quality ladder with per-frame budget tracking
- **Know the display first.**
  - Take the median rAF interval over the first 60 calm frames: 8.3, 11.1, 16.7 or 33.3 ms. Every later judgement is relative
    to it, so 30 fps Low Power Mode reads as "on budget", not "slow".
  - Re-detect when `document.visibilityState` changes, and when the interval jumps (Low Power Mode switching on mid-run).
- **Measure work, not just intervals.**
  - Per frame, record the rAF interval and a "busy" estimate: the time from the rAF callback's start to the end of the
    game's own work (`performance.now()` at the end of `Run.frame` and `fx.loop`), plus long tasks.
  - Where supported (Chrome 123+ on Android), use the Long Animation Frames API: `PerformanceObserver('long-animation-frame')`
    gives style, layout and script time per frame.
  - Keep two exponential averages, **calm** and **action** (the 700 ms after a tap, a Rush start or a stage clear), and a
    missed-frame rate (intervals above 1.5 x the refresh interval).
- **Step one tier at a time, cheapest-to-notice first, with hysteresis:**

  | Tier | What changes | Who notices |
  |---|---|---|
  | 0 | Full | |
  | 1 | fx canvas DPR 1.5 → 1.25. Board-scene ambient loops pause for the 600 ms after a pop. Particles drawn at 30 fps for the 300 ms after a big pop | Nobody |
  | 2 | Particle count scales continuously 1.0 → 0.7 from `fx.loop` cost (H10) | Hardly anyone |
  | 3 | Animated skin decorations on 1/6 of the board instead of 1/3. The Rush sky and set flourishes start a frame later | Hardly anyone |
  | 4 | Today's Smooth (`lowEnd`) | Visible |
  | 5 | Performance mode, offered with a one-tap toast, never switched on silently | Visible |

  - **Step down** when the action average misses more than 25% of frames, or the calm average misses more than 10%, over 2 s.
  - **Step up** after 20 s with under 5% missed frames.
  - Never change tier during a pop or a chest reveal: apply it at the next calm moment.
  - Toast only from tier 4 up.
- **Remember softly.**
  - Store the tier with a date. A new session starts one tier above the stored one and steps down again only if needed.
  - Low Power Mode (detected as a 33 ms refresh) and `document.hidden` periods never count.
  - Drop the lifetime flip cap. The hysteresis and the 20 s step-up delay already prevent flapping.
- **Seed it, do not decide with it.** `navigator.deviceMemory <= 2` or `hardwareConcurrency <= 4` (Chrome only) can choose the
  starting tier.
- **Menus and chests.**
  - Sample the same way on menus (the first frame of a tab or a sheet counts as action).
  - The tier can choose how many reel cards are pre-painted per frame during the hold (H6) and how much hydration happens per
    frame (H7).

The visuals stay full on any phone that keeps up. A phone that struggles loses the least visible thing first, and gets it
back when it recovers.

---

## 4. What this audit did not cover

- **Real devices.**
  - Safari/WebKit was not tested. Its style engine and compositor differ, and WebKit does not support `content-visibility`
    before Safari 18. Every `content-visibility` fix needs a fallback that is simply the current behaviour.
  - GPU raster was not tested: the harness rasters in software, so Paint and raster costs are over-weighted here, while
    Commit, Layerize and style match a phone more closely.
- **Wall-clock precision.** The other load on the machine made frame wall times noisy. Rerun `runprof.js`, `menus.js` and
  `chestprof.js` on a quiet machine before and after each fix, and compare main-thread CPU per frame first.
- **Battery and thermal behaviour** was not measured.

## 5. Scripts (`audit-scripts/perf/`, Node with Playwright; `RATE=4|6`, `PM=1` for Performance mode)

| Script | What it does |
|---|---|
| `lib.js` | Shared harness: launch, a full save, a loadout, throttling, a frame recorder, trace totals (wall and CPU), longest-frame breakdown, per-phase CPU, layer report |
| `menus.js` | Tab-switch first frames, idle per screen, Collection and Shop flings, sheet opens, layers and DOM per screen |
| `runprof.js` | A run phase by phase (idle, pops, Rush, stage, Last Spark, end, results) with Event Timing tap latency. `LOADOUT=default\|spire\|potion\|aurora\|galaxy\|isles\|alchemy\|tower` or `SKIN/POP/BOARD/FUSE/SHINE/HAT` |
| `popsweep.js` | The nine Moonwick pops plus Classic on the same board |
| `tapjs.js` | Inclusive JS profile of each big moment (plain pop, Rush start, stage clear, Last Spark, run end) |
| `chestprof.js` | A whole chest opening, per phase (copied from Update 6, now with `RATE`, `PM` and per-phase CPU) |
| `startup.js` | Startup timing and load work, then memory: heap, DOM counters, every canvas, layers on Home and in a run |
| `anims.js` | Running animations and whether each can run on the compositor (`WHERE=home\|shop\|collection\|run\|rush`) |
| `poplayers.js`, `runlayers.js` | Layer churn during pops; layers by element in an idle run |
| `paintprof.js` | Paint of a screen's first frame by image, and the invalidations behind the biggest style pass (`WHAT=collection\|shop\|home\|item`) |
| `idleinval.js` | Style passes per second on an idle menu and why |
| `selstats.js` | Chromium selector statistics for a scenario. Selector matching was only 43 ms of the Collection switch, so the style cost is the number of elements, not the selectors |
| `domcount.js` | DOM nodes by region on Home and in a run |
| `gfxsim.js` | How Auto graphics decides on typical frame-time averages |
