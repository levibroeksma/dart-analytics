---
id: D0082
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/architecture, layering]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Alpine-native layering

## Context and Problem Statement
Testable modules; clear HTTP ownership. The 2026-07-14 spec states that the frontend does not mirror `Controller → Service → Repository`.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Mirror `Controller → Service → Repository` in the frontend. The spec rejects this and forbids a frontend `controllers/` folder paralleling `pages/api/`.
* Alpine-native layering: Astro page, `Alpine.data` component, store or form, module, then `@client/api` (chosen).

## Decision Outcome
Chosen option: "Alpine-native layering; pages/forms/stores orchestrate `@client/api`; modules never fetch", because Testable modules; clear HTTP ownership.

### Consequences
* Good, because modules never fetch, which keeps them testable. The ledger row gives "Testable modules; clear HTTP ownership" as the rationale.
* Neutral, because pages, `*.data.ts` files and forms orchestrate `@client/api`. Stores call it for recovery bootstrap workflows only. `@client/api` never imports stores, forms, modules or pages (Decision 10).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Mirror Controller, Service, Repository in the frontend
Rationale unknown — no source found. The spec rejects it and forbids a frontend `controllers/` folder without giving reasons.

### Alpine-native layering
* Good, because modules stay testable and HTTP ownership is clear.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 3, Decision 10, § DECISIONS.md proposed entries): rebuilt Context, Considered Options, Consequences and Pros and Cons.
