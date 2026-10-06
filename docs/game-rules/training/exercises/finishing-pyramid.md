# Finishing Pyramid

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Pyramid levels 60 → 170 in steps of 10 | V1 | All | |
| Free aim: no intended target recorded | V1 | All | |
| One visit per attempt | V1 | All | |
| Double-out: last dart a double or the bullseye | V1 | All | |
| Bust fails the attempt | V1 | All | |
| Stay on the level until checked out | V1 | All | |
| Run ends at the Summit (170) | V1 | All | |
| Time-bound run | V1 | All | |
| Highest level, attempts and darts used readouts | V1 | All | |
| Finish points: 2 darts 2, 3 darts 1 | V2+ | All | Wanted, unscheduled: the source calls it optional; the run is usable on highest level alone |
| Per-level success rate readout | V2+ | All | Wanted, unscheduled: a derived readout, not needed to play |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Climbing checkout practice: check out 60 in one visit, then 70, then 80, up
  to 170. Fail and you retry the same level. Source: dolfdarts.com,
  "Finishing Pyramid" (https://dolfdarts.com/games/finishing-pyramid, read
  2026-10-06).
- Standard dartboard scoring and X01 double-out.

## Exercise type

- Type constant: `CHECKOUT_PYRAMID` (proposed; not among the seeded types
  listed in `catch-40.md` §Exercise type — checked against
  `database/seeds/0014`, `0016`, `0023`–`0025`, `0029`, `0030`).
- Wraps no game.
- Behaviour no existing type provides: a start score that rises only on a
  checkout, with X01 bust and double-out.

## Objective

- Reach the highest level you can; finishing 170 completes the pyramid.
- A good run is a high **highest level** reached in few attempts.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| First level | 60 | Shown, locked |
| Step | 10 | Shown, locked |
| Last level | 170 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

### Visit

- One **attempt** is one visit of three darts, free aim, from the level's full
  value.
- **Double-out:** checked out when remaining reaches exactly 0 and the last
  dart hit a double or the bullseye.
- **Bust:** remaining below 0, exactly 1, or 0 without a double-out. Later
  darts in the visit are void and the attempt fails.
- An attempt that ends with remaining above 0 fails.

### Progress

- A checkout moves to the next level (+10). A failed attempt keeps the level.
- No limit on attempts per level.

### Bound

- **Time-bound run** inside a routine (`EXERCISE_TEMPLATE.md` §Bound).
- **Run ends at the summit** when 170 is checked out.

## Later versions

### Variants

- **Finish points** — 2 points for a two-dart checkout, 1 for three darts.

### Other

- **Per-level success rate readout** — checkouts ÷ attempts per level.
- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode, `ANALYTICS` + `VISUAL_BOARD`
  capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw, void darts included; intended
  target and zone null (`database/migrations/0007_constraints.sql:86`);
  `score` is the **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`app/src/modules/game/turn-log.module.ts:118`); one `turns` row per
  attempt.
- **Derived, never stored:** current level, remaining, bust, checked out,
  highest level, attempts, darts used.
- No conventional score: the result is the highest level reached.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Pyramid levels** | V1 | Start scores 60, 70, … 170 |
| **Free aim** | V1 | No intended target recorded for any dart |
| **One visit per attempt** | V1 | An attempt is exactly one three-dart visit |
| **Double-out** | V1 | Remaining reaches 0 with the last dart in a double or the bullseye |
| **Bust** | V1 | Remaining below 0, exactly 1, or 0 without a double-out |
| **Summit** | V1 | Level 170 |
| **Highest level** | V1 | Highest level checked out in the run |
| **Finish points** | V2+ | 2 for a two-dart checkout, 1 for three |
| **Per-level success rate** | V2+ | Checkouts ÷ attempts on one level |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- 160 and above need T20-T20-Bull class finishes; 159, 162, 163, 165, 166, 168,
  169 are not finishable but are not levels here. Should a fail-streak drop
  the player a level (step-back), or is "stay" the only rule?
- Does a later run resume at the last level reached, or always start at 60?
- Keep separate from Catch 40 (`catch-40.md`) or merge into one checkout type?
