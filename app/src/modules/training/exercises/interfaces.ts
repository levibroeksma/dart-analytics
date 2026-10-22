import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { TrackRules } from "@modules/interfaces";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  TrackSeat,
  TrackTarget,
  TurnFact,
} from "@modules/types";

/**
 * Contract every exercise engine implements, parallel to `GameEngine` and
 * never built on top of one (09-Training/01-Routines.md §10). `TState` is the
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
 * (09-Training/01-Routines.md §13) — one that takes dart input rather than
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

/**
 * What a clockless timed dart exercise decides; the shell owns the log,
 * keys, `completedAt`, undo and expiry (D264). `fold` receives whether the
 * controller's timer has expired.
 */
export interface DartExerciseSpec<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  parse(config: TConfig): TConfig;
  fold(facts: EngineFacts, config: TConfig, expired: boolean): TState;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
}

/**
 * A Track-family exercise as rules plus a projection; `trackExerciseSpec`
 * turns it into a `DartExerciseSpec` over one solo seat, three-dart visits.
 */
export interface TrackExerciseDefinition<
  TConfig,
  TExt,
  TState,
  TTarget extends TrackTarget = BoardTarget,
> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  parse(config: TConfig): TConfig;
  rules(config: TConfig): TrackRules<TExt, TTarget>;
  initialExt(config: TConfig): TExt;
  project(
    seat: TrackSeat<TExt>,
    config: TConfig,
    expired: boolean,
    facts: EngineFacts,
  ): TState;
  intent(state: TState, config: TConfig): DartIntent;
}

/** A shell-built exercise; `spec` brands it so `instanceof` narrows to it. */
export interface TimedDartExerciseEngine<
  TConfig,
  TState,
> extends DartExerciseEngine<TState> {
  readonly spec: DartExerciseSpec<TConfig, TState>;
  expireTimer(): void;
}

/** Constructor of a shell-built exercise class. */
export interface DartExerciseEngineClass<TConfig, TState> {
  new (
    config: TConfig,
    prior?: EngineFacts,
  ): TimedDartExerciseEngine<TConfig, TState>;
}
