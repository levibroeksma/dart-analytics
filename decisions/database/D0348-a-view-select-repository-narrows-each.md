---
id: D0348
status: accepted
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [database, column, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A view-select repository narrows each non-null column with `nonNull()`, never a blanket `as <Interface>Row[]` cast

## Context and Problem Statement
closes #539. `drizzle-kit introspect` types every view column nullable regardless of the view's own SQL (05-Views/00-Overview.md), so a select against a view is always `{ col: T | null }` against a row interface that promises `{ col: T }` for most of its columns — the blanket cast was the only way past that mismatch, and it silences the *whole* select at once: every column's nullability, and any real type drift, not just the one column that needed narrowing. #538 was exactly that — `day_count`'s NUMERIC-as-string arriving as a `dayCount: number` field went unnoticed for as long as the view existed, caught only by a human reading the SQL. A per-column `nonNull()` keeps the compiler checking each field's shape against the interface (a renamed or retyped view column now fails `tsc`, not silently), and adds a runtime check the blanket cast never had: a column the interface promises is non-null that actually arrives `NULL` now throws immediately, naming the column, instead of forwarding a `null` into code typed to assume it can't happen.

## Decision Drivers
* `drizzle-kit introspect` types every view column nullable, whatever the view's SQL says.
* A blanket `as <Interface>Row[]` cast silences nullability and real type drift for the whole select, as in #538's `day_count` bug.
* A column the interface promises non-null that arrives `NULL` should fail at read time.

## Considered Options
* Narrow each column with `nonNull(value, column)` (chosen).
* Keep the blanket `as <Interface>Row[]` cast (the status quo this record replaces).

## Decision Outcome
Chosen option: "`app/src/repositories/row-helpers.ts` exports `nonNull(value, column)`, which returns `value` unchanged when it is not `null` and throws (naming the column) when it is. `findScheduleRows`/`findScheduleDayRows` (`schedule.repository.ts`), `findRoutineExecutionRows`/`findExerciseTemplateCatalog` (`routine.repository.ts`), `findSessionSummaries`/`findVisitFacts`/`findLegFacts` (`statistics.repository.ts`), and `findRoutineTemplateSteps` (`training-session.repository.ts`) now build their return rows field-by-field: a column the row interface declares non-null is wrapped in `nonNull(row.field, "snake_case_column")`; a column the interface already declares nullable (`string | null`, `unknown`) is passed through as the raw select value, unwrapped. None of the eight selects casts its whole result with `as <Interface>Row[]` any longer.".

### Consequences
`app/src/repositories/statistics.repository.ts`'s `findX01CheckoutDarts` (`v_x01_checkout_darts`) still ends in a blanket `as X01CheckoutDartRow[]` — a ninth site doing the identical thing, missed by this issue's own discovery grep (`X01CheckoutDartRow` starts with a digit, which the grep pattern's `[A-Za-z]+` prefix did not match) and out of this decision's scope; it is filed separately as discovered work rather than fixed here. `findScheduleIdsUsingRoutine` (`schedule.repository.ts`) keeps its narrower `as { scheduleId: string }[]` cast over a single projected field, a different and smaller risk than a full row-interface cast, and is unchanged. A future repository added against a view inherits the convention this decision states: narrow per column with `nonNull()`, never re-adopt the blanket cast.

* Good, because the compiler keeps checking each field against the interface, so a renamed or retyped view column fails `tsc`.
* Good, because an unexpected `NULL` throws and names the column instead of reaching code typed to assume it cannot happen.
* Bad, because `findX01CheckoutDarts` still ended in a blanket cast, a ninth site missed by the issue's discovery grep and filed separately (#545 per the commit message).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/repositories/row-helpers.test.ts` tests `nonNull`, and the commit adds repository tests for the schedule, routine, statistics and training-session repositories.

## Pros and Cons of the Options
### Per-column `nonNull()`
* Good, because it keeps per-field compiler checking and adds a runtime null check (Context).

### Blanket `as <Interface>Row[]` cast
* Bad, because it silences nullability and real type drift for the whole select at once (Context).

## Evidence / More Information
Decided: 2026-09-21

* Commit `1e9474b6` (2026-09-21, subject cites #539; adds the D348 row, `row-helpers.ts` and the tests): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
