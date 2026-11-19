---
id: D0290
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, schema, migration, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `schema.ts` is the only committed `drizzle-kit introspect` artifact, and the migration chain is authority over its view bodies

## Context and Problem Statement
issues #363 and #352. The dump and `meta/` were frozen ~20 migrations behind — no `activity_configurations`, no `exercise_ruleset_versions`, pre-`0013` view text — so two artifacts in the same folder disagreed about what the schema is, and the next introspect would have diffed against a stale snapshot. Nothing imports them: only `schema.ts` is read, by five repositories and the middleware. Regenerating them instead was rejected because it buys a second copy that can go stale again, and D288 makes regeneration a per-deploy possibility rather than a one-time fix. Separately, `schema.ts`'s own view bodies drifted undetected from 2026-08-21 to 2026-09-16 — `vDartAnalytics` and `vDartLocations` carried the pre-`0023` SQL, missing the owner-scoping `0023` was written to add — because no gate compared them to the chain.

## Decision Drivers
* The introspect dump and `meta/` were about 20 migrations behind, so two artifacts in one folder disagreed about the schema (issue #352).
* `schema.ts`'s view bodies drifted from the migration chain undetected for about three weeks, because no gate compared them (issue #363).
* No session in the authoring environment had database credentials.

## Considered Options
* Delete and gitignore the stale introspect artifacts, keep `schema.ts`, and add a static view-drift test (chosen).
* Regenerate the stale dump and `meta/` (rejected in Context and the commit message).

## Decision Outcome
Chosen option: "`app/src/db/0000_curved_gwen_stacy.sql`, `app/src/db/relations.ts` and `app/src/db/meta/` are deleted and gitignored; `drizzle-kit introspect` still writes them into `out/`, but only `app/src/db/schema.ts` is committed. `app/tests/db/schema-view-drift.test.ts` compares every `pgView(...).as(sql`…`)` body in `schema.ts` to the last `CREATE VIEW` for that view in `database/migrations/`, and asserts the two view sets are identical. The chain is authority: a mismatch is reconciled in `schema.ts`, never in an applied migration. The comparison normalizes case, whitespace, `::type` casts and parentheses, because those are what Postgres rewrites when it echoes a definition back.".

### Consequences
the generator's output is no longer self-contradictory, and `db:introspect` inside `validate:app` can no longer re-commit a stale sibling. The drift gate is static, so it needs no database and runs in `npm test` and CI — which matters, since no session that has touched these views since `0023` had credentials to run a real introspect. Normalizing parentheses away is the cost: a drift that only regroups an existing expression (`a AND (b OR c)` becoming `(a AND b) OR c`) reads as a match. That was chosen over hand-rewriting five bodies into Postgres's echo form, which no one here can verify without a database. The gate compares text, not semantics — it proves `schema.ts` agrees with the chain, never that either agrees with the live database. `relations.ts` was deleted alongside the other two on the repo owner's instruction; it was equally unreferenced and equally stale.

* Good, because the generator's output is no longer self-contradictory, and the drift gate is static, so it needs no database.
* Bad, because normalizing parentheses away lets a drift that only regroups an expression read as a match.
* Neutral, because the gate compares text, not semantics, so it proves `schema.ts` agrees with the chain and nothing about the live database.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/db/schema-view-drift.test.ts` compares each `pgView` body in `schema.ts` to the last `CREATE VIEW` for that view in `database/migrations/`. It also asserts that the two view sets match. It needs no database and runs in `npm test` and CI.

## Pros and Cons of the Options
### Delete the stale artifacts and gate view bodies against the chain
* Good, because the generator's output is no longer self-contradictory, and `db:introspect` cannot re-commit a stale sibling.
* Good, because the drift gate is static and needs no database.
* Bad, because parenthesis normalization can hide a regrouping drift. The source chose it over hand-rewriting five view bodies into Postgres's echo form, which cannot be verified without a database.

### Regenerate the stale artifacts
* Bad, because it buys a second copy that can go stale again, and D288 makes regeneration a per-deploy possibility rather than a one-time fix.

## Evidence / More Information
Decided: 2026-09-17
Referenced by D0391's `Supersedes:` line.

* Commit `5c0c2152` (PR #385, adds the D290 row, `schema-view-drift.test.ts` and the deletions): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/plans/2026-09-26-statistics-phase-1a-database.md` (line 222).
