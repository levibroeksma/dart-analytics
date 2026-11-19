---
id: D0383
status: accepted
date: 2026-10-01
origin: contemporaneous
original-date:
tags: [database, schema, migration, index, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Seed 0032 backfills closed state onto finished game activities (#380)

## Context and Problem Statement
D382 closes game activities going forward; the history before it still reads ACTIVE, which is wrong under "store what happened" and keeps #358's activities-level unique index uncreatable. A seed, not a migration, carries it: migrations are schema-only and seeds own controlled data (`database/CLAUDE.md`), D363 being the precedent. The seed runs on every deploy, in two passes; the `completed_at IS NULL` guard makes it a no-op once applied.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "seed `0032_close_finished_game_activities.sql` copies a finished session's `status_id` and `completed_at` onto its `activities` row when that row is still open, has no `activity_configurations` snapshot, and its only session has a non-NULL `completed_at`. A session still in progress leaves its activity open.".

### Consequences
the backfill is derived from existing rows and never invents a status or instant. Activities of abandoned sessions become ABANDONED. #358's index is now creatable once production has applied the seed. A game session left ACTIVE forever (never finished) keeps its open activity, correctly.

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
