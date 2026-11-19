---
id: D0069
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default

## Context and Problem Statement
Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default `now()`); `ACTIVE` ⇔ `completed_at IS NULL` invariant", because Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow.

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
