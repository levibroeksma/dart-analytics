---
id: D0433
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, CI, deploy, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The integration suite runs against a CI-local Postgres; the Neon rehearsal is schema-only

## Context and Problem Statement
the handoff of 2026-10-09 measured ~3.27 GB of the billing period's 4.05 GB Neon network transfer (~81%) on deleted `ci-rehearsal-*` branches — ~157 rehearsals at ~21 MB each — and traced it to the integration step #653 added on 2026-10-01: `statistics-sql.itest.ts` read up to three real players' full statistics twice per section, and every result row left Neon for the runner. Nothing in the suite needs production data; it needs populated data. The driver swap is safe because every raw `db.execute` in the stats repository normalises `{ rows }` and row arrays through one helper and both drivers return dates and timestamps as strings. The guards exist because the server-side folds fail quietly: derived-aims and step-result count an undecodable config as `skippedSessions`, and the X01 visit fold drops it with no counter at all, so a hand-written fixture could pass "every section executes" while exercising nothing. `starting_score` 170 for the 501 fixture is what makes `leg-stats` and `bust-rate` observable (a finished leg; visits opening at ≤ 180).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`npm run test:integration` runs in a new `.github/workflows/integration.yml` against a `postgres:16` service built from the migration chain (migrate → seed → migrate → status, as `schema.yml` does, #378), on PRs touching `database/migrations/**`, `database/seeds/**`, the seed runner, `app/src/db/**`, `app/src/repositories/**`, `statistics.service.ts`, `app/src/lib/stats/**`, `app/src/modules/stats/**`, the game and exercise engines and config schemas the folds decode with (`app/src/modules/game/**`, `app/src/modules/training/**`, `app/src/lib/game/rulesets/**`, `app/src/lib/training/exercises/rulesets/**`, both `types.ts` barrels), `app/tests/integration/**`, the integration vitest config, `app/package.json`, `app/package-lock.json` or the workflow itself. `db-rehearsal.yml` loses its `Statistics SQL executes` step (added by #653) and the seven trigger paths that existed only for it or for `db:verify` (`database/verification/**`, `app/scripts/verify-db.ts`, which nothing in CI runs); it keeps migrations, seeds, `seed.ts`, `app/package.json` and itself, and gains a concurrency group keyed on event name and ref that cancels only `pull_request` runs. `statistics-sql.itest.ts` swaps its `neon-http` mock for a `postgres-js` client held in one rolled-back transaction; `getDb()` throws outside it; every statistics call runs sequentially behind a `SAVEPOINT`. Real-player sampling is removed; the suite runs for an absent player and one fixture player whose world — one completed session per `GameTypeKey` (all 11) and one completed eleven-step routine run (Warm-Up, the nine dart exercise kinds, a 501 game) — is inserted with plain SQL by `app/tests/integration/fixtures/`. Six guards precede the sweep: world shape, every game listed by `listGameSessions`, the routine listed by `listTrainedRoutines`, every `STEP_METRIC_SPECS` kind plus a game step and a Warm-Up resolved by `getRoutineHeader`, `skippedSessions === 0` on every fixture-player response that carries it, and `sampleSize >= 1` on `leg-stats` (501) and `bust-rate` (TUOD, 121). Test titles name the fixture world.".

### Consequences
a deploy no longer runs the integration suite — PR time is its only run, and `main` has no required status checks, so a red `integration` job blocks nothing by itself; making it required is an owner decision. Two `DATABASE_URL` spellings are deliberate: dbmate needs `?sslmode=disable` against a plain container, postgres-js needs the parameter absent because it treats any `sslmode` value as "use SSL". A new `GameTypeKey` fails `tsc` until it has a fixture row and an entry in the test's key map. A fixture config that drifts from its `.strict()` schema fails CI instead of folding to zero. The suite no longer sees production data shapes at all; `visit-scoring.itest.ts` keeps its tests, inputs and assertions and now imports the shared `uuid` and `inRolledBackTx` helpers from `tests/integration/fixtures/itest-db.ts`. `database/verification/**` edits no longer trigger any workflow. The X01 fold's uncounted skip remains in production and is filed as discovered work, as are the `pr-gates.yml` heuristic's blindness to `*.itest.ts`, the "seven" dart-kind JSDoc, the unignored root `.neon`, and root `CLAUDE.md`'s migration range lagging `0046`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-09
