# Integration Suite Off Neon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run test:integration` runs against a CI-local `postgres:16` seeded with a hand-written fixture world, and the Neon rehearsal (`db-rehearsal.yml`) does only migrate → seed → migrate → status.

**Architecture:** `statistics-sql.itest.ts` swaps its `neon-http` mock for a `postgres-js` client held in one rolled-back transaction; every statistics call runs sequentially behind a `SAVEPOINT`. A three-file fixture module under `app/tests/integration/fixtures/` inserts one player, eleven completed game sessions (one per `GameTypeKey`) and one completed eleven-step routine run with plain SQL, all inside that transaction. Six guards prove the world is visible and that no server-side fold silently skipped it, then the existing section sweep runs for the fixture player and an absent player. A new `integration.yml` builds Postgres from the migration chain and runs the suite on PRs; `db-rehearsal.yml` loses the test step and seven trigger paths.

**Tech Stack:** Vitest (`vitest.integration.config.ts`), drizzle-orm `postgres-js` driver, `postgres` (postgres-js), GitHub Actions `services:` Postgres 16, dbmate via `npm run db:*:ci`, `gh` CLI for issues.

**Spec:** `docs/superpowers/specs/2026-10-09-integration-suite-off-neon-design.md` (read it first; §"Verified facts" F1–F24 are the facts this plan argues from).

## Status note (2026-10-09, post-merge, PR #856)

Executed and merged. This file was left untracked in the working copy and is committed after the fact; the tasks below are not rewritten. Where the build deviated: the decision landed as **D433**, not D432 (D432 was taken by `feat/game-play-redesign`); `visit-scoring.itest.ts` **was** edited, to import the shared `uuid` and `inRolledBackTx` helpers from `tests/integration/fixtures/itest-db.ts`; guard 5 also counts step-result's per-bucket `skippedSessions`; routine pre-reads report `ok:false` instead of shrinking the sweep; the savepoint is released after `ROLLBACK TO`; `integration.yml` carries more trigger paths than Task 6 lists. The full list is the status note at the top of the spec.

## Global Constraints

- Branch: `ci/integration-suite-off-neon` (already exists, off `main`). Never merge to `main` directly; PR at the end.
- `visit-scoring.itest.ts` is **not** edited.
- All fixture ids are `01990000-0000-7000-8000-0000000aXXXX` with `XXXX` in `a0000`–`affff` (spec §3.2). `FIXTURE_PLAYER = "01990000-0000-7000-8000-0000000a0001"`, `ABSENT_PLAYER = "01990000-0000-7000-8000-00000000ffff"`.
- Lookup ids are always resolved by sub-select on `implementation_key`; never hard-code a SMALLINT or UUID from a seed.
- Every fixture dart carries `location_x`/`location_y` (spec F5). `intended_*` columns stay NULL.
- Game configs are wire form (snake_case) and must satisfy the `.strict()` schemas in `app/src/lib/game/rulesets/types.ts`; exercise configs are camelCase `.strict()` per `app/src/lib/training/exercises/rulesets/types.ts` (spec F12, F13, §4.2, §4.4). Copy them from the spec verbatim.
- `DATABASE_URL` for dbmate/seed carries `?sslmode=disable`; `DATABASE_URL` for the test run carries **no** `sslmode` (spec F24).
- Test titles name the fixture world (root `CLAUDE.md`: a test re-pointed at a new input changes its title).
- Comments: `app/tests/**` is exempt from the no-inline-comments gate, but keep comments to JSDoc above declarations anyway.
- Prettier (`cd app && npm run format`) before every commit that touches `app/`; husky runs lint-staged + 14 structural gates on commit — never `--no-verify`.
- Discovered work is filed as a GitHub issue (`capturing-discovered-work` skill), never fixed here.
- Decision id: derive with `bash scripts/next-decision-id.sh` (prints `D432` on 2026-10-09). Use that id everywhere (workflow comment, decision block, docs); re-run before the PR and `bash scripts/renumber-decision.sh <old> <new>` if it moved.

## Review Focus

1. **A `GameTypeKey` added later without a fixture row** must fail compilation, not silently shrink coverage — pinned by `GAME_FIXTURES: Record<GameTypeKey, GameFixture>` and `GAME_KEYS satisfies Record<GameTypeKey, true>` (Task 1, Task 4; `npm run check`).
2. **A statistics call made after the transaction closed** must throw, not open a fresh connection — pinned by the third `it` in Task 1 (`getDb() called outside inRolledBackTx`).
3. **One failing statement must not hide every later one** behind "current transaction is aborted" — pinned by the third `it` in Task 1 (a bad statement followed by a good one; only the bad one is reported).
4. **A fixture config that fails its `.strict()` schema** must fail CI, not fold to zero — pinned by guard 5 (`skippedSessions === 0`) and guard 6 (`sampleSize >= 1`) in Task 1, exercised in Task 4.
5. **The absent player has no routines**, so the routine sweep must still cover the fixture player — pinned by guard 3 (`listTrainedRoutines` contains the fixture routine) in Task 1.

---

## File structure

| File | Responsibility | Task |
| ---- | -------------- | ---- |
| `app/tests/integration/statistics-sql.itest.ts` (modify, full rewrite) | postgres-js harness, rolled-back transaction, savepointed sequential sweep, guards 1–6, three `it`s | 1 |
| `app/tests/integration/fixtures/stats-world-sql.ts` (create) | `Db` type, `uuid`, the two dart scripts, `insertSession` + `insertPlay` SQL | 2 |
| `app/tests/integration/fixtures/stats-routine.ts` (create) | `ROUTINE_STEPS` (11 steps, exact configs), `seedRoutineRun` | 3 |
| `app/tests/integration/fixtures/stats-world.ts` (create) | `FIXTURE_PLAYER`, `GAME_FIXTURES` (11 games), `StatsWorld`, `seedStatsWorld` | 4 |
| `.github/workflows/integration.yml` (create) | PR-time job: Postgres 16 service, migrate → seed → migrate → status, `npm run test:integration` | 5 |
| `.github/workflows/db-rehearsal.yml` (modify) | drop test step + 7 paths, add PR-only concurrency, header comment | 5 |
| `app/tests/CLAUDE.md`, `docs/architecture/05-Database/11-Neon-Integration.md`, `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`, `decisions/context-system.md` (modify) | docs + decision | 6 |
| GitHub issues ×5 | discovered work | 7 |

---

### Task 1: Rewrite the harness and guards in `statistics-sql.itest.ts`

**Files:**
- Modify: `app/tests/integration/statistics-sql.itest.ts` (replace the whole file)

**Interfaces:**
- Consumes (from Task 4, `./fixtures/stats-world`): `FIXTURE_PLAYER: string`, `type StatsWorld = { playerId: string; gameSessions: Record<GameTypeKey, string>; routine: { routineKey: string; stepKinds: readonly string[] } }`, `seedStatsWorld(db: Db): Promise<StatsWorld>`.
- Consumes (from Task 2, `./fixtures/stats-world-sql`): `type Db = PostgresJsDatabase<typeof schema>`.
- Produces: nothing other tasks import.

- [ ] **Step 1: Replace the file with the new harness**

Write `app/tests/integration/statistics-sql.itest.ts` with exactly this content:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@db/schema";
import type { GameTypeKey } from "@lib/types";
import type { Db } from "./fixtures/stats-world-sql";
import { FIXTURE_PLAYER, seedStatsWorld } from "./fixtures/stats-world";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

/** The rolled-back transaction every statistics call runs in; `null` outside one. */
let current: Db | null = null;

vi.mock("@db/client", () => ({
  getDb: () => {
    if (current === null) {
      throw new Error("getDb() called outside inRolledBackTx");
    }
    return current;
  },
}));

const { sectionsForGame, sectionsForStep, sectionsForRoutine } =
  await import("@lib/stats/section-registry");
const { STEP_METRIC_SPECS } = await import("@modules/stats/step-metrics.module");
const stats = await import("@services/statistics.service");

type Call = { label: string; player: string; run: () => Promise<unknown> };

/** Compile-time coverage: a new `GameTypeKey` fails `tsc` until it is listed here. */
const GAME_KEYS = {
  "501": true,
  TUOD: true,
  ONE_TWENTY_ONE: true,
  SCORE_TRAINING: true,
  SINGLES_TRAINING: true,
  DOUBLES_TRAINING: true,
  BOBS27: true,
  SHANGHAI: true,
  AROUND_THE_CLOCK: true,
  CRICKET: true,
  TACTICS: true,
} satisfies Record<GameTypeKey, true>;
const GAMES = Object.keys(GAME_KEYS) as GameTypeKey[];

