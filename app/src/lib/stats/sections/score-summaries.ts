import { formatShortDate } from "@lib/stats/sections/score-trend-window";
import type { GameSessionListResponseData } from "@client/api/types";
import type { SeriesBucket } from "@lib/types";
import type { CompletionMetrics, LadderProgressMetrics } from "@modules/types";

import type { CompletionSummary, SessionRow } from "./types";

type SessionListItem = GameSessionListResponseData["items"][number];

/** Completed and abandoned counts summed across buckets; never-started sessions are left out, so the abandon rate is abandoned over started. */
export function completionSummary(
  buckets: readonly SeriesBucket<CompletionMetrics>[],
): CompletionSummary {
  let completed = 0;
  let abandoned = 0;
  for (const { metrics } of buckets) {
    completed += metrics.completed;
    abandoned += metrics.abandoned;
  }
  const sample = completed + abandoned;
  return {
    completed,
    abandoned,
    abandonRate: sample === 0 ? null : abandoned / sample,
  };
}

/** One session-list row: the 3-dart average from the stored score and darts, whole minutes, and the session id a replay card opens. */
export function sessionRow(item: SessionListItem, tz: string): SessionRow {
  return {
    id: item.sessionId,
    date: formatShortDate(item.completedAt, tz),
    average:
      item.dartCount === 0 ? null : (item.countedScore / item.dartCount) * 3,
    darts: item.dartCount,
    minutes: Math.round(item.durationSeconds / 60),
  };
}

/** 121's personal best finish: the highest target ever reached, minus one (the last target cleared); `null` with no attempt. */
export function personalBestFinish(
  buckets: readonly SeriesBucket<LadderProgressMetrics>[],
): number | null {
  let max: number | null = null;
  for (const { metrics } of buckets) {
    if (metrics.maxTarget === null) continue;
    max = max === null ? metrics.maxTarget : Math.max(max, metrics.maxTarget);
  }
  return max === null || max < 2 ? null : max - 1;
}
