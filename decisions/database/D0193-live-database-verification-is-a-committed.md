---
id: D0193
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [database, migration, column, constraint, view, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Live-database verification is a committed script, not checklist prose

## Context and Problem Statement
the original checklist told the operator to find "a real `turn_id` from a test session" and hand-type inserts against it. That is the shape of a step that gets skipped, and D192's `0018` defect is what skipping it costs. A script removes both the setup burden and the transcription risk, and it is re-runnable — the same checks that passed on the local PostgreSQL 16 cluster can be pointed at Neon, or at any future environment, without rewriting anything. Ending in `ROLLBACK` is what makes it safe to run against a seeded dev database rather than a scratch one.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "behaviour only a real database can demonstrate — a CHECK constraint firing, a view expression resolving, a derived column reading correctly — is asserted by a script under `database/verification/`, named for the migration it covers (`0018_visual_board_checks.sql`). Each script builds its own fixture inside one transaction, resolves every seeded lookup row by `implementation_key` rather than by hardcoded id, emits one PASS/FAIL row per check with the observed value in a `detail` column, and ends in `ROLLBACK`. Operator handoffs invoke the script instead of restating the SQL.".

### Consequences
a join-driven check reports a vacuous pass when its source view is empty, so each script must separately assert that the expected number of checks ran — `0018_visual_board_checks.sql` does. Scripts must be proved non-vacuous before they are trusted: this one was, by swapping the view's angle expression to `ATAN2(y, x)` and confirming 4 of 11 checks went red. These scripts are not part of `npm test` — they need a live `DATABASE_URL` and are run deliberately, per environment. `database/CLAUDE.md`'s validation checklist carries the rule.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-08
