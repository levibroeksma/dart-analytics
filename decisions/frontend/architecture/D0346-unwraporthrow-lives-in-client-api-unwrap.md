---
id: D0346
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [frontend/architecture, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `unwrapOrThrow` lives in `client/api/unwrap.ts`, not in `client.ts`

## Context and Problem Statement
`sessions.ts` owns `SessionApiError` and imports `apiRequest`, so putting the unwrapper in `client.ts` — where the weekly-schedules branch first placed it, following the implementation plan's "move it to `client.ts` if you copy it a second time" — closed a `client.ts` → `sessions.ts` → `client.ts` import cycle. `scripts/fallow-gate.sh` fails on any circular dependency, and the cycle sat under 19 dependents of `client.ts`, where an initialization-order failure is least visible. Moving one function costs three import lines; moving `SessionApiError` out of `sessions.ts` instead would have touched every one of its importers for no gain the cycle fix needs.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the shared envelope unwrapper sits in `app/src/lib/client/api/unwrap.ts`, importing `SessionApiError` from `sessions.ts` and `ApiResult` from `types.ts`; `routines.ts` and `schedules.ts` import `apiRequest` from `./client` and `unwrapOrThrow` from `./unwrap`. `client.ts` imports nothing from `sessions.ts`. Its tests moved with it, to `app/tests/lib/client/api/unwrap.test.ts`.".

### Consequences
`@client/api` now has a third entry point beside `client.ts` and `types.ts`, and a helper that composes the other two belongs there rather than in `client.ts` — `client.ts` stays the transport (auth, retry, envelope construction) and imports only `@client/auth/client` and `./types`. The fallow gate never ran on the branch before this, because CI's type gate failed first and stops the job; the cycle was therefore introduced and merged-ready without any gate having had the chance to object.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
