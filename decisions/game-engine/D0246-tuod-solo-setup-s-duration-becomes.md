---
id: D0246
status: accepted
date: 2026-08-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# TUOD solo setup's duration becomes player-typed within bounds, matching Score Training and TUOD's own 1v1 path

## Context and Problem Statement
TUOD's V1 setup design (`2026-08-20-tuod-frontend-design.md`) deliberately withheld solo-value editability as a scope cut, while already carrying the same `duration_type`/`duration_value` shape, engine completion branches, and MINUTES countdown timer Score Training uses. Score Training's own 07-31 configurable-duration change (D-series entry in `decisions/frontend/alpine.md`) established the pattern — mode radios select type only, a typed field sets the value, clamp-then-start, template+overrides session create. This decision brings TUOD's solo path to that same parity; 1v1 was already there. Full design and implementation plan: `docs/superpowers/specs/2026-08-29-tuod-round-time-config-design.md`, `docs/superpowers/plans/2026-08-29-tuod-round-time-config.md`.

## Decision Drivers
* TUOD's V1 setup withheld editability on purpose: solo play picked between 2 fixed presets, and the value was not editable (spec, Overview).
* TUOD already carries the same `duration_type` and `duration_value` shape, engine completion branches and MINUTES countdown timer as Score Training (spec, Overview).
* `TuodConfig` has only `.min(1)` on `duration_value`: no ceiling and no bound that depends on the duration type (spec, Schema & validation).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`TuodConfig.duration_value` gains a whole-object `superRefine` bounding it by `duration_type` — ROUNDS 1..100, MINUTES 3..30 — identical to `ScoreTrainingConfig`'s own bound. `tuod-duration.ts`'s ROUNDS-only helpers (`tuodRoundsBounds`/`clampTuodRounds`/`tuodRoundsClampNotice`) are generalized to type-aware ones (`tuodDurationBounds`/`clampTuodDuration`/`tuodDurationClampNotice`) taking a `TuodDurationType`. `tuod-setup.data.ts` gains a `selectMode(type)` method wired via `$watch("durationType", ...)`, and `start()` now unconditionally clamps and overrides `duration_value` for both solo and 1v1 sessions — previously this only happened once a guest was present, and solo play was locked to two fixed preset values ("10 Rounds" / "10 Minutes") with no free-typed field. `TuodSetupForm.astro`'s solo branch gains the same `Input` + clamp-notice block the guest branch (and Score Training's solo branch) already had.".

### Consequences
`tuod-play.data.ts`'s `playAgain()` now sends `overrides: { duration_value: config.durationValue }` instead of no overrides at all — without this fix, replaying a custom-duration TUOD session would have silently reset to the preset's default value, the same bug Score Training's own `playAgain()` had already fixed once. No engine, migration, or seed change: `TuodEngine` already fully implemented ROUNDS/MINUTES completion, and the two seeded presets (10 rounds / 10 minutes) keep their values, only their role changes from locked choice to typed default. `refinement-contract.ts` gains a `tuodContract` entry (required by `scripts/check-refinement-coverage.sh`); its MINUTES floor (3) is the first genuinely load-bearing floor probe in that contract, same asymmetry `scoreTrainingContract`'s own blind-spot note documents for its ROUNDS floor.

* Neutral, because the spec leaves 1v1 behavior (`forceRoundsIfGuested` and the guest-branch UI), Score Training and the seed preset values unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Testing section names these standing tests: `app/tests/lib/game/tuod-duration.test.ts`, `app/tests/lib/game/tuod-setup.data.test.ts`, `app/tests/lib/game/tuod-play.data.test.ts` and `app/tests/lib/game/rulesets/types.test.ts`. `scripts/check-refinement-coverage.sh` requires the `tuodContract` entry for the new `superRefine`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-29

* `docs/superpowers/specs/2026-08-29-tuod-round-time-config-design.md` (Overview, Out of scope, Schema & validation, Testing): rebuilt Decision Drivers, Consequences and Confirmation.
* Commit `b58ac2dc` (PR #198, 2026-08-29; adds the D246 row, the spec and the plan): no section rebuilt.
