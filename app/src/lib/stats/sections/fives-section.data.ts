import { fivesCard, fivesTiles } from "@lib/stats/fives/fives-cards";
import { sumFives } from "@lib/stats/fives/fives-comparison";
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";
import type { FivesCard, FivesComparison, GameTypeKey } from "@lib/types";
import type { FivesMetrics } from "@modules/types";

const NONE = { current: { part: 0, whole: 0 }, previous: null };

const EMPTY_CARD: FivesCard = {
  comparison: {
    wins: NONE,
    scoringRate: NONE,
    pointsPerVisit: NONE,
    visitsPerWin: NONE,
  } satisfies FivesComparison,
  outcomes: [],
};

async function readFives(
  gameTypeKey: GameTypeKey,
  span: { from: string; to: string },
): Promise<FivesMetrics> {
  const series = await loadGameSection<FivesMetrics>(gameTypeKey, "fives", {
    ...span,
    bucket: "none",
  });
  return sumFives(series.buckets);
}

const fetchFivesCard = periodComparison(
  readFives,
  (current, previous) => fivesCard(current, previous),
  EMPTY_CARD,
);

/** Alpine scope of the Fives layout: the four tiles over the page period against the preceding period, plus the visit outcome rows on `card`. */
export function fivesSection() {
  return comparisonSection(fetchFivesCard, EMPTY_CARD, (card) =>
    fivesTiles(card.comparison),
  );
}
