import { getDb } from "@db/client";
import { SECTIONS, sectionsForGame } from "@lib/stats/section-registry";
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
import { checkoutVisitsFromRows } from "@modules/stats/x01-checkout-sessions.module";
import {
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import { completionBuckets } from "@modules/stats/sections/completion.module";
import {
  decodeCursor,
  encodeCursor,
  encodeDataVersion,
} from "@modules/stats/sections/series.module";
import { sessionResultBuckets } from "@modules/stats/sections/session-result.module";
import { volumeBuckets } from "@modules/stats/sections/volume.module";
import {
  findBucketFloor,
  findBucketedSessionAggregates,
  findGameDataVersion,
  findGameSessionsPage,
  findLegFacts,
  findSessionSummaries,
  findVisitFacts,
  findX01CheckoutDarts,
} from "@repositories/statistics.repository";
import type {
  GameTypeKey,
  SectionId,
  SeriesBucket,
  StatusFilter,
} from "@lib/types";
import type {
  SessionListQueryData,
  StatisticsRangeQueryData,
} from "@routes/types";
import type { StatsBucketRow } from "@modules/types";
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

const HANDLERS: Record<
  SectionId,
  (
    rows: StatsBucketRow[],
    ctx: { to: string; now: Date },
  ) => SeriesBucket<unknown>[]
> = {
  completion: completionBuckets,
  volume: volumeBuckets,
  "session-result": sessionResultBuckets,
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

  const [dataVersionInput, rows] = await Promise.all([
    findGameDataVersion(db, playerId, gameTypeKey),
    findBucketedSessionAggregates(db, {
      playerId,
      gameTypeKey,
      from,
      to: q.to,
      bucket: q.bucket,
      tz: q.bucket === "none" ? undefined : q.tz,
      statuses: resolved.statuses,
      context: q.context,
    }),
  ]);

  const buckets = HANDLERS[sectionId](rows, { to: q.to, now });

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
