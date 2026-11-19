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

# Custom-routine duration floor is a deferred constraint trigger scoped to user-owned routines

## Context and Problem Statement
A universal 30-minute floor would invalidate the seeded 5-minute "Warm-Up" system routine (`database/seeds/0015_warm_up_routine.sql`), used both standalone and as Balanced Training's own first step. Scoping the floor to non-system routines preserves existing seed data with no special case in application code. Deferring the check to commit lets the routine builder's save (delete-all-steps, reinsert-new-order) validate once, not after every intermediate statement.

## Decision Drivers
* The seeded 5-minute "Warm-Up" system routine must stay valid, so the floor cannot be universal.
* The routine builder's save deletes all steps and reinserts them, so validation should run once at commit.
* A per-row `CHECK` cannot express a cross-row aggregate.

## Considered Options
* A deferred constraint trigger on `routine_steps`, scoped to non-system routines (chosen).
* A universal 30-minute floor (rejected in Context: it invalidates the seeded Warm-Up routine).
* A `CHECK` constraint (rejected in the Decision Outcome: a per-row `CHECK` cannot express a cross-row aggregate).

## Decision Outcome
Chosen option: "The planned 30-60 minute duration bound for player-authored routines (`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.2-3.3) is enforced by a deferred constraint trigger on `routine_steps`, evaluated at transaction commit, checking the step-duration sum only when the parent `routine_templates.is_system_template = FALSE`. No `CHECK` constraint is used — a per-row `CHECK` cannot express a cross-row aggregate.".

### Consequences
unbuilt — no migration exists yet; this records the design so Phase 1's implementation doesn't relitigate it. The existing ≤60 minute ceiling (`09-training-routines.md` §7) is unchanged and continues to apply to every routine, system or user.

* Good, because scoping the floor to non-system routines keeps the seeded Warm-Up data valid with no special case in application code.
* Good, because deferring the check to commit validates the builder's save once, not after every intermediate statement.
* Neutral, because the source records the design as unbuilt.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Deferred constraint trigger scoped to user-owned routines
* Good, because it preserves the seeded system routines and lets the builder's save validate once at commit.

### Universal 30-minute floor
* Bad, because it invalidates the 5-minute Warm-Up system routine, used standalone and as Balanced Training's first step.

### `CHECK` constraint
* Bad, because a per-row `CHECK` cannot express a cross-row aggregate.

## Evidence / More Information
Decided: 2026-09-17

* `docs/superpowers/plans/2026-09-17-configurable-training-routines-doc-integration.md` (Task 1, Step 1): drafted the decision block; rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` (§ 3.2): the floor rule and the Warm-Up exemption reason.
* Commit `a34042d6` (PR #417, adds the D305 row).
* Applied in: `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` (§ 3.2), `docs/superpowers/plans/2026-09-18-custom-routine-builder.md`.
