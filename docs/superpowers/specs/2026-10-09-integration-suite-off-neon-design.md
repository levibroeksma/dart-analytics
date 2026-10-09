# Integration suite off Neon — design

> **Date:** 2026-10-09
> **Source:** `docs/superpowers/handoffs/2026-10-09-neon-network-transfer-handoff.md`, Handoff 1
> **Cites:** #653 (integration step added to `db-rehearsal.yml`), #378 (migrate → seed → migrate)

## Goal

`npm run test:integration` runs against a CI-local `postgres:16`, not a Neon branch. The Neon rehearsal keeps only migrate → seed → migrate → status. This cuts the ~21 MB of egress per rehearsal branch that `statistics-sql.itest.ts` causes today, which is ~81% of the billing period's Neon network transfer.

## Agreed scope

- All 11 `GameTypeKey`s are covered. The current `GAMES` list misses `CRICKET` and `TACTICS`.
- Real-player sampling (`knownPlayers`, `REAL_PLAYER_LIMIT`) is removed. The suite runs only fixture players plus `ABSENT_PLAYER`, identically on CI and locally.
- Fixtures are hand-written SQL inside a rolled-back transaction.
- "Populated" is guarded per game and per step kind, not just by player count.

## 1. CI

### New `.github/workflows/integration.yml`

- **Triggers:**
  - `pull_request` on `branches: [main]`, with the path list `db-rehearsal.yml` has today (its own path swapped for `.github/workflows/integration.yml`);
  - `workflow_dispatch`.
- **One job, `statistics-sql`.** It uses `schema.yml`'s `services.postgres` block (`postgres:16`, `POSTGRES_PASSWORD: ci`, health check) and `DATABASE_URL: postgres://postgres:ci@localhost:5432/<db>?sslmode=disable`. Steps:
  1. checkout, setup-node 22 with npm cache, `npm ci` (working dir `app`);
  2. `db:migrate:ci` (may stop early) → `db:seed:ci` → `db:migrate:ci` → `db:status:ci`, as in `schema.yml`;
  3. `npm run test:integration`.
- No secrets, no `neonctl`.

### `db-rehearsal.yml`

- Remove the `Statistics SQL executes` step and its comment.
- Remove the path entries that exist only for that step:
  - `app/src/repositories/**`
  - `app/src/services/statistics.service.ts`
  - `app/src/lib/stats/**`
  - `app/tests/integration/**`
  - `app/vitest.integration.config.ts`

  `app/package.json` stays, since it carries the dbmate and seed scripts.
- Update the header comment: the rehearsal is schema-only.

### Unchanged

- `deploy.yml` still calls `db-rehearsal` via `workflow_call`, so a deploy no longer runs the integration suite. The PR gate covers it.
- Owner action outside the repo: if `main`'s ruleset lists required checks, add `integration / statistics-sql`. Unverified from the repo.

## 2. Driver and harness — `app/tests/integration/statistics-sql.itest.ts`

- **Driver.** `vi.mock("@db/client")` returns a `getDb()` that yields the current rollback-transaction handle, a `drizzle-orm/postgres-js` transaction as in `visit-scoring.itest.ts`. The `@neondatabase/serverless` and `drizzle-orm/neon-http` imports are removed.
  - **Result shape:** every raw `db.execute` in `statistics.repository.ts` goes through `executedRows`, which accepts both `{ rows }` and array results. No stats path uses `batch()` or `rowCount`.
  - **Type parsing:** drizzle's postgres-js adapter is expected to install pass-through parsers for date and timestamp OIDs, as neon-http does. The plan verifies this against the installed `drizzle-orm` before relying on it. If it does not hold, the test's `postgres()` client sets those parsers itself.
