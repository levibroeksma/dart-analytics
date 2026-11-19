import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  CHECKOUT_START,
  doubleRows,
  rangeRows,
  routeRows,
} from "@lib/stats/checkout/checkout-cards";
import { pathRemainings } from "@lib/stats/checkout/checkout-routes";
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import type { AimTableRow, RulesetVersionKey, TrendRangeKey } from "@lib/types";
import type {
  CheckoutPathMetrics,
  DoublePerformanceMetrics,
  LadderProgressMetrics,
} from "@modules/types";

type CheckoutCards = {
  ranges: AimTableRow[];
  doubles: AimTableRow[];
  paths: CheckoutPathMetrics;
  origin: number;
};

const EMPTY_CARDS: CheckoutCards = {
  ranges: [],
  doubles: [],
  paths: {},
  origin: 1,
};

async function fetchCheckoutCards(
  game: string,
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: CheckoutCards; error: string | null }> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  const origin =
    gameTypeKey === undefined ? undefined : CHECKOUT_START[gameTypeKey];
  if (gameTypeKey === undefined || origin === undefined)
    return { card: EMPTY_CARDS, error: null };
  const range = { ...heatmapWindow(rangeKey, now), bucket: "none" as const };
  try {
    const [ladder, doubles, paths] = await Promise.all([
      loadGameSection<LadderProgressMetrics>(
        gameTypeKey,
        "ladder-progress",
        range,
      ),
      loadGameSection<DoublePerformanceMetrics>(
        gameTypeKey,
        "double-performance",
        range,
      ),
      loadGameSection<CheckoutPathMetrics>(gameTypeKey, "checkout-path", range),
    ]);
    return {
      card: {
        ranges: rangeRows(ladder.buckets, origin),
        doubles: doubleRows(doubles),
        paths: paths.buckets[0]?.metrics ?? {},
        origin,
      },
      error: null,
    };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_CARDS, error };
  }
}

const loadCards = latestCardLoad(fetchCheckoutCards);

type CardsScope = ThisParameterType<typeof loadCards> & {
  remaining: number | null;
};

/** Alpine scope of the Checkout cards: finish rate by target range, double hit rate and the routes thrown at a chosen target, over the page period. */
export function checkoutCardsSection() {
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_CARDS,
    remaining: null as number | null,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    async load(this: CardsScope, now: Date = new Date()) {
      await loadCards.call(this, now);
      const remainings = pathRemainings(this.card.paths);
      if (this.remaining === null || !remainings.includes(this.remaining))
        this.remaining = remainings[0] ?? null;
    },

    get targets(): { value: number; label: string }[] {
      return pathRemainings(this.card.paths).map((value) => ({
        value,
        label: String(value),
      }));
    },

    get routes(): AimTableRow[] {
      return routeRows(this.card.paths, this.remaining);
    },
  };
}
