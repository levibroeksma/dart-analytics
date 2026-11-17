import { formatRate } from "@lib/stats/x01/format";
import type { AimTableRow } from "@lib/types";
import type { DoublesTrainingCard, DoublesTrainingRow } from "./types";

/** The favourite double's hit rate, or a dash while no double has enough darts. */
export function doublesTrainingHeadline(card: DoublesTrainingCard): string {
  return formatRate(card.favourite?.rate ?? null);
}

/** The card's favourite-double caption, or a waiting line while no double has enough darts. */
export function doublesTrainingCaption(card: DoublesTrainingCard): string {
  const favourite = card.favourite;
  return favourite === null
    ? "Not enough darts yet"
    : `Favourite ${favourite.label}, ${favourite.darts} darts`;
}

/** One table line of a card row: hit rate, left/right, high/low, wire bands, near/loose. */
export function doublesTrainingTableRow(row: DoublesTrainingRow): AimTableRow {
  return {
    label: row.label,
    count: row.darts,
    cells: [
      formatRate(row.rate),
      `${row.left}/${row.right}`,
      `${row.high}/${row.low}`,
      `${row.inside}/${row.within}/${row.outside}`,
      `${row.nearMiss}/${row.loose}`,
    ],
  };
}

/** The card's overlay table lines, one per double: hit rate, left/right, high/low, wire bands, near/loose. */
export function doublesTrainingTable(card: DoublesTrainingCard): AimTableRow[] {
  return card.rows.map(doublesTrainingTableRow);
}
