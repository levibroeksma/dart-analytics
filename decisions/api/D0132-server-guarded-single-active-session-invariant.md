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
<!-- backfill: pending -->

# Server-guarded single-active-session invariant

## Context and Problem Statement
Two rapid taps / two tabs / a failed orphan-abandon previously produced an uncaught 500; server now defends the invariant instead of relying on the client

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Server-guarded single-active-session invariant: `POST /api/sessions` pre-checks for an existing ACTIVE session (`findActiveSessionForGameType`, `completed_at IS NULL`) and catches the `uq_sessions_single_active` (23505) violation as a race-safe backstop, returning new `409 SESSION_ALREADY_ACTIVE` with the existing `{ sessionId, startedAt }` in `details`; Score Training client re-reconciles (D118) into the Continue/Abandon modal. Reopens the v1 error registry (D70) by explicit decision for this hardening pass", because Two rapid taps / two tabs / a failed orphan-abandon previously produced an uncaught 500; server now defends the invariant instead of relying on the client.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-22
