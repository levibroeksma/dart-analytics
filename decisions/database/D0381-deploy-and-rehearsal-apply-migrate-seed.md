---
id: D0381
status: accepted
date: 2026-10-01
origin: contemporaneous
original-date:
tags: [database, migration, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Deploy and rehearsal apply migrate → seed → migrate (#378)

## Context and Problem Statement
issue #378. `0020` needs seed `0007` before it can apply on a populated database (`app/DEPLOYMENT.md` §1.3); a single migrate-then-seed pass deadlocks any migration of that shape. The two-pass order is what a human already runs by hand, and what `seed.ts` does internally.

## Decision Drivers
* `0020` needs seed `0007` before it can apply on a populated database.
* A single migrate-then-seed pass deadlocks any migration of that shape.
* The two-pass order is what a human already runs by hand.

## Considered Options
* One migrate pass, then seed.
* Split seed-dependent migrations across two PRs (not adopted).
* Migrate, seed, then migrate again, with the second pass authoritative (chosen).

## Decision Outcome
Chosen option: "`deploy.yml`'s `migrate` job and `db-rehearsal.yml` run `db:migrate:ci` (failure tolerated, warning emitted), `db:seed:ci`, then `db:migrate:ci` again. The second pass is authoritative: its failure fails the job. `db:status:ci` still confirms nothing is pending.".

### Consequences
a real first-pass failure is retried once after seeding, then fails on the second pass with the same error. Seeds may run against a partially migrated chain; every seed is `ON CONFLICT DO NOTHING` and `seed.ts` already orders its own passes. The alternative (split seed-dependent migrations across two PRs) is not adopted.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The second `db:migrate:ci` pass fails the job on error, and `db:status:ci` then confirms nothing is pending, in `.github/workflows/deploy.yml` and `.github/workflows/db-rehearsal.yml`.

## Pros and Cons of the Options
### One migrate pass, then seed
* Bad, because it deadlocks any migration that needs a seed first.

### Split seed-dependent migrations across two PRs
The decision's Consequences record that this alternative is not adopted.

### Migrate, seed, migrate
* Good, because the order matches the manual procedure in `app/DEPLOYMENT.md` §1.3.
* Bad, because a real first-pass failure is retried once after seeding, then fails on the second pass with the same error.
* Bad, because seeds may run against a partially migrated chain; every seed is `ON CONFLICT DO NOTHING`.

## Evidence / More Information
Decided: 2026-10-01

* Commit `a980da6e` (2026-10-01, issue #378; `deploy.yml`, `db-rehearsal.yml`, `app/DEPLOYMENT.md`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
