---
id: D0282
status: accepted
date: 2026-09-15
origin: contemporaneous
original-date:
tags: [api, envelope, middleware, Worker, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `SessionApiError` carries the envelope's `requestId` and `details`, and the training routine's step-advance error shows the request id

## Context and Problem Statement
issue #332 — Balanced Training broke advancing out of a Double Pattern ("Doubles") step into the Finishing (TUOD) step with `Could not continue to the next step (INTERNAL_ERROR). Try again.` Investigation (client and server code for `advanceAfterStepCompletion`, `uploadCurrentStepFacts`, `appendBatch`/`validateBatchAgainstRuleset`, `startTrainingStep`/`startGameStep`, the `uq_sessions_single_active` conflict path, and the Neon serverless driver's own error shape) found no reproducible defect in the code exercised by this session's environment, and a client-only reproduction of the same step transition passed. `middleware.ts`'s `onRequest` already logs an uncaught server error's full detail — `console.error([api] uncaught error requestId=..., error)` — but never returns it to the client (`INTERNAL_ERROR`'s registry message is the fixed string "Internal error" for every cause, D-frozen in `errors.ts`), and `SessionApiError` was additionally dropping the one thing the envelope does return safely, `requestId`, before it ever reached the UI. Without it, a generically-classified `INTERNAL_ERROR` on screen cannot be correlated to the matching Worker log line that names the real cause. This is instrumentation to close that gap for the next occurrence, not a fix to a located defect — the underlying trigger for issue #332 is still open pending a Worker-log look at the real `requestId`.

## Decision Drivers
* `INTERNAL_ERROR` on screen cannot be correlated to the Worker log line that names the real cause, because `SessionApiError` drops the envelope's `requestId`.
* `middleware.ts` already logs an uncaught error's full detail with a `requestId` but never returns it to the client.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`SessionApiError` (`client/api/sessions.ts`) gains two optional constructor fields, `requestId` and `details`, populated from the same `ApiFailure` envelope fields at every throw site in `client/api/sessions.ts` and `client/api/training-sessions.ts`. `balancedTrainingPlay()`'s `completeCurrentStep` (`balanced-training-play.data.ts`) appends the request id to its on-screen message when the caught error carries one: `Could not continue to the next step (${code}, ${requestId}). Try again.`".

### Consequences
Every `SessionApiError` thrown by the two session API clients now carries `requestId`/`details` when the server supplied them; nothing currently reads `details` besides the two new unit tests. The training routine's `error` string gains a trailing request id when present, harmless to the one exact-string test that predates a `requestId` on its fixture error (still empty, so the format is unchanged for that case). `sessions.test.ts` and `training-sessions.test.ts` each gain a case asserting the envelope's `requestId`/`details` land on the thrown error; `balanced-training-play.data.test.ts` gains a case asserting the on-screen message includes it.
* Good, because the next occurrence of a generically classified `INTERNAL_ERROR` can be traced to its Worker log line.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/client/api/sessions.test.ts` and `app/tests/lib/client/api/training-sessions.test.ts` each assert that the envelope's `requestId` and `details` land on the thrown error.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-15

* Commit `2f81bcd8` (2026-09-15, adds the D282 row): rebuilt Decision Drivers, Consequences and Confirmation from the commit message and the commit's test files. No spec or plan names this record.
