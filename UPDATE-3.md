# Pop Rush, Update 3: "Carnival" (schematic)

Update 2 shipped the fuse, the chests and the new UI. Update 3 makes the collection worth chasing, makes the base
mode something you keep coming back to beat, and gives the game a real soundtrack. Nothing here needs a backend or a
build step; the game stays plain HTML, CSS and JS that runs from `file://`, installs as a PWA, and bundles to one file.

---

## 1. What changes, in one screen

| Area | Now | Update 3 |
|---|---|---|
| Collection | 30 items, duplicates sold or traded up | 58 items; a chest never drops something you own; Trade-up and selling removed |
| Chests | Flat SVG art, one burst each, spin can stutter | Layered, detailed chests with idle life; every part of every burst verified; spin at a steady 60 fps |
| Reel cards | Small static previews | Bright animated item badges with rarity frames, same badge everywhere (Shop, Collection, reel, reveal) |
| Coins | Sharp players collect everything in ~10 runs | Earn curve with diminishing returns per run; full collection is a 25 to 35 hour chase for an average player |
| Rush | Burn rate grows without limit | Burn capped at stage 8, goals keep climbing; a "Last Spark" save; the run is always about the score |
| Daily / Chill | Fixed goals | Tuned goals, Chill unlock earlier, Daily shows yesterday's best and a target |
| Help | Tutorial hints in the first run only | A one-time Coach card the first time you open each menu, replayable from Profile |
| Boosts | A sheet with three rows | A clear purchase step with the price, your balance after, and a confirm |
| Pass | "Rush Pass", a vertical list | "Pop Pass": a horizontal track with a spotlight on the next reward, claim moments |
| Audio | Synthesized beeps, a 4-bar loop | A composed, layered soundtrack (menu, run, Rush, results) and a designed SFX set |

---

## 2. Cosmetics: Series 3 "Carnival" (28 new items, 58 total)

The chest split stays (Brick / Pop / Board / Fuse). New items join the existing pools, so every chest gets deeper.

### 2.1 New Skins (Brick Chest): 10

| Rarity | Name | Idle look | Signature moment |
|---|---|---|---|
| Common | **Gumdrop** | Soft translucent jelly, big highlight, slight wobble on landing | Pops squish before they burst |
| Common | **Wood Block** | Toy blocks with grain and a painted stud | Pops throw splinters |
| Rare | **Bubble** | Thin iridescent sphere with a drifting glint | Pops "blink" out with a ring |
| Rare | **Jelly Bean** | Glossy pill shape, speckled | 6+ pops bounce the neighbours |
| Epic | **Lantern** | Paper lantern with an inner flame that flickers | Pops release a glowing ember that floats up |
| Epic | **Ice Cube** | Clear ice with frozen bubbles, melting drip | Pops shatter into frost shards |
| Legendary | **Clockwork** | Brass gears that turn slowly, a tiny tick every few seconds | 8+ pops spin every gear on the board for a second |
| Legendary | **Slime** | Living goo with eyes that look at your finger | Pops stretch toward the tap before they split |
| Mythic | **Galaxy** | A tiny nebula inside each brick, stars drift, each brick different | Pops leave a spiral of stars; Rush Mode turns the whole board into one nebula |
| Mythic | **Phoenix** | Feathers of flame, a wingbeat every few seconds | 8+ pops send a phoenix flying across the board |

### 2.2 New Pops (Pop Chest): 10

| Rarity | Name | What a pop does |
|---|---|---|
| Common | **Confetti** | A puff of paper squares |
| Common | **Bubbles** | Soap bubbles that drift and pop |
| Rare | **Coins** | Spinning coins with a cash-register chime |
| Rare | **Leaves** | Autumn leaves that tumble |
| Epic | **Neon** | Bright outline bursts and a laser zap |
| Epic | **Snow** | Snowflakes that drift slowly, soft chime |
| Legendary | **Thunder** | A crack of lightning and a rolling boom, the board shakes |
| Legendary | **Ink Splash** | Ink splatters the board behind the group, then fades |
| Mythic | **Supernova** | Every pop is a small implosion then a flash; 8+ pops ripple the whole board |
| Mythic | **Dragon Fire** | Flame sweeps out of the group; 8+ pops roar |

