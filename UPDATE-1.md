# Update 1 — "Shardfall"

The schematic for the first major update. It renames the game, simplifies the core loop, moves crates out of the
match and into a progression track, and replaces Cores with a cosmetic collection built to grow for years.

---

## 1. What changes, in one screen

| Area | Today (v1) | Update 1 |
|---|---|---|
| Name | Brick RNG | **Shardfall** |
| Pressure | Fuel budget, refunds, abstract | **Rounds**: 20 moves to hit a visible goal |
| Power | Cores pulled from crates mid-run | **Boosters** earned by combos, no RNG |
| Crates | Awarded mid-run by score | **Geodes** earned by XP level-ups, opened from the menu |
| Crate reward | Rules-changing Core | **Facets** (brick skins), **Bursts** (pop effects), **Arenas** (boards) with Finishes and Trackers |
| Collection | 13 Cores | A growing Vault: 3 reward types, 5 rarities, series-based |

---

## 2. Name

**Shardfall.** Bricks shatter into shards, the shards fall, and Shards are also the currency the collection runs on.
It reads as one word, works as a logo (the "fall" can literally drop), and the vocabulary follows from it:
Geodes (crates), Facets (brick skins), Shards (currency), the Vault (collection).

Runners-up, if Shardfall is rejected: **Kiln** (bricks are fired in one; crates become Kilns) and **Popcore**.

---

## 3. Core loop: Rounds

The tap-a-group rule stays exactly as it is. Everything around it gets simpler.

**A run is a series of Rounds.**
- Each round gives **20 moves** and a **goal score**, both shown big at the top. The goal bar fills as you score.
- Hit the goal before moves run out → the round clears. Leftover moves pop random bricks automatically for bonus
  points (the classic "sugar crush" payoff), then the next round starts with a higher goal.
- Run out of moves below the goal → the run ends. Your total score is the result.
- Goal curve: round *n* goal = `1,500 × 1.35^(n-1)`. Round 1 is reachable by anyone who taps big groups; round 8
  needs combos and Boosters.

**Why this is easier and more intuitive**
- "20 moves, reach 1,500" needs no explanation. Fuel, refunds and net-fuel previews are gone.
- There is always a visible finish line, so every tap has a purpose and small pops are never punished.
- Rounds give natural breathing points for the round-clear celebration, XP ticks and Booster refills.

**Scoring** stays `10 × n²` with the combo multiplier for consecutive 4+ pops. Line Blast stays. Board shuffle on
dead boards stays. The 6th and 7th brick colors arrive at rounds 4 and 8 instead of after crates.

---

## 4. Boosters (replacing Cores in play)

Three Booster slots sit under the board. They are earned, not rolled, so the player always knows how to get them.

- A **charge bar** fills with every pop of 4+ (faster for bigger groups). Full bar → one Booster, slots refill in
  order: **Hammer** (tap any single brick to smash a 3×3), **Beam** (clears a row and column), **Prism** (turns
  one color wild for one tap).
- Tap a Booster, then tap the board to use it. Boosters never cost a move.
- Unused Boosters carry into the next round. This gives weak players a safety net and strong players a reason to
  chain combos.

Cores are retired from play. Their hooks stay in the engine (`cores.js` becomes `boosters.js`), so Bomb, Laser and
Rainbow code becomes Hammer, Beam and Prism with almost no new logic.

---

## 5. Progression: XP, Levels, Geodes

Geodes are **earned on the profile, not awarded in the match**.

**XP sources** (all shown as "+XP" ticks on the round-clear screen):
| Source | XP |
|---|---|
| Every 100 points scored | 1 |
| Round cleared | 50 + 10 × round number |
| Line Blast | 25 |
| Group of 10+ | 15 |
| First run of the day | 150 |
| New personal best | 200 |

**Levels**: XP to next level = `500 × 1.2^(level-1)`. Every level-up grants **one Geode**. Every 5th level grants a
**Series Geode** (higher odds, see §6). The level and XP bar live on the menu and in the run's results screen, so
the player always sees the next Geode approaching.

