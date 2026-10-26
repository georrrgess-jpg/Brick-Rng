# Pop Rush Update 8: Mobile mode

**Status: built and verified on the test harness (section 7, "What shipped"). The one step that matters is the owner's: run Settings > Check
performance on the phone and send the report.** The plan below is kept as it was written; section 7 says where the build differs from it.
The plan was written to be carried out step by step: every item says where the code is, what to change, how to check it, and what must
not change.

**What the owner asked for.** The game still lags on phones, most of all when opening chests, when popping large groups, and during
Rush. Improve playability on mobile with the best methods available; if it is viable, add a **Mobile mode** setting that makes
performance substantially better; keep as much of the game's flair as possible.

**The short answer.** Mobile mode is viable and is the core of this update. It does not switch effects off the way Performance mode does.
It keeps the same effects and draws them more cheaply: fewer animations per brick, soft glows and rays drawn at low resolution and
scaled up, shakes on the board instead of the whole screen, pre-rendered sounds, a particle budget that follows the phone's real frame
rate, and chest work moved into the moments when the player is waiting anyway. Around it, a lag meter measures the real phone, and the
game gets a home outside the Claude app, which on its own may be the biggest single gain.

---

## 0. Why the lag survived Updates 6 and 7

- **Every measurement so far came from a desktop browser imitating a phone** (Chromium, no GPU, CPU slowed 4x or 6x). It finds script,
  style and layout costs well. It cannot see what only a real phone does: WebKit's compositor on iPhone, GPU memory limits, the audio
  engine, the iPhone vibration workaround, or the cost of running inside the Claude app. WebKit is not installed in this environment,
  so the plan measures on the owner's phone instead (Phase 0).
- **The game runs inside the Claude app**, as a page embedded in a page embedded in an app. That is usually much slower than a browser
  tab or a home-screen app, and none of it is under the game's control.
- **What a big pop does today** (`js/view.js`): every popped brick runs its own burst animation that includes `filter: brightness()`
  (`_pop`, line 349); every falling brick runs two animations (`_fall`, line 123: the move and a separate landing squash on its face);
  every new brick is created from scratch with its inner HTML (`_make`, line 95) and two more animations; each popped brick schedules
  its own timer for its particles. A 20-brick pop starts well over 100 animations and creates and destroys dozens of compositor layers
  in a few frames. On top of that come the pop sound, built from roughly 5 to 25 new audio nodes on every pop, depending on its size (`js/audio.js` `popNow`, line
  385), and on iPhone a hidden switch toggled on every pop to fake vibration (`js/ui.js`, line 99).
- **Rush start, the Last Spark and chest bursts shake the whole screen** (`fx.shake($('app'))` in `js/run.js` `rushShow` line 808 and
  line 289; `fx().shake(this.root)` in `js/openings.js` line 363). Shaking the whole app turns everything on screen into one huge
  layer, which a phone at 3x density must redraw (about 12 MB) in the middle of the moment.
- **Chests:** the hold writes a progress value on the whole chest every frame (`js/openings.js` line 422), which restyles every chest
  part each frame. The reel builds 44 cards of badge art at the moment the spin starts (line 505). The reveal paints 1,100 to 1,200 px
  conic-gradient rays at 3x density (`css/chest.css` `.op-rays`, `.rv-rays`), plus a 64-brick "first look" board behind the card
  (line 614).
- **The effects canvas** (`js/fx.js` `loop`, line 219) is full-screen and is cleared and redrawn in full every frame while anything is
  alive, at up to 1.5x density.

The Update 7 performance audit (`docs/update-7/perf-lowend.md`, hot spots H4 to H10) measured most of these on the harness; they were
left for later in Update 7.

---

## 1. Targets

