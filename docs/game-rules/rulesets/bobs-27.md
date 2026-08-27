# Bob's 27

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                         | Version |
| ----------------------------------------------- | ------- |
| Single player                                   | v1      |
| Multiplayer vs guest                            | V1      |
| Vs DartBot                                      | TBD     |
| Config screen (presets shown)                   | v1      |
| Start score 27                                  | v1      |
| Path D1…D20 then bull                           | v1      |
| 3 darts per double                              | v1      |
| Hit: add double’s value to score                | v1      |
| Three misses: subtract 1× double’s value        | v1      |
| Miss = anything except the double               | v1      |
| Traditional: ≤0 is game over                    | v1      |
| Traditional: win if score > 0 after bull visit  | v1      |
| Easy / beginner: cannot die (negative allowed)  | TBD     |
| Easy: ends after bull visit regardless of score | TBD     |
| Standard dartboard (assumed)                    | v1      |

## Identity

Popular doubles training game with a running score. Start at **27**, throw three darts at each double from 1 through 20, then the bull. Hits add the double’s value; a clean miss visit subtracts it. Standard dartboard is assumed.

## Objective

- **Traditional:** survive the path without hitting **0 or below**; after the bull visit, finish with a **positive** score to win.
- **Session (V1):** one full traditional run (D1…D20, bull).
- **1v1:** first to bust loses; the other seat wins (elimination). <!-- 2026-08-22 -->

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting     | V1 preset       | On config screen (V1) |
| ----------- | --------------- | --------------------- |
| Players     | Single player   | Shown, locked         |
| Mode        | Traditional     | Shown, locked         |
| Start score | 27              | Shown, locked         |
| Path        | D1 → D20 → bull | Shown, locked         |

## How to play (V1) — Traditional

### Visit

Three darts at the **current double**. A **miss** is anything that is not that double.

### Scoring

- Each **hit** on the double adds **that double’s board value** (2× its number) to the running score (e.g. D1 = +2 per hit, D20 = +40 per hit). Multiple hits in one visit each add that same board value — two hits at D20 add 80, three add 120. There is no further bonus for a multi-hit visit.
- If **all three darts miss**, subtract **one times** the double’s board value once (e.g. three misses at D1 → −2).

Examples:

```
Start 27, target D1
MISS, D1, MISS  →  27 + 2 = 29  (one hit)

Start 27, target D1
MISS, MISS, MISS  →  27 − 2 = 25
```

_(Rule: sum hit board values, or subtract 1× board value on a full-miss visit.)_

### Progress

After each visit, advance to the next double (1 → 2 → … → 20 → bull).

**Bull (V1, resolved):** only the **inner bull (double bull, 50)** counts as a hit. A dart in the **outer bull (25) is a miss**, exactly like any other non-target dart. The bull’s “double value” for both adding and subtracting is **50** — a hit adds 50, a three-dart miss visit subtracts 50.

### Finishing / dying

- If the score reaches **0 or below** at any point → **game over** (loss).
- After three darts at the bull, if the score is still **positive** → **win**.

### Bust

N/A as X01 bust; going to ≤0 ends the traditional game.

## Later versions (V2+)

### Variants — Easy / beginner

Player **cannot die**; score may go negative. Run still ends when the bull visit is complete.

### Match structure / other

- **V3-style:** optional multiplayer against a guest (easy and traditional)
- **V4-style:** optional vs DartBot (easy and traditional)

## Glossary

| Term                | Version | Meaning                                                |
| ------------------- | ------- | ------------------------------------------------------ |
| **Hit**             | V1      | Dart in the required double; on the bull target, the inner bull only. |
| **Full miss visit** | V1      | All three darts miss → subtract 1× the double’s value. |
| **Traditional**     | V1      | ≤0 ends the game; positive after bull wins.            |
| **Easy**            | V2+     | No death; finish the path even with a negative score.  |

## Capture

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — every dart thrown is recorded.
- **One dart's fact:** intended = the current double (`DOUBLE` on its number; `INNER_BULL` on 25 for the bull target); hit = whatever landed; `score` = the **board** score of that dart (D20 = 40, T5 = 15, miss = 0) — never the game's point value.
- **Stage type:** one `EXERCISE_BLOCK` for the whole run.
- **Derived, never stored:** the running score, and the full-miss penalty. A visit's turn total is the sum of its darts' board scores and is never negative.

## Open questions

- None. Multi-hit math and bull scoring resolved 2026-07-26 (see Scoring and Progress); the
  per-hit value formula corrected from face value to board value 2026-08-12 (D207,
  `decisions/game-engine.md`).
