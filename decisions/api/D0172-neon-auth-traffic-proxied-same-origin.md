---
id: D0172
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [api, contract, envelope, auth, session, JWT]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Neon Auth traffic proxied same-origin through `/api/auth/[...path]` (new `api-auth-proxy`

## Context and Problem Statement
iOS gives an installed Home Screen web app its own storage container split from Safari, and WebKit blocks the cross-site session cookie Better Auth's default client relies on, so login never established inside the installed PWA (issue #55)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Neon Auth traffic proxied same-origin through `/api/auth/[...path]` (new `api-auth-proxy` route class, bypasses JWT/player checks and the `ok/data/requestId` envelope) so the Better Auth session cookie binds first-party instead of cross-site to `NEON_AUTH_BASE_URL`'s own domain; the app's `Authorization: Bearer` API contract is unchanged, only what feeds `getJWTToken()` changes".

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
Decided: 2026-07-29
