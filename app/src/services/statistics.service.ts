import { getDb } from "@db/client";
import {
  MAX_FOLD_DARTS,
  SECTIONS,
  sectionSite,
  sectionsForGame,
  sectionsForRoutine,
  sectionsForStep,
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
import { sessionSteps } from "@modules/stats/derived-aims.module";
import {
  averageDartsPerLeg,
  bestLegDarts,
} from "@modules/stats/leg-stats.module";
import {
  decodeReplayCursor,
  encodeReplayCursor,
  rowsToTurns,
  stageOrder,
} from "@modules/stats/replay.module";
import {
  isRoutineKey,
  parseStepKey,
} from "@modules/stats/routine-scope.module";
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
import { atcDartsPerTargetBuckets } from "@modules/stats/sections/atc-darts-per-target.module";
import { bobs27SurvivalBuckets } from "@modules/stats/sections/bobs27-survival.module";
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
import { aimCellRows } from "@modules/stats/sections/intent-cells.module";
import { ladderProgressBuckets } from "@modules/stats/sections/ladder-progress.module";
import { legStatsBuckets } from "@modules/stats/sections/leg-stats.module";
import { looseDartsBuckets } from "@modules/stats/sections/loose-darts.module";
import {
  aimMissRows,
  missDirectionBuckets,
  missReferences,
} from "@modules/stats/sections/miss-direction.module";
import { routineCompletionBuckets } from "@modules/stats/sections/routine-completion.module";
import { routineVolumeBuckets } from "@modules/stats/sections/routine-volume.module";
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
import { shanghaiCountBuckets } from "@modules/stats/sections/shanghai-count.module";
import { stepResultBuckets } from "@modules/stats/sections/step-result.module";
import { stepVolumeBuckets } from "@modules/stats/sections/step-volume.module";
import { targetAccuracyBuckets } from "@modules/stats/sections/target-accuracy.module";
import { trebleRateBuckets } from "@modules/stats/sections/treble-rate.module";
import { volumeBuckets } from "@modules/stats/sections/volume.module";
import {
  findBucketFloor,
  findBucketedSessionAggregates,
  findDartFoldRows,
  findGameDataVersion,
  findGameSessionsPage,
  findHeatmapCells,
  findHitNumberCells,
  findIntentCells,
  findIntentMoments,
  findLegFacts,
  findMissSectors,
  findReplayParticipants,
  findReplaySession,
  findReplayStages,
  findReplayTurnPage,
  findRoutineDataVersion,
  findRoutineHeader,
  findRoutineRunBuckets,
  findRoutineStepDescriptors,
  findScopeDartCount,
  findSessionSummaries,
  findStepBuckets,
  findStepFoldRows,
  findStepScopeDartCount,
  findStepSessionPage,
  findTrainedRoutines,
  findVisitFacts,
  findVisitScoring,
  findX01CheckoutDarts,
  findX01FoldRows,
} from "@repositories/statistics.repository";
import type {
  Bucket,
  ComputeSite,
  ContextFilter,
  GameTypeKey,
  IntentZoneKey,
  SectionId,
  SectionMeta,
  Series,
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
  DartExerciseKind,
  DartScope,
  HeatmapCellRow,
  HitNumberCellRow,
  IntentCellRow,
  IntentMomentRow,
  MissSectorRow,
  RoutineHeaderRow,
  RoutineStepDescriptorRow,
  RoutineStepScope,
  SessionScope,
  SessionSteps,
  StatsBucketRow,
  StepScope,
  VisitScoringRow,
  X01FoldRow,
} from "@modules/types";
import type {
  GameSessionList,
  ReplayHeader,
  ReplayPage,
  RoutineHeader,
  RoutineSectionQuery,
  RoutineSessionListQuery,
  ServiceResult,
  SeriesResponse,
  SessionList,
  StatisticsOverview,
  TrainedRoutine,
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
  /** Narrows every reader this context feeds to one GAME routine step's own sessions (phase 6b plan decision 5); `undefined` for a standalone game page. */
  routineStep?: RoutineStepScope;
};

/** A section's shape function's context: the shared `{ to, now }` plus what the two non-bucketable, un-keyed sections need. */
type ShapeContext = {
  from: string;
  to: string;
  now: Date;
  target: TargetKey | null;
};

/**
 * What a section's `load` resolves to: its rows, plus how many sessions a
 * fold could not replay (phase-4 decision 4) — set only by a `server`
 * section built on `stepsLoad`, and threaded straight into the response by
 * `getGameSection`. Absent for every `sql`-site section, matching the
 * `skippedSessions` field's optional zod schema (Task 2).
 */
type SectionLoadResult = {
  rows: readonly unknown[];
  skippedSessions?: number;
};

type SectionHandler = {
  load: (db: Db, ctx: SectionContext) => Promise<SectionLoadResult>;
  shape: (
    rows: readonly unknown[],
    ctx: ShapeContext,
  ) => SeriesBucket<unknown>[];
};

/** Adapts one reader/shaper pair — each typed to its own row shape — into the uniform `SectionHandler` the registry dispatches through. */
function handler<TRow>(
  load: (db: Db, ctx: SectionContext) => Promise<TRow[]>,
  shape: (rows: readonly TRow[], ctx: ShapeContext) => SeriesBucket<unknown>[],
): SectionHandler {
  return {
    load: async (db, ctx) => ({ rows: await load(db, ctx) }),
    shape: (rows, ctx) => shape(rows as TRow[], ctx),
  };
}

/**
 * Adapts a `SessionSteps` shape function — every derived-intent and
 * game-specific section (phase-4 Task 8) — into a `SectionHandler` sharing
 * `stepsLoad`, so its own `skippedSessions` count always reaches
 * `SectionLoadResult`.
 */
function stepsHandler(
  shape: (
    sessions: readonly SessionSteps<unknown>[],
    ctx: ShapeContext,
  ) => SeriesBucket<unknown>[],
): SectionHandler {
  return {
    load: async (db, ctx) => {
      const { sessions, skippedSessions } = await stepsLoad(db, ctx);
      return { rows: sessions, skippedSessions };
    },
    shape: (rows, ctx) => shape(rows as SessionSteps<unknown>[], ctx),
  };
}

/** The shared dart scope every phase 2-4 dart-level reader filters by, taken off a resolved `SectionContext` — narrowed by `routineStep` the same way `sectionScope` is (phase 6b plan decision 5, controller ruling R2). */
function dartScope(ctx: SectionContext): DartScope {
  return {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    routineStep: ctx.routineStep,
  };
}

function loadBucketedSessions(
  db: Db,
  ctx: SectionContext,
): Promise<StatsBucketRow[]> {
  return findBucketedSessionAggregates(db, {
    ...dartScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

function loadIntentCells(
  db: Db,
  ctx: SectionContext,
): Promise<IntentCellRow[]> {
  return findIntentCells(db, {
    ...dartScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

function loadIntentMoments(
  db: Db,
  ctx: SectionContext,
): Promise<IntentMomentRow[]> {
  return findIntentMoments(db, {
    ...dartScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
}

function loadMissSectors(
  db: Db,
  ctx: SectionContext,
): Promise<MissSectorRow[]> {
  return findMissSectors(db, {
    ...dartScope(ctx),
    refs: missReferences(),
  });
}

function loadHeatmapCells(
  db: Db,
  ctx: SectionContext,
): Promise<HeatmapCellRow[]> {
  return findHeatmapCells(db, {
    ...dartScope(ctx),
    cellMm: HEATMAP_CELL_MM,
    target: ctx.target,
  });
}

/** The shared session scope every phase-3 reader filters by, taken off a resolved `SectionContext`; narrowed by `routineStep` the same way `dartScope` is (phase 6b plan decision 5). */
function sectionScope(ctx: SectionContext): SessionScope {
  return {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    routineStep: ctx.routineStep,
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

/**
 * The shared load for every derived-intent and game-specific server section
 * (phase-4 decisions 1, 3-4, Task 8): every `v_stats_dart_facts` dart the
 * scope covers (`findDartFoldRows`, Task 5), folded per session through its
 * own engine reducer (`sessionSteps`, `derived-aims.module.ts`) — mirroring
 * `foldLoad`'s phase-3 shape. The `MAX_FOLD_DARTS` gate runs earlier in
 * `getGameSection`, before this is ever called.
 */
async function stepsLoad(
  db: Db,
  ctx: SectionContext,
): Promise<{ sessions: SessionSteps<unknown>[]; skippedSessions: number }> {
  const rows = await findDartFoldRows(db, {
    ...sectionScope(ctx),
    bucket: ctx.bucket,
    tz: ctx.tz,
  });
  return sessionSteps(rows);
}

/** `target-accuracy`'s `server`-site shape (phase-4 decision 1): the fold's recovered aims, fed through phase-2's own bucket function. */
function targetAccuracyFromSessions(
  sessions: readonly SessionSteps<unknown>[],
  ctx: ShapeContext,
): SeriesBucket<unknown>[] {
  return targetAccuracyBuckets(aimCellRows(sessions), ctx);
}

/** `confusion`'s `server`-site shape (phase-4 decision 1): the fold's recovered aims, fed through phase-2's own bucket function. */
function confusionFromSessions(
  sessions: readonly SessionSteps<unknown>[],
  ctx: ShapeContext,
): SeriesBucket<unknown>[] {
  return confusionBuckets(aimCellRows(sessions), ctx);
}

/** `loose-darts`'s `server`-site shape (phase-4 decision 1): the fold's recovered aims, fed through phase-2's own bucket function. */
function looseDartsFromSessions(
  sessions: readonly SessionSteps<unknown>[],
  ctx: ShapeContext,
): SeriesBucket<unknown>[] {
  return looseDartsBuckets(aimCellRows(sessions), ctx);
}

/** `miss-direction`'s `server`-site shape (phase-4 decision 7): the fold's missed aimed darts, fed through phase-2's own bucket function. */
function missDirectionFromSessions(
  sessions: readonly SessionSteps<unknown>[],
  ctx: ShapeContext,
): SeriesBucket<unknown>[] {
  return missDirectionBuckets(aimMissRows(sessions), ctx);
}

/**
 * Every section's handler, keyed by the `ComputeSite` it runs at for a given
 * game (`sectionSite`, phase-4 decision 5) — `getGameSection` resolves the
 * site first, then looks up this table. Phase 1-3's sections keep their one
 * site, unchanged; the four widened board sections gain a `server` entry
 * that shares `stepsLoad` with the three game-specific sections.
 */
const HANDLERS: Record<
  SectionId,
  Partial<Record<ComputeSite, SectionHandler>>
> = {
  completion: { sql: handler(loadBucketedSessions, completionBuckets) },
  volume: { sql: handler(loadBucketedSessions, volumeBuckets) },
  "session-result": {
    sql: handler(loadBucketedSessions, sessionResultBuckets),
  },
  "target-accuracy": {
    sql: handler(loadIntentCells, targetAccuracyBuckets),
    server: stepsHandler(targetAccuracyFromSessions),
  },
  confusion: {
    sql: handler(loadIntentCells, confusionBuckets),
    server: stepsHandler(confusionFromSessions),
  },
  "loose-darts": {
    sql: handler(loadIntentCells, looseDartsBuckets),
    server: stepsHandler(looseDartsFromSessions),
  },
  grouping: { sql: handler(loadIntentMoments, groupingBuckets) },
  "miss-direction": {
    sql: handler(loadMissSectors, missDirectionBuckets),
    server: stepsHandler(missDirectionFromSessions),
  },
  heatmap: { sql: handler(loadHeatmapCells, heatmapBuckets) },
  "scoring-trend": { sql: handler(loadVisitScoring, scoringTrendBuckets) },
  "treble-rate": { sql: handler(loadHitNumberCells, trebleRateBuckets) },
  "ladder-progress": { server: handler(foldLoad, ladderProgressBuckets) },
  "checkout-rate": { server: handler(foldLoad, checkoutRateBuckets) },
  "double-performance": { server: handler(foldLoad, doublePerformanceBuckets) },
  "checkout-path": { server: handler(foldLoad, checkoutPathBuckets) },
  "bust-rate": { server: handler(foldLoad, bustRateBuckets) },
  "leg-stats": { server: handler(foldLoad, legStatsBuckets) },
  "atc-darts-per-target": { server: stepsHandler(atcDartsPerTargetBuckets) },
  "bobs27-survival": { server: stepsHandler(bobs27SurvivalBuckets) },
  "shanghai-count": { server: stepsHandler(shanghaiCountBuckets) },
};

/**
 * Resolves one `(section, game)` pair's handler via `sectionSite` — the
 * single dispatch point `getGameSection` uses, exported so a registry-
 * coverage test can assert every `sectionsForGame` pair actually resolves
 * one without reaching into `HANDLERS` itself (phase-4 Task 8).
 */
export function resolveSectionHandler(
  sectionId: SectionId,
  gameTypeKey: GameTypeKey,
): SectionHandler | undefined {
  return HANDLERS[sectionId][sectionSite(SECTIONS[sectionId], gameTypeKey)];
}

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
 * The `MAX_FOLD_DARTS` gate (phase-3 decision 1, phase-4 decision 5, Task 8):
 * above the cap, the `VALIDATION_FAILED` reason naming it; `null` when a
 * `server`-site scope is within it, or the site this game resolves the
 * section to is not `server` at all. Takes the resolved `site`, not
 * `meta.computeSite` directly, so a section whose site only becomes `server`
 * through `siteByTag` (the four widened board sections, on a derived game)
 * is bounded exactly like one declared `server` outright.
 */
async function foldBoundReason(
  db: Db,
  site: ComputeSite,
  ctx: SectionContext,
): Promise<string | null> {
  if (site !== "server") return null;
  const dartCount = await findScopeDartCount(db, sectionScope(ctx));
  if (dartCount <= MAX_FOLD_DARTS) return null;
  return foldBoundMessage(dartCount);
}

/** The `MAX_FOLD_DARTS` gate's own `VALIDATION_FAILED` reason, shared by every server-folded section — game or routine step (phase 6b plan decision 8). */
function foldBoundMessage(dartCount: number): string {
  return `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`;
}

/**
 * The `dataVersion` a section dispatch encodes: the game's own terminal
 * population, or -- when scoped to one routine step (`routineStep` set) --
 * the owning routine's own population instead (phase 6b plan decision 12),
 * so the client keys a step scope's cache under the routine's own version,
 * never the game's.
 */
async function loadDataVersion(
  db: Db,
  playerId: string,
  gameTypeKey: GameTypeKey,
  routineStep: RoutineStepScope | undefined,
): Promise<string> {
  if (routineStep === undefined) {
    return encodeDataVersion(
      await findGameDataVersion(db, playerId, gameTypeKey),
    );
  }
  const { runCount, maxCompletedAt } = await findRoutineDataVersion(
    db,
    playerId,
    routineStep.routineKey,
  );
  return encodeDataVersion({ count: runCount, maxCompletedAt });
}

/**
 * Dispatches one section result through the registry (`00-Overview.md` §2, §6).
 * `now` is injected so the closed-bucket boundary is deterministic in tests.
 * `routineStep`, when set, scopes every reader to one GAME routine step's own
 * sessions, forces `context` to `"routine"` regardless of `q.context`, and
 * swaps the returned `dataVersion` for the routine's own (phase 6b plan
 * decisions 4-5, 12; controller ruling R2) -- the exported `getGameSection`
 * never sets it, so its own behaviour is unchanged.
 */
async function dispatchGameSection(
  playerId: string,
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  q: StatisticsRangeQueryData,
  now: Date,
  routineStep?: RoutineStepScope,
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
    context: routineStep === undefined ? q.context : "routine",
    target,
    routineStep,
  };

  const site = sectionSite(meta, gameTypeKey);
  const sectionHandler = resolveSectionHandler(sectionId, gameTypeKey);
  if (sectionHandler === undefined) {
    throw new Error(`no ${site} handler registered for section "${sectionId}"`);
  }

  const foldError = await foldBoundReason(db, site, sectionContext);
  if (foldError !== null) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: foldError },
    };
  }

  const [dataVersion, loadResult] = await Promise.all([
    loadDataVersion(db, playerId, gameTypeKey, routineStep),
    sectionHandler.load(db, sectionContext),
  ]);

  const targetKey: TargetKey | null =
    target === null ? null : formatTargetKey(target.number, target.zone);

  const buckets = sectionHandler.shape(loadResult.rows, {
    from,
    to: q.to,
    now,
    target: targetKey,
  });

  const response = {
    sectionId,
    sectionVersion: meta.version,
    dataVersion,
    bucket: q.bucket,
    tz: q.bucket === "none" ? null : (q.tz ?? null),
    range: { from, to: q.to },
    buckets,
    ...(loadResult.skippedSessions === undefined
      ? {}
      : { skippedSessions: loadResult.skippedSessions }),
  } as SeriesResponse;

  return { ok: true, data: response };
}

/**
 * A game's own section dispatch (`00-Overview.md` §2, §6): the public entry
 * point every game page route calls, unchanged from phase 1-4 — it never
 * sets `routineStep`, so `dispatchGameSection` computes `context` and
 * `dataVersion` exactly as before.
 */
export async function getGameSection(
  playerId: string,
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  q: StatisticsRangeQueryData,
  now: Date = new Date(),
): Promise<ServiceResult<SeriesResponse>> {
  return dispatchGameSection(playerId, gameTypeKey, sectionId, q, now);
}

/**
 * One page of a session's replay (D371 decisions 2-5). `findReplaySession`
 * is the one gate every page runs, first: missing, another player's, still
 * active and training-only sessions all read back as `null` alike, so they
 * all become `NOT_FOUND` here without telling the caller which. On a hit,
 * `findReplayStages` rebuilds play order through `stageOrder`, which the
 * cursor and the turn page both resolve a stage id against. A cursor is
 * decoded and validated (malformed, or its stage outside this session's
 * order) before either `findReplayTurnPage` or `findReplayParticipants`
 * runs. `findReplayTurnPage` fetches up to `limit + 1` turns; the extra one
 * is dropped and turned into `nextCursor`. The header -- the session's own
 * facts plus its participants and stage tree -- is built only when `cursor`
 * is `null`; every later page carries `header: null`, since a page is
 * cached forever and the header would only repeat.
 */
export async function getSessionReplay(
  playerId: string,
  sessionId: string,
  q: { cursor: string | null; limit: number },
): Promise<ServiceResult<ReplayPage>> {
  const db = getDb();

  const session = await findReplaySession(db, playerId, sessionId);
  if (session === null) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const stages = stageOrder(await findReplayStages(db, playerId, sessionId));
  const stageIds = stages.map((stage) => stage.stageId);

  let after: { position: number; turnSequence: number } | null = null;
  if (q.cursor !== null) {
    const decoded = decodeReplayCursor(q.cursor);
    if (decoded === null) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "cursor is malformed" },
      };
    }
    const position = stageIds.indexOf(decoded.stageId) + 1;
    if (position === 0) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "cursor stage does not belong to this session" },
      };
    }
    after = { position, turnSequence: decoded.turnSequence };
  }

  const rows = await findReplayTurnPage(db, {
    playerId,
    sessionId,
    stageIds,
    after,
    limit: q.limit,
  });
  const pagedTurns = rowsToTurns(rows);
  const hasMore = pagedTurns.length > q.limit;
  const turns = hasMore ? pagedTurns.slice(0, q.limit) : pagedTurns;
  const lastTurn = turns[turns.length - 1];
  const nextCursor =
    hasMore && lastTurn
      ? encodeReplayCursor({
          stageId: lastTurn.stageId,
          turnSequence: lastTurn.turnSequence,
        })
      : null;

  let header: ReplayHeader | null = null;
  if (q.cursor === null) {
    const participants = await findReplayParticipants(
      db,
      playerId,
      sessionId,
      stageIds,
    );
    header = { ...session, participants, stages };
  }

  return { ok: true, data: { header, turns, nextCursor } };
}

/** `VALIDATION_FAILED` for a `routineKey` that fails `isRoutineKey` -- shared by every routine-scoped entry point (phase 6b plan decision 9 behaviour 1). */
function malformedRoutineKey(): ServiceResult<never> {
  return {
    ok: false,
    code: "VALIDATION_FAILED",
    details: { reason: "routineKey is malformed" },
  };
}

/** The routine-ownership gate every routine-scoped entry point runs first: `NOT_FOUND` for a routine the player has never trained, so no further reader ever runs against it (phase 6b plan decision 9 behaviour 1). */
async function requireRoutineHeader(
  db: Db,
  playerId: string,
  routineKey: string,
): Promise<ServiceResult<RoutineHeaderRow>> {
  const header = await findRoutineHeader(db, playerId, routineKey);
  if (header === null) {
    return { ok: false, code: "NOT_FOUND" };
  }
  return { ok: true, data: header };
}

/** Every routine the player has trained (phase 6b plan decision 9), unpaginated -- bounded by routines trained, not by runs. */
export async function listTrainedRoutines(
  playerId: string,
): Promise<ServiceResult<{ items: TrainedRoutine[] }>> {
  const db = getDb();
  const items = await findTrainedRoutines(db, playerId);
  return { ok: true, data: { items } };
}

/**
 * One routine's header and step descriptors (phase 6b plan decision 9):
 * `latestStepCount` off `findRoutineHeader` bounds `findRoutineStepDescriptors`'s
 * `current` flag (controller ruling R11); `dataVersion` is encoded here from
 * `findRoutineDataVersion`'s raw population (controller ruling R13),
 * mirroring how `getGameSection` encodes the game's own.
 */
export async function getRoutineHeader(
  playerId: string,
  routineKey: string,
): Promise<ServiceResult<RoutineHeader>> {
  if (!isRoutineKey(routineKey)) return malformedRoutineKey();

  const db = getDb();
  const headerResult = await requireRoutineHeader(db, playerId, routineKey);
  if (!headerResult.ok) return headerResult;
  const header = headerResult.data;

  const [steps, dataVersionInput] = await Promise.all([
    findRoutineStepDescriptors(
      db,
      playerId,
      routineKey,
      header.latestStepCount,
    ),
    findRoutineDataVersion(db, playerId, routineKey),
  ]);

  return {
    ok: true,
    data: {
      routineKey: header.routineKey,
      routineName: header.routineName,
      runCount: header.runCount,
      firstRunAt: header.firstRunAt,
      lastRunAt: header.lastRunAt,
      dataVersion: encodeDataVersion({
        count: dataVersionInput.runCount,
        maxCompletedAt: dataVersionInput.maxCompletedAt,
      }),
      steps,
    },
  };
}

/**
 * One routine's run-level section (`routine-volume`/`routine-completion`,
 * phase 6b plan decision 6): both share `findRoutineRunBuckets`'s one
 * aggregate query, differing only in their shape function. Status/bucket
 * rules mirror `dispatchGameSection`'s (phase 1 decision 5); `dataVersion`
 * is the routine's own (decision 12).
 */
export async function getRoutineSection(
  playerId: string,
  routineKey: string,
  sectionId: string,
  q: RoutineSectionQuery,
  now: Date = new Date(),
): Promise<ServiceResult<Series<unknown>>> {
  if (!isRoutineKey(routineKey)) return malformedRoutineKey();

  const db = getDb();
  const headerResult = await requireRoutineHeader(db, playerId, routineKey);
  if (!headerResult.ok) return headerResult;

  const meta = sectionsForRoutine().find((section) => section.id === sectionId);
  if (meta === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (q.bucket !== "none" && !meta.bucketable) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "this section does not support bucket" },
    };
  }

  const resolvedStatus = sectionStatuses(meta.includesAbandoned, q.status);
  if ("error" in resolvedStatus) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: resolvedStatus.error },
    };
  }

  const from =
    q.bucket === "none"
      ? q.from
      : await findBucketFloor(db, q.from, q.bucket, q.tz!);

  const [dataVersionInput, rows] = await Promise.all([
    findRoutineDataVersion(db, playerId, routineKey),
    findRoutineRunBuckets(db, {
      playerId,
      routineKey,
      from,
      to: q.to,
      statuses: resolvedStatus.statuses,
      bucket: q.bucket,
      tz: q.bucket === "none" ? undefined : q.tz,
    }),
  ]);

  const shapeCtx = { to: q.to, now };
  const buckets =
    meta.id === "routine-volume"
      ? routineVolumeBuckets(rows, shapeCtx)
      : routineCompletionBuckets(rows, shapeCtx);

  return {
    ok: true,
    data: {
      sectionId: meta.id,
      sectionVersion: meta.version,
      dataVersion: encodeDataVersion({
        count: dataVersionInput.runCount,
        maxCompletedAt: dataVersionInput.maxCompletedAt,
      }),
      bucket: q.bucket,
      tz: q.bucket === "none" ? null : (q.tz ?? null),
      range: { from, to: q.to },
      buckets,
    } as unknown as Series<unknown>,
  };
}