const RANGE = { from: "2020-01-01T00:00:00Z", to: "2030-01-01T00:00:00Z" };
const RANGES = [
  { ...RANGE, bucket: "none" as const },
  { ...RANGE, bucket: "month" as const, tz: "Europe/Amsterdam" },
];
const GAME_QUERY = { context: "all", inputMode: "VISUAL_BOARD" } as const;
const ABSENT_PLAYER = "01990000-0000-7000-8000-00000000ffff";
const PLAYERS = [ABSENT_PLAYER, FIXTURE_PLAYER];

/**
 * Games whose sections go through the X01 visit fold, which drops an
 * undecodable config without any counter (spec F21). `sampleSize >= 1` on
 * the named section proves the fold saw the fixture session.
 */
const X01_GUARDS = [
  ["501", "leg-stats"],
  ["TUOD", "bust-rate"],
  ["ONE_TWENTY_ONE", "bust-rate"],
] as const;

class Rollback extends Error {}

/**
 * Runs `body` in a transaction that always rolls back and publishes the
 * transaction handle to the `@db/client` mock for the duration.
 */
async function inRolledBackTx<T>(body: (db: Db) => Promise<T>): Promise<T> {
  const client = postgres(process.env.DATABASE_URL as string, { max: 1 });
  const db = drizzle(client, { schema });
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      current = tx as unknown as Db;
      result = await body(current);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  } finally {
    current = null;
    await client.end();
  }
  return result as T;
}

function skippedSessionsOf(result: unknown): number | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as { ok?: boolean; data?: { skippedSessions?: unknown } };
  if (r.ok !== true || typeof r.data !== "object" || r.data === null) {
    return null;
  }
  const value = r.data.skippedSessions;
  return typeof value === "number" ? value : null;
}

function totalSampleSize(result: unknown): number {
  const r = result as {
    ok?: boolean;
    data?: { buckets?: { sampleSize: number }[] };
  };
  if (r?.ok !== true || !Array.isArray(r.data?.buckets)) return 0;
  return r.data.buckets.reduce((n, bucket) => n + bucket.sampleSize, 0);
}

type Sweep = { failed: string[]; skipped: string[] };

/**
 * Runs `calls` one at a time, each behind a savepoint so a statement error
 * cannot abort the transaction for the calls after it. A throw is a
 * statement error (grouping, type resolution); `ok: false` is a handled
 * outcome. For the fixture player, any `ok` response reporting a non-zero
 * `skippedSessions` is a guard-5 violation.
 */
async function sweep(db: Db, calls: Call[]): Promise<Sweep> {
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const call of calls) {
    await db.execute(sql`SAVEPOINT stat_call`);
    try {
      const result = await call.run();
      await db.execute(sql`RELEASE SAVEPOINT stat_call`);
      const count = skippedSessionsOf(result);
      if (call.player === FIXTURE_PLAYER && count !== null && count !== 0) {
        skipped.push(`${call.label}: skippedSessions=${count}`);
      }
    } catch (err) {
      await db.execute(sql`ROLLBACK TO SAVEPOINT stat_call`);
      failed.push(`${call.label}: ${(err as Error).message}`);
    }
  }
  return { failed, skipped };
}

function perRange(
  label: string,
  player: string,
  run: (range: (typeof RANGES)[number]) => Promise<unknown>,
): Call[] {
  return RANGES.map((range) => ({
    label: `${label}/${range.bucket}`,
    player,
    run: () => run(range),
  }));
}

function gameCalls(player: string, game: GameTypeKey): Call[] {
  const sessions: Call = {
    label: `sessions ${game} ${player}`,
    player,
    run: () =>
      stats.listGameSessions(player, game, {
        ...RANGES[0],
        ...GAME_QUERY,
        limit: 5,
      }),
  };
  const sections = sectionsForGame(game).flatMap((id) =>
    perRange(`${game}/${id} ${player}`, player, (range) =>
      stats.getGameSection(player, game, id, { ...range, ...GAME_QUERY }),
    ),
  );
  return [sessions, ...sections];
}

type StepDescriptor = Parameters<typeof sectionsForStep>[0] & {
  stepKey: string;
};

function stepCalls(player: string, key: string, step: StepDescriptor): Call[] {
  const label = `${key}/${step.stepKey}`;
  const sessions: Call = {
    label: `${label}/sessions`,
    player,
    run: () =>
      stats.listRoutineStepSessions(player, key, step.stepKey, {
        ...RANGE,
        limit: 5,
      }),
  };
  const sections = sectionsForStep(step).sections.flatMap((section) =>
    perRange(`${label}/${section.id}`, player, (range) =>
      stats.getRoutineStepSection(player, key, step.stepKey, section.id, range),
    ),
  );
  return [sessions, ...sections];
}

async function routineCalls(player: string, key: string): Promise<Call[]> {
  const header: Call = {
    label: `header ${key}`,
    player,
    run: () => stats.getRoutineHeader(player, key),
  };
  const sections = sectionsForRoutine().flatMap((section) =>
    perRange(`${key}/${section.id}`, player, (range) =>
      stats.getRoutineSection(player, key, section.id, range),
    ),
  );
  const described = await stats.getRoutineHeader(player, key);
  const steps = described.ok
    ? described.data.steps.flatMap((step) => stepCalls(player, key, step))
    : [];
  return [header, ...sections, ...steps];
}

async function routineKeys(player: string): Promise<string[]> {
  const listed = await stats.listTrainedRoutines(player);
  return listed.ok ? listed.data.items.map((item) => item.routineKey) : [];
}

