import type { RulesetVersionKey } from "@lib/types";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  JudgedDart,
  ShellState,
  StageOwnership,
  TrackSeat,
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
  /** Further ruleset versions this one spec serves; `rulesetVersionKey` is the default. */
  readonly rulesetVersionKeys?: readonly RulesetVersionKey[];
  readonly stageOwnership: StageOwnership;
  /** Folds the log; `timerExpired` is the shell's `expireTimer()` flag (timerless specs ignore it). */
  fold(facts: EngineFacts, config: TConfig, timerExpired: boolean): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  /** Whether `turn` still takes darts, given the folded state before the dart (reuse) or after it (close). */
  isVisitOpen(turn: TurnFact, state: TState): boolean;
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
  /** Marks the run's clock as run out; every fold reads it as `timerExpired`. Undo leaves it set. */
  expireTimer(): void;
}

/** Constructor of a shell-built engine class. */
export interface DartGameEngineClass<TConfig, TState extends ShellState> {
  new (
    config: TConfig,
    prior?: EngineFacts,
    rulesetVersionKey?: RulesetVersionKey,
  ): ShellGameEngine<TConfig, TState>;
}

/**
 * One Track ruleset as named policies (Pattern 18 §Rule-kernel families):
 * which target a seat aims at, what counts as a hit and what it scores, and
 * what happens per dart and when a visit closes.
 */
export interface TrackRules<TExt> {
  readonly doneMessage: string;
  /** Every seat's score before its first dart; 0 when absent. */
  readonly startScore?: number;
  target(seat: TrackSeat<TExt>): BoardTarget;
  hit(target: BoardTarget, observation: DartObservation): boolean;
  points(
    target: BoardTarget,
    observation: DartObservation,
    hit: boolean,
  ): number;
  onDart?(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt>;
  visitOpen(seat: TrackSeat<TExt>): boolean;
  onVisitClose?(seat: TrackSeat<TExt>): TrackSeat<TExt>;
}
