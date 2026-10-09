import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { GameTypeKey } from "@lib/types";
import { inRolledBackTx, type Db } from "./fixtures/itest-db";
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
const { STEP_METRIC_SPECS } =
  await import("@modules/stats/step-metrics.module");
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

/**
 * Runs `body` in a rolled-back transaction and publishes its handle to the
 * `@db/client` mock for the duration.
 */
function inStatsTx<T>(body: (db: Db) => Promise<T>): Promise<T> {
  return inRolledBackTx(body, (db) => {
    current = db;
  });
}

/**
 * The skip count a response carries: top-level `data.skippedSessions` (game
 * folds) plus every `buckets[i].metrics.skippedSessions` (routine
 * `step-result`). `null` when the response carries neither.
 */
function skippedSessionsOf(result: unknown): number | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as {
    ok?: boolean;
    data?: {
      skippedSessions?: unknown;
      buckets?: { metrics?: { skippedSessions?: unknown } }[];
    };
  };
  if (r.ok !== true || typeof r.data !== "object" || r.data === null) {
    return null;
  }
  const counts = [
    r.data.skippedSessions,
    ...(Array.isArray(r.data.buckets)
      ? r.data.buckets.map((bucket) => bucket.metrics?.skippedSessions)
      : []),
  ].filter((value): value is number => typeof value === "number");
  return counts.length === 0 ? null : counts.reduce((n, c) => n + c, 0);
}

/**
 * Sum of `buckets[].sampleSize`. Proves a fold decoded the config only for
 * the X01 game sections (guard 6): step sections count skipped sessions in
 * `sampleSize` too (`step-result.module.ts`), so do not extend `X01_GUARDS`
 * to them — guard 5 is their check.
 */
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
      // ROLLBACK TO keeps the savepoint alive; release it so a failed call
      // does not leave one nested savepoint per failure for the tx lifetime.
      await db.execute(sql`ROLLBACK TO SAVEPOINT stat_call`);
      await db.execute(sql`RELEASE SAVEPOINT stat_call`);
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

/**
 * A read the sweep's call list is built from. A throw or an `ok: false`
 * lands in `failed` instead of quietly shrinking the list; the savepoint
 * keeps a throw from aborting the transaction.
 */
async function preRead<T>(
  db: Db,
  failed: string[],
  label: string,
  run: () => Promise<{ ok: true; data: T } | { ok: false }>,
): Promise<T | null> {
  await db.execute(sql`SAVEPOINT stat_call`);
  try {
    const result = await run();
    await db.execute(sql`RELEASE SAVEPOINT stat_call`);
    if (result.ok) return result.data;
    failed.push(`${label}: ${JSON.stringify(result)}`);
  } catch (err) {
    await db.execute(sql`ROLLBACK TO SAVEPOINT stat_call`);
    await db.execute(sql`RELEASE SAVEPOINT stat_call`);
    failed.push(`${label}: ${(err as Error).message}`);
  }
  return null;
}

async function routineCalls(
  db: Db,
  failed: string[],
  player: string,
  key: string,
): Promise<Call[]> {
  const sections = sectionsForRoutine().flatMap((section) =>
    perRange(`${key}/${section.id}`, player, (range) =>
      stats.getRoutineSection(player, key, section.id, range),
    ),
  );
  const header = await preRead(db, failed, `header ${key}`, () =>
    stats.getRoutineHeader(player, key),
  );
  const steps = (header?.steps ?? []).flatMap((step) =>
    stepCalls(player, key, step),
  );
  return [...sections, ...steps];
}

async function routineKeys(
  db: Db,
  failed: string[],
  player: string,
): Promise<string[]> {
  const listed = await preRead(db, failed, `routines ${player}`, () =>
    stats.listTrainedRoutines(player),
  );
  return (listed?.items ?? []).map((item) => item.routineKey);
}

describe("statistics SQL executes against Postgres", () => {
  it("runs every game section, list and the overview against the stats world and an absent player", async () => {
    await inStatsTx(async (db) => {
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
        const id = sectionsForGame(game).find(
          (candidate) => candidate === section,
        );
        if (id === undefined)
          throw new Error(`${game} does not offer ${section}`);
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
    await inStatsTx(async (db) => {
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

      const planFailed: string[] = [];
      const calls: Call[] = [];
      for (const player of PLAYERS) {
        for (const key of await routineKeys(db, planFailed, player)) {
          calls.push(...(await routineCalls(db, planFailed, player, key)));
        }
      }
      const result = await sweep(db, calls);
      expect([...planFailed, ...result.failed]).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });

  it("isolates statement errors behind savepoints and refuses getDb() outside the transaction", async () => {
    const result = await inStatsTx(async (db) =>
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
