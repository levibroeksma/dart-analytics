import { periodSection } from "@lib/stats/sections/period-section";
import { completionSummary } from "@lib/stats/sections/score-summaries";
import type { CompletionSummary } from "./types";
import type { CompletionMetrics } from "@modules/types";

const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** Score Training's session-result section: completed against abandoned games over the page-level period, as donut arcs. */
export function scoreCompletionSection() {
  return {
    ...periodSection<CompletionMetrics>("completion"),
    radius: DONUT_RADIUS,
    circumference: DONUT_CIRCUMFERENCE,

    get summary(): CompletionSummary {
      return completionSummary(this.buckets);
    },

    get total(): number {
      return this.summary.completed + this.summary.abandoned;
    },

    get completedArc(): string {
      return this.arc(this.summary.completed);
    },

    get abandonedArc(): string {
      return this.arc(this.summary.abandoned);
    },

    get abandonedOffset(): number {
      return -this.share(this.summary.completed) * DONUT_CIRCUMFERENCE;
    },

    share(count: number): number {
      return this.total === 0 ? 0 : count / this.total;
    },

    arc(count: number): string {
      return `${this.share(count) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`;
    },
  };
}
