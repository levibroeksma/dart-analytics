import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

vi.mock("@db/client", () => ({
  getDb: () => drizzle(neon(process.env.DATABASE_URL as string), { schema }),
}));

const { sectionsForGame, sectionsForStep, sectionsForRoutine, SECTIONS } =
  await import("@lib/stats/section-registry");
const {
  getGameSection,
  getRoutineHeader,
  getRoutineSection,
  getRoutineStepSection,
  getStatisticsOverview,
  listGameSessions,
  listRoutineStepSessions,
  listTrainedRoutines,
} = await import("@services/statistics.service");
const { getDb } = await import("@db/client");

import type { GameTypeKey } from "@lib/types";

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

const RANGE = {
  from: "2020-01-01T00:00:00Z",
  to: "2030-01-01T00:00:00Z",
};
const TZ = "Europe/Amsterdam";
const ABSENT_PLAYER = "01990000-0000-7000-8000-00000000ffff";

/** A throw is a statement error (grouping, type resolution); `ok: false` is a handled outcome. */
async function failures(
  calls: [label: string, call: () => Promise<unknown>][],
): Promise<string[]> {
  const failed: string[] = [];
  for (const [label, call] of calls) {
    try {
      await call();
    } catch (err) {
      failed.push(`${label}: ${(err as Error).message}`);
    }
  }
  return failed;
}

async function knownPlayers(): Promise<string[]> {
  const result = await getDb().execute(
    sql`SELECT DISTINCT player_id FROM exercise_sessions LIMIT 10`,
  );
  const rows = result.rows as { player_id: string }[];
  return [ABSENT_PLAYER, ...rows.map((row) => row.player_id)];
}

const RANGES = [
  { ...RANGE, bucket: "none" as const },
  { ...RANGE, bucket: "month" as const, tz: TZ },
];

describe("statistics SQL executes against Postgres", () => {
  it("runs every game section, list and the overview", async () => {
    const calls: [string, () => Promise<unknown>][] = [];
    for (const player of await knownPlayers()) {
      calls.push([`overview ${player}`, () => getStatisticsOverview(player)]);
      for (const game of GAMES) {
        calls.push([
          `sessions ${game} ${player}`,
          () =>
            listGameSessions(player, game, {
              ...RANGE,
              bucket: "none",
              context: "all",
              inputMode: "VISUAL_BOARD",
              limit: 5,
            }),
        ]);
        for (const id of sectionsForGame(game)) {
          expect(SECTIONS[id]).toBeDefined();
          for (const range of RANGES) {
            calls.push([
              `${game}/${id}/${range.bucket} ${player}`,
              () =>
                getGameSection(player, game, id, {
                  ...range,
                  context: "all",
                  inputMode: "VISUAL_BOARD",
                  target: undefined,
                }),
            ]);
          }
        }
      }
    }
    expect(await failures(calls)).toEqual([]);
  });

  it("runs every routine and step section for trained routines", async () => {
    const calls: [string, () => Promise<unknown>][] = [];
    for (const player of await knownPlayers()) {
      const listed = await listTrainedRoutines(player);
      if (!listed.ok) continue;
      for (const routine of listed.data.items) {
        const key = routine.routineKey;
        calls.push([`header ${key}`, () => getRoutineHeader(player, key)]);
        for (const section of sectionsForRoutine()) {
          for (const range of RANGES) {
            calls.push([
              `${key}/${section.id}/${range.bucket}`,
              () => getRoutineSection(player, key, section.id, range),
            ]);
          }
        }
        const header = await getRoutineHeader(player, key);
        if (!header.ok) continue;
        for (const step of header.data.steps) {
          const plan = sectionsForStep(step);
          calls.push([
            `${key}/${step.stepKey}/sessions`,
            () =>
              listRoutineStepSessions(player, key, step.stepKey, {
                ...RANGE,
                limit: 5,
              }),
          ]);
          for (const section of plan.sections) {
            for (const range of RANGES) {
              calls.push([
                `${key}/${step.stepKey}/${section.id}/${range.bucket}`,
                () =>
                  getRoutineStepSection(
                    player,
                    key,
                    step.stepKey,
                    section.id,
                    range,
                  ),
              ]);
            }
          }
        }
      }
    }
    expect(await failures(calls)).toEqual([]);
  });
});
