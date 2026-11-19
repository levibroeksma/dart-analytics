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
<!-- backfill: pending -->

# Completed-but-unsent batches held in a persisted `outbox` store

## Context and Problem Statement
Finished gameplay never lost between completion and server ACK

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Completed-but-unsent batches held in a persisted `outbox` store; retried on load/`online` with the session-complete `Idempotency-Key`; removed only on confirmed success", because Finished gameplay never lost between completion and server ACK.

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
Decided: 2026-07-14
