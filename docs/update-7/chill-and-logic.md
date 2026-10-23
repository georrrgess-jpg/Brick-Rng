# Update 7 input: Chill, and logic to fine-tune

Read-only audit of the game logic (no game file changed). Every number comes from bots playing the real engine in Node; the
scripts and their raw output are in `docs/update-7/audit-scripts/logic/` (section 5 says which script backs which claim).

## 0. Summary

**Chill today** is flat, then a wall. Rounds 1 to 5 are always cleared, with 10 to 17 of the 20 moves left (round 1 takes 3 to 5 moves).
Every run then ends on round 6 to 9: casual 7.1, average 8.5, sharp 8.7, with p10 to p90 inside two rounds. The game's own star rule
gives 3 stars to 73 to 87% of clears, and those stars are thrown away. Chill pays about half of what Rush pays per minute.

**Proposed Chill changes** (prototyped against the engine, numbers in section 2):
1. **A longer, gentler ladder**: goals `2400 x 1.13^(round-1)` instead of `1200 x 1.30^(round-1)`. Round 1 takes about 5 to 9 moves, and the wall moves from round 7-9 to round 9-11.
2. **Banked moves**: half the moves left at a clear (rounded down, at most +5) carry into the next round. The rest still shatter for 100 each.
3. **Big pops buy moves**: a pop of 10+ gives +1 move, a Line Blast +2.
4. **Lucky brick** (only in Chill): once a round, after the round's 4th pop, one new brick is Lucky. Popping it gives +1, +2, +2 or +3 moves.
5. **Last chance**: power-ups in hand fire on their own before an out-of-moves round is judged. Once per run, running out within 15% of the goal gives +3 moves ("So close: 3 more moves").
6. **Stars that count**: 3 stars = cleared in at most half the round's moves, 2 stars = in at most three quarters. Stars are shown on the results, kept, and feed a **Star Road**: 40 Coins every 50 stars, a free chest every 300. Chill gets its own daily objective. Chill pay: rounds pay their stage Coins up to round 12 (today they stop at 7), plus 1 Coin a star.

**Top logic findings** (section 3 has the evidence and fixes):
- **Bug/exploit:** Save and leave, then Resume, sets the fuse to 6 s. Done during the Last Spark, it relights the fuse for free. Done every time the fuse runs low, it takes runs from stage 5.2 to 7.7 (casual) and from 8.8 to 11.0 (sharp).
- **Bug:** in Chill, "Save and leave" throws the run away: no Coins, XP or streak, and no warning. The engine snapshot also has no moves count.
- **Bug:** the Chill results always show `0:00`, because the engine never counts time in Chill.
- **Rule:** a Chill run ends "Out of moves" while you still hold power-ups that would clear the round.
- **Economy:** after the Coin doubling, the 84 chest items are all owned after 6.5 to 8.5 hours of play (8 to 33 days); Update 5 took 10 to 11 hours. A mission is now worth 0.4 to 0.65 of a run and a run goal 0.1 to 0.25. Once the catalogue is done, Coins have nowhere to go.
- **Economy:** restarting right after stage 4 or 5 pays 15 to 45% more Coins a minute than playing the run out.
- **Boost:** Rush Start's Rush counts toward the +35% Rush escalation. Sharp players score 6% less with it, and none of the three Boosts earns back more than 36% of its price.
- **Rule:** trophies count Chill rounds as stages. Hot Streak (stage 5) comes free from every Chill run, and the longer Chill ladder would hand out Fuse Master (stage 10) too.

---

## 1. Chill today

### 1.1 How it was measured
- `lib.js` loads the pure logic (`rng board config boosters items chests director engine storage pass progress missions retention`) the same way the tests do.
  It plays Chill the way `js/run.js` sequences it: a cleared round shatters its leftover moves and the next round begins, and a pop that leaves 0 moves
  short of the goal ends the run at once (`afterAction` calls `endRun('moves')`), even with power-ups in hand. The `tests/balance.js` bot does
  not do this: it fires power-ups after the last move.
- Three bots, as in `tests/balance.js`: **casual** (biggest group 40% of the time, never uses power-ups), **average** (80%, uses power-ups),
  **sharp** (95%, uses power-ups, and in Chill a one-step planner that values the board left after gravity and protects combos). Each bot's
  director rating is warmed up with 30 Rush runs (0.50 / 0.73 / 0.89).
