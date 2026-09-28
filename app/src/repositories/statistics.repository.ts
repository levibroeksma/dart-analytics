import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  max,
  sql,
} from "drizzle-orm";
import type { Column } from "drizzle-orm";
import {
  vGameReplay,
  vPlayerLegFacts,
  vPlayerVisitFacts,
  vSessionOverview,
  vStatsDartFacts,
  vStatsRoutineRunFacts,
  vStatsRoutineStepFacts,
  vStatsSessionFacts,
  vX01CheckoutDarts,
} from "@db/schema";
import { nonNull } from "./row-helpers";
import { encodeDataVersion } from "@modules/stats/sections/series.module";
import type { getDb } from "@db/client";
import type { Bucket, ContextFilter, GameTypeKey } from "@lib/types";
import type {
  DartFoldRow,
  DartScope,
  DartZoneKey,
  HeatmapCellRow,
  HitNumberCellRow,
  IntentCellRow,
  IntentMomentRow,
  MissReference,
  MissSectorRow,
  PlayerLegFactRow,
  PlayerSessionSummaryRow,
  PlayerVisitFactRow,
  ReplayParticipantRow,
  ReplayRow,
  ReplaySessionRow,
  ReplayStageRow,
  RoutineHeaderRow,
  RoutineRunBucketRow,
  RoutineScope,
  RoutineStepDescriptorRow,
  RoutineStepScope,
  SessionScope,
  StatsBucketRow,
  StatsSessionRow,
  StepBucketRow,
  StepFoldRow,
  StepScope,
  StepSessionRow,
  TrainedRoutineRow,
  VisitScoringRow,
  X01CheckoutDartRow,
  X01FoldRow,
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

  return rows.map((row) => ({
    gameTypeKey: row.gameTypeKey,
    statusKey: nonNull(row.statusKey, "status_key"),
    startedAt: nonNull(row.startedAt, "started_at"),
    durationSeconds: nonNull(row.durationSeconds, "duration_seconds"),
  }));
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

  return rows.map((row) => ({
    sessionId: nonNull(row.sessionId, "session_id"),
    gameTypeKey: row.gameTypeKey,
    stageId: nonNull(row.stageId, "stage_id"),
    stageTypeKey: nonNull(row.stageTypeKey, "stage_type_key"),
    turnSequence: nonNull(row.turnSequence, "turn_sequence"),
    totalScore: nonNull(row.totalScore, "total_score"),
    dartCount: nonNull(row.dartCount, "dart_count"),
    configuredMaxDartsPerTurn: row.configuredMaxDartsPerTurn,
  }));
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
    sessionId: nonNull(row.sessionId, "session_id"),
    gameTypeKey: row.gameTypeKey,
    stageId: nonNull(row.stageId, "stage_id"),
    totalDartsInLeg: Number(nonNull(row.totalDartsInLeg, "total_darts_in_leg")),
  }));
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

const BUCKET_UNIT: Readonly<Record<Exclude<Bucket, "none">, string>> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

/**
 * `db.execute()`'s raw-row shape differs by driver: neon-http (production)
 * returns `{ rows }`, while the pg-proxy driver the test suite renders SQL
 * through (`render-sql.ts`) resolves to the row array itself. Both are
 * normalized here rather than assuming either shape.
 */
function executedRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result as { rows: T[] }).rows;
}

function contextCondition(context: ContextFilter) {
  return context === "all"
    ? undefined
    : eq(vStatsSessionFacts.contextKey, context.toUpperCase());
}

/**
 * The shared bucket-start/bucket-end expression pair (`00-Overview.md` §5):
 * a whitelisted `date_trunc(unit, … AT TIME ZONE tz)` pair applied to
 * whichever view's `completedAt` column the caller passes.
 */
function bucketExprs(
  completedAt: Column,
  unit: Exclude<Bucket, "none">,
  tz: string,
) {
  const unitLiteral = sql.raw(`'${BUCKET_UNIT[unit]}'`);
  const intervalLiteral = sql.raw(`interval '1 ${BUCKET_UNIT[unit]}'`);
  return {
    bucketStartExpr: sql<string>`(date_trunc(${unitLiteral}, ${completedAt} AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`,
    bucketEndExpr: sql<string>`((date_trunc(${unitLiteral}, ${completedAt} AT TIME ZONE ${tz}) + ${intervalLiteral}) AT TIME ZONE ${tz})`,
  };
}

/**
 * A GAME routine step's session_id sub-select (phase 6b plan decision 5):
 * `dartScopeWhere`/`sessionScopeWhere` add this only when the caller's scope
 * carries a `routineStep`, so every phase 2-4 handler and its tests are
 * unaffected — the field is optional and no existing caller sets it.
 */
function routineStepCondition(
  sessionIdColumn: Column,
  playerId: string,
  scope: RoutineStepScope,
) {
  return sql`${sessionIdColumn} IN (SELECT ${vStatsRoutineStepFacts.sessionId} FROM ${vStatsRoutineStepFacts} WHERE ${vStatsRoutineStepFacts.playerId} = ${playerId} AND ${vStatsRoutineStepFacts.routineKey} = ${scope.routineKey} AND ${vStatsRoutineStepFacts.stepKey} = ${scope.stepKey})`;
}

/** The shared filter every dart-level reader applies to `v_stats_dart_facts` (Task 3). */
function dartScopeWhere(scope: DartScope) {
  const conditions = [
    eq(vStatsDartFacts.playerId, scope.playerId),
    eq(vStatsDartFacts.gameTypeKey, scope.gameTypeKey),
    gte(vStatsDartFacts.completedAt, scope.from),
    lt(vStatsDartFacts.completedAt, scope.to),
    inArray(vStatsDartFacts.statusKey, scope.statuses),
    scope.context === "all"
      ? undefined
      : eq(vStatsDartFacts.contextKey, scope.context.toUpperCase()),
    scope.routineStep === undefined
      ? undefined
      : routineStepCondition(
          vStatsDartFacts.sessionId,
          scope.playerId,
          scope.routineStep,
        ),
  ].filter((condition) => condition !== undefined);
  return and(...conditions);
}

/**
 * The shared filter every Task 3 fold/scoring reader applies to
 * `v_stats_session_facts`: player, game type and status in range, restricted
 * to `input_mode_key = 'VISUAL_BOARD'` (phase-3 plan "Shared session scope").
 */
function sessionScopeWhere(scope: SessionScope) {
  const conditions = [
    eq(vStatsSessionFacts.playerId, scope.playerId),
    eq(vStatsSessionFacts.gameTypeKey, scope.gameTypeKey),
    gte(vStatsSessionFacts.completedAt, scope.from),
    lt(vStatsSessionFacts.completedAt, scope.to),
    inArray(vStatsSessionFacts.statusKey, scope.statuses),
    eq(vStatsSessionFacts.inputModeKey, "VISUAL_BOARD"),
    contextCondition(scope.context),
    scope.routineStep === undefined
      ? undefined
      : routineStepCondition(
          vStatsSessionFacts.sessionId,
          scope.playerId,
          scope.routineStep,
        ),
  ].filter((condition) => condition !== undefined);
  return and(...conditions);
}

/**
 * The `dart_count` sum over `v_stats_session_facts` for a scope (phase-3
 * decision 1): the fold bound `MAX_FOLD_DARTS` gates against this before a
 * server section reads `findX01FoldRows`.
 */
export async function findScopeDartCount(
  db: Db,
  scope: SessionScope,
): Promise<number> {
  const [row] = await db
    .select({
      dartCount: sql<string>`coalesce(sum(${vStatsSessionFacts.dartCount}), 0)::integer`,
    })
    .from(vStatsSessionFacts)
    .where(sessionScopeWhere(scope));

  return Number(nonNull(row?.dartCount ?? null, "dart_count"));
}

const X01_FOLD_COLUMNS = {
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
};

/**
 * Reads every `v_x01_checkout_darts` dart the scope covers, inner-joined to
 * `v_stats_session_facts` under `sessionScopeWhere`, each row carrying the
 * bucket its session's `completed_at` falls in. Ordered exactly as
 * `findX01CheckoutDarts` pins (session, stage, turn, dart), the order every
 * checkout-visit fold requires (phase-3 Task 3).
 */
export async function findX01FoldRows(
  db: Db,
  q: SessionScope & { bucket: Bucket; tz: string | undefined },
): Promise<X01FoldRow[]> {
  const whereClause = sessionScopeWhere(q);
  const order = [
    vX01CheckoutDarts.sessionId,
    vX01CheckoutDarts.stageSequence,
    vX01CheckoutDarts.turnSequence,
    vX01CheckoutDarts.dartNumber,
  ] as const;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        ...X01_FOLD_COLUMNS,
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
      })
      .from(vX01CheckoutDarts)
      .innerJoin(
        vStatsSessionFacts,
        eq(vX01CheckoutDarts.sessionId, vStatsSessionFacts.sessionId),
      )
      .where(whereClause)
      .orderBy(...order);
    return rows as X01FoldRow[];
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsSessionFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      ...X01_FOLD_COLUMNS,
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
    })
    .from(vX01CheckoutDarts)
    .innerJoin(
      vStatsSessionFacts,
      eq(vX01CheckoutDarts.sessionId, vStatsSessionFacts.sessionId),
    )
    .where(whereClause)
    .orderBy(...order);
  return rows as X01FoldRow[];
}

