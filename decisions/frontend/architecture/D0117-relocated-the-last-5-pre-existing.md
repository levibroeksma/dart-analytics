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

# Relocated the last 5 pre-existing inline-type violations into new folder-level barrels

## Context and Problem Statement
Follow-up requested by the user after D115's fix surfaced these as pre-existing, out-of-scope violations

## Decision Drivers
* The user asked for a follow-up after D115's fix surfaced 5 pre-existing, out-of-scope inline-type violations.
* The goal is to complete the codebase-wide sweep that D115 started.

## Considered Options
* Leave the 5 violations out of scope, as D115 left them.
* Relocate all 5 into new folder-level barrels (chosen).
* Raise the new `lib/server/types.ts` through `lib/types.ts` like the other two new barrels (not chosen).

## Decision Outcome
Chosen option: "Relocated the last 5 pre-existing inline-type violations into new folder-level barrels: `lib/auth/login.data.ts` (`LoginFormContext`), `lib/auth/logout.data.ts` (`LogoutButtonContext`), `lib/auth/verify-jwt.ts` (`VerifiedAuth`) → new shared `lib/auth/types.ts`; `lib/utils/route-class.ts` (`RouteClass`) → new `lib/utils/types.ts`; `lib/server/errors.ts`'s derived `ErrorCode` → new `lib/server/types.ts` (imports `ERROR_HTTP` back from `./errors`, which keeps the runtime const). `lib/types.ts` raises `./auth/types` and `./utils/types`; `lib/server/types.ts` deliberately not raised (Worker-only, consumed directly via `@server/types`, mirroring the existing `ErrorCode` cross-cutting exception). Completes the codebase-wide sweep started by D115", because Follow-up requested by the user after D115's fix surfaced these as pre-existing, out-of-scope violations.

### Consequences
* Good, because the sweep that D115 started now covers the 5 remaining violations.
* Neutral, because `lib/types.ts` raises `./auth/types` and `./utils/types`, while `lib/server/types.ts` is deliberately not raised. It is Worker-only and consumed directly via `@server/types`, mirroring the existing `ErrorCode` cross-cutting exception.
* Neutral, because `lib/server/types.ts` imports `ERROR_HTTP` back from `./errors`, which keeps the runtime const.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Leave the 5 violations out of scope
Rationale unknown — no source found. The commit calls them pre-existing and out of scope for D115.

### Relocate all 5 into new folder-level barrels
* Good, because it completes the codebase-wide sweep started by D115.

### Raise `lib/server/types.ts` through `lib/types.ts`
Rationale unknown — no source found. The commit notes only that the file is Worker-only and consumed via `@server/types`.

## Evidence / More Information
Decided: 2026-07-17

* Commit `cd80aa80` (PR #29, 2026-07-21 merge; adds the D117 row): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
