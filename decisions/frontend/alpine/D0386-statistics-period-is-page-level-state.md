---
id: D0386
status: accepted
date: 2026-10-02
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

# Statistics period is page-level state, shared by every section

## Context and Problem Statement
the period applies to every card on the page, so per-section pickers would drift apart and repeat the control; the page scope is already the shared parent.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/statistics` owns one `rangeKey` in its page `x-data` scope, picked by a "Period" `Select` beside the game `Select` (two half-width columns). Section factories do not own a range: they read the inherited `rangeKey` (`this.$data.rangeKey`) and reload on `$watch("rangeKey")`.", because the period applies to every card on the page, so per-section pickers would drift apart and repeat the control; the page scope is already the shared parent.

### Consequences
a new section reads the same `rangeKey` and needs no picker. The period persists across game switches. The score-trend section loses its own picker; its previous-period delta logic is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (refines D385).
