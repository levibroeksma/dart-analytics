---
id: D0041
status: accepted
date: 2026-07-09
origin: contemporaneous
original-date:
tags: [frontend/architecture, API client]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Single API client (`lib/api/client.ts`), skeleton-first hydration

## Context and Problem Statement
One integration seam. The ledger row dates the decision 2026-07-09,. The 2026-07-13 architecture hardening spec cites it as "frozen D41" and keeps `lib/api/` for the browser client alone.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Single API client (`lib/api/client.ts`), skeleton-first hydration", because One integration seam.

### Consequences
* Neutral, because `lib/api/` is reserved for the browser-facing API client and browser and Worker code never share a folder.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-09

* Commit `8b23f90e` (2026-07-11, adds the `DECISIONS.md` ledger): carries the D41 row, "One integration seam".
* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 10 tree and its bullets): rebuilt Context and Consequences. The spec calls D41 frozen. It also moves the Worker envelope and error helpers to `lib/server/`.
* Related: the 2026-07-14 frontend spec (Decision 6) proposes moving the browser client to `lib/client/api/`; D83 carries that decision.
* Skeleton-first hydration has no source beyond the ledger row.
