import { loadGameSection } from "@lib/stats/load-game-section";
import { personalBestWindow } from "@lib/stats/sections/score-trend-window";
import { personalBestFinish } from "@lib/stats/sections/score-summaries";
import type { LadderProgressMetrics } from "@modules/types";

/**
 * 121's personal best finish card: one all-time un-bucketed `ladder-progress`
 * request on mount only (never re-fetched on a period or game change), reduced
 * to the highest target ever reached minus one.
 */
export function personalBestFinishSection() {
  return {
    loading: true,
    finish: null as number | null,

    init() {
      void this.load();
    },

    async load(now: Date = new Date()) {
      this.loading = true;
      try {
        const series = await loadGameSection<LadderProgressMetrics>(
          "ONE_TWENTY_ONE",
          "ladder-progress",
          personalBestWindow(now),
        );
        this.finish = personalBestFinish(series.buckets);
      } catch {
        this.finish = null;
      } finally {
        this.loading = false;
      }
    },
  };
}
