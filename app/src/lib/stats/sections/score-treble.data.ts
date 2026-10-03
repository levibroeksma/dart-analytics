import { periodSection } from "@lib/stats/sections/period-section";
import { trebleSummary } from "@lib/stats/sections/score-summaries";
import type { TrebleSummary } from "./types";
import type { TrebleRateMetrics } from "@modules/types";

/** Score Training's treble-rate section: T20, T19 and overall treble share over the page-level period. */
export function scoreTrebleSection() {
  return {
    ...periodSection<TrebleRateMetrics>("treble-rate"),

    get summary(): TrebleSummary {
      return trebleSummary(this.buckets);
    },

    fmtRate(rate: number | null): string {
      return rate === null ? "—" : `${Math.round(rate * 100)}%`;
    },
  };
}
