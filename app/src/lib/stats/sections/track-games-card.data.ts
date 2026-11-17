import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { NEAR_MISS_MM } from "@lib/stats/constants";
import { loadTargetInputs } from "@lib/stats/doubles/doubles-training-fetch";
import { trackRowKeys } from "@lib/stats/heatmap-targets";
import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import { trackGamesCard } from "@lib/stats/track/track-games-card";
import { trackTable, trackTiles } from "@lib/stats/track/track-games-lines";
import type {
  AimTableRow,
  RulesetVersionKey,
  TrackGamesCard,
  TrackSort,
  TrackTile,
  TrendRangeKey,
} from "@lib/types";

const EMPTY_TRACK_CARD: TrackGamesCard = {
  best: null,
  worst: null,
  weakest: [],
  darts: 0,
  rows: [],
};

async function fetchTrackCard(
  game: string,
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: TrackGamesCard; error: string | null }> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  const keys = trackRowKeys(gameTypeKey);
  if (gameTypeKey === undefined || keys.size === 0)
    return { card: EMPTY_TRACK_CARD, error: null };
  try {
    const input = await loadTargetInputs(gameTypeKey, rangeKey, now);
    return { card: trackGamesCard(input, keys), error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_TRACK_CARD, error };
  }
}

/** Alpine scope of the Track games card: the page game's per-target `target-accuracy`, `miss-direction` and `loose-darts` over the page period, as tiles and a sortable table. */
export function trackGamesCardSection() {
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_TRACK_CARD,
    sort: "target" as TrackSort,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    load: latestCardLoad(fetchTrackCard),

    setSort(sort: TrackSort) {
      this.sort = sort;
    },

    get tiles(): TrackTile[] {
      return trackTiles(this.card);
    },

    get table(): AimTableRow[] {
      return trackTable(this.card, this.sort);
    },

    get footer(): string {
      return `${this.card.darts} darts · near miss within ${NEAR_MISS_MM} mm`;
    },
  };
}
