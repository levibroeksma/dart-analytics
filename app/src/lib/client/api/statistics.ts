import { apiRequest } from "./client";
import type {
  GameSectionResponseData,
  GameSessionListResponseData,
  GameStatsRangeParams,
  ReplayPageSchemaData,
  ReplaySessionParams,
  RoutineHeaderSchemaData,
  RoutineSectionParams,
  RoutineSectionResponseData,
  RoutineStepSectionResponseData,
  RoutineStepSessionListResponseData,
  RoutineStepSessionsParams,
  StatisticsOverviewResponseData,
  TrainedRoutineListResponseData,
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
  if (q.target !== undefined) params.set("target", q.target);
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

/** One page of a session's replay (`10-Statistics/02-Replay.md`), paginated by turn. */
export async function fetchSessionReplay(
  sessionId: string,
  q: ReplaySessionParams = {},
): Promise<ReplayPageSchemaData> {
  const params = new URLSearchParams();
  if (q.cursor !== undefined) params.set("cursor", q.cursor);
  if (q.limit !== undefined) params.set("limit", String(q.limit));

  const result = await apiRequest<ReplayPageSchemaData>(
    `/api/statistics/sessions/${encodeURIComponent(sessionId)}/replay?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** `RoutineStatsQuery`'s own fields, built into a query string — no `context`, `inputMode` or `target` (D372 decision 4): the route fixes context server-side and never accepts either of the other two. */
function routineSectionSearchParams(q: RoutineSectionParams): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", q.from);
  params.set("to", q.to);
  if (q.bucket !== undefined) params.set("bucket", q.bucket);
  if (q.tz !== undefined) params.set("tz", q.tz);
  if (q.status !== undefined) params.set("status", q.status);
  return params;
}

/** Every routine the caller has trained (`10-Statistics/00-Overview.md` §6). Takes no parameters — the route's `RoutineNoQuery` accepts none. */
export async function fetchTrainedRoutines(): Promise<TrainedRoutineListResponseData> {
  const result = await apiRequest<TrainedRoutineListResponseData>(
    "/api/statistics/routines",
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** One routine's header: identity, run counts, `dataVersion` and every step it has ever run. Takes no parameters. */
export async function fetchRoutineHeader(
  routineKey: string,
): Promise<RoutineHeaderSchemaData> {
  const result = await apiRequest<RoutineHeaderSchemaData>(
    `/api/statistics/routines/${encodeURIComponent(routineKey)}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** One routine's run-level section result (`routine-volume`/`routine-completion`), dispatched server-side through the routine registry. */
export async function fetchRoutineSection(
  routineKey: string,
  sectionId: string,
  q: RoutineSectionParams,
): Promise<RoutineSectionResponseData> {
  const params = routineSectionSearchParams(q);

  const result = await apiRequest<RoutineSectionResponseData>(
    `/api/statistics/routines/${encodeURIComponent(routineKey)}/sections/${sectionId}?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** One routine step's section result: a GAME step's own game section, scoped server-side to that step, or a non-game step's `step-volume`/`step-result`. */
export async function fetchRoutineStepSection(
  routineKey: string,
  stepKey: string,
  sectionId: string,
  q: RoutineSectionParams,
): Promise<RoutineStepSectionResponseData> {
  const params = routineSectionSearchParams(q);

  const result = await apiRequest<RoutineStepSectionResponseData>(
    `/api/statistics/routines/${encodeURIComponent(routineKey)}/steps/${encodeURIComponent(stepKey)}/sections/${sectionId}?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}

/** One routine step's paginated session list, newest first, over `v_stats_routine_step_facts`. */
export async function fetchRoutineStepSessions(
  routineKey: string,
  stepKey: string,
  q: RoutineStepSessionsParams,
): Promise<RoutineStepSessionListResponseData> {
  const params = new URLSearchParams();
  params.set("from", q.from);
  params.set("to", q.to);
  if (q.status !== undefined) params.set("status", q.status);
  if (q.limit !== undefined) params.set("limit", String(q.limit));
  if (q.cursor !== undefined) params.set("cursor", q.cursor);

  const result = await apiRequest<RoutineStepSessionListResponseData>(
    `/api/statistics/routines/${encodeURIComponent(routineKey)}/steps/${encodeURIComponent(stepKey)}/sessions?${params.toString()}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}
