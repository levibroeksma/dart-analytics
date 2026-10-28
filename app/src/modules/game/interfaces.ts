import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  BoardTarget,
  DartIntent,
  CheckoutSeat,
  DartObservation,
  EliminationSeat,
  EngineFacts,
  JudgedDart,
  SeatChange,
  ShellState,
  StageFact,
  StageOwnership,
  TrackSeat,
  TrackTarget,
  TurnFact,
  VisitVerdict,
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

/** Whole-visit input a spec accepts besides darts (a keypad total). */
export interface DartGameVisitInput<
  TConfig,
  TState extends ShellState,
  TVisit,
> {
  isVisit(input: DartObservation | TVisit): input is TVisit;
  /** Why the visit is refused now, or `null` — replaces the spec's `refusal` for visit input; `open` is the turn still taking darts. */
  refusal(
    state: TState,
    input: TVisit,
    config: TConfig,
    open: TurnFact | null,
  ): string | null;
  /** The `totalScore` of the one closed, dartless turn the shell writes. */
  total(state: TState, input: TVisit): number;
}

/**
 * What a single-stage, dart-input engine decides; everything else — the log,
 * keys, `completedAt`, undo, rehydration — is the shell's (Pattern 18).
 * `refusal` returns the error `record()` throws, or null to accept.
 */
export interface DartGameSpec<
  TConfig,
  TState extends ShellState,
  TVisit = never,
> {
  readonly rulesetVersionKey: RulesetVersionKey;
  /** Further ruleset versions this one spec serves; `rulesetVersionKey` is the default. */
  readonly rulesetVersionKeys?: readonly RulesetVersionKey[];
  readonly stageOwnership: StageOwnership;
  /** Folds the log; `timerExpired` is the shell's `expireTimer()` flag (timerless specs ignore it). */
  fold(facts: EngineFacts, config: TConfig, timerExpired: boolean): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  /** Whether `turn` still takes darts, given the folded state before the dart (reuse) or after it (close). */
  isVisitOpen(turn: TurnFact, state: TState, config: TConfig): boolean;
  /** `open` is the turn still taking darts, or `null`. */
  wouldComplete(
    state: TState,
    input: DartObservation | TVisit,
    config: TConfig,
    open: TurnFact | null,
  ): boolean;
  /** The `totalScore` a closing visit persists, from the state before it opened and after it closed, and the closed turn; without it the darts' board-score sum stays. */
  closedVisitTotal?(
    opened: TState,
    closed: TState,
    participantRef: string,
    turn: TurnFact,
    config: TConfig,
  ): number;
  /** Visit-total input; also switches `undo()` to pop a whole dartless turn. */
  readonly visitInput?: DartGameVisitInput<TConfig, TState, TVisit>;
  /** Darts resolve from their coordinates (`resolveObservation`) and carry no intent; an open turn's `totalScore` is never written, so only `closedVisitTotal` sets it. */
  readonly coordinateCapture?: boolean;
  /** An open turn's `totalScore` is its darts' board-score sum after every dart, in either capture mode; `closedVisitTotal` still settles it at close. */
  readonly liveTotal?: boolean;
  /** Replaces the default `isComplete()` (any status but `IN_PROGRESS`); `expiredAt` is the state when `expireTimer()` last ran, or null. */
  complete?(state: TState, config: TConfig, expiredAt: TState | null): boolean;
  /** The stage `state` plays in; the shell opens it after a closing record when its `clientKey` differs from the open stage's, counts turn `sequence` within each stage and undoes with `undoStagedTurn`. */
  stageFor?(state: TState): StageFact;
}

/** A shell-built engine; `spec` brands it so `instanceof` narrows to it. */
export interface ShellGameEngine<
  TConfig,
  TState extends ShellState,
  TInput = DartObservation,
> extends GameEngine<TInput, TState> {
  readonly spec: DartGameSpec<TConfig, TState, unknown>;
  /** Marks the run's clock as run out; every fold reads it as `timerExpired`. Undo leaves it set. */
  expireTimer(): void;
}

/** Constructor of a shell-built engine class. */
export interface DartGameEngineClass<
  TConfig,
  TState extends ShellState,
  TInput = DartObservation,
> {
  new (
    config: TConfig,
    prior?: EngineFacts,
    rulesetVersionKey?: RulesetVersionKey,
  ): ShellGameEngine<TConfig, TState, TInput>;
}

/**
 * One Track ruleset as named policies (Pattern 18 §Rule-kernel families):
 * which target a seat aims at, what counts as a hit and what it scores, and
 * what happens per dart and when a visit closes.
 */
export interface TrackRules<TExt, TTarget extends TrackTarget = BoardTarget> {
  readonly doneMessage: string;
  /** Every seat's score before its first dart; 0 when absent. */
  readonly startScore?: number;
  target(seat: TrackSeat<TExt>): TTarget;
  hit(target: TTarget, observation: DartObservation): boolean;
  points(target: TTarget, observation: DartObservation, hit: boolean): number;
  onDart?(seat: TrackSeat<TExt>, dart: JudgedDart<TTarget>): TrackSeat<TExt>;
  visitOpen(seat: TrackSeat<TExt>): boolean;
  onVisitClose?(seat: TrackSeat<TExt>): TrackSeat<TExt>;
}

/**
 * A Checkout ruleset as named policies over `CheckoutSeat`
 * (`checkout-kernel.module.ts`): how a visit is judged, how many visits an
 * attempt allows, what closing an attempt books, and the next target
 * (`null` ends the seat).
 */
export interface CheckoutRules<TExt> {
  readonly visitsPerAttempt: number;
  judge(seat: CheckoutSeat<TExt>, turn: TurnFact): VisitVerdict;
  onAttemptClose(
    seat: CheckoutSeat<TExt>,
    passed: boolean,
    verdict: VisitVerdict,
  ): CheckoutSeat<TExt>;
  nextTarget(seat: CheckoutSeat<TExt>, passed: boolean): number | null;
}

/**
 * A Visit points ruleset (`visit-points-kernel.module.ts`): how many darts
 * close a visit, and the points a closed visit's total earns.
 */
export interface VisitPointsRules {
  readonly dartsPerVisit: number;
  points(visitTotal: number): number;
}

/**
 * An Elimination ruleset as one policy over `EliminationSeat`
 * (`elimination-kernel.module.ts`): the lives each seat starts on, its
 * starting `ext`, and every change one dart causes, judged on the seats as
 * they stand before it.
 */
export interface EliminationRules<TExt> {
  readonly startingLives: number;
  initExt(seat: SeatFact, index: number): TExt;
  onDart(
    thrower: EliminationSeat<TExt>,
    seats: readonly EliminationSeat<TExt>[],
    dart: DartObservation,
  ): readonly SeatChange<TExt>[];
}
