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
  vPlayerLegFacts,
  vPlayerVisitFacts,
  vSessionOverview,
  vStatsDartFacts,
  vStatsSessionFacts,
  vX01CheckoutDarts,
} from "@db/schema";
import { nonNull } from "./row-helpers";
import type { getDb } from "@db/client";
import type { Bucket, ContextFilter, GameTypeKey } from "@lib/types";
import type {
  DartScope,
  HeatmapCellRow,
  IntentCellRow,
  IntentMomentRow,
  MissReference,
  MissSectorRow,
  PlayerLegFactRow,
  PlayerSessionSummaryRow,
  PlayerVisitFactRow,
  StatsBucketRow,
  StatsSessionRow,
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
  ].filter((condition) => condition !== undefined);
  return and(...conditions);
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
