---
id: D0271
status: accepted
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [api, endpoint, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Leaving a training routine abandons the activity itself, not just its current step's session

## Context and Problem Statement
issue #274 asked for training mode to gain a Leave control like every game mode's; doing that without also closing out the `activities` row would leave it `ACTIVE` forever every time a player left early, since — unlike `exercise_sessions` — nothing enforces a single active `activities` row per player. That is a wrong historical record, not just a missing UI affordance: "store what happened" requires the record to say abandoned when it was.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`PATCH /api/training-sessions/:activityId/abandon` is a new endpoint, mirroring the existing `PATCH /api/training-sessions/:activityId/complete` — both now delegate to one `transitionTrainingActivity(playerId, activityId, statusKey)` helper (`training-session.service.ts`) that resolves `game_statuses` for either `COMPLETED` or `ABANDONED` and updates `activities.status_id`. `balancedTrainingPlay()`'s new `abandonAndExit()` calls it after abandoning the current step's own `exercise_sessions` row through the existing `PATCH /api/sessions/:sessionId` (`{ status: "ABANDONED" }`) — reusing the `ABANDONED` status `exercise_sessions` already accepts, now also valid for `activities`. `playAbandonAndExit` (`play-lifecycle.ts`) gains an optional `redirectTo` (default `/games`, every existing caller unaffected) and now awaits its `onAbandoned` callback (previously fire-and-forget) so the Finishing step's own wrapped abandon (`finishingStep()`, `finishing-step.data.ts`) can await the activity-abandon call before the store resets and the page redirects to `/training`.".

### Consequences
`abandonTraining`/`completeTraining` are now thin wrappers over one shared helper. `06-API/00-Overview.md`'s Route Surface table lists no `/api/training-sessions/*` endpoint at all — that gap predates this change (the whole `start`/`steps`/`complete` family was already undocumented) and is logged in `FINDINGS.md` rather than backfilled here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-13
