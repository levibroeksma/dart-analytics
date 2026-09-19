import type { DartFact } from "@modules/types";

/**
 * Fields `career-summary.module.ts` needs from a `v_session_overview` row.
 * `gameTypeKey` is NULL for a training exercise session, which has no game
 * bound to it (migration `0033`).
 */
export type PlayerSessionSummaryRow = {
  gameTypeKey: string | null;
  statusKey: string;
  startedAt: string;
  durationSeconds: number;
};

/** One row of `v_player_visit_facts`; `gameTypeKey` is NULL for a training exercise session. */
export type PlayerVisitFactRow = {
  sessionId: string;
  gameTypeKey: string | null;
  stageId: string;
  stageTypeKey: string;
  turnSequence: number;
  totalScore: number;
  dartCount: number;
  configuredMaxDartsPerTurn: number | null;
};

/**
 * Exclusive score-band tally (Pattern 21) over `v_player_visit_facts` rows —
 * kept independent of `play-visit-stats.ts`'s `visitScoreBandCounts` (the
 * live in-session helper): score-band thresholds are fixed darts convention,
 * not a heuristic subject to drift, so the duplication risk is negligible
 * and this avoids pulling every historical turn into the live-session module.
 */
export type ScoreBandCounts = {
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

/** One row of `v_player_leg_facts`; `gameTypeKey` is NULL for a training exercise session. */
export type PlayerLegFactRow = {
  sessionId: string;
  gameTypeKey: string | null;
  stageId: string;
  totalDartsInLeg: number;
};

/**
 * One row of `v_x01_checkout_darts`: a single dart, carrying enough of its
 * session, stage and turn to rebuild the fact log the checkout-visit builders
 * fold. `configuration` is the session's stored snapshot -- snake_case
 * ruleset fields plus a camelCase `seats` array, exactly as
 * `session.service.ts` writes it.
 */
export type X01CheckoutDartRow = {
  sessionId: string;
  gameTypeKey: string;
  rulesetVersionKey: string;
  configuration: Record<string, unknown> | null;
  stageId: string;
  stageSequence: number;
  stageTypeKey: string;
  parentStageId: string | null;
  turnId: string;
  turnSequence: number;
  turnTotalScore: number;
  turnCompletedAt: string | null;
  participantId: string;
  dartNumber: number;
  hitTargetNumber: number | null;
  hitZoneKey: DartFact["hitZoneKey"];
  score: number;
};
