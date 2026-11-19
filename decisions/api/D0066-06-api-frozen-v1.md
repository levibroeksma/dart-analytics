---
id: D0066
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, contract]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `06-API/` frozen v1

## Context and Problem Statement
Close the API design layer with one coherent, self-consistent frozen contract before frontend work

Before this record, `01` and `02` were still `0.2.0` and carried contradictions with the frozen docs and with the real `app/` scaffold, while `03` used `#`-prefixed aliases.

## Decision Drivers
* The architecture design phase should close, so work can move to the frontend layer (Goal).
* `01` and `02` contradicted the frozen docs and the scaffold, and `statistics/overview.ts` in the folder tree contradicted the statistics deferral (Consistency issues 1-5).

## Considered Options
* Keep the `#`-prefixed aliases written in the frozen `03` and the nested `lib/` layout in `02`.
* Adopt `@`-prefixed aliases matching the scaffold, with `@<area>/types` type-raising barrels, and follow the real top-level layout (chosen).

## Decision Outcome
Chosen option: "`06-API/` frozen v1: `01`/`02` frozen at 1.0.0, `03`→1.1.0; adopted `@`-prefixed aliases + `@<area>/types` type-raising barrels; removed the statistics route folder from the layering tree (statistics stay post-v1) (`03` later 1.2.0/1.3.0 under the freeze-semantics rule, 2026-07-13)", because Close the API design layer with one coherent, self-consistent frozen contract before frontend work.

### Consequences
* Good, because consumers import shallow paths such as `@services/types`, with no deep `@services/a/b/c/type` imports.
* Neutral, because the change is docs only: no `tsconfig.json` alias edits, no folder moves and no `types.ts` barrel files, which belong to the frontend and API implementation phase.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep `#` aliases and the nested layout
* Bad, because `01` and `02` stayed inconsistent with the frozen docs and the real scaffold.

### `@` aliases, type-raising barrels, real layout
* Good, because the `@` convention matches the actual scaffold, for example `@lib/*` and `@components/*`.
* Good, because the type-raising barrels give every consumer a shallow import path wherever the type is defined.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-api-v1-freeze-design.md` (Goal; Decisions taken 1-4; Consistency issues; Non-goals): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-13-api-v1-freeze.md` (Task 5, Step 5): confirmed the D66 ledger row.
