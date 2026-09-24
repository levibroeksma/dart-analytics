# Bullseye Checkouts

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Every visit starts from 81 | V1 | All | |
| Free aim on Setup darts 1 and 2 | V1 | All | |
| Finishing dart 3 always aimed at the bullseye | V1 | All | |
| Checkout: setup darts total 31, dart 3 hits the bullseye | V1 | All | |
| Inner bull only finishes | V1 | All | |
| Unfinished visit not judged | V1 | All | |
| Time-bound run | V1 | All | |
| Checkouts, visits and Checkout rate readouts | V1 | All | |
| Configurable start score | V2+ | All | Wanted, unscheduled: V1 is 81 only, as the author (2026-09-24) described it; the start score is carried in the configuration so another number is a later widening, not a new type |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only, as 65 or More (`score-threshold.md`) |
| Fixed-attempt bound | Dropped | All | Decided against by the author (2026-09-24): a run is time-bound like every other routine exercise |
| Suggested setup route recorded as intended targets | Dropped | All | Decided against by the author (2026-09-24): the player picks their own setup; darts 1 and 2 record no intent |
| Outer bull finishes | Dropped | All | Decided against by the author (2026-09-24): only the bullseye (50) finishes |

## Identity

- Bull-finish practice: start at 81, three darts to check out, and the last
  dart must be the bullseye. Leave 50 with the first two darts, then take it
  out on the bull.
- Standard dartboard scoring: T20 = 60, S19 = 19, outer bull 25, bullseye 50.
  No exercise-specific points.

## Exercise type

- Type constant: `BULLSEYE_CHECKOUT` (new; not among the seeded types in
  `database/seeds/0014_exercise_types.sql`,
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`,
  `database/seeds/0023_target_scoring_exercise_type.sql`,
  `database/seeds/0024_switching_target_scoring_exercise_type.sql` or
  `database/seeds/0025_score_threshold_exercise_type.sql`).
- Wraps no game (§12). It is not 121 or X01: nothing carries between visits
  and there is no bust rule.
- Behaviour no existing type provides: a visit judged on two things at once —
  the board total of its first two darts and where its third dart landed.
  `SCORE_THRESHOLD` judges only a visit total; the target-based types judge
  each dart alone.

## Objective

- Check out 81 with the bullseye as many times as you can before the timer
  runs out.
- A good run is one with many **checkouts**. What else is shown is derived
  (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Start score | 81 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The start score is part of the configuration but accepts only 81 in
V1 (see **Configurable start score**). Duration preset mirrors 65 or More
(`score-threshold.md`).

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- **Every visit starts from 81:** each three-dart visit is a fresh attempt.
  Nothing carries over.
- **Free aim on setup darts 1 and 2:** the player throws at whatever setup
  they choose (e.g. S19 + S12, T10 + S1). A miss off the board scores 0.
- **Finishing dart 3 always aimed at the bullseye:** dart 3 is thrown at the
  bullseye whatever darts 1 and 2 did — also when one or both missed, and
  also when the setup already left something other than 50.
- A visit is a **checkout** when darts 1 and 2 total exactly 31 **and** dart 3
  hits the bullseye. Every other visit is a miss.
- **Inner bull only finishes:** the outer bull (25) on dart 3 does not
  finish.

### Progress

- A visit is judged once its third dart is recorded; a checkout adds one to
  **checkouts**, and every judged visit adds one to **visits**.
- The visit does not end early: all three darts are thrown even when the
  setup has already made a checkout impossible.

### Bound

- **Time-bound run:** the run lasts the step's duration (default 10 minutes).
  Every exercise used in a routine is time-bound in that routine (§3.3, §5).
- **Unfinished visit not judged:** a visit with fewer than three darts when
  the timer expires counts as neither a checkout nor a visit. Its darts are
  still recorded.

## Later versions

### Variants

- None scheduled.

### Other

- **Configurable start score** — a routine step picks another start score
  finished on the bull (e.g. 61, 90, 100). Same type, same rules; only the
  number, and so the setup total, changes.
- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — as 65 or More and Target
  Scoring (§17, D277).
- **One dart's fact:** one `darts` row per throw. Darts 1 and 2: no intended
  target and no intended zone — both null, which `chk_dart_target_consistency`
  allows (`database/migrations/0007_constraints.sql:84`); `appendObservedDart`
  defaults to no intent (`app/src/modules/game/turn-log.module.ts:134`).
  Dart 3: intended target number 25, intended zone `INNER_BULL` — the same
  intent `doubleTargetIntent` records for a bull target
  (`app/src/modules/game/turn-log.module.ts:103`). Hit number and hit zone
  record where each dart landed. `score` is the dart's **board** score.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts:118`). One
  `turns` row per three-dart visit; its total is the sum of its darts' board
  scores (`appendObservedDart`, same file).
- **Derived, never stored:** setup total, left after setup, checkout or not,
  checkouts, visits, checkout rate. All are folds over the ordered dart facts
  and the configuration.
- The exercise's result is a count (checkouts), not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Setup darts** | V1 | Darts 1 and 2 of a visit, aimed freely to leave 50 |
| **Finishing dart** | V1 | Dart 3 of a visit, always aimed at the bullseye |
| **Checkout** | V1 | A judged visit whose setup darts total exactly 31 and whose finishing dart hits the bullseye |
| **Inner bull** | V1 | The bullseye (50); the only finishing hit |
| **Unfinished visit** | V1 | A visit with fewer than three darts at timer expiry; not judged |
| **Checkouts** | V1 | Count of checkouts in the run |
| **Checkout rate** | V1 | Checkouts divided by judged visits |
| **Configurable start score** | V2+ | A start score other than 81, set per routine step |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- None.
