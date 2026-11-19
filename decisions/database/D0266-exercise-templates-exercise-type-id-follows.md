---
id: D0266
status: accepted
date: 2026-09-10
origin: contemporaneous
original-date:
tags: [database, schema, migration, column, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `exercise_templates.exercise_type_id` follows the same nullable → backfill → NOT NULL shape as `exercise_sessions`

## Context and Problem Statement
`0028`'s original comment claimed `exercise_templates` was "confirmed empty in production," which was false — `seeds/0002_default_templates.sql` already ships four rows (501 Match, Ten Up One Down, Singles Accuracy, Score Training Block) that predate the column. Adding it `NOT NULL` directly fails with `23502` against any database that has run seed `0002`, which is every real environment. `0028` was editable in place rather than patched forward because it had never once committed against a real database — every attempt errored and rolled back, so no deployed schema ever reflected its old text; `0031`'s NOT NULL for `exercise_sessions` proved the same seed-backfill shape works for this exact discriminator. The adding commit changes `database/migrations/0028_template_exercise_types.sql`, adds `0032_exercise_template_type_not_null.sql` and edits `database/seeds/0014_exercise_types.sql`.

## Decision Drivers
* Seed `0002` already ships four `exercise_templates` rows, so adding the column `NOT NULL` fails with `23502` on every real environment.
* `0028` had never committed against a real database, so no deployed schema reflected its old text.
* The seed-backfill shape was already proven for `exercise_sessions` by `0031`.

## Considered Options
* Add the column nullable, backfill in seed `0014`, then promote to `NOT NULL` in `0032` (chosen).
* Add the column `NOT NULL` directly. The record shows this fails with `23502` against any database that ran seed `0002`.

## Decision Outcome
Chosen option: "Migration `0028` adds `exercise_templates.exercise_type_id` as nullable, not `NOT NULL`. Seed `0014_exercise_types.sql` backfills existing rows to GAME (in addition to its existing `exercise_sessions` backfill). A new migration `0032` promotes the column to `NOT NULL` after the seed runs.".

### Consequences
The apply order for the full chain is now `db:migrate` (through `0031`) → `db:seed` → `db:migrate` (`0032`), run alongside `0031` in that final pass. `exercise_templates.exercise_type_id` is enforced NOT NULL from `0032` onward, same as `exercise_sessions.exercise_type_id` from `0031`.

* Good, because the chain applies against databases that already hold the four seeded templates.
* Neutral, because the apply order becomes `db:migrate` through `0031`, `db:seed`, then `db:migrate` for `0032`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-10

* Commit `ae47e788` (PR #262, 2026-09-11; adds the D266 row, migration `0032`, and edits to `0028` and seed `0014`): rebuilt Context, Decision Drivers, Considered Options and Consequences.

Supersedes: D263 (corrects `0028`'s emptiness assumption and adds `0032`; the rest of D263's decision stands unchanged).
