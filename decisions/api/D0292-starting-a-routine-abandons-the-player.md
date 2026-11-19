---
id: D0292
status: accepted
date: 2026-09-17
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

# Starting a routine abandons the player's previous one

## Context and Problem Statement
nothing limited concurrent ACTIVE activities per player (issue #358) — every abandoned tab left an orphan that nothing ever closed, and activity-scoped reads could not tell which of N open rows was the real one. Rejecting the second start was the alternative; auto-abandon was chosen because a routine is a single-player, single-device activity where the newest intent is the real one, and a reject path would strand the player behind an orphan they cannot see. The step sessions must close with their activity: leaving them open would hand the new routine a `SESSION_ALREADY_ACTIVE` dead-end on its first step, now that D288's index actually fires for non-game sessions.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Auto-abandon the player's previous routine when a new one starts.
* Reject the second start.

## Decision Outcome
Chosen option: "`startTraining` closes every training activity the player still has open — and every step session still open under one — inside the same transaction that inserts the new activity. A training activity is identified by carrying an `activity_configurations` snapshot, which is what separates it from the activity a standalone game creates. `startTrainingStep`'s non-game branch gains the `uq_sessions_single_active` conflict handling its game branch already had, returning `SESSION_ALREADY_ACTIVE` with the open session's `{ sessionId, startedAt }` from the new `findActiveSessionForExerciseType` read.".

### Consequences
a second tab starting the routine silently ends the first one's routine — the player gets no confirmation prompt, and any darts already uploaded stay recorded under the abandoned activity (immutable history, per the root invariant). `insertTrainingActivity` now takes the caller's transaction instead of opening its own, matching `insertExerciseSessionRecord`; the abandon and the insert are therefore atomic. Activity-level uniqueness remains unenforced at the database level for the reason D288 records, so this rule lives only in the service.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-17
Referenced by D0378's `Supersedes:` line.

* Commit `2bdf3229` (PR #381, 2026-09-17; part of #358; adds the D292 row to `decisions/api.md`): rebuilt Considered Options; source of the split-copied Context and Consequences. Its message says "D289".
* Commit `2b380f01` (2026-10-01; adds D378 to `decisions/api.md`): D378 supersedes D292's auto-abandon and keeps its `startTrainingStep` conflict handling.
