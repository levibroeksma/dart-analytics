import { getDb } from "@db/client";
import {
  MAX_FOLD_DARTS,
  SECTIONS,
  sectionsForGame,
  tagsForGameType,
} from "@lib/stats/section-registry";
import { parseTargetKey, formatTargetKey } from "@lib/stats/target-key";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import {
  averageDartsPerLeg,
  bestLegDarts,
} from "@modules/stats/leg-stats.module";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import {
  checkoutVisitsFromRows,
  sessionCheckoutVisits,
} from "@modules/stats/x01-checkout-sessions.module";
import {
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import { bustRateBuckets } from "@modules/stats/sections/bust-rate.module";
import { checkoutPathBuckets } from "@modules/stats/sections/checkout-path.module";
import { checkoutRateBuckets } from "@modules/stats/sections/checkout-rate.module";
import { completionBuckets } from "@modules/stats/sections/completion.module";
import { confusionBuckets } from "@modules/stats/sections/confusion.module";
import { doublePerformanceBuckets } from "@modules/stats/sections/double-performance.module";
import { groupingBuckets } from "@modules/stats/sections/grouping.module";
import {
  HEATMAP_CELL_MM,
  heatmapBuckets,
} from "@modules/stats/sections/heatmap.module";
import { ladderProgressBuckets } from "@modules/stats/sections/ladder-progress.module";
import { legStatsBuckets } from "@modules/stats/sections/leg-stats.module";
import { looseDartsBuckets } from "@modules/stats/sections/loose-darts.module";
import {
  missDirectionBuckets,
  missReferences,
} from "@modules/stats/sections/miss-direction.module";
import {
  SCORE_BANDS,
  scoringTrendBuckets,
} from "@modules/stats/sections/scoring-trend.module";
import {
  decodeCursor,
  encodeCursor,
  encodeDataVersion,
} from "@modules/stats/sections/series.module";
import { sessionResultBuckets } from "@modules/stats/sections/session-result.module";
import { targetAccuracyBuckets } from "@modules/stats/sections/target-accuracy.module";
import { trebleRateBuckets } from "@modules/stats/sections/treble-rate.module";
import { volumeBuckets } from "@modules/stats/sections/volume.module";
import {
  findBucketFloor,
  findBucketedSessionAggregates,
  findGameDataVersion,
  findGameSessionsPage,
  findHeatmapCells,
  findHitNumberCells,
  findIntentCells,
  findIntentMoments,
  findLegFacts,
  findMissSectors,
  findScopeDartCount,
  findSessionSummaries,
  findVisitFacts,
  findVisitScoring,
  findX01CheckoutDarts,
  findX01FoldRows,
} from "@repositories/statistics.repository";
import type {
  Bucket,
  ContextFilter,
  GameTypeKey,
  IntentZoneKey,
  SectionId,
  SectionMeta,
  SeriesBucket,
  StatusFilter,
  TargetKey,
} from "@lib/types";
import type {
  SessionListQueryData,
  StatisticsRangeQueryData,
} from "@routes/types";
import type {
  BucketedSession,
  HeatmapCellRow,
  HitNumberCellRow,
  IntentCellRow,
  IntentMomentRow,
  MissSectorRow,
  SessionScope,
  StatsBucketRow,
  VisitScoringRow,
  X01FoldRow,
} from "@modules/types";
import type {
  GameSessionList,
  ServiceResult,
  SeriesResponse,
  StatisticsOverview,
} from "./types";

/** Assembles the caller's career-wide stat overview from the 4 statistics views. */
export async function getStatisticsOverview(
  playerId: string,
): Promise<StatisticsOverview> {
  const db = getDb();
  const [sessions, visits, legs, checkoutDarts] = await Promise.all([
    findSessionSummaries(db, playerId),
    findVisitFacts(db, playerId),
    findLegFacts(db, playerId),
    findX01CheckoutDarts(db, playerId),
  ]);

  const bands = scoreBandCounts(visits);
  const checkoutVisits = checkoutVisitsFromRows(checkoutDarts);
  const { hits, misses } = classifyDoubleAttempts(checkoutVisits);

  return {
    totalGamesPlayed: totalGamesPlayed(sessions),
    totalPlayTimeSeconds: totalPlayTimeSeconds(sessions),
    favoriteGameTypeKey: favoriteGameTypeKey(sessions),
    longestPlayStreakDays: longestPlayStreakDays(sessions),
    currentPlayStreakDays: currentPlayStreakDays(sessions),
    totalDartsThrown: totalDartsThrown(visits),
    hundredPlusCount: bands.hundredPlus,
    oneTwentyPlusCount: bands.oneTwentyPlus,
    oneFortyPlusCount: bands.oneFortyPlus,
    oneEightiesCount: bands.oneEighties,
    medianVisitScore: medianVisitScore(visits),
    highestGameAverage: highestGameAverage(visits),
    firstNineCareerAverage: firstNineCareerAverage(visits),
    scoringAverageExcludingDoubles: scoringAverageExcludingDoubles(
      visits,
      checkoutVisits,
    ),
    bestLegDarts: bestLegDarts(legs),
    averageDartsPerLeg: averageDartsPerLeg(legs),
    checkoutPercentage: hits + misses === 0 ? null : hits / (hits + misses),
    highestCheckout: highestCheckout(checkoutVisits),
  };
}

type Db = ReturnType<typeof getDb>;

/**
 * Everything a section's `load` might need, resolved once by `getGameSection`
 * before dispatch. Each `load` reads only the fields its reader takes.
 */
type SectionContext = {
  playerId: string;
  gameTypeKey: GameTypeKey;
  from: string;
  to: string;
  bucket: Bucket;
  tz: string | undefined;
  statuses: string[];
  context: ContextFilter;
  target: { number: number; zone: IntentZoneKey } | null;
};

/** A section's shape function's context: the shared `{ to, now }` plus what the two non-bucketable, un-keyed sections need. */
type ShapeContext = {
  from: string;
  to: string;
  now: Date;
  target: TargetKey | null;
};

type SectionHandler = {
  load: (db: Db, ctx: SectionContext) => Promise<unknown[]>;
  shape: (rows: unknown[], ctx: ShapeContext) => SeriesBucket<unknown>[];
};

/** Adapts one reader/shaper pair — each typed to its own row shape — into the uniform `SectionHandler` the registry dispatches through. */
function handler<TRow>(
  load: (db: Db, ctx: SectionContext) => Promise<TRow[]>,
  shape: (rows: readonly TRow[], ctx: ShapeContext) => SeriesBucket<unknown>[],
): SectionHandler {
  return {
    load,
    shape: (rows, ctx) => shape(rows as TRow[], ctx),
  };
}

function loadBucketedSessions(
  db: Db,
  ctx: SectionContext,
): Promise<StatsBucketRow[]> {
  return findBucketedSessionAggregates(db, {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    bucket: ctx.bucket,
    tz: ctx.tz,
    statuses: ctx.statuses,
    context: ctx.context,
  });
}

function loadIntentCells(
  db: Db,
  ctx: SectionContext,
): Promise<IntentCellRow[]> {
  return findIntentCells(db, {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

function loadIntentMoments(
  db: Db,
  ctx: SectionContext,
): Promise<IntentMomentRow[]> {
  return findIntentMoments(db, {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

function loadMissSectors(
  db: Db,
  ctx: SectionContext,
): Promise<MissSectorRow[]> {
  return findMissSectors(db, {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    refs: missReferences(),
  });
}

function loadHeatmapCells(
  db: Db,
  ctx: SectionContext,
): Promise<HeatmapCellRow[]> {
  return findHeatmapCells(db, {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    cellMm: HEATMAP_CELL_MM,
    target: ctx.target,
  });
}

/** The shared session scope every phase-3 reader filters by, taken off a resolved `SectionContext`. */
function sectionScope(ctx: SectionContext): SessionScope {
  return {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
  };
}

function loadVisitScoring(
  db: Db,
  ctx: SectionContext,
): Promise<VisitScoringRow[]> {
  return findVisitScoring(db, {
    ...sectionScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
    bands: SCORE_BANDS,
  });
}

function loadHitNumberCells(
  db: Db,
  ctx: SectionContext,
): Promise<HitNumberCellRow[]> {
  return findHitNumberCells(db, {
    ...sectionScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

/**
 * One session's checkout visits, tagged with the bucket its own
 * `completed_at` falls in — identical across every row of that session
 * (phase-3 Task 8 step 3).
 */
function bucketedSessionsFromFoldRows(
  rows: readonly X01FoldRow[],
): BucketedSession[] {
  const bucketsBySession = new Map<
    string,
    { bucketStart: string; bucketEnd: string }
  >();
  for (const row of rows) {
    if (!bucketsBySession.has(row.sessionId)) {
      bucketsBySession.set(row.sessionId, {
        bucketStart: row.bucketStart,
        bucketEnd: row.bucketEnd,
      });
    }
  }
  return sessionCheckoutVisits(rows).map((session) => ({
    ...session,
    ...bucketsBySession.get(session.sessionId)!,
  }));
}

/**
 * The shared load for every server-folded section (phase-3 decision 1,
 * Task 8): every `v_x01_checkout_darts` dart the scope covers, folded per
 * session and tagged with its bucket. The `MAX_FOLD_DARTS` gate runs earlier
 * in `getGameSection`, before this is ever called.
 */
async function foldLoad(
  db: Db,
  ctx: SectionContext,
): Promise<BucketedSession[]> {
  const rows = await findX01FoldRows(db, {
    ...sectionScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
  return bucketedSessionsFromFoldRows(rows);
}

const HANDLERS: Record<SectionId, SectionHandler> = {
  completion: handler(loadBucketedSessions, completionBuckets),
  volume: handler(loadBucketedSessions, volumeBuckets),
  "session-result": handler(loadBucketedSessions, sessionResultBuckets),
  "target-accuracy": handler(loadIntentCells, targetAccuracyBuckets),
  confusion: handler(loadIntentCells, confusionBuckets),
  "loose-darts": handler(loadIntentCells, looseDartsBuckets),
  grouping: handler(loadIntentMoments, groupingBuckets),
  "miss-direction": handler(loadMissSectors, missDirectionBuckets),
  heatmap: handler(loadHeatmapCells, heatmapBuckets),
  "scoring-trend": handler(loadVisitScoring, scoringTrendBuckets),
  "treble-rate": handler(loadHitNumberCells, trebleRateBuckets),
  "ladder-progress": handler(foldLoad, ladderProgressBuckets),
  "checkout-rate": handler(foldLoad, checkoutRateBuckets),
  "double-performance": handler(foldLoad, doublePerformanceBuckets),
  "checkout-path": handler(foldLoad, checkoutPathBuckets),
  "bust-rate": handler(foldLoad, bustRateBuckets),
  "leg-stats": handler(foldLoad, legStatsBuckets),
};

/**
 * Resolves the accepted `status` values for a section (D367 decision 5): an
 * `includesAbandoned` section accepts only `all`, every other section only
 * `completed`. Either default applies when the caller omits `status`.
 */
function sectionStatuses(
  includesAbandoned: boolean,
  status: StatusFilter | undefined,
): { statuses: string[] } | { error: string } {
  if (includesAbandoned) {
    if (status !== undefined && status !== "all") {
      return { error: "this section only accepts status=all" };
    }
    return { statuses: ["COMPLETED", "ABANDONED"] };
  }
  if (status !== undefined && status !== "completed") {
    return { error: "this section only accepts status=completed" };
  }
  return { statuses: ["COMPLETED"] };
}

/** The session list accepts and defaults to every status value (decision 5). */
function listStatuses(status: StatusFilter | undefined): string[] {
  if (status === "completed") return ["COMPLETED"];
  if (status === "abandoned") return ["ABANDONED"];
  return ["COMPLETED", "ABANDONED"];
}

/** A game's paginated session list (`00-Overview.md` §6), newest first. */
export async function listGameSessions(
  playerId: string,
  gameTypeKey: GameTypeKey,
  q: SessionListQueryData,
): Promise<ServiceResult<GameSessionList>> {
  let after: { completedAt: string; sessionId: string } | undefined;
  if (q.cursor !== undefined) {
    const decoded = decodeCursor(q.cursor);
    if (decoded === null) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "cursor is malformed" },
      };
    }
    after = decoded;
  }

  const db = getDb();
  const [rows, dataVersionInput] = await Promise.all([
    findGameSessionsPage(db, {
      playerId,
      gameTypeKey,
      from: q.from,
      to: q.to,
      statuses: listStatuses(q.status),
      context: q.context,
      limit: q.limit,
      after,
    }),
    findGameDataVersion(db, playerId, gameTypeKey),
  ]);

  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          completedAt: last.completedAt,
          sessionId: last.sessionId,
        })
      : null;

  return {
    ok: true,
    data: {
      items,
      nextCursor,
      dataVersion: encodeDataVersion(dataVersionInput),
    },
  };
}

/**
 * Resolves the `target` query param against a section's declared `params`
 * and the game's tags (phase-2 decision 5); `{ error }` on either mismatch,
 * `{ target: null }` when the caller sent none.
 */
function sectionTarget(
  meta: SectionMeta,
  gameTypeKey: GameTypeKey,
  targetParam: string | undefined,
):
  | { target: { number: number; zone: IntentZoneKey } | null }
  | { error: string } {
  if (targetParam === undefined) return { target: null };
  if (!meta.params.includes("target")) {
    return { error: "this section does not accept target" };
  }
  if (!tagsForGameType(gameTypeKey).has("intent-stored")) {
    return { error: "target requires an intent-stored game" };
  }
  return { target: parseTargetKey(targetParam) };
}

/**
 * The `MAX_FOLD_DARTS` gate (phase-3 decision 1, Task 8): above the cap, the
 * `VALIDATION_FAILED` reason naming it; `null` when a `server` section's
 * scope is within it, or the section is not `server`-computed at all.
 */
async function foldBoundReason(
  db: Db,
  meta: SectionMeta,
  ctx: SectionContext,
): Promise<string | null> {
  if (meta.computeSite !== "server") return null;
  const dartCount = await findScopeDartCount(db, sectionScope(ctx));
  if (dartCount <= MAX_FOLD_DARTS) return null;
  return `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`;
}

/**
 * Dispatches one section result through the registry (`00-Overview.md` §2, §6).
 * `now` is injected so the closed-bucket boundary is deterministic in tests.
 */
export async function getGameSection(
  playerId: string,
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  q: StatisticsRangeQueryData,
  now: Date = new Date(),
): Promise<ServiceResult<SeriesResponse>> {
  if (!sectionsForGame(gameTypeKey).includes(sectionId)) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const meta = SECTIONS[sectionId];

  if (q.bucket !== "none" && !meta.bucketable) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "this section does not support bucket" },
    };
  }

  const resolvedTarget = sectionTarget(meta, gameTypeKey, q.target);
  if ("error" in resolvedTarget) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: resolvedTarget.error },
    };
  }
  const { target } = resolvedTarget;

  const resolved = sectionStatuses(meta.includesAbandoned, q.status);
  if ("error" in resolved) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: resolved.error },
    };
  }

  const db = getDb();
  const from =
    q.bucket === "none"
      ? q.from
      : await findBucketFloor(db, q.from, q.bucket, q.tz!);

  const sectionContext: SectionContext = {
    playerId,
    gameTypeKey,
    from,
    to: q.to,
    bucket: q.bucket,
    tz: q.bucket === "none" ? undefined : q.tz,
    statuses: resolved.statuses,
    context: q.context,
    target,
  };

  const foldError = await foldBoundReason(db, meta, sectionContext);
  if (foldError !== null) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: foldError },
    };
  }

  const [dataVersionInput, rows] = await Promise.all([
    findGameDataVersion(db, playerId, gameTypeKey),
    HANDLERS[sectionId].load(db, sectionContext),
  ]);

  const targetKey: TargetKey | null =
    target === null ? null : formatTargetKey(target.number, target.zone);

  const buckets = HANDLERS[sectionId].shape(rows, {
    from,
    to: q.to,
    now,
    target: targetKey,
  });

  const response = {
    sectionId,
    sectionVersion: meta.version,
    dataVersion: encodeDataVersion(dataVersionInput),
    bucket: q.bucket,
    tz: q.bucket === "none" ? null : (q.tz ?? null),
    range: { from, to: q.to },
    buckets,
  } as SeriesResponse;

  return { ok: true, data: response };
}