- **Time model.** Chill has no clock (`Engine.tick` returns at once in Chill), so the bot keeps its own:
  - thinking: 2.6 / 2.0 / 1.5 s a move (people think longer with no fuse);
  - 0.55 s of animation a move (Chill plays pops and falls at full length);
  - 2.2 s for each round clear and 3 s to start and end a run.
  
  Rush uses the engine clock plus 3 s. "Per hour" adds 0.8 min of menus per run, as `tests/sim.js` does.
- Coins and XP come from the real `Progress.runCoins` and `Progress.runXpRows`, with no first-of-day bonus.

### 1.2 Numbers (`chill-now.js`, 300 Chill runs and 150 Rush runs per bot)

| | casual | average | sharp |
|---|---|---|---|
| Rounds reached (p10 / median / p90) | 7.1 (6 / 7 / 8) | 8.5 (8 / 8 / 9) | 8.7 (8 / 9 / 9) |
| Clear rate, round 6 / 7 / 8 / 9 | 86 / 33 / 2 / 0% | 100 / 100 / 46 / 5% | 100 / 100 / 63 / 11% |
| Moves left at a clear, round 1 / 5 / 7 | 15.0 / 7.4 / 3.1 | 16.4 / 12.4 / 8.3 | 17.1 / 13.3 / 9.9 |
| Moves, minutes per run (p10 to p90) | 78, 4.4 min (3.4 to 5.4) | 77, 3.9 (3.2 to 4.6) | 74, 3.1 (2.5 to 3.6) |
| Run ends within 10% / 20% of the goal | 23% / 44% | 20% / 45% | 22% / 45% |
| Ends more than 40% short | 19% | 14% | 14% |
| Ends out of moves with power-ups in hand that would have cleared the round | 62% (this bot never uses them) | 1% | 1% |
| Stars per clear, in-game rule (3 stars = 8+ moves left) | 73 / 16 / 11% | 84 / 10 / 6% | 87 / 6 / 6% |
| Max combo, biggest pop | 4.0, 11.3 | 5.5, 10.8 | 5.9, 11.6 |
| Coins + XP a run | 70 + 314 | 88 + 398 | 89 + 418 |
| **Coins / XP a minute, Chill** | **16.0 / 72** | **22.7 / 103** | **28.7 / 135** |
| Coins / XP a minute, Rush (same bot) | 26.3 / 128 | 47.7 / 213 | 54.1 / 251 |
| An hour of play, Chill vs Rush | 812 vs 1164 Coins | 1131 vs 2106 | 1369 vs 2444 |

Score curve (average bot, cumulative at the end of each round): 3.3k, 6.8k, 11.0k, 15.5k, 20.7k, 26.6k, 33.8k, 42.3k, 53.0k. Early on the shatter is
worth more than the goal: 15 moves left after round 1 pay 1,500 points, against a 1,200-point goal.

### 1.3 Why it plays flat
- **The goal outruns the board.** Played over all 20 moves, a round yields per move:
  - casual 354 points at round 1, 219 at round 8;
  - average 496, then 353;
  - sharp 634, then 383.
  
  It falls as the 6th colour (round 4) and the 7th (round 8) join. The goal needs 60 points a move at round 1 and grows 30% every round, so it
  meets the yield at round 7 to 9. Because the goal grows that fast, being 1.7 times better at the game is worth only about two rounds
  (`ln 1.7 / ln 1.3`), and luck is worth less than one round: run scores spread by only 11 to 14% (standard deviation). So every run ends in the same place.
- **The early rounds have no stakes.** Most of each early round's 20 moves are spare. The stars only measure that spare, and nothing keeps them.
- **Nothing carries over.** Each round starts from 20 moves, the combo resets, and leftover moves turn into points that do not matter.
- **"Beat your best" cannot carry the mode.** When runs are alike, run n beats all the runs before it about 1/n of the time, however much
  the runs vary. Over runs 11 to 40 that is about 4.5%; measured: 3 to 5% today and 3 to 9% in every variant tried. A record alone gives the
  player little to chase. Chill needs targets that move: stars, a Star Road and a daily objective.
- **The director's Chill catch-up is not the cause.** With the extra help it gives when a player is behind pace switched off, the spread of
  rounds hardly changes (sd 0.55 becomes 0.46 to 0.64; `chill-sweep2.out.txt`).

## 2. The Chill design

