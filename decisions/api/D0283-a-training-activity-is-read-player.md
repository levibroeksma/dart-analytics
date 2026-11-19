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

# A training activity is read player-scoped, and its terminal transition is guarded inside the UPDATE

## Context and Problem Statement
issues #336 and #335. The step-start path filtered only on `activity_id`, so any authenticated player could read another player's configuration snapshot and insert sessions into their activity — against `06-API/02-Middleware-And-Layering.md` Rules #5, "all protected queries must be player-scoped". The transition path rewrote `status_id` and `completed_at` with no status check at all, so `complete` followed by `abandon` destroyed a completed routine's original `completed_at` — against root `CLAUDE.md`'s first hard invariant. `session.service.ts`'s `updateSessionStatus` already guarded the same way for game sessions (read, compare to `ACTIVE`, return `SESSION_ALREADY_COMPLETED`); the training path is the copy that lost the check. The guard is put in the UPDATE predicate rather than copied as a read-then-write because two concurrent transitions on one activity would both pass a prior read and the second would still overwrite the first's timestamp.

## Decision Drivers
* Step-start filtered only on `activity_id`, so any authenticated player could read another player's configuration snapshot and insert sessions into their activity (PR #359, #336).
* `complete` then `abandon` destroyed a completed routine's original `completed_at` (PR #359, #335).

## Considered Options
* Guard the terminal transition with a read, then a write, as `session.service.ts` does for game sessions.
* Put the "still active" check in the UPDATE predicate (chosen).

## Decision Outcome
Chosen option: "`findActivityConfiguration` (`training-session.repository.ts`) takes `playerId` and inner-joins `activities`, so an activity the caller does not own reads as `undefined`; `startTrainingStep` maps that to `SESSION_OWNERSHIP_MISMATCH` (403) before any `exercise_sessions` row is written, making an unknown and a foreign `activityId` deliberately indistinguishable to the caller. `updateActivityStatusRecord` takes `expectedStatusId` and carries `activities.status_id = <ACTIVE>` in its own WHERE, so the "still active" check *is* the UPDATE rather than a read preceding it; `transitionTrainingActivity` resolves the `ACTIVE` id alongside the target status, and on a zero-row update re-reads the activity player-scoped (new `findActivityStatus`) only to classify the failure — `NOT_FOUND` when no such activity exists for this player, `SESSION_ALREADY_COMPLETED` (409) when one does.".

### Consequences
`findActivityConfiguration` and `updateActivityStatusRecord` change signature; both callers are in `training-session.service.ts`. An unknown `activityId` on step-start now answers 403 instead of the previous 422 `VALIDATION_FAILED` ("unknown sequenceNumber") it fell through to. `complete`/`abandon` keep answering `NOT_FOUND` for an activity that is not the caller's — their UPDATE was already player-scoped, and that asymmetry with step-start's 403 is left as-is rather than widened in a bugfix. Client-side `abandonTraining` after a routine already completed now throws on a 409 instead of silently rewriting history; no shipped UI path does that, since the summary modal, not the Leave control, follows completion. No schema backstop was added: tying `exercise_sessions.player_id` to its activity's owner is a composite-FK change to an applied migration's table and belongs to its own task, not to this fix.
* Good, because the guard is atomic: it is the UPDATE itself, not a read preceding it.
* Good, because an unknown and a foreign `activityId` are indistinguishable to the caller on step-start.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
PR #359 added red-first tests that still exist. `app/tests/repositories/training-session.repository.test.ts` (player-scoped reads, `status_id` in the UPDATE predicate, `findActivityStatus`). `app/tests/services/training-session.service.test.ts` covers 403 with no insert and 409 on a terminal activity. `app/tests/pages/api/training-sessions/training-sessions.test.ts` covers the 403 and 409 envelopes.

## Pros and Cons of the Options
### Read, then write
* Bad, because 2 concurrent transitions on one activity would both pass the read and the second would overwrite the first's timestamp.

### Guard inside the UPDATE
* Good, because the check and the write are atomic.
* Good, because a zero-row update is classified with the same `SESSION_ALREADY_COMPLETED` code `updateSessionStatus` returns for game sessions.

## Evidence / More Information
Decided: 2026-09-16

* Commit `597a9bef` (PR #359, 2026-09-16; adds the D283 block): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. No spec or plan cites D283.
