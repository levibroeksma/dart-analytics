import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

vi.mock("@db/client", () => ({
  getDb: () => drizzle(neon(process.env.DATABASE_URL as string), { schema }),
}));

const { sectionsForGame, sectionsForStep, sectionsForRoutine } =
  await import("@lib/stats/section-registry");
const stats = await import("@services/statistics.service");
const { getDb } = await import("@db/client");

import type { GameTypeKey } from "@lib/types";

type Call = [label: string, run: () => Promise<unknown>];

const GAMES: GameTypeKey[] = [
  "501",
  "TUOD",
  "ONE_TWENTY_ONE",
  "SCORE_TRAINING",
  "SINGLES_TRAINING",
  "DOUBLES_TRAINING",
  "BOBS27",
  "SHANGHAI",
  "AROUND_THE_CLOCK",
];
const RANGE = { from: "2020-01-01T00:00:00Z", to: "2030-01-01T00:00:00Z" };
const RANGES = [
  { ...RANGE, bucket: "none" as const },
  { ...RANGE, bucket: "month" as const, tz: "Europe/Amsterdam" },
];
const GAME_QUERY = { context: "all", inputMode: "VISUAL_BOARD" } as const;
const ABSENT_PLAYER = "01990000-0000-7000-8000-00000000ffff";
const REAL_PLAYER_LIMIT = 3;
const CONCURRENCY = 8;

/** A throw is a statement error (grouping, type resolution); `ok: false` is a handled outcome. */
async function attempt([label, run]: Call): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (err) {
    return `${label}: ${(err as Error).message}`;
  }
}

async function failures(calls: Call[]): Promise<string[]> {
  const failed: string[] = [];
  for (let i = 0; i < calls.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      calls.slice(i, i + CONCURRENCY).map(attempt),
    );
    failed.push(...batch.filter((message) => message !== null));
  }
  return failed;
}

async function knownPlayers(): Promise<string[]> {
  const result = await getDb().execute(
    sql`SELECT DISTINCT player_id FROM exercise_sessions LIMIT ${REAL_PLAYER_LIMIT}`,
  );
  const rows = result.rows as { player_id: string }[];
  return [ABSENT_PLAYER, ...rows.map((row) => row.player_id)];
}

function perRange(
  label: string,
  run: (range: (typeof RANGES)[number]) => Promise<unknown>,
): Call[] {
  return RANGES.map((range) => [`${label}/${range.bucket}`, () => run(range)]);
}

function gameCalls(player: string, game: GameTypeKey): Call[] {
  const sessions: Call = [
    `sessions ${game} ${player}`,
    () =>
      stats.listGameSessions(player, game, {
        ...RANGES[0],
        ...GAME_QUERY,
        limit: 5,
      }),
  ];
  const sections = sectionsForGame(game).flatMap((id) =>
    perRange(`${game}/${id} ${player}`, (range) =>
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
  const sessions: Call = [
    `${label}/sessions`,
    () =>
      stats.listRoutineStepSessions(player, key, step.stepKey, {
        ...RANGE,
        limit: 5,
      }),
  ];
  const sections = sectionsForStep(step).sections.flatMap((section) =>
    perRange(`${label}/${section.id}`, (range) =>
      stats.getRoutineStepSection(player, key, step.stepKey, section.id, range),
    ),
  );
  return [sessions, ...sections];
}

async function routineCalls(player: string, key: string): Promise<Call[]> {
  const header: Call = [
    `header ${key}`,
    () => stats.getRoutineHeader(player, key),
  ];
  const sections = sectionsForRoutine().flatMap((section) =>
    perRange(`${key}/${section.id}`, (range) =>
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
  it("runs every game section, list and the overview", async () => {
    const players = await knownPlayers();
    const calls: Call[] = players.flatMap((player) => [
      [`overview ${player}`, () => stats.getStatisticsOverview(player)] as Call,
      ...GAMES.flatMap((game) => gameCalls(player, game)),
    ]);
    expect(await failures(calls)).toEqual([]);
  });

  it("runs every routine and step section for trained routines", async () => {
    const players = await knownPlayers();
    const nested = await Promise.all(
      players.map(async (player) =>
        (
          await Promise.all(
            (await routineKeys(player)).map((key) => routineCalls(player, key)),
          )
        ).flat(),
      ),
    );
    expect(await failures(nested.flat())).toEqual([]);
  });
});
