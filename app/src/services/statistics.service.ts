import {
  HOME_CELL_MM,
  HOME_GAME_TYPES,
  homeWindows,
  shapeHomeStats,
} from "@modules/stats/home-stats.module";
import { getDb } from "@db/client";
import {
  dartExerciseKindOf,
  MAX_FOLD_DARTS,
  SECTIONS,
  sectionSite,
  sectionsForGame,
  sectionsForRoutine,
  sectionsForStep,
  tagsForGameType,
} from "@lib/stats/section-registry";
import {
  parseTargetKey,
  parseWireKey,
  formatTargetKey,
} from "@lib/stats/target-key";
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
  checkoutVisitsWithSession,
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
import { doubleAccuracyBuckets } from "@modules/stats/sections/double-accuracy.module";
import { doublePreferenceBuckets } from "@modules/stats/sections/double-preference.module";
import { setupSuccessBuckets } from "@modules/stats/sections/setup-success.module";
import { aimDriftBuckets } from "@modules/stats/sections/aim-drift.module";
import { largeTargetAccuracyBuckets } from "@modules/stats/sections/large-target-accuracy.module";
import { inferredSessions } from "@modules/stats/x01-inferred-darts.module";
import { doublePerformanceBuckets } from "@modules/stats/sections/double-performance.module";
import { groupingBuckets } from "@modules/stats/sections/grouping.module";
import {
  HEATMAP_CELL_MM,
  heatmapBuckets,
  heatmapCellRowsFromAims,
  inferredHeatmapCellRows,
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
import { trainingResultBuckets } from "@modules/stats/sections/training-result.module";
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
  findGameVariations,
  countGameSessions,
  findGameSessionsPage,
  findHeatmapCells,
  findHomeScoring,
  findHomeHeatmapCells,
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
  findSetSequences,
  findX01FoldRows,
} from "@repositories/statistics.repository";
import type {
  AimKey,
  Bucket,
  ComputeSite,
  ContextFilter,
  GameTypeKey,
  IntentZoneKey,
  RoutineSectionMeta,
  RoutineSeries,
  SectionId,
  SectionMeta,
  Series,
  SeriesBucket,
  StatsTag,
  StatusFilter,
} from "@lib/types";
import type {
  SessionListQueryData,
  StatisticsRangeQueryData,
} from "@routes/types";
import type {
  BucketedSession,
  InferredSession,
  DartScope,
  GameVariation,
  HeatmapCellRow,
  HomeStats,
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
  const [sessions, visits, legs, checkoutDarts, setSequences] =
    await Promise.all([
      findSessionSummaries(db, playerId),
      findVisitFacts(db, playerId),
      findLegFacts(db, playerId),
      findX01CheckoutDarts(db, playerId),
      findSetSequences(db, playerId),
    ]);

  const bands = scoreBandCounts(visits);
  const checkoutVisits = checkoutVisitsWithSession(checkoutDarts, setSequences);
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

/**
 * The Home page's three stat blocks for `q.now` in `q.tz`: first-9 average
 * over the last 30 local days against the 30 before, the last 7 daily
 * averages, and the last 30 days' landing cells, over completed `501` and
 * Score Training sessions.
 */
export async function getHomeStats(
  playerId: string,
  q: { tz: string; now: Date },
): Promise<ServiceResult<HomeStats>> {
  const db = getDb();
  const windows = homeWindows(q.now, q.tz);
  const scope = {
    playerId,
    gameTypeKeys: [...HOME_GAME_TYPES],
    to: windows.to,
  };
  const [rows, cells] = await Promise.all([
    findHomeScoring(db, {
      ...scope,
      from: windows.previousFrom,
      tz: q.tz,
      bands: SCORE_BANDS,
    }),
    findHomeHeatmapCells(db, {
      ...scope,
      from: windows.currentFrom,
      cellMm: HOME_CELL_MM,
    }),
  ]);
  return {
    ok: true,
    data: shapeHomeStats({ rows, cells, windows, tz: q.tz }),
  };
}

type Db = ReturnType<typeof getDb>;

/** A `VALIDATION_FAILED` result carrying one reason. */
function validationFailed(reason: string): ServiceResult<never> {
  return { ok: false, code: "VALIDATION_FAILED", details: { reason } };
}

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
  /** The validated `target` on an `intent-inferred` game, kept as its key since `target` cannot hold a wire; `null` on every other game or when no target was sent. */
  inferredAim: AimKey | null;
  /** Narrows every reader this context feeds to one GAME routine step's own sessions; `undefined` for a standalone game page. */
  routineStep?: RoutineStepScope;
  /** The 501 starting score every reader this context feeds is narrowed to; `undefined` on every other game and for a routine step. */
  variation?: number;
};

/** A section's shape function's context: the shared `{ to, now }` plus what the two non-bucketable, un-keyed sections need. */
type ShapeContext = {
  from: string;
  to: string;
  now: Date;
  target: AimKey | null;
};

