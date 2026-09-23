# Switching Target Scoring

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Target sequence: 20 → 19 → 18 | V1 | All | |
| Target sequence of exactly three targets | V1 | All | |
| Target sequence accepts any board target (1–20, Bull) | V1 | All | |
| Hit = single or treble of the current target; a double is a miss | V1 | All | |
| Number points: single 1, treble 3 | V1 | All | |
| Bull points: outer bull 1, bullseye 3 | V1 | All | |
| Advance on a hit | V1 | All | |
| Miss resets the chain and restarts the sequence | V1 | All | |
| Chain carries over a completed sequence | V1 | All | |
| Sequence carries across visits | V1 | All | |
| Time-bound run | V1 | All | |
| Best chain readout | V1 | All | |
| Best finished chain as the mark to beat | V1 | All | |
| Duplicate targets rejected | V1 | All | |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only, as Target Scoring (`target-scoring.md`) |
| Per-dart-position targets (dart 1 → 20, dart 2 → 19, dart 3 → 18 regardless of misses) | Dropped | All | Decided against by the author (2026-09-23): a miss restarts the sequence at the first target, even mid-visit |
| Every visit restarts at the first target | Dropped | All | Decided against by the author (2026-09-23): the sequence and chain carry across visits |

## Identity

- Target Scoring's point system on a switching sequence: each hit moves the aim
  to the next target in the sequence, and the chain keeps growing as long as
  every dart hits its target. The first miss wipes the chain and sends the
  player back to the start of the sequence. Trains switching between adjacent
  segments without losing the rhythm. "How high can you get?"
- Standard dartboard layout. Point values are **exercise points**, not X01
  points (`docs/architecture/09-Training/01-Routines.md` §14).

## Exercise type

- Type constant: `SWITCHING_TARGET_SCORING` (new; not among the seeded types in
  `database/seeds/0014_exercise_types.sql`,
  `database/seeds/0016_switching_double_pattern_exercise_types.sql` or
  `database/seeds/0023_target_scoring_exercise_type.sql`).
- Wraps no game (§12).
- Behaviour no existing type provides:
  - `TARGET_SCORING` advances only on a broken chain and stays on one target
    while hits keep coming (`target-scoring.md` §Progress);
  - `SWITCHING` scores a treble ladder and rejects the bull (D297,
    `decisions/game-engine.md`).
  This exercise advances on every **hit** and restarts on every **miss** — a
  different progression rule, so its own type, not a configuration of either.

## Objective

- Build the highest **chain** you can by hitting the sequence in order, over
  and over, before a miss resets it.
- A good run is one with a high **best chain**. What else is shown is derived
  (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Targets | 20, 19, 18 — exactly three of 1–20 and 25, in any order, each at most once | Routine step configuration |
| Points (number) | Single 1, treble 3; double is a miss | Shown, locked |
| Points (bull) | Outer bull 1, bullseye 3 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. Duration preset mirrors Target Scoring (`target-scoring.md`).

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- Visits are three darts. Every dart is thrown at the **current target**,
  which changes after every dart (see Progress). With no miss, a visit is
  20 → 19 → 18.
- A dart **hits** when it lands in a scoring ring of the current target:
  - number target: inner single, outer single or treble of that number;
  - Bull: outer bull or bullseye.
- Anything else is a **miss**: the double of the current number, another
  number, the bull when aiming at a number, a number when aiming at the bull,
  or off the board. A double is a miss like any other.

### Progress

- Points per hit, added to the **chain**:
  - number: single **1**, treble **3**;
  - Bull: outer bull **1**, bullseye **3**.
- **Advance on a hit:** a hit moves the current target to the next in the
  sequence.
- **Chain carries over a completed sequence:** after a hit on the last target
  the sequence starts again at the first, and the chain keeps growing.
- **Miss resets the chain and restarts the sequence:** a miss sets the chain to
  0 and the current target back to the first — even mid-visit. The next dart,
  in the same visit or the next, is thrown at the first target.
- **Sequence carries across visits:** a visit boundary changes nothing. A visit
  of miss, 20, 19 leaves the current target at 18 and the chain at 2; the next
  visit's first dart is thrown at 18.
- **Best finished chain as the mark to beat:** once a chain holding at least
  one hit has been ended by a miss earlier in this run, the best such chain is
  shown while the player builds the next — simulating match pressure. Not
  shown before the first finished chain. This run only, never an all-time
  best. The chain spans all targets, so there is one mark per run, not one per
  target.
- **Duplicate targets rejected:** a sequence naming the same target twice
  (e.g. 20, 20, 19) is invalid configuration.

### Bound

- **Time-bound run:** the run lasts the step's duration (default 10 minutes).
  Every exercise used in a routine is time-bound in that routine (§3.3, §5).
  The sequence restarting means the targets never run out before the timer.
- A chain still live when the timer expires counts toward **best chain**: it
  was reached.

## Later versions

### Variants

- None scheduled.

### Other

- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — as Target Scoring and
  Switching (§17, D277).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  current target's number (`1`–`20` or `25`); intended zone = `TREBLE` on a
  number, `INNER_BULL` on the bull — both keys exist in `DartZoneKey`
  (`app/src/modules/game/types.ts`), and a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (T20 = 60, bullseye = 50), never exercise points.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts`). One
  `turns` row per three-dart visit; each dart carries its own intended target,
  so the per-dart target change is expressed per dart.
- **Derived, never stored:** exercise points per dart, current chain, current
  target, position in the sequence, completed sequences, best chain, best
  finished chain, hit rate. All are folds over the ordered dart facts and the
  configuration; the target at any dart is itself derived by replaying the
  rules.
- This exercise produces an exercise score (the chain), not a conventional
  game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target sequence** | V1 | The ordered three targets a run switches through; any of 1–20 and Bull |
| **Hit** | V1 | A dart in the single or treble of the current number, or either bull ring on the bull; a double is a miss |
| **Chain** | V1 | Sum of exercise points of consecutive hits since the last miss; a miss resets it to 0 |
| **Advance on a hit** | V1 | A hit moves the aim to the next target in the sequence |
| **Miss resets the chain and restarts the sequence** | V1 | A miss sets the chain to 0 and the aim back to the first target |
| **Best chain** | V1 | Highest chain value reached in the run, including a chain still live at timer expiry |
| **Best finished chain** | V1 | Highest chain ended by a miss earlier in the run; the mark to beat |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- None.
