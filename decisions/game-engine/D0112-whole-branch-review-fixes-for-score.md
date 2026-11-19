---
id: D0112
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, visit, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Whole-branch review fixes for Score Training

## Context and Problem Statement
Per-task reviews couldn't see these cross-task integration gaps (timer never instantiated, sequence numbering assumed a fresh engine per page load, no upload retry path); fixed together since finding #2 (sequence) is a precondition for finding #1 (timer/MINUTES mode) actually completing a session

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Whole-branch review fixes for Score Training: `SegmentTimer` wired into `scoreTrainingPlay` for MINUTES mode (`init`/`destroy`); `ScoreTrainingEngine` takes `startingSequence` so a resumed session's visit numbering continues from `store.turns.length` instead of resetting to 1; D88 reconciliation now matches the local session by `sessionId` (not just `gameTypeKey`) before deciding to reset; final batch upload/complete is retryable via a store-persisted `idempotencyKey` and a `retryCompletion()` path, so a failed upload no longer strands the session; results are passed to `/results` via URL query params computed before `store.reset()`".

### Consequences
* Good, because the 2026-07-25 review lists rehydrate-on-resume as something Score Training gets right, and credits `startingSequence` from D112 for it.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-16

* Commit `cd80aa80` (PR #29, 2026-07-21; adds the D112 row): confirmed the row text. It rebuilt no other section.
* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 2 I2, § 6): rebuilt Consequences.
* Partly reversed by D119: the 2026-07-17 flow-redesign spec (Overview, Documentation and rule enforcement) and the plan `docs/superpowers/plans/2026-07-17-score-training-flow-implementation.md` (Task 8) replace results-via-query-params with a play-page modal.
