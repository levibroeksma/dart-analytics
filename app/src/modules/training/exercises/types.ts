/**
 * Warm-Up state, derived on every `state()` call. It carries no elapsed time:
 * an `ExerciseEngine` is deterministic with respect to its inputs,
 * configuration and ruleset (09-Training/01-Routines.md §9), so the clock lives in
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

/**
 * Switching state, derived on every `state()` call by replaying `facts()`
 * (`foldSwitchingState`) — nothing here is held as mutable engine state.
 * `targetIndex` is the position in `config.targets` the *next* dart scores
 * against; `currentTargetNumber` is that same target's board number, so a
 * caller never has to index into its own copy of the config to render it.
 */
export type SwitchingState = {
  currentTargetNumber: number;
  targetIndex: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Double Pattern state, derived on every `state()` call by replaying
 * `facts()` (`foldDoublePatternState`), exactly like `SwitchingState`.
 * `patternIndex`/`targetWithinPattern` locate the *next* dart inside
 * `config.patterns`; `currentDoubleNumber` is that double's own board
 * number, e.g. `20` for `D20`.
 */
export type DoublePatternState = {
  patternIndex: number;
  targetWithinPattern: number;
  currentDoubleNumber: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Target Scoring state, derived on every `state()` call by replaying
 * `facts()` (`foldTargetScoringState`), exactly like `SwitchingState`.
 * `targetIndex`/`currentTargetNumber` locate the target the *next* dart is
 * thrown at. `bestChain` and `bestChainByTarget` include the live chain, so
 * a chain cut by the timer still counts; `markToBeat` is the best *finished*
 * chain on the current target this run — `null` until one exists.
 */
export type TargetScoringState = {
  currentTargetNumber: number;
  targetIndex: number;
  currentChain: number;
  bestChain: number;
  markToBeat: number | null;
  bestChainByTarget: { targetNumber: number; bestChain: number }[];
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Switching Target Scoring state, derived by replaying `facts()`
 * (`foldSwitchingTargetScoringState`). `targetIndex`/`currentTargetNumber`
 * locate the target the *next* dart is thrown at. `bestChain` includes the
 * live chain; `markToBeat` is the best chain ended by a miss this run —
 * `null` until one exists. `completedSequences` counts hits on the last
 * target, i.e. full passes through the sequence.
 */
export type SwitchingTargetScoringState = {
  currentTargetNumber: number;
  targetIndex: number;
  currentChain: number;
  bestChain: number;
  markToBeat: number | null;
  completedSequences: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
