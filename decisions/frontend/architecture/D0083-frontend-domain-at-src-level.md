---
id: D0083
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Frontend domain at `src/` level

## Context and Problem Statement
Agent-enforceable boundaries. The 2026-07-14 spec puts application frontend code at `app/src/` top level and browser infrastructure under `src/lib/client/`.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Frontend domain at `src/` level; browser infra under `@client/`; `@utils/` for shared helpers", because Agent-enforceable boundaries.

### Consequences
* Good, because the boundaries are agent-enforceable. The ledger row gives this as the rationale.
* Neutral, because `services/` and `repositories/` stay Worker-only and the spec tells agents not to confuse them with `stores/`.
* Neutral, because `@lib/*` for browser code is deprecated in favour of `@client/*`. The handbook documents the target state and the migration is app implementation.
* Neutral, because code imported from more than one route is promoted out of `pages/`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 6, Decision 7, § DECISIONS.md proposed entries): rebuilt Context and Consequences.
