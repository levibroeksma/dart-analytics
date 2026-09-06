import { eq, inArray } from "drizzle-orm";
import {
  exerciseConfigurations,
  vDoubleOutCheckoutDarts,
  vPlayerLegFacts,
  vPlayerVisitFacts,
  vSessionOverview,
} from "@db/schema";
import type { getDb } from "@db/client";
import type {
  CheckoutVisitDarts,
  DartFact,
  PlayerLegFactRow,
  PlayerSessionSummaryRow,
  PlayerVisitFactRow,
} from "@modules/types";

type Db = ReturnType<typeof getDb>;

/** Reads career session summaries through `v_session_overview`. */
export async function findSessionSummaries(
  db: Db,
  playerId: string,
): Promise<PlayerSessionSummaryRow[]> {
  const rows = await db
    .select({
      gameTypeKey: vSessionOverview.gameTypeKey,
      statusKey: vSessionOverview.statusKey,
      startedAt: vSessionOverview.startedAt,
      durationSeconds: vSessionOverview.durationSeconds,
    })
    .from(vSessionOverview)
    .where(eq(vSessionOverview.playerId, playerId));

  return rows as PlayerSessionSummaryRow[];
}

/** Reads every completed turn through `v_player_visit_facts`. */
export async function findVisitFacts(
  db: Db,
  playerId: string,
): Promise<PlayerVisitFactRow[]> {
  const rows = await db
    .select({
      sessionId: vPlayerVisitFacts.sessionId,
      gameTypeKey: vPlayerVisitFacts.gameTypeKey,
      stageId: vPlayerVisitFacts.stageId,
      stageTypeKey: vPlayerVisitFacts.stageTypeKey,
      turnSequence: vPlayerVisitFacts.turnSequence,
      totalScore: vPlayerVisitFacts.totalScore,
      dartCount: vPlayerVisitFacts.dartCount,
      configuredMaxDartsPerTurn: vPlayerVisitFacts.configuredMaxDartsPerTurn,
    })
    .from(vPlayerVisitFacts)
    .where(eq(vPlayerVisitFacts.playerId, playerId));

  return rows as PlayerVisitFactRow[];
}

/**
 * Reads complete-capture legs through `v_player_leg_facts`.
 * `total_darts_in_leg` is a Postgres NUMERIC (SUM of a bigint COUNT), which
 * arrives as a string through Drizzle/node-postgres -- parsed to a number here.
 */
export async function findLegFacts(
  db: Db,
  playerId: string,
): Promise<PlayerLegFactRow[]> {
  const rows = await db
    .select({
      sessionId: vPlayerLegFacts.sessionId,
      gameTypeKey: vPlayerLegFacts.gameTypeKey,
      stageId: vPlayerLegFacts.stageId,
      totalDartsInLeg: vPlayerLegFacts.totalDartsInLeg,
    })
    .from(vPlayerLegFacts)
    .where(eq(vPlayerLegFacts.playerId, playerId));

  return rows.map((row) => ({
    ...row,
    totalDartsInLeg: Number(row.totalDartsInLeg),
  })) as PlayerLegFactRow[];
}

async function findStartingScores(
  db: Db,
  sessionIds: string[],
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      sessionId: exerciseConfigurations.exerciseSessionId,
      configuration: exerciseConfigurations.configuration,
    })
    .from(exerciseConfigurations)
    .where(inArray(exerciseConfigurations.exerciseSessionId, sessionIds));

  return new Map(
    rows.map((row) => [
      row.sessionId,
      (row.configuration as { starting_score: number }).starting_score,
    ]),
  );
}

type MutableCheckoutVisit = { startingRemaining: number; darts: DartFact[] };

/**
 * Reshapes `v_double_out_checkout_darts`' flat per-dart rows into
 * `CheckoutVisitDarts[]` (one entry per turn), the shape
 * `double-attempt.module.ts` classifies. `startingRemaining` for a turn is
 * the session's configured `starting_score` minus that turn's first dart's
 * `prior_scored_in_stage` (0 when null, meaning the stage's very first dart).
 */
export async function findDoubleOutVisits(
  db: Db,
  playerId: string,
): Promise<CheckoutVisitDarts[]> {
  const rows = await db
    .select({
      sessionId: vDoubleOutCheckoutDarts.sessionId,
      stageId: vDoubleOutCheckoutDarts.stageId,
      turnSequence: vDoubleOutCheckoutDarts.turnSequence,
      dartNumber: vDoubleOutCheckoutDarts.dartNumber,
      hitTargetNumber: vDoubleOutCheckoutDarts.hitTargetNumber,
      hitZoneKey: vDoubleOutCheckoutDarts.hitZoneKey,
      score: vDoubleOutCheckoutDarts.score,
      priorScoredInStage: vDoubleOutCheckoutDarts.priorScoredInStage,
    })
    .from(vDoubleOutCheckoutDarts)
    .where(eq(vDoubleOutCheckoutDarts.playerId, playerId))
    .orderBy(
      vDoubleOutCheckoutDarts.stageId,
      vDoubleOutCheckoutDarts.turnSequence,
      vDoubleOutCheckoutDarts.dartNumber,
    );

  if (rows.length === 0) return [];

  const sessionIds = [...new Set(rows.map((row) => row.sessionId as string))];
  const startingScores = await findStartingScores(db, sessionIds);

  const visitsByKey = new Map<string, MutableCheckoutVisit>();
  for (const row of rows) {
    const key = `${row.stageId}:${row.turnSequence}`;
    let visit = visitsByKey.get(key);
    if (!visit) {
      const startingScore = startingScores.get(row.sessionId as string) ?? 0;
      visit = {
        startingRemaining: startingScore - (row.priorScoredInStage ?? 0),
        darts: [],
      };
      visitsByKey.set(key, visit);
    }
    visit.darts.push({
      sequence: row.dartNumber as number,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: row.hitTargetNumber,
      hitZoneKey: row.hitZoneKey as DartFact["hitZoneKey"],
      score: row.score as number,
      locationX: null,
      locationY: null,
    });
  }

  return Array.from(visitsByKey.values());
}
