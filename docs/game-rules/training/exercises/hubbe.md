# Hubbe

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Outshots 101 up to 130, one visit each | V1 | All | |
| Free aim: no intended target recorded | V1 | All | |
| Double-out: last dart a double or the bullseye | V1 | All | |
| Tier points: checkout 5, setup missed 3, setup no dart left 1, no setup 0 | V1 | All | |
| No bust: an overshoot scores its tier | V1 | All | |
| Run ends after 130 | V1 | All | |
| Time-bound run | V1 | All | |
| Points and checkouts readouts | V1 | All | |
| Extended range | V2+ | All | Wanted, unscheduled: 100–140+ is a configuration widening |
| Focused subsets | V2+ | All | Wanted, unscheduled: a player-picked list of outshots is a configuration |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- High-finish practice: 101 to 130, three darts each, with credit for a good
  setup even when the double misses. Pairs with Catch 40 (61–100). Source:
  dolfdarts.com, "Hubbe" (https://dolfdarts.com/games/hubbe, read
  2026-10-06).
- Standard dartboard scoring and double-out. Tier points are **exercise
  points**, not board scores.

## Exercise type

- Type constant: `CHECKOUT_TIERS` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game.
- Close to Catch 40 (`catch-40.md`, proposed `CHECKOUT_SEQUENCE`): both walk
  an ascending outshot sequence. Hubbe differs in three ways: one visit per
  outshot rather than six darts, points for the setup as well as the
  checkout, and no bust. See Open questions.

## Objective

- Earn as many tier points as possible over the 30 outshots.
- The source calls a total above 90 (3 per outshot on average) strong; 150
  is the maximum.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 15 minutes | Routine step configuration |
| First outshot | 101 | Shown, locked |
| Last outshot | 130 | Shown, locked |
| Darts per outshot | 3 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 15-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player plays the range; more points wins (V2+).

### Visit

- Three darts at the current outshot, free aim. Each dart's board score
  comes off the **remaining**.
- **Checkout:** remaining reaches exactly 0 with the last dart in a double
  or the bullseye.

### Progress

- Each outshot is scored by the source's tiers:
  - **5** — checked out within three darts;
  - **3** — "correct setup … attempted the finishing double, but missed it";
  - **1** — a finishable double remains but no dart is left to throw at it;
  - **0** — no valid double finish set up.
- An overshoot or a missed double does not bust; the outshot scores its
  tier.
- Then the next outshot (+1), at full value.

### Bound

- **Run ends after 130.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Extended range** — 100 to 140 or beyond.
- **Focused subsets** — only the player's weak outshots.
- **Head-to-head** — two players, more points wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. No intended target or zone
  — both null, which `chk_dart_target_consistency` allows
  (`database/migrations/0007_constraints.sql:86`). `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per
  outshot.
- **Derived, never stored:** remaining after each dart, checkout, tier,
  points, checkouts, current outshot.
- The result is an exercise-points total, not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Outshots 101 up to 130** | V1 | The ordered sequence of the run |
| **Free aim** | V1 | No intended target recorded for any dart |
| **Double-out** | V1 | Remaining reaches 0 with the last dart in a double or the bullseye |
| **Tier points** | V1 | 5, 3, 1 or 0 per outshot, by how far the finish got |
| **Extended range** | V2+ | Outshots beyond 101–130 |
| **Focused subsets** | V2+ | A player-picked list of outshots |
| **Head-to-head** | V2+ | Two players, more points wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- How are tiers 3 and 1 judged from free-aim facts? Proposed reading: tier 3
  when the remaining after dart 2 is a one-dart finish (an even number up to
  40, or 50) and dart 3 does not check out; tier 1 when only the remaining
  after dart 3 is a one-dart finish. The source does not define "correct
  setup", and free aim records no intent.
- Does a visit that checks out on dart 1 or 2 end early, as in Ten Up One
  Down?
- Merge with Catch 40 into one checkout-sequence type with configurable darts
  per outshot, scoring and bust rule, or keep two types?
