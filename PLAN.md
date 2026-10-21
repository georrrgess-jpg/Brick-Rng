# Brick RNG — Build Plan

A single-page HTML game. Tap groups of bricks to pop them (simpler than Candy Crush / Block Blast),
earn RNG crates that open with a CS:GO-style reel, and the **Core** you pull changes how the game plays.

---

## 1. Design pillars

| Pillar | What it means in practice |
|---|---|
| One-tap intuitive | The only input is a tap/click. No drag, no swap, no rotate. A 5-year-old understands it in one try. |
| Always a decision | Pop small now for safety, or wait for groups to grow for a big score and fuel refund. |
| RNG is the hook | Crates are the reward loop. Each Core visibly rewrites the rules mid-run. |
| Professional feel | Juice on every action: easing, particles, screen shake, synthesized SFX, consistent design tokens. |

---

## 2. Core mechanic (the "board")

- **Grid:** 8×8 bricks, 5 colors at start (6th color unlocks after 2 crates for difficulty ramp).
- **Input:** Tap any group of **2+ orthogonally adjacent same-color bricks** to pop it.
  Hover/touch-start highlights the whole group and shows a score preview, so the player sees exactly what happens before committing.
- **Gravity:** Bricks above fall down; empty columns are refilled from the top with new random bricks (so the board never shrinks).
- **Line Blast:** If a pop empties an entire row or column at once, that gets a bonus and a bigger effect (Block Blast flavor).
- **No-move safety:** If no group of 2+ exists, the board auto-shuffles for free with a short animation.

### Scoring
- Base: `10 × n²` where `n` = bricks popped (grows fast: 2→40, 5→250, 10→1000).
- Combo multiplier: each consecutive pop of **4+** adds +0.5× (shown as a rising badge); a pop under 4 resets it.
- Line Blast: +500 flat and clears the full line even if it was mixed colors.

### Run pressure: Fuel
The run ends when **Fuel** hits 0 (replaces Candy Crush "moves").
- Start at 25. Every pop costs 1.
- Refunds: group of 5+ → +1, 8+ → +2, Line Blast → +3. Big plays keep the run alive, so skill = run length.
- Game over screen: score, best score, bricks popped, Cores pulled, "Play again".

---

## 3. Crates (the RNG loop)

- **Crate meter** fills with score. First crate at 800 pts; each subsequent threshold is 1.5× the last (so crates feel regular early and earned later).
- When the meter fills, play pauses and the **crate opening** overlay appears.

### CS:GO-style reel
1. A horizontal strip of ~50 Core cards scrolls right-to-left under a center marker.
2. Ease-out deceleration over ~4.5 s (`cubic-bezier(0.12, 0.8, 0.2, 1)`), with a tick sound per card passing the marker.
3. Slight overshoot, settle, pause, then a rarity-colored flash and the card pops out.
4. The winning card is chosen **before** the animation; the strip is built so it lands at index ~45.
5. Rarity colors and weights (CS:GO-like):

| Rarity | Color | Chance |
|---|---|---|
| Common | Blue `#4B69FF` | 60% |
| Rare | Purple `#8847FF` | 25% |
| Epic | Pink `#D32CE6` | 10% |
| Legendary | Red `#EB4B4B` | 4% |
| Mythic | Gold `#FFD700` | 1% |

### After the pull
Player chooses **Equip** (replaces the current Core for the rest of the run) or **Scrap** (refund Fuel: Common +3, Rare +5, Epic +8, Legendary +12, Mythic +20).
Every pull is recorded in a persistent **Collection** screen (localStorage), which is the long-term reason to keep playing.

---

## 4. Cores (the feature pulled from crates)

One Core is active at a time. Cores hook into the board rules; each should be obvious within one tap of equipping it.