- **Abort cascade.** One failing statement aborts the enclosing Postgres transaction, and every later call would then fail with "current transaction is aborted", hiding the real error. So calls run **sequentially**, each between `SAVEPOINT stat_call` and `ROLLBACK TO SAVEPOINT stat_call` (on error) or `RELEASE SAVEPOINT stat_call` (on success). `CONCURRENCY` and the batched `Promise.all` are removed.
- **Players:** `[ABSENT_PLAYER, FIXTURE_PLAYER]`.
- **Games:** `GAMES` is derived from an exhaustive `const GAME_KEYS = { "501": true, …, TACTICS: true } satisfies Record<GameTypeKey, true>`. A new `GameTypeKey` then fails typecheck until it is listed, and so until it has a fixture. (`capabilities.ts`'s `GAME_TYPE_KEYS` is not exported and is not widened for this.)
- **Test titles** change to name the fixture world. The input changed, and the title says so (root CLAUDE.md test-repointing rule; `pr-gates.yml` heuristic).
- `visit-scoring.itest.ts` is unchanged.

## 3. Fixture world — `app/tests/integration/fixtures/stats-world.ts`

Exports `seedStatsWorld(db): Promise<StatsWorld>`, `FIXTURE_PLAYER`, and the `StatsWorld` type. That type lists the player ids, the game-session id per `GameTypeKey`, and the routine key with its step kinds. All ids are fixed UUIDv7-shaped literals (`01990000-0000-7000-8000-…`) in a range disjoint from `visit-scoring.itest.ts` (`0x697xx`).

The **stats world** contains:

| Part | Content |
| ---- | ------- |
| Player | `FIXTURE_PLAYER` row in `players`; one parent `activities` row for game sessions |
| Game sessions | One `COMPLETED`, `ANALYTICS` capture, `VISUAL_BOARD` input session per `GameTypeKey` (11), on that game's current seeded ruleset version and stage type; owner seat plus a guest seat where the game is multi-seat; several turns with darts spread over single, double, treble, bull and miss zones |
| Routine run | One `COMPLETED` `activities` row with `activity_configurations.configuration` = `{ routineTemplateId, routineName, steps: [...] }` and 11 step `exercise_sessions` with `routine_step_sequence_number` 1–11: one game step (501), one step per `STEP_METRIC_SPECS` key (9 dart kinds), and one Warm-Up step; each dart-kind step carries every field its spec's `numberField` reads |

The plan pins the exact ruleset keys, stage types and per-kind fields from `database/seeds/**` and the engine and step-metric modules.

## 4. Guards

Each `it` seeds the world inside the rollback transaction and asserts these before the section sweep:

1. `StatsWorld` names at least one fixture player and all 11 game sessions.
2. For every game, `listGameSessions(FIXTURE_PLAYER, game, …)` returns ≥ 1 item.
3. `listTrainedRoutines(FIXTURE_PLAYER)` contains the fixture routine key.
4. `getRoutineHeader(FIXTURE_PLAYER, key)`'s steps resolve, via `sectionsForStep`, to at least one `game` step, every `STEP_METRIC_SPECS` kind, and at least one non-dart exercise step.

Then the sweep runs as today, and `failures` must be `[]`.

## 5. Docs and context

- New decision in `decisions/context-system.md` (the CI routing in `DECISIONS.md`), citing #653 and the handoff. Its id is taken at write time; D432 is in use on the unmerged `feat/game-play-redesign`.
- `context-maintenance`:
  - context-map and file-inventory rows for `integration.yml` and `fixtures/stats-world.ts`;
  - `tests/CLAUDE.md` and `05-Database/11-Neon-Integration.md` wherever they say the rehearsal runs the integration suite.
- Discovered work, filed as an issue and not fixed here: the `isDartExerciseKind` / `sectionsForStep` docs say "seven" dart exercise kinds, but `STEP_METRIC_SPECS` has nine.

## Done when

- `db-rehearsal.yml` runs nothing beyond dbmate, the seed script and `neonctl`.
- `integration.yml` is green on this PR, which touches `app/tests/integration/**`, with the guards above passing.
- The decision is recorded, and `run-all-gates` and `context-maintenance` have run.
