---
id: D0132
status: accepted
date: 2026-07-22
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

# Server-guarded single-active-session invariant

## Context and Problem Statement
Two rapid taps / two tabs / a failed orphan-abandon previously produced an uncaught 500; server now defends the invariant instead of relying on the client

## Decision Drivers
* A double tap, a second tab or a failed orphan-abandon (D118 `abandon_failed`) reaches `createSession`, which neither pre-checks for an ACTIVE session nor catches the `uq_sessions_single_active` violation.
* The raw Postgres error then surfaces as an uncaught framework 500.
* The client should offer Continue/Abandon without a second round-trip.

## Considered Options
* Pre-check plus a race-safe backstop on the unique violation, returning `409 SESSION_ALREADY_ACTIVE` (chosen).
* Rely on the client alone to defend the invariant (the prior state).

## Decision Outcome
Chosen option: "Server-guarded single-active-session invariant: `POST /api/sessions` pre-checks for an existing ACTIVE session (`findActiveSessionForGameType`, `completed_at IS NULL`) and catches the `uq_sessions_single_active` (23505) violation as a race-safe backstop, returning new `409 SESSION_ALREADY_ACTIVE` with the existing `{ sessionId, startedAt }` in `details`; Score Training client re-reconciles (D118) into the Continue/Abandon modal. Reopens the v1 error registry (D70) by explicit decision for this hardening pass", because Two rapid taps / two tabs / a failed orphan-abandon previously produced an uncaught 500; server now defends the invariant instead of relying on the client.

### Consequences
* Good, because the existing session's `sessionId` and `startedAt` travel in `details`, so the client reuses `ContinueSessionModal` with no second round-trip.
* Good, because the backstop closes the TOCTOU gap the pre-check alone leaves.
* Neutral, because the v1 error registry, previously closed, gains `SESSION_ALREADY_ACTIVE` (409, not retryable), registered in `00-Overview.md` and `03-Shared-Conventions.md`.
* Neutral, because if the backstop's re-query misses (the spec says this should not happen), the service returns `INTERNAL_ERROR`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/server/errors.test.ts` asserts that `SESSION_ALREADY_ACTIVE` maps to 409 and is not retryable.

## Pros and Cons of the Options
### Pre-check plus unique-violation backstop
* Good, because the pre-check handles the common path and the backstop handles the race.

### Client-only defence (status quo)
* Bad, because two rapid taps, two tabs or a failed orphan-abandon produced an uncaught 500.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` (§1 finding H3, decisions taken during brainstorming item 3, workstream §2): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-22-hardening-first-deploy.md` (ledger row for D132): the ledger text.
* Commit `3c26668a` (2026-07-22, PR #35, adds the D132 row).
* Reopens D70: the registry was previously closed for v1.
