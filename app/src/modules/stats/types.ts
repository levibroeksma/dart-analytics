import type { ContextFilter, GameTypeKey } from "@lib/types";
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

/** One row of `v_stats_session_facts` (`findGameSessionsPage`); `neverStarted` is derived, not a view column. */
export type StatsSessionRow = {
  sessionId: string;
  rulesetVersionKey: string;
  statusKey: string;
  contextKey: string;
  neverStarted: boolean;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  turnCount: number;
  dartCount: number;
  countedScore: number;
};

/**
 * One group of `findBucketedSessionAggregates`'s shared aggregate query: a
 * bucket × status × context × ruleset-version × never-started slice of a
 * game's terminal sessions. `minSessionId`/`maxSessionId` carry the session
 * that produced `scoreMin`/`scoreMax` so the client can link to it.
 */
export type StatsBucketRow = {
  bucketStart: string;
  bucketEnd: string;
  statusKey: string;
  contextKey: string;
  rulesetVersionKey: string;
  neverStarted: boolean;
  sessions: number;
  turnSum: number;
  dartSum: number;
  durationSum: number;
  scoreSum: number;
  scoreMin: number;
  scoreMax: number;
  minSessionId: string;
  maxSessionId: string;
};

/** A count split by play context (`10-Statistics/00-Overview.md` §8). */
export type ContextSplit = {
  standalone: number;
  routine: number;
};

/** `completion` section metrics — one bucket (`01-Section-Catalog.md` §1). */
export type CompletionMetrics = {
  completed: number;
  abandoned: number;
  neverStarted: number;
  abandonedTurns: number;
};

/** `volume` section metrics — one bucket. */
export type VolumeMetrics = {
  sessions: ContextSplit;
  darts: ContextSplit;
  durationSeconds: ContextSplit;
};

/** One ruleset version's slice of a `session-result` bucket (D367 decision 3). */
export type SessionResultRulesetMetrics = {
  sessions: number;
  countedScoreSum: number;
  dartSum: number;
  turnSum: number;
  countedScoreMin: number;
  countedScoreMax: number;
  bestLowSessionId: string;
  bestHighSessionId: string;
};

/** `session-result` section metrics — one bucket, keyed by `ruleset_version_key`. */
export type SessionResultMetrics = Record<string, SessionResultRulesetMetrics>;

/** The opaque session-list cursor's decoded shape (`series.module.ts`). */
export type SessionListCursor = {
  completedAt: string;
  sessionId: string;
};

/** The shared filter every dart-level reader applies to `v_stats_dart_facts` (phase-2 Task 3). */
export type DartScope = {
  playerId: string;
  gameTypeKey: GameTypeKey;
  from: string;
  to: string;
  statuses: string[];
  context: ContextFilter;
};

/** One `findIntentCells` row: an intended×hit pair count within a bucket. */
export type IntentCellRow = {
  bucketStart: string;
  bucketEnd: string;
  intendedTargetNumber: number;
  intendedZoneKey: string;
  hitTargetNumber: number | null;
  hitZoneKey: string;
  darts: number;
};

/** One `findIntentMoments` row: additive position moments for an intended pair within a bucket. */
export type IntentMomentRow = {
  bucketStart: string;
  bucketEnd: string;
  intendedTargetNumber: number;
  intendedZoneKey: string;
  n: number;
  sumX: number;
  sumY: number;
  sumXX: number;
  sumYY: number;
  sumXY: number;
};

/** One target's board reference point and ring band, bound into `findMissSectors`'s `VALUES` join (phase-2 decision 4). */
export type MissReference = {
  targetNumber: number;
  zoneKey: string;
  cx: number;
  cy: number;
  rInner: number;
  rOuter: number;
};

/** One `findMissSectors` row: missed-dart counts by 45°-sector and radial band for an intended target. */
export type MissSectorRow = {
  targetNumber: number;
  zoneKey: string;
  sector: number;
  radial: "INSIDE" | "WITHIN" | "OUTSIDE";
  darts: number;
};

/** One `findHeatmapCells` row: a non-empty `HEATMAP_CELL_MM` grid cell. */
export type HeatmapCellRow = {
  ix: number;
  iy: number;
  darts: number;
};

/** `target-accuracy` section metrics — one bucket, keyed by `TargetKey`. */
export type TargetAccuracyMetrics = Record<
  string,
  { attempts: number; hits: number }
>;

/** `confusion` section metrics — one bucket, keyed by `TargetKey` then by hit key (a `TargetKey`, or `MISS`). */
export type ConfusionMetrics = Record<string, Record<string, number>>;

/** `loose-darts` section metrics — one bucket, keyed by `TargetKey` (phase-2 decision 9). */
export type LooseDartsMetrics = Record<
  string,
  { onTarget: number; nearMiss: number; loose: number }
>;

/** Additive position moments for one intended target; sums re-aggregate exactly across buckets (phase-2 decision 3). */
export type GroupingMoment = {
  n: number;
  sumX: number;
  sumY: number;
  sumXX: number;
  sumYY: number;
  sumXY: number;
};

/** `grouping` section metrics — one bucket, keyed by `TargetKey`. */
export type GroupingMetrics = Record<string, GroupingMoment>;

/** One target's missed-dart sector/radial slice (phase-2 decision 4). */
export type MissDirectionEntry = {
  sector: number;
  radial: "INSIDE" | "WITHIN" | "OUTSIDE";
  darts: number;
};

/** `miss-direction` section metrics — one bucket, keyed by `TargetKey`. */
export type MissDirectionMetrics = Record<string, MissDirectionEntry[]>;

/** `heatmap` section metrics — one bucket; never keyed by target (phase-2 decision 6). */
export type HeatmapMetrics = {
  cellMm: number;
  target: string | null;
  cells: [number, number, number][];
};
