---
id: D0090
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, outbox, idempotency]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Completed-but-unsent batches held in a persisted `outbox` store

## Context and Problem Statement
Finished gameplay never lost between completion and server ACK. A completed session whose batch upload fails (offline, `503`) must not be lost between game finished and server confirmed. The handbook calls this the one client-side data loss it actively prevents.

## Decision Drivers
* Finished gameplay must survive a failed upload.
* Retries must be safe: a batch the server already stored returns its stored result on retry.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Completed-but-unsent batches held in a persisted `outbox` store; retried on load/`online` with the session-complete `Idempotency-Key`; removed only on confirmed success", because Finished gameplay never lost between completion and server ACK.

### Consequences
* Neutral, because the handbook backs the `outbox` with localStorage in v1. If queue depth grows, only the `outbox` store moves to IndexedDB.
* Neutral, because the handbook shows a passive unsaved-will-retry indicator while an entry stays queued.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit message says `00-Overview`, the agent guide, the context map and the decisions were updated. No source names a check for the outbox behavior.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* Commit `84403e65` (2026-07-14; no spec; adds the D90 row and the Completed-Batch Outbox section in `03-Alpine-Patterns.md`): rebuilt Context, Drivers and Consequences.
* Amended by the Score Training hard-gate for completion: `docs/superpowers/specs/2026-07-17-score-training-flow-redesign.md` (Hard-gate vs D90).