### 2.1 The six changes (numbers as prototyped)

| # | Change | Rule and numbers | New UI? |
|---|---|---|---|
| 1 | Longer, gentler ladder | `chill: { goalBase: 2400, growth: 1.13 }`. Goals: 2400, 2700, 3050, 3450, 3900, 4400, 5000, 5650, 6400, 7200, 8150, 9200. Colours stay at rounds 4 and 8. Steeper alternative: 2200 x 1.15 (runs 0.3 to 0.4 min shorter). | none |
| 2 | Banked moves | At a clear, `carry = min(5, floor(left / 2))` is added to the next round's 20. The other `left - carry` moves shatter for 100 each, as today. | The moves counter shows "20 + 3"; the shatter callout says "3 moves banked" |
| 3 | Big pops buy moves | A pop of 10+ gives +1 move, a Line Blast +2 (+2 at most per pop) | A "+1 move" chip flies to the moves counter, the same pattern as the fuse's time chips |
| 4 | Lucky brick (Chill only) | Once a round, the refill after the round's 4th pop marks one new brick Lucky. Popping it in any group, or shattering it, gives +1/+2/+2/+3 moves (mean 2). It never changes colour and is never placed by the director. | **Yes:** a gold ring or star on the brick (like the Fuse brick's ring), a reveal callout |
| 5 | Last chance | (a) Out of moves short of the goal with power-ups in hand: they fire on the best cell before the round is judged, so a charged power-up is never lost. (b) Second Wind, once per run: out of moves at 85%+ of the goal gives +3 moves. | A "So close: 3 more moves" callout; power-ups fire one by one |
| 6 | Stars that count, Star Road, Chill pay, Daily Chill objective | Stars by moves used in the round: 3 = at most 50% of the round's base moves, 2 = at most 75%, 1 = otherwise. Results show the run's stars, and the profile keeps the total and the best run. Star Road: 40 Coins every 50 stars, a free chest of choice every 300. Chill Coins: every cleared round up to 12 pays its stage Coins (2 x round, at most 14 a round), plus 1 Coin a star. Daily Chill objective: a fourth mission card once Chill is unlocked ("Clear round 9 in Chill", "Earn 20 stars in one Chill run", "Make 3 pops of 10+ in Chill"), 40 to 60 Coins. | **Yes:** stars on the results, a Star Road strip on the Chill card or Profile, the fourth mission card |

Engine hooks for 1 to 5 are small:
- `nextRound` takes a carry;
- `commit` adds the refund in Chill;
- a `lucky` flag on bricks, like `fb`, saved in the snapshot;
- `outOfMoves()` becomes "no moves, no power-ups and the Second Wind already used";
- `shatter()` shatters only the moves that are not banked.

In `js/run.js`, `chillClear` already computes stars into `this.chillStars`, but nothing reads them (dead code today). Ideas that were looked
at and left out:
- **Checkpoints / endless:** the wall is deterministic, so starting past it just moves the same wall.
- **Combo carried across rounds:** not prototyped; it is a small lever next to moves.
- **Fewer moves per round (16):** casual near misses fell to 3%.

### 2.2 Prototype results (`chill-proto.js`, 200 to 240 runs per bot; `chill-proto-final.out.txt`, `chill-proto.out.txt`)

Today against the proposal (the six changes, goals 2400 x 1.13). Stars use the proposed rule (at most 10 / 15 moves) in both columns.

