---
id: D0067
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Local-first recovery

## Context and Problem Statement
Resolves recovery-vs-batch contradiction with zero schema cost

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Local-first recovery: in-progress state in persisted Alpine stores (`$persist`); one batch at session completion; `clientKey` payload-internal only; no server mid-session recovery or cross-batch reconciliation. **UX (2026-07-14, D88):** auto-abandon on mismatch — no manual abandon prompt", because Resolves recovery-vs-batch contradiction with zero schema cost.

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
Decided: 2026-07-13
