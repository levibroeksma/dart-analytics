---
id: D0121
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Game **play** routes use `GameLayout` (exit chrome + confirm modal, no `BottomNav`)

## Context and Problem Statement
Separates resume-friendly persistence from explicit session close for statistics

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Game **play** routes use `GameLayout` (exit chrome + confirm modal, no `BottomNav`). In-game Leave → `appendBatch` when turns exist, then `PATCH ABANDONED`, then `store.reset()` + `/games`. Browser close/refresh is not abandon — `$persist` + D88 resume.", because Separates resume-friendly persistence from explicit session close for statistics.

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
Decided: 2026-07-21
