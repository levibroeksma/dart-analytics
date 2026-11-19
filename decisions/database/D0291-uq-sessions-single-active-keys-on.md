---
id: D0291
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, schema, migration, column, index]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `uq_sessions_single_active` keys on the exercise a session actually ran

## Context and Problem Statement
`0029` made `game_type_id` nullable so a training step could run without a game. Postgres treats every NULL as distinct for uniqueness, so from `0029` onward the index — named and documented as the single-active-session guard — constrained nothing for WARM_UP, SWITCHING or DOUBLE_PATTERN sessions (issue #310). A duplicated or retried step start inserted a second open row for the same player with no DB-level signal. `COALESCE` was chosen over `NULLS NOT DISTINCT` because the latter collapses all non-game sessions into one key, which would forbid a player from having, say, an open Switching and an open Warm-Up session; the expression keeps the rule "one open session per kind of thing being done".

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "migration `0034` rewrites `uq_sessions_single_active` to `(player_id, COALESCE(game_type_id, exercise_type_id)) WHERE completed_at IS NULL`, and closes pre-existing duplicates (newest `started_at` per key survives; the rest become ABANDONED with `completed_at = now()`) so the index can be created. `database/verification/0034_single_active_session_checks.sql` proves it against a live database. The backfill is not reversed by `migrate:down`.".

### Consequences
the index now bites on a path that previously could not fail, so `startTrainingStep` must handle `23505` for non-game steps as well as game steps — done in the same change (D292). An expression index cannot be declared as a plain Drizzle column list; `app/src/db/schema.ts` carries the `COALESCE` as raw `sql`, which `drizzle-kit introspect` will render its own way on the next run (issues #352/#363 track that drift). Activity-level uniqueness is deliberately not addressed here: `activities` rows created by the game path are never closed, so no partial unique index over `activities` can be written until that lifecycle gap is fixed.

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
