---
id: D0335
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

# The duration-bound trigger function picks its row by `TG_OP`, never by `COALESCE(NEW, OLD)`; `0038` corrected in place

## Context and Problem Statement
in a PL/pgSQL row trigger `NEW` is *unassigned* on DELETE — structurally absent, not NULL-valued — so reading it raises `record "new" is not assigned yet` (SQLSTATE 42804) before `COALESCE` can reach its second argument. Every `PUT /api/routines/:id` (`replaceRoutine` deletes the routine's steps inside its transaction) and every `DELETE /api/routines/:id` (cascade to `routine_steps`) would therefore have failed at COMMIT with a 42804 that `isRoutineDurationViolation` does not match — it matches `23514` alone (D334) — rethrowing to a 500 with the routine unchanged. Check 8 exists to prove exactly that delete path and could not report it: a 42804 escaped its `WHEN check_violation` handler and aborted the whole script instead of recording a FAIL. Re-checking both parents on a re-parenting UPDATE closes the same class of hole from the other side: the old parent's total changes too, and nothing else would look at it.

## Decision Drivers
* `NEW` is unassigned on DELETE, so `COALESCE(NEW.routine_template_id, OLD.routine_template_id)` raised SQLSTATE 42804 before reaching `OLD`.
* `PUT /api/routines/:id` and `DELETE /api/routines/:id` would have failed at COMMIT with a 500, because `isRoutineDurationViolation` matches `23514` alone.
* Check 8 of the verification script could not report the failure.

## Considered Options
* Branch on `TG_OP` and `TG_TABLE_NAME` and edit `0038` in place (chosen).
* Keep `COALESCE(NEW, OLD)` (the broken form this record replaces).
* Correct the function by a new `0039` migration (rejected in the Decision Outcome: `0038` is applied to no database, so it can be edited in place).

## Decision Outcome
Chosen option: "`fn_routine_templates_duration_bounds()` (migration `0038`) resolves the routine to bound by branching on `TG_OP` and `TG_TABLE_NAME` — `OLD.routine_template_id` on a `routine_steps` DELETE, `NEW.routine_template_id` on INSERT, both parents on an UPDATE that re-parents a step, `NEW.id`/`OLD.id` on `routine_templates` — replacing `COALESCE(NEW.routine_template_id, OLD.routine_template_id)`. `0038` was edited in place rather than corrected by a `0039`: it is committed but applied to no database (D336, D193), and the "never modify applied migrations" invariant covers `0001`–`0037`. `database/verification/0038_custom_routine_checks.sql`'s check 8 (the delete path) now catches `OTHERS`, not only `check_violation`. Both couplings the trigger carries are pinned from TypeScript by the new `app/tests/db/routine-duration-bound-drift.test.ts`: the `30`/`60` literals against `routine-duration.module.ts`'s constants, and the raised `CONSTRAINT` name against `routine.service.ts`'s `DURATION_BOUND_TRIGGER`.".

### Consequences
D334's Consequences said no test could catch a drift in the raised `CONSTRAINT` literal short of exercising a live Postgres violation; that is now narrower — `routine-duration-bound-drift.test.ts` fails on a rename of the literal or a change to the `30`/`60` bound on either side. It still cannot prove the trigger fires, that `NEW`/`OLD` are read correctly, or that the bound is enforced at all: only `database/verification/0038_custom_routine_checks.sql` run against a live database can, and `0038` is still applied to no database (D193, D336). A future trigger added to this chain inherits the rule this one got wrong — a row trigger that handles more than one `TG_OP` must select `NEW` or `OLD` per operation, never by `COALESCE`.

* Good, because `routine-duration-bound-drift.test.ts` now fails on a rename of the raised `CONSTRAINT` literal or a change to the `30`/`60` bound on either side.
* Bad, because no unit test proves the trigger fires or reads `NEW`/`OLD` correctly. Only the verification script run against a live database can, and `0038` is applied to none.
* Neutral, because a future row trigger that handles several `TG_OP` values must select `NEW` or `OLD` per operation, never by `COALESCE`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/db/routine-duration-bound-drift.test.ts` pins the `30`/`60` literals and the raised `CONSTRAINT` name. Check 8 of `database/verification/0038_custom_routine_checks.sql` covers the delete path and now catches any error, not only `check_violation`.

## Pros and Cons of the Options
### Branch on `TG_OP` and `TG_TABLE_NAME`
* Good, because it reads `OLD` on DELETE without touching the unassigned `NEW`.
* Good, because a re-parenting UPDATE checks both parents (Context).

### `COALESCE(NEW, OLD)`
* Bad, because `NEW` is unassigned on DELETE, so it raises 42804 and every routine replace or delete fails with a 500 (Context).

### New `0039` migration
* Neutral, because the Decision Outcome edits `0038` in place instead, since `0038` is applied to no database.

## Evidence / More Information
Decided: 2026-09-19

* Commit `d53bd9d1` (2026-09-19; adds the D335 row, the in-place `0038` fix and the drift test): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
