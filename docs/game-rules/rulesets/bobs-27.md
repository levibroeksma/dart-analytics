# Bob's 27

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                         | Version |
| ----------------------------------------------- | ------- |
| Single player                                   | v1      |
| Multiplayer vs guest                            | TBD     |
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

- Each **hit** on the double adds **that double’s face value** to the running score (e.g. D1 = +1 per hit, D20 = +20 per hit). Multiple hits in one visit all add.
- If **all three darts miss**, subtract **one times** the double’s value once (e.g. three misses at D1 → −1).

Examples from the original notes:

```
Start 27, target D1
MISS, D1, MISS  →  27 + 1 = 28  (one hit)

Start 27, target D1
MISS, MISS, MISS  →  27 − 1 = 26
```

_(Original write-up used 29/25 with a slightly different example arithmetic; the rule is: sum hit values, or subtract 1× face value on a full-miss visit.)_

### Progress

After each visit, advance to the next double (1 → 2 → … → 20 → bull). Bull uses bull scoring as the “double value” for add/subtract (product should treat double bull / outer bull consistently — see open questions).

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
| **Hit**             | V1      | Dart in the required double.                           |
| **Full miss visit** | V1      | All three darts miss → subtract 1× the double’s value. |
| **Traditional**     | V1      | ≤0 ends the game; positive after bull wins.            |
| **Easy**            | V2+     | No death; finish the path even with a negative score.  |

## Open questions

- Confirm multi-hit math (each hit adds face value) vs any alternate house rules.
- Bull: outer 25 vs inner 50 for add/subtract on hit and on full miss.
