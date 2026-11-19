import type { CachedSeries } from "@client/types";
import { MIN_ROW_SAMPLE } from "@lib/stats/constants";
import { targetLabel } from "@lib/stats/target-key";
import { formatRate } from "@lib/stats/x01/format";
import { hitRateRows } from "@modules/stats/sections/hit-rate-rows.module";
import type {
  CheckoutPathMetrics,
  DoublePerformanceMetrics,
  LadderProgressMetrics,
} from "@modules/types";
import type { AimTableRow, SeriesBucket } from "@lib/types";
import { routesFor } from "./checkout-routes";
import { ladderBands, sumLadderTargets } from "./ladder-totals";

/** The score each Checkout game's ladder starts from, keyed by game type. */
export const CHECKOUT_START: Record<string, number> = {
  ONE_TWENTY_ONE: 121,
  TUOD: 41,
};

const BAND_SIZE = 20;
const TOP_TARGET = 170;

/** Finish rate by target range: bands of 20 from `origin` (targets below it in one band), each as its goes, finishes and gated rate. */
export function rangeRows(
  ladder: readonly SeriesBucket<LadderProgressMetrics>[],
  origin: number,
): AimTableRow[] {
  const { totals } = sumLadderTargets(ladder);
  return ladderBands(totals, {
    origin,
    size: BAND_SIZE,
    cap: TOP_TARGET,
    minSample: MIN_ROW_SAMPLE,
  }).map((band) => ({
    label: `${band.start}–${band.end}`,
    count: band.attempts,
    cells: [String(band.successes), formatRate(band.rate)],
  }));
}

/** Hit rate per finishing double, most darts first; the rate shows from `MIN_ROW_SAMPLE` darts. */
export function doubleRows(
  doubles: CachedSeries<DoublePerformanceMetrics> | undefined,
): AimTableRow[] {
  return hitRateRows(doubles)
    .sort((a, b) => b.attempts - a.attempts)
    .map((row) => ({
      label: targetLabel(row.targetKey),
      count: row.attempts,
      cells: [formatRate(row.attempts >= MIN_ROW_SAMPLE ? row.rate : null)],
    }));
}

/** The routes thrown at `remaining`, most used first, with their finishes and finish rate; empty with no target. */
export function routeRows(
  paths: CheckoutPathMetrics,
  remaining: number | null,
): AimTableRow[] {
  if (remaining === null) return [];
  return routesFor(paths, remaining).map((route) => ({
    label: route.route,
    count: route.visits,
    cells: [String(route.finished), formatRate(route.finishRate)],
  }));
}
