---
id: D0378
status: accepted
date: 2026-09-30
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Starting a routine while one is open offers resume or abandon, never silently abandons

## Context and Problem Statement
issue #358 and the author's call. D292 chose auto-abandon so a stale orphan could not strand the player, but it ended a routine the player may still want with no prompt, and a game already offers resume or abandon. Routines keep no client-side state (a reload restarts them), so resume restores progress at step grain from the server rather than the exact dart position. Reusing `SESSION_ALREADY_ACTIVE` keeps the frozen v1 error registry unchanged; the client tells the routine conflict from the step conflict by `details.activityId` against `details.sessionId`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`startTraining` no longer closes the player's open routine. It answers `SESSION_ALREADY_ACTIVE` with `details: { activityId, startedAt, routineName }` and writes nothing. The play page offers the same choice a game does. Resume: new `POST /api/training-sessions/:activityId/resume` abandons any step session still open under the activity and returns the snapshot steps with `completedStepCount`, the leading run of `COMPLETED` step sessions; the client opens the routine at that step and the unfinished step starts fresh. Abandon: `abandonTraining` now also abandons the activity's open step sessions in the same transaction, then the requested routine starts. A routine whose steps had all finished is completed by resume and the requested one starts afresh. `abandonActiveTrainingActivities` is removed.".

### Consequences
darts of the half-played step are abandoned with it, and the routine clock restarts at zero on resume. Uniqueness lives only in the service, so two simultaneous starts can still both succeed; a database index stays blocked on issue #380 (game activities are never closed). Supersedes D292's auto-abandon; its `startTrainingStep` conflict handling stands.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-30
Supersedes: D292 (in part).
