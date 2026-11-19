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
<!-- backfill: pending -->

# Whole-branch review fixes for Score Training

## Context and Problem Statement
Per-task reviews couldn't see these cross-task integration gaps (timer never instantiated, sequence numbering assumed a fresh engine per page load, no upload retry path); fixed together since finding #2 (sequence) is a precondition for finding #1 (timer/MINUTES mode) actually completing a session

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Whole-branch review fixes for Score Training: `SegmentTimer` wired into `scoreTrainingPlay` for MINUTES mode (`init`/`destroy`); `ScoreTrainingEngine` takes `startingSequence` so a resumed session's visit numbering continues from `store.turns.length` instead of resetting to 1; D88 reconciliation now matches the local session by `sessionId` (not just `gameTypeKey`) before deciding to reset; final batch upload/complete is retryable via a store-persisted `idempotencyKey` and a `retryCompletion()` path, so a failed upload no longer strands the session; results are passed to `/results` via URL query params computed before `store.reset()`".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-16
