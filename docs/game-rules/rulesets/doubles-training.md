# Doubles Training

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                                      | Version |
| ------------------------------------------------------------ | ------- |
| Single player                                                | v1      |
| Multiplayer                                                  | TBD     |
| Config screen (presets shown)                                | v1      |
| Easy mode (advance after visit even on miss)                 | v1      |
| Hard mode (stay until hit)                                   | TBD     |
| Challenge mode (miss all 3 → step back; D1 miss → game over) | TBD     |
| Order: low → high (ending on bull)                           | v1      |
| Order: high → low (bull leads)                                | v1      |
| Order: randomized                                            | v1      |
| 3 darts per double                                           | v1      |
| Hit ends visit early                                         | v1      |
| Track overall hit/miss ratio                                 | v1      |
| Track per-target hit/miss ratio                              | v1      |
| Track which dart hit (1st / 2nd / 3rd)                       | v1      |
| Standard dartboard (assumed)                                 | v1      |

## Identity

Doubles practice: work through each double (and bull) with three darts per target. Modes range from “keep moving” easy practice to stay-until-hit and step-back challenge. Standard dartboard is assumed; only the **double** (or bull as double-bull / bull target) counts as a hit.

## Objective

- **Target:** hit the current double within the visit rules for the active mode.
- **Session (V1 easy):** visit every double once in order (1…20, then bull), whether or not you hit.

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting | V1 preset                   | On config screen (V1) |
| ------- | --------------------------- | --------------------- |
| Players | Single player               | Shown, locked         |
| Mode    | Easy                        | Shown, locked         |
| Order   | Low → high, high → low, or randomized — player's choice | Editable |

## How to play (V1) — Easy mode

### Visit

Three darts at the current double. A **miss** is anything that is not that double.

**Bull (V1, resolved):** the bull target means the **inner bull (double bull, 50) only** — it is the double of the bull, so it is the only hit. The **outer bull (25) is a miss**, consistent with Bob's 27.

If the player **hits** the double on the first or second dart, the visit **ends immediately** — collect darts and move to the next target.

If all three miss, still **move on** to the next double.

### Progress

Order: **D1 → D2 → … → D20 → bull** by default (low → high). High → low
reverses it with bull leading — **bull → D20 → … → D1** — matching Singles
Training's convention rather than "ending on bull." Randomized shuffles all
21 targets (the 20 doubles and bull) together; bull can land anywhere.
Complete the path once, in whichever order the player chose at setup.

### Finishing

Session ends after the bull visit.

### Bust

N/A.

## Later versions (V2+)

### Variants — Hard mode

Same three darts per target and early end on hit, but the player **stays on the double until it is hit**. Missed visits repeat the same target.

### Variants — Challenge mode

Same as hard for hits, but if the player **misses with all three darts**, they **move back** one double. On **D1**, missing all three is **game over**.

### Config

- Order (v1): low → high, high → low (bull leads), randomized (bull shuffled in with the 20 doubles)

### Other — Tracks

- Overall hit/miss ratio
- Per-target hit/miss ratio
- Which dart of the visit scored the hit (1st / 2nd / 3rd)

## Glossary

| Term          | Version | Meaning                                                |
| ------------- | ------- | ------------------------------------------------------ |
| **Easy**      | V1      | One visit per double; advance even after three misses. |
| **Hard**      | V2+     | Remain on a double until hit.                          |
| **Challenge** | V2+     | Three misses → previous double; D1 wipe → game over.   |
| **Hit**       | V1      | Dart in the required double; on the bull target, the inner bull only. |
| **Low → high**  | V1    | D1, D2, … D20, bull.                                   |
| **High → low**  | V1    | Bull, D20, D19, … D1.                                  |
| **Random**      | V1    | All 21 targets (the 20 doubles and bull) shuffled together per session; bull can land anywhere. |

## Capture

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — only the darts actually thrown are recorded, so a visit ended early by a hit stores one or two darts, not three.
- **One dart's fact:** intended = the current double (`DOUBLE` on its number; `INNER_BULL` on 25 for the bull target); hit = whatever landed; `score` = the **board** score of that dart (D1 = 2, S5 = 5, miss = 0).
- **Stage type:** one `EXERCISE_BLOCK` for the whole run.
- **Derived, never stored:** overall and per-target hit/miss ratios, and which dart of the visit scored the hit — all readable from the dart facts.

## Open questions

- None. Bull identity resolved 2026-07-26 (inner bull only; see Visit).
