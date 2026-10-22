# Update 5 audit: the run screen, chest openings and every cosmetic (input to Phases 2 and 4)

Audit of the run screen in every state, the five chest openings, and all 62 cosmetics (58 items and the 4 defaults), made on the
Update 4.1 build before Update 5 started. Read-only: nothing in the game was changed. The scripts that produced the evidence are
in `audit-scripts/run/` (screenshots go to `shots/` next to them, which git ignores; the screenshots are not kept in the
repository). File and line references are to the Update 4.1 code.

**How it was tested.** Chromium at 393x852, with spot checks at 360x640, 844x390 and 1280x800. Animations were captured in slow
motion (playback rate 0.1, with the game clock slowed to match), so the frame times in sheets are approximate. Colour distances
are CIEDE2000 between average brick colours taken from screenshots: good for ranking skins, not exact. Safari, haptics, 120 Hz and
real-phone safe areas were not tested. There were no console or page errors in any run.

**Counts.** 0 blocker, 9 major, 15 minor, 15 polish.
- Skins: 12 good, 10 need polish.
- Pops: 13 good, 4 need polish.
- Boards: 8 good, 4 need polish.
- Fuses: 9 good, 2 need polish.
- Every fuse badge is broken (K-1).

## Run screen (R)

| ID | Sev | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|
| R-1 | major | On 8+ pops and Line Blasts, the callout, the score float, the combo float, the time chip and "GOAL! +10 Coins" all print at the board centre at once; worst on 12+ pops | pop sheets at 12 bricks and a Line Blast | One message slot with a priority queue; floats offset from the callout; the goal message goes to the message band |
| R-2 | major | When one pop both starts Rush and clears a stage, "RUSH!", the STAGE 2 wipe and "INSANE!" overlap for about a second | pop sheet at 24 bricks | Sequence them: stage-up first, then Rush, and drop the size callout |
| R-3 | major | Fuse bricks hide their colour. All seven colours look the same dark purple, yet each still groups only with its hidden colour (one joined a 10-brick group, another formed only a pair) | Fuse brick colour sheet; css/run.css:168-169 | Keep the brick's colour and draw the countdown and fuse ring on top |
| R-4 | major | On Beach and Greenhouse the fuse readout loses its urgency colours: board CSS forces the number white or pale green at calm, low and critical | css/s3-scenes.css:88, css/u4-boards.css:222 | Boards may not set the readout colour; the urgency states always win |
| R-5 | major | A completed mission on the results draws a 116x116px check icon (no size rule) | js/run.js:817 | Size the icon like the other result rows |
| R-6 | minor | The goal pill overflows when its text wraps: 3 of 16 goal and state cases at 393, 13 of 16 at 360x640 and at 844x390 | goal pill screenshots | Two-line pill with a fixed height, or shorter goal texts |
| R-7 | minor | At its peak scale the "RUSH!" banner is clipped at both screen edges (393 and 360) | Rush start frame at 800ms | Clamp the font size to the screen width |
| R-8 | minor | The Last Spark flame on Fizz's wick overlaps the pause button (taps still reach Pause) | Last Spark screenshots at 393 and 360 | Lean the flame away from the button, or move it under |
| R-9 | minor | The red vignette comes back after the run ends: `endRun` clears it, then `Fuse.update` switches back to critical and shows it again (opacity 0.7) through the explosion and crumble | js/fuse.js:463 | Stop fuse updates once the run is over |
| R-10 | minor | Chill's first-run stage tip points at the stage strip, which Chill hides, so the arrow sits in the top-left corner | js/run.js:587 | Skip the tip in Chill, or point it at the moves counter |
| R-11 | minor | At 844x390 the pause sheet hides "Save and leave" below the fold | landscape pause screenshot | Two-column pause sheet in landscape |
| R-12 | polish | The "Rush over" callout is faint lavender with low contrast | screenshot | Raise contrast |
| R-13 | polish | The results show a level-up and a trophy twice (a banner and a card at the bottom); also in the menu audit as M-I3 | screenshot | One entry per reward |
| R-14 | polish | A Daily run shows no Daily label after its opening callout | screenshot | A small "Daily" tag by the stage label |
| R-15 | polish | Chill says "Stage" in the HUD but "Round" in callouts | screenshot | One word, "Round" |
| R-16 | polish | The -5s and +3.0s chips fly over the "x1 points" pill | frame sheet | Route the chips around the pill |