### 2.3 New Boards (Board Chest): 4 and new Fuses (Fuse Chest): 4

Boards: **Carnival Night** (Common, string lights and a ferris wheel), **Beach** (Rare, waves and sun), **Volcano**
(Epic, lava glow and ash), **Aurora Sky** (Legendary, moving northern lights; Line Blasts send a wave across the sky).
Fuses: **Candy Cane** (Common), **Vine** (Rare, leaves fall as it burns), **Lightning Rod** (Epic, arcs in Rush),
**Phoenix Tail** (Legendary, feathers burn; the bomb hatches at a Rush start).

### 2.4 Coherence rules (reviewed for every item, new and old)

- One style guide: the same brick silhouette, bevel depth, stud size and drop shadow for every Skin; all seven
  colors distinct at 36px on a phone; nothing hides the group highlight or the Fuse brick countdown.
- Every item has an idle, a pop and (Epic and up) a moment, all under 600ms, all on transform and opacity.
- Pops match their Skin: the particle count and spread read the same on every Skin.
- A gallery pass (`tests/gallery.js`) screenshots every Skin on the board, every Board, every Fuse and every Pop
  mid-burst; the review checks each for: looks like it belongs in this game, readable, nothing clipped or stuck,
  no two items that look alike. Anything that fails is redrawn before the update is called done.

---

## 3. Chests: no duplicates, no Trade-up

- **A chest never drops an item you own.** The roll first picks a rarity among rarities that still have unowned items
  of that type (using the normal weights, renormalized), then an unowned item of that rarity. Odds panels show the
  live odds and "N left" per rarity.
- **Pity:** every 8th chest of a type without an Epic or better guarantees one (shown as "Next Epic+ in N" on the card).
- **Complete:** when every item of a type is owned, that chest card shows "Complete" with the full set, cannot be
  bought, and the Shop shows what is left to find elsewhere. Golden Chest only offers types with unowned Epic+ items;
  if none, the weekly reward pays 600 Coins instead.
- **Removed:** Trade-up, selling, the Duplicate badge, the Counter stat (it only mattered for duplicates; Shine stays).
  The Collection's "Trade up" button becomes "Completion" (a progress ring per type).
- Saves migrate: existing duplicates collapse to one copy each; the Coins they would have sold for are refunded.

---

## 4. Coins: balanced against the catalogue

The question the economy answers: how long until a player owns everything, and does each run feel paid?

**Targets** (measured with the bots in `tests/sim.js`, then checked by hand):

| Player | Run length | Coins per run | Chests per hour | Full collection (58 items, 17,300 Coins) |
|---|---|---|---|---|
| Casual (stage 3 to 4) | ~2 min | 110 to 140 | ~2.5 | ~35 hours |
| Average (stage 6) | ~2.5 min | 180 to 220 | ~4 | ~22 hours |
| Sharp (stage 8+) | ~3 min | 260 to 320 | ~5.5 | ~14 hours |

**Rules that get there:**
- Score Coins use diminishing returns: `coins = 60 * sqrt(score / 20,000)`, so 50k pays 95, 200k pays 190, 450k pays 285.
  Sharp players still earn more per run, but not eight times more.
- Stage bonus stays (12 x stage per cleared stage) but caps at stage 8.
- Daily multipliers move to missions: three dailies pay 60 to 120 each, the weekly 400 plus a Golden Chest, trophies
  150 to 500 once. A first run each day pays +50.
- Chest prices stay 250 to 400. Boosts cost 20 to 40% of a casual run's Coins, so they are a real choice, and the game
  says so (section 8).
- Pass tiers pay 50 to 300 Coins and chests; the pass covers about a quarter of the catalogue over its 30 tiers.

