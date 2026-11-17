import type { DoublesTrainingRow } from "../doubles/types";

/** How the Track games table is ordered: by target, or by hit rate lowest first. */
export type TrackSort = "target" | "rate";

/** The Track games card: its rows plus the best, most failed and weakest targets among rows of enough darts. */
export type TrackGamesCard = {
  best: DoublesTrainingRow | null;
  worst: DoublesTrainingRow | null;
  weakest: DoublesTrainingRow[];
  darts: number;
  rows: DoublesTrainingRow[];
};

/** One summary tile above the Track games table. */
export type TrackTile = { title: string; value: string; detail: string };
