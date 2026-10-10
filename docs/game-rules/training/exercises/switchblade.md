# SwitchBlade

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Five rounds, one visit each, a fixed target per dart | V1 | All | |
| A dart scores only on its own number, any bed | V1 | All | |
| Points are board scores | V1 | All | |
| Run ends after round five | V1 | All | |
| Time-bound run | V1 | All | |
| Total and per-round readouts | V1 | All | |
| Custom target paths | V2+ | All | Wanted, unscheduled: a configuration widening; the standard path is usable alone |
| Extended rounds | V2+ | All | Wanted, unscheduled: more than five rounds is a configuration widening |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- A short daily switching drill: two darts at T20, then the third at a
  different target each round. Trains the reset between switches. Source:
  dolfdarts.com, "SwitchBlade" (https://dolfdarts.com/games/switchblade,
  read 2026-10-06): about 8 minutes, 15 darts.
- Standard dartboard scoring: a dart on its own number scores its board
  value; a dart on any other number scores 0.

## Exercise type

- Type constant: `PATH_SCORING` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game.
- Behaviour no existing type provides: a target **per dart slot** that
  changes mid-visit, scored at board value. `SWITCHING` holds one target per
  visit and scores by bed, not board value (§17 Switching). 170 Practice
  (`170-practice.md`) also aims per dart slot but judges a whole-visit
  checkout; see Open questions.

## Objective

- Score as many board points as possible on the path.
- A good run is a high **total**.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 8 minutes | Routine step configuration |
| Path | Round 1 T20 T20 T20 · 2 T20 T20 T19 · 3 T20 T20 T18 · 4 T20 T20 T17 · 5 T20 T20 bullseye | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 8-minute preset is the source's own estimate.

## How to practise

**Single:** one player per run.

**1v1:** each player throws the path; higher total wins, a tie replays round
five (V2+).

### Visit

- Round *n* is one visit; each dart aims at its slot in the path.
- A dart landing on its slot's **number** scores that dart's board value —
  single, double or treble alike. The bull slot scores outer bull 25,
  bullseye 50. A dart on any other number scores 0.

### Progress

- After each visit, the next round's path applies.

### Bound

- **Run ends after round five.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Custom target paths** — the player sets each round's three slots.
- **Extended rounds** — more than five rounds.
- **Head-to-head** — two players throw the path; higher total wins, a tie
  replays round five.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  slot's number (`17`–`20`, or `25`); intended zone = `TREBLE`, or
  `INNER_BULL` on the bull slot — keys in `DartZoneKey`
  (`app/src/modules/game/types.ts:386`); a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per round.
  Each dart carries its own intended target.
- **Derived, never stored:** points per dart (board score when the hit number
  matches the slot, else 0), round totals, total.
- The total is a fold over board scores filtered by slot, not a conventional
  game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Five rounds** | V1 | The run: one visit per round, 15 darts |
| **Custom target paths** | V2+ | Player-set slots per round |
| **Extended rounds** | V2+ | More than five rounds |
| **Head-to-head** | V2+ | Two players, higher total wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- The source states a maximum of 882. The path's per-dart maxima sum to 872
  (180 + 177 + 174 + 171 + 170). Which is right?
- Share one per-dart-slot type with 170 Practice (`170-practice.md`), with
  "hit rule" and "points" as configuration, or keep two types?
- Inside a routine, does a run that ends before time start the path again?
