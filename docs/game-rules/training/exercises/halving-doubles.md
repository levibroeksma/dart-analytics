# Halving Doubles

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Double list: D20, D18, D16, D14, D12, D10, D8, D6, D4, D2 | V1 | All | |
| Up to three darts per double | V1 | All | |
| Single of the target: Halves the remaining | V1 | All | |
| Finish points: first dart 3, second 2, third 1 | V1 | All | |
| Failed double costs its face value | V1 | All | |
| Run ends after the list | V1 | All | |
| Time-bound run | V1 | All | |
| Points and doubles hit readouts | V1 | All | |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Practice on the ten even doubles that real finishes land on. Start on 40
  (D20); hit the single 20 and you are on 20 (D10) — the natural "split"
  a match finish follows. Source: dolfdarts.com, "Checkouts Practice"
  (https://dolfdarts.com/games/checkouts-practice, read 2026-10-06). Renamed
  here so it is not confused with the Checkouts trivia tool
  (`../trivia/checkouts.md`).
- Standard dartboard scoring. Finish points are **exercise points**.

## Exercise type

- Type constant: `HALVING_DOUBLES` (proposed; not among the seeded types —
  checked against `database/seeds/0014`, `0016`, `0023`–`0025`, `0029`,
  `0030`).
- Wraps no game. Differs from the Doubles Training game
  (`../../rulesets/doubles-training.md`), which works through every double in
  order and does not follow the split.
- Behaviour no existing type provides: the intended target moves within a
  visit when a single halves the remaining.

## Objective

- Finish each listed double in as few darts as possible.
- A good run is a high **points** total; the source names 30 as the maximum.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Double list | D20 → D2, even doubles | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** both play the list; highest points wins (V2+).

### Visit

- One visit of up to three darts per listed double. The **remaining** starts
  at the double's value (D20 → 40).
- Each dart is aimed at the double of remaining ÷ 2.
- Double hit: checked out; the visit ends.
- **Single of the target halves the remaining:** remaining becomes half; the
  next dart aims at that double (40 → S20 → 20, aim D10).
- Anything else: remaining unchanged.

### Progress

- Checked out on dart 1: +3. Dart 2: +2. Dart 3: +1.
- Not checked out in three darts: minus the listed double's face value
  (−40 for D20). The source states this; see Open questions.
- Then the next listed double.

### Bound

- **Time-bound run** inside a routine (`EXERCISE_TEMPLATE.md` §Bound).
- **Run ends after the list** when D2's visit is done.

## Later versions

### Variants

- **Head-to-head** — both play the list; highest points wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode, `ANALYTICS` + `VISUAL_BOARD`
  capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target is the
  current double's number, intended zone `DOUBLE`
  (`database/seeds/0001_reference_data.sql`, `dart_zones`). Hit number and
  zone record where it landed. `score` is the **board** score.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`app/src/modules/game/turn-log.module.ts:118`); one `turns` row per listed
  double.
- **Derived, never stored:** remaining, checked out, finish points, penalty,
  points, doubles hit.
- The result is an exercise-points total, not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Double list** | V1 | D20, D18, … D2 in that order |
| **Halves the remaining** | V1 | A single of the target cuts remaining in half |
| **Finish points** | V1 | 3, 2 or 1 by the dart that checks out |
| **Failed double** | V1 | A listed double not finished in three darts |
| **Points** | V1 | Finish points minus failed-double penalties |
| **Head-to-head** | V2+ | Two players, highest points wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Penalty size: the source subtracts the face value (−40 for D20) but caps the
  maximum at 30 points, so one miss outweighs every possible gain. Confirm
  the penalty, or use a flat −1.
- Odd remaining after halving (D18 → S18 leaves 18 → D9 is fine; D2 → S2
  leaves 2 → D1 is fine; all listed doubles halve cleanly) — no issue for the
  default list, but a configurable list would need a rule for odd halves.
- A single on D1 (remaining 2 → S1 → 1) leaves 1: treat as bust/fail?