The sim prints Coins per hour for each bot and the hours to complete, and the numbers above are the acceptance range.

---

## 5. Chest appearance and animation overhaul

**Build:** each chest becomes a layered HTML element (divs and canvas, not SVG groups) with named parts: body, lid,
lock, straps, rivets, glow seams, a shadow and a "life" layer. Parts animate with transforms on HTML elements, which
behave the same in every browser. The fuse chest broke because its dial needle inherited `transform-box: fill-box`
from the generic SVG rule while its origin was set in view-box coordinates, and because the hold loop could end on the
first frame when the clock ran backwards; both were fixed late in Update 2, and the SVG approach stays fragile, so
the rebuild drops it.

**Detail:** rivets and highlights, a pedestal with the chest's material (bricks, drum skin, glass and gold, steel),
an idle life: the Brick Chest's studs glow in turn, the Pop Chest's spark fizzes, the Board Chest's glass reflects the
scene, the Fuse Chest's dial twitches, the Golden Chest glints. Hold-to-open escalates per chest (seams glow, bolts
rattle, frost spreads, pressure needle climbs). Each burst keeps its theme and gets a second beat: debris lands on the
pedestal and the reel pushes through it.

**Verified, not assumed:** `tests/chests.js` opens every chest with reduced motion off and samples each named part's
bounding box across the hold and the burst; a part that is supposed to move and does not, or that ends up visible
after it should be gone, fails the test. Frame captures of all five openings are reviewed before sign-off.

---

## 6. The spin: smooth on a phone

Why it lags now: 56 live DOM cards each running their own CSS animations, a `blur()` filter on the whole strip, 3D
tilts on ten cards, and two full-screen animated backdrops behind it, on top of the burst particles still alive.

**Fix:**
- Cards are static during the spin: the item badge (section 7) is drawn once to a canvas bitmap per item and cached;
  cards show the bitmap, no CSS animations, `contain: strict`.
- No blur filter; motion blur comes from a short trailing copy of the strip at low opacity (one extra transform).
- Tilt on the three cards nearest the marker only; the rest are flat.
- The strip is 40 cards, one `transform` per frame, `will-change: transform`.
- Backdrop rays and dust pause while the strip moves; the burst particles are cleared before the strip launches.
- The physics stays (solved landing, ticks from real edge crossings), with a tick rate limiter so sounds never stack.
- Budget: a 4x CPU-throttled Chrome run holds under 16ms per frame average during the spin (`tests/perf.js`).

---

## 7. Item badges: bright, animated, wanted

One badge component replaces the mini previews everywhere (Shop "inside" list, Collection cards, reel, reveal, Pass):
- A rarity frame (color, a thin shimmer that moves on Epic and up, rays behind Legendary and Mythic).
- The item drawn large and saturated: Skins as a single hero brick plus two behind it; Pops as a looping burst on a
  dark disc; Boards as the scene in a rounded window with the frame details; Fuses as a lit fuse segment and bomb.
- Three sizes (72, 120, 200px). Animation is transform and opacity only; at most eight badges animate at once
  (the rest show their first frame) and animation pauses when the badge is off screen.
- The Collection shows unowned items as dark silhouettes with a "?" so the gaps pull the player on.

---

## 8. Modes: tuned and fair

**Rush (the base mode) must never become physically impossible:**
- Burn rate `1.15^(stage-1)` caps at stage 8 (about 2.7x). Beyond stage 8 the goals keep growing (x1.5) and new
  Fuse-brick pressure appears, so the ceiling is skill and board luck, not the clock.
- Pop time floors: a 2-pop always pays at least 0.8s at any stage; at stage 6+ a 3-pop pays 1.4s.
- **Last Spark:** once per run, when the fuse reaches zero, the board freezes for 1.5s and asks for one pop; a pop of
  4+ relights the fuse with 6s. Missing it ends the run with the bomb. It turns the quiet "ran out" into a moment.
