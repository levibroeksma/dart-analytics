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
<!-- backfill: pending -->

# SQL that a migration can only fail on gets a real-database run, not a review

## Context and Problem Statement
migration `0018` shipped with `MOD(DEGREES(...) + 360, 360)` and could never have applied — PostgreSQL has no `mod(double precision, integer)`, and the double→numeric cast is assignment-only so it is not considered during function resolution. Nothing caught it: `tsc` and the whole Vitest suite are blind to SQL, the structural gates lint file shape rather than semantics, and the plan's own verification was deferred to an operator checklist. The bug was found only by running the chain against a throwaway PostgreSQL 16 cluster.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`v_dart_locations`' angle expression casts to `NUMERIC` before `MOD()` (`MOD(DEGREES(ATAN2(x, -y))::NUMERIC + 360, 360)`), and `app/tests/db/migration-numeric-typing.test.ts` fails any migration whose `MOD()` argument reaches a double-precision function without an intervening `::NUMERIC`. Both derived columns are therefore `NUMERIC`, which Drizzle/node-postgres surface as strings.".

### Consequences
`0018` is corrected in place rather than superseded — it had never applied to any database, so no environment carries the broken definition and the "never modify applied migrations" invariant (`0001`–`0016`) is untouched. Operator checklist steps 1 and 3–5 are now verified against a real cluster and marked as such; only the Neon-specific re-run remains. The read layer must parse `location_x`, `location_y`, `radius_mm` and `angle_degrees` from strings before handing them to `missMargin`, which takes numbers. A migration that only a live database can reject should be run against one before the branch claims verification.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-08
