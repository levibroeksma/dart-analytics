---
id: D0280
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, state, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The routine summary is derived client-side from in-memory engine state, and a failed Finishing upload no longer advances the routine

## Context and Problem Statement
the routine discarded every number the player produced the moment it ended, and the one screen able to show them — TUOD's own results modal — is hidden inside a routine. A client-side derivation was chosen over a read model because every figure is already in memory at capture time and no other surface reads them today; a persisted training history remains a separate future feature. The Finishing gate is a real data-loss defect, not a refactor: `playUploadAndCompleteSession` reports an upload failure by setting `completionStatus = "failed"` and returning rather than throwing, so the unconditional advance completed the routine with those darts unsaved and no retry on screen.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`advanceAfterStepCompletion` captures one `RoutineStepSummary` per completed non-Warm-Up step (`modules/training/routines/routine-summary.module.ts`: `summariseSwitching`, `summariseDoublePattern`, `summariseFinishing`) while that step's engine is still in memory, and the routine's last step now ends on `RoutineSummaryModal.astro` instead of redirecting to `/training`. `completeTraining` moves into its own `completeRoutine()` with a `completionStatus`/`completionError` pair, so a failed call leaves the player on their results with a retry; `Done` (`dismissSummary()`) is the only navigation and the only `$store.trainingSession.reset()`. The store gains `markComplete()`, which freezes the clock and relabels the header `"32:14 - complete"`. `finishing-step.data.ts` now calls `onStepComplete()` only when the wrapped upload left `completionStatus === "succeeded"`.".

### Consequences
`ResultsModalShell` is not reused — its button row is bound to a per-game `back()`/`playAgain()` pair and a per-game `finished` flag — so the routine's modal is its own component; the two share an idiom, not code. The modal must stay in the page's own `x-data`, outside the nested `x-data="finishing"`, because both scopes define `completionStatus`. `StatRow.astro` cannot render the rows (it takes its label as a build-time prop, and these rows exist only at runtime), so the modal emits the same `dl` shape inside its `x-for`. Two existing end-of-routine cases in `balanced-training-play.data.test.ts` were repointed from the redirect to the modal — same guarantee, new ending — and the Finishing step gained its first test file. Full design and implementation plan: `docs/superpowers/specs/2026-09-14-routine-summary-design.md`, `docs/superpowers/plans/2026-09-14-routine-summary.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-14
