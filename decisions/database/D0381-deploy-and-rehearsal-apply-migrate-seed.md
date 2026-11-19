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
<!-- backfill: pending -->

# Deploy and rehearsal apply migrate → seed → migrate (#378)

## Context and Problem Statement
issue #378. `0020` needs seed `0007` before it can apply on a populated database (`app/DEPLOYMENT.md` §1.3); a single migrate-then-seed pass deadlocks any migration of that shape. The two-pass order is what a human already runs by hand, and what `seed.ts` does internally.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`deploy.yml`'s `migrate` job and `db-rehearsal.yml` run `db:migrate:ci` (failure tolerated, warning emitted), `db:seed:ci`, then `db:migrate:ci` again. The second pass is authoritative: its failure fails the job. `db:status:ci` still confirms nothing is pending.".

### Consequences
a real first-pass failure is retried once after seeding, then fails on the second pass with the same error. Seeds may run against a partially migrated chain; every seed is `ON CONFLICT DO NOTHING` and `seed.ts` already orders its own passes. The alternative (split seed-dependent migrations across two PRs) is not adopted.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-01
