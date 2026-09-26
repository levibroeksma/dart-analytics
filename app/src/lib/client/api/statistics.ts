import { apiRequest } from "./client";
import type {
  GameSectionResponseData,
  GameSessionListResponseData,
  GameStatsRangeParams,
  StatisticsOverviewResponseData,
} from "./types";

export class StatisticsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StatisticsApiError";
  }
}

export async function fetchStatisticsOverview(): Promise<StatisticsOverviewResponseData> {
  const result = await apiRequest<StatisticsOverviewResponseData>(
    "/api/statistics/overview",
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

function rangeSearchParams(q: GameStatsRangeParams): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", q.from);
  params.set("to", q.to);
  if (q.bucket !== undefined) params.set("bucket", q.bucket);
  if (q.tz !== undefined) params.set("tz", q.tz);
  if (q.status !== undefined) params.set("status", q.status);
  if (q.context !== undefined) params.set("context", q.context);
  if (q.inputMode !== undefined) params.set("inputMode", q.inputMode);
  return params;
}

/** A game page's paginated session list (`00-Overview.md` §6). */
export async function fetchGameSessions(
  gameTypeKey: string,
  q: GameStatsRangeParams & { limit?: number; cursor?: string },
): Promise<GameSessionListResponseData> {
  const params = rangeSearchParams(q);
  if (q.limit !== undefined) params.set("limit", String(q.limit));
  if (q.cursor !== undefined) params.set("cursor", q.cursor);

  const result = await apiRequest<GameSessionListResponseData>(
    `/api/statistics/games/${gameTypeKey}/sessions?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** One insight section's result for a game page, dispatched server-side through the registry. */
export async function fetchGameSection(
  gameTypeKey: string,
  sectionId: string,
  q: GameStatsRangeParams,
): Promise<GameSectionResponseData> {
  const params = rangeSearchParams(q);

  const result = await apiRequest<GameSectionResponseData>(
    `/api/statistics/games/${gameTypeKey}/sections/${sectionId}?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}
