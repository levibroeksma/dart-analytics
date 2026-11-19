---
id: D0345
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [testing, test]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `schema-view-drift` normalizes Postgres's sole-relation qualifier drop and implicit aggregate alias

## Context and Problem Statement
both rewrites are Postgres's, not drift — `pg_get_viewdef` on the live database returns `0041`'s two views in exactly those shapes, which is what the first real `drizzle-kit introspect` of them put in `schema.ts`. Without the two rules the test fails on a view that matches its migration character for character in every respect that the test exists to check. Scoping the qualifier strip to JOIN-less bodies keeps the one drift class the qualifier carries — "this column now comes from the other joined table" — detectable where it can actually occur; in a single-relation body there is no other table to confuse it with.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/tests/db/schema-view-drift.test.ts`'s `normalize` gains two more of the echo rewrites it already undoes for casts, `= ANY (ARRAY[...])` and CTE alias suffixes: an aggregate subquery's implicit output alias (`count(*)` stored as `count(*) AS count`, `sum(x)` as `sum(x) AS sum`) is removed when the alias only restates its own function, and a body with no `JOIN` has its outermost `FROM` relation's alias qualifier stripped from both sides (`ts.id AS schedule_id` stored as `id AS schedule_id`). The qualifier strip is deliberately conditional on there being no `JOIN`, so a joined view keeps every qualifier.".

### Consequences
the test's tolerated-loss list grows by one entry: in a JOIN-less body a correlated subquery's predicate no longer distinguishes `d.x = ts.id` from `ts.x = d.id`, since the outer alias comes off both. This is the same trade the existing parenthesis strip already accepts. The rules were derived from a live `pg_get_viewdef`, not guessed from the failure text, so a third echo artifact should be confirmed against the database the same way before being normalized away.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
