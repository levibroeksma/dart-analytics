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

# Live-database verification is a committed script, not checklist prose

## Context and Problem Statement
the original checklist told the operator to find "a real `turn_id` from a test session" and hand-type inserts against it. That is the shape of a step that gets skipped, and D192's `0018` defect is what skipping it costs. A script removes both the setup burden and the transcription risk, and it is re-runnable — the same checks that passed on the local PostgreSQL 16 cluster can be pointed at Neon, or at any future environment, without rewriting anything. Ending in `ROLLBACK` is what makes it safe to run against a seeded dev database rather than a scratch one. Commit `ba175815` adds this rule together with D192, where migration `0018` shipped a `MOD()` call that could never apply and neither `tsc` nor the Vitest suite could see it.

## Decision Drivers
* A checklist step that tells the operator to hand-type inserts against a real `turn_id` is the shape of a step that gets skipped.
* A script is re-runnable: the same checks can point at Neon or any future environment without rewriting them.
* Ending in `ROLLBACK` makes a script safe to run against a seeded dev database rather than a scratch one.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "behaviour only a real database can demonstrate — a CHECK constraint firing, a view expression resolving, a derived column reading correctly — is asserted by a script under `database/verification/`, named for the migration it covers (`0018_visual_board_checks.sql`). Each script builds its own fixture inside one transaction, resolves every seeded lookup row by `implementation_key` rather than by hardcoded id, emits one PASS/FAIL row per check with the observed value in a `detail` column, and ends in `ROLLBACK`. Operator handoffs invoke the script instead of restating the SQL.".

### Consequences
a join-driven check reports a vacuous pass when its source view is empty, so each script must separately assert that the expected number of checks ran — `0018_visual_board_checks.sql` does. Scripts must be proved non-vacuous before they are trusted: this one was, by swapping the view's angle expression to `ATAN2(y, x)` and confirming 4 of 11 checks went red. These scripts are not part of `npm test` — they need a live `DATABASE_URL` and are run deliberately, per environment. `database/CLAUDE.md`'s validation checklist carries the rule.

* Good, because a script removes the setup burden and the transcription risk of the hand-typed checklist.
* Good, because ending in `ROLLBACK` makes the script safe on a seeded dev database.
* Bad, because the scripts need a live `DATABASE_URL`, are not part of `npm test` and run only deliberately, per environment.
* Bad, because a join-driven check passes vacuously on an empty view, so each script must also assert how many checks ran.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/CLAUDE.md`'s validation checklist carries the rule. Each script asserts its own check count. The `0018` script was proved non-vacuous by swapping the angle expression to `ATAN2(y, x)`, which turned 4 of 11 checks red.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-08

* Commit `ba175815` (PR #73, 2026-08-08; adds the D193 row in `decisions/database.md` and `database/verification/0018_visual_board_checks.sql`): rebuilt Context, Decision Drivers, Consequences and Confirmation.
* Applied in: `docs/superpowers/plans/2026-08-15-profile-display-darts-config.md`, `docs/superpowers/plans/2026-08-26-db-verification-script-drift.md`, `docs/superpowers/specs/2026-08-26-db-verification-script-drift-design.md`.
