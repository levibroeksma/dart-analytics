# Integration suite off Neon — design

> **Date:** 2026-10-09 (revised same day after review)
> **Source:** `docs/superpowers/handoffs/2026-10-09-neon-network-transfer-handoff.md`, Handoff 1
> **Cites:** #653 (integration step added to `db-rehearsal.yml`), #378 (migrate → seed → migrate)
> **Branch:** `ci/integration-suite-off-neon`

## Goal

`npm run test:integration` runs against a CI-local `postgres:16`, not a Neon branch. The Neon rehearsal keeps only migrate → seed → migrate → status. This removes the ~21 MB of Neon egress per rehearsal branch that `statistics-sql.itest.ts` causes today (~81% of the billing period's network transfer) and stops stats-only PRs from cutting a Neon branch at all.

## Agreed scope

- All 11 `GameTypeKey`s are covered. The current `GAMES` list misses `CRICKET` and `TACTICS`.
- Real-player sampling (`knownPlayers`, `REAL_PLAYER_LIMIT`) is removed. The suite runs only `ABSENT_PLAYER` plus one fixture player, identically on CI and locally.
- Fixtures are hand-written SQL inside a rolled-back transaction, modelled on `database/verification/0045_stats_routine_views_checks.sql` lines 75–230 and `app/tests/integration/visit-scoring.itest.ts`.
- "Populated" is guarded per game, per step kind, and per server-side fold (§5), never by player count alone.
- `visit-scoring.itest.ts` is not changed.
- Handoff 2 (skip `rehearse`/`migrate` when nothing is pending) is a separate branch and is not touched here.

## Verified facts the design rests on

Each was checked in the repo on 2026-10-09. An implementer re-checks only if the cited file changed.

| # | Fact | Where |
| - | ---- | ----- |
| F1 | Every raw `db.execute` in the stats repository goes through `executedRows`, which accepts both neon-http's `{ rows }` and postgres-js's row array. No stats path uses `batch()` or `rowCount`. | `app/src/repositories/statistics.repository.ts:215-223`, call sites at 949, 1140, 1609, 1707, 2060, 2112 |
| F2 | `drizzle-orm/postgres-js` installs pass-through (string) parsers for OIDs 1184, 1082, 1083, 1114, 1182, 1185, 1115, 1231. `drizzle-orm/neon-http` does the same plus INTERVAL (1186, 1187). Stats SQL selects no interval column — `interval` appears only inside expressions. So both drivers hand the code identical strings for dates and timestamps. | `app/node_modules/drizzle-orm/postgres-js/driver.js:17-18`; `neon-http/driver.js:24-32`; `statistics.repository.ts:262-269` |
| F3 | Server-side folds **skip silently**: a game session whose stored config fails `toSnapshot` or whose dart count mismatches is dropped (`skippedSessions += 1`); a routine step session whose config fails its V1 schema or whose engine throws is dropped the same way. The count surfaces on the response as `skippedSessions`. | `app/src/modules/stats/derived-aims.module.ts:155-200`; `app/src/modules/stats/sections/step-result.module.ts:95-115, 140-175`; `statistics.service.ts:955-957` |
| F4 | Server-site game sections: `ladder-progress`, `checkout-rate`, `double-performance`, `checkout-path`, `bust-rate`, `leg-stats`, `atc-darts-per-target`, `training-result`, `bobs27-survival`, `shanghai-count`; routine: `step-result`. | `app/src/lib/stats/section-registry.ts` (`computeSite: "server"`) |
| F5 | `v_stats_dart_facts` includes a dart only when the session is `VISUAL_BOARD`, status `COMPLETED`/`ABANDONED`, `location_x` and `location_y` are both NOT NULL, and the participant's `player_id` equals the session's `player_id`. The derived-aims fold also requires the dart-facts count to equal `v_stats_session_facts.dart_count`. So **every fixture dart must carry a location**. | `database/migrations/0043_stats_base_views.sql` (view), `derived-aims.module.ts:185` |
| F6 | `listGameSessions` filters `v_stats_session_facts` on player, game, `completed_at` in range, status, `dart_count > 0`, context. | `statistics.repository.ts:1016-1026` |
| F7 | `v_stats_routine_run_facts` / `v_stats_routine_step_facts` need: `activities` row with status `COMPLETED`, an `activity_configurations` row whose JSON has `routineTemplateId`, `routineName`, `steps[]`; each step session has `routine_step_sequence_number` equal to a `steps[].sequenceNumber` (JSON number). | `database/migrations/0045_stats_routine_views.sql` |
| F8 | The app writes step JSON elements with exactly these keys: `sequenceNumber`, `exerciseTypeKey`, `exerciseRulesetVersionKey`, `gameTypeKey`, `gameRulesetVersionKey`, `durationSeconds`, `configuration`. A `RANDOM_CHECKOUT` step's configuration gains `drawSeed`; a `WARM_UP` step's gains `stepDurationSeconds`. | `app/src/services/training-session.service.ts:96-170` |
| F9 | Routine step sessions use capture `ANALYTICS` + input `VISUAL_BOARD` for GAME steps and all 9 dart kinds; a `WARM_UP` step has neither capture nor input mode and no game pair. `(game_type_id IS NULL) = (ruleset_version_id IS NULL)` and `(capture_mode_id IS NULL) = (input_mode_id IS NULL)` are CHECKed. `exercise_type_id` is NOT NULL on every session. | `training-session.service.ts:452-453`, `services/routines/game-step.ts:8-9`; `database/migrations/0031_*.sql` |
| F10 | `(ANALYTICS, VISUAL_BOARD)` is a seeded capability pair for all 16 game ruleset versions, so `fk_sessions_capability` holds for every game. | `database/seeds/0007_ruleset_version_capabilities.sql` |
| F11 | Stage type per game: `501_V1` → `LEG`; `121_V2` → `ROUND`; everything else → `EXERCISE_BLOCK`. | `five-oh-one.engine.module.ts:40`, `one-twenty-one.engine.module.ts:79`, `tuod.engine.module.ts:63`, `turn-log.module.ts:113-125` |
| F12 | Game config is stored in wire form (snake_case); `toSnapshot` strips `seats` then parses with a `.strict()` zod schema — unknown keys fail. | `app/src/lib/game/rulesets/types.ts:16-420`; `x01-checkout-sessions.module.ts:143-161` |
| F13 | Exercise V1 configs are camelCase and `.strict()`; several fields are `z.literal` (see §4.4). | `app/src/lib/training/exercises/rulesets/types.ts` |
| F14 | `chk_hit_consistency`: a dart has `hit_zone_id` set, or both `hit_zone_id` and `hit_target_number` NULL. `chk_dart_location_pair`: both or neither location. Dart zone keys: `SINGLE`, `INNER_SINGLE`, `OUTER_SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`, `INNER_BULL`, `MISS`. | `database/migrations/0006_runtime_events.sql:95-101`, `0017_dart_locations.sql`; seeds `0001`, `0006` |
| F15 | `main`'s ruleset (`Main branch protection`, id 18768218) has **no** `required_status_checks` rule — no workflow is required today. | `gh api repos/{owner}/{repo}/rulesets/18768218` |
| F16 | `pr-gates.yml`'s test-repointing heuristic scans only `app/tests/**/*.test.ts`; `.itest.ts` is invisible to it. | `.github/workflows/pr-gates.yml` |
| F17 | Nothing in CI runs `db:verify`; `database/verification/**` and `app/scripts/verify-db.ts` trigger a rehearsal that never uses them. | `grep -rn verify .github/workflows` |
| F18 | `db-rehearsal.yml` reads `app/.neon` (working dir `app`). The untracked root `.neon` is a local neonctl artefact, not read by CI. | `.github/workflows/db-rehearsal.yml`, `git ls-files` |

## 1. CI

### 1.1 New `.github/workflows/integration.yml`

```yaml
name: integration

# Executes every statistics section, list and routine read against a Postgres
# built from the migration chain (#653). Runs here, not in db-rehearsal.yml,
# so the suite never reads from a Neon branch (D<id> — put the §6 decision id here).

on:
  pull_request:
    branches: [main]
    paths:
      - 'database/migrations/**'
      - 'database/seeds/**'
      - 'app/scripts/seed.ts'
      - 'app/src/repositories/**'
      - 'app/src/services/statistics.service.ts'
      - 'app/src/lib/stats/**'
      - 'app/src/modules/stats/**'
      - 'app/tests/integration/**'
      - 'app/vitest.integration.config.ts'
      - 'app/package.json'
      - '.github/workflows/integration.yml'
  workflow_dispatch:

concurrency:
  group: integration-${{ github.ref }}
  cancel-in-progress: true

jobs:
  statistics-sql:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: integration
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:ci@localhost:5432/integration?sslmode=disable
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      # Migrate -> seed -> migrate, as schema.yml does (#378).
      - name: Build the database from the migration chain
        run: |
          npm run db:migrate:ci || echo "::warning::first migrate pass stopped; seeding, then retrying"
          npm run db:seed:ci
          npm run db:migrate:ci
          npm run db:status:ci
      - name: Statistics SQL executes
        run: npm run test:integration
```

Notes:

- `app/src/modules/stats/**` is added to the paths: the folds live there (F3) and were missing from the old list.
- No secrets, no `neonctl`, no `environment:`.
- `concurrency` cancels a superseded run on the same PR; there is no deploy caller to protect.

### 1.2 `.github/workflows/db-rehearsal.yml`

1. Delete the `Statistics SQL executes` step and its four-line comment.
2. In the `pull_request.paths` list delete these entries (they existed only for the deleted step, or for `db:verify`, which nothing runs — F17):
   - `database/verification/**`
   - `app/scripts/verify-db.ts`
   - `app/src/repositories/**`
   - `app/src/services/statistics.service.ts`
   - `app/src/lib/stats/**`
   - `app/tests/integration/**`
   - `app/vitest.integration.config.ts`

   Keep: `database/migrations/**`, `database/seeds/**`, `app/scripts/seed.ts`, `app/package.json`, `.github/workflows/db-rehearsal.yml`.
3. Add, under `on:`, a PR-only concurrency group. `workflow_call` runs inherit `deploy.yml`'s `deploy-production` group and must not be cancelled, so the key must be inert for them:

   ```yaml
   concurrency:
     group: rehearsal-${{ github.event_name }}-${{ github.ref }}
     cancel-in-progress: ${{ github.event_name == 'pull_request' }}
   ```

4. Header comment: the rehearsal is schema-only; the integration suite runs in `integration.yml`.
5. Keep the `db:verify` paragraph comment — it is still true.

### 1.3 Unchanged, and what that means

- `deploy.yml` still calls `db-rehearsal.yml`; a deploy no longer runs the integration suite. The PR-time `integration` job covers it.
- No status check is required on `main` (F15), so a red `integration` job does not block a merge — the same as every other workflow today. Making checks required is an owner decision outside this task.

## 2. Driver and harness — `app/tests/integration/statistics-sql.itest.ts`

### 2.1 Driver

Replace the `@neondatabase/serverless` + `drizzle-orm/neon-http` import and mock with a `postgres-js` client, as `visit-scoring.itest.ts` does. Safe by F1 and F2.

### 2.2 Transaction handle and mock

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@db/schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let current: Db | null = null;

vi.mock("@db/client", () => ({
  getDb: () => {
    if (current === null)
      throw new Error("getDb() called outside inRolledBackTx");
    return current;
  },
}));
```

- `getDb()` **throws** outside a transaction. A section call that escapes the rollback must fail, not open a fresh client.
- `inRolledBackTx` is the one from `visit-scoring.itest.ts` (`class Rollback`, `max: 1`, `client.end()` in `finally`), extended to set `current = tx` on entry and `current = null` in `finally`.
- The tests must not await `import("@db/client")`; nothing in the test calls `getDb` directly any more.

### 2.3 Abort cascade: sequential calls with savepoints

A failed statement aborts the Postgres transaction; every later statement fails with "current transaction is aborted" and hides the real error. Therefore:

```ts
async function attempt(db: Db, [label, run]: Call): Promise<string | null> {
  await db.execute(sql`SAVEPOINT stat_call`);
  try {
    await run();
    await db.execute(sql`RELEASE SAVEPOINT stat_call`);
    return null;
  } catch (err) {
    await db.execute(sql`ROLLBACK TO SAVEPOINT stat_call`);
    return `${label}: ${(err as Error).message}`;
  }
}
```

- `failures` runs `attempt` **sequentially** (`for … of`). Delete `CONCURRENCY` and the `Promise.all` batching. `routineCalls`' inner `Promise.all` over players/keys also becomes sequential.
- No stats path opens its own `db.transaction` (checked: none in `statistics.service.ts` / `statistics.repository.ts`), so no nested drizzle savepoint collides with `stat_call`.
- Budget: ~2 players × (11 games × ≤ 15 sections × 2 ranges + 11 lists + overview) + 11 steps × ≤ 15 sections × 2 ranges ≈ 1 000–1 500 statements. `testTimeout` stays `600_000`; a local Postgres finishes in well under a minute.

### 2.4 Players and games

```ts
const PLAYERS = [ABSENT_PLAYER, FIXTURE_PLAYER];

const GAME_KEYS = {
  "501": true, TUOD: true, ONE_TWENTY_ONE: true, SCORE_TRAINING: true,
  SINGLES_TRAINING: true, DOUBLES_TRAINING: true, BOBS27: true,
  SHANGHAI: true, AROUND_THE_CLOCK: true, CRICKET: true, TACTICS: true,
} satisfies Record<GameTypeKey, true>;
const GAMES = Object.keys(GAME_KEYS) as GameTypeKey[];
```

A new `GameTypeKey` fails `tsc` until listed here **and** given a fixture row in `GAME_FIXTURES` (§4.2), which is typed `Record<GameTypeKey, …>`.

### 2.5 Test titles

Both `it` titles change to name the fixture world, e.g. `"runs every game section, list and the overview against the stats world and an absent player"`. The input changed, and root CLAUDE.md requires the title to say so. (`pr-gates.yml`'s heuristic would not notice either way — F16; filed as discovered work, §7.)

## 3. Fixture world — `app/tests/integration/fixtures/stats-world.ts`

### 3.1 Exports

```ts
export const FIXTURE_PLAYER = "01990000-0000-7000-8000-0000000a0001";
export type StatsWorld = {
  playerId: string;
  gameSessions: Record<GameTypeKey, string>;   // session id per game
  routine: {
    routineKey: string;                          // equals routineTemplateId
    stepKinds: readonly string[];                // exerciseTypeKey per step, 11 entries
  };
};
export async function seedStatsWorld(db: Db): Promise<StatsWorld>;
```

`db` is the rollback transaction handle; the function only `INSERT`s via `db.execute(sql\`…\`)` and never commits.

### 3.2 Ids

All ids are UUIDv7-shaped literals `01990000-0000-7000-8000-0000000aXXXX`, hex `a0000`–`affff`, disjoint from `visit-scoring.itest.ts` (`0x697xx`) and from `database/verification/0045` (`…4501`–`…45f1`). A helper `uuid(n)` as in `visit-scoring.itest.ts`, with `n` offsets:

| Range | Use |
| ----- | --- |
| `a0001` | player |
| `a0010` | standalone `activities` row for the 11 game sessions |
| `a1g00`–`a1gff` | game `g` (0–10 in `GAMES` order): `+00` session, `+01` stage, `+02` owner seat, `+03` config, `+10..` turns, `+40..` darts |
| `a2000` | routine `activities` row, `a2001` its `activity_configurations` row, `a20f1` the `routineTemplateId` |
| `a2s00`–`a2sff` | routine step `s` (1–11): same sub-layout as a game |

### 3.3 Timestamps

`started_at = now() - interval '1 hour'`, `completed_at = now()`, `created_at = now()`. `RANGE` in the test is 2020–2030, so every row falls inside both ranges.

## 4. Fixture content

### 4.1 Player and standalone activity

```sql
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (:player, 'itest-stats-world', 'Stats World', now(), now());
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (:activity, :player, (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour', now(), now());
```

No `activity_configurations` row for this activity, so its sessions read as `STANDALONE`.

### 4.2 Game sessions — one per `GameTypeKey`

For each row of `GAME_FIXTURES` (typed `Record<GameTypeKey, GameFixture>`):

| Game | `ruleset` | `stage` | `configuration` (wire, snake_case, F12) |
| ---- | --------- | ------- | --------------------------------------- |
| `501` | `501_V1` | `LEG` | `{"starting_score":501,"legs_to_win":1,"check_in":"STRAIGHT_IN","check_out":"DOUBLE_OUT","max_darts_per_turn":3,"max_visit_score":180}` |
| `TUOD` | `TUOD_V1` | `EXERCISE_BLOCK` | `{"starting_target":10,"finish_bonus":1,"miss_penalty":1,"duration_type":"ROUNDS","duration_value":10,"max_darts_per_turn":3}` |
| `ONE_TWENTY_ONE` | `121_V2` | `ROUND` | `{"duration_type":"ROUNDS","duration_value":10}` |
| `SCORE_TRAINING` | `SCORE_TRAINING_V1` | `EXERCISE_BLOCK` | `{"duration_type":"ROUNDS","duration_value":10,"max_darts_per_turn":3,"max_visit_score":180}` |
| `SINGLES_TRAINING` | `SINGLES_V3` | `EXERCISE_BLOCK` | `{"order_mode":"LOW_TO_HIGH","target_order":[1,2,…,20,25],"difficulty":"EASY","scoring_mode":"STANDARD","points_single":1,"points_double":2,"points_treble":3}` |
| `DOUBLES_TRAINING` | `DOUBLES_TRAINING_V1` | `EXERCISE_BLOCK` | `{"mode":"EASY","order_mode":"LOW_TO_HIGH","target_order":[1,2,…,20,25]}` |
| `BOBS27` | `BOBS27_V1` | `EXERCISE_BLOCK` | `{"start_score":27,"bull_hit_value":50,"miss_penalty_multiplier":1}` |
| `SHANGHAI` | `SHANGHAI_V2` | `EXERCISE_BLOCK` | `{"difficulty":"NORMAL"}` |
| `AROUND_THE_CLOCK` | `AROUND_THE_CLOCK_V2` | `EXERCISE_BLOCK` | `{"path_direction":"LOW_TO_HIGH","odds_first":false,"segment_rule":"ANY","difficulty":"EASY","duration_type":"UNTIMED","duration_value":null}` |
| `CRICKET` | `CRICKET_V1` | `EXERCISE_BLOCK` | `{}` |
| `TACTICS` | `TACTICS_V1` | `EXERCISE_BLOCK` | `{}` |

"Highest-numbered version per game" is the rule; the table is its result. Every config above satisfies its zod schema in `app/src/lib/game/rulesets/types.ts` as of F12. Rows:

- `exercise_sessions`: `activity_id = :activity`, `player_id`, `exercise_type_id = (GAME)`, `game_type_id = (SELECT id FROM game_types WHERE implementation_key = :game)`, `ruleset_version_id = (… ruleset_versions … = :ruleset)`, `capture_mode_id = (ANALYTICS)`, `input_mode_id = (VISUAL_BOARD)`, `status_id = (COMPLETED)`, timestamps per §3.3. `routine_step_sequence_number` NULL.
- `exercise_configurations`: `configuration = :config::jsonb` (no `seats` key).
- `exercise_stages`: one stage, `stage_type_id = (… stage_types … = :stage)`, `sequence_number = 1`, `parent_stage_id NULL`.
- `participants`: **owner seat only** — `participant_type_id = (PLAYER)`, `player_id = :player`, `display_name 'Stats World'`. No guest: every fold here is single-seat (`oneSeatConfig`, `soloSeat`), and a second seat adds engine-validity risk without adding coverage. (This replaces the earlier "guest seat where multi-seat" line.)
- `turns` + `darts`: the **universal dart script** (§4.3), 3 turns × 3 darts, `turns.total_score` = sum of the turn's dart scores, `turns.completed_at = now()`.

### 4.3 Universal dart script

Each dart: `(hit_target_number, zone_key, score, location_x, location_y)`. Locations are fixed board-ish coordinates so F5 holds and `miss-direction` has something to bin.

| Turn | Dart 1 | Dart 2 | Dart 3 |
| ---- | ------ | ------ | ------ |
| 1 | `(20, TREBLE, 60, 0.00, -103.00)` | `(20, SINGLE, 20, 2.00, -130.00)` | `(20, DOUBLE, 40, -1.00, -165.00)` |
| 2 | `(19, SINGLE, 19, -40.00, 120.00)` | `(25, OUTER_BULL, 25, 8.00, 6.00)` | `(NULL, MISS, 0, 190.00, 10.00)` |
| 3 | `(25, INNER_BULL, 50, 1.00, -2.00)` | `(19, TREBLE, 57, -55.00, 90.00)` | `(16, DOUBLE, 32, 90.00, 140.00)` |

- A `MISS` has `hit_zone_id = (MISS)` and `hit_target_number NULL` (allowed by F14). `intended_*` columns stay NULL everywhere.
- The script is engine-valid for all 11 games (no finished leg, no negative Bob's 27 score, misses allowed everywhere). If a guard in §5.5 reports a skipped session for one game, **fix that game's darts in `GAME_FIXTURES` (a per-game override of the script), never relax the guard.**
- Coverage: single, double, treble, outer bull, inner bull, miss zones; targets 16, 19, 20, 25.

### 4.4 Routine run — one completed activity, 11 steps

**Activity + configuration:**

```sql
INSERT INTO activities (…) VALUES (:routineActivity, :player, (COMPLETED), now() - interval '1 hour', now(), now());
INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (:routineConfig, :routineActivity, :stepsJson::jsonb, now());
```

`stepsJson` = `{"routineTemplateId": "<a20f1 uuid>", "routineName": "Stats World Routine", "steps": [ … 11 elements … ]}`. Each element has exactly the keys in F8. `routineKey` returned in `StatsWorld` is the `routineTemplateId`.

**Steps** (sequence, kind, exercise ruleset, stored configuration — camelCase, F13):

| Seq | `exerciseTypeKey` | `exerciseRulesetVersionKey` | `gameTypeKey` / `gameRulesetVersionKey` | `configuration` |
| --- | ----------------- | --------------------------- | --------------------------------------- | --------------- |
| 1 | `WARM_UP` | `WARM_UP_V1` | null / null | `{"phases":[{"name":"Upper","targets":[20],"weight":1}],"stepDurationSeconds":60}` |
| 2 | `SWITCHING` | `SWITCHING_V1` | null / null | `{"targets":[20,19],"scoring":{"single":1,"double":2,"treble":3}}` |
| 3 | `DOUBLE_PATTERN` | `DOUBLE_PATTERN_V1` | null / null | `{"patterns":[[20,16]]}` |
| 4 | `TARGET_SCORING` | `TARGET_SCORING_V1` | null / null | `{"targets":[20,19,18,25]}` |
| 5 | `SWITCHING_TARGET_SCORING` | `SWITCHING_TARGET_SCORING_V1` | null / null | `{"targets":[20,19,18]}` |
| 6 | `SCORE_THRESHOLD` | `SCORE_THRESHOLD_V1` | null / null | `{"threshold":65}` |
| 7 | `BULLSEYE_CHECKOUT` | `BULLSEYE_CHECKOUT_V1` | null / null | `{"startScore":81}` |
| 8 | `BULL_UP` | `BULL_UP_V1` | null / null | `{}` |
| 9 | `CHECKOUT_SEQUENCE` | `CHECKOUT_SEQUENCE_V1` | null / null | `{"firstOutshot":61,"lastOutshot":100,"dartLimit":6}` |
| 10 | `RANDOM_CHECKOUT` | `RANDOM_CHECKOUT_V1` | null / null | `{"minStart":40,"maxStart":170,"drawSeed":1}` |
| 11 | `GAME` | null | `501` / `501_V1` | the `501` wire config from §4.2 |

`durationSeconds` is `300` on every element. The same `configuration` object is stored both inside the step element and in the step session's `exercise_configurations` row.

**Step sessions** — one `exercise_sessions` row per step, `activity_id = :routineActivity`, `routine_step_sequence_number = seq`, status `COMPLETED`, timestamps per §3.3, plus:

| Steps | `exercise_type_id` | `exercise_ruleset_version_id` | game pair | capture/input | stages/turns/darts |
| ----- | ------------------ | ----------------------------- | --------- | ------------- | ------------------ |
| 1 (Warm-Up) | `WARM_UP` | `WARM_UP_V1` | NULL/NULL | NULL/NULL (F9) | none |
| 2–10 (dart kinds) | the kind | `<KIND>_V1` | NULL/NULL | `ANALYTICS`/`VISUAL_BOARD` | one `EXERCISE_BLOCK` stage, owner seat, universal dart script |
| 11 (game) | `GAME` | NULL | `501`/`501_V1` | `ANALYTICS`/`VISUAL_BOARD` | one `LEG` stage, owner seat, universal dart script |

Every dart-kind session gets its own `exercise_configurations` row (F3: a missing or invalid config is a silent skip).

## 5. Guards

Each `it` seeds the world inside `inRolledBackTx`, then asserts the guards **before** the section sweep. A guard failure is a test failure with a message naming the game/step.

1. **World shape.** `world.gameSessions` has all 11 keys with non-empty ids; `world.routine.stepKinds.length === 11`.
2. **Games are visible.** For every `game` in `GAMES`, `stats.listGameSessions(FIXTURE_PLAYER, game, { ...RANGES[0], ...GAME_QUERY, limit: 5 })` is `ok` and `data.items.length >= 1`. (F6: this proves `dart_count > 0` and the status/context filters pass.)
3. **Routine is trained.** `stats.listTrainedRoutines(FIXTURE_PLAYER)` is `ok` and contains `world.routine.routineKey`.
4. **Every step kind resolves.** `stats.getRoutineHeader(FIXTURE_PLAYER, routineKey)` is `ok` (an `ok: false` here fails the test outright). Mapping each `data.steps[i]` through `sectionsForStep` yields: at least one `kind: "game"`; for every key of `STEP_METRIC_SPECS`, at least one step whose `exerciseTypeKey` equals it; and at least one step with `exerciseTypeKey === "WARM_UP"`.
5. **No fold skipped a fixture session.** During the sweep for `FIXTURE_PLAYER`, every section response that is `ok` and whose `data` carries a numeric `skippedSessions` must have `skippedSessions === 0`. Collect violations as `"<label>: skippedSessions=<n>"` and assert the list is `[]` alongside `failures`. This is what makes F3's silent skip loud: a config that fails its schema, or darts an engine rejects, now fails CI.

Then the sweep runs as today for both players and `failures` must be `[]`.

## 6. Docs and context

- **Decision** in `decisions/context-system.md` (CI routing per `DECISIONS.md`): title "Integration suite runs against a CI-local Postgres; the Neon rehearsal is schema-only". Cites #653, #378, the handoff. Id = next free at write time — `D431` is the highest on `main`; `feat/game-play-redesign` (unmerged) already uses `D432`, so take `D433` unless `main` has moved. Also record the dropped `database/verification/**` trigger (F17) and the PR-only concurrency groups in the same decision's Consequences.
- **`app/tests/CLAUDE.md` line 9:** replace "in CI, by `db-rehearsal.yml` against the migrated branch" with "in CI, by `.github/workflows/integration.yml` against a `postgres:16` service built from the migration chain; locally, point `DATABASE_URL` at any migrated + seeded Postgres — a local container works and costs no Neon egress". Mirror into `app/tests/AGENT.md` only if that file carries the same sentence (`scripts/check-agent-mirrors.sh` decides).
- **`docs/architecture/05-Database/11-Neon-Integration.md` line 178:** drop `database/verification/**` and "the seed/verify runners" from the trigger list; add one sentence that the integration suite runs in `integration.yml` off Neon.
- **`app/DEPLOYMENT.md` lines 72, 152, 159:** still true; no edit.
- **`docs/architecture/00-File-Inventory.md`:** rows for `.github/workflows/integration.yml` (next to the `schema.yml` row, line 613) and `app/tests/integration/fixtures/stats-world.ts`. Update the `db-rehearsal.yml` row's description if it mentions the suite.
- **`docs/architecture/00-Context-Map.md`:** register the two new files in the CI / test context packs where `db-rehearsal.yml` and `statistics-sql.itest.ts` appear.
- Run `context-maintenance`, then `run-all-gates`.

## 7. Discovered work (file as issues, do not fix here)

1. `isDartExerciseKind` / `sectionsForStep` JSDoc says "seven" dart exercise kinds; `STEP_METRIC_SPECS` has nine (`section-registry.ts:457, 475`).
2. `pr-gates.yml` test-repointing heuristic ignores `*.itest.ts` (F16).
3. Root `.neon` (neonctl artefact, `orgId` only) is untracked and not gitignored (F18).

## 8. Execution order for the implementer

1. Write `fixtures/stats-world.ts` (§3–4). Unit-level check: `npx tsc --noEmit` passes with `GAME_FIXTURES: Record<GameTypeKey, …>`.
2. Rewrite `statistics-sql.itest.ts` (§2, §5). Run `npm run test:integration` against a local migrated + seeded Postgres (e.g. `docker run -e POSTGRES_PASSWORD=ci -p 5432:5432 postgres:16`, then the §1.1 migrate → seed → migrate commands with that `DATABASE_URL`). Iterate on §4 until guards 1–5 pass and `failures` is `[]`.
3. Add `integration.yml`; edit `db-rehearsal.yml` (§1).
4. Docs + decision (§6); issues (§7).
5. `npm run format`, `run-all-gates`, `context-maintenance`, push, PR.

## Done when

- `db-rehearsal.yml` runs nothing beyond `neonctl`, dbmate and `scripts/seed.ts`, and its trigger list is the five paths in §1.2.
- `integration.yml` is green on this PR (it touches `app/tests/integration/**`), with guards 1–5 passing and `skippedSessions === 0` everywhere for `FIXTURE_PLAYER`.
- The decision is recorded; `run-all-gates` and `context-maintenance` have run; the three §7 issues exist.
