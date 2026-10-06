# Doubles Lock

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Doubles D20 down to D1 | V1 | All | |
| One hit advances | V1 | All | |
| Two or three hits: Lock the double | V1 | All | |
| Zero hits: Retreat to the last locked double | V1 | All | |
| Lock bonus: 3 hits 100, 2 hits 50 | V1 | All | |
| Run ends past D1 | V1 | All | |
| Time-bound run | V1 | All | |
| Darts used, bonus points and locks readouts | V1 | All | |
| Strict Lock variant | V2+ | All | Wanted, unscheduled: three hits to lock is a rule narrowing, not needed to play |
| Even Doubles Only variant | V2+ | All | Wanted, unscheduled: a shorter target list is a configuration narrowing |
| Ascending Order variant | V2+ | All | Wanted, unscheduled: D1 up to D20 is a configuration of the path |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Doubles ladder with checkpoints: walk D20 down to D1. A good visit locks
  the double; a blank visit sends you back to your last lock, not the start.
  Source: dolfdarts.com, "Doubles Lock"
  (https://dolfdarts.com/games/doubles-lock, read 2026-10-06).
- Standard dartboard layout. Only the double counts. Bonus points are
  **exercise points**, not board scores.

## Exercise type

- Type constant: `LOCK_LADDER` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game. Doubles Training walks the same kind of path, but its
  modes are advance-always, stay-until-hit and step-back-one
  (`docs/game-rules/rulesets/doubles-training.md` §Features); none retreats
  to a checkpoint.
- Behaviour no existing type provides: a move decided by the visit's hit
  count, with a checkpoint the ladder falls back to.

## Objective

- Get past D1 in as few darts as possible, with as many bonus points as
  possible.
- Source benchmarks: club level under 120 darts with 500+ bonus points;
  elite 60–80 darts with 1,000+. A perfect run is 60 darts and 2,000 points.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 15 minutes | Routine step configuration |
| Path | D20 → D1 | Shown, locked |
| Lock threshold | 2 hits | Shown, locked |
| Bonus | 3 hits 100, 2 hits 50 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 15-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player walks the ladder; fewer darts wins (V2+).

### Visit

- Three darts at the current double. Only the double counts.

### Progress

- **3 hits:** advance, **lock** the double, +100 bonus.
- **2 hits:** advance, lock the double, +50 bonus.
- **1 hit:** advance, no lock, no bonus.
- **0 hits:** **retreat** to the most recent locked double.

### Bound

- **Run ends past D1** — once D1 is advanced from.
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Strict Lock variant** — only three hits lock.
- **Even Doubles Only variant** — D20, D18, … D2.
- **Ascending Order variant** — D1 up to D20.
- **Head-to-head** — two players walk the ladder; fewer darts wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target and zone
  as `doubleTargetIntent` records for a doubles path: the number and
  `DOUBLE` (`app/src/modules/game/turn-log.module.ts:103`). Hit number and
  hit zone record where it landed. `score` is the dart's **board** score
  (`appendObservedDart`, same file:134).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** hits per visit, locks, last lock, current
  double, bonus points, darts used.
- The result is darts used plus an exercise-points bonus, not a
  conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Lock** | V1 | A double hit two or three times in one visit; the retreat point |
| **Retreat** | V1 | A blank visit's move back to the last locked double |
| **Lock bonus** | V1 | 100 for three hits, 50 for two |
| **Strict Lock variant** | V2+ | Only three hits lock |
| **Even Doubles Only variant** | V2+ | The ten even doubles |
| **Ascending Order variant** | V2+ | D1 up to D20 |
| **Head-to-head** | V2+ | Two players, fewer darts wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- A blank visit before any lock: back to D20, or stay put? The source does
  not say.
- Is the bonus earned again when a double is re-locked after a retreat?
- Merge with Doubles Snakes and Ladders (`doubles-snakes-and-ladders.md`)
  into one hit-count ladder type with a configurable move table, or keep two
  types?
