import type { AceMeasure } from "../ace/types";
import type { AimTableRow } from "../x01/types";

/**
 * The Fives comparison measures over the page period against the preceding
 * period of equal length: win rate (wins over finished games), scoring visit
 * rate (scoring visits over visits), points per visit (fives points over
 * visits) and visits per win (visits in won games over wins).
 */
export type FivesComparison = Record<
  "wins" | "scoringRate" | "pointsPerVisit" | "visitsPerWin",
  AceMeasure
>;

/** The Fives page card for one period: its comparison and the visit outcome rows. */
export type FivesCard = {
  comparison: FivesComparison;
  outcomes: AimTableRow[];
};
