---
id: D0448
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/astro, component]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Remove the dead `routineStats.stepGame` view

## Context and Problem Statement
Its only consumer was the generic `GameSectionCards`, deleted in D446. Nothing else read it; two tests pinned behaviour no component used (#921).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`routine-stats.store.ts` no longer holds `stepGame` (a `gameStatsStore()` fed from `stepSections`) or its three writes in `resetStep`/`selectStep`. `stepSections` and `stepGameType()` stay.", because Its only consumer was the generic `GameSectionCards`, deleted in D446. Nothing else read it; two tests pinned behaviour no component used (#921).

### Consequences
A GAME step in the Routines tab reads `stepSections` directly. A future cards component builds on the dedicated section factories (D385).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-11
Supersedes: none (completes the cleanup D446 deferred).
