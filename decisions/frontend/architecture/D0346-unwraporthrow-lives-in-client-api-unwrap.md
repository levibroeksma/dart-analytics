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

# `unwrapOrThrow` lives in `client/api/unwrap.ts`, not in `client.ts`

## Context and Problem Statement
`sessions.ts` owns `SessionApiError` and imports `apiRequest`, so putting the unwrapper in `client.ts` — where the weekly-schedules branch first placed it, following the implementation plan's "move it to `client.ts` if you copy it a second time" — closed a `client.ts` → `sessions.ts` → `client.ts` import cycle. `scripts/fallow-gate.sh` fails on any circular dependency, and the cycle sat under 19 dependents of `client.ts`, where an initialization-order failure is least visible. Moving one function costs three import lines; moving `SessionApiError` out of `sessions.ts` instead would have touched every one of its importers for no gain the cycle fix needs.

## Decision Drivers
* `scripts/fallow-gate.sh` fails on any circular dependency.
* `client.ts` has 19 dependents, where an initialization-order failure is least visible.
* Moving one function costs three import lines.

## Considered Options
* Keep `unwrapOrThrow` in `client.ts`, as the weekly-schedules plan suggested.
* Move `unwrapOrThrow` to `client/api/unwrap.ts` (chosen).
* Move `SessionApiError` out of `sessions.ts` instead.

## Decision Outcome
Chosen option: "the shared envelope unwrapper sits in `app/src/lib/client/api/unwrap.ts`, importing `SessionApiError` from `sessions.ts` and `ApiResult` from `types.ts`; `routines.ts` and `schedules.ts` import `apiRequest` from `./client` and `unwrapOrThrow` from `./unwrap`. `client.ts` imports nothing from `sessions.ts`. Its tests moved with it, to `app/tests/lib/client/api/unwrap.test.ts`.".

### Consequences
`@client/api` now has a third entry point beside `client.ts` and `types.ts`, and a helper that composes the other two belongs there rather than in `client.ts` — `client.ts` stays the transport (auth, retry, envelope construction) and imports only `@client/auth/client` and `./types`. The fallow gate never ran on the branch before this, because CI's type gate failed first and stops the job; the cycle was therefore introduced and merged-ready without any gate having had the chance to object.

* Good, because `client.ts` no longer imports `sessions.ts`, which removes the cycle that `scripts/fallow-gate.sh` rejects.
* Neutral, because `@client/api` gains a third entry point beside `client.ts` and `types.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/fallow-gate.sh` fails on circular dependencies, and `app/tests/lib/client/api/unwrap.test.ts` holds the moved tests.

## Pros and Cons of the Options
### Keep it in `client.ts`

* Bad, because it closes a `client.ts` → `sessions.ts` → `client.ts` import cycle.

### Move it to `unwrap.ts` (chosen)

* Good, because it costs three import lines.

### Move `SessionApiError` out of `sessions.ts`

* Bad, because it would touch every importer for no gain the cycle fix needs.

## Evidence / More Information
Decided: 2026-09-20

* `docs/superpowers/plans/2026-09-18-weekly-training-schedules.md` (Step 3, client): the source of the "move it to `client.ts`" suggestion; rebuilt Considered Options.
* Commit `1b1104bd` (closes #537 and #538; 2026-09-20): rebuilt Decision Drivers, Consequences and Confirmation.
* Applied in: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md`.
