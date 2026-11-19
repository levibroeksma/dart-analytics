---
id: D0131
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [api, contract, envelope, middleware]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# API error boundary in middleware

## Context and Problem Statement
Activates the frozen `SERVICE_UNAVAILABLE` retry contract that had no emitter; formalizes the previously "optional" envelope-on-error rule for Cloudflare/Neon scale-to-zero

The 2026-07-22 audit (finding H1) found no `try/catch` in any `pages/api/**` handler or `services/**`, so a thrown error escaped as a non-envelope framework 500.

## Decision Drivers
* A thrown error returned a non-envelope 500, violating "every response uses the envelope + requestId" (H1).
* `SERVICE_UNAVAILABLE`, the only retryable code, was defined in `errors.ts` but never emitted (H1).
* Cloudflare Workers with Neon scale-to-zero are expected to produce transient cold-start failures (spec Context, per D24).

## Considered Options
* Leave handlers and services without an error boundary (the state H1 describes).
* Add a global boundary in middleware, the single guaranteed chokepoint, gated to `api-*` route classes (chosen).

## Decision Outcome
Chosen option: "API error boundary in middleware: uncaught exceptions on `api-*` routes are classified (`lib/server/classify-error.ts`) to `SERVICE_UNAVAILABLE` (transient connectivity/DB) or `INTERNAL_ERROR` and returned in the frozen envelope with `requestId`; raw error text is logged server-side, never sent to the client", because Activates the frozen `SERVICE_UNAVAILABLE` retry contract that had no emitter; formalizes the previously "optional" envelope-on-error rule for Cloudflare/Neon scale-to-zero.

### Consequences
* Good, because a transient failure returns a retryable 503 `SERVICE_UNAVAILABLE` envelope with a `requestId`.
* Neutral, because page routes keep Astro's default HTML error handling and carry no envelope.
* Neutral, because the client receives the registry message only, and the real error is logged server-side keyed by `requestId`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/middleware.test.ts` asserts a generic thrown error returns a 500 `INTERNAL_ERROR` envelope and a transient one returns a 503 `SERVICE_UNAVAILABLE` envelope. `app/tests/lib/server/classify-error.test.ts` unit-tests the classifier.

## Pros and Cons of the Options
### No error boundary
* Bad, because a thrown error returns a non-envelope 500.
* Bad, because `SERVICE_UNAVAILABLE` has no emitter.

### Global boundary in middleware
* Good, because middleware is the one place guaranteed to run, so a future route cannot forget it.
* Good, because `02-Middleware-And-Layering.md` already names middleware the single entry point for cross-cutting API concerns.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` (Context; audit finding H1; § 1 and the decisions list): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-22-hardening-first-deploy.md` (the classifier and middleware tasks): rebuilt Confirmation.
* Commit `3c26668a` (PR #35, 2026-07-22): added the middleware boundary, the classifier and their tests; confirmed Confirmation.
