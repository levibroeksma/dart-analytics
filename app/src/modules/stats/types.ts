import type { ContextFilter, GameTypeKey, TargetKey } from "@lib/types";
import type {
  CheckoutVisitTotals,
  DartFact,
  DartZoneKey,
  SeatFoldStep,
} from "@modules/types";

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

/**
 * One checkout visit `sessionCheckoutVisits` folded, tagged with the stage
 * its own seat turn belongs to -- a leg for 501, a round for 121, an
 * exercise block for TUOD. `stageTypeKey` is read back off the rebuilt stage
 * list rather than assumed from `gameTypeKey`, since it is what a checkout
 * section groups or filters visits by.
 */
export type StagedVisit = CheckoutVisitTotals & {
  stageId: string;
  stageTypeKey: string;
};

/**
 * One session's checkout visits, kept with the session's own identity
 * instead of flattened into a career-wide list. `visits` is empty for a
 * session `visitsForSession` skips (no stored snapshot, an undecodable one,
 * or a seatless 121/TUOD session) -- the session still gets an entry, it
 * just contributed nothing.
 */
export type SessionCheckoutVisits = {
  sessionId: string;
  gameTypeKey: string;
  rulesetVersionKey: string;
  visits: StagedVisit[];
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

/**
 * The shared filter every dart-level reader applies to `v_stats_dart_facts`
 * `routineStep`, when set, narrows to one GAME routine
 * step's sessions (D372 decision 5) — optional, so a game page's reader,
 * which leaves it unset, reads the whole game scope.
 */
export type DartScope = {
  playerId: string;
  gameTypeKey: GameTypeKey;
  from: string;
  to: string;
  statuses: string[];
  context: ContextFilter;
  routineStep?: RoutineStepScope;
};

/**
 * The shared filter every fold/scoring reader applies to
 * `v_stats_session_facts`: player, game type and status in range, restricted
 * to `input_mode_key = 'VISUAL_BOARD'` (`00-Overview.md` §10). `routineStep` narrows the same way as `DartScope`
 * (D372 decision 5).
 */
export type SessionScope = {
  playerId: string;
  gameTypeKey: GameTypeKey;
  from: string;
  to: string;
  statuses: string[];
  context: ContextFilter;
  routineStep?: RoutineStepScope;
};

/**
 * Identifies one step of one routine, by the `routine_key`/`step_key` pair
 * `v_stats_routine_step_facts` derives from the activity's snapshot
 * (migration `0045` header). Narrows `DartScope`/`SessionScope` to a single
 * step's sessions.
 */
export type RoutineStepScope = {
  routineKey: string;
  stepKey: string;
};

/**
 * The shared filter every routine-run reader applies to
 * `v_stats_routine_run_facts`: owning player, routine identity and terminal
 * status in range (D372 decision 1).
 */
export type RoutineScope = {
  playerId: string;
  routineKey: string;
  from: string;
  to: string;
  statuses: string[];
};

/**
 * `RoutineScope` narrowed to one step's sessions, applied to
 * `v_stats_routine_step_facts` (D372 decision 2).
 */
export type StepScope = RoutineScope & {
  stepKey: string;
};

/**
 * One `findTrainedRoutines` row: a routine the player has trained, named for
 * its latest run (D372 decision 9). `routineTemplateId` is `null`
 * for a legacy snapshot keyed by `routineName` alone (migration `0045`
 * header rule 1).
 */
export type TrainedRoutineRow = {
  routineKey: string;
  routineTemplateId: string | null;
  routineName: string;
  runCount: number;
  completedRunCount: number;
  lastRunAt: string;
};

/**
 * One `findRoutineHeader` row: one routine's run counts and its earliest and
 * latest run, plus the latest run's own `stepCount` —
 * `findRoutineStepDescriptors`'s `current` flag input (D372 decision 9): a
 * step index beyond `latestStepCount`
 * no longer exists in the routine's current shape, so nothing at that index
 * can be current. `null` when the latest run's snapshot has no readable
 * `steps` array (migration `0045` header rule 2).
 */
export type RoutineHeaderRow = {
  routineKey: string;
  routineName: string;
  runCount: number;
  firstRunAt: string;
  lastRunAt: string;
  latestStepCount: number | null;
};

/**
 * One `findRoutineStepDescriptors` row: one step index's trained history.
 * `current` is set when this step key is the most recently seen key at its
 * `sequenceNumber` (the latest of the index's possibly-several historical
 * configurations) *and* `sequenceNumber` is still within the latest run's
 * `stepCount` — a superseded key, or an index the routine no longer
 * has, is never current. `gameTypeKey`/`rulesetVersionKey` are `null` for a
 * non-game step; `exerciseRulesetVersionKey` is `null` for a GAME step
 * (which has no exercise ruleset at all, `training-session.service.ts`'s
 * `GAME_EXERCISE_TYPE_KEY` doc) as well as for a legacy session predating
 * exercise rulesets. `durationSeconds` is the snapshot element's own
 * configured step length (`TrainingStepResolved.durationSeconds`), not the
 * session's elapsed time — `null` when the snapshot element has no readable
 * value.
 */
export type RoutineStepDescriptorRow = {
  stepKey: string;
  sequenceNumber: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: GameTypeKey | null;
  rulesetVersionKey: string | null;
  durationSeconds: number | null;
  sessionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  current: boolean;
};

/**
 * One `findRoutineRunBuckets` row: a bucket's run volume and completion over
 * `v_stats_routine_run_facts` (D372 decision 6). `neverStarted`
 * counts abandoned runs with zero step sessions. `stepsCompletedAtAbandon`
 * keys the number of steps completed at abandonment (as a string, `Record`
 * keys are always strings) to how many of the bucket's abandoned runs
 * abandoned at that count.
 */
export type RoutineRunBucketRow = {
  bucketStart: string;
  bucketEnd: string;
  runs: number;
  durationSum: number;
  durationMin: number;
  durationMax: number;
  darts: number;
  completed: number;
  abandoned: number;
  neverStarted: number;
  stepsCompletedAtAbandon: Record<string, number>;
};

/** One `findStepBuckets` row: a bucket's session volume over `v_stats_routine_step_facts` (D372 decision 6). */
export type StepBucketRow = {
  bucketStart: string;
  bucketEnd: string;
  sessions: number;
  durationSum: number;
  darts: number;
};

/**
 * One `findStepSessionPage` row: one step session, listed newest-first
 * (D372 decision 10). `v_stats_routine_step_facts` has no
 * `context_key` column — every row is routine context by definition —
 * unlike `StatsSessionRow`. `rulesetVersionKey`/`exerciseRulesetVersionKey`
 * are mutually exclusive: a GAME step sets the former, a non-game step the
 * latter.
 */
export type StepSessionRow = {
  sessionId: string;
  rulesetVersionKey: string | null;
  exerciseRulesetVersionKey: string | null;
  statusKey: string;
  neverStarted: boolean;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  turnCount: number;
  dartCount: number;
  countedScore: number;
};

/**
 * The seven non-game dart exercise kinds `step-metrics.module.ts` defines
 * metrics for (D372 decision 7) — `RoutineStepSummary.stepKey`'s
 * non-`"GAME:…"` values. Warm-Up throws no darts and is excluded: it gets
 * `step-volume` only, never `step-result` (D372 decision 6).
 */
export type DartExerciseKind =
  | "SWITCHING"
  | "DOUBLE_PATTERN"
  | "TARGET_SCORING"
  | "SWITCHING_TARGET_SCORING"
  | "SCORE_THRESHOLD"
  | "BULLSEYE_CHECKOUT"
  | "BULL_UP";

/**
 * One dart exercise kind's step-metric contract (D372 decision 7):
 * which keys `stepMetrics` returns and how `mergeStepMetrics` combines two
 * buckets' worth of them (`"sum"` adds, `"max"` takes the larger), which key
 * is the headline stat shown for a bucket, and which key pairs the client
 * divides into a displayed rate — e.g. `["hits", "darts"]` for a hit rate.
 * `direction` is always `"higher"` today (every headline here reads better
 * bigger); the field exists so a future kind can read the other way without
 * a shape change.
 */
export type StepMetricSpec = {
  metrics: Readonly<Record<string, "sum" | "max">>;
  headline: string;
  direction: "higher";
  rates: readonly (readonly [string, string])[];
};

/**
 * One `findX01FoldRows` row: a `v_x01_checkout_darts` dart plus the bucket
 * its session's `completed_at` falls in. Session-ordered rows are grouped
 * and folded through `sessionCheckoutVisits` downstream, never here.
 */
export type X01FoldRow = X01CheckoutDartRow & {
  bucketStart: string;
  bucketEnd: string;
};

/**
 * One `findVisitScoring` row: additive turn-score sums for `scoring-trend`
 * within one bucket (phase-3 decision 10). `ton`/`tonForty`/`oneEighty` are
 * exclusive-band turn counts over `SCORE_BANDS`.
 */
export type VisitScoringRow = {
  bucketStart: string;
  bucketEnd: string;
  points: number;
  darts: number;
  firstNinePoints: number;
  firstNineDarts: number;
  ton: number;
  tonForty: number;
  oneEighty: number;
};

/**
 * One `findHitNumberCells` row: darts thrown at, and trebles landed on, one
 * hit number (`"1"`-`"20"`, `"25"`, or `"MISS"`) within one bucket
 * (phase-3 decision 11), feeding `treble-rate`.
 */
export type HitNumberCellRow = {
  bucketStart: string;
  bucketEnd: string;
  hitNumber: string;
  darts: number;
  trebles: number;
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

/**
 * One `SessionCheckoutVisits` session, tagged with the bucket its own
 * `completed_at` falls in — identical on every one of a
 * session's visits, since a session belongs to exactly one bucket.
 */
export type BucketedSession = SessionCheckoutVisits & {
  bucketStart: string;
  bucketEnd: string;
};

/** `checkout-rate` section metrics — one bucket, keyed by the exact `startingRemaining` (phase-3 decision 4). */
export type CheckoutRateMetrics = Record<
  string,
  { chances: number; finished: number }
>;

/** `double-performance` section metrics — one bucket, keyed by the double a remaining requires (phase-2's `TargetKey` format, phase-3 decision 4). */
export type DoublePerformanceMetrics = Record<
  string,
  { attempts: number; hits: number }
>;

/** `checkout-path` section metrics — one bucket, keyed by `startingRemaining` then by the route label thrown. */
export type CheckoutPathMetrics = Record<
  string,
  Record<string, { visits: number; finished: number }>
>;

/** `bust-rate` section metrics — one bucket, keyed by the exact `startingRemaining` (phase-3 decision 6). */
export type BustRateMetrics = Record<string, { visits: number; busts: number }>;

/** `leg-stats` section metrics — one bucket: a darts-per-leg histogram (phase-3 decision 7). */
export type LegStatsMetrics = Record<string, number>;

/** `ladder-progress` section metrics — one bucket, keyed by target (phase-3 decision 8). */
export type LadderProgressMetrics = {
  targets: Record<string, { attempts: number; successes: number }>;
  maxTarget: number | null;
  afterMiss: number;
  recovered: number;
};

/** `scoring-trend` section metrics — one bucket (phase-3 decision 10). */
export type ScoringTrendMetrics = {
  points: number;
  darts: number;
  firstNinePoints: number;
  firstNineDarts: number;
  bands: { ton: number; tonForty: number; oneEighty: number };
};

/** `treble-rate` section metrics — one bucket, keyed by hit number (`"1"`-`"20"`, `"25"`, or `"MISS"`) (phase-3 decision 11). */
export type TrebleRateMetrics = Record<
  string,
  { darts: number; trebles: number }
>;

/**
 * One `findDartFoldRows` row: a `v_stats_dart_facts` dart joined to its
 * session's `v_stats_session_facts` snapshot, dart count and bucket — the input `sessionSteps` (`derived-aims.module.ts`) groups by
 * session and folds through the session's own engine reducer.
 * `intendedTargetNumber`/`intendedZoneKey` are null for every derived-intent
 * game (Singles/Shanghai/Around the Clock never store one), carried here only
 * so this row shares its dart-fact columns with `X01CheckoutDartRow`.
 */
export type DartFoldRow = {
  sessionId: string;
  gameTypeKey: GameTypeKey;
  rulesetVersionKey: string;
  configuration: Record<string, unknown> | null;
  sessionDartCount: number;
  bucketStart: string;
  bucketEnd: string;
  turnSequence: number;
  dartNumber: number;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  locationX: number | null;
  locationY: number | null;
};

/**
 * One derived-intent dart's recovered aim (`aimedDarts`,
 * `derived-aims.module.ts`): the engine's own active target before the dart,
 * mapped to a `TargetKey` (phase-4 decision 1), and whether the dart hit it
 * (`isAimHit`, phase-4 decision 2). `hitNumber`/`hitZone`/`x`/`y` carry the
 * dart's own observation through, so a caller never re-reads `DartFoldRow`.
 */
export type AimedDart = {
  aim: TargetKey;
  hit: boolean;
  hitNumber: number | null;
  hitZone: DartZoneKey;
  x: number;
  y: number;
};

/**
 * One session's darts walked through its own engine reducer, one step per
 * dart (`sessionSteps`, `derived-aims.module.ts`).
 * `configuration` is the session's raw stored snapshot, kept alongside the
 * walk so a caller (`aimedDarts`, or a game-specific fold) can decode
 * it again for whatever the reducer's own config carries beyond seat state.
 */
export type SessionSteps<TSeat> = {
  sessionId: string;
  rulesetVersionKey: string;
  configuration: Record<string, unknown> | null;
  bucketStart: string;
  bucketEnd: string;
  steps: readonly SeatFoldStep<TSeat>[];
};

/** `shanghai-count` section metrics — one bucket (phase-4 decision 12). */
export type ShanghaiCountMetrics = {
  sessions: number;
  shanghais: number;
  byRound: Record<string, number>;
};

/**
 * `atc-darts-per-target` section metrics — one bucket, keyed by
 * `configGroupKey` then by the aim's `TargetKey` (phase-4 decisions 13, 14).
 */
export type AtcDartsPerTargetMetrics = Record<
  string,
  Record<string, { darts: number; cleared: number }>
>;

/** One config group's Bob's 27 survival counts (phase-4 decision 15). */
export type Bobs27SurvivalGroupMetrics = {
  runs: number;
  completed: number;
  reached: Record<string, number>;
  died: Record<string, number>;
  scoreAfter: Record<
    string,
    { runs: number; sum: number; min: number; max: number }
  >;
};

/**
 * `bobs27-survival` section metrics — one bucket, keyed by `configGroupKey`
 * (phase-4 decisions 13, 15).
 */
export type Bobs27SurvivalMetrics = Record<string, Bobs27SurvivalGroupMetrics>;

/**
 * One row of `v_stats_session_facts`, restricted to a replay page's header
 * fields (D371 decision 5, D372 decision 11): the session's own
 * identity plus the stored facts a replay never re-derives. `configuration`
 * and `routineStepSequenceNumber` are the view's own nullable columns, passed
 * through untouched -- `routineStepSequenceNumber` is `null` for a
 * standalone session. `gameTypeKey`/`rulesetVersionKey` are `null` for a
 * non-game routine step, which `v_stats_session_facts` never carries at all
 * (its `game_types`/`ruleset_versions` joins are inner) -- the same pairing
 * `RoutineStepDescriptorRow` already establishes. `exerciseTypeKey` is
 * `"GAME"` for a row with no `v_stats_routine_step_facts` match (a
 * standalone game); `exerciseRulesetVersionKey`, `routineKey` and
 * `stepKey` are `null` for one too.
 */
export type ReplaySessionRow = {
  sessionId: string;
  gameTypeKey: GameTypeKey | null;
  rulesetVersionKey: string | null;
  inputModeKey: string;
  statusKey: string;
  contextKey: string;
  activityId: string;
  routineStepSequenceNumber: number | null;
  configuration: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  turnCount: number;
  dartCount: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  routineKey: string | null;
  stepKey: string | null;
};

/**
 * One row of `exercise_stages`, restricted to what `stageOrder` needs to
 * rebuild play order (D371 decision 3): the stage's own id, its parent
 * (`null` for a root), its type, and its sibling order.
 */
export type ReplayStageRow = {
  stageId: string;
  parentStageId: string | null;
  stageTypeKey: string;
  sequence: number;
};

/**
 * One of `v_game_replay`'s distinct participants for a session, ordered by
 * that participant's own first turn in play order (`findReplayParticipants`,
 * R4).
 */
export type ReplayParticipantRow = {
  participantId: string;
  displayName: string;
  participantTypeKey: string;
};

/**
 * One row of `v_game_replay` (migration `0044`). Every dart column —
 * `dartNumber` through `locationY` — is `null` together for a
 * turn-total-only turn, the view's `LEFT JOIN` to `darts`.
 */
export type ReplayRow = {
  stageId: string;
  turnSequence: number;
  participantId: string;
  participantName: string;
  participantTypeKey: string;
  turnTotalScore: number;
  dartNumber: number | null;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey | null;
  score: number | null;
  locationX: number | null;
  locationY: number | null;
};

/**
 * A `ReplayRow`'s dart half, narrowed to a real dart: `dartNumber`, `score`
 * and `hitZoneKey` are non-null, which `rowsToTurns` proves row by row (R3).
 */
export type ReplayDart = {
  dartNumber: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  score: number;
  locationX: number | null;
  locationY: number | null;
};

/**
 * One turn `rowsToTurns` groups consecutive `ReplayRow`s into, in play
 * order. `darts` is empty for a turn-total-only turn.
 */
export type ReplayTurn = {
  stageId: string;
  turnSequence: number;
  participantId: string;
  turnTotalScore: number;
  darts: ReplayDart[];
};

/**
 * The decoded replay cursor (`encodeReplayCursor`/`decodeReplayCursor`,
 * R2): the last turn's `(stageId, turnSequence)` (D371 decision 4).
 */
export type ReplayCursor = {
  stageId: string;
  turnSequence: number;
};

/**
 * One `findStepFoldRows` row: a `v_game_replay` dart/turn joined to its own
 * step session's identity, for the server-side `step-result` fold (D372
 * decision 8) — `configuration` is the session's own snapshot, passed
 * to the exercise engine exactly as the routine play adapter's `open()`
 * passes it; `completedAt` is the input the fold buckets a session's merged
 * metrics by, after folding. `stageSequence`/`stageTypeKey`/`parentStageId`
 * are `v_game_replay`'s own stage columns (migration `0044`) — carried here
 * rather than assumed, so the fold rebuilds each session's real stage tree
 * through `stageOrder` instead of inventing one.
 */
export type StepFoldRow = ReplayRow & {
  sessionId: string;
  completedAt: string;
  exerciseRulesetVersionKey: string | null;
  configuration: Record<string, unknown> | null;
  stageSequence: number;
  stageTypeKey: string;
  parentStageId: string | null;
};

/**
 * `findStepFoldRows`' actual return row: `StepFoldRow` plus the bucket its
 * own session's `completedAt` falls in (D372 decision 6), computed
 * in SQL via `bucketExprs`, mirroring `X01FoldRow`. `step-result`'s shape
 * function groups by `bucketStart` before folding each bucket's sessions.
 */
export type StepFoldBucketRow = StepFoldRow & {
  bucketStart: string;
  bucketEnd: string;
};

/**
 * `foldStepResult`'s own row alias for `StepFoldRow`: the flat,
 * session-mixed rows one bucket's worth of `step-result` scopes, named at
 * the `sections` module boundary for what the fold does with them — group
 * by `sessionId`, one `EngineFacts` rebuild per group.
 */
export type StepFoldSession = StepFoldRow;

/**
 * `routine-volume` section metrics — one bucket (D372 decision 6).
 * `durationSeconds`/`minDurationSeconds`/`maxDurationSeconds` carry
 * `findRoutineRunBuckets`' seconds columns through unconverted, matching
 * `VolumeMetrics.durationSeconds` — a `seconds / 60` float does
 * not re-add exactly across chunks (`1/60 + 5/60 !== 6/60`), so the client
 * converts to minutes for display, never this module.
 */
export type RoutineVolumeMetrics = {
  runs: number;
  durationSeconds: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  darts: number;
};

/** `routine-completion` section metrics — one bucket (D372 decision 6); the three counts partition a bucket's runs, matching `CompletionMetrics`' shape at the routine grain. */
export type RoutineCompletionMetrics = {
  completed: number;
  abandoned: number;
  neverStarted: number;
  stepsCompletedAtAbandon: Record<string, number>;
};

/**
 * `step-volume` section metrics — one bucket, over any non-game routine
 * step (D372 decision 6; a GAME step's own `volume` section covers
 * it instead). `durationSeconds` carries
 * `findStepBuckets`' seconds column through unconverted, for the same
 * exact-re-aggregation reason as `RoutineVolumeMetrics`.
 */
export type StepVolumeMetrics = {
  sessions: number;
  durationSeconds: number;
  darts: number;
};

/**
 * `step-result` section metrics — one bucket (D372 decisions 6, 7):
 * `metrics` are `STEP_METRIC_SPECS[kind]`'s own keys, merged across every
 * successfully folded session (`mergeStepMetrics`); `headlineMin`/`Max` are
 * the spec's headline key's extremes across those same sessions, `null`
 * when none folded; `sessions` counts folded sessions, `skippedSessions`
 * counts a missing engine factory or an engine that threw (D372 decision 8) —
 * the two counts partition the bucket's scoped session population.
 */
export type StepResultMetric = {
  metrics: Record<string, number>;
  headlineMin: number | null;
  headlineMax: number | null;
  sessions: number;
  skippedSessions: number;
};
