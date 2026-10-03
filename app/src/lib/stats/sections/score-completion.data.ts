import { periodSection } from "@lib/stats/sections/period-section";
import { completionSummary } from "@lib/stats/sections/score-summaries";
import type { CompletionSummary } from "./types";
import type { CompletionMetrics, ChartSpec } from "@modules/types";

/** Score Training's session-result section: completed against abandoned games over the page-level period, as a doughnut spec. */
export function scoreCompletionSection() {
  return {
    ...periodSection<CompletionMetrics>("completion"),

    get summary(): CompletionSummary {
      return completionSummary(this.buckets);
    },

    get isEmpty(): boolean {
      return this.summary.completed + this.summary.abandoned === 0;
    },

    get chart(): ChartSpec {
      const { completed, abandoned } = this.summary;
      return {
        kind: "doughnut",
        labels: [`Completed · ${completed}`, `Abandoned · ${abandoned}`],
        series: [
          {
            key: "games",
            label: "Games",
            data: [completed, abandoned],
            sliceColors: ["emerald", "rose"],
          },
        ],
        ariaLabel: `${completed} completed, ${abandoned} abandoned games`,
      };
    },
  };
}
