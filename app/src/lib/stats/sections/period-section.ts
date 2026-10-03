import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import type { SectionId, SeriesBucket, TrendRangeKey } from "@lib/types";

type PageScope = { $data: { rangeKey: TrendRangeKey } };

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
};

/**
 * The shared fetch half of a Score Training section over the page-level
 * period: one un-bucketed `sectionId` request over the current period on
 * mount and on every `rangeKey` change, with a ticket that drops a stale
 * response. A section factory spreads it and adds its derived getters.
 */
export function periodSection<M>(sectionId: SectionId) {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    buckets: [] as SeriesBucket<M>[],

    period(): TrendRangeKey {
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
        const window = heatmapWindow(this.period(), now);
        const series = await loadGameSection<M>("SCORE_TRAINING", sectionId, {
          from: window.from,
          to: window.to,
          bucket: "none",
        });
        if (mine !== ticket) return;
        this.buckets = series.buckets;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },
  };
}
