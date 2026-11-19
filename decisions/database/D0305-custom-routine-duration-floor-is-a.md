---
id: D0305
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, migration, constraint, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Custom-routine duration floor is a deferred constraint trigger scoped to user-owned routines

## Context and Problem Statement
A universal 30-minute floor would invalidate the seeded 5-minute "Warm-Up" system routine (`database/seeds/0015_warm_up_routine.sql`), used both standalone and as Balanced Training's own first step. Scoping the floor to non-system routines preserves existing seed data with no special case in application code. Deferring the check to commit lets the routine builder's save (delete-all-steps, reinsert-new-order) validate once, not after every intermediate statement.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The planned 30-60 minute duration bound for player-authored routines (`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.2-3.3) is enforced by a deferred constraint trigger on `routine_steps`, evaluated at transaction commit, checking the step-duration sum only when the parent `routine_templates.is_system_template = FALSE`. No `CHECK` constraint is used — a per-row `CHECK` cannot express a cross-row aggregate.".

### Consequences
unbuilt — no migration exists yet; this records the design so Phase 1's implementation doesn't relitigate it. The existing ≤60 minute ceiling (`09-training-routines.md` §7) is unchanged and continues to apply to every routine, system or user.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