Works well: nothing covers the board or the power-up slots at rest at any of the four sizes. The press preview, the power-up
states, the pause sheet, quick settings, the tutorial tips and the low and critical vignette all read well.

## Chest openings (C)

| ID | Sev | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|
| C-1 | minor | Pressing again while the hold ring drains is ignored until the finger lifts and presses again | js/openings.js:362 | Accept a new press during the drain |
| C-2 | minor | A chest whose set is already complete still offers "Hold to open"; the hold fills and nothing happens, and the "Could not open" toast stays hidden until the screen closes (toasts wait during openings, js/ui.js:211). It can happen when a Pass item reward completes a set, because leftover chests are only turned into Coins at the next start; the Shop then shows a "1" badge next to "Complete". Confirmed with a forced state; the Pass path was not played through | completed-chest sheet | Convert leftover chests to Coins the moment a set completes, and never offer a hold on a complete chest |
| C-3 | minor | When the Golden set is complete, the day-7 streak pays 600 Coins instead of the chest, but the banner still says "+200 Coins and a Golden Chest" (js/run.js:823 ignores `chestPaid`) | streak banner screenshot | Show what was actually paid |
| C-4 | polish | The landing ring is drawn over the winning card's name | reel frames | Draw the ring behind the name |
| C-5 | polish | Reveal cards first appear empty, and a Mythic card stays a blank glowing slab until its 1.5s demo starts | reveal frames by rarity | Show the badge from the first frame |
| C-6 | polish | Toasts held during one opening can land on the next opening's header if it opens within about 0.7s (seen once) | frame sheet | Release held toasts only between openings |
| C-7 | polish | The Update 4 "first look on the real board" behind the reveal card was not built | | Phase 4 candidate |

Works well: each of the five chests has its own hold build-up and burst, the reel slows smoothly, and the rarity escalation is
clear.

## Cosmetics (K)

| ID | Sev | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|
| K-1 | major | Fuse badges are broken: the art sits off-centre toward the lower right; at 56 and 72px the rope and flame are clipped; in Collection cards and reel cards the art sticks 27px out past the badge. Root cause not pinned | fuse badges at several sizes; css/fuse.css:201, css/badges.css:66 | Give the mini fuse its own box sized from the badge, and a badge-sheet test at 36 to 120px |
| K-2 | major | Some skins make two brick colours hard to tell apart. Smallest colour distance between bricks (Classic is 18.8): Neon 8.1 (blue and purple), Candy 11.0, Circuit 11.6, Chrome 13.7, Clockwork 13.8, Phoenix 13.9 | skin screenshots, the `de.py` script | A minimum distance for every skin (see the readability check in the Series 4 spec) and repainted colours on the six |
| K-3 | minor | At 56px every pop badge looks alike (a ring of dots on the rarity plate) | badge sheet | Draw each pop's own particle shape |
| K-4 | minor | At 56px every board badge shows the same 3x3 board | badge sheet | Show the scene, not the bricks |
| K-5 | polish | The Holo shine washes badges out to grey | badge sheet | Lower the Holo overlay's opacity on badges |
| K-6 | minor | Items that look alike in play: Glass and Snow (pops), Basic Cord and Rope, Copper Wire and Lightning Rod (fuses) | gallery screenshots | Give each pair a clear difference |
| K-7 | minor | Busy art behind the HUD: Carnival Night's ferris wheel and Volcano's lava sit behind the power-up slots; Beach's bright sky leaves the stage number at 1.5:1 contrast | board screenshots | Move or dim the scene behind HUD elements; the Update 4 contrast test on every board |
| K-8 | polish | Galaxy turns hazy in Rush | screenshot | Keep the Rush overlay off its stars |

### Per-item verdicts

