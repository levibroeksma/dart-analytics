/** Fields `career-summary.module.ts` needs from a `v_session_overview` row. */
export type PlayerSessionSummaryRow = {
  gameTypeKey: string;
  statusKey: string;
  startedAt: string;
  durationSeconds: number;
};

/** One row of `v_player_visit_facts`. */
export type PlayerVisitFactRow = {
  sessionId: string;
  gameTypeKey: string;
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

/** One row of `v_player_leg_facts`. */
export type PlayerLegFactRow = {
  sessionId: string;
  gameTypeKey: string;
  stageId: string;
  totalDartsInLeg: number;
};
