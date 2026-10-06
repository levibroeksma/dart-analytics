# Frustration

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Target doubles D1 up to D20, then bullseye | V1 | All | |
| Setup: darts 1 and 2 total 80 or more | V1 | All | |
| Finish dart: dart 3 at the current double, thrown only after a setup | V1 | All | |
| Advance only when setup and finish dart both succeed | V1 | All | |
| Run ends on the last target | V1 | All | |
| Time-bound run | V1 | All | |
| Attempts and targets cleared readouts | V1 | All | |
| Short version | V2+ | All | Wanted, unscheduled: D20 down to D10 is a configuration of the target list |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Score, then finish: two darts for 80 or more, then the third at the
  double. Both must come off in the same visit to move on. Trains the
  switch from scoring to finishing. Source: dolfdarts.com, "Frustration"
  (https://dolfdarts.com/games/frustration, read 2026-10-06), attributed to
  Justin Pipe. Alex Roy's "Twenties Challenge" is the same drill on
  D1–D20 (https://www.shotdarts.com/blog/practise-game-2).
- Standard dartboard scoring for the setup total. No points: the result is
  attempts.

## Exercise type

- Type constant: `SETUP_FINISH` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)).
- Wraps no game.
- Close to Bullseye Checkouts, which also judges darts 1–2 by their total and
  dart 3 by where it lands (`bullseye-checkout.md` §Exercise type). The
  differences: a setup **threshold** (≥ 80) rather than an exact leave, a
  moving double rather than a fixed bullseye, and a dart 3 that is not thrown
  when the setup fails. See Open questions.

## Objective

- Clear every target in as few attempts as possible.
- A perfect run is 21 attempts; the source expects many more.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 20 minutes | Routine step configuration |
| Targets | D1 → D20 → bullseye | Shown, locked |
| Setup threshold | 80 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 20-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player plays the circuit; fewer attempts wins (V2+).

### Visit

- One visit is one **attempt**.
- **Setup:** darts 1 and 2, free aim, must total 80 or more on the board.
- **Finish dart:** only after a setup, dart 3 at the current double (the
  bullseye on the last target).
- A failed setup ends the visit after two darts.

### Progress

- Setup and finish dart both succeed: the next target.
- Otherwise: the same target next visit.

### Bound

- **Run ends on the last target** once it is cleared.
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Short version** — D20 down to D10.
- **Head-to-head** — two players, fewer attempts wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Darts 1 and 2: no intended
  target or zone — both null, as Bullseye Checkouts records its setup darts
  (`bullseye-checkout.md` §Capture). Dart 3: the number and `DOUBLE`, or 25
  and `INNER_BULL`, as `doubleTargetIntent` records
  (`app/src/modules/game/turn-log.module.ts:103`). `score` is the dart's
  **board** score (`appendObservedDart`, same file:134).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per
  attempt, holding two darts when the setup failed.
- **Derived, never stored:** setup total, setup made, finish dart hit,
  current target, attempts, targets cleared, setup rate, finish rate.
- The exercise produces an attempts count, not a conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Setup** | V1 | Darts 1 and 2 totalling 80 or more |
| **Finish dart** | V1 | Dart 3, at the current double, after a setup |
| **Short version** | V2+ | Targets D20 down to D10 |
| **Head-to-head** | V2+ | Two players, fewer attempts wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- Last target: does the outer bull count, or only the bullseye? The source
  says "the bullseye".
- Is a two-dart turn (failed setup) acceptable to the turn model, or is
  dart 3 thrown and ignored?
- Generalise Bullseye Checkouts into one setup-then-finish type (exact leave
  or threshold; fixed or moving finish target), or keep two types?