/**
 * Resolves and validates one routine step, shared by `getRoutineStepSection`
 * and `listRoutineStepSessions` (phase 6b plan decision 9): a malformed
 * `routineKey`/`stepKey` is `VALIDATION_FAILED` before any repository call;
 * an unowned routine or a `stepKey` absent from its descriptors is
 * `NOT_FOUND`. A step's `sequenceNumber` failing `Number.isSafeInteger` is
 * treated as malformed here, not in `parseStepKey` itself (the codec stays
 * unedited).
 */
async function resolveRoutineStep(
  db: Db,
  playerId: string,
  routineKey: string,
  stepKey: string,
): Promise<
  ServiceResult<{ header: RoutineHeaderRow; step: RoutineStepDescriptorRow }>
> {
  if (!isRoutineKey(routineKey)) return malformedRoutineKey();

  const parsedStepKey = parseStepKey(stepKey);
  if (
    parsedStepKey === null ||
    !Number.isSafeInteger(parsedStepKey.sequenceNumber)
  ) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "stepKey is malformed" },
    };
  }

  const headerResult = await requireRoutineHeader(db, playerId, routineKey);
  if (!headerResult.ok) return headerResult;
  const header = headerResult.data;

  const steps = await findRoutineStepDescriptors(
    db,
    playerId,
    routineKey,
    header.latestStepCount,
  );
  const step = steps.find((candidate) => candidate.stepKey === stepKey);
  if (step === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }

  return { ok: true, data: { header, step } };
}

