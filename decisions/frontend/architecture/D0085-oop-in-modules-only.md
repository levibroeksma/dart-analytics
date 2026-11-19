---
id: D0085
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

# OOP in `modules/` only

## Context and Problem Statement
Reusable primitives. The 2026-07-14 spec permits classes only in `src/modules/`. Stores, forms and `.data.ts` files use object factories.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "OOP in `modules/` only; portable UI kit with peer-dep disclosure for Chart", because Reusable primitives.

### Consequences
* Good, because the `modules/ui/` and `components/ui/` kit has no app imports, so its primitives stay reusable. The ledger row gives "Reusable primitives" as the rationale.
* Neutral, because `chart.module.ts` may wrap a declared peer dependency such as Chart.js, and the copy-paste test includes a `package.json` peer-dependency note.
* Neutral, because the initial kit (timer, toast, modal, chart) is documented in handbook 0.1.0 with implementation deferred.
* Neutral, because `modules/game/*.payload.module.ts` files prefer functions, with classes only if justified.

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

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 13, § DECISIONS.md proposed entries; Critique Resolution Log I15): rebuilt Context and Consequences.
* Applied in: `docs/superpowers/plans/2026-09-09-quick-subtract-trivia.md` (keeps `modules/trivia/quick-subtract.module.ts` under `src/modules/` per D85).
