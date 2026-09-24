# Bull Up Practice

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| One dart per throw, always aimed at the bullseye | V1 | All | |
| Throw result tiers: Bullseye, Outer bull, Miss | V1 | All | |
| Time-bound run | V1 | All | |
| Throws, Bullseyes, Bulls, Bullseye rate and Bull rate readouts | V1 | All | |
| Distance from centre readout | V2+ | All | Wanted, unscheduled: bull up is decided by closeness, but V1 judges the zone hit only; a dart's board location (`locationX`/`locationY`) is nullable (`app/src/modules/game/types.ts:364`) and the board-input path can record none (`app/src/modules/game/board-input.module.ts:244`), so a distance readout needs its own design |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only, by the author's choice (2026-09-24) |
| Fixed-throw bound | Dropped | All | Decided against by the author (2026-09-24): a run is time-bound like every other routine exercise |
| Bullseye-only hit | Dropped | All | Decided against by the author (2026-09-24): the outer bull is its own tier, not a miss |

## Identity

- Bull-up practice: one dart at the bull, retrieve it, throw again. Trains the
  single throw at the start of a match that decides who throws first.
- Standard dartboard scoring: outer bull 25, bullseye 50. No exercise-specific
  points.

## Exercise type

- Type constant: `BULL_UP` (new; not among the seeded types in
  `database/seeds/0014_exercise_types.sql`,
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`,
  `database/seeds/0023_target_scoring_exercise_type.sql`,
  `database/seeds/0024_switching_target_scoring_exercise_type.sql`,
  `database/seeds/0025_score_threshold_exercise_type.sql` or
  `database/seeds/0029_bullseye_checkout_exercise_type.sql`).
- Wraps no game (§12).
- Behaviour no existing type provides: a visit of **one** dart. Every other
  exercise judges three-dart visits. Target Scoring accepts the bull as a
  target (`docs/architecture/09-Training/01-Routines.md` §Target Scoring) but
  builds a chain across three-dart visits; it is not a bull-up configuration.

## Objective

- Hit the bull with a single, cold dart as often as you can before the timer
  runs out; the bullseye is better than the outer bull.
- A good run is one with a high **bullseye rate** and **bull rate**. All
  readouts are derived (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 5 minutes | Routine step configuration |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The target is always the bull and is not configurable.

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts:7`).

### Visit

- **One dart per throw, always aimed at the bullseye:** each visit is a single
  dart. Throw, retrieve, throw again.
- Each throw lands in one of three **throw result tiers**:
  - **Bullseye** — inner bull (50).
  - **Outer bull** — outer bull (25).
  - **Miss** — anything else, including off the board.

### Progress

- A throw is judged the moment its dart is recorded. It adds one to
  **throws**; a bullseye also adds one to **bullseyes**; a bullseye or outer
  bull adds one to **bulls**.
- Nothing carries between throws.

### Bound

- **Time-bound run:** the run lasts the step's duration (default 5 minutes).
  Every exercise used in a routine is time-bound in that routine (§3.3, §5).
- A visit is one dart, so no visit is left unfinished at timer expiry.

## Later versions

### Variants

- None scheduled.

### Other

- **Distance from centre readout** — show how close each throw landed to the
  centre, as bull up is decided in a match. See the Features row.
- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — as 65 or More and Bullseye
  Checkouts (§17, D277).
- **One dart's fact:** one `darts` row per throw. Intended target number 25,
  intended zone `INNER_BULL` — the intent `doubleTargetIntent` records for a
  bull target (`app/src/modules/game/turn-log.module.ts:103`). Hit number and
  hit zone record where it landed. `score` is the dart's **board** score.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts:118`).
  One `turns` row per throw, holding exactly one dart; its total is that
  dart's board score (`appendObservedDart`, same file, line 134). When a visit
  resolves is the ruleset's own rule (same function's doc comment), so a
  one-dart turn needs no new turn shape.
- **Derived, never stored:** throw result tier, throws, bullseyes, bulls,
  bullseye rate, bull rate. All are folds over the ordered dart facts.
- The exercise's result is a set of counts and rates, not a conventional game
  score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Throw** | V1 | One dart, aimed at the bullseye; one visit |
| **Throw result tiers** | V1 | The three outcomes of a throw: Bullseye, Outer bull, Miss |
| **Bullseye** | V1 | Inner bull (50); the best tier |
| **Outer bull** | V1 | Outer bull (25); the middle tier |
| **Miss** | V1 | Any throw that hits neither bull |
| **Bullseyes** | V1 | Count of bullseye throws in the run |
| **Bulls** | V1 | Count of throws hitting either bull |
| **Bullseye rate** | V1 | Bullseyes divided by throws |
| **Bull rate** | V1 | Bulls divided by throws |
| **Time-bound run** | V1 | A run limited by its duration, default 5 minutes |
| **Distance from centre readout** | V2+ | How close each throw landed to the centre |
| **Standalone entry** | V2+ | Playing a run outside a routine |
| **Fixed-throw bound** | Dropped | A run limited by a throw count instead of time |
| **Bullseye-only hit** | Dropped | Judging the outer bull as a miss |

## Open questions

- None.
