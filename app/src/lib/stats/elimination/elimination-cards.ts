import { MIN_ROW_SAMPLE } from "@lib/stats/constants";
import { formatRate } from "@lib/stats/x01/format";
import { eliminationComparison } from "./elimination-comparison";
import type { AimTableRow, EliminationCard } from "@lib/types";
import type {
  BedKey,
  EliminationGameKey,
  EliminationMetrics,
} from "@modules/types";

const BED_LABELS: Record<BedKey, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TREBLE: "Treble",
  BULL: "Bull",
};

const RESULT_LABELS: [
  Exclude<keyof EliminationMetrics["prisoner"], "reached">,
  string,
][] = [
  ["advance", "Advance"],
  ["advanceAndCapture", "Advance and capture"],
  ["capture", "Capture"],
  ["prison", "Prison"],
  ["miss", "Miss"],
];

/** One row per target bed: match visits as the count, the match rate as the cell from `MIN_ROW_SAMPLE` visits. */
export function bedRows(m: EliminationMetrics): AimTableRow[] {
  return (Object.keys(BED_LABELS) as BedKey[]).map((key) => {
    const { visits, matched } = m.followTheLeader.byBed[key];
    return {
      label: BED_LABELS[key],
      count: visits,
      cells: [formatRate(visits >= MIN_ROW_SAMPLE ? matched / visits : null)],
    };
  });
}

/** One row per Prisoner dart result: darts as the count, the share of all owner darts as the cell. */
export function prisonerResultRows(m: EliminationMetrics): AimTableRow[] {
  return RESULT_LABELS.map(([key, label]) => ({
    label,
    count: m.prisoner[key],
    cells: [formatRate(m.darts > 0 ? m.prisoner[key] / m.darts : null)],
  }));
}

/** `game`'s card for the current period against the previous one: comparison, the Follow the Leader bed rows and the Prisoner result rows (each empty for the other games). */
export function eliminationCard(
  game: EliminationGameKey,
  current: EliminationMetrics,
  previous: EliminationMetrics | null,
): EliminationCard {
  return {
    comparison: eliminationComparison(current, previous),
    beds: game === "FOLLOW_THE_LEADER" ? bedRows(current) : [],
    results: game === "PRISONER" ? prisonerResultRows(current) : [],
  };
}
