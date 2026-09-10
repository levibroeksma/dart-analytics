/**
 * Warm-Up state, derived on every `state()` call. It carries no elapsed time:
 * an `ExerciseEngine` is deterministic with respect to its inputs,
 * configuration and ruleset (09-training-routines.md §9), so the clock lives in
 * the caller and transitions arrive as `advance()` calls.
 */
export type WarmUpState = {
  phaseIndex: number;
  phaseName: string;
  targets: readonly number[];
  phaseDurationSeconds: number;
  phaseCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
