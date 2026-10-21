# Brick RNG

Tap groups of bricks to pop them, open CS:GO-style crates, and pull **Cores** that rewrite the rules mid-run.

**Play:** open `index.html` in any modern browser. No build step, no dependencies, works offline from `file://`.
To host it, serve the folder as-is (for example GitHub Pages).

## How to play
- **Tap** any group of 2+ touching same-color bricks. On touch, press to preview the group and release to pop; slide away to cancel.
- Every pop costs **1 Fuel**. Pops of 5+ refund 1, 8+ refund 2. Fuel at zero ends the run.
- Consecutive pops of 4+ build a **combo** (+0.5x each). A group that spans the board edge to edge triggers a **Line Blast**.
- Score fills the **crate meter**. Each crate holds one Core. **Equip** it or **Scrap** it for Fuel.

## Cores
| Rarity | Cores |
|---|---|
| Common (60%) | Spark, Thrifty, Heavy |
| Rare (25%) | Chain, Painter, Flip |
| Epic (10%) | Bomb, Laser, Freeze |
| Legendary (4%) | Rainbow, Twin |
| Mythic (1%) | Singularity, Midas |

Cores are plain objects in `js/cores.js` that plug into the engine through small hooks (`extras`, `fuelCost`, `fuelRefund`, `scoreMult`, `gravity`, `afterRefill`, `wild`, ...). Adding one is adding one object.

## Layout
```
index.html        screens + overlays
css/styles.css    design tokens, components, animations
js/rng.js         seeded PRNG
js/board.js       grid, flood fill, gravity + refill, reshuffle   (pure logic)
js/cores.js       config, palette, rarities, Core registry
js/engine.js      rules: plan a tap, commit it, crates           (pure logic)
js/view.js        board renderer and every board animation (WAAPI)
js/fx.js          canvas particles, rings, confetti, shake, flash
js/audio.js       synthesized Web Audio effects (no audio files)
js/ui.js          HUD, floating text, collection, hints
js/crate.js       crate drop, charge-up, reel, reveal, equip/scrap
js/main.js        controller: input, turn flow, crates, game over
tests/            headless simulation + Playwright UI tests
```

## Tests
```
node tests/sim.js            # engine invariants + balance across all Cores (no browser)
node tests/stress.js reduced # bot plays the real UI, checks DOM == engine after every turn
```
The UI tests use Playwright's Chromium (see `tests/lib.js` for paths).

## Settings
Sound, screen shake, color-blind shape hints and reduced motion (defaults to the OS setting) live in the in-game Settings panel. Progress is stored in `localStorage` under `brickrng.v1`.