| | casual today → proposal | average today → proposal | sharp today → proposal |
|---|---|---|---|
| Rounds (p10 / p50 / p90) | 7.2 (6/7/8) → **9.4** (9/9/10) | 8.5 (8/8/9) → **10.2** (9/10/11) | 8.7 (8/9/9) → **11.0** (10/11/12) |
| Spread of rounds (sd) | 0.66 → 0.62 | 0.53 → 0.86 | 0.59 → 1.02 |
| Skill gap, sharp minus casual | 1.5 rounds → **1.7** | | |
| Moves to clear round 1 | 5.1 → **8.6** | 3.6 → **6.2** | 3.0 → **4.8** |
| Clears with 3 or fewer moves left (tense rounds) | 12% → 20% | 6% → 9% | 6% → 11% |
| 3-star clears / stars per run | 63% / 15.3 → **32% / 15.9** | 76% / 20.1 → **61% / 22.1** | 81% / 21.1 → **63% / 24.1** |
| Power-ups lost at the end | 60% → **0** | 2% → 0 | 2% → 0 |
| Second Wind used / Lucky moves / banked moves per run | – → 35% / 10.7 / 31 | – → 38% / 8.7 / 40 | – → 46% / 9.0 / 43 |
| Ends within 15% of the goal | 34% → 13% | 32% → 17% | 36% → 18% |
| Ends more than 40% short | 22% → 19% | 14% → 13% | 14% → 15% |
| Minutes per run | 4.4 → **7.9** | 3.9 → **6.0** | 3.1 → **5.2** |
| Score | 30.0k → 47.6k | 44.5k → 57.5k | 47.9k → 67.1k |
| Coins a minute, today's pay → proposed pay | 16.0 → 11.3 → **15.7** | 22.7 → 15.5 → **24.2** | 28.6 → 18.4 → **31.1** |
| Proposed pay as a share of Rush (26.3 / 47.7 / 54.1 a minute) | 61% → 60%, plus the Star Road | 48% → 51% | 53% → 58% |

Each rule alone, on today's goals (`chill-proto.out.txt`; rounds for average, casual in brackets):

| Rule | Rounds | Effect |
|---|---|---|
| Banked moves (half, up to +10) | 8.9 (7.6) | Moves 77 → 92 |
| Big pops buy moves | 8.5 (7.2) | +1.4 to 2.1 moves a run; a moment, not a lever |
| Lucky brick | 8.6 (7.3) | +6.6 to 8.1 moves a run |
| Last chance | 8.8 (8.1) | Power-ups lost 60% → 0; the Second Wind is used in 27 to 34% of runs |
| Goals 2400 x 1.12 only | 9.4 (7.3) | Round 1 takes 6.2 moves; ends more than 40% short 4 to 11% (best of all variants) |

What the numbers say:
- **The early rounds now ask something.** Round 1 takes 5 to 9 moves instead of 3 to 5, and fewer clears get 3 stars.
- **Stars measure skill:** 32% of clears are 3-star for casual, 63% for sharp.
- **The end is fairer:** no lost power-ups, and a Second Wind on a near miss in about 40% of runs.
- **Banked moves and Lucky moves make each run a little different:** the spread rises to about 1 round for average and sharp.
- **The cost is length:** runs take 1.6 to 1.8 times as long. That suits a relaxed mode, but it is why the pay change is part of the package.
  - With the proposed pay, Coins a minute come back to today's level, and the Star Road adds about 3 Coins a minute plus a chest every 14 runs (about 80 minutes). At the average bot's 22 stars a run, that is 40 Coins every 2.3 runs.
  - For shorter runs, use goals of 2200 x 1.15 (`proposal_b`): 7.5 / 5.7 / 4.8 min, rounds 9.2 / 9.9 / 10.6.
- **Near misses at the end fall from 34% to 13 to 18%**, because the Second Wind turns them into play. A run still ends far short only 13 to 19% of the time, as today.
- **What brings players back is the Star Road and the daily objective,** not the all-time best (see 1.3).

### 2.3 Knock-on effects to handle with the Chill change
- **Trophies:** with Chill rounds counting as stages, round 10 would come within reach of most Chill runs; see finding L8.
- **Missions:** 4 of the 9 daily mission kinds can never move in Chill (L9); the Daily Chill objective is the fix.
- **The shatter's bricks** count as popped bricks: 31% of a Chill run's bricks today (L13). With banked moves, fewer bricks shatter.
- **The skill rating stays Rush-only** (`Director.rate` already ignores Chill).

---

## 3. Logic findings, ranked

Each finding gives the evidence (script and number) and a fix. Bugs come first.

**L1. Resume sets the fuse to 6 s and turns a Last Spark into a free save (bug, exploit).**
- **Cause:** `_restore` sets `fuse = max(saved, resumeGrace 6)`. The snapshot has no `spark`, so a run saved during the Last Spark comes back
  with `fuse 6, spark 0`, exactly what a successful save gives (`sparkFuse 6`), with no pop needed. The pause sheet is open during the
  spark (`pause()` does not check it), and the snapshot stays on the device after a resume, so this can be repeated.
