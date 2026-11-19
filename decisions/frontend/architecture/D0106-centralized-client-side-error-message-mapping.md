---
id: D0106
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/architecture, error]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the

## Context and Problem Statement
`login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the shared `ErrorCode` type; replaces ad hoc per-page mapping functions", because `login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable.

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
Decided: 2026-07-16
