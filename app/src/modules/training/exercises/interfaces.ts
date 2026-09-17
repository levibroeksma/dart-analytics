import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { DartObservation, EngineFacts } from "@modules/types";

/**
 * Contract every exercise engine implements, parallel to `GameEngine` and
 * never built on top of one (09-training-routines.md §10). `TState` is the
 * shape `state()` and `advance()` return.
 */
export interface ExerciseEngine<TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  advance(): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds an `ExerciseEngine` for one exercise ruleset version.
 * `create(config, prior)` replays persisted facts to restore an in-progress
 * exercise after a page refresh.
 */
export interface ExerciseEngineFactory<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): ExerciseEngine<TState>;
}

/**
 * Contract for an exercise engine that operates in analytics mode
 * (09-training-routines.md §13) — one that takes dart input rather than
 * advancing through timed phases. Sibling to `ExerciseEngine`, not an
 * extension of it: nothing here has a phase to `advance()` through, and
 * nothing in `ExerciseEngine` has an observation to `record()`. Shaped like
 * `GameEngine<DartObservation, TState>` minus `stageOwnership`/
 * `wouldComplete`, which don't apply — a routine step has no seats and no
 * finish-confirm prompt to gate.
 */
export interface DartExerciseEngine<TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  record(observation: DartObservation): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds a `DartExerciseEngine` for one exercise ruleset version, mirroring
 * `ExerciseEngineFactory`.
 */
export interface DartExerciseEngineFactory<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): DartExerciseEngine<TState>;
}