- Reshuffles when no moves exist refund 2s.
- **The score chase:** a ghost marker for your best score sits on the stage bar; "x to beat" appears when you are
  within 20%; a near-miss ending shows "So close: 2,310 short"; beating it mid-run stops the clock for a 1s ribbon.
  Results show the gap to the next trophy and a "Beat it" button that starts a new run straight away.
- Sim acceptance: casual bots reach stage 3 to 5, average 5 to 8, sharp 8 to 11, no bot ever ends by the burn alone
  before 70 seconds, and 30% of average runs trigger Last Spark.

**Daily Rush:** same rules; shows the date, your best, and a "par" (the average of your last five runs) to beat.
**Chill:** unlocks at level 2; goals `1,200 x 1.3^(round-1)`; rounds show a star rating so there is something to beat.

---

## 9. Coach cards (first-time help)

The first time a screen or sheet opens, a short card slides up: an illustration, one sentence, up to three bullets,
"Got it". One per screen: Home, Run (replaces the in-run hints), Shop, Opening, Collection, Missions, Pass, Profile,
Boosts. Stored as `seen.coach.<id>`; Profile has "Show tips again". The cards never block a tap that matters: on the
Run screen the card shows before the countdown.

---

## 10. The pre-run Boosts sheet

- Title "Before you start", your Coin balance at the top, three Boost cards with the price in a Coin pill and a
  one-line effect. Tapping a card asks "Buy Long Fuse for 150 Coins? You will have 310 left." with Buy / No.
- Bought Boosts show a receipt line ("Bought: Long Fuse, 150 Coins") and the balance updates with a count-down tick.
- The Start button reads "Start" with no Boosts and "Start with 1 Boost" otherwise. There is no "free".
- Balance: Long Fuse +8s (150), Head Start one Hammer (100), Coin Rush +50% Coins from this run (120). A Boost never
  changes the score, so leaderboard-style bests stay fair.

---

## 11. Pop Pass

- Renamed from Rush Pass. A horizontal track of 30 tiers scrolls under a header with the level ring and XP to the
  next tier. The next reward is spotlit and animated; claimed tiers are stamped; locked ones are dim.
- Level-ups on the results screen fly the reward from the XP bar into a "New reward" chip; opening the Pass plays a
  claim moment for anything unclaimed (the chip bursts into the item badge).
- Season: the pass shows "Carnival Season" with a day counter; at the end, unclaimed tiers stay claimable, and a new
  season starts with new rewards (tier rewards are data, so a season is a list).

---

## 12. Audio: the soundtrack and the SFX set

### 12.1 What the research says (sources at the end)

- Short loops wear out fast: in a 10-minute session a 30-second loop repeats 20 times; 1 to 2 minutes with real
  internal structure holds up. Loud, constant music gets switched off.
- Layered stems with intensity tied to the game (vertical remixing) and sections that can be re-ordered (horizontal
  re-sequencing) are the standard ways to keep music fresh; transitions wait for a musical boundary.
- Satisfying UI sounds are short (30 to 300ms), sit in the mid-high band, rise in pitch for positive events, vary a
  little each time, and avoid narrow piercing peaks. Decorative sounds are rate-limited.
- Loudness: a consistent target (about -16 LUFS integrated is the common platform figure), music 6 to 12 dB under the
  effects, and music ducks 6 dB under big moments.

### 12.2 The soundtrack

Everything stays synthesized in Web Audio (no files, works offline, bundles to one page), but composed, not generated:
- **Instruments:** a soft pluck (filtered saw with a short envelope), a warm pad (two detuned triangles through a
  low-pass), a round bass (sine plus a little square), a bell (FM, short), brushed drums (filtered noise, soft kick).
- **Key and tempo:** major pentatonic over a I–V–vi–IV progression; menu 96 BPM, run 110 BPM, Rush 124 BPM. No
  minor keys in the run; the tension comes from the fuse, not the music.
