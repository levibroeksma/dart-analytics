import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import type {
  GameTypeKey,
  RulesetVersionKey,
  TrackTile,
  TrendRangeKey,
} from "@lib/types";

/** The fetch of a comparison card: `read` loads one period's inputs for the page game, over the page period and over the preceding period (`null` for All Time), and `build` turns the two into the card; an unknown ruleset or a failed read gives `empty` (with the message for a failed read). */
export function periodComparison<I, C>(
  read: (
    gameTypeKey: GameTypeKey,
    span: { from: string; to: string },
  ) => Promise<I>,
  build: (current: I, previous: I | null, gameTypeKey: GameTypeKey) => C,
  empty: C,
) {
  return async (
    game: string,
    rangeKey: TrendRangeKey,
    now: Date,
  ): Promise<{ card: C; error: string | null }> => {
    const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
    if (gameTypeKey === undefined) return { card: empty, error: null };
    const before = precedingWindow(rangeKey, now);
    try {
      const [current, previous] = await Promise.all([
        read(gameTypeKey, heatmapWindow(rangeKey, now)),
        before === null ? null : read(gameTypeKey, before),
      ]);
      return { card: build(current, previous, gameTypeKey), error: null };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "load failed";
      return { card: empty, error };
    }
  };
}

/** The Alpine scope of a comparison tile row: `fetchCard` runs over the page period and its card becomes `tiles` through `toTiles`; the card is `empty` while loading or after a failed read. */
export function comparisonSection<C>(
  fetchCard: (
    game: string,
    rangeKey: TrendRangeKey,
    now: Date,
  ) => Promise<{ card: C; error: string | null }>,
  empty: C,
  toTiles: (card: C) => TrackTile[],
) {
  return {
    loading: true,
    error: null as string | null,
    card: empty,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    load: latestCardLoad(fetchCard),

    get tiles(): TrackTile[] {
      return toTiles(this.card);
    },
  };
}
