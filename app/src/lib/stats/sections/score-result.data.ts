import { replayPath } from "@lib/stats/replay-route";
import { periodSection } from "@lib/stats/sections/period-section";
import { scoreResultSummary } from "@lib/stats/sections/score-summaries";
import type { ScoreResultSummary } from "./types";
import type { SessionResultMetrics } from "@modules/types";

/** Score Training's session-result section: mean counted score and the best session, linked to its replay, over the page-level period. */
export function scoreResultSection() {
  return {
    ...periodSection<SessionResultMetrics>("session-result"),

    get summary(): ScoreResultSummary {
      return scoreResultSummary(this.buckets);
    },

    replayHref: replayPath,
  };
}
