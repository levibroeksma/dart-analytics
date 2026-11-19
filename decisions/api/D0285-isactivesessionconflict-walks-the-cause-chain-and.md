---
id: D0285
status: accepted
date: 2026-09-16
origin: contemporaneous
original-date:
tags: [api, middleware, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `isActiveSessionConflict` walks the `cause` chain, and the routine names an already-active Finishing game

## Context and Problem Statement
issue #355, the located cause of #332's symptom. Production row state for the failing run (activity `01a0aad3`, 2026-09-16) shows the Double Pattern step session completed with 1 stage / 9 turns / 27 darts persisted and `completed_at` set, and no step-4 session row created at all: `appendBatch` and `completeSession` both succeeded, and the failure was `startTrainingStep` for the GAME step. That insert hit `uq_sessions_single_active` against a TUOD session left open since 2026-09-14, which is the intended resumable-session state, not corruption. The conflict should therefore have surfaced as `SESSION_ALREADY_ACTIVE`, but drizzle-orm 0.45.2 wraps every query error in a `DrizzleQueryError` (`pg-core/session.cjs`) whose message is `Failed query: …` and whose `code`/`constraint` are undefined — the Postgres `23505` and the constraint name survive only on `cause`. Reading the top level alone made the conflict unrecognisable, so `startGameStep` rethrew it and the middleware boundary classified it as `INTERNAL_ERROR`. The existing unit test passed throughout because its fixture put `code`/`constraint` on a flat object, a shape production never throws.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`isActiveSessionConflict` (`session.service.ts`) follows the error's `cause` chain (bounded to 8 links, self-reference guarded) instead of reading `code`/`constraint`/`message` off the top-level error only. The routine's step-advance message moves out of `balancedTrainingPlay()`'s `completeCurrentStep` into `stepAdvanceErrorMessage` (`lib/training/routines/step-advance-error.ts`), which maps a `SESSION_ALREADY_ACTIVE` failure to its own message — "You have an unfinished Ten Up One Down game. Finish or abandon it under Games, then start this routine again." — and every other coded failure to the existing code+requestId string.".

### Consequences
Every unique-active-session conflict now classifies correctly — the routine's Finishing step and `createSession`'s `insertSessionWithActiveGuard` alike, so the setup screens' active-session reconciliation modal (`setup-controller.ts`) is reachable again for a wrapped conflict. The routine still cannot start Finishing while another TUOD session is open; it now says which game to resolve instead of showing a 500 code, since only the player can decide the fate of a session that may hold real darts. A routine-level equivalent of the setup screens' Continue/Abandon modal is not built here (issue filed). `session.service.test.ts` gains four cases — singly wrapped, doubly wrapped, an unrelated wrapped error, and a self-referencing `cause` — `balanced-training-play.data.test.ts` one case for the new message on the Double Pattern → Finishing transition, and the extracted module its own four-case test file. The extraction is not cosmetic: adding the branch inline pushed `balanced-training-play.data.ts` to CRAP risk 31.6, over `npx fallow`'s threshold of 30, which the split returns to 0 above threshold (maintainability 91.9 → 92.0).

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
