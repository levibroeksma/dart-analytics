import type { SeriesBucket } from "@lib/types";
import type {
  LooseDartsMetrics,
  MissDirectionMetrics,
  TargetAccuracyMetrics,
} from "@modules/types";

/** One double's (or the bull's) row of the Doubles Training card: hits, miss directions, wire bands and near-miss split. */
export type DoublesTrainingRow = {
  aim: string;
  label: string;
  darts: number;
  hits: number;
  rate: number | null;
  left: number;
  right: number;
  high: number;
  low: number;
  inside: number;
  within: number;
  outside: number;
  nearMiss: number;
  loose: number;
};

/** The three section results the Doubles Training card joins by target key. */
export type DoublesTrainingInput = {
  accuracy: readonly SeriesBucket<TargetAccuracyMetrics>[];
  misses: readonly SeriesBucket<MissDirectionMetrics>[];
  loose: readonly SeriesBucket<LooseDartsMetrics>[];
};

/** The Doubles Training card: rows with darts, the favourite double and the total darts. */
export type DoublesTrainingCard = {
  favourite: DoublesTrainingRow | null;
  darts: number;
  rows: DoublesTrainingRow[];
};