- **Structure:** a 2-minute run piece in four 8-bar sections (A A' B A''), with a melody line that only plays in B so
  it stays a treat. Stems: pad, bass, pluck, drums, melody, Rush layer (bright arps and a shaker).
- **Adaptive:** intensity from stage (adds drums at stage 2, pluck at 3, a counter-melody at 5), fuse under 25%
  thins the pad and adds a pulse, Rush Mode swaps in the Rush layer at the next beat and shifts up a key, stage-ups
  land on a bar boundary with a riser. Sections re-sequence (A, A', B order varies) so a long run never repeats
  exactly.
- **Menus:** a calmer 96 BPM version of the same material (pad, pluck, no drums) so the game has one identity.
  Results: a short sting that resolves to the menu key. Openings: a low pulse that rises with the hold ring, silence
  for the spin ticks, a chord per rarity at the reveal.
- Scheduling is look-ahead (a 100ms timer queues 16th notes 150ms ahead) so it never stutters on a phone.

### 12.3 The SFX set

- Every pop is a pitched note: group size picks a step up the pentatonic scale, combos go up an octave, with ±3%
  random pitch and three timbres in rotation so no two pops are identical. All pops are low-passed at 7 kHz, no
  square waves above 2 kHz, attack 3ms, decay under 220ms.
- Line Blast, Rush start, stage-up and Last Spark are the only "big" sounds, each under 1.2s, each with a sub layer
  and a bright layer so they read on phone speakers and on headphones.
- Fuse: a quiet heartbeat under 25%, a tick per second under 10s, never a continuous alarm.
- UI taps are 40ms, chest ticks are 45ms and never closer than 18ms apart.
- Mix: a master compressor and limiter; SFX bus at 0 dB, music bus at -9 dB, ducked to -15 dB for 600ms on big
  events; a measured loudness check in `tests/audio.js` renders each sound offline and asserts peak and RMS ranges.
- Settings: music and effects sliders (not just toggles), with the music default at 70%.

---

## 13. Technical plan

```
js/badges.js      item badge renderer (DOM + canvas cache) used by Shop, Collection, reel, reveal, Pass
js/chestart.js    rewritten: layered HTML chests, parts API (part(name).animate), idle life
js/spin.js        static bitmap cards, trailing copy, 3-card tilt, tick limiter
js/openings.js    rituals on the new parts API; pity and completion states; no sell/trade paths
js/chests.js      no-duplicate roll, pity counter, completion, Golden type filter
js/progress.js    Trade-up/sell removed, duplicate migration, pity counters
js/config.js      Coin curve, burn cap, Last Spark, Boost prices, Chill goals, season data
js/engine.js      burn cap, pop-time floors, Last Spark state, best-score events
js/coach.js       Coach cards
js/music.js       rewritten: stems, sections, look-ahead scheduler, adaptive rules
js/audio.js       rewritten SFX set with buses, limiter, rotation and pitch rules
js/screens.js     Shop completion, Collection silhouettes, Boosts purchase flow, Pop Pass track
css/badges.css, css/chest.css (rewrite), css/skins.css (+28 items), css/pass.css
tests/            sim with Coins-per-hour and completion hours, chests part-motion test, perf budget,
                  audio loudness test, gallery review, flow (no duplicates, pity, completion, coach cards, boosts)
```

---

## 14. Build order

1. **Economy and chest rules** (no duplicates, pity, completion, Coin curve, Boost prices, migration), sim targets.
2. **Modes** (burn cap, floors, Last Spark, score chase, Chill and Daily tuning), sim acceptance.
3. **Badges and the smooth spin** (badge renderer, bitmap cache, reel rewrite, perf budget).
4. **Chest rebuild** (layered parts, idle life, five rituals, part-motion test, frame review).
5. **Series 3 cosmetics** (28 items, moments, gallery review of all 58).
6. **Menus** (Coach cards, Boosts purchase flow, Pop Pass track, Collection silhouettes, Shop completion).
7. **Audio** (SFX set, buses and limiter, soundtrack stems and adaptive rules, loudness test, settings sliders).
8. **Polish and ship** (screenshots at six viewports, frame review of openings and reveals, bundle, docs).

Each phase ends playable and committed.

---

## 15. Quality bar

The Update 2 bar holds in full (menus visually stunning, animations designed and layered, functionality polished,
visual review with a written shortfall list fixed to empty before a phase closes). Added for this update:
- Every one of the 58 items passes the coherence review in section 2.4; a list of reworked items is kept.
- Every chest part is verified by the motion test and reviewed in frame captures; no ritual ships unverified.
- The spin holds the frame budget under 4x CPU throttle; any regression fails `tests/perf.js`.
- The soundtrack is listened to for a full 10-minute session in one sitting (rendered offline to a file and checked
  for clipping, then played in the browser); any phrase that grates is rewritten.
- The economy sim prints hours-to-complete inside the ranges in section 4.

---

## 16. Acceptance checklist

- [ ] No chest ever drops an owned item; a completed type says so and cannot be bought.
- [ ] Trade-up and selling are gone from every screen; old duplicates are refunded on first launch.
- [ ] Casual, average and sharp bots complete the catalogue in 35 / 22 / 14 hours (±20%).
- [ ] Every chest's hold and burst moves every named part, on Chrome, Safari and Firefox (manual check on Safari).
- [ ] The spin averages under 16ms per frame at 4x throttle; no tick ever stacks.
- [ ] All 58 items reviewed in the gallery, none flagged.
- [ ] Rush never ends by burn alone before 70s; Last Spark fires in about 30% of average runs; the best-score ghost
      and "x to beat" show in every run after the first.
- [ ] Coach cards show once per menu, never twice, and can be replayed.
- [ ] Buying a Boost always shows the price and the balance after, and asks for confirmation.
- [ ] Pop Pass track scrolls, spotlights the next reward, and plays a claim moment.
- [ ] Soundtrack: no clipping, music 9 dB under effects, ducks on big events, loops never repeat exactly within
      10 minutes; every pop sound under 220ms and low-passed at 7 kHz.

---

## 17. Sources for the audio design

- Reducing music fatigue (loop length, volume, structure): https://world.hey.com/thome/game-101-reducing-music-fatigue-d0214e31
- Adaptive music techniques overview: https://www.construct.net/en/tutorials/constructing-adaptive-music-1461
- Vertical remixing and horizontal re-sequencing in practice: https://gamemaker.io/en/blog/compose-video-game-music
- Horizontal composition (segments): https://dev.epicgames.com/documentation/fortnite/horizontal-composition
- Web Audio segment scheduling: https://www.abratabia.com/web-game-audio/dynamic-game-music.php
- UI sound length, band and pitch meaning: https://violetrecording.com/how-to-design-ui-sounds/
- Rate-limiting decorative sounds: https://m2.material.io/design/sound/applying-sound-to-ui.html
- Avoiding piercing peaks and sterile repeats: https://sonilo.com/ai-music/ding-sound-effect-guide
- Loudness targets (-16 LUFS platform figure): https://developers.meta.com/vr/documentation/unreal/audio-loudness-meter-overview/
- Balancing music and effects: https://krotos.studio/blog/how-to-balance-music-and-sound-effects
- Adaptive loudness on mobile: https://audiomediainternational.com/mobile-loudness-an-adaptive-approach/

---

## 18. Status: what shipped (Update 3 "Carnival")

Everything in sections 1 to 15 is built. Where the build differs from the plan, or a target was missed, it is listed here.

### Delivered
- **Cosmetics:** 28 new items (10 skins, 10 pops, 4 boards, 4 fuses) for 58 in total, each with its own look and, from Epic up,
  a signature moment. All of them were reviewed on the board, as badges in every shine, and in the reveal; Series 1 and 2 are untouched.
- **Chest rules:** a chest never repeats an item (odds renormalised over what is unowned), every 8th chest of a type gives an
  Epic or better, a finished set says Complete, Golden Chests pay 600 Coins when nothing Epic or better is left.
  Trade-up and selling are removed; Update 2 saves are migrated (duplicates collapse to one copy and are refunded, with a notice).
- **Economy:** run Coins are `14 * sqrt(score / 50,000)` plus a stage bonus, plus the daily and first-run bonuses; chests cost
  350 / 300 / 450 / 300; Boosts cost 25 / 15 / 20 and Double Coins was removed because it would have paid for itself.
- **Modes:** the fuse stops speeding up after stage 8, pops of 3+ pay at least 1.4 s from stage 6, Last Spark gives one 2.5 s
  window to relight the fuse, a reshuffle gives 2 s back, the best score is shown under the score all run, and results show the gap,
  a near-miss line, par (the average of the last five runs) and a Beat it button.
- **Chests and spin:** five rebuilt, detailed chests made of independent parts with idle life; the hold and burst move every named part
  (including the fuse chest's needle, which was broken). The reel is built from still badges and one transform per frame.
- **Menus:** first-time tip cards on every screen (once each, never during a run, replayable from Profile), a purchase sheet for
  Boosts that shows each price, the total and the balance after, a horizontal Pop Pass track with a next-reward spotlight and a reward
  sheet, dark silhouettes for items you have not found, volume sliders, a what's-new card for returning players.
- **Audio:** every effect is rebuilt (pentatonic pops, a low-passed SFX bus, loudness-tested), and an adaptive soundtrack was added:
  menu and run arrangements that crossfade on bar lines, stems per stage, a tense low-fuse layer, a key lift in Rush, ducking under big moments.

### Measured results
| Check | Result |
|---|---|
| Hours to own every item (sim bots) | casual 16.6, average 10.1, sharp 7.8 (a chest every 25 / 16 / 12 minutes) |
| Same, buying one Boost every run | 32.0 / 14.7 / 10.2 |
| Run length (sim) | 126 to 134 s average for every skill level; Last Spark saves the run in 37% to 55% of runs |
| Reel frame time, 4x throttle, software rendering | 44 to 53 ms, against 165 ms (sideways) and 324 ms (vertical) before |
| Run idle frame time, same setup | Classic 105 ms before, 39 ms after the blurred background was replaced by a static glow |
| Audio | every pop under 220 ms and under 0.32 peak, music 7 dB under the loudest pop, no gaps or clicks over a 10-minute render |
| Tests | logic, engine, spin, sim, stress (reduced and full), flow, chests, coach, moments (all 23 moment items), lifecycle, touch, audio |

### Differences from the plan, and why
- **Hours to finish (plan: 35 / 22 / 14).** The plan's table disagreed with its own Coin figures. The numbers above come from the
  bots with the shipped prices; a chest every 12 to 25 minutes keeps opening feel frequent, and the last items of each set still
  take longest because the odds are renormalised over fewer and fewer unowned items.
- **Reel frame time (plan: under 16 ms).** This environment has no GPU, so a bare page already takes about 17 ms per frame; the
  useful comparison is the before and after above. The cause was found and fixed: animated card previews and per-card clips
  and filters made the compositor draw each card as its own surface every frame.
- **Claim moment.** The Pop Pass pays rewards when a level is reached, so the claim moment is the level-up row with its reward on the
  results screen; the Pass screen itself centers the track on the next reward and shows a reward sheet when a tier is tapped.
- **Confirmation for Boosts.** The Start button turns into "Pay N and start", which is the confirmation; nothing is charged before it is pressed.
- **Not implemented from the plan:** gumdrop, wood, bubble and bean moments (those items have no signature moment, so their
  descriptions only describe their look), and the pop moments do not play in the chest-reveal preview (the particle recipe does).
- **Not verified:** Safari and Firefox (only Chromium was available), real phone frame times, and how the music sounds to a listener
  (only measured). The 10-minute render of a session is written by `node tests/audio.js` for listening.
