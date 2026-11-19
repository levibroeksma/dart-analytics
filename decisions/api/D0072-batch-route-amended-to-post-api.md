---
id: D0072
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, batch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Batch route amended to `POST /api/sessions/:sessionId/events/batch`

## Context and Problem Statement
Astro file routing serves it natively; `:batch` spelling was unservable

## Decision Drivers
* The frozen API docs contradicted themselves on the batch URL (hardening spec, Problem).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Batch route amended to `POST /api/sessions/:sessionId/events/batch`", because Astro file routing serves it natively; `:batch` spelling was unservable.

### Consequences
* Neutral, because the route is served by Astro file routing at `events/batch.ts`.
* Neutral, because the `events:batch` custom-method spelling is removed from all docs.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem, Decision 6a): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 11): appends the ledger row D72.
* Commit `7c49f6d5` (2026-07-14; records D67 to D78): adds the ledger row D72.
* Amends D32, which spelled the route `events:batch`.