/**
 * One routine step's section (phase 6b plan decisions 4-8; controller
 * rulings R1-R2): a GAME step delegates to `dispatchGameSection` with
 * `context: "routine"` and `routineStep` set server-side (decision 4) --
 * `dispatchGameSection` validates the section against `sectionsForGame`
 * itself, so no membership check is duplicated here. A non-game step
 * dispatches `step-volume`/`step-result` directly; `step-result` checks
 * `findStepScopeDartCount` against `MAX_FOLD_DARTS` before ever reading
 * `findStepFoldRows` (decision 8).
 */
export async function getRoutineStepSection(
  playerId: string,
  routineKey: string,
  stepKey: string,
  sectionId: string,
  q: RoutineSectionQuery,
  now: Date = new Date(),
): Promise<ServiceResult<Series<unknown>>> {
  const db = getDb();
  const resolved = await resolveRoutineStep(db, playerId, routineKey, stepKey);
  if (!resolved.ok) return resolved;
  const { step } = resolved.data;

  /**
   * `sectionsForStep`'s parameter type carries `inputModeKey`, but its own
   * body never reads it, and `RoutineStepDescriptorRow` (Task 3) does not
   * carry one either -- nothing downstream ever observes this value, so an
   * empty placeholder satisfies the contract without inventing step data
   * (discovered work, reported rather than fixed at either source).
   */
  const classification = sectionsForStep({ ...step, inputModeKey: "" });

  if (classification.kind === "game") {
    const gameQuery: StatisticsRangeQueryData = {
      from: q.from,
      to: q.to,
      tz: q.tz,
      bucket: q.bucket,
      status: q.status,
      context: "routine",
      inputMode: "VISUAL_BOARD",
      target: undefined,
    };
    const result = await dispatchGameSection(
      playerId,
      classification.gameTypeKey,
      sectionId as SectionId,
      gameQuery,
      now,
      { routineKey, stepKey },
    );
    return result as ServiceResult<Series<unknown>>;
  }

  const routineSectionMeta = classification.sections.find(
    (section) => section.id === sectionId,
  );
  if (routineSectionMeta === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (q.bucket !== "none" && !routineSectionMeta.bucketable) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "this section does not support bucket" },
    };
  }

  const resolvedStatus = sectionStatuses(
    routineSectionMeta.includesAbandoned,
    q.status,
  );
  if ("error" in resolvedStatus) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: resolvedStatus.error },
    };
  }

  const from =
    q.bucket === "none"
      ? q.from
      : await findBucketFloor(db, q.from, q.bucket, q.tz!);

  const stepScope: StepScope = {
    playerId,
    routineKey,
    stepKey,
    from,
    to: q.to,
    statuses: resolvedStatus.statuses,
  };
  const bucketArgs = {
    bucket: q.bucket,
    tz: q.bucket === "none" ? undefined : q.tz,
  };

  const dataVersionInput = await findRoutineDataVersion(
    db,
    playerId,
    routineKey,
  );
  const dataVersion = encodeDataVersion({
    count: dataVersionInput.runCount,
    maxCompletedAt: dataVersionInput.maxCompletedAt,
  });

  let buckets: SeriesBucket<unknown>[];
  if (sectionId === "step-volume") {
    const rows = await findStepBuckets(db, { ...stepScope, ...bucketArgs });
    buckets = stepVolumeBuckets(rows, { to: q.to, now });
  } else {
    const dartCount = await findStepScopeDartCount(db, stepScope);
    if (dartCount > MAX_FOLD_DARTS) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: foldBoundMessage(dartCount) },
      };
    }
    const rows = await findStepFoldRows(db, { ...stepScope, ...bucketArgs });
    buckets = stepResultBuckets(
      step.exerciseTypeKey as DartExerciseKind,
      rows,
      {
        to: q.to,
        now,
      },
    );
  }

  return {
    ok: true,
    data: {
      sectionId: routineSectionMeta.id,
      sectionVersion: routineSectionMeta.version,
      dataVersion,
      bucket: q.bucket,
      tz: q.bucket === "none" ? null : (q.tz ?? null),
      range: { from, to: q.to },
      buckets,
    } as unknown as Series<unknown>,
  };
}

/**
 * One step's paginated session list (phase 6b plan decision 10), newest
 * first over `v_stats_routine_step_facts` -- mirroring `listGameSessions`'s
 * cursor and `dataVersion` handling, but keyed to the owning routine.
 */
export async function listRoutineStepSessions(
  playerId: string,
  routineKey: string,
  stepKey: string,
  q: RoutineSessionListQuery,
): Promise<ServiceResult<SessionList>> {
  const db = getDb();
  const resolved = await resolveRoutineStep(db, playerId, routineKey, stepKey);
  if (!resolved.ok) return resolved;

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

  const [rows, dataVersionInput] = await Promise.all([
    findStepSessionPage(db, {
      playerId,
      routineKey,
      stepKey,
      from: q.from,
      to: q.to,
      statuses: listStatuses(q.status),
      limit: q.limit,
      after,
    }),
    findRoutineDataVersion(db, playerId, routineKey),
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
      dataVersion: encodeDataVersion({
        count: dataVersionInput.runCount,
        maxCompletedAt: dataVersionInput.maxCompletedAt,
      }),
    },
  };
}
