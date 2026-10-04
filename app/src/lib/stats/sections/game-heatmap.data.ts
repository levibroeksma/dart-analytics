import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { heatmapTargetOptions } from "@lib/stats/heatmap-targets";
import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { heatStamps } from "@modules/stats/sections/heatmap-density.module";
import type {
  RulesetVersionKey,
  SeriesBucket,
  TargetKey,
  TrendRangeKey,
} from "@lib/types";
import type { HeatStamp, HeatmapMetrics } from "@modules/types";

type PageScope = { $data: { rangeKey: TrendRangeKey; game: string } };

type WatchesRange = {
  $watch(key: "rangeKey" | "game" | "target", callback: () => void): void;
  target: TargetKey | null;
  load(): Promise<void>;
};

const BOARD_SPAN_MM = BOARD_RADII_MM.surroundOuter * 2;

/**
 * The heatmap section of a game's `/statistics` layout: fetches `heatmap` for
 * the page-level `game` (a ruleset version key, resolved to its game type) on
 * mount and on every change of it or of `rangeKey`, over the period's current
 * span only, and derives the density stamps the board canvas draws. Games with
 * stored intent (`HEATMAP_TARGET_GAMES`) also get a `target` picker: one
 * request per target, "All targets" (`null`) sends none.
 */
export function gameHeatmapSection() {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    bucket: null as SeriesBucket<HeatmapMetrics> | null,
    target: null as TargetKey | null,

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    get gameTypeKey() {
      const key = (this as unknown as PageScope).$data.game;
      return GAME_TYPE_BY_RULESET[key as RulesetVersionKey];
    },

    get targetOptions() {
      return heatmapTargetOptions(this.gameTypeKey);
    },

    /** A game change clears the target: the previous game's target may not exist in the next one. */
    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      this.$watch("target", () => void this.load());
      this.$watch("game", () => {
        if (this.target === null) void this.load();
        else this.target = null;
      });
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      this.bucket = null;
      const gameTypeKey = this.gameTypeKey;
      if (gameTypeKey === undefined) {
        this.loading = false;
        return;
      }
      try {
        const window = heatmapWindow(this.period, now);
        const series = await loadGameSection<HeatmapMetrics>(
          gameTypeKey,
          "heatmap",
          {
            from: window.from,
            to: window.to,
            bucket: "none",
            ...(this.target === null ? {} : { target: this.target }),
          },
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