| Type | Good | Need polish |
|---|---|---|
| Skins | Classic, Marble, Magma, Supernova, Aurora, Gumdrop, Wood Block, Bubble, Jelly Bean, Lantern, Ice Cube, Slime | Candy, Slate, Stained Glass, Neon, Circuit, Chrome, Prism Heart, Clockwork, Galaxy, Phoenix |
| Pops | Classic, Petals, Glass, Lightning, Fireworks (bursts over the fuse HUD), Confetti, Bubbles, Coins, Leaves, Thunder, Ink Splash, Nova Burst, Dragon Fire | Embers, Pixels, Neon Burst, Snow |
| Boards | Midnight, Deep Sea, Foundry, Night Market, Orbit, Thunderhead, Hologrid, Aurora Sky | Greenhouse (R-4), Carnival Night, Beach, Volcano (K-7) |
| Fuses | Copper Wire, Neon Tube, Ice, Plasma, Candy Cane, Vine, Lightning Rod, Phoenix Tail, Dragon | Basic Cord and Rope (look alike) |

Bricks and frame line up on all 12 boards, and each board keeps its scene in Rush. Every fuse reads correctly at calm, low,
critical, Last Spark, frozen and hold; in Rush they all become the same frosted rope, which is by design.

**The five weakest:**
1. **Neon skin:** the colour is only a thin ring on a dark tile, and its blue and purple are the closest pair in the game (8.1).
2. **Candy skin:** the pastels wash together, and Gumdrop does the same idea better.
3. **Slate skin:** desaturated and flat; it looks cheap next to Series 3.
4. **Embers pop:** a few tiny sparks that nearly vanish on 12+ pops.
5. **Pixels pop:** sparse squares gone by 450ms, thin for an Epic.

Close behind: the Circuit skin, the Neon Burst pop and the Carnival Night board.

**The five strongest:**
1. **Slime skin:** full of character (it has eyes) and still easy to read.
2. **Bubbles pop:** the most distinct pop, true to the brick colour at any size.
3. **Dragon fuse:** reads well in every urgency state.
4. **Gumdrop skin:** the best colour separation of any item (18.8).
5. **Deep Sea board:** an illustrated scene that stays behind the HUD without fighting it.

## Code bugs (X)

| ID | Sev | What is wrong | Evidence | Suggested fix |
|---|---|---|---|---|
| X-1 | major | Save and leave, then Resume, loses the current stage's progress: the snapshot has no `stageScore`, so a stage bar at 3,390 / 8,000 comes back as 0 / 8,000 with the same goal. The run time (3.2s becomes 0), the combo and the Fuse bricks are lost too | js/engine.js:255-271 (snapshot and restore) | Save and restore `stageScore`, `time`, `streak` and every Fuse brick's countdown; a resume round-trip test |
| X-2 | major | Try it, then Pause, Restart turns the practice into a real run: the tried item stays equipped (the skin loadout changed from default to Magma), Coins are paid (200 to 271, which can be farmed), the run counter goes from 12 to 13, the player's saved run is overwritten, and the "Trying Magma · 9s" hint stays on screen | js/run.js:708 restarts without `endPractice` | Restart during practice restarts the practice (or is hidden); a test that a practice run can never pay, count or change the loadout |
| X-3 | minor | The Last Spark heartbeat plays at double rate: two code paths both count down the beat timer (js/run.js:236 and 273), giving 13 beats and 12 bomb pulses in about 1.7s against about 6 intended | audio and pulse counts | One heartbeat clock |

Also code bugs, listed above: the dropped re-press (C-1), the vignette returning (R-9) and the completed-set chest (C-2).
Checked and sound: view.js, run.js and openings.js check that an animation still belongs to the current run or chest before acting
after a wait; board animations remove their nodes when done; no listener growth was seen.

## Animation quality (A)

| ID | Verdict | Notes |
|---|---|---|
| A-1 | good | Pop hit-stop, gravity with squash, and the refill clipped at the board's top edge all feel right |
| A-2 | polish | The stage-up wipe band hides the board for about 0.4s while the refill lands |
| A-3 | minor | Stage-up, Rush and the pop callout fire on the same frame (see R-2) |
| A-4 | polish | The Rush start is strong, but its banner clips (R-7); the frost shards at Rush end are good |
| A-5 | good | Reel easing |
| A-6 | polish | Legendary and Mythic reveals spend about 2.5 to 3s on near-black and an empty card before anything of the item shows |
| A-7 | polish | The fuse-out explosion and crumble look good, but the vignette returns (R-9) |
| A-8 | good | Chest hold and burst |