Geodes stack in the Vault ("3 unopened") and are opened from the menu whenever the player wants, which keeps the
match uninterrupted and turns opening into its own moment.

---

## 6. Geodes and what they hold

A Geode cracks open to reveal **one item**. Three item types, all visible every time you play:

| Type | What it changes | Examples |
|---|---|---|
| **Facet** (brick skin) | The look of all 7 brick colors, the stud, and the material | Glass, Lava, Neon Tube, Marble, Circuit, Candy, Obsidian |
| **Burst** (pop effect) | Particles, ring and sound flavor of every pop | Ember shower, Glass shatter, Petal drift, Pixel dust, Lightning |
| **Arena** (board) | Board frame, background scene, ambient motion, Line Blast beam | Deep Sea, Foundry, Night Market, Orbit, Greenhouse |

**Rarity** (one scale for every type): Rough 60% · Polished 25% · Prismatic 10% · Radiant 4% · Celestial 1%.
Rarity sets the visual intensity: Rough items are flat materials, Radiant items animate, Celestial items have
unique particle systems and their own reveal music.

**Modifiers** rolled on top of the item, the way weapon skins carry wear and StatTrak:
- **Finish** (every item): Matte 55%, Gloss 30%, Holo 12%, Prism 3%. Changes the sheen; Holo and Prism shift
  with the group highlight.
- **Tracker** (10% of drops): the item counts a stat while equipped (bricks popped, biggest group, best round)
  and shows it on the brick stud, in the Vault and on the results screen. This is the reward that long-term
  players chase.
- **Pattern seed** (Facets only): a number that nudges the gradient angle and stud shape, so two drops of the
  same Facet never look identical.

**Duplicates become Shards**: Rough 10, Polished 25, Prismatic 60, Radiant 150, Celestial 400.
Shards are spent on **Fusion**: 5 items of one rarity → 1 random item of the next rarity (the trade-up contract),
or 250 Shards → one Geode of a chosen Series.

**Series** are the expansion unit. Update 1 ships **Series 1 "Foundry"** (18 items: 8 Facets, 5 Bursts, 5 Arenas).
Each later series adds a themed set, a new Geode shell, and one new Celestial item. Nothing in the engine changes
when a series is added; items are data.

**Loadout**: one Facet, one Burst, one Arena equipped at a time, chosen in the Vault. The default set (current
look) is always owned so a new player's board never looks empty.

---

## 7. Opening a Geode (the showpiece)

Keep the CS:GO reel the player already likes, wrap it in the geode fantasy, and make the player part of it.

1. **Present.** The Geode drops onto a stone plinth in a dark cavern; rarity is unknown. Its shell is the Series
   shell (Foundry: iron-banded rock with glowing seams).
2. **Crack it yourself.** The player taps the Geode **three times**. Each tap: a crack spreads (SVG path drawn
   on), light leaks out brighter, a deeper thud, the camera shakes more. Haptic pulse on phones. Between taps the
   seams pulse to invite the next hit.
3. **Shatter.** On the third tap the shell bursts into rock shards (canvas), a flash, and the reel slides in
   through the dust.
4. **Reel.** The horizontal strip of item cards, decelerating under a crystal marker, with ticks. Cards show the
   item rendered live (a mini brick triplet for Facets, a looping pop for Bursts, a board thumbnail for Arenas),
   not icons. The near-miss tease stays. Tap to speed up stays.
5. **Reveal.** The winning card opens like a geode half: rarity-colored crystal interior, rays, confetti scaled to
   rarity, Tracker badge slam if rolled, Finish shimmer sweep. Celestial reveals cut to black first and play a
   one-second sting before the card appears.
6. **Try it.** A 3×3 mini board with the item equipped appears beside the card and pops once on its own, so the
   player sees the reward in action before choosing **Equip** or **Keep in Vault**. Duplicates show
   **Dust for +N Shards** instead.

Every stage has a "reduce motion" variant: no crack taps (one tap opens), 2.4-second reel, no shake.

---

## 8. Screens

- **Menu**: logo, Play, Level ring with XP bar and "next Geode in 340 XP", a Geode button with an unopened
  count badge that bounces when > 0, Vault, Settings.