- **Evidence** (`edge-cases.js`): a bot that uses Save and leave and Resume whenever the fuse is under 2 s reaches:
  - casual: stage 5.2 → 7.7;
  - average: 7.3 → 9.7;
  - sharp: 8.8 → 11.0;
  - with runs 2.5 times as long (35 to 59 resumes a run).
  
  One resume during the spark is a sure save. A real save works 52 to 68% of the time.
- **Fix:** save `spark` and `rush.active/left` in the snapshot (v3). Restore the fuse exactly. Drop `resumeGrace`, and instead hold the
  clock after a resume until the first pop (a `hold` flag that `tick` respects, like `waitFirstPop`).

**L2. In Chill, "Save and leave" throws the run away (bug).**
- **Cause:** `saveSnap()` skips Chill, but the pause sheet still offers Save and leave, and `exitToHome()` pays nothing. The player loses the
  run's Coins, XP, missions and streak day, with no warning. Starting the Chill run had already cleared any saved Rush run (`start()` calls
  `clearRun()`).
- **The engine is not ready for it either:** `snapshot()` has no `movesLeft`, so a restored Chill run comes back with 20 moves (8 moves in:
  12 left, restored as 20).
- **Fix:**
  - Short term: in Chill, the pause sheet offers "End run (keeps your score)" instead of Save and leave.
  - With the Chill change: save Chill runs. Add `movesLeft`, the banked moves, `chillStars` and the Lucky brick to the snapshot, and have the
    Home resume card say "Round n".

**L3. Chill results always show 0:00 (bug).** `Engine.tick` returns before `this.time += dt` in Chill, so `summary().time` is 0 (16 s of
ticks gave 0). The results line prints `Chill · Round 8 · 0:00`. **Fix:** in Chill, count the clock without burning anything (advance
`time` and return early after it). This also gives later tuning real Chill play times.

**L4. Chill ends "Out of moves" while power-ups that would clear the round are still in hand (rule).**
- **Cause:** `afterAction` checks `outOfMoves()` right after the last pop. Power-ups cost no move in Chill, but the player never gets to use them.
- **Evidence:** 62% of casual-bot runs end this way. That bot never uses power-ups, but neither does a casual player who saves them. The
  average and sharp bots, which fire power-ups as soon as they can, lose 1 to 2% of runs this way.
