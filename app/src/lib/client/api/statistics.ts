import { apiRequest } from "./client";
import type { StatisticsOverviewResponseData } from "./types";

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
