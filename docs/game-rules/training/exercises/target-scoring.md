# Target Scoring

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Target list: 20 → 19 → 18 → Bull | V1 | All | |
| Target list accepts any board target (1–20, Bull) | V1 | All | |
| Hit = any ring of the current target | V1 | All | |
| Number points: single 1, double 0, treble 3 | V1 | All | |
| Bull points: outer bull 1, bullseye 3 | V1 | All | |
| Chain resets on a miss | V1 | All | |
| Advance on a broken chain | V1 | All | |
| Miss on an empty chain keeps the target | V1 | All | |
| Target list cycles | V1 | All | |
| Time-bound run | V1 | All | |
| Best chain readout | V1 | All | |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`; Warm-Up is "standalone" only as a one-step system routine (`database/seeds/0015_warm_up_routine.sql`). V1 is routine step only, by the author's choice |
| Number points: double 2 | Dropped | All | Decided against by the author: the aim on a number is the treble, so a double keeps the chain alive but earns nothing. Stops the Singles Training ladder (S=1, D=2, T=3, `../../rulesets/singles-training.md`) being re-proposed here |

## Identity

- Chain-building on one target: every dart that hits the current target adds
  to a running chain; the first miss wipes it. Trains holding a group on one
  segment under pressure of losing what was built. "How high can you get?"
- Standard dartboard layout. Point values are **exercise points**, not X01
  points (`docs/architecture/09-Training/01-Routines.md` §14).

## Exercise type

- Type constant: `TARGET_SCORING` (new; not among the seeded types in
  `database/seeds/0014_exercise_types.sql` or
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`).
- Wraps no game (§12).
- Behaviour no existing type provides: a per-target aim that is not always the
  treble. `SWITCHING` stamps every dart `TREBLE` and so rejects the bull as a
  target (D297, `decisions/game-engine.md`); Target Scoring aims at the treble
  on 1–20 and at the bullseye on the bull. It is therefore its own type, not a
  Switching configuration.

## Objective

- Build the highest **chain** you can on the current target before a miss
  resets it.
- A good run is one with a high **best chain**. What else is shown is derived
  (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Targets | 20, 19, 18, Bull (25) — any of 1–20 and 25, in any order | Routine step configuration |
| Points (number) | Single 1, double 0, treble 3 | Shown, locked |
| Points (bull) | Outer bull 1, bullseye 3 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. Duration preset mirrors the `SWITCHING` example in
`09-Training/01-Routines.md` §3.5.

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- Visits are three darts. Every dart is thrown at the **current target**,
  which may change mid-visit (see Progress).
- A dart **hits** when it lands in any ring of the current target:
  - number target: inner single, outer single, double or treble of that
    number;
  - Bull: outer bull or bullseye.
- Anything else is a **miss**: another number, the bull when aiming at a
  number, a number when aiming at the bull, or off the board.

### Progress

- Points per hit, added to the **chain**:
  - number: single **1**, double **0**, treble **3**;
  - Bull: outer bull **1**, bullseye **3**.
- A double on a number keeps the chain alive but adds nothing.
- A miss resets the chain to 0.
- **Advance on a broken chain:** a miss that ends a chain holding at least one
  hit moves the current target to the next in the list.
- **Miss on an empty chain keeps the target:** a miss while the chain holds no
  hit leaves the target unchanged.
- Since the target only changes on a break, a chain always belongs to exactly
  one target.
- **Target list cycles:** after the last target the list starts again from the
  first (20 → 19 → 18 → Bull → 20 → …).

### Bound

- **Time-bound run:** the run lasts the step's duration (default 10 minutes).
  Every exercise used in a routine is time-bound in that routine (§3.3, §5).
  The list cycling means the targets never run out before the timer.

## Later versions

### Variants

- None scheduled.

### Other

- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — the pair every dart-input
  exercise step uses today (§17 Switching, D277).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  current target's number (`1`–`20` or `25`); intended zone = `TREBLE` on a
  number, `INNER_BULL` on the bull — both keys exist in `DartZoneKey`
  (`app/src/modules/game/types.ts:322`), and a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (T20 = 60, bullseye = 50), never exercise points.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts:118`),
  as Switching opens. One `turns` row per three-dart visit; each dart carries
  its own intended target, so a target change mid-visit is expressed per dart.
- **Derived, never stored:** exercise points per dart, current chain, current
  target, target position in the cycle, best chain (overall and per target),
  chain count, hit rate. All are folds over the ordered dart facts and the
  configuration; the target at any dart is itself derived by replaying the
  chain rules.
- This exercise produces an exercise score (the chain), not a conventional
  game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target list** | V1 | The ordered targets a run steps through; any of 1–20 and Bull |
| **Hit** | V1 | A dart in any ring of the current target |
| **Chain** | V1 | Sum of exercise points of consecutive hits since the last miss; a miss resets it to 0 |
| **Advance on a broken chain** | V1 | A miss ending a chain with ≥1 hit moves to the next target |
| **Target list cycles** | V1 | After the last target the list restarts at the first |
| **Best chain** | V1 | Highest chain value reached in the run |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Timer expires mid-chain: does the live chain count toward **best chain**?
  Proposed: yes — it was reached.
- Is **best chain** per target shown during play, or only overall?
- Duplicate targets in a configured list (e.g. 20, 20, 19): allowed, or
  rejected by validation?
