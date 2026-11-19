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

# A standalone game's activity closes with its session (#380)

## Context and Problem Statement
issue #380. `04-Runtime-Layer.md` already gives an activity the lifecycle ACTIVE -> COMPLETED/ABANDONED with `completed_at` on terminal transitions, but the game path never wrote it, so every game left a permanent ACTIVE activity: wrong history under "store what happened", and a block on #358's activities-level unique index. A game activity holds exactly one session; a training activity holds one per routine step, so the snapshot row is the existing discriminator and no new column is needed.

## Decision Drivers
* `04-Runtime-Layer.md` already gives an activity the lifecycle ACTIVE to COMPLETED/ABANDONED with `completed_at`, but the game path never wrote it.
* A permanent ACTIVE activity is wrong history under "store what happened".
* It blocks #358's activities-level unique index.

## Considered Options
* Leave the game path as it is, so every game keeps an ACTIVE activity.
* Close the activity in the same transaction as the session, using the snapshot row to tell games from training (chosen).

## Decision Outcome
Chosen option: "`updateSessionStatus` calls `finishSessionRecords`, one transaction that writes the session's terminal status and `completed_at`, then sets the same status and instant on its `activities` row when that row has no `activity_configurations` snapshot and is still open. Training activities close only through `completeTraining`/`abandonTraining`.".

### Consequences
games finished from now on close their activity. Existing game activities stay open: no backfill is made here, and #358's index stays blocked until one is (new migration or seed, its own task). An abandoned session abandons its activity.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0032_close_finished_game_activities_checks.sql` and `app/tests/repositories/session.repository.batch.test.ts` ship with the commit.

## Pros and Cons of the Options
### Leave the game path as it is
* Bad, because every game leaves a permanent ACTIVE activity and #358's index stays blocked.

### Close the activity with its session
* Good, because the existing snapshot row discriminates game from training activities (a game activity holds one session, a training activity one per routine step), so no new column is needed.
* Bad, because existing game activities stay open until a backfill runs; the decision leaves that to its own task.

## Evidence / More Information
Decided: 2026-10-01

* Commit `39a7976f` (2026-10-01, issue #380, PR #688; `session.repository.ts`, seed `0032`, `04-Runtime-Layer.md`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
