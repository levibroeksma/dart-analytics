# Nine Dart Century

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Exactly 100 in nine darts | V1 | All | |
| Free aim: no intended target recorded | V1 | All | |
| Over 100 voids the visit and fails the attempt | V1 | All | |
| Attempt ends on exactly 100, on a fail, or after nine darts | V1 | All | |
| Attempts repeat until the run ends | V1 | All | |
| Time-bound run | V1 | All | |
| Successes, attempts and darts per success readouts | V1 | All | |
| Different targets variant | V2+ | All | Wanted, unscheduled: 50, 75 or 150 is a configuration of the target |
| Six-dart variant | V2+ | All | Wanted, unscheduled: two visits instead of three is a configuration of the dart budget |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Control, not power: land on exactly 100 with nine darts. Trains planning a
  total and adjusting the last visit. Source: dolfdarts.com, "Nine Dart
  Century" (https://dolfdarts.com/games/nine-dart-century, read 2026-10-06).
- Standard dartboard scoring. No double-out.

## Exercise type

- Type constant: `EXACT_TOTAL` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Named for the rule, so
  other targets are configurations.
- Wraps no game.
- Behaviour no existing type provides: a total built **up** across visits to
  an exact value, with no double-out. `SCORE_THRESHOLD` judges one visit
  against a minimum (`score-threshold.md` §Exercise type).

## Objective

- Hit exactly 100 in as many attempts as possible, in as few darts as
  possible.
- A good run has a high **success** count.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Target total | 100 | Shown, locked |
| Darts per attempt | 9 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** players race to exactly 100; fewest darts wins, else closest under
100 (V2+).

### Visit

- Three darts, free aim. Each dart's board score adds to the attempt's
  **total**.
- Total over 100: the visit is void and the attempt **fails**.

### Progress

- An **attempt** is up to three visits (nine darts).
- Exactly 100: success; the attempt ends.
- Under 100 after nine darts: fail.
- After any end, a new attempt starts at 0.

### Bound

- **Time-bound run**: attempts repeat until the allocated duration runs out
  (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Different targets variant** — 50, 75 or 150 instead of 100.
- **Six-dart variant** — two visits per attempt.
- **Head-to-head** — fewest darts to exactly 100 wins; if nobody makes it,
  closest under 100.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw, void darts included. No
  intended target or zone — both null, which `chk_dart_target_consistency`
  allows (`database/migrations/0007_constraints.sql:86`). `score` is the
  dart's **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** attempt total, void, success or fail, attempt
  boundaries, successes, attempts, darts per success, closest miss.
- The exercise produces a success count, not a conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Exactly 100** | V1 | The target total of one attempt |
| **Attempts repeat** | V1 | A new attempt at 0 after each success or fail |
| **Different targets variant** | V2+ | 50, 75 or 150 |
| **Six-dart variant** | V2+ | Two visits per attempt |
| **Head-to-head** | V2+ | Two players race to exactly 100 |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- A bust on dart 1 or 2: are the remaining darts of that visit thrown or
  skipped? The attempt has failed either way.
- Default duration: 10 minutes is a draft guess.
