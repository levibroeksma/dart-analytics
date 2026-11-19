---
id: D0353
status: accepted
date: 2026-09-22
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# "Done today" reads completed trainings since a client-supplied instant

## Context and Problem Statement
the homepage must hide the quick link once today's routine was trained. No view exposed training activities, reads must be view-backed, and the server has no player timezone (D343) — so the view stays day-agnostic and the client supplies the day boundary, the same split D343 made for "today's routine".

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`GET /api/training-sessions/completed?since=<ISO 8601 instant>` returns the caller's completed trainings (`activityId`, `routineTemplateId`, `routineName`, `completedAt`) at or after `since`, newest first, backed by the new `v_training_completions` view (migration `0042`: `activities` ⨝ `activity_configurations` ⨝ `game_statuses`, `COMPLETED` only). The homepage passes its local midnight and matches `routineTemplateId` against today's scheduled routine to switch the "today" link card to its "You're on fire" state. The `/training` "My schedule" modal edits the active schedule in place, or creates and activates one named "My schedule" when none is active; saving needs at least one mapped day.".

### Consequences
the routine id and name come from the activity's snapshot, never a template FK, so edits and deletes never rewrite history; abandoned trainings never count. A completion of the scheduled routine outside the schedule (e.g. started from its detail page) still counts as done. The multi-schedule `/training/schedules` pages keep working; the modal only ever touches the active schedule. Schedule adherence across days stays deferred.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-22
