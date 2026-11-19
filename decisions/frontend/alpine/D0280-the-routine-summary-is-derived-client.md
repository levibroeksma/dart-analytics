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

# The routine summary is derived client-side from in-memory engine state, and a failed Finishing upload no longer advances the routine

## Context and Problem Statement
the routine discarded every number the player produced the moment it ended, and the one screen able to show them — TUOD's own results modal — is hidden inside a routine. A client-side derivation was chosen over a read model because every figure is already in memory at capture time and no other surface reads them today; a persisted training history remains a separate future feature. The Finishing gate is a real data-loss defect, not a refactor: `playUploadAndCompleteSession` reports an upload failure by setting `completionStatus = "failed"` and returning rather than throwing, so the unconditional advance completed the routine with those darts unsaved and no retry on screen.

## Decision Drivers
* The routine discards every number the player produced when it ends, and TUOD's own results modal is hidden inside a routine (spec § 1(a)).
* A failed Finishing upload still advances the routine, completes the activity and redirects, with the darts never persisted and no retry on screen (spec § 1(b)).
* Every figure is already in memory when a step completes, and no other surface reads them today.

## Considered Options
* Derive the summary client-side from in-memory engine state (chosen).
* A server-side read model for training history, which the spec scopes out as a separate future feature.
* Reuse `ResultsModalShell` for the routine summary (deliberately not reused, spec § 7).

## Decision Outcome
Chosen option: "`advanceAfterStepCompletion` captures one `RoutineStepSummary` per completed non-Warm-Up step (`modules/training/routines/routine-summary.module.ts`: `summariseSwitching`, `summariseDoublePattern`, `summariseFinishing`) while that step's engine is still in memory, and the routine's last step now ends on `RoutineSummaryModal.astro` instead of redirecting to `/training`. `completeTraining` moves into its own `completeRoutine()` with a `completionStatus`/`completionError` pair, so a failed call leaves the player on their results with a retry; `Done` (`dismissSummary()`) is the only navigation and the only `$store.trainingSession.reset()`. The store gains `markComplete()`, which freezes the clock and relabels the header `"32:14 - complete"`. `finishing-step.data.ts` now calls `onStepComplete()` only when the wrapped upload left `completionStatus === "succeeded"`.".

### Consequences
`ResultsModalShell` is not reused — its button row is bound to a per-game `back()`/`playAgain()` pair and a per-game `finished` flag — so the routine's modal is its own component; the two share an idiom, not code. The modal must stay in the page's own `x-data`, outside the nested `x-data="finishing"`, because both scopes define `completionStatus`. `StatRow.astro` cannot render the rows (it takes its label as a build-time prop, and these rows exist only at runtime), so the modal emits the same `dl` shape inside its `x-for`. Two existing end-of-routine cases in `balanced-training-play.data.test.ts` were repointed from the redirect to the modal — same guarantee, new ending — and the Finishing step gained its first test file. Full design and implementation plan: `docs/superpowers/specs/2026-09-14-routine-summary-design.md`, `docs/superpowers/plans/2026-09-14-routine-summary.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § 8 proposed the tests: each builder's rows and values including the zero-dart fallback, `onStepComplete` not called when the wrapped upload leaves `completionStatus === "failed"` and called when it succeeds, and additions to the Balanced Training play-data test. Only `app/tests/modules/training/routines/routine-summary.module.test.ts` exists today.

## Pros and Cons of the Options
### Client-side derivation from in-memory state
* Good, because every figure is already in memory at capture time, so no read model is needed.
* Bad, because nothing persists the summary: a re-openable routine history stays a separate future feature.

### Server-side read model
* Bad, because the spec scopes it out and no other surface reads these figures today.

### Reuse `ResultsModalShell`
* Bad, because wrapping it means parameterising its per-game buttons, flag and completion call for one extra caller (spec § 7).

## Evidence / More Information
Decided: 2026-09-14

* `docs/superpowers/specs/2026-09-14-routine-summary-design.md` (§ 1 Problem, § 2 Scope, § 3 Approach, § 6 Finishing upload gate, § 7 Components, § 8 Tests): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-14-routine-summary.md` (Task 6, the D280 text): source of the Decision Outcome text.
* Commit `8d291bba` (2026-09-14, adds the D280 row): source of the Context and Consequences text.
