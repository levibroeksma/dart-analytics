---
id: D0334
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [database, migration, constraint]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The duration-bound trigger raises one constraint name regardless of which trigger fired, and the service matches on it literally

## Context and Problem Statement
a per-trigger `CONSTRAINT` name would have made the service check two strings for one logical failure, for no benefit — both triggers enforce the identical 30–60 minute rule through the identical function, so collapsing the raised identity onto one literal name is the simpler contract. Recording it here is what D336 stopped short of: D336 names both trigger objects but never states that only one of the two names is ever actually raised, or that the service's error classification depends on that being true.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`fn_routine_templates_duration_bounds()` (migration `0038`) is the single function body behind both `trg_routine_steps_duration_bounds` (on `routine_steps`) and `trg_routine_templates_duration_bounds` (on `routine_templates`); its `RAISE EXCEPTION` always sets `CONSTRAINT = 'trg_routine_templates_duration_bounds'` literally, whichever of the two triggers invoked it. `app/src/services/routine.service.ts`'s `isRoutineDurationViolation` hardcodes that exact string as its `DURATION_BOUND_TRIGGER` constant and matches a caught error's `constraint`/`message` against it alone to map the failure to `VALIDATION_FAILED` — it never checks for `trg_routine_steps_duration_bounds`, and does not need to.".

### Consequences
this is a coupling a future migration can break silently. Renaming either `CREATE CONSTRAINT TRIGGER`, splitting `fn_routine_templates_duration_bounds()` into two functions with their own `RAISE`, or dropping the `CONSTRAINT =` clause would not fail any test that doesn't exercise a live Postgres violation (`isRoutineDurationViolation`'s own unit tests use fixture errors, not a real trigger) and would turn every over/under-duration write into an unhandled `INTERNAL_ERROR` (500) instead of `VALIDATION_FAILED`, with nothing in the ledger to flag it before that migration ships. A future change to this trigger must keep the `CONSTRAINT = 'trg_routine_templates_duration_bounds'` literal, or update `routine.service.ts`'s `DURATION_BOUND_TRIGGER` in the same commit.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
