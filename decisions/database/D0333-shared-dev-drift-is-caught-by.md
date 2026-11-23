---
id: D0333
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [database, schema, migration, view, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Shared `dev` drift is caught by comparing applied migrations and live views to the chain, not by trusting `dbmate status`

## Context and Problem Statement
issue #503. `dev` is one database shared by every task branch (D24), while migrations live per git branch, so migrating on a branch applies that branch's schema to everyone and switching away does not undo it. On 2026-09-19 `dev` carried `0038` from the never-pushed branch `fix/x01-checkout-percentage` — `v_double_out_checkout_darts` dropped, `v_x01_checkout_darts` created — and `npm run db:status` still reported `Applied: 37 / Pending: 0`. That is not a dbmate bug: dbmate enumerates the migration *files* and prints each one's applied flag, so a `schema_migrations` row with no file produces no line at all. The consequence is not cosmetic. `validate:app` runs `db:introspect` one step later, which regenerates `app/src/db/schema.ts` from whatever `dev` happens to be; the regenerated file dropped `vDoubleOutCheckoutDarts`, which `app/src/repositories/statistics.repository.ts:103` reads, and the suite still passed 4538/4538 because it mocks the query builder. The gate is positioned before introspect for exactly that reason — after it, the wrong schema is already in the tree and only a reverted file separates it from a commit. The view comparison is carried alongside the version comparison because DDL run by hand leaves no `schema_migrations` row, so the version check alone cannot see it; #503's own hypothesis was that this had happened, and nothing in the repo could have confirmed or refuted it.

## Decision Drivers
* `dev` is shared by every task branch while migrations live per branch, so one branch's migration changes the schema for all.
* `npm run db:status` reported `Applied: 37 / Pending: 0` while `dev` held an applied version with no migration file.
* A drifted database must not be introspected into `app/src/db/schema.ts`, so the gate has to run before `db:introspect`.
* DDL run by hand leaves no `schema_migrations` row, so a version comparison alone cannot see it.

## Considered Options
* Add `db:drift`, comparing `schema_migrations` to the files in both directions and live views to the replayed chain (chosen).
* Keep trusting `dbmate status` (the status quo that missed the drift).

## Decision Outcome
Chosen option: "`app/scripts/check-migration-drift.ts` (`npm run db:drift`) compares `schema_migrations` to `database/migrations/` in both directions, and the live `v_*` views to the set the chain's `migrate:up` regions leave behind, replayed in migration order. It runs inside `validate:app` between `db:migrate` and `db:introspect`. Neon `dev` was reconciled by rolling migration `0038` back — the mechanism that applied it, run in reverse — not by adding a migration.".

### Consequences
`db:drift` requires `DATABASE_URL`, so it is a local gate — CI's `quality` job has no database and does not run it; the Neon-branch rehearsal (D288) covers the chain's applicability to production instead. A task branch that adds a migration now fails `db:drift` for every *other* branch until it lands or is rolled back, which is the signal, not a defect — but it makes an unlanded migration's cost visible where it was previously free. Rolling `0038` back means `fix/x01-checkout-percentage` must re-run `npm run db:migrate` when that work resumes; its `migrate:down` restores `0036`'s definition byte-identically, so nothing was lost. View *bodies* stay out of scope: `app/tests/db/schema-view-drift.test.ts` compares bodies in `schema.ts` to the migrations (D290), and nothing compares live bodies to either — a view edited in place still passes. Tables, columns, indexes and constraints are equally uncovered and still surface only as an introspect diff. Whether production carries the same drift was not established: `db:status:prod` was refused by this environment, and the inference that it is clean rests only on `0038` never having merged.

* Bad, because `db:drift` requires `DATABASE_URL`, so it is a local gate that CI's `quality` job does not run.
* Bad, because a task branch that adds a migration fails `db:drift` for every other branch until it lands or rolls back. The source calls this the signal, not a defect.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`npm run db:drift` (`app/scripts/check-migration-drift.ts`, tested in `app/tests/scripts/check-migration-drift.test.ts`) runs inside `validate:app` between `db:migrate` and `db:introspect`.

## Pros and Cons of the Options
### `db:drift` comparing applied migrations and live views to the chain
* Good, because it catches an applied version with no file and a live view set that differs from the chain, before introspect regenerates `schema.ts`.
* Bad, because it leaves view bodies, tables, columns, indexes and constraints uncovered (Consequences).

### Trust `dbmate status`
* Bad, because dbmate enumerates migration files, so an applied version with no file produces no output (Context, commit message).

## Evidence / More Information
Decided: 2026-09-19

* Commit `975f4f8f` (2026-09-19, subject cites #503; adds the D333 row and `db:drift`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
