# 170 Practice

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Fixed dart path: T20, T20, bullseye | V1 | All | |
| One visit per attempt | V1 | All | |
| All three darts thrown, even after a miss | V1 | All | |
| Checkout only when all three darts hit their target | V1 | All | |
| Block of 10 attempts | V1 | All | |
| Time-bound run | V1 | All | |
| Checkouts, T20 rate, bullseye rate and 2-of-3 readouts | V1 | All | |
| Pressure variant | V2+ | All | Wanted, unscheduled: a restart rule on top of the block; the block alone is usable |
| High-checkout rotation | V2+ | All | Wanted, unscheduled: needs a dart path per finish (167, 164) that the source does not give — see Open questions |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Drill the maximum checkout: T20, T20, bullseye in one visit. Trains treble
  accuracy, the bullseye, and finishing under self-set pressure. Source:
  dolfdarts.com, "170 Practice" (https://dolfdarts.com/games/170-practice,
  read 2026-10-06).
- Standard dartboard scoring. No exercise points: the run counts checkouts and
  hit rates.

## Exercise type

- Type constant: `VISIT_PATH` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Named for the rule — one
  fixed target per dart slot — so the 167 and 164 rotations are
  configurations of it.
- Wraps no game.
- Behaviour no existing type provides: a **different intended target per dart
  slot** inside one visit, judged as a whole. `BULLSEYE_CHECKOUT` judges darts
  1–2 by their total, not by target; `SWITCHING` and `TARGET_SCORING` judge
  each dart alone.

## Objective

- Hit T20, T20 and the bullseye with the three darts of one visit.
- A good run is a high checkout count; the source calls a 170 inside 20
  darts (6–7 attempts) strong.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Dart path | T20, T20, bullseye | Shown, locked |
| Attempts per block | 10 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced — see Open
questions.

## How to practise

**Single:** one player per run.

**1v1:** each player throws the same block; more checkouts wins (V2+).

### Visit

- Three darts, one visit per **attempt**. Dart 1 aims at T20, dart 2 at T20,
  dart 3 at the bullseye.
- All three darts are thrown even once the checkout can no longer happen.
- **Checkout:** every dart hit its own target. Anything else is an incomplete
  attempt.

### Progress

- Each visit is the next attempt on the same path. Nothing carries between
  attempts.

### Bound

- **Block of 10 attempts** (30 darts) when run on its own count.
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the block (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Pressure variant** — at least one checkout inside 5 attempts, or the
  block restarts.
- **High-checkout rotation** — attempts alternate 170, 167 and 164.
- **Head-to-head** — two players throw the same block; more checkouts wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Darts 1 and 2: intended
  target 20, intended zone `TREBLE`. Dart 3: intended target 25, intended
  zone `INNER_BULL`. Both keys exist in `DartZoneKey`
  (`app/src/modules/game/types.ts:349`); a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per attempt.
- **Derived, never stored:** checkout per attempt, checkouts, attempts,
  checkout rate, T20 rate, bullseye rate, 2-of-3 rate, darts to first
  checkout.
- The exercise produces no conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Fixed dart path** | V1 | The intended target of each dart slot: T20, T20, bullseye |
| **Checkout** | V1 | An attempt in which all three darts hit their target |
| **Block of 10 attempts** | V1 | The run's own bound: 10 visits, 30 darts |
| **2-of-3** | V1 | An attempt in which at least two darts hit their target |
| **Pressure variant** | V2+ | Restart the block if no checkout inside 5 attempts |
| **High-checkout rotation** | V2+ | Attempts alternate 170, 167, 164 |
| **Head-to-head** | V2+ | Two players, more checkouts wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Default duration: 10 minutes is a draft guess for one 30-dart block.
- High-checkout rotation: which dart path does 167 and 164 use? The source
  names only the totals.
- Inside a routine, does the run stop at the block's end or keep starting new
  blocks until time runs out?
