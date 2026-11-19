---
id: D0192
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [database, migration, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# SQL that a migration can only fail on gets a real-database run, not a review

## Context and Problem Statement
migration `0018` shipped with `MOD(DEGREES(...) + 360, 360)` and could never have applied — PostgreSQL has no `mod(double precision, integer)`, and the double→numeric cast is assignment-only so it is not considered during function resolution. Nothing caught it: `tsc` and the whole Vitest suite are blind to SQL, the structural gates lint file shape rather than semantics, and the plan's own verification was deferred to an operator checklist. The bug was found only by running the chain against a throwaway PostgreSQL 16 cluster.

## Decision Drivers
* Nothing caught the defect: `tsc` and the Vitest suite are blind to SQL, the structural gates lint file shape rather than semantics, and the plan's verification was deferred to an operator checklist.
* Running the migration chain against a throwaway PostgreSQL 16 cluster found it.

## Considered Options
* Cast to `NUMERIC` before `MOD()`, add a test that fails an uncast `MOD()` argument, and correct `0018` in place (chosen).
* Supersede `0018` with a new migration. The commit's Consequences explain why correcting in place works: `0018` had never applied to any database.

## Decision Outcome
Chosen option: "`v_dart_locations`' angle expression casts to `NUMERIC` before `MOD()` (`MOD(DEGREES(ATAN2(x, -y))::NUMERIC + 360, 360)`), and `app/tests/db/migration-numeric-typing.test.ts` fails any migration whose `MOD()` argument reaches a double-precision function without an intervening `::NUMERIC`. Both derived columns are therefore `NUMERIC`, which Drizzle/node-postgres surface as strings.".

### Consequences
`0018` is corrected in place rather than superseded — it had never applied to any database, so no environment carries the broken definition and the "never modify applied migrations" invariant (`0001`–`0016`) is untouched. Operator checklist steps 1 and 3–5 are now verified against a real cluster and marked as such; only the Neon-specific re-run remains. The read layer must parse `location_x`, `location_y`, `radius_mm` and `angle_degrees` from strings before handing them to `missMargin`, which takes numbers. A migration that only a live database can reject should be run against one before the branch claims verification.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/db/migration-numeric-typing.test.ts` fails any migration whose `MOD()` argument reaches a double-precision function without an intervening `::NUMERIC`. The Consequences state that a migration only a live database can reject should be run against one before the branch claims verification.

## Pros and Cons of the Options
Correct `0018` in place:

* Good, because no environment carries the broken definition, so the "never modify applied migrations" invariant is untouched.

Supersede `0018` with a new migration:

Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-08

* Commit `ba175815` (PR #73, 2026-08-08, "Visual board input: capture core (plan 1)"): adds the decision block in `decisions/database.md`; rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation. Context and Consequences come from the same block.
* `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md` (Task 13): holds the `MOD(DEGREES(ATAN2(...)) + 360, 360)` SQL without a cast that the Context describes.
* Applied in: `docs/superpowers/specs/2026-08-26-db-verification-script-drift-design.md`, `docs/superpowers/plans/2026-08-26-db-verification-script-drift.md`, `docs/superpowers/plans/2026-09-05-double-out-checkout-accuracy.md`, `docs/superpowers/plans/2026-09-06-general-statistics-views.md`, `docs/superpowers/plans/2026-08-15-profile-display-darts-config.md` (anti-vacuity guard "per D192").
