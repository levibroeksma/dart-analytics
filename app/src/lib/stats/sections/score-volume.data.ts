import { periodSection } from "@lib/stats/sections/period-section";
import { volumeSummary } from "@lib/stats/sections/score-summaries";
import type { VolumeSummary } from "./types";
import type { VolumeMetrics } from "@modules/types";

/** Score Training's volume section: sessions, darts and minutes over the page-level period. */
export function scoreVolumeSection() {
  return {
    ...periodSection<VolumeMetrics>("volume"),

    get summary(): VolumeSummary {
      return volumeSummary(this.buckets);
    },
  };
}
