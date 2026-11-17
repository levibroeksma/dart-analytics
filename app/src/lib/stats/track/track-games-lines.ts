import { doublesTrainingTableRow } from "@lib/stats/doubles/doubles-training-lines";
import { formatRate } from "@lib/stats/x01/format";
import type {
  AimTableRow,
  DoublesTrainingRow,
  TrackGamesCard,
  TrackSort,
  TrackTile,
} from "@lib/types";

const WAITING = "Not enough darts yet";

function rowTile(title: string, row: DoublesTrainingRow | null): TrackTile {
  return row === null
    ? { title, value: formatRate(null), detail: WAITING }
    : {
        title,
        value: row.label,
        detail: `${formatRate(row.rate)} · ${row.darts} darts`,
      };
}

function weakestTile(rows: DoublesTrainingRow[]): TrackTile {
  const title = "Weakest three";
  if (rows.length === 0)
    return { title, value: formatRate(null), detail: WAITING };
  return {
    title,
    value: rows.map((row) => row.label).join(" · "),
    detail: rows.map((row) => formatRate(row.rate)).join(" · "),
  };
}

function lowestRateFirst(a: DoublesTrainingRow, b: DoublesTrainingRow): number {
  if (a.rate === null || b.rate === null)
    return Number(a.rate === null) - Number(b.rate === null);
  return a.hits * b.darts - b.hits * a.darts;
}

/** The three tiles above the table: best target, most failed and weakest three. */
export function trackTiles(card: TrackGamesCard): TrackTile[] {
  return [
    rowTile("Best target", card.best),
    rowTile("Most failed", card.worst),
    weakestTile(card.weakest),
  ];
}

/** The table lines, one per target: in target order, or lowest hit rate first with rows under the row floor last. */
export function trackTable(
  card: TrackGamesCard,
  sort: TrackSort,
): AimTableRow[] {
  const rows =
    sort === "rate" ? [...card.rows].sort(lowestRateFirst) : card.rows;
  return rows.map(doublesTrainingTableRow);
}