/**
 * What a section's `load` resolves to: its rows, plus how many sessions a
 * fold could not replay (phase-4 decision 4) — set only by a `server`
 * section built on `stepsLoad`, and threaded straight into the response by
 * `getGameSection`. Absent for every `sql`-site section, matching the
 * `skippedSessions` field's optional zod schema.
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
 * game-specific section — into a `SectionHandler` sharing
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

/** The shared dart scope every dart-level game reader filters by, taken off a resolved `SectionContext` — narrowed by `routineStep` the same way `sectionScope` is, so a GAME step's own darts read the same way a standalone game's do. */
function dartScope(ctx: SectionContext): DartScope {
  return {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    routineStep: ctx.routineStep,
    variation: ctx.variation,
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

/** The shared session scope every phase-3 reader filters by, taken off a resolved `SectionContext`; narrowed by `routineStep` the same way `dartScope` is. */
function sectionScope(ctx: SectionContext): SessionScope {
  return {
    playerId: ctx.playerId,
    gameTypeKey: ctx.gameTypeKey,
    from: ctx.from,
    to: ctx.to,
    statuses: ctx.statuses,
    context: ctx.context,
    routineStep: ctx.routineStep,
    variation: ctx.variation,
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
 * `completed_at` falls in — identical across every row of that session.
 */
function bucketedSessionsFromFoldRows(
  rows: readonly X01FoldRow[],
  setSequences: ReadonlyMap<string, number>,
): {
  sessions: BucketedSession[];
  skippedSessions: number;
} {
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
  const sessions = sessionCheckoutVisits(rows, setSequences).map((session) => ({
    ...session,
    ...bucketsBySession.get(session.sessionId)!,
  }));
  return {
    sessions,
    skippedSessions: sessions.filter((session) => session.undecodable).length,
  };
}

/**
 * The shared load for every server-folded section: every `v_x01_checkout_darts` dart the scope covers, folded per
 * session and tagged with its bucket. The `MAX_FOLD_DARTS` gate runs earlier
 * in `getGameSection`, before this is ever called.
 */
async function foldLoad(
  db: Db,
  ctx: SectionContext,
): Promise<{ sessions: BucketedSession[]; skippedSessions: number }> {
  const [rows, setSequences] = await Promise.all([
    findX01FoldRows(db, {
      ...sectionScope(ctx),
      bucket: ctx.bucket,
      tz: ctx.tz,
    }),
    findSetSequences(db, ctx.playerId),
  ]);
  return bucketedSessionsFromFoldRows(rows, setSequences);
}

/**
 * Adapts a `BucketedSession` shape function — every server-folded checkout
 * section — into a `SectionHandler` sharing `foldLoad`, so the count of
 * sessions skipped for an undecodable snapshot always reaches
 * `SectionLoadResult`.
 */
function foldHandler(
  shape: (
    sessions: readonly BucketedSession[],
    ctx: ShapeContext,
  ) => SeriesBucket<unknown>[],
): SectionHandler {
  return {
    load: async (db, ctx) => {
      const { sessions, skippedSessions } = await foldLoad(db, ctx);
      return { rows: sessions, skippedSessions };
    },
    shape: (rows, ctx) => shape(rows as BucketedSession[], ctx),
  };
}

/** `foldLoad`'s sessions walked into `InferredSession`s; an undecodable snapshot or an unlocated dart counts its session as skipped. */
async function inferredLoad(
  db: Db,
  ctx: SectionContext,
): Promise<{ sessions: InferredSession[]; skippedSessions: number }> {
  const { sessions } = await foldLoad(db, ctx);
  return inferredSessions(sessions);
}

/**
 * Adapts an `InferredSession` shape function -- every intent-inferred 501
 * section -- into a `SectionHandler` sharing `foldLoad`, so sessions with an
 * undecodable snapshot or an unlocated dart reach `skippedSessions`.
 */
function aimHandler(
  shape: (
    sessions: readonly InferredSession[],
    ctx: ShapeContext,
  ) => SeriesBucket<unknown>[],
): SectionHandler {
  return {
    load: async (db, ctx) => {
      const { sessions, skippedSessions } = await inferredLoad(db, ctx);
      return { rows: sessions, skippedSessions };
    },
    shape: (rows, ctx) => shape(rows as InferredSession[], ctx),
  };
}

/**
 * The shared load for every derived-intent and game-specific server section: every `v_stats_dart_facts` dart the scope covers
 * (`findDartFoldRows`), folded per session through its
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

/**
 * `heatmap`'s `server`-site handler, binning cells at load time: on an
 * `intent-inferred` game (the only one `inferredAim` is set on) through
 * `inferredLoad` and the darts resolved to that aim (x01 inferred-aim design
 * §5), on a derived game (Group C) through `stepsLoad` and the darts whose
 * recovered aim matches `target`.
 */
const heatmapServerHandler: SectionHandler = {
  load: async (db, ctx) => {
    if (ctx.inferredAim !== null) {
      const { sessions, skippedSessions } = await inferredLoad(db, ctx);
      return {
        rows: inferredHeatmapCellRows(sessions, ctx.inferredAim),
        skippedSessions,
      };
    }
    const { sessions, skippedSessions } = await stepsLoad(db, ctx);
    return {
      rows:
        ctx.target === null
          ? []
          : heatmapCellRowsFromAims(sessions, ctx.target),
      skippedSessions,
    };
  },
  shape: (rows, ctx) => heatmapBuckets(rows as HeatmapCellRow[], ctx),
};

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
  heatmap: {
    sql: handler(loadHeatmapCells, heatmapBuckets),
    server: heatmapServerHandler,
  },
  "scoring-trend": { sql: handler(loadVisitScoring, scoringTrendBuckets) },
  "treble-rate": { sql: handler(loadHitNumberCells, trebleRateBuckets) },
  "ladder-progress": { server: foldHandler(ladderProgressBuckets) },
  "checkout-rate": { server: foldHandler(checkoutRateBuckets) },
  "double-performance": { server: foldHandler(doublePerformanceBuckets) },
  "large-target-accuracy": { server: aimHandler(largeTargetAccuracyBuckets) },
  "aim-drift": { server: aimHandler(aimDriftBuckets) },
  "double-accuracy": { server: aimHandler(doubleAccuracyBuckets) },
  "double-preference": { server: aimHandler(doublePreferenceBuckets) },
  "setup-success": { server: aimHandler(setupSuccessBuckets) },
  "checkout-path": { server: foldHandler(checkoutPathBuckets) },
  "bust-rate": { server: foldHandler(bustRateBuckets) },
  "leg-stats": { server: foldHandler(legStatsBuckets) },
  "atc-darts-per-target": { server: stepsHandler(atcDartsPerTargetBuckets) },
  "bobs27-survival": { server: stepsHandler(bobs27SurvivalBuckets) },
  "shanghai-count": { server: stepsHandler(shanghaiCountBuckets) },
  "training-result": { server: stepsHandler(trainingResultBuckets) },
};

/**
 * Resolves one `(section, game)` pair's handler via `sectionSite` — the
 * single dispatch point `getGameSection` uses, exported so a registry-
 * coverage test can assert every `sectionsForGame` pair actually resolves
 * one without reaching into `HANDLERS` itself.
 */
export function resolveSectionHandler(
  sectionId: SectionId,
  gameTypeKey: GameTypeKey,
  hasTarget = false,
): SectionHandler | undefined {
  return HANDLERS[sectionId][
    sectionSite(SECTIONS[sectionId], gameTypeKey, hasTarget)
  ];
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

/** A row every paginated session list can page on: the two fields `encodeCursor`/`decodeCursor` key by. */
type SessionListRow = { completedAt: string; sessionId: string };

/** Decodes a session list's own `cursor` param, shared by every paginated session list; `data: undefined` means no cursor was given. */
function decodeSessionCursor(
  cursor: string | undefined,
):
  | { ok: true; data: SessionListRow | undefined }
  | { ok: false; reason: string } {
  if (cursor === undefined) return { ok: true, data: undefined };
  const decoded = decodeCursor(cursor);
  if (decoded === null) return { ok: false, reason: "cursor is malformed" };
  return { ok: true, data: decoded };
}

/**
 * Pages `rows` at `limit`, given the caller fetched `limit + 1` deep: the
 * extra row proves a further page exists and becomes `nextCursor`, dropped
 * from `items`. Shared by every paginated session list.
 */
function pageSessions<T extends SessionListRow>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          completedAt: last.completedAt,
          sessionId: last.sessionId,
        })
      : null;
  return { items, nextCursor };
}

const DEFAULT_VARIATION = 501;

/**
 * The variation a 501 read narrows to (D556): the requested starting score,
 * `501` when none was sent, nothing for a routine step or any other game --
 * which reject a requested one.
 */
export function resolveVariation(
  gameTypeKey: GameTypeKey,
  requested: number | undefined,
  routineStep: RoutineStepScope | undefined,
): { variation: number | undefined } | { error: string } {
  const applies = gameTypeKey === "501" && routineStep === undefined;
  if (applies) return { variation: requested ?? DEFAULT_VARIATION };
  if (requested === undefined) return { variation: undefined };
  return { error: "variation applies to the 501 game only" };
}

/** A game's paginated session list (`00-Overview.md` §6), newest first. */
export async function listGameSessions(
  playerId: string,
  gameTypeKey: GameTypeKey,
  q: SessionListQueryData,
): Promise<ServiceResult<GameSessionList>> {
  const cursor = decodeSessionCursor(q.cursor);
  if (!cursor.ok) {
    return validationFailed(cursor.reason);
  }

  const resolved = resolveVariation(gameTypeKey, q.variation, undefined);
  if ("error" in resolved) {
    return validationFailed(resolved.error);
  }

  const db = getDb();
  const filter = {
    playerId,
    gameTypeKey,
    from: q.from,
    to: q.to,
    statuses: listStatuses(q.status),
    context: q.context,
    variation: resolved.variation,
  };
  const [rows, totalCount, dataVersionInput] = await Promise.all([
    findGameSessionsPage(db, { ...filter, limit: q.limit, after: cursor.data }),
    countGameSessions(db, filter),
    findGameDataVersion(db, playerId, gameTypeKey),
  ]);

  const { items, nextCursor } = pageSessions(rows, q.limit);

  return {
    ok: true,
    data: {
      items,
      nextCursor,
      totalCount,
      dataVersion: encodeDataVersion(dataVersionInput),
    },
  };
}

/** The zones an inferred 501 aim can carry (`InferredAim`), each paired with its number by `parseTargetKey`'s own range rules. */
const INFERRED_AIM_ZONES: readonly IntentZoneKey[] = [
  "TREBLE",
  "SINGLE",
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
];

/** Whether `value` is a key an inferred 501 aim can resolve to: `TREBLE:n`, `SINGLE:n`, `DOUBLE:n`, `INNER_BULL:25`, `OUTER_BULL:25` or a board-adjacent `WIRE:a-b`. */
function isInferredAimKey(value: string): value is AimKey {
  if (parseWireKey(value) !== null) return true;
  const parsed = parseTargetKey(value);
  return parsed !== null && INFERRED_AIM_ZONES.includes(parsed.zone);
}

/** `sectionTarget`'s result: the parsed target, or `{ error }`. */
type SectionTargetResult =
  | {
      target: { number: number; zone: IntentZoneKey } | null;
      inferredAim: AimKey | null;
    }
  | { error: string };

/** An `intent-stored` game's target: any `TargetKey`. */
function storedTarget(targetParam: string): SectionTargetResult {
  const stored = parseTargetKey(targetParam);
  if (stored === null) {
    return { error: "target must be a TargetKey on this game" };
  }
  return { target: stored, inferredAim: null };
}

/** An `intent-inferred` game's target: an inferred aim key. */
function inferredTarget(targetParam: string): SectionTargetResult {
  if (!isInferredAimKey(targetParam)) {
    return { error: "target must be an inferred aim key on this game" };
  }
  return { target: null, inferredAim: targetParam };
}

/** An `intent-derived` game's target: `NUMBER:n` or `BULL:25`. */
function derivedTarget(targetParam: string): SectionTargetResult {
  const parsed = parseTargetKey(targetParam);
  if (parsed === null || (parsed.zone !== "NUMBER" && parsed.zone !== "BULL")) {
    return { error: "target must be NUMBER:n or BULL:25 on this game" };
  }
  return { target: parsed, inferredAim: null };
}

/** Parses `targetParam` by the first intent tag the game carries, stored before inferred before derived. */
function targetForTags(
  tags: ReadonlySet<StatsTag>,
  targetParam: string,
): SectionTargetResult {
  if (tags.has("intent-stored")) return storedTarget(targetParam);
  if (tags.has("intent-inferred")) return inferredTarget(targetParam);
  if (!tags.has("intent-derived")) {
    return { error: "target requires an intent-stored game" };
  }
  return derivedTarget(targetParam);
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
): SectionTargetResult {
  if (targetParam === undefined) return { target: null, inferredAim: null };
  if (!meta.params.includes("target")) {
    return { error: "this section does not accept target" };
  }
  return targetForTags(tagsForGameType(gameTypeKey), targetParam);
}

/** `resolveGameSectionRequest`'s success shape: everything `dispatchGameSection` needs to build its `SectionContext` once every check has passed. */
type ResolvedGameSectionRequest = {
  from: string;
  statuses: string[];
  target: { number: number; zone: IntentZoneKey } | null;
  inferredAim: AimKey | null;
  variation: number | undefined;
};

/**
 * Every check a game section dispatch runs before it can read anything, in
 * the original order (`00-Overview.md` §5): whether `bucket` is allowed on
 * this section, then whether `target` is valid, then whether `status` is
 * valid, then the request's own `from` (floored to the bucket start once
 * bucketed). This order matters when more than one check would fail --
 * `target` is named over `status` when both are invalid, matching the
 * dispatch's behaviour before the routine-step refactor.
 */
async function resolveGameSectionRequest(
  db: Db,
  meta: SectionMeta,
  gameTypeKey: GameTypeKey,
  q: StatisticsRangeQueryData,
  routineStep: RoutineStepScope | undefined,
): Promise<ResolvedGameSectionRequest | { error: string }> {
  const resolvedVariation = resolveVariation(
    gameTypeKey,
    q.variation,
    routineStep,
  );
  if ("error" in resolvedVariation) {
    return { error: resolvedVariation.error };
  }

  if (q.bucket !== "none" && !meta.bucketable) {
    return { error: "this section does not support bucket" };
  }

  const resolvedTarget = sectionTarget(meta, gameTypeKey, q.target);
  if ("error" in resolvedTarget) {
    return { error: resolvedTarget.error };
  }

  const resolvedRange = await resolveSectionRange(db, meta, q);
  if ("error" in resolvedRange) {
    return { error: resolvedRange.error };
  }

  return {
    from: resolvedRange.from,
    statuses: resolvedRange.statuses,
    target: resolvedTarget.target,
    inferredAim: resolvedTarget.inferredAim,
    variation: resolvedVariation.variation,
  };
}

/**
 * The `MAX_FOLD_DARTS` gate:
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

/** The `MAX_FOLD_DARTS` gate's own `VALIDATION_FAILED` reason, shared by every server-folded section — game or routine step. */
function foldBoundMessage(dartCount: number): string {
  return `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`;
}

/**
 * The routine's own `dataVersion` token -- its terminal-run population,
 * encoded the same way a game's is. Every routine and step entry point
 * shares this, including `loadDataVersion` when a GAME step delegates here.
 */
async function routineDataVersion(
  db: Db,
  playerId: string,
  routineKey: string,
): Promise<string> {
  const { runCount, maxCompletedAt } = await findRoutineDataVersion(
    db,
    playerId,
    routineKey,
  );
  return encodeDataVersion({ count: runCount, maxCompletedAt });
}

/**
 * The `dataVersion` a section dispatch encodes: the game's own terminal
 * population, or -- when scoped to one routine step (`routineStep` set) --
 * the owning routine's own population instead, so the client keys a step
 * scope's cache under the routine's own version, never the game's.
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
  return routineDataVersion(db, playerId, routineStep.routineKey);
}

/**
 * Resolves the three checks a routine or step section dispatch repeats
 * before it can read anything: whether `bucket` is allowed on this section,
 * which `status` values the request accepts, and the request's own `from`
 * (floored to the bucket start once bucketed, so the `range` a caller gets
 * back matches what was actually queried). Shared by all three section
 * dispatch paths (game and both routine paths); the game path runs its
 * bucket and `target` checks first to keep `00-Overview.md` §5's
 * bucket → target → status order (a routine section has no `target`).
 */
async function resolveSectionRange(
  db: Db,
  meta: { bucketable: boolean; includesAbandoned: boolean },
  q: {
    from: string;
    bucket: Bucket;
    tz?: string;
    status?: StatusFilter;
  },
): Promise<{ from: string; statuses: string[] } | { error: string }> {
  if (q.bucket !== "none" && !meta.bucketable) {
    return { error: "this section does not support bucket" };
  }

  const resolvedStatus = sectionStatuses(meta.includesAbandoned, q.status);
  if ("error" in resolvedStatus) {
    return { error: resolvedStatus.error };
  }

  const from =
    q.bucket === "none"
      ? q.from
      : await findBucketFloor(db, q.from, q.bucket, q.tz!);

  return { from, statuses: resolvedStatus.statuses };
}

/**
 * Assembles a routine-tab section's response envelope: the same six fields
 * every routine or step section returns, whatever its own reader and shape
 * function produced.
 */
function buildRoutineSeries(
  meta: RoutineSectionMeta,
  dataVersion: string,
  q: { bucket: Bucket; tz?: string; to: string },
  from: string,
  buckets: SeriesBucket<unknown>[],
): RoutineSeries<unknown> {
  return {
    sectionId: meta.id,
    sectionVersion: meta.version,
    dataVersion,
    bucket: q.bucket,
    tz: q.bucket === "none" ? null : (q.tz ?? null),
    range: { from, to: q.to },
    buckets,
  };
}

/**
 * The site a game section resolves to, its registered handler, and the
 * `MAX_FOLD_DARTS` fold-bound check against that site -- the second of
 * `dispatchGameSection`'s three phases (request resolution, site
 * resolution, load+shape). A missing handler is a registry bug, never a
 * caller error, so it throws rather than returning `{ error }`.
 */
async function resolveGameSectionSite(
  db: Db,
  sectionId: SectionId,
  gameTypeKey: GameTypeKey,
  meta: SectionMeta,
  ctx: SectionContext,
): Promise<{ handler: SectionHandler } | { error: string }> {
  const hasTarget = ctx.target !== null || ctx.inferredAim !== null;
  const site = sectionSite(meta, gameTypeKey, hasTarget);
  const sectionHandler = resolveSectionHandler(
    sectionId,
    gameTypeKey,
    hasTarget,
  );
  if (sectionHandler === undefined) {
    throw new Error(`no ${site} handler registered for section "${sectionId}"`);
  }

  const foldError = await foldBoundReason(db, site, ctx);
  if (foldError !== null) {
    return { error: foldError };
  }

  return { handler: sectionHandler };
}

/**
 * A game section's load+shape+envelope phase -- `dispatchGameSection`'s
 * third and last phase, run once request and site resolution have both
 * passed. `dataVersion` and the section's own rows load in parallel, since
 * neither depends on the other.
 */
async function loadGameSectionResponse(
  db: Db,
  playerId: string,
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  meta: SectionMeta,
  handler: SectionHandler,
  ctx: SectionContext,
  routineStep: RoutineStepScope | undefined,
  q: { bucket: Bucket; to: string; tz?: string },
  now: Date,
): Promise<SeriesResponse> {
  const [dataVersion, loadResult] = await Promise.all([
    loadDataVersion(db, playerId, gameTypeKey, routineStep),
    handler.load(db, ctx),
  ]);

  const targetKey: AimKey | null =
    ctx.inferredAim ??
    (ctx.target === null
      ? null
      : formatTargetKey(ctx.target.number, ctx.target.zone));

  const buckets = handler.shape(loadResult.rows, {
    from: ctx.from,
    to: q.to,
    now,
    target: targetKey,
  });

  return {
    sectionId,
    sectionVersion: meta.version,
    dataVersion,
    bucket: q.bucket,
    tz: q.bucket === "none" ? null : (q.tz ?? null),
    range: { from: ctx.from, to: q.to },
    buckets,
    ...(loadResult.skippedSessions === undefined
      ? {}
      : { skippedSessions: loadResult.skippedSessions }),
  } as SeriesResponse;
}

/** The part of a section context read off the query: range end, bucket, time zone, and the context a routine step forces to `"routine"`. */
function queryScope(
  q: StatisticsRangeQueryData,
  routineStep: RoutineStepScope | undefined,
): Pick<SectionContext, "to" | "bucket" | "tz" | "context"> {
  return {
    to: q.to,
    bucket: q.bucket,
    tz: q.bucket === "none" ? undefined : q.tz,
    context: routineStep === undefined ? q.context : "routine",
  };
}

/**
 * Dispatches one section result through the registry (`00-Overview.md` §2, §6),
 * in three phases: resolve the request (`resolveGameSectionRequest`), resolve
 * the site and fold bound (`resolveGameSectionSite`), then load, shape and
 * envelope the result (`loadGameSectionResponse`). `now` is injected so the
 * closed-bucket boundary is deterministic in tests. `routineStep`, when set,
 * scopes every reader to one GAME routine step's own sessions, forces
 * `context` to `"routine"` regardless of `q.context`, and swaps the returned
 * `dataVersion` for the routine's own -- the exported `getGameSection` never
 * sets it, so a game page reads its whole game scope.
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
  const db = getDb();

  const resolvedRequest = await resolveGameSectionRequest(
    db,
    meta,
    gameTypeKey,
    q,
    routineStep,
  );
  if ("error" in resolvedRequest) {
    return validationFailed(resolvedRequest.error);
  }
  const sectionContext: SectionContext = {
    playerId,
    gameTypeKey,
    ...resolvedRequest,
    routineStep,
    ...queryScope(q, routineStep),
  };

  const resolvedSite = await resolveGameSectionSite(
    db,
    sectionId,
    gameTypeKey,
    meta,
    sectionContext,
  );
  if ("error" in resolvedSite) {
    return validationFailed(resolvedSite.error);
  }

  const response = await loadGameSectionResponse(
    db,
    playerId,
    gameTypeKey,
    sectionId,
    meta,
    resolvedSite.handler,
    sectionContext,
    routineStep,
    q,
    now,
  );

  return { ok: true, data: response };
}

/**
 * A game's own section dispatch (`00-Overview.md` §2, §6): the public entry
 * point every game page route calls — it never sets `routineStep`, so
 * `dispatchGameSection` takes `context` from the query and `dataVersion`
 * from the game's own sessions.
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
      return validationFailed("cursor is malformed");
    }
    const position = stageIds.indexOf(decoded.stageId) + 1;
    if (position === 0) {
      return validationFailed("cursor stage does not belong to this session");
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

/** `VALIDATION_FAILED` for a `routineKey` that fails `isRoutineKey` -- shared by every routine-scoped entry point, so a malformed key never even reaches the database. */
function malformedRoutineKey(): ServiceResult<never> {
  return validationFailed("routineKey is malformed");
}

/** The routine-ownership gate every routine-scoped entry point runs first: `NOT_FOUND` for a routine the player has never trained, so no further reader ever runs against it. */
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

/** Every routine the player has trained, unpaginated -- bounded by routines trained, not by runs. */
export async function listTrainedRoutines(
  playerId: string,
): Promise<ServiceResult<{ items: TrainedRoutine[] }>> {
  const db = getDb();
  const items = await findTrainedRoutines(db, playerId);
  return { ok: true, data: { items } };
}

/**
 * One routine's header and step descriptors: `latestStepCount` off
 * `findRoutineHeader` bounds `findRoutineStepDescriptors`'s `current` flag --
 * a step index the routine no longer has can never read as current, however
 * recently it last ran. `dataVersion` is encoded from the routine's own
 * terminal-run population, mirroring how a game's is encoded.
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

  const [steps, dataVersion] = await Promise.all([
    findRoutineStepDescriptors(
      db,
      playerId,
      routineKey,
      header.latestStepCount,
    ),
    routineDataVersion(db, playerId, routineKey),
  ]);

  return {
    ok: true,
    data: {
      routineKey: header.routineKey,
      routineName: header.routineName,
      runCount: header.runCount,
      firstRunAt: header.firstRunAt,
      lastRunAt: header.lastRunAt,
      dataVersion,
      steps,
    },
  };
}

/** Shapes the run buckets for a run-surface routine section; a step-surface id is a programming error. */
function routineRunSectionBuckets(
  sectionId: RoutineSectionMeta["id"],
  rows: Awaited<ReturnType<typeof findRoutineRunBuckets>>,
  shapeCtx: { to: string; now: Date },
): SeriesBucket<unknown>[] {
  switch (sectionId) {
    case "routine-volume":
      return routineVolumeBuckets(rows, shapeCtx);
    case "routine-completion":
      return routineCompletionBuckets(rows, shapeCtx);
    case "step-volume":
    case "step-result":
      throw new Error(
        `sectionsForRoutine() returned a step-surface section "${sectionId}"`,
      );
    default: {
      const exhaustive: never = sectionId;
      throw new Error(`unhandled routine section "${String(exhaustive)}"`);
    }
  }
}

/**
 * One routine's run-level section (`routine-volume`/`routine-completion`):
 * both share `findRoutineRunBuckets`'s one aggregate query, differing only
 * in their shape function. Status/bucket rules mirror the game dispatch's
 * own; `dataVersion` is the routine's own.
 */
export async function getRoutineSection(
  playerId: string,
  routineKey: string,
  sectionId: string,
  q: RoutineSectionQuery,
  now: Date = new Date(),
): Promise<ServiceResult<RoutineSeries<unknown>>> {
  if (!isRoutineKey(routineKey)) return malformedRoutineKey();

  const db = getDb();
  const headerResult = await requireRoutineHeader(db, playerId, routineKey);
  if (!headerResult.ok) return headerResult;

  const meta = sectionsForRoutine().find((section) => section.id === sectionId);
  if (meta === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const resolvedRange = await resolveSectionRange(db, meta, q);
  if ("error" in resolvedRange) {
    return validationFailed(resolvedRange.error);
  }
  const { from, statuses } = resolvedRange;

  const [dataVersion, rows] = await Promise.all([
    routineDataVersion(db, playerId, routineKey),
    findRoutineRunBuckets(db, {
      playerId,
      routineKey,
      from,
      to: q.to,
      statuses,
      bucket: q.bucket,
      tz: q.bucket === "none" ? undefined : q.tz,
    }),
  ]);

  const buckets = routineRunSectionBuckets(meta.id, rows, { to: q.to, now });

  return {
    ok: true,
    data: buildRoutineSeries(meta, dataVersion, q, from, buckets),
  };
}

/**
 * Resolves and validates one routine step, shared by `getRoutineStepSection`
 * and `listRoutineStepSessions`: a malformed `routineKey`/`stepKey` is
 * `VALIDATION_FAILED` before any repository call; an unowned routine or a
 * `stepKey` absent from its descriptors is `NOT_FOUND`. A step's
 * `sequenceNumber` failing `Number.isSafeInteger` is treated as malformed
 * here rather than in `parseStepKey` itself, so the codec's own regex stays
 * the only place that shape is defined.
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
    return validationFailed("stepKey is malformed");
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

/** The game-section query a GAME routine step reads with: the caller's range, routine context, board input, no target. */
function gameStepQuery(q: RoutineSectionQuery): StatisticsRangeQueryData {
  return {
    from: q.from,
    to: q.to,
    tz: q.tz,
    bucket: q.bucket,
    status: q.status,
    context: "routine",
    inputMode: "VISUAL_BOARD",
    target: undefined,
  };
}

type StepSectionLoad = {
  stepScope: StepScope;
  bucketArgs: { bucket: RoutineSectionQuery["bucket"]; tz: string | undefined };
  shapeCtx: { to: string; now: Date };
};

type StepSectionData = {
  buckets: SeriesBucket<unknown>[];
  dataVersion: string;
};

/** `step-volume`: the step's own buckets beside the routine's data version. */
async function loadStepVolume(
  db: Db,
  load: StepSectionLoad,
): Promise<StepSectionData> {
  const { playerId, routineKey } = load.stepScope;
  const [rows, dataVersion] = await Promise.all([
    findStepBuckets(db, { ...load.stepScope, ...load.bucketArgs }),
    routineDataVersion(db, playerId, routineKey),
  ]);
  return { buckets: stepVolumeBuckets(rows, load.shapeCtx), dataVersion };
}

/** `step-result`: refuses a scope over `MAX_FOLD_DARTS` before reading the fold rows. */
async function loadStepResult(
  db: Db,
  step: Parameters<typeof dartExerciseKindOf>[0],
  load: StepSectionLoad,
): Promise<ServiceResult<StepSectionData>> {
  const { playerId, routineKey } = load.stepScope;
  const dartCount = await findStepScopeDartCount(db, load.stepScope);
  if (dartCount > MAX_FOLD_DARTS) {
    return validationFailed(foldBoundMessage(dartCount));
  }
  const kind = dartExerciseKindOf(step);
  if (kind === null) {
    throw new Error(
      `step-result dispatched for a step whose exerciseTypeKey "${step.exerciseTypeKey}" is not a dart exercise kind`,
    );
  }
  const [rows, dataVersion] = await Promise.all([
    findStepFoldRows(db, { ...load.stepScope, ...load.bucketArgs }),
    routineDataVersion(db, playerId, routineKey),
  ]);
  return {
    ok: true,
    data: {
      buckets: stepResultBuckets(kind, rows, load.shapeCtx),
      dataVersion,
    },
  };
}

/** Loads a step-surface routine section; a run-surface id is a programming error. */
async function loadStepSection(
  db: Db,
  sectionId: RoutineSectionMeta["id"],
  step: Parameters<typeof dartExerciseKindOf>[0],
  load: StepSectionLoad,
): Promise<ServiceResult<StepSectionData>> {
  switch (sectionId) {
    case "step-volume":
      return { ok: true, data: await loadStepVolume(db, load) };
    case "step-result":
      return loadStepResult(db, step, load);
    case "routine-volume":
    case "routine-completion":
      throw new Error(
        `sectionsForStep() returned a run-surface section "${sectionId}"`,
      );
    default: {
      const exhaustive: never = sectionId;
      throw new Error(`unhandled routine section "${String(exhaustive)}"`);
    }
  }
}

/**
 * One routine step's section: a GAME step delegates to `dispatchGameSection`
 * with `context: "routine"` and `routineStep` set server-side, ignoring
 * whatever the caller's own query held for those two -- `dispatchGameSection`
 * validates the section against `sectionsForGame` itself, so no membership
 * check is duplicated here. A non-game step dispatches `step-volume`/
 * `step-result` directly; `step-result` checks `findStepScopeDartCount`
 * against `MAX_FOLD_DARTS` before ever reading `findStepFoldRows`.
 */
export async function getRoutineStepSection(
  playerId: string,
  routineKey: string,
  stepKey: string,
  sectionId: string,
  q: RoutineSectionQuery,
  now: Date = new Date(),
): Promise<
  ServiceResult<
    (Series<unknown> & { skippedSessions?: number }) | RoutineSeries<unknown>
  >
> {
  const db = getDb();
  const resolved = await resolveRoutineStep(db, playerId, routineKey, stepKey);
  if (!resolved.ok) return resolved;
  const { step } = resolved.data;

  const classification = sectionsForStep(step);

  if (classification.kind === "game") {
    return dispatchGameSection(
      playerId,
      classification.gameTypeKey,
      sectionId as SectionId,
      gameStepQuery(q),
      now,
      { routineKey, stepKey },
    );
  }

  const routineSectionMeta = classification.sections.find(
    (section) => section.id === sectionId,
  );
  if (routineSectionMeta === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const resolvedRange = await resolveSectionRange(db, routineSectionMeta, q);
  if ("error" in resolvedRange) {
    return validationFailed(resolvedRange.error);
  }
  const { from, statuses } = resolvedRange;

  const loaded = await loadStepSection(db, routineSectionMeta.id, step, {
    stepScope: { playerId, routineKey, stepKey, from, to: q.to, statuses },
    bucketArgs: {
      bucket: q.bucket,
      tz: q.bucket === "none" ? undefined : q.tz,
    },
    shapeCtx: { to: q.to, now },
  });
  if (!loaded.ok) return loaded;
  const { buckets, dataVersion } = loaded.data;

  return {
    ok: true,
    data: buildRoutineSeries(routineSectionMeta, dataVersion, q, from, buckets),
  };
}

/**
 * One step's paginated session list, newest first over
 * `v_stats_routine_step_facts` -- mirroring `listGameSessions`'s cursor and
 * `dataVersion` handling, but keyed to the owning routine.
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

  const cursor = decodeSessionCursor(q.cursor);
  if (!cursor.ok) {
    return validationFailed(cursor.reason);
  }

  const [rows, dataVersion] = await Promise.all([
    findStepSessionPage(db, {
      playerId,
      routineKey,
      stepKey,
      from: q.from,
      to: q.to,
      statuses: listStatuses(q.status),
      limit: q.limit,
      after: cursor.data,
    }),
    routineDataVersion(db, playerId, routineKey),
  ]);

  const { items, nextCursor } = pageSessions(rows, q.limit);

  return {
    ok: true,
    data: { items, nextCursor, dataVersion },
  };
}

/** The owner's variations of a game (D556): `501` always first, then ascending; `NOT_FOUND` for any other game. */
export async function listGameVariations(
  playerId: string,
  gameTypeKey: GameTypeKey,
): Promise<ServiceResult<{ variations: GameVariation[] }>> {
  if (gameTypeKey !== "501") {
    return { ok: false, code: "NOT_FOUND" };
  }
  const rows = await findGameVariations(getDb(), playerId, gameTypeKey);
  const isHome = (row: GameVariation) =>
    row.startingScore === DEFAULT_VARIATION;
  const home = rows.find(isHome) ?? {
    startingScore: DEFAULT_VARIATION,
    sessions: 0,
  };
  return {
    ok: true,
    data: { variations: [home, ...rows.filter((r) => !isHome(r))] },
  };
}
