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
<!-- backfill: pending -->

# A routine resolves a blocking game in place instead of dead-ending on its Finishing step

## Context and Problem Statement
a single forgotten Ten Up One Down game blocked every Balanced Training run at step 4 with a bare `ErrorAlert` and no action (#357): the player had to leave the routine, resolve the game under Games, and start over, losing three completed steps, while the routine activity stayed ACTIVE forever. The setup screens already reconcile this state; the routine had no equivalent. `reconcileActiveSession` is deliberately not reused — its D88 mismatch rule auto-abandons silently, and the blocking game may hold real darts, so only the player ends it (the rule D285 kept for #355). The server already names the blocker in `details.sessionId`/`startedAt` (`services/training-session.service.ts`), so no `fetchActiveSessions` round-trip is needed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`balanced-training-play.data.ts`'s `startCurrentStep()` catches `SESSION_ALREADY_ACTIVE` from `startTrainingStep`, reads the blocking game out of the failure's `details` via a new `lib/training/routines/step-session-conflict.ts` (`activeSessionConflict`), and holds it in `blockingSession` rather than rethrowing. `BlockedStepModal.astro` (page-owned `x-if`) offers `resolveBlockingSession()` — `completeSession(sessionId, "ABANDONED")` then `startCurrentStep()` again — and `abandonAndExit()`. The step-start branching moves into `openStep(result, durationSeconds)`. `stepAdvanceErrorMessage()` loses its `SESSION_ALREADY_ACTIVE` wording, which is now unreachable.".

### Consequences
the modal deliberately does not offer setup's "Continue", which would navigate to the blocking game and lose the routine. A retry that hits the conflict again re-arms the modal on whatever session the server then names; a conflict carrying no `sessionId` stays a plain step-advance error. The Finishing step's server call mints a fresh session per attempt, so the failed first attempt leaves nothing to reuse. `balanced-training-play.data.test.ts`'s existing dead-end case is repointed to the modal — same guarantee, resolvable ending — and `step-advance-error.test.ts` loses the case whose subject was removed.

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
