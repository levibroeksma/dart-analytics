import type {
  Bobs27Snapshot,
  DoublesTrainingSnapshot,
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  Seated,
  SinglesSnapshot,
} from "@lib/types";

/**
 * Any ruleset's camelCase client snapshot, as persisted by `game.store.ts`,
 * plus the seats playing it.
 */
export type ConfigSnapshot = Seated<
  | ScoreTrainingSnapshot
  | Bobs27Snapshot
  | SinglesSnapshot
  | DoublesTrainingSnapshot
  | FiveOhOneSnapshot
>;
