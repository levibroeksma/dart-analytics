---
id: D0286
status: accepted
date: 2026-09-16
origin: contemporaneous
original-date:
tags: [frontend/alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A routine resolves a blocking game in place instead of dead-ending on its Finishing step

## Context and Problem Statement
a single forgotten Ten Up One Down game blocked every Balanced Training run at step 4 with a bare `ErrorAlert` and no action (#357): the player had to leave the routine, resolve the game under Games, and start over, losing three completed steps, while the routine activity stayed ACTIVE forever. The setup screens already reconcile this state; the routine had no equivalent. `reconcileActiveSession` is deliberately not reused — its D88 mismatch rule auto-abandons silently, and the blocking game may hold real darts, so only the player ends it (the rule D285 kept for #355). The server already names the blocker in `details.sessionId`/`startedAt` (`services/training-session.service.ts`), so no `fetchActiveSessions` round-trip is needed.

## Decision Drivers
* A forgotten TUOD game blocked every Balanced Training run at step 4 with a bare `ErrorAlert` and no action (#357). The player lost 3 completed steps, and the routine activity stayed ACTIVE.
* The server already names the blocker in `details.sessionId` and `startedAt`, so no `fetchActiveSessions` round-trip is needed.
* Only the player may end a blocking game, because it may hold real darts.

## Considered Options
* Hold the conflict in `blockingSession` and resolve it in place through a modal (chosen).
* Reuse `reconcileActiveSession`, which the commit rejects because its D88 mismatch rule auto-abandons silently.
* Offer setup's "Continue" in the modal, which the record rejects because it would navigate to the blocking game and lose the routine.
* Rethrow the conflict as a bare step-advance error (the behaviour before this record).

## Decision Outcome
Chosen option: "`balanced-training-play.data.ts`'s `startCurrentStep()` catches `SESSION_ALREADY_ACTIVE` from `startTrainingStep`, reads the blocking game out of the failure's `details` via a new `lib/training/routines/step-session-conflict.ts` (`activeSessionConflict`), and holds it in `blockingSession` rather than rethrowing. `BlockedStepModal.astro` (page-owned `x-if`) offers `resolveBlockingSession()` — `completeSession(sessionId, "ABANDONED")` then `startCurrentStep()` again — and `abandonAndExit()`. The step-start branching moves into `openStep(result, durationSeconds)`. `stepAdvanceErrorMessage()` loses its `SESSION_ALREADY_ACTIVE` wording, which is now unreachable.".

### Consequences
the modal deliberately does not offer setup's "Continue", which would navigate to the blocking game and lose the routine. A retry that hits the conflict again re-arms the modal on whatever session the server then names; a conflict carrying no `sessionId` stays a plain step-advance error. The Finishing step's server call mints a fresh session per attempt, so the failed first attempt leaves nothing to reuse. `balanced-training-play.data.test.ts`'s existing dead-end case is repointed to the modal — same guarantee, resolvable ending — and `step-advance-error.test.ts` loses the case whose subject was removed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `217c2729` added `app/tests/lib/training/routines/step-session-conflict.test.ts` for the `activeSessionConflict` reader, which exists today. It also extended the Balanced Training play-data test with the modal flow; that test is no longer present under that name.

## Pros and Cons of the Options
### Resolve the blocking game in place
* Good, because the player no longer leaves the routine, resolves the game under Games and starts over, losing 3 steps.
* Good, because the player decides: `resolveBlockingSession()` abandons the game, then `startCurrentStep()` runs again.

### Reuse `reconcileActiveSession`
* Bad, because its D88 mismatch rule auto-abandons silently, and the blocking game may hold real darts.

### Offer setup's "Continue"
* Bad, because it would navigate to the blocking game and lose the routine.

## Evidence / More Information
Decided: 2026-09-16

* Commit `217c2729` (2026-09-16, PR #357, adds the D286 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the commit message and the row. The Context names D285, which kept the same rule for #355.
* No spec or plan in `docs/superpowers/` introduces D286. The graph-freshness spec and plans that match the string "D286" use it for an unrelated context-system decision.
