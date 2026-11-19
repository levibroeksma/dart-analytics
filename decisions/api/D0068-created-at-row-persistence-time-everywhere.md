---
id: D0068
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, batch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `created_at` = row persistence time everywhere

## Context and Problem Statement
Batch upload makes client `completedAt` predate insert

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`created_at` = row persistence time everywhere; chronology from sequence numbers + client timestamps; migration `0015` drops `chk_turn_completed_after_created`", because Batch upload makes client `completedAt` predate insert.

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