const DART_FOLD_COLUMNS = {
  sessionId: vStatsDartFacts.sessionId,
  gameTypeKey: vStatsDartFacts.gameTypeKey,
  rulesetVersionKey: vStatsDartFacts.rulesetVersionKey,
  configuration: vStatsSessionFacts.configuration,
  sessionDartCount: vStatsSessionFacts.dartCount,
  turnSequence: vStatsDartFacts.turnSequence,
  dartNumber: vStatsDartFacts.dartNumber,
  hitTargetNumber: vStatsDartFacts.hitTargetNumber,
  hitZoneKey: vStatsDartFacts.hitZoneKey,
  intendedTargetNumber: vStatsDartFacts.intendedTargetNumber,
  intendedZoneKey: vStatsDartFacts.intendedZoneKey,
  locationX: vStatsDartFacts.locationX,
  locationY: vStatsDartFacts.locationY,
};

/**
 * `location_x`/`location_y` are `NUMERIC(6, 2)` and arrive as strings through
 * node-postgres; every other selected column is an integer or text column
 * that arrives already typed, so only these two need parsing.
 */
function mapDartFoldRow(row: {
  sessionId: string | null;
  gameTypeKey: string | null;
  rulesetVersionKey: string | null;
  configuration: unknown;
  sessionDartCount: number | null;
  bucketStart: string | null;
  bucketEnd: string | null;
  turnSequence: number | null;
  dartNumber: number | null;
  hitTargetNumber: number | null;
  hitZoneKey: string | null;
  intendedTargetNumber: number | null;
  intendedZoneKey: string | null;
  locationX: string | number | null;
  locationY: string | number | null;
}): DartFoldRow {
  return {
    sessionId: nonNull(row.sessionId, "session_id"),
    gameTypeKey: nonNull(row.gameTypeKey, "game_type_key") as GameTypeKey,
    rulesetVersionKey: nonNull(row.rulesetVersionKey, "ruleset_version_key"),
    configuration: row.configuration as Record<string, unknown> | null,
    sessionDartCount: nonNull(row.sessionDartCount, "dart_count"),
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    turnSequence: nonNull(row.turnSequence, "turn_sequence"),
    dartNumber: nonNull(row.dartNumber, "dart_number"),
    hitTargetNumber: row.hitTargetNumber,
    hitZoneKey: nonNull(row.hitZoneKey, "hit_zone_key") as DartZoneKey,
    intendedTargetNumber: row.intendedTargetNumber,
    intendedZoneKey: row.intendedZoneKey as DartZoneKey | null,
    locationX: row.locationX === null ? null : Number(row.locationX),
    locationY: row.locationY === null ? null : Number(row.locationY),
  };
}

/**
 * Reads every `v_stats_dart_facts` dart the scope covers, inner-joined to
 * `v_stats_session_facts` under `sessionScopeWhere`, each row carrying its
 * session's dart count and the bucket its `completed_at` falls in (phase-4
 * Task 5). `sessionSteps` (`derived-aims.module.ts`) groups the result by
 * session and folds each one through its own engine reducer. Ordered by
 * session, then `(turn_sequence, dart_number)` -- the order every fold
 * replays a session's darts in.
 */
export async function findDartFoldRows(
  db: Db,
  q: SessionScope & { bucket: Bucket; tz: string | undefined },
): Promise<DartFoldRow[]> {
  const whereClause = sessionScopeWhere(q);
  const order = [
    vStatsDartFacts.sessionId,
    vStatsDartFacts.turnSequence,
    vStatsDartFacts.dartNumber,
  ] as const;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        ...DART_FOLD_COLUMNS,
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
      })
      .from(vStatsDartFacts)
      .innerJoin(
        vStatsSessionFacts,
        eq(vStatsDartFacts.sessionId, vStatsSessionFacts.sessionId),
      )
      .where(whereClause)
      .orderBy(...order);
    return rows.map(mapDartFoldRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsSessionFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      ...DART_FOLD_COLUMNS,
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
    })
    .from(vStatsDartFacts)
    .innerJoin(
      vStatsSessionFacts,
      eq(vStatsDartFacts.sessionId, vStatsSessionFacts.sessionId),
    )
    .where(whereClause)
    .orderBy(...order);
  return rows.map(mapDartFoldRow);
}

function mapVisitScoringRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  points: unknown;
  darts: unknown;
  firstNinePoints: unknown;
  firstNineDarts: unknown;
  ton: unknown;
  tonForty: unknown;
  oneEighty: unknown;
}): VisitScoringRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    points: Number(nonNull(row.points as string | null, "points")),
    darts: Number(nonNull(row.darts as string | null, "darts")),
    firstNinePoints: Number(
      nonNull(row.firstNinePoints as string | null, "first_nine_points"),
    ),
    firstNineDarts: Number(
      nonNull(row.firstNineDarts as string | null, "first_nine_darts"),
    ),
    ton: Number(nonNull(row.ton as string | null, "ton")),
    tonForty: Number(nonNull(row.tonForty as string | null, "ton_forty")),
    oneEighty: Number(nonNull(row.oneEighty as string | null, "one_eighty")),
  };
}

/**
 * Additive turn-score sums for `scoring-trend` over `v_player_visit_facts`
 * joined to `v_stats_session_facts` under `sessionScopeWhere` (phase-3
 * decision 10). `bands` are the three `SCORE_BANDS` edges, bound as
 * parameters so no band edge ever reaches SQL as a literal.
 */
export async function findVisitScoring(
  db: Db,
  q: SessionScope & {
    bucket: Bucket;
    tz: string | undefined;
    bands: readonly [number, number, number];
  },
): Promise<VisitScoringRow[]> {
  const whereClause = sessionScopeWhere(q);
  const firstNineClause = sql`${vPlayerVisitFacts.stageTypeKey} = 'LEG' and ${vPlayerVisitFacts.turnSequence} <= 3`;
  const pointsExpr = sql<string>`coalesce(sum(${vPlayerVisitFacts.totalScore}), 0)`;
  const dartsExpr = sql<string>`coalesce(sum(${vPlayerVisitFacts.dartCount}), 0)`;
  const firstNinePointsExpr = sql<string>`coalesce(sum(${vPlayerVisitFacts.totalScore}) filter (where ${firstNineClause}), 0)`;
  const firstNineDartsExpr = sql<string>`coalesce(sum(${vPlayerVisitFacts.dartCount}) filter (where ${firstNineClause}), 0)`;
  const tonExpr = sql<string>`count(*) filter (where ${vPlayerVisitFacts.totalScore} >= ${q.bands[0]} and ${vPlayerVisitFacts.totalScore} < ${q.bands[1]})`;
  const tonFortyExpr = sql<string>`count(*) filter (where ${vPlayerVisitFacts.totalScore} >= ${q.bands[1]} and ${vPlayerVisitFacts.totalScore} < ${q.bands[2]})`;
  const oneEightyExpr = sql<string>`count(*) filter (where ${vPlayerVisitFacts.totalScore} >= ${q.bands[2]})`;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        points: pointsExpr,
        darts: dartsExpr,
        firstNinePoints: firstNinePointsExpr,
        firstNineDarts: firstNineDartsExpr,
        ton: tonExpr,
        tonForty: tonFortyExpr,
        oneEighty: oneEightyExpr,
      })
      .from(vPlayerVisitFacts)
      .innerJoin(
        vStatsSessionFacts,
        eq(vPlayerVisitFacts.sessionId, vStatsSessionFacts.sessionId),
      )
      .where(whereClause);
    return rows.map(mapVisitScoringRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsSessionFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      points: pointsExpr,
      darts: dartsExpr,
      firstNinePoints: firstNinePointsExpr,
      firstNineDarts: firstNineDartsExpr,
      ton: tonExpr,
      tonForty: tonFortyExpr,
      oneEighty: oneEightyExpr,
    })
    .from(vPlayerVisitFacts)
    .innerJoin(
      vStatsSessionFacts,
      eq(vPlayerVisitFacts.sessionId, vStatsSessionFacts.sessionId),
    )
    .where(whereClause)
    .groupBy(bucketStartExpr, bucketEndExpr);
  return rows.map(mapVisitScoringRow);
}

function mapHitNumberCellRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  hitNumber: string | null;
  darts: unknown;
  trebles: unknown;
}): HitNumberCellRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    hitNumber: nonNull(row.hitNumber, "hit_number"),
    darts: Number(nonNull(row.darts as string | null, "darts")),
    trebles: Number(nonNull(row.trebles as string | null, "trebles")),
  };
}

/**
 * Per-hit-number dart and treble counts over `v_stats_dart_facts` under
 * phase-2's `dartScopeWhere` — feeds `treble-rate` (phase-3 decision 11).
 * `hitNumber` is `hit_target_number` as text, or `'MISS'`.
 */
export async function findHitNumberCells(
  db: Db,
  q: DartScope & { bucket: Bucket; tz: string | undefined },
): Promise<HitNumberCellRow[]> {
  const whereClause = dartScopeWhere(q);
  const hitNumberExpr = sql<string>`coalesce(${vStatsDartFacts.hitTargetNumber}::text, 'MISS')`;
  const trebleExpr = sql<string>`count(*) filter (where ${vStatsDartFacts.hitZoneKey} = 'TREBLE')`;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        hitNumber: hitNumberExpr,
        darts: count(),
        trebles: trebleExpr,
      })
      .from(vStatsDartFacts)
      .where(whereClause)
      .groupBy(hitNumberExpr);
    return rows.map(mapHitNumberCellRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsDartFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      hitNumber: hitNumberExpr,
      darts: count(),
      trebles: trebleExpr,
    })
    .from(vStatsDartFacts)
    .where(whereClause)
    .groupBy(bucketStartExpr, bucketEndExpr, hitNumberExpr);
  return rows.map(mapHitNumberCellRow);
}

function mapIntentCellRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  intendedTargetNumber: number | null;
  intendedZoneKey: string | null;
  hitTargetNumber: number | null;
  hitZoneKey: string | null;
  darts: unknown;
}): IntentCellRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    intendedTargetNumber: nonNull(
      row.intendedTargetNumber,
      "intended_target_number",
    ),
    intendedZoneKey: nonNull(row.intendedZoneKey, "intended_zone_key"),
    hitTargetNumber: row.hitTargetNumber,
    hitZoneKey: nonNull(row.hitZoneKey, "hit_zone_key"),
    darts: Number(nonNull(row.darts as string | null, "darts")),
  };
}

/**
 * Intended×hit pair counts over `v_stats_dart_facts`, filtered to darts with
 * a stored intent — feeds `target-accuracy`, `confusion` and `loose-darts`
 * (phase-2 decision 2).
 */
export async function findIntentCells(
  db: Db,
  q: DartScope & { bucket: Bucket; tz: string | undefined },
): Promise<IntentCellRow[]> {
  const whereClause = and(
    dartScopeWhere(q),
    isNotNull(vStatsDartFacts.intendedZoneKey),
  );

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        intendedTargetNumber: vStatsDartFacts.intendedTargetNumber,
        intendedZoneKey: vStatsDartFacts.intendedZoneKey,
        hitTargetNumber: vStatsDartFacts.hitTargetNumber,
        hitZoneKey: vStatsDartFacts.hitZoneKey,
        darts: count(),
      })
      .from(vStatsDartFacts)
      .where(whereClause)
      .groupBy(
        vStatsDartFacts.intendedTargetNumber,
        vStatsDartFacts.intendedZoneKey,
        vStatsDartFacts.hitTargetNumber,
        vStatsDartFacts.hitZoneKey,
      );
    return rows.map(mapIntentCellRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsDartFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      intendedTargetNumber: vStatsDartFacts.intendedTargetNumber,
      intendedZoneKey: vStatsDartFacts.intendedZoneKey,
      hitTargetNumber: vStatsDartFacts.hitTargetNumber,
      hitZoneKey: vStatsDartFacts.hitZoneKey,
      darts: count(),
    })
    .from(vStatsDartFacts)
    .where(whereClause)
    .groupBy(
      bucketStartExpr,
      bucketEndExpr,
      vStatsDartFacts.intendedTargetNumber,
      vStatsDartFacts.intendedZoneKey,
      vStatsDartFacts.hitTargetNumber,
      vStatsDartFacts.hitZoneKey,
    );
  return rows.map(mapIntentCellRow);
}

function mapIntentMomentRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  intendedTargetNumber: number | null;
  intendedZoneKey: string | null;
  n: unknown;
  sumX: unknown;
  sumY: unknown;
  sumXX: unknown;
  sumYY: unknown;
  sumXY: unknown;
}): IntentMomentRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    intendedTargetNumber: nonNull(
      row.intendedTargetNumber,
      "intended_target_number",
    ),
    intendedZoneKey: nonNull(row.intendedZoneKey, "intended_zone_key"),
    n: Number(nonNull(row.n as string | null, "n")),
    sumX: Number(nonNull(row.sumX as string | null, "sum_x")),
    sumY: Number(nonNull(row.sumY as string | null, "sum_y")),
    sumXX: Number(nonNull(row.sumXX as string | null, "sum_xx")),
    sumYY: Number(nonNull(row.sumYY as string | null, "sum_yy")),
    sumXY: Number(nonNull(row.sumXY as string | null, "sum_xy")),
  };
}

/**
 * Additive position moments (Σx, Σy, Σx², Σy², Σxy) per intended pair over
 * `v_stats_dart_facts` — feeds `grouping` (phase-2 decision 3). Sums
 * re-aggregate exactly across buckets; the mean/spread/bias derivation stays
 * in `grouping.module.ts`.
 */
export async function findIntentMoments(
  db: Db,
  q: DartScope & { bucket: Bucket; tz: string | undefined },
): Promise<IntentMomentRow[]> {
  const whereClause = and(
    dartScopeWhere(q),
    isNotNull(vStatsDartFacts.intendedZoneKey),
  );
  const sumXExpr = sql<string>`sum(${vStatsDartFacts.locationX})`;
  const sumYExpr = sql<string>`sum(${vStatsDartFacts.locationY})`;
  const sumXXExpr = sql<string>`sum(${vStatsDartFacts.locationX} * ${vStatsDartFacts.locationX})`;
  const sumYYExpr = sql<string>`sum(${vStatsDartFacts.locationY} * ${vStatsDartFacts.locationY})`;
  const sumXYExpr = sql<string>`sum(${vStatsDartFacts.locationX} * ${vStatsDartFacts.locationY})`;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        intendedTargetNumber: vStatsDartFacts.intendedTargetNumber,
        intendedZoneKey: vStatsDartFacts.intendedZoneKey,
        n: count(),
        sumX: sumXExpr,
        sumY: sumYExpr,
        sumXX: sumXXExpr,
        sumYY: sumYYExpr,
        sumXY: sumXYExpr,
      })
      .from(vStatsDartFacts)
      .where(whereClause)
      .groupBy(
        vStatsDartFacts.intendedTargetNumber,
        vStatsDartFacts.intendedZoneKey,
      );
    return rows.map(mapIntentMomentRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsDartFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      intendedTargetNumber: vStatsDartFacts.intendedTargetNumber,
      intendedZoneKey: vStatsDartFacts.intendedZoneKey,
      n: count(),
      sumX: sumXExpr,
      sumY: sumYExpr,
      sumXX: sumXXExpr,
      sumYY: sumYYExpr,
      sumXY: sumXYExpr,
    })
    .from(vStatsDartFacts)
    .where(whereClause)
    .groupBy(
      bucketStartExpr,
      bucketEndExpr,
      vStatsDartFacts.intendedTargetNumber,
      vStatsDartFacts.intendedZoneKey,
    );
  return rows.map(mapIntentMomentRow);
}

/**
 * Missed-dart counts by 45°-sector and radial band, joined against a bound
 * `VALUES` table of reference points — feeds `miss-direction` (phase-2
 * decision 4). Only darts that missed the intended pair count.
 */
export async function findMissSectors(
  db: Db,
  q: DartScope & { refs: MissReference[] },
): Promise<MissSectorRow[]> {
  const whereClause = dartScopeWhere(q);
  const missedClause = sql`NOT (${vStatsDartFacts.hitTargetNumber} IS NOT DISTINCT FROM ${vStatsDartFacts.intendedTargetNumber} AND ${vStatsDartFacts.hitZoneKey} IS NOT DISTINCT FROM ${vStatsDartFacts.intendedZoneKey})`;
  const valuesRows = sql.join(
    q.refs.map(
      (ref) =>
        sql`(${ref.targetNumber}, ${ref.zoneKey}, ${ref.cx}, ${ref.cy}, ${ref.rInner}, ${ref.rOuter})`,
    ),
    sql`, `,
  );
  const sectorExpr = sql`MOD(FLOOR(MOD(DEGREES(ATAN2(${vStatsDartFacts.locationX} - ref.cx, -(${vStatsDartFacts.locationY} - ref.cy))) + 360 + 22.5, 360) / 45)::integer, 8)`;
  const radialExpr = sql`CASE WHEN SQRT(${vStatsDartFacts.locationX} * ${vStatsDartFacts.locationX} + ${vStatsDartFacts.locationY} * ${vStatsDartFacts.locationY}) < ref.r_inner THEN 'INSIDE' WHEN SQRT(${vStatsDartFacts.locationX} * ${vStatsDartFacts.locationX} + ${vStatsDartFacts.locationY} * ${vStatsDartFacts.locationY}) >= ref.r_outer THEN 'OUTSIDE' ELSE 'WITHIN' END`;

  const statement = sql`
    SELECT ref.target_number AS target_number, ref.zone_key AS zone_key, ${sectorExpr} AS sector, ${radialExpr} AS radial, count(*)::integer AS darts
    FROM ${vStatsDartFacts}
    JOIN (VALUES ${valuesRows}) AS ref(target_number, zone_key, cx, cy, r_inner, r_outer)
      ON ${vStatsDartFacts.intendedTargetNumber} IS NOT DISTINCT FROM ref.target_number
     AND ${vStatsDartFacts.intendedZoneKey} IS NOT DISTINCT FROM ref.zone_key
    WHERE ${whereClause} AND ${missedClause}
    GROUP BY ref.target_number, ref.zone_key, sector, radial
  `;

  const result = await db.execute(statement);
  const rows = executedRows<{
    target_number: number | null;
    zone_key: string | null;
    sector: number | null;
    radial: string | null;
    darts: number | null;
  }>(result);

  return rows.map((row) => ({
    targetNumber: nonNull(row.target_number, "target_number"),
    zoneKey: nonNull(row.zone_key, "zone_key"),
    sector: Number(nonNull(row.sector, "sector")),
    radial: nonNull(row.radial, "radial") as MissSectorRow["radial"],
    darts: Number(nonNull(row.darts, "darts")),
  }));
}

/**
 * Non-empty `HEATMAP_CELL_MM` grid cells over `v_stats_dart_facts` — feeds
 * `heatmap` (phase-2 decision 6). `target` narrows to darts aimed at one
 * target when the section's optional `target` parameter is set.
 */
