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
<!-- backfill: pending -->

# The duration-bound trigger function picks its row by `TG_OP`, never by `COALESCE(NEW, OLD)`; `0038` corrected in place

## Context and Problem Statement
in a PL/pgSQL row trigger `NEW` is *unassigned* on DELETE — structurally absent, not NULL-valued — so reading it raises `record "new" is not assigned yet` (SQLSTATE 42804) before `COALESCE` can reach its second argument. Every `PUT /api/routines/:id` (`replaceRoutine` deletes the routine's steps inside its transaction) and every `DELETE /api/routines/:id` (cascade to `routine_steps`) would therefore have failed at COMMIT with a 42804 that `isRoutineDurationViolation` does not match — it matches `23514` alone (D334) — rethrowing to a 500 with the routine unchanged. Check 8 exists to prove exactly that delete path and could not report it: a 42804 escaped its `WHEN check_violation` handler and aborted the whole script instead of recording a FAIL. Re-checking both parents on a re-parenting UPDATE closes the same class of hole from the other side: the old parent's total changes too, and nothing else would look at it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`fn_routine_templates_duration_bounds()` (migration `0038`) resolves the routine to bound by branching on `TG_OP` and `TG_TABLE_NAME` — `OLD.routine_template_id` on a `routine_steps` DELETE, `NEW.routine_template_id` on INSERT, both parents on an UPDATE that re-parents a step, `NEW.id`/`OLD.id` on `routine_templates` — replacing `COALESCE(NEW.routine_template_id, OLD.routine_template_id)`. `0038` was edited in place rather than corrected by a `0039`: it is committed but applied to no database (D336, D193), and the "never modify applied migrations" invariant covers `0001`–`0037`. `database/verification/0038_custom_routine_checks.sql`'s check 8 (the delete path) now catches `OTHERS`, not only `check_violation`. Both couplings the trigger carries are pinned from TypeScript by the new `app/tests/db/routine-duration-bound-drift.test.ts`: the `30`/`60` literals against `routine-duration.module.ts`'s constants, and the raised `CONSTRAINT` name against `routine.service.ts`'s `DURATION_BOUND_TRIGGER`.".

### Consequences
D334's Consequences said no test could catch a drift in the raised `CONSTRAINT` literal short of exercising a live Postgres violation; that is now narrower — `routine-duration-bound-drift.test.ts` fails on a rename of the literal or a change to the `30`/`60` bound on either side. It still cannot prove the trigger fires, that `NEW`/`OLD` are read correctly, or that the bound is enforced at all: only `database/verification/0038_custom_routine_checks.sql` run against a live database can, and `0038` is still applied to no database (D193, D336). A future trigger added to this chain inherits the rule this one got wrong — a row trigger that handles more than one `TG_OP` must select `NEW` or `OLD` per operation, never by `COALESCE`.

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