describe("statistics SQL executes against Postgres", () => {
  it("runs every game section, list and the overview against the stats world and an absent player", async () => {
    await inRolledBackTx(async (db) => {
      const world = await seedStatsWorld(db);

      expect(Object.keys(world.gameSessions).sort()).toEqual([...GAMES].sort());
      for (const game of GAMES) {
        expect(world.gameSessions[game], `${game} session id`).toMatch(
          /^01990000-0000-7000-8000-0000000a/,
        );
        const listed = await stats.listGameSessions(FIXTURE_PLAYER, game, {
          ...RANGES[0],
          ...GAME_QUERY,
          limit: 5,
        });
        if (!listed.ok) {
          throw new Error(`${game} sessions: ${JSON.stringify(listed)}`);
        }
        expect(
          listed.data.items.length,
          `${game} is visible in v_stats_session_facts`,
        ).toBeGreaterThanOrEqual(1);
      }

      for (const [game, section] of X01_GUARDS) {
        const id = sectionsForGame(game).find((candidate) => candidate === section);
        if (id === undefined) throw new Error(`${game} does not offer ${section}`);
        const result = await stats.getGameSection(FIXTURE_PLAYER, game, id, {
          ...RANGES[0],
          ...GAME_QUERY,
        });
        expect(
          totalSampleSize(result),
          `${game}/${section} sampleSize (X01 fold decoded the config)`,
        ).toBeGreaterThanOrEqual(1);
      }

      const calls: Call[] = PLAYERS.flatMap((player) => [
        {
          label: `overview ${player}`,
          player,
          run: () => stats.getStatisticsOverview(player),
        },
        ...GAMES.flatMap((game) => gameCalls(player, game)),
      ]);
      const result = await sweep(db, calls);
      expect(result.failed).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });

  it("runs every routine and step section for the stats world routine and an absent player", async () => {
    await inRolledBackTx(async (db) => {
      const world = await seedStatsWorld(db);

      expect(world.routine.stepKinds).toHaveLength(11);
      const listed = await stats.listTrainedRoutines(FIXTURE_PLAYER);
      if (!listed.ok) {
        throw new Error(`trained routines: ${JSON.stringify(listed)}`);
      }
      expect(listed.data.items.map((item) => item.routineKey)).toContain(
        world.routine.routineKey,
      );

      const header = await stats.getRoutineHeader(
        FIXTURE_PLAYER,
        world.routine.routineKey,
      );
      if (!header.ok) {
        throw new Error(`routine header: ${JSON.stringify(header)}`);
      }
      const kinds = header.data.steps.map((step) => step.exerciseTypeKey);
      expect(
        header.data.steps.map((step) => sectionsForStep(step).kind),
      ).toContain("game");
      for (const kind of Object.keys(STEP_METRIC_SPECS)) {
        expect(kinds, `routine has a ${kind} step`).toContain(kind);
      }
      expect(kinds).toContain("WARM_UP");

      const calls: Call[] = [];
      for (const player of PLAYERS) {
        for (const key of await routineKeys(player)) {
          calls.push(...(await routineCalls(player, key)));
        }
      }
      const result = await sweep(db, calls);
      expect(result.failed).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });

  it("isolates statement errors behind savepoints and refuses getDb() outside the transaction", async () => {
    const result = await inRolledBackTx(async (db) =>
      sweep(db, [
        {
          label: "bad",
          player: ABSENT_PLAYER,
          run: () => db.execute(sql`SELECT no_such_column FROM players`),
        },
        {
          label: "good",
          player: ABSENT_PLAYER,
          run: () => db.execute(sql`SELECT 1`),
        },
      ]),
    );
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatch(/^bad: /);
    expect(result.skipped).toEqual([]);

    await expect(stats.getStatisticsOverview(ABSENT_PLAYER)).rejects.toThrow(
      /outside inRolledBackTx/,
    );
  });
});
```

- [ ] **Step 2: Run the suite to confirm it fails for the right reason**

Start a local Postgres and build it (this container is reused by Tasks 2–4):

```bash
docker run -d --name itest-pg -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=integration -p 5432:5432 postgres:16
sleep 5
cd app
export DATABASE_URL='postgres://postgres:ci@localhost:5432/integration?sslmode=disable'
npm run db:migrate:ci || echo "first pass stopped; seeding, then retrying"
npm run db:seed:ci
npm run db:migrate:ci
npm run db:status:ci
```

Then run the suite with the postgres-js URL (no `sslmode`, spec F24):

```bash
cd app && DATABASE_URL='postgres://postgres:ci@localhost:5432/integration' npm run test:integration
```

Expected: `statistics-sql.itest.ts` FAILS to load with `Failed to resolve import "./fixtures/stats-world-sql"` (or `./fixtures/stats-world`). `visit-scoring.itest.ts` PASSES (2 tests) — this also proves the `sslmode`-free URL works for postgres-js.

- [ ] **Step 3: Commit the red test**

```bash
cd app && npm run format && cd ..
git add app/tests/integration/statistics-sql.itest.ts
git commit -m "test(integration): statistics suite runs off a fixture world in a rolled-back postgres-js transaction

Red: fixtures/stats-world does not exist yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Fixture SQL helpers — `stats-world-sql.ts`

**Files:**
- Create: `app/tests/integration/fixtures/stats-world-sql.ts`

**Interfaces:**
- Produces: `type Db`, `uuid(n: number): string`, `type ZoneKey`, `type ScriptDart`, `type DartScript`, `UNIVERSAL_SCRIPT: DartScript`, `CHECKOUT_170_SCRIPT: DartScript`, `type SessionSpec`, `insertSession(db: Db, spec: SessionSpec): Promise<string>` (returns the session id). Tasks 3 and 4 import these.

- [ ] **Step 1: Write the module**

```ts
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

/** The transaction handle every fixture insert and every statistics read uses. */
export type Db = PostgresJsDatabase<typeof schema>;

/** UUIDv7-shaped literal; `n` is the low 48 bits (spec §3.2: `0xa0000`–`0xaffff`). */
export function uuid(n: number): string {
  return `01990000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

export type ZoneKey =
  | "SINGLE"
  | "DOUBLE"
  | "TREBLE"
  | "OUTER_BULL"
  | "INNER_BULL"
  | "MISS";

/** One scripted dart: a `MISS` has `target: null` (spec F14). */
export type ScriptDart = {
  target: number | null;
  zone: ZoneKey;
  score: number;
  x: number;
  y: number;
};

/** Turns of darts, in play order. */
export type DartScript = readonly (readonly ScriptDart[])[];

function dart(
  target: number | null,
  zone: ZoneKey,
  score: number,
  x: number,
  y: number,
): ScriptDart {
  return { target, zone, score, x, y };
}

/**
 * Spec §4.3: 3 turns × 3 darts, used by every game except `501` and by every
 * dart-kind routine step. Safe for every walker and fold (spec F19–F21).
 */
export const UNIVERSAL_SCRIPT: DartScript = [
  [dart(20, "TREBLE", 60, 0, -103), dart(20, "SINGLE", 20, 2, -130), dart(20, "DOUBLE", 40, -1, -165)],
  [dart(19, "SINGLE", 19, -40, 120), dart(25, "OUTER_BULL", 25, 8, 6), dart(null, "MISS", 0, 190, 10)],
  [dart(25, "INNER_BULL", 50, 1, -2), dart(19, "TREBLE", 57, -55, 90), dart(16, "DOUBLE", 32, 90, 140)],
];

/** Spec §4.3: one visit that checks out 170 (T20, T20, bull) — the `501` script. */
export const CHECKOUT_170_SCRIPT: DartScript = [
  [dart(20, "TREBLE", 60, 0, -103), dart(20, "TREBLE", 60, 1, -104), dart(25, "INNER_BULL", 50, 1, -2)],
];

/**
 * One completed `exercise_sessions` row and its satellites. `base` is the id
 * block: `+0` session, `+1` stage, `+2` owner seat, `+3` configuration,
 * `+0x10..` turns, `+0x40..` darts (spec §3.2). `captured` selects the
 * `ANALYTICS`/`VISUAL_BOARD` pair; `false` leaves both NULL (a Warm-Up).
 * `play: null` writes no stage, seat, turn or dart.
 */
export type SessionSpec = {
  base: number;
  activityId: string;
  playerId: string;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  rulesetVersionKey: string | null;
  captured: boolean;
  routineStepSequenceNumber: number | null;
  configuration: Record<string, unknown>;
  play: { stageTypeKey: "LEG" | "ROUND" | "EXERCISE_BLOCK"; script: DartScript } | null;
};

async function insertPlay(
  db: Db,
  spec: SessionSpec,
  sessionId: string,
  play: NonNullable<SessionSpec["play"]>,
): Promise<void> {
  const stageId = uuid(spec.base + 1);
  const seatId = uuid(spec.base + 2);
  await db.execute(sql`
    INSERT INTO exercise_stages (id, exercise_session_id, parent_stage_id, stage_type_id, sequence_number, created_at)
    VALUES (${stageId}::uuid, ${sessionId}::uuid, NULL,
      (SELECT id FROM stage_types WHERE implementation_key = ${play.stageTypeKey}), 1, now())`);
  await db.execute(sql`
    INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
    VALUES (${seatId}::uuid, ${sessionId}::uuid,
      (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
      ${spec.playerId}::uuid, 'Stats World', now())`);
  for (const [turnIndex, turn] of play.script.entries()) {
    const turnId = uuid(spec.base + 0x10 + turnIndex);
    const total = turn.reduce((sum, d) => sum + d.score, 0);
    await db.execute(sql`
      INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
      VALUES (${turnId}::uuid, ${stageId}::uuid, ${seatId}::uuid, ${turnIndex + 1}, ${total}, now(), now())`);
    for (const [dartIndex, d] of turn.entries()) {
      await db.execute(sql`
        INSERT INTO darts (id, turn_id, dart_number, intended_target_number, intended_zone_id,
          hit_target_number, hit_zone_id, score, location_x, location_y, created_at)
        VALUES (${uuid(spec.base + 0x40 + turnIndex * 3 + dartIndex)}::uuid, ${turnId}::uuid, ${dartIndex + 1},
          NULL, NULL, ${d.target},
          (SELECT id FROM dart_zones WHERE implementation_key = ${d.zone}),
          ${d.score}, ${d.x}, ${d.y}, now())`);
    }
  }
}

/**
 * Inserts one completed session (status `COMPLETED`, started an hour ago,
 * completed now) with its `exercise_configurations` row, then its play.
 * Every lookup is a sub-select on `implementation_key`; a NULL key yields a
 * NULL id, which the NOT NULL columns reject loudly. Returns the session id.
 */
export async function insertSession(db: Db, spec: SessionSpec): Promise<string> {
  const sessionId = uuid(spec.base);
  const captureKey = spec.captured ? "ANALYTICS" : null;
  const inputKey = spec.captured ? "VISUAL_BOARD" : null;
  await db.execute(sql`
    INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
      game_type_id, ruleset_version_id, capture_mode_id, input_mode_id, status_id,
      routine_step_sequence_number, started_at, completed_at, created_at)
    VALUES (${sessionId}::uuid, ${spec.activityId}::uuid, ${spec.playerId}::uuid,
      (SELECT id FROM exercise_types WHERE implementation_key = ${spec.exerciseTypeKey}),
      (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = ${spec.exerciseRulesetVersionKey}),
      (SELECT id FROM game_types WHERE implementation_key = ${spec.gameTypeKey}),
      (SELECT id FROM ruleset_versions WHERE implementation_key = ${spec.rulesetVersionKey}),
      (SELECT id FROM capture_modes WHERE implementation_key = ${captureKey}),
      (SELECT id FROM input_modes WHERE implementation_key = ${inputKey}),
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      ${spec.routineStepSequenceNumber}, now() - interval '1 hour', now(), now())`);
  await db.execute(sql`
    INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
    VALUES (${uuid(spec.base + 3)}::uuid, ${sessionId}::uuid, ${JSON.stringify(spec.configuration)}::jsonb, now())`);
  if (spec.play !== null) await insertPlay(db, spec, sessionId, spec.play);
  return sessionId;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd app && npm run check
```

Expected: errors only from `tests/integration/statistics-sql.itest.ts` (`Cannot find module './fixtures/stats-world'`); none from `stats-world-sql.ts`. (`npm run check` is `astro check --minimumFailingSeverity hint` and takes about a minute.)

- [ ] **Step 3: Commit**

```bash
cd app && npm run format && cd ..
git add app/tests/integration/fixtures/stats-world-sql.ts
git commit -m "test(integration): fixture SQL helpers — session, play and the two dart scripts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Routine run fixture — `stats-routine.ts`

**Files:**
- Create: `app/tests/integration/fixtures/stats-routine.ts`

**Interfaces:**
- Consumes (Task 2): `Db`, `uuid`, `UNIVERSAL_SCRIPT`, `DartScript`, `insertSession`, `SessionSpec`.
- Produces: `ROUTINE_TEMPLATE_ID: string`, `type RoutineStep`, `ROUTINE_STEPS: readonly RoutineStep[]`, `seedRoutineRun(db: Db, playerId: string, fiveOhOne: { configuration: Record<string, unknown>; script: DartScript }): Promise<{ routineKey: string; stepKinds: readonly string[] }>`. Task 4 imports `seedRoutineRun`.

- [ ] **Step 1: Write the module**

```ts
import { sql } from "drizzle-orm";
import {
  insertSession,
  UNIVERSAL_SCRIPT,
  uuid,
  type DartScript,
  type Db,
} from "./stats-world-sql";

const ROUTINE_ACTIVITY_ID = uuid(0xa2000);
const ROUTINE_CONFIG_ID = uuid(0xa2001);
/** Doubles as `routine_key` in `v_stats_routine_run_facts` (spec F7). */
export const ROUTINE_TEMPLATE_ID = uuid(0xa20f1);
const ROUTINE_NAME = "Stats World Routine";
const STEP_DURATION_SECONDS = 300;

/** One element of `activity_configurations.configuration.steps` — exactly the keys the app writes (spec F8). */
export type RoutineStep = {
  sequenceNumber: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  durationSeconds: number;
  configuration: Record<string, unknown>;
};

function exerciseStep(
  sequenceNumber: number,
  kind: string,
  configuration: Record<string, unknown>,
): RoutineStep {
  return {
    sequenceNumber,
    exerciseTypeKey: kind,
    exerciseRulesetVersionKey: `${kind}_V1`,
    gameTypeKey: null,
    gameRulesetVersionKey: null,
    durationSeconds: STEP_DURATION_SECONDS,
    configuration,
  };
}

/**
 * Spec §4.4: Warm-Up, the nine dart kinds (every `STEP_METRIC_SPECS` key),
 * then a 501 game step whose configuration is filled in by `seedRoutineRun`.
 * Configs are the camelCase V1 shapes, literals included (spec F13).
 */
export const ROUTINE_STEPS: readonly RoutineStep[] = [
  exerciseStep(1, "WARM_UP", {
    phases: [{ name: "Upper", targets: [20], weight: 1 }],
    stepDurationSeconds: 60,
  }),
  exerciseStep(2, "SWITCHING", {
    targets: [20, 19],
    scoring: { single: 1, double: 2, treble: 3 },
  }),
  exerciseStep(3, "DOUBLE_PATTERN", { patterns: [[20, 16]] }),
  exerciseStep(4, "TARGET_SCORING", { targets: [20, 19, 18, 25] }),
  exerciseStep(5, "SWITCHING_TARGET_SCORING", { targets: [20, 19, 18] }),
  exerciseStep(6, "SCORE_THRESHOLD", { threshold: 65 }),
  exerciseStep(7, "BULLSEYE_CHECKOUT", { startScore: 81 }),
  exerciseStep(8, "BULL_UP", {}),
  exerciseStep(9, "CHECKOUT_SEQUENCE", {
    firstOutshot: 61,
    lastOutshot: 100,
    dartLimit: 6,
  }),
  exerciseStep(10, "RANDOM_CHECKOUT", {
    minStart: 40,
    maxStart: 170,
    drawSeed: 1,
  }),
  {
    sequenceNumber: 11,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    gameTypeKey: "501",
    gameRulesetVersionKey: "501_V1",
    durationSeconds: STEP_DURATION_SECONDS,
    configuration: {},
  },
];

/**
 * Inserts one completed routine activity, its `activity_configurations`
 * snapshot and one completed step session per `ROUTINE_STEPS` element
 * (spec §4.4). The Warm-Up has no capture pair and no play; dart kinds play
 * `UNIVERSAL_SCRIPT` on an `EXERCISE_BLOCK`; the game step plays the 501
 * fixture's own config and script on a `LEG`.
 */
export async function seedRoutineRun(
  db: Db,
  playerId: string,
  fiveOhOne: { configuration: Record<string, unknown>; script: DartScript },
): Promise<{ routineKey: string; stepKinds: readonly string[] }> {
  const steps = ROUTINE_STEPS.map((step) =>
    step.exerciseTypeKey === "GAME"
      ? { ...step, configuration: fiveOhOne.configuration }
      : step,
  );
  await db.execute(sql`
    INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
    VALUES (${ROUTINE_ACTIVITY_ID}::uuid, ${playerId}::uuid,
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      now() - interval '1 hour', now(), now())`);
  const snapshot = {
    routineTemplateId: ROUTINE_TEMPLATE_ID,
    routineName: ROUTINE_NAME,
    steps,
  };
  await db.execute(sql`
    INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
    VALUES (${ROUTINE_CONFIG_ID}::uuid, ${ROUTINE_ACTIVITY_ID}::uuid, ${JSON.stringify(snapshot)}::jsonb, now())`);

  for (const step of steps) {
    const isWarmUp = step.exerciseTypeKey === "WARM_UP";
    const isGame = step.exerciseTypeKey === "GAME";
    await insertSession(db, {
      base: 0xa2000 + step.sequenceNumber * 0x100,
      activityId: ROUTINE_ACTIVITY_ID,
      playerId,
      exerciseTypeKey: step.exerciseTypeKey,
      exerciseRulesetVersionKey: step.exerciseRulesetVersionKey,
      gameTypeKey: step.gameTypeKey,
      rulesetVersionKey: step.gameRulesetVersionKey,
      captured: !isWarmUp,
      routineStepSequenceNumber: step.sequenceNumber,
      configuration: step.configuration,
      play: isWarmUp
        ? null
        : isGame
          ? { stageTypeKey: "LEG", script: fiveOhOne.script }
          : { stageTypeKey: "EXERCISE_BLOCK", script: UNIVERSAL_SCRIPT },
    });
  }

  return {
    routineKey: ROUTINE_TEMPLATE_ID,
    stepKinds: steps.map((step) => step.exerciseTypeKey),
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd app && npm run check
```

Expected: still only the `./fixtures/stats-world` resolution error from the test; none from `stats-routine.ts`.

- [ ] **Step 3: Commit**

```bash
cd app && npm run format && cd ..
git add app/tests/integration/fixtures/stats-routine.ts
git commit -m "test(integration): routine-run fixture — eleven steps covering every dart kind, Warm-Up and a 501 game

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Stats world — `stats-world.ts`, and the suite goes green

**Files:**
- Create: `app/tests/integration/fixtures/stats-world.ts`

**Interfaces:**
- Consumes (Task 2): `Db`, `uuid`, `UNIVERSAL_SCRIPT`, `CHECKOUT_170_SCRIPT`, `DartScript`, `insertSession`. (Task 3): `seedRoutineRun`.
- Produces (Task 1 imports): `FIXTURE_PLAYER`, `type StatsWorld`, `seedStatsWorld`. Also `GAME_FIXTURES: Record<GameTypeKey, GameFixture>`.

- [ ] **Step 1: Write the module**

```ts
import { sql } from "drizzle-orm";
import type { GameTypeKey } from "@lib/types";
import { seedRoutineRun } from "./stats-routine";
import {
  CHECKOUT_170_SCRIPT,
  insertSession,
  UNIVERSAL_SCRIPT,
  uuid,
  type DartScript,
  type Db,
} from "./stats-world-sql";

export const FIXTURE_PLAYER = uuid(0xa0001);
const STANDALONE_ACTIVITY_ID = uuid(0xa0010);

export type StatsWorld = {
  playerId: string;
  gameSessions: Record<GameTypeKey, string>;
  routine: { routineKey: string; stepKinds: readonly string[] };
};

type GameFixture = {
  rulesetVersionKey: string;
  stageTypeKey: "LEG" | "ROUND" | "EXERCISE_BLOCK";
  configuration: Record<string, unknown>;
  script: DartScript;
};

const TARGET_ORDER_1_TO_20_THEN_BULL = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
];

/**
 * Spec §4.2: the highest seeded ruleset version per game, its stage type
 * (spec F11) and a wire-form config that satisfies its `.strict()` schema
 * (spec F12). `501` starts at 170 so `CHECKOUT_170_SCRIPT` finishes the leg
 * (spec F21). Typed `Record<GameTypeKey, …>` so a new game fails `tsc` until
 * it has a row here.
 */
export const GAME_FIXTURES: Record<GameTypeKey, GameFixture> = {
  "501": {
    rulesetVersionKey: "501_V1",
    stageTypeKey: "LEG",
    configuration: {
      starting_score: 170,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
    script: CHECKOUT_170_SCRIPT,
  },
  TUOD: {
    rulesetVersionKey: "TUOD_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      starting_target: 10,
      finish_bonus: 1,
      miss_penalty: 1,
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
    script: UNIVERSAL_SCRIPT,
  },
  ONE_TWENTY_ONE: {
    rulesetVersionKey: "121_V2",
    stageTypeKey: "ROUND",
    configuration: { duration_type: "ROUNDS", duration_value: 10 },
    script: UNIVERSAL_SCRIPT,
  },
  SCORE_TRAINING: {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
    script: UNIVERSAL_SCRIPT,
  },
  SINGLES_TRAINING: {
    rulesetVersionKey: "SINGLES_V3",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER_1_TO_20_THEN_BULL,
      difficulty: "EASY",
      scoring_mode: "STANDARD",
      points_single: 1,
      points_double: 2,
      points_treble: 3,
    },
    script: UNIVERSAL_SCRIPT,
  },
  DOUBLES_TRAINING: {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      mode: "EASY",
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER_1_TO_20_THEN_BULL,
    },
    script: UNIVERSAL_SCRIPT,
  },
  BOBS27: {
    rulesetVersionKey: "BOBS27_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      start_score: 27,
      bull_hit_value: 50,
      miss_penalty_multiplier: 1,
    },
    script: UNIVERSAL_SCRIPT,
  },
  SHANGHAI: {
    rulesetVersionKey: "SHANGHAI_V2",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: { difficulty: "NORMAL" },
    script: UNIVERSAL_SCRIPT,
  },
  AROUND_THE_CLOCK: {
    rulesetVersionKey: "AROUND_THE_CLOCK_V2",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      path_direction: "LOW_TO_HIGH",
      odds_first: false,
      segment_rule: "ANY",
      difficulty: "EASY",
      duration_type: "UNTIMED",
      duration_value: null,
    },
    script: UNIVERSAL_SCRIPT,
  },
  CRICKET: {
    rulesetVersionKey: "CRICKET_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {},
    script: UNIVERSAL_SCRIPT,
  },
  TACTICS: {
    rulesetVersionKey: "TACTICS_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {},
    script: UNIVERSAL_SCRIPT,
  },
};

/**
 * Inserts the whole fixture world (spec §3–4) through the rolled-back
 * transaction `db`: the player, one standalone activity holding a completed
 * session per `GameTypeKey`, and one completed routine run. Never commits.
 */
export async function seedStatsWorld(db: Db): Promise<StatsWorld> {
  await db.execute(sql`
    INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
    VALUES (${FIXTURE_PLAYER}::uuid, 'itest-stats-world', 'Stats World', now(), now())`);
  await db.execute(sql`
    INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
    VALUES (${STANDALONE_ACTIVITY_ID}::uuid, ${FIXTURE_PLAYER}::uuid,
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      now() - interval '1 hour', now(), now())`);

  const games = Object.keys(GAME_FIXTURES) as GameTypeKey[];
  const gameSessions = {} as Record<GameTypeKey, string>;
  for (const [index, game] of games.entries()) {
    const fixture = GAME_FIXTURES[game];
    gameSessions[game] = await insertSession(db, {
      base: 0xa1000 + index * 0x100,
      activityId: STANDALONE_ACTIVITY_ID,
      playerId: FIXTURE_PLAYER,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: game,
      rulesetVersionKey: fixture.rulesetVersionKey,
      captured: true,
      routineStepSequenceNumber: null,
      configuration: fixture.configuration,
      play: { stageTypeKey: fixture.stageTypeKey, script: fixture.script },
    });
  }

  const routine = await seedRoutineRun(db, FIXTURE_PLAYER, GAME_FIXTURES["501"]);
  return { playerId: FIXTURE_PLAYER, gameSessions, routine };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd app && npm run check
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Run the suite against the local container**

```bash
cd app && DATABASE_URL='postgres://postgres:ci@localhost:5432/integration' npm run test:integration
```

Expected: both files PASS — `statistics-sql.itest.ts` 3 tests, `visit-scoring.itest.ts` 2 tests.

If a guard fails, read the message and fix **the fixture**, never the guard (spec §4.3, §5):

| Failure | Meaning | Where to look |
| ------- | ------- | ------------- |
| `… sessions:` throws or `items.length` is 0 | the session is not in `v_stats_session_facts`: wrong status/mode key, `dart_count` 0, or participant `player_id` ≠ session `player_id` | spec F5, F6; `insertSession`/`insertPlay` |
| `skippedSessions=N` on a game section | that game's stored config failed `toSnapshot`, or a walker threw | spec F3, F12, F20; `GAME_FIXTURES[game].configuration` |
| `skippedSessions=N` on `step-result` | that step's camelCase config failed its V1 schema | spec F13, §4.4; `ROUTINE_STEPS` |
| `…/leg-stats sampleSize` 0 | the 501 config failed `snapshotOf`, or the leg did not finish | spec F21; `starting_score` must be 170, script `CHECKOUT_170_SCRIPT` |
| `…/bust-rate sampleSize` 0 | TUOD/121 config failed `snapshotOf` | spec F21, §4.2 |
| `routine has a X step` | `ROUTINE_STEPS` misses a kind, or that step's session failed to insert | spec §4.4 |
| a NOT NULL violation on insert | a lookup key is misspelled (sub-select returned NULL) | spec §4.0 keys |

- [ ] **Step 4: Confirm the rollback left nothing behind**

```bash
docker exec itest-pg psql -U postgres -d integration -tAc "SELECT count(*) FROM players WHERE auth_user_id = 'itest-stats-world'"
```

Expected: `0`.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/tests/integration/fixtures/stats-world.ts
git commit -m "test(integration): stats world fixture — one completed session per GameTypeKey plus the routine run

Green: statistics-sql.itest.ts guards 1–6 pass and the sweep reports no failures or skipped sessions.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `integration.yml` and the `db-rehearsal.yml` cut

**Files:**
- Create: `.github/workflows/integration.yml`
- Modify: `.github/workflows/db-rehearsal.yml` (lines 1–27 header + triggers; lines 97–102 test step)

**Interfaces:** none (CI only). The decision id in the comment is the one `bash scripts/next-decision-id.sh` prints (D432 as of writing); Task 6 writes that decision.

- [ ] **Step 1: Derive the decision id**

```bash
git fetch origin main --quiet && bash scripts/next-decision-id.sh
```

Expected: `D432` (use whatever it prints below wherever `D432` appears).

- [ ] **Step 2: Create `.github/workflows/integration.yml`**

```yaml
name: integration

# Executes every statistics section, list and routine read against a Postgres
# built from the migration chain (#653). Runs here, not in db-rehearsal.yml,
# so the suite never reads from a Neon branch (D432).

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
      # postgres-js reads `sslmode=<anything>` as "use SSL", so the suite gets
      # the same database without the query string.
      - name: Statistics SQL executes
        env:
          DATABASE_URL: postgres://postgres:ci@localhost:5432/integration
        run: npm run test:integration
```

- [ ] **Step 3: Edit `.github/workflows/db-rehearsal.yml`**

Replace lines 1–27 (everything before `jobs:`) with:

```yaml
name: db-rehearsal

# Rehearses the pending schema change against a throwaway Neon branch cut from
# production, so nothing is applied to production that has not already applied
# cleanly to production's real shape once (#354). Runs on every PR that touches
# the schema, and as the gate in front of `deploy.yml`'s apply job.
#
# Schema-only: migrate -> seed -> migrate -> status. The statistics integration
# suite runs in integration.yml against a CI-local Postgres, never here (D432).
#
# The rehearsal branch is deleted in an `always()` step: a leaked branch costs
# storage and keeps a compute warm, so the delete is not conditional on success.

on:
  pull_request:
    branches: [main]
    paths:
      - 'database/migrations/**'
      - 'database/seeds/**'
      - 'app/scripts/seed.ts'
      - 'app/package.json'
      - '.github/workflows/db-rehearsal.yml'
  workflow_call:

# PR runs cancel a superseded attempt. `workflow_call` runs inherit deploy.yml's
# `deploy-production` group and must never be cancelled, so the key is inert
# for them: a distinct group per event, cancel only on pull_request.
concurrency:
  group: rehearsal-${{ github.event_name }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

```

Then delete these six lines (the comment and the step, formerly lines 97–102), leaving the `db:verify` comment paragraph that follows them in place:

```yaml
      # Executes every statistics section, list and routine read against the
      # migrated branch: render-only unit tests cannot see grouping or type
      # errors Postgres raises (#653). Needs a seeded player with data to
      # cover routines; the game sections run against an absent player too.
      - name: Statistics SQL executes
        run: npm run test:integration
```

- [ ] **Step 4: Verify the edits mechanically**

```bash
test "$(grep -c "^      - '" .github/workflows/db-rehearsal.yml)" = 5 && echo "paths: 5 OK"
! grep -q "test:integration" .github/workflows/db-rehearsal.yml && echo "no test step OK"
grep -q "db:verify" .github/workflows/db-rehearsal.yml && echo "verify comment kept OK"
grep -c "DATABASE_URL" .github/workflows/integration.yml
ruby -ryaml -e 'ARGV.each { |f| YAML.load_file(f); puts "#{f}: valid YAML" }' .github/workflows/integration.yml .github/workflows/db-rehearsal.yml
```

Expected: `paths: 5 OK`, `no test step OK`, `verify comment kept OK`, `2`, both files `valid YAML`. (If `ruby` is missing, skip the last line; the PR run in Task 8 is the authoritative check.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/integration.yml .github/workflows/db-rehearsal.yml
git commit -m "ci: run the integration suite against a CI-local Postgres; rehearsal is schema-only

Drops the test:integration step and its seven trigger paths from db-rehearsal.yml
(#653 egress), adds integration.yml with a postgres:16 service and a PR-only
concurrency group on the rehearsal.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Docs, decision, inventory, history

**Files:**
- Modify: `app/tests/CLAUDE.md:9`
- Modify: `docs/architecture/05-Database/11-Neon-Integration.md:178`
- Modify: `docs/architecture/00-File-Inventory.md` (row 60; after row 590; after row 613)
- Modify: `docs/architecture/00-Context-Map-History.md` (append one row)
- Modify: `decisions/context-system.md` (append one block)

**Interfaces:** the decision id from Task 5 Step 1 (D432).

- [ ] **Step 1: `app/tests/CLAUDE.md` line 9**

Replace the bullet that begins `- Suites that must run SQL against Postgres live in` with:

```markdown
- Suites that must run SQL against Postgres live in `app/tests/integration/*.itest.ts`, run only by `npm run test:integration` (`vitest.integration.config.ts`; needs `DATABASE_URL`) — in CI, by `.github/workflows/integration.yml` against a `postgres:16` service built from the migration chain; `db-rehearsal.yml` is schema-only. `npm test` never picks them up. Locally, point `DATABASE_URL` at any migrated + seeded Postgres — a container (`docker run -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=integration -p 5432:5432 postgres:16`, then `db:migrate:ci` → `db:seed:ci` → `db:migrate:ci` with `?sslmode=disable`) costs no Neon egress; run the suite itself with the URL **without** `sslmode` (postgres-js reads any `sslmode` value as "use SSL"). `statistics-sql.itest.ts` seeds its own fixture world (`tests/integration/fixtures/`) in a rolled-back transaction and asserts it is visible and never silently skipped before sweeping every section. (#653; D432, 2026-10-09)
```

- [ ] **Step 2: `11-Neon-Integration.md` line 178**

Replace the paragraph that begins `` `db-rehearsal.yml` also runs on its own on any PR touching `` with:

```markdown
`db-rehearsal.yml` also runs on its own on any PR touching `database/migrations/**`, `database/seeds/**`, `app/scripts/seed.ts` or `app/package.json`, so a faulty migration surfaces at review time rather than at merge time. It is schema-only: the statistics integration suite (`npm run test:integration`) runs in `.github/workflows/integration.yml` against a CI-local `postgres:16` built from the same migration chain, so no test reads leave Neon (D432, 2026-10-09). <!-- 2026-10-09 -->
```

- [ ] **Step 3: `00-File-Inventory.md` — three edits**

(a) Row 60 (`11-Neon-Integration.md`): append before the closing ` | canonical |`:

```
; integration suite runs off Neon in `integration.yml`, rehearsal is schema-only (D432, 2026-10-09)
```

(b) After row 590 (`app/tests/CLAUDE.md`), insert:

```markdown
| `app/tests/integration/fixtures/` (`stats-world.ts`, `stats-routine.ts`, `stats-world-sql.ts`) | The statistics integration suite's fixture world: one player, one completed session per `GameTypeKey` and one eleven-step routine run, inserted with plain SQL inside the suite's rolled-back transaction; typed `Record<GameTypeKey, …>` so a new game fails `tsc` until it has a fixture row (2026-10-09, D432) | canonical |
```

(c) After row 613 (`schema.yml`), insert:

```markdown
| `.github/workflows/integration.yml` | PR-time statistics SQL execution against a `postgres:16` service built from the migration chain (migrate → seed → migrate → status, then `npm run test:integration`); replaces the test step `db-rehearsal.yml` carried from #653, so rehearsals are schema-only and the suite never reads a Neon branch (2026-10-09; D432) | canonical |
```

- [ ] **Step 4: `00-Context-Map-History.md` — append one row**

At the end of the table, add:

```markdown
| `docs/superpowers/specs/2026-10-09-integration-suite-off-neon-design.md` + `docs/superpowers/plans/2026-10-09-integration-suite-off-neon.md` | Handoff 1 of the Neon network-transfer diagnosis: the statistics integration suite moves off Neon onto a CI-local `postgres:16` (`integration.yml`), `db-rehearsal.yml` becomes schema-only with a PR-only concurrency group, and `statistics-sql.itest.ts` swaps `neon-http` for `postgres-js` in one rolled-back transaction with a hand-SQL fixture world (`tests/integration/fixtures/`) covering all 11 `GameTypeKey`s and all 9 dart exercise kinds. Six guards make every silent fold skip loud (`skippedSessions === 0`, X01 `sampleSize >= 1`). New **D432** (`decisions/context-system.md`). Filed as `discovered-work`: "seven" vs nine dart kinds JSDoc, `pr-gates.yml` ignoring `*.itest.ts`, root `.neon` unignored, root `CLAUDE.md` migration range vs `0046`, the X01 fold's uncounted skip (2026-10-09) | historical |
```

- [ ] **Step 5: Append the decision to `decisions/context-system.md`**

```markdown

### D432 — The integration suite runs against a CI-local Postgres; the Neon rehearsal is schema-only
Status: Accepted · Date: 2026-10-09
Decision: `npm run test:integration` runs in a new `.github/workflows/integration.yml` against a `postgres:16` service built from the migration chain (migrate → seed → migrate → status, as `schema.yml` does), on PRs touching `database/**`, the seed runner, `app/src/repositories/**`, `statistics.service.ts`, `app/src/lib/stats/**`, `app/src/modules/stats/**`, `app/tests/integration/**`, the integration vitest config, `app/package.json` or the workflow itself. `db-rehearsal.yml` loses its `Statistics SQL executes` step (added by #653) and the seven trigger paths that existed only for it or for `db:verify` (`database/verification/**`, `app/scripts/verify-db.ts`, which nothing in CI runs); it keeps migrations, seeds, `seed.ts`, `app/package.json` and itself, and gains a concurrency group keyed on event name and ref that cancels only `pull_request` runs. `statistics-sql.itest.ts` swaps its `neon-http` mock for a `postgres-js` client held in one rolled-back transaction; `getDb()` throws outside it; every statistics call runs sequentially behind a `SAVEPOINT`. Real-player sampling is removed; the suite runs for an absent player and one fixture player whose world — one completed session per `GameTypeKey` (all 11) and one completed eleven-step routine run (Warm-Up, the nine dart exercise kinds, a 501 game) — is inserted with plain SQL by `app/tests/integration/fixtures/`. Six guards precede the sweep: world shape, every game listed by `listGameSessions`, the routine listed by `listTrainedRoutines`, every `STEP_METRIC_SPECS` kind plus a game step and a Warm-Up resolved by `getRoutineHeader`, `skippedSessions === 0` on every fixture-player response that carries it, and `sampleSize >= 1` on `leg-stats` (501) and `bust-rate` (TUOD, 121). Test titles name the fixture world.
Reason: the handoff of 2026-10-09 measured ~3.27 GB of the billing period's 4.05 GB Neon network transfer (~81%) on deleted `ci-rehearsal-*` branches — ~157 rehearsals at ~21 MB each — and traced it to the integration step #653 added on 2026-10-01: `statistics-sql.itest.ts` read up to three real players' full statistics twice per section, and every result row left Neon for the runner. Nothing in the suite needs production data; it needs populated data. The driver swap is safe because every raw `db.execute` in the stats repository normalises `{ rows }` and row arrays through one helper and both drivers return dates and timestamps as strings. The guards exist because the server-side folds fail quietly: derived-aims and step-result count an undecodable config as `skippedSessions`, and the X01 visit fold drops it with no counter at all, so a hand-written fixture could pass "every section executes" while exercising nothing. `starting_score` 170 for the 501 fixture is what makes `leg-stats` and `bust-rate` observable (a finished leg; visits opening at ≤ 180).
Consequences: a deploy no longer runs the integration suite — PR time is its only run, and `main` has no required status checks, so a red `integration` job blocks nothing by itself; making it required is an owner decision. Two `DATABASE_URL` spellings are deliberate: dbmate needs `?sslmode=disable` against a plain container, postgres-js needs the parameter absent because it treats any `sslmode` value as "use SSL". A new `GameTypeKey` fails `tsc` until it has a fixture row and an entry in the test's key map. A fixture config that drifts from its `.strict()` schema fails CI instead of folding to zero. The suite no longer sees production data shapes at all; `visit-scoring.itest.ts` is unchanged. `database/verification/**` edits no longer trigger any workflow. The X01 fold's uncounted skip remains in production and is filed as discovered work, as are the `pr-gates.yml` heuristic's blindness to `*.itest.ts`, the "seven" dart-kind JSDoc, the unignored root `.neon`, and root `CLAUDE.md`'s migration range lagging `0046`.
Supersedes: none
```

- [ ] **Step 6: Run the doc gates**

```bash
bash scripts/check-decision-ids.sh
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-doc-sync.sh
```

Expected: each prints `OK`. If `check-decision-ids.sh` reports a collision, re-run `bash scripts/next-decision-id.sh` and `bash scripts/renumber-decision.sh D432 <new>`.

- [ ] **Step 7: Commit**

```bash
git add app/tests/CLAUDE.md docs/architecture/05-Database/11-Neon-Integration.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md decisions/context-system.md
git commit -m "docs: integration suite off Neon — D432, inventory rows, Neon-integration and tests guide

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: File the five discovered-work issues

**Files:** none in the repo. Uses `gh issue create` per the `capturing-discovered-work` skill. Before each, a duplicate check: `gh issue list --label discovered-work --search "<distinctive term>" --state open`.

- [ ] **Step 1: "seven" vs nine dart kinds**

```bash
gh issue create --title "[Discovered] section-registry JSDoc says seven dart exercise kinds; STEP_METRIC_SPECS has nine" \
  --label discovered-work --label type:documentation --label severity:trivial \
  --body "$(cat <<'EOF'
## Summary
Two JSDoc comments count the dart exercise kinds as seven; the registry they describe has nine.

## Type
documentation

## Severity
trivial

## Discovery Context
**Found during task:** `ci/integration-suite-off-neon`
**Found:** 2026-10-09

## Problem
**Claim:** `app/src/lib/stats/section-registry.ts:457` and `:476` — "`STEP_METRIC_SPECS`' seven dart exercise kinds".
**Evidence:** `app/src/modules/stats/step-metrics.module.ts:17-73` defines nine keys: SWITCHING, DOUBLE_PATTERN, TARGET_SCORING, SWITCHING_TARGET_SCORING, SCORE_THRESHOLD, BULLSEYE_CHECKOUT, BULL_UP, CHECKOUT_SEQUENCE, RANDOM_CHECKOUT.

## Why It Matters
A reader sizing the routine-step fixture or the step-result fold from the comment under-counts by two.

## Proposed Fix
> Initial hypothesis from time of discovery, not a validated design.
Drop the number from both comments ("`STEP_METRIC_SPECS`' dart exercise kinds").
EOF
)"
```

- [ ] **Step 2: `pr-gates.yml` ignores `*.itest.ts`**

```bash
gh issue create --title "[Discovered] pr-gates.yml test-repointing heuristic scans only *.test.ts; *.itest.ts is invisible" \
  --label discovered-work --label type:infrastructure --label severity:low \
  --body "$(cat <<'EOF'
## Summary
The PR gate that flags a test re-pointed at a different input never looks at integration suites.

## Type
infrastructure

## Severity
low

## Discovery Context
**Found during task:** `ci/integration-suite-off-neon`
**Found:** 2026-10-09

## Problem
**Claim:** root `CLAUDE.md` — a test re-pointed at a different input so it keeps passing is a defect, enforced on PRs.
**Evidence:** `.github/workflows/pr-gates.yml:54` — `git diff --name-only ... -- 'app/tests/**/*.test.ts'`; `app/tests/integration/*.itest.ts` never matches.

## Why It Matters
`statistics-sql.itest.ts` was just re-pointed from real players to a fixture world (title changed, as the rule requires); the gate would not have noticed either way.

## Proposed Fix
> Initial hypothesis from time of discovery, not a validated design.
Widen the pathspec to `'app/tests/**/*.test.ts' 'app/tests/**/*.itest.ts'`.
EOF
)"
```

- [ ] **Step 3: root `.neon` unignored**

```bash
gh issue create --title "[Discovered] root .neon (neonctl artefact) is untracked and not gitignored" \
  --label discovered-work --label type:developer-experience --label severity:trivial \
  --body "$(cat <<'EOF'
## Summary
A `neonctl` context file at the repo root shows up as untracked in every session and nothing ignores it.

## Type
developer-experience

## Severity
trivial

## Discovery Context
**Found during task:** `ci/integration-suite-off-neon`
**Found:** 2026-10-09

## Problem
**Claim:** the committed Neon context is `app/.neon` (`projectId`), read by `db-rehearsal.yml` with `working-directory: app`.
**Evidence:** `git status` shows `?? .neon` at the root containing only `{"orgId": "..."}`; `.gitignore` has no `.neon` entry; `git ls-files .neon` is empty.

## Why It Matters
Noise in `git status` and a standing risk of an `org id` being committed by a careless `git add -A`.

## Proposed Fix
> Initial hypothesis from time of discovery, not a validated design.
Add `/.neon` to the root `.gitignore` (keep `app/.neon` tracked).
EOF
)"
```

- [ ] **Step 4: root `CLAUDE.md` migration range vs `0046`**

```bash
gh issue create --title "[Discovered] root CLAUDE.md says the closed migration chain ends at 0045; 0046 is on main" \
  --label discovered-work --label type:documentation --label severity:low \
  --body "$(cat <<'EOF'
## Summary
The Hard Invariant naming the applied migration range stops at `0045`, one behind the chain on `main`.

## Type
documentation

## Severity
low

## Discovery Context
**Found during task:** `ci/integration-suite-off-neon`
**Found:** 2026-10-09

## Problem
**Claim:** root `CLAUDE.md` Hard Invariants — "Never modify applied migrations (`0001`–`0045`)" and "the whole chain through `0045` is now closed to in-place edits".
**Evidence:** `database/migrations/0046_replay_stages_view.sql` exists on `main`; `database/CLAUDE.md` already says "contiguous (`0001`–`0046`)".

## Why It Matters
The D344 carve-out is decided by this range plus `db:status`/`db:status:prod` proof; a stale range invites editing `0046` in place after it has been applied.

## Proposed Fix
> Initial hypothesis from time of discovery, not a validated design.
Extend the range to `0046` once its production apply is proven (green `deploy` run on its merge commit), citing that run as the earlier extensions do.

## Notes
Whether `0046` is applied to production was not checked here (`db:status:prod` was not run).
EOF
)"
```

- [ ] **Step 5: X01 fold's uncounted skip**

```bash
gh issue create --title "[Discovered] X01 visit fold drops a session whose config no longer decodes without counting it" \
  --label discovered-work --label type:bug --label severity:medium \
  --body "$(cat <<'EOF'
## Summary
`visitsForSession` returns `[]` for an undecodable snapshot, so 501/TUOD/121 checkout sections silently lose sessions; the other folds report `skippedSessions`.

## Type
bug

## Severity
medium

## Discovery Context
**Found during task:** `ci/integration-suite-off-neon`
**Found:** 2026-10-09

## Problem
**Claim:** statistics responses expose silent fold skips as `skippedSessions` (D370).
**Evidence:** `app/src/modules/stats/x01-checkout-sessions.module.ts:206-215` — `if (config === null) return [];` with no counter; `foldLoad` in `statistics.service.ts:429-439` has nowhere to carry one, unlike `stepsLoad` (`:448-457`) and `step-result`.

## Why It Matters
A ruleset schema change that invalidates stored configs would zero `checkout-rate`, `bust-rate`, `leg-stats` etc. for affected sessions with no signal to the user or to CI. The integration suite now guards its own fixture via `sampleSize >= 1` (D432), but production has no equivalent.

## Proposed Fix
> Initial hypothesis from time of discovery, not a validated design.
Have `sessionCheckoutVisits`/`bucketedSessionsFromFoldRows` return `{ sessions, skippedSessions }` like `sessionSteps`, and surface it through `foldLoad` the way `stepsLoad` does.
EOF
)"
```

- [ ] **Step 6: Record the five issue numbers** for the completion report and the PR body.

---

### Task 8: Format, gates, context maintenance, push, PR

**Files:** none new. Runs the repo's finishing procedure (`run-all-gates`, `context-maintenance`, `finishing-a-dart-branch` skills).

- [ ] **Step 1: Re-derive the decision id**

```bash
git fetch origin main --quiet && bash scripts/next-decision-id.sh
```

Expected: `D432`. If different, `bash scripts/renumber-decision.sh D432 <new>` and re-run `bash scripts/check-decision-ids.sh`; amend the last docs commit.

- [ ] **Step 2: Format and the always-run gates**

```bash
cd app && npm run format && npm run format:check && cd ..
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-worktree-location.sh
bash scripts/check-test-coverage.sh
bash scripts/check-doc-sync.sh
bash scripts/check-game-rules.sh
bash scripts/check-decision-ids.sh
```

Expected: every script prints `OK` (`check-test-coverage.sh`: "no runtime source change in this change set" — only tests, workflows and docs changed).

- [ ] **Step 3: The `app/` gates**

```bash
cd app && npm test && npm run check && bash ../scripts/fallow-gate.sh && cd ..
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
bash scripts/check-game-wiring.sh
```

Expected: `npm test` all green (unit suite; `.itest.ts` files are excluded by `vitest.config.ts`), `npm run check` 0/0/0, fallow 0 above threshold, every script `OK`. The full `npm run validate:app` needs a `DATABASE_URL` for `db:status`/`db:migrate`/`db:drift`/`db:introspect`; run it with the container's `?sslmode=disable` URL if the container from Task 1 is still up, otherwise record those four steps as not run (no migration changed in this plan, so the D344 carve-out is not in play).

- [ ] **Step 4: Final local integration run**

```bash
cd app && DATABASE_URL='postgres://postgres:ci@localhost:5432/integration' npm run test:integration && cd ..
docker rm -f itest-pg
```

Expected: 5 tests pass; container removed.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin ci/integration-suite-off-neon
gh pr create --base main --title "ci: run the integration suite off Neon against a CI-local Postgres" --body "$(cat <<'EOF'
Handoff 1 of `docs/superpowers/handoffs/2026-10-09-neon-network-transfer-handoff.md`. Spec: `docs/superpowers/specs/2026-10-09-integration-suite-off-neon-design.md`. Plan: `docs/superpowers/plans/2026-10-09-integration-suite-off-neon.md`.

- `db-rehearsal.yml`: `Statistics SQL executes` step removed (#653 egress), seven trigger paths dropped, PR-only concurrency group; schema-only.
- `integration.yml` (new): `postgres:16` service, migrate → seed → migrate → status, `npm run test:integration`.
- `statistics-sql.itest.ts`: `neon-http` → `postgres-js` in one rolled-back transaction; sequential savepointed sweep; absent player + fixture player; all 11 `GameTypeKey`s; six guards (world shape, `listGameSessions`, `listTrainedRoutines`, `getRoutineHeader` kinds, `skippedSessions === 0`, X01 `sampleSize >= 1`).
- `tests/integration/fixtures/`: hand-SQL world — 11 game sessions, 11-step routine run.
- Decision D432 (`decisions/context-system.md`); docs updated.

Discovered work filed, not fixed: #<n1> (seven vs nine kinds JSDoc), #<n2> (pr-gates ignores `.itest.ts`), #<n3> (root `.neon`), #<n4> (CLAUDE.md migration range vs 0046), #<n5> (X01 fold uncounted skip).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `#<n1>`–`#<n5>` with the numbers from Task 7 before running.

