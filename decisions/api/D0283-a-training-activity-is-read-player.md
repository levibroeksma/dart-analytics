---
id: D0283
status: accepted
date: 2026-09-16
origin: contemporaneous
original-date:
tags: [api, middleware, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A training activity is read player-scoped, and its terminal transition is guarded inside the UPDATE

## Context and Problem Statement
issues #336 and #335. The step-start path filtered only on `activity_id`, so any authenticated player could read another player's configuration snapshot and insert sessions into their activity — against `06-API/02-Middleware-And-Layering.md` Rules #5, "all protected queries must be player-scoped". The transition path rewrote `status_id` and `completed_at` with no status check at all, so `complete` followed by `abandon` destroyed a completed routine's original `completed_at` — against root `CLAUDE.md`'s first hard invariant. `session.service.ts`'s `updateSessionStatus` already guarded the same way for game sessions (read, compare to `ACTIVE`, return `SESSION_ALREADY_COMPLETED`); the training path is the copy that lost the check. The guard is put in the UPDATE predicate rather than copied as a read-then-write because two concurrent transitions on one activity would both pass a prior read and the second would still overwrite the first's timestamp.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`findActivityConfiguration` (`training-session.repository.ts`) takes `playerId` and inner-joins `activities`, so an activity the caller does not own reads as `undefined`; `startTrainingStep` maps that to `SESSION_OWNERSHIP_MISMATCH` (403) before any `exercise_sessions` row is written, making an unknown and a foreign `activityId` deliberately indistinguishable to the caller. `updateActivityStatusRecord` takes `expectedStatusId` and carries `activities.status_id = <ACTIVE>` in its own WHERE, so the "still active" check *is* the UPDATE rather than a read preceding it; `transitionTrainingActivity` resolves the `ACTIVE` id alongside the target status, and on a zero-row update re-reads the activity player-scoped (new `findActivityStatus`) only to classify the failure — `NOT_FOUND` when no such activity exists for this player, `SESSION_ALREADY_COMPLETED` (409) when one does.".

### Consequences
`findActivityConfiguration` and `updateActivityStatusRecord` change signature; both callers are in `training-session.service.ts`. An unknown `activityId` on step-start now answers 403 instead of the previous 422 `VALIDATION_FAILED` ("unknown sequenceNumber") it fell through to. `complete`/`abandon` keep answering `NOT_FOUND` for an activity that is not the caller's — their UPDATE was already player-scoped, and that asymmetry with step-start's 403 is left as-is rather than widened in a bugfix. Client-side `abandonTraining` after a routine already completed now throws on a 409 instead of silently rewriting history; no shipped UI path does that, since the summary modal, not the Leave control, follows completion. No schema backstop was added: tying `exercise_sessions.player_id` to its activity's owner is a composite-FK change to an applied migration's table and belongs to its own task, not to this fix.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-16
