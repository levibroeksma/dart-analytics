import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { replayPath } from "@lib/stats/replay-route";
import { formatShortDate } from "@lib/stats/sections/score-trend-window";
import type { GameSessionListResponseData } from "@client/api/types";
import type { SeriesBucket } from "@lib/types";
import type {
  CompletionMetrics,
  SessionResultMetrics,
  TrebleRateMetrics,
} from "@modules/types";

import type {
  CompletionSummary,
  ScoreResultSummary,
  SessionRow,
  TrebleSummary,
} from "./types";

type SessionListItem = GameSessionListResponseData["items"][number];

function rateAt(
  totals: Record<string, { darts: number; trebles: number }>,
  key: string,
): number | null {
  const entry = totals[key];
  if (entry === undefined || entry.darts < MIN_TARGET_SAMPLE) return null;
  return entry.trebles / entry.darts;
}

/** Treble rate for T20, T19 and every hit number together, summed across buckets; `null` below `MIN_TARGET_SAMPLE` darts. */
export function trebleSummary(
  buckets: readonly SeriesBucket<TrebleRateMetrics>[],
): TrebleSummary {
  const totals: Record<string, { darts: number; trebles: number }> = {};
  let darts = 0;
  let trebles = 0;
  for (const bucket of buckets) {
    for (const [key, m] of Object.entries(bucket.metrics)) {
      const entry = totals[key] ?? { darts: 0, trebles: 0 };
      entry.darts += m.darts;
      entry.trebles += m.trebles;
      totals[key] = entry;
      darts += m.darts;
      trebles += m.trebles;
    }
  }
  return {
    t20: rateAt(totals, "20"),
    t19: rateAt(totals, "19"),
    overall: darts >= MIN_TARGET_SAMPLE ? trebles / darts : null,
  };
}

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

/** Mean counted score and the highest-scoring session across every bucket and ruleset slice. */
export function scoreResultSummary(
  buckets: readonly SeriesBucket<SessionResultMetrics>[],
): ScoreResultSummary {
  let sessions = 0;
  let scoreSum = 0;
  let best: ScoreResultSummary["best"] = null;
  for (const { metrics } of buckets) {
    for (const slice of Object.values(metrics)) {
      sessions += slice.sessions;
      scoreSum += slice.countedScoreSum;
      if (best === null || slice.countedScoreMax > best.value) {
        best = {
          value: slice.countedScoreMax,
          sessionId: slice.bestHighSessionId,
        };
      }
    }
  }
  return {
    sessions,
    average: sessions === 0 ? null : scoreSum / sessions,
    best,
  };
}

/** One session-list row: the 3-dart average from the stored score and darts, whole minutes, and the replay link. */
export function sessionRow(item: SessionListItem, tz: string): SessionRow {
  return {
    id: item.sessionId,
    href: replayPath(item.sessionId),
    date: formatShortDate(item.completedAt, tz),
    average:
      item.dartCount === 0 ? null : (item.countedScore / item.dartCount) * 3,
    darts: item.dartCount,
    minutes: Math.round(item.durationSeconds / 60),
  };
}
