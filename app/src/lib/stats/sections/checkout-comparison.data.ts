import { checkoutComparison } from "@lib/stats/checkout/checkout-comparison";
import { checkoutComparisonTiles } from "@lib/stats/checkout/checkout-comparison-lines";
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";
import type {
  CheckoutComparison,
  CheckoutInput,
  GameTypeKey,
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

const fetchCheckoutComparison = periodComparison(
  loadCheckoutInputOver,
  checkoutComparison,
  EMPTY_COMPARISON,
);

/** Alpine scope of the Checkout comparison tiles: finish rate, highest target, recovery rate and bust rate over the page period against the preceding period. */
export function checkoutComparisonSection() {
  return comparisonSection(
    fetchCheckoutComparison,
    EMPTY_COMPARISON,
    checkoutComparisonTiles,
  );
}
