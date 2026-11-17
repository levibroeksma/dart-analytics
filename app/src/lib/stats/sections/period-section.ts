import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
import type {
  GameTypeKey,
  RulesetVersionKey,
  SectionId,
  SeriesBucket,
  TrendRangeKey,
} from "@lib/types";

type PageScope = {
  $data: { rangeKey: TrendRangeKey; game: string; variation: number };
};

type WatchesRange = {
  $watch(key: "rangeKey" | "game" | "variation", callback: () => void): void;
  load(): Promise<void>;
};

const PAGE_FILTERS = ["rangeKey", "game", "variation"] as const;

/** Reloads `section` on every change of the page-level `rangeKey`, `game` or `variation`. */
export function reloadOnPageFilters(section: WatchesRange): void {
  for (const key of PAGE_FILTERS)
    section.$watch(key, () => void section.load());
}

/**
 * The shared fetch half of a game-page section over the page-level period:
 * one un-bucketed `sectionId` request for the page-level `game` (a ruleset
 * version key, resolved to its game type) over the current period on mount
 * and on every `rangeKey`, `game` or `variation` change, with a ticket that
 * drops a stale response. A section factory spreads it and adds its derived
 * getters.
 */
export function periodSection<M>(sectionId: SectionId) {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    buckets: [] as SeriesBucket<M>[],
    skippedSessions: 0,

    period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    gameTypeKey(): GameTypeKey | undefined {
      const key = (this as unknown as PageScope).$data.game;
      return GAME_TYPE_BY_RULESET[key as RulesetVersionKey];
    },

    init(this: WatchesRange) {
      reloadOnPageFilters(this);
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      this.buckets = [];
      this.skippedSessions = 0;
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
          variation: variationParam(
            gameTypeKey,
            (this as unknown as PageScope).$data.variation,
          ),
        });
        if (mine !== ticket) return;
        this.buckets = series.buckets;
        this.skippedSessions = series.skippedSessions ?? 0;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },
  };
}

type CardResult<C> = { card: C; error: string | null };

type CardScope<C> = {
  $data: { rangeKey: TrendRangeKey; game: string };
  loading: boolean;
  error: string | null;
  card: C;
};

/**
 * The `load` of a card section that reads over the page period: `fetchCard`
 * runs for the page `game` and `rangeKey`, and its card and error land on the
 * scope unless a newer load started meanwhile (a stale response is dropped).
 */
export function latestCardLoad<C>(
  fetchCard: (
    game: string,
    rangeKey: TrendRangeKey,
    now: Date,
  ) => Promise<CardResult<C>>,
) {
  let ticket = 0;
  return async function load(this: CardScope<C>, now: Date = new Date()) {
    const mine = ++ticket;
    this.loading = true;
    this.error = null;
    const result = await fetchCard(this.$data.game, this.$data.rangeKey, now);
    if (mine !== ticket) return;
    this.card = result.card;
    this.error = result.error;
    this.loading = false;
  };
}