- **Run**: Round number, Moves left (big), Goal bar with the goal number, Score, Booster slots. The Core slot is gone.
- **Round clear**: the leftover-move cascade, round score, XP ticks, "Round 4" → "Round 5" transition.
- **Results**: total score, rounds cleared, best group, XP earned with the level bar filling live, and a
  Geode drop animation when the bar crosses a level.
- **Vault**: three tabs (Facets, Bursts, Arenas), rarity filter, item cards with Finish and Tracker badges, equip
  from the card, Fusion panel, Shard balance, unopened Geodes shelf.

---

## 9. Technical plan

New or changed files; everything else stays.

```
js/items.js      Series data: every Facet, Burst, Arena as plain objects (palette, materials, particle recipe)
js/skins.js      Applies the loadout: injects per-Facet CSS vars, picks the Burst recipe for fx.js, mounts the Arena
js/geode.js      Opening sequence (replaces crate.js): crack taps, shatter, reel, reveal, try-it board
js/progress.js   XP, levels, Geode inventory, Shards, Fusion, duplicate handling
js/boosters.js   Hammer, Beam, Prism (from cores.js hooks) + charge bar logic
js/engine.js     Rounds and moves replace Fuel; Booster application; XP events emitted per turn
js/vault.js      Vault screen (replaces the collection screen)
css/styles.css   Rounds HUD, Booster slots, Vault, Geode stage; Facet materials as CSS variable sets
storage          Schema v2 with a migration from v1 (best score and runs carry over; Cores collection
                 converts to 50 Shards per discovered Core so early players keep something)
```

Facets are implemented as **CSS variable sets + a material class** (gloss, matte, glass, emissive), so a new skin
is 7 color pairs and a material name. Bursts are **particle recipes** for the existing `fx.js` (shape, count, gravity,
drag, palette, ring style, sound preset). Arenas are a background layer plus a beam color and a frame style. All
three are data, which is what makes the Vault expandable without engine work.

---

## 10. Build order

1. **Rounds** — replace Fuel with moves and goals; round-clear cascade; results screen with XP. *Playable end to end.*
2. **Boosters** — charge bar, three Boosters, targeting input, carry-over.
3. **Progression** — XP sources, levels, Geode inventory, storage v2 and migration, menu level ring.
4. **Items + skins** — Series 1 data, Facet/Burst/Arena application, default loadout; bot test confirms every
   Facet renders all 7 colors with readable contrast and shape hints still work.
5. **Geode opening** — crack taps, shatter, reel with live cards, reveal tiers, try-it board, duplicate → Shards.
6. **Vault** — tabs, filters, equip, Fusion, Shard purchase.
7. **Rename and polish** — Shardfall logo and title, menu, sound set, tutorial rewrite (3 hints: tap groups,
   reach the goal, Boosters), responsive and reduced-motion pass, README, bundle for the Artifact.

---

## 11. Acceptance checklist

- [ ] A new player clears round 1 on their first run without reading anything.
- [ ] Moves and goal are visible at a glance at phone width; no numbers hide behind the board.
- [ ] Boosters are explained by their first use alone (ghost preview of the effect while aiming).
- [ ] A level-up always lands on a visible Geode drop; unopened count is never hidden.
- [ ] Geode opening: taps crack it, result is decided before the reel, reel lands on the result every time.
- [ ] Every item is visibly different in play within one pop of equipping it.
- [ ] Vault loads with 50+ items without jank; equipping is one tap.
- [ ] Saved v1 data migrates with no loss of best score.
- [ ] Zero console errors; works from `file://` and in the Artifact viewer.

---

## 12. Decisions taken (change any of these before build starts)

- Cosmetics give **no scoring or move advantage**, so a future leaderboard stays fair. Their bearing on the game is
  the look, the sound, the Line Blast animation and the Tracker stats.
- No keys, no purchases. Geodes come only from XP levels and Shards.
- Cores are retired; three of them live on as Boosters.
- Facet, Burst and Arena rarities share one 60/25/10/4/1 table so the odds screen stays one line.