| Area | Target | Checked by |
|---|---|---|
| Real phone (owner's) | Lag meter (Phase 0) shows: median pop frame at most 20 ms; no pop frame over 100 ms on pops up to 20 bricks; Rush start and chest reveal worst frame at most 150 ms; with Mobile mode on | The lag meter's report, before and after |
| Harness, Mobile mode, 6x CPU (low-end stand-in) | Big pop (12+ bricks) main-thread CPU per frame down at least 40% from today; Rush start tap frame down at least 50%; chest spin and reveal first frames at most 150 ms; layers during a pop at most 45 (78 today) | `docs/update-8/scripts/popprof.js`, `chestprof.js`, `tapjs.js`, `layers.js`; `docs/update-7/audit-scripts/perf/runprof.js` |
| Flair | Side-by-side frame sheets of a 20-brick pop, a Line Blast, a Rush start, a stage clear and every chest reveal, Mobile mode against Pretty: the same effects visible in each | Contact sheets checked by eye; `tests/moments.js`, `tests/u5-*.js` |
| Nothing else changes | Pretty and Auto on desktop look exactly as before; all suites pass | Full suite |

---

## 2. The plan

Five phases. Each ends with its own tests green, a commit and a push. Run the targeted suites per phase; run the full suite once at
the end (it takes about 90 minutes: `u5-fuses` alone is 24 minutes, `u5-older` 11).

### Phase 0. Measure the real phone, and get the game out of the Claude app (do first)
1. **Lag meter.** New `js/perfmeter.js`, registered in `index.html` and the service worker's file list (`sw.js`).
   - Settings gets a "Check performance" row. It starts a scripted test in a practice board that nothing is saved from (reuse the Try
     it practice path in `js/run.js`): 10 pops of rising size (2 to 24 bricks, using the `BOARDS` fixtures style of `tests/u5-run.js`),
     one Line Blast, one Rush start, one stage clear, then a practice chest opening (hold, burst, spin, reveal) that consumes nothing.
   - For each moment it records: rAF frame gaps for the next 1.5 s (worst, median, frames over 50 ms), the game's own script time
     (`performance.now()` around the tap handler, `view.playResult`, `fx.loop`, `audio` calls and `BR.haptic`), and Long Animation
     Frames where supported (`PerformanceObserver('long-animation-frame')`). Frame time minus script time is reported as "rendering".
   - The report adds: user agent, screen size, devicePixelRatio, detected refresh rate (from `BR.Gfx`), `navigator.deviceMemory`,
     `hardwareConcurrency`, whether the page is embedded (`window.top !== window`), and the settings (Mobile mode, Graphics,
     Performance mode, Sound, Music, Vibration).
   - It shows a short summary and a "Copy report" button (plain text) for the owner to paste into the chat.
   - It can also run each moment with sound off, vibration off and Mobile mode on or off, so one report shows which of them matter.
2. **A home outside the Claude app.** Add `.github/workflows/pages.yml` that publishes the repository root to GitHub Pages on every push
   to the branch. The game is already an installable, offline web app (`manifest.webmanifest`, `sw.js`), which only works fully on its
   own address. README gets three lines: the address, "open in Safari, Share, Add to Home Screen". **Owner step:** GitHub repository
   Settings → Pages → Source: GitHub Actions (Pages on a private repository needs a paid plan; otherwise make it public).
3. Publish (bundle and Artifact) right after Phase 0, so the owner can take a "before" report on the phone, both in the Claude app and
   from the Pages address. The rest of the plan does not wait for it; the report decides the order of fine-tuning in Phase 4.

### Phase 1. Cheaper for everyone, nothing visible changes
1. **One animation per falling brick** (`js/view.js` `_fall`, line 123). Fold the landing squash into the fall's keyframes on the brick
   element itself (set `transform-origin` to the bottom or top centre for the fall direction, and add `scale(...)` to the last
   keyframes after the `translate`). Same curve, same squash, half the animations.
2. **New bricks without parsing.** `_make` (line 95) clones a prepared brick template (`template.content.firstElementChild.cloneNode(true)`)
   instead of setting `innerHTML`; a pop's new bricks go into the field in one `DocumentFragment`. Keep the existing ids, classes
   (`b3`, `fusebrick`) and `data-c`.
3. **One schedule per pop instead of one timer per brick** (`_pop`, line 349, the `setTimeout(..., delay + 70)`): collect the bricks'
   particle bursts and run them from one `requestAnimationFrame` loop in delay order.
4. **Pre-rendered sounds** (`js/audio.js`). Render each pop layer (the three timbres, the click, the chord tones and the sub, per scale
   degree; each Series 4 flavor per degree on first use) once into an `AudioBuffer` with an `OfflineAudioContext`, cache it, and play a
   pop as one or two `AudioBufferSourceNode`s with a gain and a pan. The first use of a sound may still synthesize live while its buffer
   renders in the background. It must sound the same: compare `tests/audio.js` renders before and after (peaks, loudness, pitch).
5. **iPhone vibration** (`js/ui.js` `BR.haptic`, line 99): the hidden-switch toggle runs at most once per 120 ms, and never for a plain
   pop of fewer than 5 bricks (big pops, Rush, stage clears, Line Blasts, chests keep it).
6. **Chest hold** (`js/openings.js` line 422): stop writing `--hold` on the whole chest. Write the values that use it (`.cp-glow` and
   `.cp-leak` opacity, the ring, the glow, the rays: `css/chest.css` lines 13 to 47 use `var(--hold)` 8 times) directly on those few
   elements, or register `--hold` with `@property { syntax: '<number>'; inherits: false }` and set it only on the elements that read it.
7. **Effects canvas clears only what it drew** (`js/fx.js` `loop`, line 219): keep a bounding box of last frame's drawing and clear that
   rectangle instead of the whole canvas.
- Check: `tests/u5-run.js`, `tests/u5-pops.js`, `tests/moments.js`, `tests/audio.js`, `tests/u5-chests.js`, `tests/flow.js`,
  `tests/touch.js`, `tests/perfbudget.js quick`; before and after with `popprof.js` (default, `SKIN=f_potion SHINE=prism`,
  `SKIN=f_galaxy`) and `chestprof.js` (`NOTRACE=1`, `CHEST=brick` and `golden`).

### Phase 2. Mobile mode (the main phase)
**The setting.** "Mobile mode: smoother on phones, same look" in Settings, at the top of "Play and display" beside Performance mode.
Saved as `settings.mobile`. **On by default on phones**: on first launch it is set when `matchMedia('(pointer: coarse)')` matches and
the screen's short side is under 600 px; it can be switched off. It sets `BR.mobileMode` and `html.mobile-mode` in
`BR.App.applySettings` (`js/main.js`), next to `perf-mode`. Performance mode stays as the strongest option and implies Mobile mode.

| What | In Mobile mode | Where |
|---|---|---|
| Brick burst | Same scale-up, spin and shrink, but no `filter: brightness()` keyframes; the bright flash is one small baked glow sprite per brick drawn on the effects canvas | `js/view.js` `_pop`; `BR.FX.bake` in `js/fx.js` |
| Big pops | Every brick still bursts; bricks beyond the 14th burst in small batches over the next 2 or 3 frames, and their particle count is shared out instead of multiplied | `js/view.js` `playResult` (line 295) |
| Particles | A frame-time-aware budget: starts at 70% of Pretty and moves between 50% and 100% with the measured frame time (the `BR.Gfx` refresh detection from Update 7 knows the screen's rate). Spawns are capped per frame and spread over the next frames instead of dropped | `js/fx.js` `budget` (line 34), `emit`; `js/s3-pops.js`, `js/s4-pops.js` already scale by `n` |
| Effects canvas resolution | 1x density instead of 1.5x (particles are soft; the difference is not visible on a phone) | `js/fx.js` `resize` (line 24); `js/fuse.js` particle canvas |
| Shakes | The board shakes instead of the whole screen (Rush start, Last Spark), the chest stage or the card instead of the whole opening | `js/run.js` lines 289 and 808; `js/openings.js` line 363 and the reveal steps (lines 647 to 682) |
| Soft glows and rays | Drawn once into small canvases (about 256 px) and scaled up with CSS: chest rays and glow, reveal rays and spotlight, the Rush sky, the menu colour blobs. Same look (they are soft gradients), a fraction of the pixels | `css/chest.css` `.op-rays`, `.op-glow`, `.rv-rays`, `.rv-spot`; `css/base.css` `.blob`; the Rush sky in `js/s4-scenes.js` |
| Skin decorations | Keep moving, but pause for 600 ms after each pop and during the Rush start, when the board needs every frame (`.field.busy` class) | `css/skins.css`, `css/u4-skins.css`, `css/s3-skins.css`, `css/s4-skins.css` (one shared rule) |
| Rush | Per-brick Rush decorations only on the `b3` bricks (a third of the board), confetti at 60%, the sky low-resolution | skins CSS `.run.rushing` rules; `js/run.js` `rushShow` |
| Chest reel | 30 cards instead of 44, rolled when the hold starts (split `BR.Progress.openChest` into roll and commit, so letting go early still consumes nothing) and built and painted invisibly during the hold, a few cards per frame | `js/openings.js` line 505, `BR.buildStrip`; `js/spin.js` `fillArt`; `js/progress.js` |
| Chest reveal | No "first look" board behind the card; the item demo in the card at the Mobile particle budget | `js/openings.js` line 614, `heroDemo` |
| Menus | Offscreen Collection and Shop cards use `content-visibility: auto` with `contain-intrinsic-size` (older Safari ignores it and behaves as today) | `css/screens.css` |
| iPhone vibration | Big moments only (as Phase 1, plus no per-pop toggles at all) | `js/ui.js` |

- New `tests/u8-mobile.js`: the setting saves and applies, defaults on for a coarse-pointer phone and off for desktop, no
  `filter` keyframes in pop animations with Mobile mode on, the board (not `#app`) shakes, the reel has 30 cards and still lands on the
  drop (`tests/spin.js` logic), letting go of the hold early consumes nothing, the low-resolution canvases exist and are the right
  size, and the particle budget stays between its limits.
- Check: the Phase 1 suites plus `tests/u5-sets.js`, `tests/u5-boards.js`, `tests/u5-skins.js`, `tests/u7-mobile.js`,
  `tests/u7-perf.js`; the harness targets in section 1 at 6x; frame sheets against Pretty (the Flair target).

### Phase 3. Rush and chest moments, for everyone
The Mobile mode work above is applied to everyone only where it is invisible. Do these regardless of Mobile mode:
1. **Prepare before the moment.** Build the Rush banner and its sky when the Rush bar passes 80%, and the reveal card while the reel
   slows (Update 7 already prepares the card two frames after landing; move it to the last second of the spin).
2. **Reel built during the hold** (from Phase 2's roll-and-commit split) for everyone, at 44 cards on Pretty.
3. **The Update 7 audit's remaining safe items:** H5 (an animated skin decoration should not drag a second layer for the sheen above
   it) and H9 (Rush bar width as `scaleX` with its rounded ends drawn by a separate element, so it looks the same).
- Check: as Phase 2.

### Phase 4. Tune on the real phone, then ship
1. The owner runs "Check performance" on the phone with the new build, in the Claude app and from the Pages address, with Mobile mode
   on and off, and pastes the reports.
2. Fix what the reports show is still slow, smallest change first. If the embedded report is much worse than the Pages one, say so
   plainly and recommend playing from the home-screen app.
3. Full test suite, `UPDATE-8.md` "What shipped" with before and after numbers (harness and phone), README, the service worker version
   (`sw.js` `VERSION` to `poprush-v8.0.0`), the bundle (`python3 tools/bundle.py <scratchpad>/poprush-bundle.html`), and the
   Artifact (https://claude.ai/artifact/7HECjpgK6379tjHEq4uPDt, same file path and URL).

---

## 3. How to measure (for the session carrying this out)

- **Scripts** are in `docs/update-8/scripts/` (copied from Update 6) and `docs/update-7/audit-scripts/perf/`:
  - `popprof.js`: six pops on the same Daily board. Environment: `PERF=high|auto|low`, `SKIN`, `SHINE`, `POP`, `BOARD`, `FUSE` (item ids
    such as `f_potion`, `f_galaxy`, `f_aurora`; shines `plain`, `glossy`, `holo`, `prism`), `EVAL` (run code in the page first, e.g.
    `BR.Storage.data.settings.mobile=true;BR.App.applySettings()`), `INJECT` (CSS), `TRACE=0` (frame numbers only), `RATE` (CPU
    slowdown, default 4), `ROOT` (an older checkout to compare).
  - `chestprof.js`: one chest opening, per phase. `CHEST=brick|pop|board|fuse|golden`, `NOTRACE=1` for frame numbers only.
  - `tapjs.js`: JS profile of the tap handlers. `layers.js`: layer count and size on Home and in a run. `inval.js`: what restyles during
    pops. `anims.js`: running animations.
  - `runprof.js` (`LOADOUT=default|spire|potion|...`): a whole run phase by phase.
- **Compare against the last build** with `ROOT=<checkout of the previous commit>` (`git worktree add <dir> <commit>`).
- **The machine may be shared**: compare main-thread CPU per frame where a script reports it, and run before/after back to back.
- Never use `pkill -f` or `pgrep -f ... | xargs kill`: the pattern matches the shell running it.

## 4. Decisions for the owner

The plan proceeds with the recommendation in each case unless the owner says otherwise.

| Question | Recommendation | Alternative |
|---|---|---|
| Mobile mode on by default on phones | Yes; it can be switched off in Settings | Off by default, the player turns it on |
| Shakes in Mobile mode | The board or the chest shakes, not the whole screen | Keep the full-screen shake and accept a hitch at Rush and chest bursts |
| iPhone vibration on small pops | Off (big moments keep it) | Keep it on every pop |
| A home outside the Claude app (GitHub Pages) | Yes; it is also the way to share the game with friends | Stay in the Claude app only |

## 5. Not in this update
- Drawing the whole board on a canvas. It would be the fastest possible design, but the 88 cosmetics are built from CSS
  and DOM; redrawing them all for a canvas is a rewrite, not an update. Mobile mode gets most of the benefit without it.
- New cosmetics, game rules or economy changes.

## 6. Size of the work
Phase 0 is small to medium (the lag meter and a workflow file). Phase 1 is medium, mostly `view.js` and `audio.js`. Phase 2 is the
largest (the setting, the low-resolution layers, the particle budget and the chest reel). Phase 3 is small. Phase 4 depends on the
phone reports. Expect a working session of several hours; the full test suite at the end adds about 90 minutes on its own.

---

## 7. What shipped

### 7.1 What is in the build
- **The lag meter** (Settings > Check performance, `js/perfmeter.js`). A one-minute scripted test on a practice board and a trial chest that
  saves, pays and counts nothing (`tests/u8-mobile.js` checks the save is untouched): pops of 2, 6, 12, 20 and 24 bricks, a Line Blast, a
  stage clear, the 12 and 24 pops again with sound and vibration off, a Rush start, and a chest's hold, burst, spin and reveal. It prints
  median, worst and slow frames per moment, the script time of the tap, and the longest long task where the browser reports it
  (Chrome), plus the device, screen, refresh rate, memory, whether the page is embedded, and the settings, with a Copy report button.
- **A home outside the Claude app**: `.github/workflows/pages.yml` publishes the game to GitHub Pages. Owner step: Settings > Pages >
  Source: GitHub Actions (a private repository needs a paid plan), then open the address in Safari or Chrome and Add to Home Screen.
- **Mobile mode** (Settings, first row of "Play and display"; saved as `settings.mobile`; decided once on first launch: on for a touch
  screen under 600 px on its short side, off otherwise; Performance mode includes it):
  - no brightness filter in the brick bursts (the swell, spin, shrink and fade stay, with the particles doing the flash);
  - bricks past the 14th of a big pop burst in small batches a few frames apart, with two fewer shards each;
  - a particle budget that starts at 70% and moves between 50% and 100% with the measured frame time;
  - the effects canvas and the fuse's spark canvas at 1x instead of 1.5x;
  - Rush start and the Last Spark shake the board, a chest burst shakes the chest stage and a reveal shakes the card, instead of the whole
    screen (one huge layer to redraw in the middle of the moment);
  - the chest's light rays, the reveal's rays and the three colour blobs behind the menus are 256 px and 128 px canvases scaled up
    (`js/lowres.js`), not 1,100 px and 767 px layers (about 20 to 50 MB of graphics memory each at 3x density);
  - the heavy per-brick Rush looks of the Potion, Hourglass and Galaxy skins sit on the moving third of the bricks only (`.b3`), so a Rush
    start no longer repaints all 64 faces.
- **For everyone** (invisible changes):
  - one animation per falling brick (the landing squash is folded into the move, on one layer);
  - bricks are cloned from a template and a pop's new bricks are added in one batch;
  - one schedule runs a pop's effects instead of one timer per brick;
  - iPhone's fake vibration ticks at most every 120 ms for plain pops;
  - the chest hold writes `--hold` only on the few elements that read it (it used to restyle every part of the chest each frame);
  - the chest reel's 44 cards are made a few milliseconds a frame while the strip slides in, not all at once;
  - the spent chest (230 pieces) leaves the page during the spin.

### 7.2 Measured (harness: Chromium, no GPU, 393x852 at 3x, CPU slowed; `docs/update-8/scripts/bigpop.js`, `chestprof.js`)
Pops on one fixed board, back to back on the same machine. A real phone will differ; the lag meter measures that.

| | Update 7 | Mobile mode |
|---|---|---|
| Default skin, 4x: average frame over 9 big moments (pops of 6 to 24, Line Blast, stage clear, Rush start) | 22 to 33 ms | 21 to 28 ms |
| Default skin, 4x: frames over 50 ms in those 9 moments | 52 | 28 |
| Potion skin with Prism finish, 6x: average frame | 71 to 216 ms | 46 to 74 ms |
| Brick Chest, 4x: spin, worst frame | 221 to 553 ms | 187 to 289 ms |
| Brick Chest, 4x: reveal, average / worst frame | 40 to 72 / 158 to 247 ms | 18 to 28 / 49 to 116 ms |
| Brick Chest, 4x: after the reveal, average frame | 21 to 75 ms | 17 ms |

With Mobile mode off the build behaves about as Update 7 did on the default skin (the invisible changes are small there), and its gains are
largest with heavy skins and finishes, Rush, and chests. What a chest's first spin frame costs is mostly the strip's first paint, which
is not much changed.

### 7.3 Not done, and why
- **Pre-rendered pop sounds.** The synth already supports an offline graph, but rendering each pop layer to a buffer touches every
  timbre, Series 4 flavor and the audio tests' node log, for a gain of about a quarter of the tap script. Left until the lag meter shows
  sound is a problem on the owner's phone (its "sound and vibration off" rows measure exactly that).
- **A dirty-rectangle clear for the effects canvas.** Mobile mode's 1x canvas takes most of the benefit.
- **Preparing the Rush banner and reveal card earlier**, **the sheen/decoration double layer (H5)** and **the Rush bar as `scaleX` (H9)**
  from the Update 7 audit.
- **Building the reel during the hold or the burst.** Tried: it moved the cost into the hold and the burst (the hold's frames went from 27
  to 40 to 50 ms), so the cards are made in slices during the strip's slide-in instead.

### 7.4 The owner's steps
1. Open Settings > Check performance on the phone and send the report: once with Mobile mode on and once with it off; once in the Claude
   app and once from the GitHub Pages address if it is switched on. The "sound and vibration off" rows show how much those two cost.
2. If the report shows a moment is still slow, the next change is aimed at that moment.