export async function findHeatmapCells(
  db: Db,
  q: DartScope & {
    cellMm: number;
    target: { number: number; zone: string } | null;
  },
): Promise<HeatmapCellRow[]> {
  const conditions = [dartScopeWhere(q)];
  if (q.target !== null) {
    conditions.push(eq(vStatsDartFacts.intendedTargetNumber, q.target.number));
    conditions.push(eq(vStatsDartFacts.intendedZoneKey, q.target.zone));
  }
  const ixExpr = sql<number>`FLOOR(${vStatsDartFacts.locationX} / ${q.cellMm})::integer`;
  const iyExpr = sql<number>`FLOOR(${vStatsDartFacts.locationY} / ${q.cellMm})::integer`;

  const rows = await db
    .select({
      ix: ixExpr,
      iy: iyExpr,
      darts: sql<number>`count(*)::integer`,
    })
    .from(vStatsDartFacts)
    .where(and(...conditions))
    .groupBy(ixExpr, iyExpr);

  return rows.map((row) => ({
    ix: Number(nonNull(row.ix, "ix")),
    iy: Number(nonNull(row.iy, "iy")),
    darts: Number(nonNull(row.darts, "darts")),
  }));
}

/**
 * Reads one page of a game's terminal sessions through
 * `v_stats_session_facts`, newest first (`completed_at DESC, session_id
 * DESC` — D367 decision 4). Fetches `limit + 1` rows so the service can
 * detect a further page without a second query.
 */
export async function findGameSessionsPage(
  db: Db,
  q: {
    playerId: string;
    gameTypeKey: GameTypeKey;
    from: string;
    to: string;
    statuses: string[];
    context: ContextFilter;
    limit: number;
    after?: { completedAt: string; sessionId: string };
  },
): Promise<StatsSessionRow[]> {
  const conditions = [
    eq(vStatsSessionFacts.playerId, q.playerId),
    eq(vStatsSessionFacts.gameTypeKey, q.gameTypeKey),
    gte(vStatsSessionFacts.completedAt, q.from),
    lt(vStatsSessionFacts.completedAt, q.to),
    inArray(vStatsSessionFacts.statusKey, q.statuses),
    contextCondition(q.context),
    q.after
      ? sql`(${vStatsSessionFacts.completedAt}, ${vStatsSessionFacts.sessionId}) < (${q.after.completedAt}, ${q.after.sessionId})`
      : undefined,
  ].filter((condition) => condition !== undefined);

  const rows = await db
    .select({
      sessionId: vStatsSessionFacts.sessionId,
      rulesetVersionKey: vStatsSessionFacts.rulesetVersionKey,
      statusKey: vStatsSessionFacts.statusKey,
      contextKey: vStatsSessionFacts.contextKey,
      startedAt: vStatsSessionFacts.startedAt,
      completedAt: vStatsSessionFacts.completedAt,
      durationSeconds: vStatsSessionFacts.durationSeconds,
      turnCount: vStatsSessionFacts.turnCount,
      dartCount: vStatsSessionFacts.dartCount,
      countedScore: vStatsSessionFacts.countedScore,
    })
    .from(vStatsSessionFacts)
    .where(and(...conditions))
    .orderBy(
      desc(vStatsSessionFacts.completedAt),
      desc(vStatsSessionFacts.sessionId),
    )
    .limit(q.limit + 1);

  return rows.map((row) => {
    const statusKey = nonNull(row.statusKey, "status_key");
    const turnCount = nonNull(row.turnCount, "turn_count");
    return {
      sessionId: nonNull(row.sessionId, "session_id"),
      rulesetVersionKey: nonNull(row.rulesetVersionKey, "ruleset_version_key"),
      statusKey,
      contextKey: nonNull(row.contextKey, "context_key"),
      neverStarted: statusKey === "ABANDONED" && turnCount === 0,
      startedAt: nonNull(row.startedAt, "started_at"),
      completedAt: nonNull(row.completedAt, "completed_at"),
      durationSeconds: nonNull(row.durationSeconds, "duration_seconds"),
      turnCount,
      dartCount: nonNull(row.dartCount, "dart_count"),
      countedScore: nonNull(row.countedScore, "counted_score"),
    };
  });
}

/** The `dataVersion` inputs (`10-Statistics/00-Overview.md` §7): the population's size and its most recent completion. */
export async function findGameDataVersion(
  db: Db,
  playerId: string,
  gameTypeKey: GameTypeKey,
): Promise<{ count: number; maxCompletedAt: string | null }> {
  const [row] = await db
    .select({
      count: count(),
      maxCompletedAt: max(vStatsSessionFacts.completedAt),
    })
    .from(vStatsSessionFacts)
    .where(
      and(
        eq(vStatsSessionFacts.playerId, playerId),
        eq(vStatsSessionFacts.gameTypeKey, gameTypeKey),
      ),
    );

  return {
    count: Number(nonNull(row?.count ?? null, "count")),
    maxCompletedAt: row?.maxCompletedAt ?? null,
  };
}

/**
 * The bucket-widening floor (D367 decision 2): a bucketed request's `from`
 * is floored to the start of its own bucket, so the range the service
 * echoes back exactly matches what `findBucketedSessionAggregates` queried.
 * No table — this is the same `date_trunc` expression evaluated once
 * against the literal `from`, not a column.
 */
export async function findBucketFloor(
  db: Db,
  from: string,
  unit: Exclude<Bucket, "none">,
  tz: string,
): Promise<string> {
  const unitLiteral = sql.raw(`'${BUCKET_UNIT[unit]}'`);
  const result = await db.execute(
    sql`SELECT (date_trunc(${unitLiteral}, ${from}::timestamptz AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS floor`,
  );
  const rows = executedRows<{ floor: string | null }>(result);
  return nonNull(rows[0]?.floor ?? null, "floor");
}

/**
 * One shared aggregate query for `completion`, `volume` and
 * `session-result`: groups a game's terminal sessions by bucket, status,
 * context, ruleset version and never-started, so every section reads the
 * same index scan and projects only what it needs (`00-Overview.md` §5.2).
 * `bucket = none` groups with no bucket expression at all; the caller's
 * `from`/`to` become the single bucket's bounds.
 */
export async function findBucketedSessionAggregates(
  db: Db,
  q: {
    playerId: string;
    gameTypeKey: GameTypeKey;
    from: string;
    to: string;
    bucket: Bucket;
    tz: string | undefined;
    statuses: string[];
    context: ContextFilter;
  },
): Promise<StatsBucketRow[]> {
  const conditions = [
    eq(vStatsSessionFacts.playerId, q.playerId),
    eq(vStatsSessionFacts.gameTypeKey, q.gameTypeKey),
    gte(vStatsSessionFacts.completedAt, q.from),
    lt(vStatsSessionFacts.completedAt, q.to),
    inArray(vStatsSessionFacts.statusKey, q.statuses),
    contextCondition(q.context),
  ].filter((condition) => condition !== undefined);

  const neverStartedExpr = sql<boolean>`(${vStatsSessionFacts.turnCount} = 0)`;
  const minSessionIdExpr = sql<string>`(array_agg(${vStatsSessionFacts.sessionId} order by ${vStatsSessionFacts.countedScore} asc, ${vStatsSessionFacts.completedAt} asc))[1]`;
  const maxSessionIdExpr = sql<string>`(array_agg(${vStatsSessionFacts.sessionId} order by ${vStatsSessionFacts.countedScore} desc, ${vStatsSessionFacts.completedAt} desc))[1]`;

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        statusKey: vStatsSessionFacts.statusKey,
        contextKey: vStatsSessionFacts.contextKey,
        rulesetVersionKey: vStatsSessionFacts.rulesetVersionKey,
        neverStarted: neverStartedExpr,
        sessions: count(),
        turnSum: sql<string>`sum(${vStatsSessionFacts.turnCount})`,
        dartSum: sql<string>`sum(${vStatsSessionFacts.dartCount})`,
        durationSum: sql<string>`sum(${vStatsSessionFacts.durationSeconds})`,
        scoreSum: sql<string>`sum(${vStatsSessionFacts.countedScore})`,
        scoreMin: sql<string>`min(${vStatsSessionFacts.countedScore})`,
        scoreMax: sql<string>`max(${vStatsSessionFacts.countedScore})`,
        minSessionId: minSessionIdExpr,
        maxSessionId: maxSessionIdExpr,
      })
      .from(vStatsSessionFacts)
      .where(and(...conditions))
      .groupBy(
        vStatsSessionFacts.statusKey,
        vStatsSessionFacts.contextKey,
        vStatsSessionFacts.rulesetVersionKey,
        neverStartedExpr,
      );

    return rows.map(mapBucketRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsSessionFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      statusKey: vStatsSessionFacts.statusKey,
      contextKey: vStatsSessionFacts.contextKey,
      rulesetVersionKey: vStatsSessionFacts.rulesetVersionKey,
      neverStarted: neverStartedExpr,
      sessions: count(),
      turnSum: sql<string>`sum(${vStatsSessionFacts.turnCount})`,
      dartSum: sql<string>`sum(${vStatsSessionFacts.dartCount})`,
      durationSum: sql<string>`sum(${vStatsSessionFacts.durationSeconds})`,
      scoreSum: sql<string>`sum(${vStatsSessionFacts.countedScore})`,
      scoreMin: sql<string>`min(${vStatsSessionFacts.countedScore})`,
      scoreMax: sql<string>`max(${vStatsSessionFacts.countedScore})`,
      minSessionId: minSessionIdExpr,
      maxSessionId: maxSessionIdExpr,
    })
    .from(vStatsSessionFacts)
    .where(and(...conditions))
    .groupBy(
      bucketStartExpr,
      bucketEndExpr,
      vStatsSessionFacts.statusKey,
      vStatsSessionFacts.contextKey,
      vStatsSessionFacts.rulesetVersionKey,
      neverStartedExpr,
    );

  return rows.map(mapBucketRow);
}

function mapBucketRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  statusKey: string | null;
  contextKey: string | null;
  rulesetVersionKey: string | null;
  neverStarted: boolean | null;
  sessions: unknown;
  turnSum: unknown;
  dartSum: unknown;
  durationSum: unknown;
  scoreSum: unknown;
  scoreMin: unknown;
  scoreMax: unknown;
  minSessionId: string | null;
  maxSessionId: string | null;
}): StatsBucketRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    statusKey: nonNull(row.statusKey, "status_key"),
    contextKey: nonNull(row.contextKey, "context_key"),
    rulesetVersionKey: nonNull(row.rulesetVersionKey, "ruleset_version_key"),
    neverStarted: nonNull(row.neverStarted, "never_started"),
    sessions: Number(nonNull(row.sessions as string | null, "sessions")),
    turnSum: Number(nonNull(row.turnSum as string | null, "turn_sum")),
    dartSum: Number(nonNull(row.dartSum as string | null, "dart_sum")),
    durationSum: Number(
      nonNull(row.durationSum as string | null, "duration_sum"),
    ),
    scoreSum: Number(nonNull(row.scoreSum as string | null, "score_sum")),
    scoreMin: Number(nonNull(row.scoreMin as string | null, "score_min")),
    scoreMax: Number(nonNull(row.scoreMax as string | null, "score_max")),
    minSessionId: nonNull(row.minSessionId, "min_session_id"),
    maxSessionId: nonNull(row.maxSessionId, "max_session_id"),
  };
}

/**
 * The replay gate (D371 decision 2): one `v_stats_session_facts` row scoped
 * to `player_id` and `session_id`, carrying the header's decision-5 fields.
 * `null` when the session is missing, belongs to another player, is still
 * active, or is a training session — `v_stats_session_facts` excludes all
 * four alike, so a replay page cannot tell them apart. `configuration` and
 * `routineStepSequenceNumber` are the view's own nullable columns, passed
 * through untouched.
 */
