---
id: D0382
status: accepted
date: 2026-10-01
origin: contemporaneous
original-date:
tags: [database, migration, column, index, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A standalone game's activity closes with its session (#380)

## Context and Problem Statement
issue #380. `04-Runtime-Layer.md` already gives an activity the lifecycle ACTIVE -> COMPLETED/ABANDONED with `completed_at` on terminal transitions, but the game path never wrote it, so every game left a permanent ACTIVE activity: wrong history under "store what happened", and a block on #358's activities-level unique index. A game activity holds exactly one session; a training activity holds one per routine step, so the snapshot row is the existing discriminator and no new column is needed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`updateSessionStatus` calls `finishSessionRecords`, one transaction that writes the session's terminal status and `completed_at`, then sets the same status and instant on its `activities` row when that row has no `activity_configurations` snapshot and is still open. Training activities close only through `completeTraining`/`abandonTraining`.".

### Consequences
games finished from now on close their activity. Existing game activities stay open: no backfill is made here, and #358's index stays blocked until one is (new migration or seed, its own task). An abandoned session abandons its activity.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-01
