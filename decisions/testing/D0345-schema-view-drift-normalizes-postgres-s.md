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

# `schema-view-drift` normalizes Postgres's sole-relation qualifier drop and implicit aggregate alias

## Context and Problem Statement
both rewrites are Postgres's, not drift — `pg_get_viewdef` on the live database returns `0041`'s two views in exactly those shapes, which is what the first real `drizzle-kit introspect` of them put in `schema.ts`. Without the two rules the test fails on a view that matches its migration character for character in every respect that the test exists to check. Scoping the qualifier strip to JOIN-less bodies keeps the one drift class the qualifier carries — "this column now comes from the other joined table" — detectable where it can actually occur; in a single-relation body there is no other table to confuse it with.

## Decision Drivers
* The drift test must not fail on a view that matches its migration in every respect the test checks.
* The drift class a qualifier carries ("this column now comes from the other joined table") stays detectable where it can occur.

## Considered Options
* Normalize the aggregate alias, and strip the qualifier only from JOIN-less bodies (chosen).
* Strip the qualifier from every body.
* Add no normalization, so the test fails on views that match their migration.

## Decision Outcome
Chosen option: "`app/tests/db/schema-view-drift.test.ts`'s `normalize` gains two more of the echo rewrites it already undoes for casts, `= ANY (ARRAY[...])` and CTE alias suffixes: an aggregate subquery's implicit output alias (`count(*)` stored as `count(*) AS count`, `sum(x)` as `sum(x) AS sum`) is removed when the alias only restates its own function, and a body with no `JOIN` has its outermost `FROM` relation's alias qualifier stripped from both sides (`ts.id AS schedule_id` stored as `id AS schedule_id`). The qualifier strip is deliberately conditional on there being no `JOIN`, so a joined view keeps every qualifier.".

### Consequences
the test's tolerated-loss list grows by one entry: in a JOIN-less body a correlated subquery's predicate no longer distinguishes `d.x = ts.id` from `ts.x = d.id`, since the outer alias comes off both. This is the same trade the existing parenthesis strip already accepts. The rules were derived from a live `pg_get_viewdef`, not guessed from the failure text, so a third echo artifact should be confirmed against the database the same way before being normalized away.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The 2 rules derive from a live `pg_get_viewdef`, which returns `0041`'s views in the normalized shapes. A third echo artifact is confirmed against the database the same way before it is normalized away.

## Pros and Cons of the Options
### Normalize, with the qualifier strip limited to JOIN-less bodies
* Good, because a joined view keeps every qualifier, so a column moving to the other table stays detectable.
* Bad, because in a JOIN-less body a correlated subquery's predicate no longer distinguishes `d.x = ts.id` from `ts.x = d.id`.

### Strip the qualifier from every body
* Bad, because it loses detection of a column now coming from the other joined table.

### No normalization
* Bad, because the test fails on `0041`'s views, which match the migration.

## Evidence / More Information
Decided: 2026-09-20

* Commit `1b1104bd` (2026-09-20; message and the D345 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
