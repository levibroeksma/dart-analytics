# Bullseye 500

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Every dart at the bull | V1 | All | |
| Running total of board scores: outer bull 25, bullseye 50 | V1 | All | |
| A miss resets the running total to 0 | V1 | All | |
| Run ends when the running total reaches 500 | V1 | All | |
| Time-bound run | V1 | All | |
| Best total, resets and bull rate readouts | V1 | All | |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Bull consistency under pressure: build 500 on the bull without a single
  miss. Source: Shot Darts, "Three routines for dart practice"
  (https://www.shotdarts.com/blog/three-routines-for-dart-practise, read
  2026-10-06): "score 500 points on the bullseye without missing or bouncing a
  dart … the outer ring on the bull is 25 pts and the dead centre bull is
  50 points".
- Standard dartboard scoring. No exercise points.

## Exercise type

- Type constant: `BULL_RUN` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game.
- Close to Target Scoring on the bull — there too the first miss wipes the
  chain — but Target Scoring scores exercise points (outer bull 1, bullseye 3)
  and has no goal (`target-scoring.md` §Config & presets). This one sums board
  scores and ends at a fixed goal. Whether it is a Target Scoring
  configuration instead is open.

## Objective

- Reach 500 on the bull in one unbroken run of hits.
- A good run reaches 500; short of that, a high **best total**.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Goal | 500 | Shown, locked |
| Target | Bull | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player builds their own total; first to 500 wins (V2+).

### Visit

- Three darts, all at the bull. Outer bull adds 25, bullseye adds 50 to the
  **running total**.
- Any dart off the bull — a bounce-out included — is a miss and resets the
  running total to 0.

### Progress

- The running total carries across visits until a miss.

### Bound

- **Run ends when the running total reaches 500.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Head-to-head** — two players each build their own total; first to 500
  wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target 25,
  intended zone `INNER_BULL` — the intent `doubleTargetIntent` records for a
  bull target (`app/src/modules/game/turn-log.module.ts:103`). Hit number and
  hit zone record where it landed; a bounce-out is recorded as a miss.
  `score` is the dart's **board** score (`appendObservedDart`, same file:134).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** running total, resets, best total, bull rate,
  bullseye rate, darts to 500.
- The exercise produces no conventional score; the running total is a fold
  over board scores.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Running total** | V1 | Sum of board scores since the last miss |
| **Best total** | V1 | Highest running total reached in the run |
| **Head-to-head** | V2+ | Two players, first to 500 wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Does a total that passes 500 (475 + 50) count, or must it land on exactly
  500? The source does not say.
- Merge into Target Scoring as a board-score, fixed-goal configuration, or
  keep its own type?
- Default duration: 10 minutes is a draft guess.
