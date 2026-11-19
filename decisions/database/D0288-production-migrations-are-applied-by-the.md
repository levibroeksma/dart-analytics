---
id: D0288
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, Neon, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Production migrations are applied by the deploy pipeline, behind a rehearsal on a Neon branch cut from production

## Context and Problem Statement
issue #293. `deploy.yml` shipped the Worker on every merge and never touched the database, so a merged migration produced a Worker expecting a schema production did not have — measured once already, when `0024`–`0026` sat unapplied and `GET /api/statistics/overview` returned `INTERNAL_ERROR` for `relation "v_..." does not exist`. The manual step (`npm run env:prod` then `db:migrate:prod`) was enforced by nothing, and CI was green either way. Automating the apply without a rehearsal would only have made that failure faster, which is why the rehearsal is the gate rather than an advisory job.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.github/workflows/deploy.yml` runs `quality → rehearse → migrate → deploy` inside the existing `deploy-production` concurrency group. `rehearse` (`.github/workflows/db-rehearsal.yml`, also triggered on any PR touching `database/migrations/**`, `database/seeds/**`, `database/verification/**`, the seed/verify runners or `app/package.json`) creates a throwaway Neon branch from `main`, applies migrations and seeds, confirms nothing is left pending, and deletes the branch in an `always()` step. It deliberately does not run `db:verify`. `migrate` then applies the same chain to production and re-runs `db:status` to prove nothing is left pending. Four `:ci` script variants (`db:status:ci`, `db:migrate:ci`, `db:seed:ci`, `db:verify:ci`) read `DATABASE_URL` from the environment rather than an `.env` file and pass `--no-dump-schema`, since CI has no `pg_dump`; the `:prod` variants are untouched. Two secrets are required — `DATABASE_URL` on the `production` environment and a repository-level `NEON_API_KEY`; the Neon project id is read from committed `app/.neon` and is not a secret.".

### Consequences
the ephemeral branch is a real rehearsal against production's data shape, not a simulation against an empty container — a migration that fails only on existing rows fails in `rehearse`, before production is touched. It costs one Neon branch and one short-lived compute per deploy, and it needs an API key CI did not previously hold; a failed delete leaves a branch behind and warns rather than failing the run, so a leaked `ci-rehearsal-*` branch is possible and is cheap to remove by hand. Seeds run on every deploy: every seed is `ON CONFLICT DO NOTHING` and the runner applies them twice by design, so this is a no-op once they are in. `db:verify` is excluded from the rehearsal, which the first real run forced and justified: the suite asserts on live data as well as on its own fixtures, so against production's rows it reports data state rather than whether the change applied, and it cannot currently pass at all — six fixtures predate `0031`'s NOT NULL (#383), 53 of 404 sessions are undeclared against the capability table (#384), and `0007`'s VALUES lists are two ruleset versions stale (#304). A gate that cannot pass is not a gate; making it non-blocking instead was rejected for D186's reason, that a permanently-red signal is one nobody reads. It returns to the rehearsal when those three are resolved. The same first run also exposed that seed `0002` had been unappliable since `0032` promoted `exercise_templates.exercise_type_id` to NOT NULL — fixed in this change by joining both of its inserts to the rows they depend on, since NOT NULL is checked before `ON CONFLICT` is consulted and an already-seeded database could not re-run the file either. A mid-way migration failure blocks the Worker deploy and leaves production partly migrated: that is deliberate, since shipping a Worker onto a half-applied schema is the worse of the two, and the rehearsal exists to make it unlikely. Drizzle artifact regeneration (issue #352) is now unblocked but is not part of this change.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
