import type { RulesetVersionKey } from "@lib/game/rulesets/types";
import type { EngineFacts } from "./types";

/**
 * Contract every game engine implements, regardless of ruleset. `TInput` is
 * the shape `record()` accepts (e.g. a single dart hit or a whole visit);
 * `TState` is the shape `state()` and `record()` return.
 */
export interface GameEngine<TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  record(input: TInput): TState;
  undo(): boolean;
  /**
   * Answers whether recording `input` would complete the session, without
   * mutating any state — no turn, stage or leg is created, so the caller can
   * gate a finish-confirm prompt and still leave the fact log untouched when
   * the player cancels. Returns false for an `input` `record()` would reject.
   */
  wouldComplete(input: TInput): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds a `GameEngine` for one ruleset version. `create(config, prior)` is
 * the rehydrate path: passing persisted `EngineFacts` back replays them to
 * rebuild the engine's state, so a page refresh restores the game exactly.
 */
export interface GameEngineFactory<TConfig, TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): GameEngine<TInput, TState>;
}
