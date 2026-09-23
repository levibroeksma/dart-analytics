# 65 or More

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Free aim: any segment, no intended target | V1 | All | |
| Visit total = sum of the three darts' board scores | V1 | All | |
| Beat: a visit total of 65 or more | V1 | All | |
| Threshold fixed at 65 | V1 | All | |
| Unfinished visit not judged | V1 | All | |
| Time-bound run | V1 | All | |
| Beats, visits and Beat rate readouts | V1 | All | |
| Last visit total readout | V1 | All | |
| Configurable threshold | V2+ | All | Wanted, unscheduled: the author (2026-09-23) wants 65 only for now, with the config shaped so another threshold is a later widening, not a new type |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only, as Target Scoring (`target-scoring.md`) |
| Fixed or configurable aim (e.g. T20 recorded as intended target) | Dropped | All | Decided against by the author (2026-09-23): the player aims freely; nothing about the aim is recorded |
| Beat streak and best streak readouts | Dropped | All | Decided against by the author (2026-09-23): V1 readouts are beats, visits and beat rate |

## Identity

- Simple scoring practice: three darts, aim to score 65 or more. How many times
  can you beat the target before the time runs out?
- Standard dartboard scoring: the visit total is the X01 visit total (T20 = 60,
  D20 = 40, outer bull 25, bullseye 50). No exercise-specific points.

## Exercise type

- Type constant: `SCORE_THRESHOLD` (new; not among the seeded types in
  `database/seeds/0014_exercise_types.sql`,
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`,
  `database/seeds/0023_target_scoring_exercise_type.sql` or
  `database/seeds/0024_switching_target_scoring_exercise_type.sql`). The type
  is named for the rule, not the number, so a later threshold is a
  configuration of it (§3.5); "65 or More" is the template's name.
- Wraps no game (§12).
- Behaviour no existing type provides: every other dart-writing type judges
  each dart against an intended target (`TARGET_SCORING`,
  `SWITCHING_TARGET_SCORING`, `SWITCHING`, `DOUBLE_PATTERN`). This one has no
  target and judges the whole visit by its board total.

## Objective

- Beat the threshold with as many visits as you can before the timer runs out.
- A good run is one with many **beats**. What else is shown is derived (see
  Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Threshold | 65 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The threshold is part of the configuration but accepts only 65 in
V1 (see **Threshold fixed at 65**). Duration preset mirrors Target Scoring
(`target-scoring.md`).

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- Visits are three darts. **Free aim:** the player throws at whatever they
  choose; there is no current target.
- The **visit total** is the sum of the three darts' board scores. A miss off
  the board scores 0.
- A visit is a **beat** when its total is 65 or more. 65 itself beats.

### Progress

- A visit is judged once its third dart is recorded; a beat adds one to
  **beats**, and every judged visit adds one to **visits**.
- Nothing carries between visits: each visit starts from 0.
- **Threshold fixed at 65:** V1 accepts only 65. The threshold is still
  carried in the configuration, so widening it later is a configuration change
  (see **Configurable threshold**).

### Bound

- **Time-bound run:** the run lasts the step's duration (default 10 minutes).
  Every exercise used in a routine is time-bound in that routine (§3.3, §5).
- **Unfinished visit not judged:** a visit with fewer than three darts when
  the timer expires counts as neither a beat nor a visit. Its darts are still
  recorded.

## Later versions

### Variants

- None scheduled.

### Other

- **Configurable threshold** — a routine step picks another threshold (e.g.
  60, 81, 100). Same type, same rules; only the number changes.
- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — as Target Scoring and
  Switching (§17, D277).
- **One dart's fact:** one `darts` row per throw. No intended target and no
  intended zone — both null, which `chk_dart_target_consistency` allows
  (`database/migrations/0007_constraints.sql:84`); `appendObservedDart`
  defaults to no intent (`app/src/modules/game/turn-log.module.ts:134`). Hit
  number and hit zone record where it landed. `score` is the dart's **board**
  score.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts`). One
  `turns` row per three-dart visit; its total is the sum of its darts' board
  scores (`appendObservedDart`, same file).
- **Derived, never stored:** visit total, beat or not, beats, visits, beat
  rate, last visit total. All are folds over the ordered dart facts and the
  configuration.
- The exercise's result is a count (beats), not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Free aim** | V1 | The player throws at any segment; no intended target is recorded |
| **Visit total** | V1 | Sum of a visit's three board scores |
| **Beat** | V1 | A judged visit whose total is at least the threshold (65) |
| **Unfinished visit** | V1 | A visit with fewer than three darts at timer expiry; not judged |
| **Beats** | V1 | Count of beats in the run |
| **Beat rate** | V1 | Beats divided by judged visits |
| **Last visit total** | V1 | The total of the most recent judged visit |
| **Configurable threshold** | V2+ | A threshold other than 65, set per routine step |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- None.
