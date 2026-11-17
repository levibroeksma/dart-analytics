import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { aceComparison } from "@lib/stats/ace/ace-comparison";
import { aceComparisonTiles } from "@lib/stats/ace/ace-comparison-lines";
import {
  loadTargetInputs,
  loadTargetInputsOver,
} from "@lib/stats/doubles/doubles-training-fetch";
import { trackRowKeys } from "@lib/stats/heatmap-targets";
import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import { precedingWindow } from "@lib/stats/sections/score-trend-window";
import type {
  AceComparison,
  RulesetVersionKey,
  TrackTile,
  TrendRangeKey,
} from "@lib/types";

const NONE = { part: 0, whole: 0 };

const EMPTY_COMPARISON: AceComparison = {
  hit: { current: NONE, previous: null },
  drift: { direction: null, current: NONE, previous: null },
  near: { current: NONE, previous: null },
};

async function fetchAceComparison(
  game: string,
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: AceComparison; error: string | null }> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  if (gameTypeKey === undefined) return { card: EMPTY_COMPARISON, error: null };
  const before = precedingWindow(rangeKey, now);
  try {
    const [current, previous] = await Promise.all([
      loadTargetInputs(gameTypeKey, rangeKey, now),
      before === null ? null : loadTargetInputsOver(gameTypeKey, before),
    ]);
    return {
      card: aceComparison(current, previous, trackRowKeys(gameTypeKey)),
      error: null,
    };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_COMPARISON, error };
  }
}

/** Alpine scope of the Ace comparison tiles: target hit rate, drift and near miss share over the page period against the preceding period (D563). */
export function aceComparisonSection() {
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_COMPARISON,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    load: latestCardLoad(fetchAceComparison),

    get tiles(): TrackTile[] {
      return aceComparisonTiles(this.card);
    },
  };
}
