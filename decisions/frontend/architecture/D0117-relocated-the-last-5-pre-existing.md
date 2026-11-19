---
id: D0117
status: accepted
date: 2026-07-17
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

# Relocated the last 5 pre-existing inline-type violations into new folder-level barrels

## Context and Problem Statement
Follow-up requested by the user after D115's fix surfaced these as pre-existing, out-of-scope violations

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Relocated the last 5 pre-existing inline-type violations into new folder-level barrels: `lib/auth/login.data.ts` (`LoginFormContext`), `lib/auth/logout.data.ts` (`LogoutButtonContext`), `lib/auth/verify-jwt.ts` (`VerifiedAuth`) → new shared `lib/auth/types.ts`; `lib/utils/route-class.ts` (`RouteClass`) → new `lib/utils/types.ts`; `lib/server/errors.ts`'s derived `ErrorCode` → new `lib/server/types.ts` (imports `ERROR_HTTP` back from `./errors`, which keeps the runtime const). `lib/types.ts` raises `./auth/types` and `./utils/types`; `lib/server/types.ts` deliberately not raised (Worker-only, consumed directly via `@server/types`, mirroring the existing `ErrorCode` cross-cutting exception). Completes the codebase-wide sweep started by D115", because Follow-up requested by the user after D115's fix surfaced these as pre-existing, out-of-scope violations.

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
Decided: 2026-07-17
