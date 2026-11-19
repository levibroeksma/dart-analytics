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

# `uq_sessions_single_active` keys on the exercise a session actually ran

## Context and Problem Statement
`0029` made `game_type_id` nullable so a training step could run without a game. Postgres treats every NULL as distinct for uniqueness, so from `0029` onward the index — named and documented as the single-active-session guard — constrained nothing for WARM_UP, SWITCHING or DOUBLE_PATTERN sessions (issue #310). A duplicated or retried step start inserted a second open row for the same player with no DB-level signal. `COALESCE` was chosen over `NULLS NOT DISTINCT` because the latter collapses all non-game sessions into one key, which would forbid a player from having, say, an open Switching and an open Warm-Up session; the expression keeps the rule "one open session per kind of thing being done". Commit `2bdf3229` also changes `startTraining` to abandon the player's open training activities before inserting a new one.

## Decision Drivers
* From `0029`, every NULL `game_type_id` counted as distinct, so the guard constrained nothing for WARM_UP, SWITCHING or DOUBLE_PATTERN sessions (issue #310).
* A duplicated or retried step start could insert a second open row for one player with no database signal.
* The rule is "one open session per kind of thing being done".

## Considered Options
* Key the index on `COALESCE(game_type_id, exercise_type_id)` (chosen).
* Use `NULLS NOT DISTINCT`. Rejected: it collapses all non-game sessions into one key, forbidding an open Switching and an open Warm-Up session together.

## Decision Outcome
Chosen option: "migration `0034` rewrites `uq_sessions_single_active` to `(player_id, COALESCE(game_type_id, exercise_type_id)) WHERE completed_at IS NULL`, and closes pre-existing duplicates (newest `started_at` per key survives; the rest become ABANDONED with `completed_at = now()`) so the index can be created. `database/verification/0034_single_active_session_checks.sql` proves it against a live database. The backfill is not reversed by `migrate:down`.".

### Consequences
the index now bites on a path that previously could not fail, so `startTrainingStep` must handle `23505` for non-game steps as well as game steps — done in the same change (D292). An expression index cannot be declared as a plain Drizzle column list; `app/src/db/schema.ts` carries the `COALESCE` as raw `sql`, which `drizzle-kit introspect` will render its own way on the next run (issues #352/#363 track that drift). Activity-level uniqueness is deliberately not addressed here: `activities` rows created by the game path are never closed, so no partial unique index over `activities` can be written until that lifecycle gap is fixed.

* Good, because the index now bites on non-game session starts that previously could not fail.
* Bad, because `startTrainingStep` must handle `23505` for non-game steps too (D292), and the backfill that closes duplicates is not reversed by `migrate:down`.
* Bad, because `schema.ts` carries the `COALESCE` as raw `sql`, which `drizzle-kit introspect` renders its own way (issues #352 and #363 track the drift).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0034_single_active_session_checks.sql` proves the index against a live database, per the record. The commit adds repository and service tests.

## Pros and Cons of the Options
`COALESCE(game_type_id, exercise_type_id)`: chosen. It keeps the rule per kind of thing being done.

`NULLS NOT DISTINCT`: rejected, because all non-game sessions would share one key.

## Evidence / More Information
Decided: 2026-09-17

* Commit `2bdf3229` (PR #381, issue #310, part of #358, 2026-09-17; adds the D291 row, migration `0034` and the verification script): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` (§ 7), `docs/superpowers/plans/2026-09-17-p5-decision-id-derivation.md`.
