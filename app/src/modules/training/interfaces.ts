import type { TrainingState } from "./types";

/**
 * Runtime orchestration for one training: which step is active, how many have
 * finished, and whether the routine is over (09-training-routines.md §8).
 *
 * It does not know how an exercise evaluates anything — that is the active
 * `ExerciseEngine`'s job — and it holds no clock, so it stays deterministic
 * with respect to the snapshot it was built from.
 */
export interface TrainingEngine {
  state(): TrainingState;
  completeStep(): TrainingState;
  isComplete(): boolean;
}
