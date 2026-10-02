import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { heatStamps } from "@modules/stats/sections/heatmap-density.module";
import type { SeriesBucket, TrendRangeKey } from "@lib/types";
import type { HeatStamp, HeatmapMetrics } from "@modules/types";

type PageScope = { $data: { rangeKey: TrendRangeKey } };

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
};

const BOARD_SPAN_MM = BOARD_RADII_MM.surroundOuter * 2;

/**
 * Score Training's heatmap section: fetches `heatmap` on mount and on every
 * change of the page-level `rangeKey`, over the score trend's current period
 * only, and derives the density stamps the board canvas draws.
 */
export function scoreHeatmapSection() {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    bucket: null as SeriesBucket<HeatmapMetrics> | null,

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      try {
        const window = heatmapWindow(this.period, now);
        const series = await loadGameSection<HeatmapMetrics>(
          "SCORE_TRAINING",
          "heatmap",
          { from: window.from, to: window.to, bucket: "none" },
        );
        if (mine !== ticket) return;
        this.bucket = series.buckets[0] ?? null;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    get stamps(): HeatStamp[] {
      return this.bucket === null
        ? []
        : heatStamps(this.bucket.metrics, BOARD_SPAN_MM);
    },

    get isEmpty(): boolean {
      return this.stamps.length === 0;
    },
  };
}
