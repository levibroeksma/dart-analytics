import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { checkoutComparison } from "@lib/stats/checkout/checkout-comparison";
import { checkoutComparisonTiles } from "@lib/stats/checkout/checkout-comparison-lines";
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";
import type {
  CheckoutComparison,
  CheckoutInput,
  GameTypeKey,
  RulesetVersionKey,
  TrackTile,
  TrendRangeKey,
} from "@lib/types";
import type { BustRateMetrics, LadderProgressMetrics } from "@modules/types";

const NONE = { part: 0, whole: 0 };

const EMPTY_COMPARISON: CheckoutComparison = {
  finish: { current: NONE, previous: null },
  peak: { current: null, previous: null, currentGoes: 0, previousGoes: null },
  recovery: { current: NONE, previous: null },
  bust: { current: NONE, previous: null },
};

async function loadCheckoutInputOver(
  gameTypeKey: GameTypeKey,
  span: { from: string; to: string },
): Promise<CheckoutInput> {
  const range = { ...span, bucket: "none" as const };
  const [ladder, busts] = await Promise.all([
    loadGameSection<LadderProgressMetrics>(
      gameTypeKey,
      "ladder-progress",
      range,
    ),
    loadGameSection<BustRateMetrics>(gameTypeKey, "bust-rate", range),
  ]);
  return { ladder: ladder.buckets, busts: busts.buckets };
}

async function fetchCheckoutComparison(
  game: string,
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: CheckoutComparison; error: string | null }> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  if (gameTypeKey === undefined) return { card: EMPTY_COMPARISON, error: null };
  const before = precedingWindow(rangeKey, now);
  try {
    const [current, previous] = await Promise.all([
      loadCheckoutInputOver(gameTypeKey, heatmapWindow(rangeKey, now)),
      before === null ? null : loadCheckoutInputOver(gameTypeKey, before),
    ]);
    return { card: checkoutComparison(current, previous), error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_COMPARISON, error };
  }
}

/** Alpine scope of the Checkout comparison tiles: finish rate, highest target, recovery rate and bust rate over the page period against the preceding period. */
export function checkoutComparisonSection() {
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_COMPARISON,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    load: latestCardLoad(fetchCheckoutComparison),

    get tiles(): TrackTile[] {
      return checkoutComparisonTiles(this.card);
    },
  };
}