- **Fix:** the Last chance rule (2.1, #5a). The smallest version: `outOfMoves()` is false while `inv` has anything, and the hint band says
  "Use your power-ups".

**L5. The catalogue is finished in about a week of play, and Coins then have no use (economy).**
- **Evidence** (`economy.js`, a day-by-day run of the real `Progress` code: real level-ups, season track, chests, pity and Golden Chests; all
  trophies paid at the start, 85% of missions done, a perfect streak). The chest items are all owned after:

  | Bot (runs a day) | Update 5 | Update 6 |
  |---|---|---|
  | casual (5) | 42 days, 10.9 h | 33 days, 8.5 h |
  | average (10) | 21 days, 10.3 h | 14 days, 6.8 h |
  | sharp (15) | 14 days, 11.4 h | 8 days, 6.5 h |

  - A chest comes every 5 to 6 minutes of play (7 to 8 before).
  - Casual and average players own everything before the season track is done (tier 21 and tier 27 of 30).
  - The time saved is only 22 to 43%, not 50%, because one-time sources (4,700 Coins of trophies, Pass chests, Golden Chests from the
    streak and the weekly mission) are a large share of the total.
  - After that, the only sinks are the Boosts (none pays, see L7) and the 30-Coin reroll.
- **Fix** (keeps the owner's doubling): add a Coin sink for players who own everything, such as upgrading an owned item's Shine (Plain →
  Glossy → Holo → Prism, about 150 / 300 / 600 Coins). It is cosmetic, so it fits the no-duplicates promise and gives back the chase.
  Otherwise, price chests about 1.5 times higher.

**L6. Missions, run goals and the streak lost half their weight (economy).**
- **Evidence:** next to a run's Coins, before and after the doubling:
  - a daily mission (38 to 53 Coins): 0.86 to 1.41 runs → **0.40 to 0.65 runs**;
  - a run goal (10 to 20 Coins): 0.23 to 0.53 runs → **0.11 to 0.25**;
  - streak day 3 (120 Coins): 1.9 to 4.4 runs → 0.9 to 2.0;
  - a level-up: 1.1 to 2.6 runs → 0.5 to 1.2.
  
  A run goal is now worth less than a 10% better score.
- **Fix:** double mission, run-goal, weekly and streak Coins (missions 50 to 140, goals 20 to 40, day 3 240, day 7 400). That gives back
  their share. The catalogue then comes about 1 day (average) to 6 days (casual) sooner, 6.4 h instead of 6.8 h for the average bot, so it
  should go together with the L5 sink.

**L7. Boosts: Rush Start can hurt, Head Start does nothing, and none pays for itself (economy, rule).**
- **Evidence** (same seeds, with and without the Boost):

  | Boost (price) | Coins back | Score effect |
  |---|---|---|
  | Long Fuse (25) | +8 to +9 Coins (32 to 36% of its price) | |
  | Head Start (15) | −0.7 to +3.6 | |
  | Rush Start (20) | +0.9, +0.5 and −3.1 Coins | sharp: 263k → 246k score; Rushes per run 4.84 → 4.80 |
  
  The early Rush is counted in `stats.rushes`, which sets the escalation (`gain / (1 + 0.35 x rushes)`), so every later Rush costs 35% more.
- **Fix:**
  - Rush Start's first Rush does not count toward the escalation: keep a separate `escalations` counter that only meter-filled Rushes raise.
  - Head Start becomes "a Hammer and a Beam".
  - Long Fuse is fine as a purchase.
  
  The "none pays for itself" rule still holds after these changes.

**L8. Trophies count Chill rounds as stages (rule).**
- **Cause:** `checkTrophies` uses `max(bestStage.rush, daily, chill)`.
- **Evidence:** every Chill run reaches round 5 (100% for all three bots), so Hot Streak ("Reach stage 5", 75 Coins) comes free from Chill.
  Fuse Master (stage 10, 200 Coins) comes from 6% of sharp Chill runs today and would come from most runs after the Chill change.
  Beyond the Fuse (stage 12) would come within reach too.
- **Fix:** use the Rush and Daily best stage only, and give Chill its own trophies (rounds and stars).

**L9. Chill cannot move 4 of the 9 daily mission kinds (rule).**
- **Cause:** `stage` and `dailyScore` read 0 in Chill by code, and `rushRun` and `defuse` can never happen there. The weekly `weeklyStage`
  cannot move either.
- **Evidence:** a real Chill run's summary fed to every mission kind (`edge-cases.js`).
- **Fix:** the Daily Chill objective (2.1, #6). At the least, the mission reroll should not offer a mission that cannot be done in the mode
  the player plays most.

**L10. Restarting after stage 5 pays more a minute than playing the run out (economy).**
- **Cause:** Restart from the pause sheet pays the run (`bankSilently`) and skips the results screen. Two things make the end of a run pay
  little: Coins grow with the square root of the score, and stage Coins stop at stage 7. The last 28 to 34 s of a run, after the last
  stage-up, pay almost nothing.
- **Evidence** (`economy.js`; 0.25 min between full runs, 0.15 min per restart). Coins a minute:

  | Bot | Full runs | Restart after stage 4 | Restart after stage 5 |
  |---|---|---|---|
  | casual | 23.6 | 27.1 | 25.6 |
  | average | 43.2 | 49.5 | 51.4 |
  | sharp | 48.7 | 64.6 | 70.5 (+45%) |
- **Fix** (measured): `stageCap` 7 → 12 and +15 Coins of "run complete" when the fuse ends the run (End run and Restart do not get it).
  Full runs then pay 29.6 / 49.4 / 59.0 a minute. Restarting after stage 5 keeps an edge only for sharp players (+19%: 70.5 against 59.0);
  for average players it is +4%, and casual players lose 8% (their best restart, after stage 4, pays 27.1 against 29.6). To keep income flat, take the same amount off `scale`.

**L11. Combos past 4 are mostly luck (tuning).**
- **Cause:** `comboNeed` rises one brick every two links. The director deliberately leaves the board to chance right after a 4+.
- **Evidence** (sharp bot, Rush): the chance that the next board offers a group big enough to grow the combo:
  - combo 0 to 1 (needs 4): 90% / 71%;
  - combo 2 to 3 (needs 5): 41% / 53%;
  - combo 4 to 5 (needs 6): 23% / 24%;
  - combo 6 to 7 (needs 7): 12% / 13%;
  - combo 8 (needs 8): 5%.
  
  So a chain of 5 or more depends on the refill, not the player. The "Chain 5 big pops" goal and combos of 10+ (2 to 20% of runs) are lottery tickets.
- **Fix** (choose one, then rerun `tests/balance.js` for the combo-10 targets):
  - step `comboNeed` every 3 links (4, 4, 4, 5, 5, 5, 6, ...);
  - or, with the combo at 2+, let the director aim 30% of refills at a group of `comboNeed`, the way it serves `want`.

**L12. Save and leave in a Daily breaks "the same board for everyone" (minor fairness bug).**
- **Cause:** `reset(snap)` reseeds the generator with `seed + stage x 7919`, so the refills after a resume differ from those of a run that
  was never interrupted.
- **Evidence** (`edge-cases.js`): same taps, one run resumed after 6 pops, the boards differ 6 pops later.
- **Fix:** keep the mulberry32 state (one 32-bit integer) in the snapshot and restore it.

**L13. Small counting edges.**
- Fuse bricks that burst are counted as popped bricks: `stats.bricks` and the colour counts, so they move the "Pop N bricks" and colour
  missions and Brick Breaker.
- The end-of-round shatter counts too: 233 of an average Chill run's 749 bricks (31%).
- A power-up on a Fuse brick removes it with no defuse credit (0 counted, no +3 s), and the other Fuse bricks do not tick on a power-up.
- `run.js` deals the new stage colour with the refill only for pops (`runTurn`). A stage cleared by a power-up brings the colour one refill late.
- **Fix:** count only bricks the player popped, and count a power-up that takes a Fuse brick as a defuse. Do the stage colour bump inside the
  engine, so pops and power-ups share it and the bots see it.

**L14. Checked and fine (no change).**
- **Rush and Last Spark pacing are inside the Update 5 targets** (`tests/balance.js 60`: all ok):

  | Bot | Rush share | Rushes a run | Last Spark saves |
  |---|---|---|---|
  | casual | 16% | 2.3 | 68% |
  | average | 26% | 3.6 | 62% |
  | sharp | 33% | 4.8 | 52% |

  Casual sits near the 70% ceiling: 70% of its stage-5 Last Sparks are saved.
- **The director:** 0 reshuffles in 180 bot runs, and `ensureMove` never left a dead board in the forced cases tried. Determinism by seed
  and the Daily's independence from the skill rating are covered by `tests/director.js`.
- **Resume during Rush** drops the Rush (meter 0). Harmless, but it goes away with the L1 snapshot.

---

## 4. Suggested order for Update 7
1. **Bug fixes:** L1 (resume), L2 and L3 (Chill save and clock), L4, L12. Small, testable in `tests/engine.js`.
2. **Chill package:** changes 1 to 5 in the engine plus their UI (moves chips, the Lucky brick, Second Wind), then stars, the Star Road and the
   Chill pay (#6), and L8 and L9 alongside.
3. **Economy pass:** the L5 sink, the L6 doubling, the L10 run-complete bonus, the L7 Boosts. Rerun `economy.js`. Targets: catalogue in
   about 10 h of play, a mission worth about 1 run, restarting no better than +10% a minute.
4. **Tuning:** L11 combos, checked against `tests/balance.js`.

## 5. Scripts (`docs/update-7/audit-scripts/logic/`)

| Script | What it shows | Output |
|---|---|---|
| `lib.js` | Loader; Chill and Rush bots sequenced like `run.js`; the time model | |
| `chill-now.js [N]` | Section 1.2 | `chill-now.out.txt` |
| `chill-rules.js` | The prototype rules as hooks on the real engine, and the measures | |
| `chill-proto.js [N] [variant...]` | Section 2.2: each rule alone, the packages, the proposal | `chill-proto.out.txt`, `chill-proto-final.out.txt` |
| `chill-sweep.js`, `chill-sweep2.js` | Grids over goal curves, carry, the catch-up and the Lucky brick | `chill-sweep.out.txt`, `chill-sweep2.out.txt` |
| `economy.js [N]` | L5, L6, L7, L10: income U5 against U6, the catalogue journey, other sources, Boosts, restart farming | `economy.out.txt` |
| `edge-cases.js [N]` | L1 to L4, L7 to L9, L11 to L14 | `edge-cases.out.txt` |

Run them with `node docs/update-7/audit-scripts/logic/<script>.js`. Nothing outside `docs/update-7/` is read for writing. The bots warm
their rating with Rush runs and use fixed seeds, so the results repeat.
