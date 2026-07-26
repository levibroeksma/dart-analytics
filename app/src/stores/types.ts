import type {
  Bobs27Snapshot,
  DoublesTrainingSnapshot,
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  SinglesSnapshot,
} from "@lib/types";

/** Any ruleset's camelCase client snapshot, as persisted by `game.store.ts`. */
export type ConfigSnapshot =
  | ScoreTrainingSnapshot
  | Bobs27Snapshot
  | SinglesSnapshot
  | DoublesTrainingSnapshot
  | FiveOhOneSnapshot;
