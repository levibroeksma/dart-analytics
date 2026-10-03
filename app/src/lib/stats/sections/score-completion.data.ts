import { periodSection } from "@lib/stats/sections/period-section";
import { completionSummary } from "@lib/stats/sections/score-summaries";
import type { CompletionSummary } from "./types";
import type { CompletionMetrics } from "@modules/types";

/** Score Training's completion section: completed, abandoned and never-started sessions over the page-level period. */
export function scoreCompletionSection() {
  return {
    ...periodSection<CompletionMetrics>("completion"),

    get summary(): CompletionSummary {
      return completionSummary(this.buckets);
    },
  };
}
