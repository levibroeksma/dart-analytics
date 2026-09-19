import { eq } from "drizzle-orm";
import {
  vPlayerLegFacts,
  vPlayerVisitFacts,
  vSessionOverview,
  vX01CheckoutDarts,
} from "@db/schema";
import type { getDb } from "@db/client";
import type {
  PlayerLegFactRow,
  PlayerSessionSummaryRow,
  PlayerVisitFactRow,
  X01CheckoutDartRow,
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

/**
 * Reads every X01 checkout dart the player owns through
 * `v_x01_checkout_darts`, ordered so a session's rows arrive in stage, turn
 * and dart order -- the order `checkoutVisitsFromRows` folds them in.
 */
export async function findX01CheckoutDarts(
  db: Db,
  playerId: string,
): Promise<X01CheckoutDartRow[]> {
  const rows = await db
    .select({
      sessionId: vX01CheckoutDarts.sessionId,
      gameTypeKey: vX01CheckoutDarts.gameTypeKey,
      rulesetVersionKey: vX01CheckoutDarts.rulesetVersionKey,
      configuration: vX01CheckoutDarts.configuration,
      stageId: vX01CheckoutDarts.stageId,
      stageSequence: vX01CheckoutDarts.stageSequence,
      stageTypeKey: vX01CheckoutDarts.stageTypeKey,
      parentStageId: vX01CheckoutDarts.parentStageId,
      turnId: vX01CheckoutDarts.turnId,
      turnSequence: vX01CheckoutDarts.turnSequence,
      turnTotalScore: vX01CheckoutDarts.turnTotalScore,
      turnCompletedAt: vX01CheckoutDarts.turnCompletedAt,
      participantId: vX01CheckoutDarts.participantId,
      dartNumber: vX01CheckoutDarts.dartNumber,
      hitTargetNumber: vX01CheckoutDarts.hitTargetNumber,
      hitZoneKey: vX01CheckoutDarts.hitZoneKey,
      score: vX01CheckoutDarts.score,
    })
    .from(vX01CheckoutDarts)
    .where(eq(vX01CheckoutDarts.playerId, playerId))
    .orderBy(
      vX01CheckoutDarts.sessionId,
      vX01CheckoutDarts.stageSequence,
      vX01CheckoutDarts.turnSequence,
      vX01CheckoutDarts.dartNumber,
    );

  return rows as X01CheckoutDartRow[];
}
