import type { RulesetVersionKey } from "@lib/types";
import type {
  DartIntent,
  DartObservation,
  EngineFacts,
  ShellState,
  StageOwnership,
  TurnFact,
} from "./types";

/**
 * Contract every game engine implements, regardless of ruleset. `TInput` is
 * the shape `record()` accepts (e.g. a single dart hit or a whole visit);
 * `TState` is the shape `state()` and `record()` return.
 */
export interface GameEngine<TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  /**
   * Which stage shape this engine has, so the shared seat rota can derive the
   * active seat without knowing the ruleset. Static, not derived: a one-seat
   * session behaves identically under either value, so an engine not yet
   * wired for multiple seats declares the shape it WILL have.
   */
  readonly stageOwnership: StageOwnership;
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
  /**
   * Which stage shape this engine has, so the shared seat rota can derive the
   * active seat without knowing the ruleset. Static, not derived: a one-seat
   * session behaves identically under either value, so an engine not yet
   * wired for multiple seats declares the shape it WILL have.
   */
  readonly stageOwnership: StageOwnership;
  create(config: TConfig, prior?: EngineFacts): GameEngine<TInput, TState>;
}

/**
 * What a single-stage, dart-input engine decides; everything else — the log,
 * keys, `completedAt`, undo, rehydration — is the shell's (Pattern 18).
 * `refusal` returns the error `record()` throws, or null to accept.
 */
export interface DartGameSpec<TConfig, TState extends ShellState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership: StageOwnership;
  fold(facts: EngineFacts, config: TConfig): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
  wouldComplete(
    state: TState,
    observation: DartObservation,
    config: TConfig,
  ): boolean;
}

/** A shell-built engine; `spec` brands it so `instanceof` narrows to it. */
export interface ShellGameEngine<
  TConfig,
  TState extends ShellState,
> extends GameEngine<DartObservation, TState> {
  readonly spec: DartGameSpec<TConfig, TState>;
}

/** Constructor of a shell-built engine class. */
export interface DartGameEngineClass<TConfig, TState extends ShellState> {
  new (config: TConfig, prior?: EngineFacts): ShellGameEngine<TConfig, TState>;
}
