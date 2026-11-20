import { MIN_ROW_SAMPLE } from "@lib/stats/constants";
import { formatRate } from "@lib/stats/x01/format";
import type { AimTableRow } from "@lib/types";
import type { MarksMetrics } from "@modules/types";

const OBJECTIVE_LABELS: Record<string, string> = {
  BULL: "Bull",
  DOUBLES: "Doubles",
  TRIPLES: "Triples",
};

/** One row per objective in the game's order: darts landed as the count, marks as the cell. */
export function objectiveRows(m: MarksMetrics): AimTableRow[] {
  return m.objectives.map((objective) => ({
    label: OBJECTIVE_LABELS[objective.key] ?? objective.key,
    count: objective.darts,
    cells: [String(objective.marks)],
  }));
}

/** Single, double and treble marks (effective marks by the ring of the dart that added them) with their share; the share shows from `MIN_ROW_SAMPLE` marks in all. */
export function ringRows(m: MarksMetrics): AimTableRow[] {
  const { single, double, treble } = m.rings;
  const total = single + double + treble;
  const share = (count: number) =>
    formatRate(total >= MIN_ROW_SAMPLE ? count / total : null);
  return [
    { label: "Single", count: single, cells: [share(single)] },
    { label: "Double", count: double, cells: [share(double)] },
    { label: "Treble", count: treble, cells: [share(treble)] },
  ];
}
