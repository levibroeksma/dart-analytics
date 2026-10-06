# A1 Routine

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Targets 20 down to 13, then bull | V1 | All | |
| Round: one visit at each open target, in order | V1 | All | |
| Two-hit threshold: each hit is a mark only when 2+ darts hit | V1 | All | |
| Five marks close a target | V1 | All | |
| Run ends when every target is closed | V1 | All | |
| Time-bound run | V1 | All | |
| Rounds, marks and closed targets readouts | V1 | All | |
| Beginner version | V2+ | All | Wanted, unscheduled: three marks to close is a configuration narrowing |
| Custom targets | V2+ | All | Wanted, unscheduled: a configuration widening |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Grouping around the top half of the board: hit each of 20–13 and the bull
  with two or more darts of a visit, five marks each. Source: dolfdarts.com,
  "A1 Routine" (https://dolfdarts.com/games/a1-routine, read 2026-10-06),
  after the GoDartsPro routine of the same name
  (https://www.godartspro.com/?p=2513).
- Standard dartboard layout. Any bed of the target counts; for the bull,
  outer and inner both count. Marks are not board scores.

## Exercise type

- Type constant: `MARKS_TO_CLOSE` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game.
- Behaviour no existing type provides: marks that accumulate per target
  across rounds, a per-visit hit threshold, and a rotation that skips closed
  targets. Mikko's Megatrain (`mikkos-megatrain.md`) also needs two hits per
  visit but closes a target in one visit and walks a sequence.

## Objective

- Close all nine targets in as few rounds as possible.
- A good run is a low **rounds** count; 45 marks is the full set.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 20 minutes | Routine step configuration |
| Targets | 20, 19, 18, 17, 16, 15, 14, 13, bull | Shown, locked |
| Marks to close | 5 | Shown, locked |
| Hit threshold | 2 of 3 darts | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 20-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player plays the full routine; fewer rounds wins (V2+).

### Visit

- Three darts at the current target; any bed counts.
- Two or three hits: each hit adds one **mark** to the target.
- Zero or one hit: no mark.

### Progress

- A **round** is one visit at each open target, from 20 down to the bull.
- A target with five marks is **closed** and skipped in later rounds.

### Bound

- **Run ends when every target is closed.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Beginner version** — three marks close a target.
- **Custom targets** — the player picks the numbers.
- **Head-to-head** — two players each play the routine; fewer rounds wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Any bed counts, so no one
  ring is intended: intended target and intended zone are both null, as
  Singles Training records for the same reason
  (`app/src/modules/game/singles-training.engine.module.ts:340`); null is
  allowed (`chk_dart_target_consistency`,
  `database/migrations/0007_constraints.sql:86`). The current target is
  derived from the configuration and the dart order. Hit number and hit zone
  record where it landed. `score` is the dart's **board** score
  (`appendObservedDart`, `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** hits per visit, marks per target, closed
  targets, current target, rounds.
- The exercise produces a rounds count, not a conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Round** | V1 | One visit at each open target, in order |
| **Two-hit threshold** | V1 | A visit's hits count as marks only when two or more darts hit |
| **Five marks** | V1 | Marks that close a target |
| **Beginner version** | V2+ | Three marks close a target |
| **Custom targets** | V2+ | Player-picked numbers |
| **Head-to-head** | V2+ | Two players, fewer rounds wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Sources differ. dolfdarts.com: in a 2+ hit visit, **each hit** is a mark,
  and targets rotate every round. GoDartsPro (via its A1 summary): a 2+ hit
  visit is **one** mark, and each number is finished before the next. This
  file follows dolfdarts.com; which is the original?
- A target with four marks hit three times: closed with seven, or do extra
  marks matter? (No effect on rounds; only on a marks readout.)