| Rarity | Core | Rule change |
|---|---|---|
| Common | Spark | Every pop also pops 1 random adjacent brick of any color. |
| Common | Thrifty | Pops of 3+ refund +1 Fuel (instead of 5+). |
| Common | Heavy | Score ×1.5, but Fuel cost per pop is 2 for groups under 4. |
| Rare | Chain | Popping a group also pops the largest group touching it. |
| Rare | Painter | After each pop, 2 random neighbors of the hole recolor to the popped color (groups snowball). |
| Rare | Flip | Gravity reverses (bricks fall up, refill from bottom). Pure planning twist. |
| Epic | Bomb | Every popped brick explodes 3×3, destroying mixed colors. Huge chaos, big scores. |
| Epic | Laser | Any pop of 6+ also clears its entire row and column. |
| Epic | Freeze | Fuel does not drop for the next 10 pops; timer badge counts down. |
| Legendary | Rainbow | One color becomes wild and matches everything. |
| Legendary | Twin | Each tap pops the group **and** its mirror position on the board. |
| Mythic | Singularity | After every pop the whole board compacts toward the center, forcing massive groups. |

Implementation: `cores.js` exports a registry of `{ id, name, rarity, description, hooks }` where hooks are optional functions:
`onPop(ctx)`, `modifyGroup(group, board)`, `modifyFuelCost(n)`, `modifyScore(points, n)`, `onAfterGravity(board)`, `gravityDirection()`.
The board engine calls these at fixed points, so adding a Core is adding one object.

---

## 5. Tech stack & structure

Vanilla HTML/CSS/JS, ES modules, **no build step** — open `index.html` and play. Deployable to GitHub Pages as-is.

```
index.html          — shell, screens (menu, game, crate overlay, collection, game-over)
css/styles.css      — design tokens, layout, brick/reel animations, responsive rules
js/main.js          — bootstrap, screen router, input binding
js/rng.js           — seeded PRNG (mulberry32) so runs are reproducible / daily seed later
js/board.js         — grid state, flood-fill group detection, gravity, refill, shuffle
js/game.js          — run state: score, combo, fuel, crate meter, game-over
js/cores.js         — Core registry + hook definitions (table above)
js/crate.js         — weighted roll, reel strip builder, reel animation, equip/scrap
js/fx.js            — canvas particle layer, floating score text, screen shake
js/audio.js         — Web Audio synthesized SFX (pop, tick, reveal, line blast); no audio files
js/storage.js       — localStorage: best score, collection, settings
```

- **Rendering:** bricks are DOM elements positioned with CSS transforms (cheap at 64 elements, easy to animate with transitions). A full-screen `<canvas>` overlay handles particles.
- **Visual style:** dark slate background, glossy rounded bricks with subtle inner highlight, soft glow on hover group, Google Font *Space Grotesk* for headings and *Inter* for UI. Rarity colors as CSS variables. Light/dark both work; dark is default.
- **Responsive:** board scales to `min(92vw, 70vh)`; mobile-first; touch and mouse both handled via Pointer Events.
- **Performance:** no per-frame DOM layout; all animations via `transform`/`opacity`; particles capped at 300.

---

## 6. Build phases (each ends in a playable, committed state)

1. **Playable board** — grid, group highlight, tap-pop, gravity, refill, shuffle, basic HUD. *Done when: you can pop bricks indefinitely with no bugs.*
2. **Run loop** — scoring, combo, Fuel, Line Blast, game-over screen, best score saved. *Done when: a run starts and ends with a score.*
3. **Juice** — pop particles, floating score, combo badge, screen shake, synthesized SFX, menu screen. *Done when: it feels good to tap.*
4. **Crates** — meter, overlay, weighted roll, reel animation with ticks, reveal, equip/scrap, collection screen. *Done when: a crate opens and looks like a CS:GO case.*
5. **Cores** — hook system in board/game, all 12 Cores, active-Core badge in HUD with description. *Done when: every Core visibly changes play.*
6. **Polish & QA** — first-run tutorial (3 tooltips), settings (sound, shake, reduced motion), responsive pass on phone/desktop, cross-browser check (Chrome, Safari, Firefox), README, GitHub Pages deploy.

---

## 7. Acceptance checklist

- [ ] New player understands the game with zero text in under 10 seconds.
- [ ] Every tap gives immediate visual + audio feedback within 100 ms.
- [ ] Crate reel: predetermined result, smooth deceleration, ticks, no jank at 60 fps on a mid-range phone.
- [ ] Each Core's effect is obvious on the very next tap after equipping.
- [ ] Zero console errors; works offline from a local file; no external dependencies except fonts (with fallback).
- [ ] Best score and Collection persist across reloads.

## 8. Stretch (after v1)
Daily seeded run with a shareable score, second Core slot at high score milestones, achievements, haptics on mobile, a Blitz (timed) mode.
