# Double Pattern

Current version: V1 (shipped 2026-09-11)
Entry points: routine step
Kernel: TRACK

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Pattern list of 1 to 12 patterns, each 1 to 3 numbers | V1 | Single | |
| Every number 1–20 | V1 | Single | |
| Bull rejected as a target | V1 | Single | |
| Default patterns D20 → D10 → D5, D16 → D8 → D4, D12 → D6 → D3 | V1 | Single | |
| Patterns flatten into one repeating cycle | V1 | Single | |
| Hit = the double of the current number | V1 | Single | |
| A hit scores 1; nothing else scores | V1 | Single | |
| One dart per position; the aim advances hit or miss | V1 | Single | |
| Visit is one pattern, however long that pattern is | V1 | Single | |
| Cycle wraps after the last number of the last pattern | V1 | Single | |
| Time-bound run | V1 | Single | |
| Readout: doubles hit, darts, hit rate | V1 | Single | |
| Configurable points per zone | V2+ | All | Wanted, unscheduled: `DoublePatternV1Config` (`app/src/lib/training/exercises/rulesets/types.ts`) carries `patterns` and nothing else — it is `.strict()`, so there is no `scoring` key to set, unlike Switching Standard's |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only |

## Identity

- One double at a time, down a short pattern, then the next pattern: the
  doubles drill that never lets the aim sit still. The seeded patterns halve —
  D20 → D10 → D5 — so the run rehearses the numbers a leg actually walks down.
- Standard dartboard layout. The point value is an **exercise point**, not an
  X01 point (`docs/architecture/09-Training/01-Routines.md` §14).

## Tags

| Axis | Tags |
| --- | --- |
| Skill | DOUBLES (primary), SWITCHING |
| Session role | CORE |
| Format | SOLO |
| Difficulty | ADVANCED |
| Mechanic | SEQUENTIAL, ACCUMULATION |
| Pressure | NONE |

## Exercise type

- Type constant: `DOUBLE_PATTERN` (seeded in
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`), one
  ruleset version, `DOUBLE_PATTERN_V1`.
- Wraps no game (§12): its exercise template carries `game_type_id NULL`
  (`database/seeds/0017_balanced_training_routine.sql`).
- Behaviour no other type provides: an intended zone that is always the
  **double**. Switching Standard stamps every dart `TREBLE` (D297,
  `decisions/game-engine.md`) and Target Scoring aims at the treble or the
  bullseye; Double Pattern stamps `DOUBLE`
  (`app/src/modules/training/exercises/double-pattern.engine.module.ts`,
  `record`). That is also why the bull is not a legal target — it has no
  double.
- **Kernel.** `Kernel: TRACK` matches the engine's row in
  `scripts/engine-kernels.txt`. **That engine still folds its own state by
  hand and its row is `PENDING`, exactly as Switching Standard's is. This
  document does not perform that migration**; it only points the row at
  itself.

## Objective

- Hit as many doubles as you can in the time, taking them in the pattern's
  order rather than one at a time.
- A good run is a high **doubles hit** count at a high hit rate. What else is
  shown is derived (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 5 minutes (its only seeded step, Balanced Training step 3) | Routine step configuration |
| Patterns | `[[20, 10, 5], [16, 8, 4], [12, 6, 3]]` — 1 to 12 patterns of 1 to 3 numbers, each a number 1–20 | Routine step configuration |
| Points | 1 per hit double; nothing else scores | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The patterns preset is the exercise template's
`default_configuration` (`database/seeds/0017_balanced_training_routine.sql`);
the exercise type carries no duration of its own — duration is always the
step's (§5).

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- A **visit** is one **pattern** — as many darts as that pattern is long, so
  one, two or three. Patterns of unequal length still group their darts
  correctly, because a visit closes on its own pattern's length.
- One dart is thrown at each number of the pattern in turn. The intended
  target is always that number's **double**.

### Progress

- A **hit** is the double of the current number. A dart in any other ring of
  that number, on any other number, or off the board is a miss.
- A hit scores **1**. Nothing else scores: there is no value for a single, a
  treble, or a near miss on a neighbouring double.
- **One dart per position:** after each dart the aim advances to the next
  number, hit or miss alike. Nothing is ever repeated, and a miss never
  restarts anything.
- The patterns flatten into one repeating **cycle**: the last number of one
  pattern is followed by the first number of the next, with no pause between
  patterns.
- **Cycle wraps:** after the last number of the last pattern the cycle starts
  again at the first number of the first pattern, and a new visit begins.
- The run can never run out of targets, so nothing but the clock ends it.

### Bound

- **Time-bound run:** the run lasts the step's duration. Every exercise used
  in a routine is time-bound in that routine (§3.3, §5), and the engine owns
  no clock of its own — completion arrives only when the step's countdown
  reports it has elapsed (D264, `decisions/game-engine.md`).
- There is no second end condition: no dart budget, no pattern count, no
  finish on completing the cycle.

## Later versions

### Variants

- None scheduled. The type ships one ruleset version.

### Other

- **Configurable points per zone** — paying a single or a treble on the
  target number something, the way Switching Standard's `scoring` table does.
  See the Features row.
- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — the pair every dart-input
  exercise step uses today (§17, D277).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  current number of the pattern (`1`–`20`); intended zone = `DOUBLE` always,
  which is both the aim and what `chk_dart_target_consistency`
  (`database/migrations/0007_constraints.sql`) requires once a target is set.
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (D20 = 40), never the exercise point.
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts`). One `turns` row per visit — the
  open turn closes once it holds as many darts as the pattern it was created
  for.
- **Derived, never stored:** the current pattern, the position within it, the
  current double, the point total, darts thrown and hit rate. All are folds
  over the ordered dart facts and the step's configuration
  (`foldDoublePatternState`); the target at any dart is itself derived by
  replaying the cycle.
- The step summary reports three rows — **Doubles hit**, **Darts**, **Hit
  rate** (`summariseDoublePattern`,
  `app/src/modules/training/routines/routine-summary.module.ts`). The point
  total *is* the doubles-hit count, because a hit pays exactly 1.
- This exercise produces no conventional game score; an exercise engine need
  not (§13).

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Pattern** | V1 | One to three numbers worked in order, one dart each |
| **Cycle** | V1 | Every pattern's numbers end to end, repeating; the position the next dart is aimed at |
| **Visit** | V1 | One pattern's worth of darts |
| **Hit** | V1 | A dart in the double of the current number; anything else is a miss |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- **Repeated numbers are accepted.** `DoublePatternV1Config` constrains only
  the shape — 1 to 12 patterns of 1 to 3 numbers, each 1–20 — so `[[20, 20,
  20]]` is valid configuration, where Switching Chain and Target Scoring both
  reject a repeated target. Deliberate (a pattern of one number repeated is a
  real doubles drill) or simply never asked? No decision records either way.
- **No duration of its own.** Every other seeded exercise type has a duration
  preset named somewhere; Double Pattern's only seeded step is 5 minutes and
  §17's example says 10. Which is the type's default if a second routine ever
  uses it?