export async function findReplaySession(
  db: Db,
  playerId: string,
  sessionId: string,
): Promise<ReplaySessionRow | null> {
  const rows = await db
    .select({
      sessionId: vStatsSessionFacts.sessionId,
      gameTypeKey: vStatsSessionFacts.gameTypeKey,
      rulesetVersionKey: vStatsSessionFacts.rulesetVersionKey,
      inputModeKey: vStatsSessionFacts.inputModeKey,
      statusKey: vStatsSessionFacts.statusKey,
      contextKey: vStatsSessionFacts.contextKey,
      activityId: vStatsSessionFacts.activityId,
      routineStepSequenceNumber: vStatsSessionFacts.routineStepSequenceNumber,
      configuration: vStatsSessionFacts.configuration,
      startedAt: vStatsSessionFacts.startedAt,
      completedAt: vStatsSessionFacts.completedAt,
      durationSeconds: vStatsSessionFacts.durationSeconds,
      turnCount: vStatsSessionFacts.turnCount,
      dartCount: vStatsSessionFacts.dartCount,
    })
    .from(vStatsSessionFacts)
    .where(
      and(
        eq(vStatsSessionFacts.playerId, playerId),
        eq(vStatsSessionFacts.sessionId, sessionId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (row === undefined) return null;

  return {
    sessionId: nonNull(row.sessionId, "session_id"),
    gameTypeKey: nonNull(row.gameTypeKey, "game_type_key") as GameTypeKey,
    rulesetVersionKey: nonNull(row.rulesetVersionKey, "ruleset_version_key"),
    inputModeKey: nonNull(row.inputModeKey, "input_mode_key"),
    statusKey: nonNull(row.statusKey, "status_key"),
    contextKey: nonNull(row.contextKey, "context_key"),
    activityId: nonNull(row.activityId, "activity_id"),
    routineStepSequenceNumber: row.routineStepSequenceNumber,
    configuration: row.configuration as Record<string, unknown> | null,
    startedAt: nonNull(row.startedAt, "started_at"),
    completedAt: nonNull(row.completedAt, "completed_at"),
    durationSeconds: nonNull(row.durationSeconds, "duration_seconds"),
    turnCount: nonNull(row.turnCount, "turn_count"),
    dartCount: nonNull(row.dartCount, "dart_count"),
  };
}

/**
 * `exercise_stages` restricted to one session's own play tree, read through
 * `v_game_replay` (D371 decision 3): every dart/turn row carries its own
 * stage, so `DISTINCT` collapses the result back to one row per stage.
 * Unordered — `stageOrder` (`replay.module.ts`) rebuilds play order from
 * `parentStageId`/`sequence`.
 */
export async function findReplayStages(
  db: Db,
  playerId: string,
  sessionId: string,
): Promise<ReplayStageRow[]> {
  const rows = await db
    .selectDistinct({
      stageId: vGameReplay.stageId,
      parentStageId: vGameReplay.parentStageId,
      stageTypeKey: vGameReplay.stageTypeKey,
      sequence: vGameReplay.stageSequence,
    })
    .from(vGameReplay)
    .where(
      and(
        eq(vGameReplay.playerId, playerId),
        eq(vGameReplay.sessionId, sessionId),
      ),
    );

  return rows.map((row) => ({
    stageId: nonNull(row.stageId, "stage_id"),
    parentStageId: row.parentStageId,
    stageTypeKey: nonNull(row.stageTypeKey, "stage_type_key"),
    sequence: nonNull(row.sequence, "stage_sequence"),
  }));
}

/**
 * `v_game_replay`'s distinct participants for one session, ordered by each
 * participant's own first turn in play order (R4): `array_position` locates
 * a dart row's stage within the caller's own `stageIds` play order (the
 * `stageOrder` result), and `DISTINCT ON` keeps only the row with the
 * smallest `(pos, turn_sequence)` per participant. `stageIds` is bound as
 * one `uuid[]` parameter — `array_position` needs the whole ordered array,
 * not a membership test, so it is never unrolled the way `inArray` unrolls a
 * list.
 */
export async function findReplayParticipants(
  db: Db,
  playerId: string,
  sessionId: string,
  stageIds: readonly string[],
): Promise<ReplayParticipantRow[]> {
  const posExpr = sql`array_position(${sql.param(stageIds)}::uuid[], ${vGameReplay.stageId})`;

  const statement = sql`
    SELECT participant_id, participant_name, participant_type_key
    FROM (
      SELECT DISTINCT ON (${vGameReplay.participantId})
        ${vGameReplay.participantId} AS participant_id,
        ${vGameReplay.participantName} AS participant_name,
        ${vGameReplay.participantTypeKey} AS participant_type_key,
        ${posExpr} AS pos,
        ${vGameReplay.turnSequence} AS turn_sequence
      FROM ${vGameReplay}
      WHERE ${vGameReplay.playerId} = ${playerId} AND ${vGameReplay.sessionId} = ${sessionId}
      ORDER BY ${vGameReplay.participantId}, pos, turn_sequence
    ) first_appearance
    ORDER BY pos, turn_sequence
  `;

  const result = await db.execute(statement);
  const rows = executedRows<{
    participant_id: string | null;
    participant_name: string | null;
    participant_type_key: string | null;
  }>(result);

  return rows.map((row) => ({
    participantId: nonNull(row.participant_id, "participant_id"),
    displayName: nonNull(row.participant_name, "participant_name"),
    participantTypeKey: nonNull(
      row.participant_type_key,
      "participant_type_key",
    ),
  }));
}

function mapReplayRow(row: {
  stage_id: string | null;
  turn_sequence: number | null;
  participant_id: string | null;
  participant_name: string | null;
  participant_type_key: string | null;
  turn_total_score: number | null;
  dart_number: number | null;
  intended_target_number: number | null;
  intended_zone_key: string | null;
  hit_target_number: number | null;
  hit_zone_key: string | null;
  score: number | null;
  location_x: string | number | null;
  location_y: string | number | null;
}): ReplayRow {
  return {
    stageId: nonNull(row.stage_id, "stage_id"),
    turnSequence: nonNull(row.turn_sequence, "turn_sequence"),
    participantId: nonNull(row.participant_id, "participant_id"),
    participantName: nonNull(row.participant_name, "participant_name"),
    participantTypeKey: nonNull(
      row.participant_type_key,
      "participant_type_key",
    ),
    turnTotalScore: nonNull(row.turn_total_score, "turn_total_score"),
    dartNumber: row.dart_number,
    intendedTargetNumber: row.intended_target_number,
    intendedZoneKey: row.intended_zone_key as DartZoneKey | null,
    hitTargetNumber: row.hit_target_number,
    hitZoneKey: row.hit_zone_key as DartZoneKey | null,
    score: row.score,
    locationX: row.location_x === null ? null : Number(row.location_x),
    locationY: row.location_y === null ? null : Number(row.location_y),
  };
}

/**
 * One page of a session's turns, in play order (D371 decision 4): `stageIds`
 * is the caller's own `stageOrder` result, bound as a single `uuid[]`
 * parameter so `array_position` can rank a dart row's stage within it.
 * `dense_rank() OVER (ORDER BY array_position(...), turn_sequence)` assigns
 * one rank per turn — every dart row of a turn shares it, so `turn_rank <=
 * limit + 1` keeps whole turns, never splitting one across the page
 * boundary. The keyset predicate (`after`) is a `WHERE` clause inside this
 * same ranking query, ahead of the window function, so `dense_rank` restarts
 * at 1 for whatever remains after the cursor — a fresh page, not a slice of
 * the first one. `after: null` renders no keyset predicate. `position` is
 * 1-based, matching `array_position`'s own convention.
 */
export async function findReplayTurnPage(
  db: Db,
  q: {
    playerId: string;
    sessionId: string;
    stageIds: readonly string[];
    after: { position: number; turnSequence: number } | null;
    limit: number;
  },
): Promise<ReplayRow[]> {
  const posExpr = sql`array_position(${sql.param(q.stageIds)}::uuid[], ${vGameReplay.stageId})`;
  const keysetClause = q.after
    ? sql`AND (${posExpr}, ${vGameReplay.turnSequence}) > (${q.after.position}, ${q.after.turnSequence})`
    : sql``;

  const statement = sql`
    SELECT stage_id, turn_sequence, participant_id, participant_name, participant_type_key,
      turn_total_score, dart_number, intended_target_number, intended_zone_key,
      hit_target_number, hit_zone_key, score, location_x, location_y
    FROM (
      SELECT *,
        ${posExpr} AS pos,
        dense_rank() OVER (ORDER BY ${posExpr}, ${vGameReplay.turnSequence}) AS turn_rank
      FROM ${vGameReplay}
      WHERE ${vGameReplay.playerId} = ${q.playerId} AND ${vGameReplay.sessionId} = ${q.sessionId}
      ${keysetClause}
    ) ranked
    WHERE turn_rank <= ${q.limit + 1}
    ORDER BY pos, turn_sequence, dart_number
  `;

  const result = await db.execute(statement);
  const rows = executedRows<{
    stage_id: string | null;
    turn_sequence: number | null;
    participant_id: string | null;
    participant_name: string | null;
    participant_type_key: string | null;
    turn_total_score: number | null;
    dart_number: number | null;
    intended_target_number: number | null;
    intended_zone_key: string | null;
    hit_target_number: number | null;
    hit_zone_key: string | null;
    score: number | null;
    location_x: string | number | null;
    location_y: string | number | null;
  }>(result);

  return rows.map(mapReplayRow);
}

/**
 * Every routine the player has trained, grouped by `routine_key` over
 * `v_stats_routine_run_facts` (phase 6b plan decision 9): `routineName` is
 * the latest run's own name (a rename keeps history), ordered newest-first.
 */
export async function findTrainedRoutines(
  db: Db,
  playerId: string,
): Promise<TrainedRoutineRow[]> {
  const routineNameExpr = sql<string>`(array_agg(${vStatsRoutineRunFacts.routineName} order by ${vStatsRoutineRunFacts.completedAt} desc))[1]`;
  const routineTemplateIdExpr = sql<
    string | null
  >`min(${vStatsRoutineRunFacts.routineTemplateId})`;
  const completedRunCountExpr = sql<string>`count(*) filter (where ${vStatsRoutineRunFacts.statusKey} = 'COMPLETED')`;
  const lastRunAtExpr = max(vStatsRoutineRunFacts.completedAt);

  const rows = await db
    .select({
      routineKey: vStatsRoutineRunFacts.routineKey,
      routineTemplateId: routineTemplateIdExpr,
      routineName: routineNameExpr,
      runCount: count(),
      completedRunCount: completedRunCountExpr,
      lastRunAt: lastRunAtExpr,
    })
    .from(vStatsRoutineRunFacts)
    .where(eq(vStatsRoutineRunFacts.playerId, playerId))
    .groupBy(vStatsRoutineRunFacts.routineKey)
    .orderBy(desc(lastRunAtExpr));

  return rows.map((row) => ({
    routineKey: nonNull(row.routineKey, "routine_key"),
    routineTemplateId: row.routineTemplateId,
    routineName: nonNull(row.routineName, "routine_name"),
    runCount: Number(nonNull(row.runCount, "run_count")),
    completedRunCount: Number(
      nonNull(row.completedRunCount as string | null, "completed_run_count"),
    ),
    lastRunAt: nonNull(row.lastRunAt, "last_run_at"),
  }));
}

/**
 * One routine's run counts, its earliest and latest run, and the latest
 * run's own `activity_id` over `v_stats_routine_run_facts` (phase 6b plan
 * decision 9) — `null` when the player has never trained this routine.
 */
export async function findRoutineHeader(
  db: Db,
  playerId: string,
  routineKey: string,
): Promise<RoutineHeaderRow | null> {
  const routineNameExpr = sql<string>`(array_agg(${vStatsRoutineRunFacts.routineName} order by ${vStatsRoutineRunFacts.completedAt} desc))[1]`;
  const latestActivityIdExpr = sql<string>`(array_agg(${vStatsRoutineRunFacts.activityId} order by ${vStatsRoutineRunFacts.completedAt} desc))[1]`;
  const firstRunAtExpr = sql<string>`min(${vStatsRoutineRunFacts.completedAt})`;
  const lastRunAtExpr = sql<string>`max(${vStatsRoutineRunFacts.completedAt})`;

  const rows = await db
    .select({
      routineKey: vStatsRoutineRunFacts.routineKey,
      routineName: routineNameExpr,
      runCount: count(),
      firstRunAt: firstRunAtExpr,
      lastRunAt: lastRunAtExpr,
      latestActivityId: latestActivityIdExpr,
    })
    .from(vStatsRoutineRunFacts)
    .where(
      and(
        eq(vStatsRoutineRunFacts.playerId, playerId),
        eq(vStatsRoutineRunFacts.routineKey, routineKey),
      ),
    )
    .groupBy(vStatsRoutineRunFacts.routineKey);

  const row = rows[0];
  if (row === undefined) return null;

  return {
    routineKey: nonNull(row.routineKey, "routine_key"),
    routineName: nonNull(row.routineName, "routine_name"),
    runCount: Number(nonNull(row.runCount, "run_count")),
    firstRunAt: nonNull(row.firstRunAt, "first_run_at"),
    lastRunAt: nonNull(row.lastRunAt, "last_run_at"),
    latestActivityId: nonNull(row.latestActivityId, "latest_activity_id"),
  };
}

/**
 * Every step index the routine has ever run, grouped by `step_key` over
 * `v_stats_routine_step_facts` (phase 6b plan decisions 2, 9) — a step's
 * identity, exercise/game type and duration are constant within one
 * `step_key` (the fingerprint half of the key is derived from exactly those
 * fields), so `min`/`max` picks a group's shared value rather than
 * re-deriving it. `current` is set when the step key appears in
 * `latestActivityId`'s own run. Ordered by `sequenceNumber`, then
 * `lastSeenAt` descending.
 */
export async function findRoutineStepDescriptors(
  db: Db,
  playerId: string,
  routineKey: string,
  latestActivityId: string,
): Promise<RoutineStepDescriptorRow[]> {
  const exerciseTypeKeyExpr = sql<string>`min(${vStatsRoutineStepFacts.exerciseTypeKey})`;
  const exerciseRulesetVersionKeyExpr = sql<
    string | null
  >`min(${vStatsRoutineStepFacts.exerciseRulesetVersionKey})`;
  const gameTypeKeyExpr = sql<
    string | null
  >`min(${vStatsRoutineStepFacts.gameTypeKey})`;
  const rulesetVersionKeyExpr = sql<
    string | null
  >`min(${vStatsRoutineStepFacts.rulesetVersionKey})`;
  const durationSecondsExpr = sql<string>`max(${vStatsRoutineStepFacts.durationSeconds})`;
  const firstSeenAtExpr = sql<string>`min(${vStatsRoutineStepFacts.completedAt})`;
  const lastSeenAtExpr = sql<string>`max(${vStatsRoutineStepFacts.completedAt})`;
  const currentExpr = sql<boolean>`bool_or(${vStatsRoutineStepFacts.activityId} = ${latestActivityId})`;

  const rows = await db
    .select({
      stepKey: vStatsRoutineStepFacts.stepKey,
      sequenceNumber: vStatsRoutineStepFacts.sequenceNumber,
      exerciseTypeKey: exerciseTypeKeyExpr,
      exerciseRulesetVersionKey: exerciseRulesetVersionKeyExpr,
      gameTypeKey: gameTypeKeyExpr,
      rulesetVersionKey: rulesetVersionKeyExpr,
      durationSeconds: durationSecondsExpr,
      sessionCount: count(),
      firstSeenAt: firstSeenAtExpr,
      lastSeenAt: lastSeenAtExpr,
      current: currentExpr,
    })
    .from(vStatsRoutineStepFacts)
    .where(
      and(
        eq(vStatsRoutineStepFacts.playerId, playerId),
        eq(vStatsRoutineStepFacts.routineKey, routineKey),
      ),
    )
    .groupBy(
      vStatsRoutineStepFacts.stepKey,
      vStatsRoutineStepFacts.sequenceNumber,
    )
    .orderBy(vStatsRoutineStepFacts.sequenceNumber, desc(lastSeenAtExpr));

  return rows.map((row) => ({
    stepKey: nonNull(row.stepKey, "step_key"),
    sequenceNumber: nonNull(row.sequenceNumber, "sequence_number"),
    exerciseTypeKey: nonNull(row.exerciseTypeKey, "exercise_type_key"),
    exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
    gameTypeKey: row.gameTypeKey as GameTypeKey | null,
    rulesetVersionKey: row.rulesetVersionKey,
    durationSeconds: Number(
      nonNull(row.durationSeconds as string | null, "duration_seconds"),
    ),
    sessionCount: Number(nonNull(row.sessionCount, "session_count")),
    firstSeenAt: nonNull(row.firstSeenAt, "first_seen_at"),
    lastSeenAt: nonNull(row.lastSeenAt, "last_seen_at"),
    current: nonNull(row.current, "current"),
  }));
}

/**
 * The `dataVersion` for one routine (phase 6b plan decision 12): reuses the
 * game `dataVersion`'s own `encodeDataVersion` codec over the routine's
 * terminal runs (`v_stats_routine_run_facts` already holds terminal runs
 * only, so no status filter is needed here).
 */
export async function findRoutineDataVersion(
  db: Db,
  playerId: string,
  routineKey: string,
): Promise<string> {
  const [row] = await db
    .select({
      count: count(),
      maxCompletedAt: max(vStatsRoutineRunFacts.completedAt),
    })
    .from(vStatsRoutineRunFacts)
    .where(
      and(
        eq(vStatsRoutineRunFacts.playerId, playerId),
        eq(vStatsRoutineRunFacts.routineKey, routineKey),
      ),
    );

  return encodeDataVersion({
    count: Number(nonNull(row?.count ?? null, "count")),
    maxCompletedAt: row?.maxCompletedAt ?? null,
  });
}

function mapRoutineRunBucketRow(row: {
  bucket_start: string | null;
  bucket_end: string | null;
  runs: unknown;
  duration_sum: unknown;
  duration_min: unknown;
  duration_max: unknown;
  darts: unknown;
  completed: unknown;
  abandoned: unknown;
  never_started: unknown;
  steps_completed_at_abandon: Record<string, number> | null;
}): RoutineRunBucketRow {
  return {
    bucketStart: nonNull(row.bucket_start, "bucket_start"),
    bucketEnd: nonNull(row.bucket_end, "bucket_end"),
    runs: Number(nonNull(row.runs as string | null, "runs")),
    durationSum: Number(
      nonNull(row.duration_sum as string | null, "duration_sum"),
    ),
    durationMin: Number(
      nonNull(row.duration_min as string | null, "duration_min"),
    ),
    durationMax: Number(
      nonNull(row.duration_max as string | null, "duration_max"),
    ),
    darts: Number(nonNull(row.darts as string | null, "darts")),
    completed: Number(nonNull(row.completed as string | null, "completed")),
    abandoned: Number(nonNull(row.abandoned as string | null, "abandoned")),
    neverStarted: Number(
      nonNull(row.never_started as string | null, "never_started"),
    ),
    stepsCompletedAtAbandon: nonNull(
      row.steps_completed_at_abandon,
      "steps_completed_at_abandon",
    ),
  };
}

/**
 * One shared aggregate query for `routine-volume` and `routine-completion`
 * over `v_stats_routine_run_facts` (phase 6b plan decision 6): one row per
 * bucket, with `completed`/`abandoned`/`never_started` as `FILTER`-restricted
 * counts that partition the bucket's runs -- `never_started` is an
 * `ABANDONED` run with zero step sessions, so `abandoned` excludes it the
 * same way `completionBuckets` partitions the game session equivalent (D367
 * decision 5). `steps_completed_at_abandon` is a grouped sub-select
 * -- a per-row `LATERAL` histogram of the bucket's own abandoned runs by
 * `steps_completed`, joined ahead of the outer `GROUP BY` so it can
 * correlate on the bucket's own boundary, then carried through
 * `array_agg(...)[1]` since it is constant across every row of one bucket
 * (`jsonb` has no `MAX`/`MIN` aggregate). `bucket = none` skips the
 * `LATERAL` entirely -- the whole scope is already one bucket, so the
 * histogram sub-select needs no per-row correlation.
 */
export async function findRoutineRunBuckets(
  db: Db,
  q: RoutineScope & { bucket: Bucket; tz: string | undefined },
): Promise<RoutineRunBucketRow[]> {
  const statusesArray = sql`${sql.param(q.statuses)}::text[]`;

  if (q.bucket === "none") {
    const statement = sql`
      WITH scoped AS (
        SELECT *
        FROM ${vStatsRoutineRunFacts}
        WHERE ${vStatsRoutineRunFacts.playerId} = ${q.playerId}
          AND ${vStatsRoutineRunFacts.routineKey} = ${q.routineKey}
          AND ${vStatsRoutineRunFacts.completedAt} >= ${q.from}
          AND ${vStatsRoutineRunFacts.completedAt} < ${q.to}
          AND ${vStatsRoutineRunFacts.statusKey} = ANY(${statusesArray})
      )
      SELECT
        ${q.from}::timestamptz AS bucket_start,
        ${q.to}::timestamptz AS bucket_end,
        count(*)::integer AS runs,
        coalesce(sum(duration_seconds), 0)::integer AS duration_sum,
        coalesce(min(duration_seconds), 0)::integer AS duration_min,
        coalesce(max(duration_seconds), 0)::integer AS duration_max,
        coalesce(sum(dart_count), 0)::integer AS darts,
        count(*) filter (where status_key = 'COMPLETED')::integer AS completed,
        count(*) filter (where status_key = 'ABANDONED' AND steps_started > 0)::integer AS abandoned,
        count(*) filter (where status_key = 'ABANDONED' AND steps_started = 0)::integer AS never_started,
        (
          SELECT coalesce(jsonb_object_agg(x.steps_completed::text, x.cnt), '{}'::jsonb)
          FROM (
            SELECT steps_completed, count(*)::integer AS cnt
            FROM scoped
            WHERE status_key = 'ABANDONED'
            GROUP BY steps_completed
          ) x
        ) AS steps_completed_at_abandon
      FROM scoped
    `;
    const result = await db.execute(statement);
    return executedRows<Parameters<typeof mapRoutineRunBucketRow>[0]>(
      result,
    ).map(mapRoutineRunBucketRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const unitLiteral = sql.raw(`'${BUCKET_UNIT[q.bucket]}'`);
  const intervalLiteral = sql.raw(`interval '1 ${BUCKET_UNIT[q.bucket]}'`);

  const statement = sql`
    WITH scoped AS (
      SELECT *,
        (date_trunc(${unitLiteral}, ${vStatsRoutineRunFacts.completedAt} AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) AS bucket_start,
        ((date_trunc(${unitLiteral}, ${vStatsRoutineRunFacts.completedAt} AT TIME ZONE ${tz}) AT TIME ZONE ${tz}) + ${intervalLiteral}) AS bucket_end
      FROM ${vStatsRoutineRunFacts}
      WHERE ${vStatsRoutineRunFacts.playerId} = ${q.playerId}
        AND ${vStatsRoutineRunFacts.routineKey} = ${q.routineKey}
        AND ${vStatsRoutineRunFacts.completedAt} >= ${q.from}
        AND ${vStatsRoutineRunFacts.completedAt} < ${q.to}
        AND ${vStatsRoutineRunFacts.statusKey} = ANY(${statusesArray})
    )
    SELECT
      scoped.bucket_start AS bucket_start,
      scoped.bucket_end AS bucket_end,
      count(*)::integer AS runs,
      coalesce(sum(duration_seconds), 0)::integer AS duration_sum,
      coalesce(min(duration_seconds), 0)::integer AS duration_min,
      coalesce(max(duration_seconds), 0)::integer AS duration_max,
      coalesce(sum(dart_count), 0)::integer AS darts,
      count(*) filter (where status_key = 'COMPLETED')::integer AS completed,
      count(*) filter (where status_key = 'ABANDONED' AND steps_started > 0)::integer AS abandoned,
      count(*) filter (where status_key = 'ABANDONED' AND steps_started = 0)::integer AS never_started,
      (array_agg(steps_at_abandon.agg))[1] AS steps_completed_at_abandon
    FROM scoped
    LEFT JOIN LATERAL (
      SELECT coalesce(jsonb_object_agg(x.steps_completed::text, x.cnt), '{}'::jsonb) AS agg
      FROM (
        SELECT s2.steps_completed, count(*)::integer AS cnt
        FROM scoped s2
        WHERE s2.bucket_start = scoped.bucket_start AND s2.status_key = 'ABANDONED'
        GROUP BY s2.steps_completed
      ) x
    ) steps_at_abandon ON TRUE
    GROUP BY scoped.bucket_start, scoped.bucket_end
    ORDER BY scoped.bucket_start
  `;
  const result = await db.execute(statement);
  return executedRows<Parameters<typeof mapRoutineRunBucketRow>[0]>(result).map(
    mapRoutineRunBucketRow,
  );
}

function mapStepBucketRow(row: {
  bucketStart: string | null;
  bucketEnd: string | null;
  sessions: unknown;
  durationSum: unknown;
  darts: unknown;
}): StepBucketRow {
  return {
    bucketStart: nonNull(row.bucketStart, "bucket_start"),
    bucketEnd: nonNull(row.bucketEnd, "bucket_end"),
    sessions: Number(nonNull(row.sessions as string | null, "sessions")),
    durationSum: Number(
      nonNull(row.durationSum as string | null, "duration_sum"),
    ),
    darts: Number(nonNull(row.darts as string | null, "darts")),
  };
}

/**
 * One bucket's session volume over `v_stats_routine_step_facts` (phase 6b
 * plan decision 6): `sessions`/`durationSum`/`darts`, using the same
 * whitelisted `bucketExprs` every other bucketed reader shares.
 */
export async function findStepBuckets(
  db: Db,
  q: StepScope & { bucket: Bucket; tz: string | undefined },
): Promise<StepBucketRow[]> {
  const whereClause = and(
    eq(vStatsRoutineStepFacts.playerId, q.playerId),
    eq(vStatsRoutineStepFacts.routineKey, q.routineKey),
    eq(vStatsRoutineStepFacts.stepKey, q.stepKey),
    gte(vStatsRoutineStepFacts.completedAt, q.from),
    lt(vStatsRoutineStepFacts.completedAt, q.to),
    inArray(vStatsRoutineStepFacts.statusKey, q.statuses),
  );

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        sessions: count(),
        durationSum: sql<string>`coalesce(sum(${vStatsRoutineStepFacts.durationSeconds}), 0)`,
        darts: sql<string>`coalesce(sum(${vStatsRoutineStepFacts.dartCount}), 0)`,
      })
      .from(vStatsRoutineStepFacts)
      .where(whereClause);
    return rows.map(mapStepBucketRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    vStatsRoutineStepFacts.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      sessions: count(),
      durationSum: sql<string>`coalesce(sum(${vStatsRoutineStepFacts.durationSeconds}), 0)`,
      darts: sql<string>`coalesce(sum(${vStatsRoutineStepFacts.dartCount}), 0)`,
    })
    .from(vStatsRoutineStepFacts)
    .where(whereClause)
    .groupBy(bucketStartExpr, bucketEndExpr);
  return rows.map(mapStepBucketRow);
}

/**
 * One page of one step's terminal sessions through
 * `v_stats_routine_step_facts`, newest first (phase 6b plan decision 10,
 * mirroring `findGameSessionsPage`, D367 decision 4). Fetches `limit + 1`
 * rows so the service can detect a further page without a second query.
 */
export async function findStepSessionPage(
  db: Db,
  q: StepScope & {
    limit: number;
    after?: { completedAt: string; sessionId: string };
  },
): Promise<StepSessionRow[]> {
  const conditions = [
    eq(vStatsRoutineStepFacts.playerId, q.playerId),
    eq(vStatsRoutineStepFacts.routineKey, q.routineKey),
    eq(vStatsRoutineStepFacts.stepKey, q.stepKey),
    gte(vStatsRoutineStepFacts.completedAt, q.from),
    lt(vStatsRoutineStepFacts.completedAt, q.to),
    inArray(vStatsRoutineStepFacts.statusKey, q.statuses),
    q.after
      ? sql`(${vStatsRoutineStepFacts.completedAt}, ${vStatsRoutineStepFacts.sessionId}) < (${q.after.completedAt}, ${q.after.sessionId})`
      : undefined,
  ].filter((condition) => condition !== undefined);

  const rows = await db
    .select({
      sessionId: vStatsRoutineStepFacts.sessionId,
      rulesetVersionKey: vStatsRoutineStepFacts.rulesetVersionKey,
      exerciseRulesetVersionKey:
        vStatsRoutineStepFacts.exerciseRulesetVersionKey,
      statusKey: vStatsRoutineStepFacts.statusKey,
      startedAt: vStatsRoutineStepFacts.startedAt,
      completedAt: vStatsRoutineStepFacts.completedAt,
      durationSeconds: vStatsRoutineStepFacts.durationSeconds,
      turnCount: vStatsRoutineStepFacts.turnCount,
      dartCount: vStatsRoutineStepFacts.dartCount,
      countedScore: vStatsRoutineStepFacts.countedScore,
    })
    .from(vStatsRoutineStepFacts)
    .where(and(...conditions))
    .orderBy(
      desc(vStatsRoutineStepFacts.completedAt),
      desc(vStatsRoutineStepFacts.sessionId),
    )
    .limit(q.limit + 1);

  return rows.map((row) => {
    const statusKey = nonNull(row.statusKey, "status_key");
    const turnCount = nonNull(row.turnCount, "turn_count");
    return {
      sessionId: nonNull(row.sessionId, "session_id"),
      rulesetVersionKey: row.rulesetVersionKey,
      exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
      statusKey,
      neverStarted: statusKey === "ABANDONED" && turnCount === 0,
      startedAt: nonNull(row.startedAt, "started_at"),
      completedAt: nonNull(row.completedAt, "completed_at"),
      durationSeconds: nonNull(row.durationSeconds, "duration_seconds"),
      turnCount,
      dartCount: nonNull(row.dartCount, "dart_count"),
      countedScore: nonNull(row.countedScore, "counted_score"),
    };
  });
}

function mapStepFoldRow(row: {
  sessionId: string | null;
  completedAt: string | null;
  exerciseRulesetVersionKey: string | null;
  configuration: unknown;
  stageId: string | null;
  turnSequence: number | null;
  participantId: string | null;
  participantName: string | null;
  participantTypeKey: string | null;
  turnTotalScore: number | null;
  dartNumber: number | null;
  intendedTargetNumber: number | null;
  intendedZoneKey: string | null;
  hitTargetNumber: number | null;
  hitZoneKey: string | null;
  score: number | null;
  locationX: string | number | null;
  locationY: string | number | null;
}): StepFoldRow {
  return {
    sessionId: nonNull(row.sessionId, "session_id"),
    completedAt: nonNull(row.completedAt, "completed_at"),
    exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
    configuration: row.configuration as Record<string, unknown> | null,
    stageId: nonNull(row.stageId, "stage_id"),
    turnSequence: nonNull(row.turnSequence, "turn_sequence"),
    participantId: nonNull(row.participantId, "participant_id"),
    participantName: nonNull(row.participantName, "participant_name"),
    participantTypeKey: nonNull(row.participantTypeKey, "participant_type_key"),
    turnTotalScore: nonNull(row.turnTotalScore, "turn_total_score"),
    dartNumber: row.dartNumber,
    intendedTargetNumber: row.intendedTargetNumber,
    intendedZoneKey: row.intendedZoneKey as DartZoneKey | null,
    hitTargetNumber: row.hitTargetNumber,
    hitZoneKey: row.hitZoneKey as DartZoneKey | null,
    score: row.score,
    locationX: row.locationX === null ? null : Number(row.locationX),
    locationY: row.locationY === null ? null : Number(row.locationY),
  };
}

/**
 * `v_game_replay` joined to `v_stats_routine_step_facts` on `session_id`,
 * scoped to one step (phase 6b plan decision 8) -- the input to the
 * server-side `step-result` fold, which rebuilds each session's exercise
 * engine from these facts. Unbucketed: bucket assignment happens after the
 * fold, keyed by each row's own `completedAt` (its session's, not the
 * dart's). Ordered by session, stage, turn and dart -- the order every
 * replay fold requires (matching `findX01FoldRows`).
 */
export async function findStepFoldRows(
  db: Db,
  q: StepScope,
): Promise<StepFoldRow[]> {
  const rows = await db
    .select({
      sessionId: vGameReplay.sessionId,
      completedAt: vStatsRoutineStepFacts.completedAt,
      exerciseRulesetVersionKey:
        vStatsRoutineStepFacts.exerciseRulesetVersionKey,
      configuration: vStatsRoutineStepFacts.configuration,
      stageId: vGameReplay.stageId,
      turnSequence: vGameReplay.turnSequence,
      participantId: vGameReplay.participantId,
      participantName: vGameReplay.participantName,
      participantTypeKey: vGameReplay.participantTypeKey,
      turnTotalScore: vGameReplay.turnTotalScore,
      dartNumber: vGameReplay.dartNumber,
      intendedTargetNumber: vGameReplay.intendedTargetNumber,
      intendedZoneKey: vGameReplay.intendedZoneKey,
      hitTargetNumber: vGameReplay.hitTargetNumber,
      hitZoneKey: vGameReplay.hitZoneKey,
      score: vGameReplay.score,
      locationX: vGameReplay.locationX,
      locationY: vGameReplay.locationY,
    })
    .from(vGameReplay)
    .innerJoin(
      vStatsRoutineStepFacts,
      eq(vGameReplay.sessionId, vStatsRoutineStepFacts.sessionId),
    )
    .where(
      and(
        eq(vStatsRoutineStepFacts.playerId, q.playerId),
        eq(vStatsRoutineStepFacts.routineKey, q.routineKey),
        eq(vStatsRoutineStepFacts.stepKey, q.stepKey),
        gte(vStatsRoutineStepFacts.completedAt, q.from),
        lt(vStatsRoutineStepFacts.completedAt, q.to),
        inArray(vStatsRoutineStepFacts.statusKey, q.statuses),
      ),
    )
    .orderBy(
      vGameReplay.sessionId,
      vGameReplay.stageSequence,
      vGameReplay.turnSequence,
      vGameReplay.dartNumber,
    );

  return rows.map(mapStepFoldRow);
}

/**
 * The `dart_count` sum over `v_stats_routine_step_facts` for one step scope
 * (phase 6b plan decision 8, mirroring `findScopeDartCount`): the fold bound
 * `MAX_FOLD_DARTS` gates against this before the `step-result` section reads
 * `findStepFoldRows`.
 */
export async function findStepScopeDartCount(
  db: Db,
  q: StepScope,
): Promise<number> {
  const [row] = await db
    .select({
      dartCount: sql<string>`coalesce(sum(${vStatsRoutineStepFacts.dartCount}), 0)::integer`,
    })
    .from(vStatsRoutineStepFacts)
    .where(
      and(
        eq(vStatsRoutineStepFacts.playerId, q.playerId),
        eq(vStatsRoutineStepFacts.routineKey, q.routineKey),
        eq(vStatsRoutineStepFacts.stepKey, q.stepKey),
        gte(vStatsRoutineStepFacts.completedAt, q.from),
        lt(vStatsRoutineStepFacts.completedAt, q.to),
        inArray(vStatsRoutineStepFacts.statusKey, q.statuses),
      ),
    );

  return Number(nonNull(row?.dartCount ?? null, "dart_count"));
}
