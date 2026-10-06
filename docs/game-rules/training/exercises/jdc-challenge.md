# JDC Challenge

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Three parts in order: Shanghai 10–15, Doubles 1–20 + Bull, Shanghai 15–20 | V1 | All | |
| Shanghai part: one visit per number, ascending | V1 | All | |
| Shanghai part: only the active number scores, board value | V1 | All | |
| Shanghai bonus: +100 for single, double and treble of the number in one visit | V1 | All | |
| Doubles part: one dart per double, D1 → D20, then bull | V1 | All | |
| Doubles part: 50 per double hit, 100 for the bullseye | V1 | All | |
| Run ends after the last Shanghai visit | V1 | All | |
| Total and per-part readouts | V1 | All | |
| Grade readout: White, Purple, Yellow, Green, Blue, Red, Black | V2+ | All | Wanted, unscheduled: the total is usable alone; the band table differs by source |
| Time-bound run | Deferred | All | Blocked on: the challenge is a fixed sequence whose total only means something when completed; how a routine's duration cuts it is open (see Open questions) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- The Junior Darts Corporation grading routine: two Shanghai rounds and a
  doubles round, one total, compared against coloured grades. Sources:
  dolfdarts.com, "JDC Challenge" (https://dolfdarts.com/games/jdc-challenge)
  and mydartpfeil.com, "JDC Challenge"
  (https://mydartpfeil.com/en/jdc-challenge), both read 2026-10-06. The two
  sources disagree — see Open questions.
- Standard dartboard scoring in the Shanghai parts; the doubles part uses
  **exercise points** (50 / 100).

## Exercise type

- Type constant: `JDC_CHALLENGE` (proposed; not among the seeded types —
  checked against `database/seeds/0014`, `0016`, `0023`–`0025`, `0029`,
  `0030`).
- Wraps no game. The Shanghai game (`../../rulesets/shanghai.md`) runs 1–20
  with a Shanghai as an instant win; here the Shanghai is a +100 bonus and the
  run continues, so wrapping that game would need it to know it is inside an
  exercise — forbidden (`EXERCISE_TEMPLATE.md`, independence rule).
- Behaviour no existing type provides: a run of mixed phases (three-dart
  visits, then one-dart throws, then three-dart visits) with one total.

## Objective

- Score the highest total across the three parts.
- A good run reaches a higher grade band (see Later versions).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 20 minutes | Routine step configuration |
| Parts | Shanghai 10–15, Doubles 1–20 + Bull, Shanghai 15–20 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 20-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

### Visit

- **Shanghai parts:** three darts at the active number. Each dart on that
  number scores its board value (S = n, D = 2n, T = 3n); other darts score 0.
  A single, double and treble of the number in the same visit add **+100**.
- **Doubles part:** one dart at each double. A hit scores 50; the bullseye on
  the last throw scores 100.

### Progress

- Part 1: 10, 11, 12, 13, 14, 15. Part 2: D1 … D20, then bull. Part 3: 15,
  16, 17, 18, 19, 20.
- The target advances after each visit (Shanghai parts) or each dart (doubles
  part), hit or miss.

### Bound

- **Run ends after the last Shanghai visit** (part 3, number 20).
- How a routine's duration applies is deferred — see Features.

## Later versions

### Variants

- **Grade readout** — total mapped to a band. dolfdarts.com: White 0–149,
  Purple 150–299, Yellow 300–449, Green 450–599, Blue 600–699, Red 700–849,
  Black 850+. mydartpfeil.com names only Black at 850+.

### Other

- **Time-bound run** — see Features.
- **Standalone entry** — see Features.

## Capture

- **Capture / input mode:** analytics mode, `ANALYTICS` + `VISUAL_BOARD`
  capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Shanghai parts: intended
  target is the active number, intended zone null (any ring scores).
  Doubles part: intended target the double's number, zone `DOUBLE`; the bull
  throw `25` / `INNER_BULL` (`database/seeds/0001_reference_data.sql`,
  `dart_zones`). `score` is the **board** score — never 50/100 or +100.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`app/src/modules/game/turn-log.module.ts:118`). One `turns` row per
  Shanghai visit and one per doubles throw. Whether the three parts are three
  stages is a spec question.
- **Derived, never stored:** part totals, Shanghai bonus, doubles points,
  total, grade.
- The result is an exercise-points total, not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Shanghai part** | V1 | A part of one visit per number; only the active number scores |
| **Shanghai bonus** | V1 | +100 for a single, double and treble of the active number in one visit |
| **Doubles part** | V1 | One dart per double D1–D20, then one at the bull |
| **Total** | V1 | Sum of the three parts |
| **Grade readout** | V2+ | Total mapped to a colour band |
| **Time-bound run** | Deferred | A routine duration cutting the run |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- **Sources disagree.** dolfdarts.com: three darts per number in the Shanghai
  parts, doubles round once. mydartpfeil.com: "5 shots" per number and the
  doubles sequence repeated five times. The official JDC sheet was not found
  online; this draft follows dolfdarts.com. Needs a human check against the
  JDC's own sheet before V1.
- Does part 3 really repeat 15 (10–15 then 15–20)? Both sources say so.
- Time bound: let the run finish past the routine's duration, or end the step
  at expiry with a partial total?
- Execution model: exercise (this draft) or a game with a seeded `game_types`
  row, as Shanghai and Bob's 27 are?
