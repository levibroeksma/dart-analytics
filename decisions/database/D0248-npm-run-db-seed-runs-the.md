---
id: D0248
status: accepted
date: 2026-08-29
origin: contemporaneous
original-date:
tags: [database, migration, table, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `npm run db:seed` runs the full seed list twice, not once

## Context and Problem Statement
`seeds/0007_ruleset_version_capabilities.sql` is a running ledger — every new ruleset version's capability rows are appended to it, joined against `ruleset_versions` by `implementation_key` — but a new ruleset's own `ruleset_versions` row is created by whichever seed introduces it, which sorts after `0007` whenever its number is higher (e.g. `0013`). Production hit this directly: seeding #204's `SINGLES_V2` ruleset (`0013`) after `0007` was extended with its two capability rows meant the first pass's join matched nothing when `0007` ran, `ON CONFLICT DO NOTHING` gave no error, and `SINGLES_V2` sessions failed on `fk_sessions_capability` (migration `0020`) until a second manual `db:seed` run resolved it. Two alternatives were rejected: renumbering `0007` to sort last doesn't hold, since a ledger appended to indefinitely will always eventually receive an entry whose dependency is numbered higher than whatever "last" is at the time; a dependency graph between seed files was rejected as more machinery than a single ordering bug — that has recurred exactly once in thirteen files — justifies.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/scripts/seed.ts`'s `run()` executes every file returned by `seedFiles()` twice in the same invocation (`buildExecutionPlan`), instead of once.".

### Consequences
Every seed file must stay `ON CONFLICT DO NOTHING` (already required) so a second pass is a safe no-op rather than a duplicate insert or error; this was already true of every existing seed. Production seeding cost roughly doubles, which is negligible at this table size. `app/tests/scripts/seed.test.ts` asserts `buildExecutionPlan` doubles the file list; it does not exercise the join failure itself, since that requires a live database (see D193).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-29
