import type { AceMeasure } from "../ace/types";

/** A measure shown as a mean (`part / whole`), not a percent: this period's and the preceding period's, `null` with no preceding period. */
export type MeanMeasure = AceMeasure;

/**
 * The Marks comparison measures over the page period against the preceding
 * period of equal length: marks per round (marks × 3 over darts), darts to
 * close out (close-out darts over close-outs), wasted darts, 1v1 win rate,
 * and 1v1 points per round (points × 3 over 1v1 darts).
 */
export type MarksComparison = {
  mpr: MeanMeasure;
  close: MeanMeasure;
  wasted: AceMeasure;
  wins: AceMeasure;
  ppr: MeanMeasure;
};
