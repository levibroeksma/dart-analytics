---
id: D0025
status: accepted
date: 2026-07-09
origin: contemporaneous
original-date:
tags: [database]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `npx fallow` added to the standard `app/` validation sequence

## Context and Problem Statement
Catch stale types before completion

## Decision Drivers
* The ledger row states the driver as catching stale types before completion. The spec's validation command comment reads "detect stale types/usages".

## Considered Options
* Add `npx fallow` to the standard `app/` validation sequence (chosen).
Rationale unknown — no source found for any other option.

## Decision Outcome
Chosen option: "`npx fallow` added to the standard `app/` validation sequence", because Catch stale types before completion.

### Consequences
* Good, because stale types and usages surface before a task is called complete.
* Neutral, because the sequence in the spec is `db:status`, `db:migrate`, `drizzle-kit introspect`, `npx fallow`, `astro check`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan adds `npx fallow` to every validation command block it updates and requires that fallow exits 0 (`docs/superpowers/plans/2026-07-09-neon-db-integration-implementation.md`, Task 7 and Task 8).

## Pros and Cons of the Options
Adding `npx fallow` to the validation sequence:

* Good, because it catches stale types and usages before completion.

## Evidence / More Information
Decided: 2026-07-09

* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (§ 5 "Local development"; § 6 "Validation commands"): rebuilt Decision Drivers, Considered Options and Consequences.
* `docs/superpowers/plans/2026-07-09-neon-db-integration-implementation.md` (Task 7 Step 1; Task 8 success criteria): rebuilt Confirmation.
* Commit `8b23f90e` (2026-07-11; `architecture/DECISIONS.md` row D25): adds the decision row; its rationale feeds Pros and Cons.
* `docs/superpowers/specs/2026-07-09-validation-blockers-design.md` (§ 2) and its plan: clear the fallow violations that blocked `validate:app`. They apply the rule and do not originate it.
