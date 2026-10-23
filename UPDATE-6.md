# Pop Rush Update 6: smoother on phones

**Status: built and verified on the test harness. The one step left is the owner's: play it on a real iPhone and a real Android
phone, with and without Performance mode.**

**What the owner asked for.**
1. Drastically less lag on mobile, mainly when popping bricks in a run and when opening chests.
2. A Performance mode as another way to cut lag.
3. Fix the UI bug on the Golden Chest screen.
4. Raise the Rush payout a little.

**How it was measured.** The same harness as Updates 4 and 5: Chromium with no GPU, a 393 x 852 page at 3x pixel density, the CPU
slowed 4x. Absolute times are higher than on a phone; the comparisons are what matter. Pops are six taps on the same Daily board
(the largest group each time) so every build sees the same game. Chest openings use the same drop each time. Before/after numbers
come from Update 5 (commit `4ab81af`) and this build, run back to back.

---

## 1. What was causing the lag

**Popping.**
- **Every pop restyled the whole board.** Seven skin families chose which bricks animate with `:nth-child(3n)`. When a pop
  removes bricks and new ones drop in, every brick's position among its siblings changes, so the browser re-matched the styles of
  all 64 bricks and everything inside them, on every pop.
- **Holo and Prism finishes.** Each brick carried a moving sheen blended over it (`mix-blend-mode: overlay`), and the board rim
  animated its gradient position. That is 64 blended, moving layers plus a full repaint of the board rim, every frame.
- **Animation restarts read styles.** `BR.replay` (used for the score bump, the combo, the stage tag and more) called
  `getAnimations()`, which forces the browser to finish all pending style work in the middle of the tap.
- **Every brick had its own GPU layer** (`will-change` and `translate3d`): about 130 layers to composite each frame of a run.
- **The fuse sparks redrew their canvas every frame**, re-uploading it and re-compositing the HUD.
- Paint-only loops (a `filter` on the idle hint, the Rush bar flare and the best-score bar; a `box-shadow` pulse on Play and
  on the Pass) repainted every frame.

**Chest openings.**
- **The menus behind the chest were still rendered.** They were only `visibility: hidden`, so every change during the opening
  restyled and laid them out too.
- **The spent reel stayed on the page.** After landing, 44 cards (about 1,300 elements) sat hidden under the reveal and went
  through every style pass of the reveal's first frames.
- **Huge layers**: light rays 1500 to 1700 px square, a dust layer 2400 px tall, the whole opening scene still animating under
  the reveal card, and a card shine that repainted the card every frame.

**The Golden Chest bug.** Before a type is picked, the chest art was sized by the screen width only, so on taller narrow screens
and in landscape it grew over the type picker and covered some of its buttons.

## 2. What changed

**For everyone (no setting needed).**
- Skins choose their animated bricks with a fixed class given when the brick is made (`.b3`, by brick id), so a pop only
  touches the bricks it changes. `tests/u6-perf.js` fails if any brick rule picks bricks by sibling position again.
- On the play board, Holo and Prism sheens and the Holo/Prism board rim hold still (menus, previews and the reveal keep them
  moving). Bricks no longer get their own layers; a brick that moves is promoted only while it moves.
- `BR.replay` restarts an animation by taking the class off and putting it back two frames later. No style reads.
- The fuse sparks are drawn at about 30 frames a second (every frame on Pretty).
- The idle hint, the Rush bar, the best-score bar, the Play button and the Pass "next" marker animate transform or opacity only.
- The Missions tab dot stops pulsing while the tab bar is hidden in a run.
- During a chest opening the menus behind are skipped by rendering (`content-visibility: hidden`), the spent reel leaves the
  page as the reveal starts (the card covers it within a few frames), the opening scene stops once the card is up, the ray and
  dust layers are about half the size, and the card shine moves instead of repainting.
- The chest is sized by the space it actually has (a container query on the stage), so it never covers the Golden Chest picker
  at any screen size, and the Golden Chest line before a pick reads "Skins, Pops, Boards or Fuses: choose above".

**Performance mode** (Settings, under Reduce motion). It is Smooth plus:
- no floating bricks behind the menus, and the colour blobs hold still;
- menus appear at once with no stagger, and nothing loops (Play pulse, halos, glows);
- no finish sheens on bricks, skin decorations hold still, the board scene and Rush glow hold still;
- chest openings without light rays, dust, spotlight or stars;
- fewer pop sparks (40% of the full count).

The bricks, pops, falls, the fuse, the hint and Screen shake (still its own switch) are unchanged. The Graphics choice is greyed
out while Performance mode is on. The rules live in `css/perf.css`, loaded last.

**Rush payout.** The score part of a run's Coins goes from `14 x sqrt(score / 45000)` to `16 x sqrt(score / 45000)`. The stage
bonus is unchanged, so a run pays about 10% more: a casual run 21 to 24 Coins, the bot averages 29, 53 and 66 for casual, average
and sharp players.

## 3. Measured results

**Popping** (six pops, average frame and frames over 50 ms, Graphics on Auto):

| Loadout | Update 5 | Update 6 | Update 6, Performance mode |
|---|---|---|---|
| Default | 26.7 ms, 23 frames | 25.5 ms, 16 | 21.1 ms, 9 |
| Aurora skin, Holo finish | 54.5 ms, 97 frames | 29.2 ms, 31 | |
| Potion skin, Prism finish | 80.1 ms, 119 frames | 31.5 ms, 32 | 25.2 ms, 19 |
| Galaxy skin | 30.5 ms, 32 frames | 28.0 ms, 36 | 24.6 ms, 19 |

On Pretty with the default loadout, frames over 50 ms went from 18 to 10. The style passes during three pops went from about 7,100
restyled elements to about 5,800, and the "whole board" invalidations are gone.

**Brick Chest opening** (average frame, worst frame in brackets):

| Phase | Update 5 | Update 6 |
|---|---|---|
| Holding | 23 ms | 21 ms |
| Spin | 24 to 25 ms (248 to 398) | 20 to 22 ms (167 to 276) |
| Reveal, first frames | 62 to 95 ms (238 to 326) | 24 to 28 ms (110 to 127) |
| After the reveal | 33 to 34 ms (158 to 170) | 17 to 18 ms (24 to 38) |

## 4. Open items

- Real-device check (owner): a run with a Holo or Prism finish, a Brick Chest and a Golden Chest, on Auto and in Performance mode,
  on an iPhone and an Android phone.
- The remaining cost of a pop on the harness is spread over the browser's own work (style, layering, commit) rather than any one
  thing in the game; a phone's GPU does much of that work faster than the harness.
- Auto still lowers effects when a run averages slower than about 38 frames a second; it does not switch on Performance mode
  by itself.
