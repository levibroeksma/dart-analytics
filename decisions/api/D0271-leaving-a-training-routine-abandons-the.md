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

# Leaving a training routine abandons the activity itself, not just its current step's session

## Context and Problem Statement
issue #274 asked for training mode to gain a Leave control like every game mode's; doing that without also closing out the `activities` row would leave it `ACTIVE` forever every time a player left early, since — unlike `exercise_sessions` — nothing enforces a single active `activities` row per player. That is a wrong historical record, not just a missing UI affordance: "store what happened" requires the record to say abandoned when it was.

## Decision Drivers
* Training mode should gain a Leave control like every game mode's (PR #277 Summary).
* Leaving mid-routine left the `activities` row stuck `ACTIVE` forever (PR #277 Summary).

## Considered Options
* Add the Leave control and abandon only the current step's session, leaving the `activities` row `ACTIVE`.
* Add a new `PATCH /api/training-sessions/:activityId/abandon` endpoint that also abandons the activity (chosen).

## Decision Outcome
Chosen option: "`PATCH /api/training-sessions/:activityId/abandon` is a new endpoint, mirroring the existing `PATCH /api/training-sessions/:activityId/complete` — both now delegate to one `transitionTrainingActivity(playerId, activityId, statusKey)` helper (`training-session.service.ts`) that resolves `game_statuses` for either `COMPLETED` or `ABANDONED` and updates `activities.status_id`. `balancedTrainingPlay()`'s new `abandonAndExit()` calls it after abandoning the current step's own `exercise_sessions` row through the existing `PATCH /api/sessions/:sessionId` (`{ status: "ABANDONED" }`) — reusing the `ABANDONED` status `exercise_sessions` already accepts, now also valid for `activities`. `playAbandonAndExit` (`play-lifecycle.ts`) gains an optional `redirectTo` (default `/games`, every existing caller unaffected) and now awaits its `onAbandoned` callback (previously fire-and-forget) so the Finishing step's own wrapped abandon (`finishingStep()`, `finishing-step.data.ts`) can await the activity-abandon call before the store resets and the page redirects to `/training`.".

### Consequences
`abandonTraining`/`completeTraining` are now thin wrappers over one shared helper. `06-API/00-Overview.md`'s Route Surface table lists no `/api/training-sessions/*` endpoint at all — that gap predates this change (the whole `start`/`steps`/`complete` family was already undocumented) and is logged in `FINDINGS.md` rather than backfilled here.
* Neutral, because the change needs no schema or migration change: it reuses the `ABANDONED` `game_statuses` row that `exercise_sessions` already accepted.
* Neutral, because `playAbandonAndExit`, used by all 9 games, gains an optional `redirectTo` that defaults to `/games`, and now awaits its `onAbandoned` callback.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `cebf5fb3` added tests that still exist: `app/tests/services/training-session.service.test.ts` (`abandonTraining`), `app/tests/pages/api/training-sessions/training-sessions.test.ts`, `app/tests/lib/game/play-lifecycle.test.ts` and `app/tests/lib/client/api/training-sessions.test.ts`.

## Pros and Cons of the Options
### Abandon only the step's session
* Bad, because the activity row stays `ACTIVE` forever, a wrong historical record.

### Abandon the activity as well
* Good, because the record says abandoned when the routine was abandoned.

## Evidence / More Information
Decided: 2026-09-13

* Commit `cebf5fb3` (PR #277, 2026-09-13; adds the D271 block): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. No spec or plan cites D271.
