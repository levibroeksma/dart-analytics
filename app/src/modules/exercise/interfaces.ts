import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { EngineFacts } from "@modules/types";

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
