import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import type {
  GameTypeKey,
  RulesetVersionKey,
  SectionId,
  SeriesBucket,
  TrendRangeKey,
} from "@lib/types";

type PageScope = { $data: { rangeKey: TrendRangeKey; game: string } };

type WatchesRange = {
  $watch(key: "rangeKey" | "game", callback: () => void): void;
  load(): Promise<void>;
};

/**
 * The shared fetch half of a game-page section over the page-level period:
 * one un-bucketed `sectionId` request for the page-level `game` (a ruleset
 * version key, resolved to its game type) over the current period on mount
 * and on every `rangeKey` or `game` change, with a ticket that drops a stale
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

    gameTypeKey(): GameTypeKey | undefined {
      const key = (this as unknown as PageScope).$data.game;
      return GAME_TYPE_BY_RULESET[key as RulesetVersionKey];
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      this.$watch("game", () => void this.load());
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      this.buckets = [];
      const gameTypeKey = this.gameTypeKey();
      if (gameTypeKey === undefined) {
        this.loading = false;
        return;
      }
      try {
        const window = heatmapWindow(this.period(), now);
        const series = await loadGameSection<M>(gameTypeKey, sectionId, {
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
