# Score Training

Current version: V1 (shipped 2026-07-16)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (Mode + duration) | V1 | All | |
| Fixed number of visits (N turns, default 10) | V1 | All | |
| N editable (1–100) | V1 | All | |
| Timed session (minutes, default 5) | V1 | All | |
| Minutes editable (3–30) | V1 | All | |
| Score as high as possible (face value) | V1 | All | |
| All board segments count | V1 | All | |
| Bulls count (25 / 50) | V1 | All | |
| Visit = 3 darts | V1 | All | |
| Track total score | V1 | All | |
| Track 3-dart average | V1 | All | |
| Target score / challenge goal | V2+ | All | Wanted, unscheduled: `ScoreTrainingConfig` carries only `duration_type`, `duration_value`, `max_darts_per_turn` and `max_visit_score` — there is no goal field, and a goal also needs a pass/fail result the session has no notion of |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

Simple scoring practice: throw for **N** visits and pile up as many points as you can. No checkout, no bust — pure scoring volume. Standard dartboard scoring is assumed. (Source note: “n turns, score as high as you can.”)

## Objective

- **Visit:** score the sum of three darts (face values, including doubles/trebles/bulls).
- **Session (V1), Rounds mode:** complete **N** visits; highest total wins (solo: beat your own total / chase a personal best).
- **Session (V1), Timed mode:** score for **M** minutes; total at time-up is the result.
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest total score wins (score-compare, ties possible). <!-- 2026-08-22 -->

## Config & presets

Before play, a **config screen** shows the session config. Setup radios select the **mode** (Rounds / Timed), not preset names.

| Setting    | Preset / default                         | On config screen     |
| ---------- | ----------------------------------------- | --------------------- |
| Players    | 1 seat, or 2 (guest or DartBot), Rounds mode only | Editable       |
| Mode       | Rounds or Timed                           | Radios                 |
| Visits (N) | Default **10** (min **1**, max **100**)   | Editable when Rounds   |
| Minutes    | Default **5** (min **3**, max **30**)     | Editable when Timed    |
| Scoring    | Full board, standard values               | Shown, locked          |

## How to play

### Visit

Exactly **three darts** (or up to three — all count toward the visit total). Sum their standard values and add to the running session score.

### Progress

Rounds mode: repeat until **N** visits are done. Timed mode: keep throwing visits until the **M**-minute clock runs out (engine already supports a `MINUTES` duration type). Either way, every dart that scores on the board counts; there is no “wrong” target.

### Finishing

Rounds mode: session ends after visit N. Timed mode: session ends when the clock reaches 0, after the visit in progress completes. Report total points (and optionally 3-dart average = total ÷ visits played).

### Bust

N/A.

### Ends when

Whichever bound the chosen mode sets, and nothing else:

- **Rounds mode** — after visit **N** (1–100, default 10).
- **Timed mode** — when the **M**-minute clock reaches 0 (3–30, default 5); the
  visit in progress finishes first.

**Single:** the one seat plays its own budget out.

**1v1:** Rounds mode only. Both seats play the full round budget and neither is
cut short; the match ends once both are done. Highest total wins; equal totals
is a tie, with no tiebreak. A DartBot seat counts as the opponent seat.

### Result

The total score and the 3-dart average, with visits played. In 1v1, the winning
seat beside both seats' totals, or a tie.

## Later versions

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