- [ ] **Step 6: Drive the PR to green**

```bash
gh pr checks --watch
```

Expected: `integration` (`statistics-sql`) green — this PR touches `app/tests/integration/**` so it triggers; `db-rehearsal` does **not** run (no path in its new list changed); `quality`, `checks`, `pr-gates` green. On any red check, fix at the cause, commit, push; never `--no-verify`.

- [ ] **Step 7: Completion report**

State: PR link; each gate's result by name; the five issue numbers; that `db-rehearsal.yml` did not trigger on this PR and why; that `validate:app`'s four database steps ran or did not (and why); that the worktree (if any) stays until the PR lands.

---

## Self-review

**Spec coverage.** §1.1 → Task 5 Step 2. §1.2 (five edits) → Task 5 Step 3. §1.3 → D432 Consequences (Task 6). §2.1–2.5 → Task 1 (driver, mock, savepoints, sequential, `GAME_KEYS`, `PLAYERS`, titles). §3 → Tasks 2–4 (ids, exports, timestamps). §4.0–4.3 → Tasks 2 and 4. §4.4 → Task 3. §5 guards 1–6 → Task 1's two `it`s. §6 → Task 6 (Context Map has no row for workflows or itests, so "register" is the History row + Inventory rows). §7 (five items) → Task 7. §8 → task order. "Done when" → Task 8 Steps 6–7.

**Placeholders.** The only `<…>` tokens are the PR body's issue numbers, filled from Task 7, and `<new>` in the renumber fallback.

**Type consistency.** `Db` is defined once in Task 2 and imported by Tasks 1, 3, 4. `SessionSpec.play.stageTypeKey` and `GameFixture.stageTypeKey` share the same union. `seedRoutineRun`'s third parameter accepts `GAME_FIXTURES["501"]` structurally (`configuration`, `script` present; extra keys allowed). `StatsWorld.routine` matches `seedRoutineRun`'s return. `Call` is an object in Task 1 throughout.

**Review Focus.** Items 1–5 each name the task and test that pins them (Task 1's three `it`s, Task 4's `npm run check`).
