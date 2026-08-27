# Score Training

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                | Version         |
| -------------------------------------- | --------------- |
| Single player                          | v1              |
| Multiplayer (1v1)                      | V1              |
| Config screen (mode + duration)        | v1              |
| Fixed number of visits (N turns)       | v1 (default 10) |
| N editable (1–100)                     | v1              |
| Timed session (minutes)                | v1 (default 5)  |
| Minutes editable (3–30)                | v1              |
| Score as high as possible (face value) | v1              |
| All board segments count               | v1              |
| Bulls count (25 / 50)                  | v1              |
| Visit = 3 darts                        | v1              |
| Track total score                      | v1              |
| Track 3-dart average                   | v1              |
| Target score / challenge goal          | v1              |
| Standard dartboard scoring (assumed)   | v1              |

## Identity

Simple scoring practice: throw for **N** visits and pile up as many points as you can. No checkout, no bust — pure scoring volume. Standard dartboard scoring is assumed. (Source note: “n turns, score as high as you can.”)

## Objective

- **Visit:** score the sum of three darts (face values, including doubles/trebles/bulls).
- **Session (V1), Rounds mode:** complete **N** visits; highest total wins (solo: beat your own total / chase a personal best).
- **Session (V1), Timed mode:** score for **M** minutes; total at time-up is the result.
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest total score wins (score-compare, ties possible). <!-- 2026-08-22 -->

## Config & presets (V1)

Before play, a **config screen** shows the session config. Setup radios select the **mode** (Rounds / Timed), not preset names.

| Setting    | Preset / default                         | On config screen     |
| ---------- | ----------------------------------------- | --------------------- |
| Players    | Single player                             | Shown, locked          |
| Mode       | Rounds or Timed                           | Radios                 |
| Visits (N) | Default **10** (min **1**, max **100**)   | Editable when Rounds   |
| Minutes    | Default **5** (min **3**, max **30**)     | Editable when Timed    |
| Scoring    | Full board, standard values               | Shown, locked          |

## How to play (V1)

### Visit

Exactly **three darts** (or up to three — all count toward the visit total). Sum their standard values and add to the running session score.

### Progress

Rounds mode: repeat until **N** visits are done. Timed mode: keep throwing visits until the **M**-minute clock runs out (engine already supports a `MINUTES` duration type). Either way, every dart that scores on the board counts; there is no “wrong” target.

### Finishing

Rounds mode: session ends after visit N. Timed mode: session ends when the clock reaches 0, after the visit in progress completes. Report total points (and optionally 3-dart average = total ÷ visits played).

### Bust

N/A.

## Later versions (V2+)

### Variants

- Challenge: beat a **target total**
- Restricted scoring (e.g. only trebles, only 20s) as optional modes
- Multiplayer: highest total after N visits wins

### Match structure

- Best of / first to across multiple score-training blocks

### Other

- Track history / personal bests

## Glossary

| Term      | Version | Meaning                                         |
| --------- | ------- | ----------------------------------------------- |
| **Visit** | V1      | Three darts; sum is added to the session total. |
| **N**     | V1      | How many visits in the session (Rounds mode).   |
| **M**     | V1      | How many minutes in the session (Timed mode).   |
| **Mode**  | V1      | Rounds or Timed; picked on the config screen.   |

## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one visit total per turn, **no dart rows**.
- **One dart's fact:** none. Score Training does not record individual darts in V1; the unit of capture is the visit.
- **Stage type:** one `EXERCISE_BLOCK` for the whole session.
- **Derived, never stored:** the running total and three-dart average.

## Open questions

- Whether missed board / bounce-outs are entered as 0 only or have a separate miss track.
