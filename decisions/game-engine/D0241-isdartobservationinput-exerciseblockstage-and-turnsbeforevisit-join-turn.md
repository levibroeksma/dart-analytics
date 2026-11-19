---
id: D0241
status: accepted
date: 2026-08-28
origin: contemporaneous
original-date:
tags: [game-engine, engine, 501, Score Training, visit, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `isDartObservationInput`, `exerciseBlockStage()`, and `turnsBeforeVisit` join `turn-log.module.ts`'s shared exports, closing F39-F41

## Context and Problem Statement
Closes F39, F40, and F41, logged during D240's own audit and deliberately deferred there to keep that task's scope to its two largest duplication pockets. Full design: `docs/superpowers/specs/2026-08-28-engine-findings-cleanup-design.md`.

## Decision Drivers
* F39, F40 and F41 were logged during D240's audit and deferred to keep that task to its 2 largest duplication pockets (spec, Purpose).
* 501, 121 and TUOD each declared an identical private `isDartObservation` guard (spec, F39).
* 121's `seatBeforeVisit` and TUOD's `targetBeforeVisit` both located the visit and sliced the log before refolding. The spec calls that slice step real duplication (spec, F41).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`app/src/modules/game/turn-log.module.ts` gains three exports. `isDartObservationInput<T>(input: T | DartObservation): input is DartObservation` replaces the byte-identical `isDartObservation` type guard 501, 121, and TUOD each declared privately (Score Training's own guard, `typeof input !== "number"`, is a genuinely different check on a different input shape and stays local). `exerciseBlockStage(): StageFact` replaces the byte-identical `const STAGE: StageFact = {...}` literal Around the Clock, Bob's 27, Doubles Training, Score Training, Shanghai, and Singles Training each declared; each of the 6 files keeps its own module-level `const STAGE = exerciseBlockStage();`, so every existing `{ ...STAGE }`/`STAGE.clientKey` call site is untouched. `turnsBeforeVisit(turns, visit): TurnFact[]` extracts the `const index = turns.indexOf(visit); turns.slice(0, index)` step 121's `seatBeforeVisit` and TUOD's `targetBeforeVisit` both performed identically before each fed the slice into its own engine-specific `foldXxxState`.".

### Consequences
501's `remainingBeforeVisit` is deliberately NOT folded into `turnsBeforeVisit` — it computes a running total via `.filter().reduce()` over `totalScore` and never folds a full seat/engine state, a genuinely different technique from 121/TUOD's slice-and-refold, not a 3rd copy of the same one; `04-Architecture-patterns.md` Pattern 18 now documents the two-technique split as intentional so a future implementer has a rule to follow instead of picking whichever pattern they read most recently. Each of the 6 `STAGE`-builder call sites lost its now-unused `StageFact` type import (the literal's own type annotation was the only use). No behavior change anywhere: every existing engine test suite passed unmodified, and each rewire also added a small regression test locking in the pre-rewire behavior. F42 (why `fallow` didn't flag the pre-fix duplication) remains open — an investigation task, not a code change, out of this task's scope.

* Neutral, because the spec leaves `legStage` and `roundStage` unchanged: they are per-sequence and not duplicated across files.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/turn-log.module.test.ts` tests all 3 exports. The spec adds one regression assertion per touched engine, because D224 requires a covering test edit for each changed runtime file; the existing engine suites run the rewired call sites.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-28

* `docs/superpowers/specs/2026-08-28-engine-findings-cleanup-design.md` (Purpose, F39, F41, Files, Non-goals, Testing): rebuilt Decision Drivers, Consequences and Confirmation.
* Commit `ee6f92a1` (2026-08-28; adds the D241 row): no section rebuilt.
* Applied in: `docs/superpowers/plans/2026-09-01-dartbot-6-play-loop.md`.
