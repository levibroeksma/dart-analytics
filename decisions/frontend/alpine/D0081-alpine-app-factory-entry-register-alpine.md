---
id: D0081
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, x-data, x-init]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Alpine `app.factory` entry + `register*(Alpine)`

## Context and Problem Statement
Single Alpine bootstrap; init runs. Alpine bootstraps only through the `@astrojs/alpinejs` entrypoint (`app.factory.ts`). Outside the factory chain, files import only `import type { Alpine } from 'alpinejs'`. Each `register*(Alpine)` calls `Alpine.store(...)` or `Alpine.data(...)`, and factory files export functions with no Alpine import. The spec forbids `x-init`, calling it deprecated.

## Decision Drivers
* One Alpine bootstrap.
* Store `init()` must run, which needs the store factory invoked with `()`.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Alpine `app.factory` entry + `register*(Alpine)`; no `x-init`; `x-data="foo()"`; store factories invoked with `()`", because Single Alpine bootstrap; init runs.

### Consequences
* Neutral, because three registrars split the work: `register-stores.ts`, `register-ui-data.ts` and `register-route-data.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Validation list covers the handbook docs and `scripts/check-context-map.sh`. No source names a check for the binding rules.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 9, I6, Alpine binding rules; the proposed D81 row): rebuilt Context, Drivers and Consequences.
* Commit `238fdbc1` (2026-07-14, adds the D81 row).
