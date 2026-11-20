import { objectiveRows, ringRows } from "@lib/stats/marks/marks-cards";
import { marksComparison, sumMarks } from "@lib/stats/marks/marks-comparison";
import {
  marksComparisonTiles,
  pointsTiles,
} from "@lib/stats/marks/marks-comparison-lines";
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";
import type { GameTypeKey, MarksCard, MarksComparison } from "@lib/types";
import type { MarksMetrics } from "@modules/types";

const NONE = { part: 0, whole: 0 };

const EMPTY_COMPARISON: MarksComparison = {
  mpr: { current: NONE, previous: null },
  close: { current: NONE, previous: null },
  wasted: { current: NONE, previous: null },
  wins: { current: NONE, previous: null },
  ppr: { current: NONE, previous: null },
};

const EMPTY_CARD: MarksCard = {
  comparison: EMPTY_COMPARISON,
  objectives: [],
  rings: [],
  points: [],
};

async function readMarks(
  gameTypeKey: GameTypeKey,
  span: { from: string; to: string },
): Promise<MarksMetrics> {
  const series = await loadGameSection<MarksMetrics>(gameTypeKey, "marks", {
    ...span,
    bucket: "none",
  });
  return sumMarks(series.buckets);
}

function marksCard(
  current: MarksMetrics,
  previous: MarksMetrics | null,
): MarksCard {
  const comparison = marksComparison(current, previous);
  return {
    comparison,
    objectives: objectiveRows(current),
    rings: ringRows(current),
    points: pointsTiles(comparison),
  };
}

const fetchMarksCard = periodComparison(readMarks, marksCard, EMPTY_CARD);

/** Alpine scope of the Marks layout: marks per round, darts to close out, wasted darts and win rate over the page period against the preceding period, plus the period's objective, ring and points rows on `card`. */
export function marksSection() {
  return comparisonSection(fetchMarksCard, EMPTY_CARD, (card) =>
    marksComparisonTiles(card.comparison),
  );
}
