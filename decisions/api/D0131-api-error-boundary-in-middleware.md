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
<!-- backfill: pending -->

# API error boundary in middleware

## Context and Problem Statement
Activates the frozen `SERVICE_UNAVAILABLE` retry contract that had no emitter; formalizes the previously "optional" envelope-on-error rule for Cloudflare/Neon scale-to-zero

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "API error boundary in middleware: uncaught exceptions on `api-*` routes are classified (`lib/server/classify-error.ts`) to `SERVICE_UNAVAILABLE` (transient connectivity/DB) or `INTERNAL_ERROR` and returned in the frozen envelope with `requestId`; raw error text is logged server-side, never sent to the client", because Activates the frozen `SERVICE_UNAVAILABLE` retry contract that had no emitter; formalizes the previously "optional" envelope-on-error rule for Cloudflare/Neon scale-to-zero.

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
