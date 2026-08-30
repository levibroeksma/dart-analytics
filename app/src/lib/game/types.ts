import type { ConfigurationPresetData } from "@client/api/configuration-templates";
import type { SessionActiveData } from "@client/api/types";
import type { ScoreInputBuffer } from "@modules/game/score-input.module";
import type { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import type { TuodEngine } from "@modules/game/tuod.engine.module";
import type { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";
import type { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import type { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import type { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import type { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import type { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";
import type { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import type {
  AroundTheClockSeatState,
  AroundTheClockState,
  BoardCoordinate,
  Bobs27State,
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  DoublesTrainingState,
  EngineFacts,
  FiveOhOneState,
  MagnifierPlacement,
  OneTwentyOneState,
  ScoreTrainingState,
  ShanghaiState,
  SinglesTrainingState,
  StageFact,
  TuodAttemptInput,
  TuodState,
  TurnFact,
} from "@modules/types";
import type { BoardHit } from "./board/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  SeatFact,
  Seated,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
  SinglesV2Snapshot,
  DoublesTrainingSnapshot,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  AroundTheClockSnapshot,
  TuodSnapshot,
} from "./rulesets/types";

export * from "./rulesets/types";
export * from "./board/types";

export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";

export type TuodDurationType = "ROUNDS" | "MINUTES";

export type OneTwentyOneDurationType = "TARGET" | "ROUNDS" | "MINUTES";

export type TuodSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: TuodDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  $watch(
    key: "durationType",
    callback: (value: TuodDurationType) => void,
  ): void;
  init(this: TuodSetupContext): Promise<void>;
  reconcile(
    this: TuodSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: TuodSetupContext): Promise<void>;
  continueSession(this: TuodSetupContext): void;
  abandonSession(this: TuodSetupContext): Promise<void>;
  selectMode(this: TuodSetupContext, type: TuodDurationType): void;
  presetForMode(
    this: TuodSetupContext,
    type: TuodDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: TuodSetupContext): void;
  removeGuest(this: TuodSetupContext, index: number): void;
  forceRoundsIfGuested(this: TuodSetupContext): void;
  start(this: TuodSetupContext): Promise<void>;
};

export type TargetOrderMode = "LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM";

/**
 * Everything the magnifier draws, mirrored onto the Alpine component itself.
 *
 * The board-input controller is deliberately pure: it keeps `active`, `point`
 * and `placement` in closure variables and publishes them through getters.
 * Alpine's reactivity tracks property reads on ITS OWN proxies, so a getter
 * that reads a closure variable is invisible to it — `move()` mutates state no
 * effect can depend on, and every binding that dereferences the controller
 * keeps rendering the values it had at press time. Copying the readings onto a
 * reactive field after each call is what makes the magnifier follow the
 * finger; binding straight at the controller silently freezes it.
 */
export type BoardView = {
  active: boolean;
  point: BoardCoordinate | null;
  preview: BoardHit | null;
  placement: MagnifierPlacement | null;
  magnifierSize: number;
  pxPerMm: number;
};

export type PreviewSegment = { status: "hit" | "miss" | "empty" };

/** One landed dart, positioned as a percentage of the board's rendered box. */
export type BoardMarker = {
  sequence: number;
  leftPercent: number;
  topPercent: number;
};

/**
 * The `$store` shape every play page reads, parameterised by the game's own
 * config snapshot. Written once rather than per game: the two copies had
 * already drifted into near-identical 18-line blocks, and each new session
 * field (most recently the mode pair) had to be added to both by hand or the
 * pages disagreed about what the store holds.
 *
 * The timer fields are optional because only Score Training runs a countdown;
 * 501 never reads them.
 *
 * `configSnapshot` is seated: the session's seats live inside the snapshot the
 * engine was built from, so `$store.game.seats` and that config can never
 * disagree.
 */
export type PlayStoreContext<TConfig> = {
  game: {
    rulesetVersionKey: RulesetVersionKey | null;
    sessionId: string | null;
    templateRef: string | null;
    configSnapshot: Seated<TConfig> | null;
    readonly seats: readonly SeatFact[];
    captureModeKey: string | null;
    inputModeKey: string | null;
    stages: StageFact[];
    turns: TurnFact[];
    timerRemainingMs?: number | null;
    timerStartedAt?: string | null;
    timerExpired?: boolean;
    idempotencyKey?: string | null;
    loading: boolean;
    recordFacts(facts: EngineFacts): void;
    setSessionModes(modes: ModePair): void;
    reset(): void;
  };
  settings: {
    captureModeKey: string;
    inputModeKey: string;
  };
};

/**
 * The play-page lifecycle shape shared by every ruleset whose game loop is a
 * plain record → mirror → complete cycle with no board input and no
 * reveal-then-clear timer (currently Doubles Training and Singles Training —
 * Bob's 27's board/timer branch and 501/Score Training's `ScoreInputBuffer`
 * shape are different enough to stay out of this module, D208/D209).
 * `init`/`uploadAndCompleteSession` are declared here because the shared
 * functions in `play-lifecycle.ts` call back into whichever concrete
 * wrapper a page assigns to those keys.
 */
export type PlayLifecycleContext<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
> = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: TResults | null;
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<TConfig>;
  engine: TEngine | null;
  init(): Promise<void>;
  uploadAndCompleteSession(): Promise<void>;
};

/**
 * What `runPlayAgain`'s optional `buildOverrides` callback returns: the
 * locally-merged config snapshot for the new session (config-shaped,
 * camelCase) plus the wire-shaped (snake_case) `overrides` sent to
 * `POST /api/sessions`. Both are ruleset-specific, so the caller — not
 * `play-lifecycle.ts` — builds them; this keeps `runPlayAgain` itself
 * generic over `TConfig`.
 */
export type PlayAgainOverrides<TConfig> = {
  snapshot: TConfig;
  wire: Record<string, unknown>;
};

/** One seat's own results stats, replayed from its own completed visits in
 * `turns`. `total` is that seat's final score (from `finalState`, not
 * recomputed); the rest are derived by the shared `play-visit-stats.ts`
 * helpers over that seat's own completed visits only. Score-band counts are
 * exclusive (D238, Pattern 21) — a visit increments exactly one of
 * `hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties`, never more
 * than one. */
export type ScoreTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  total: number;
  threeDartAverage: string;
  firstNineAverage: string;
  highestScore: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

/** `winningSideKey` is score-compare (highest total) resolved by the engine; `null` for a solo session or a TIE. `status` mirrors the engine's own completion state, collapsed to just the two outcomes a finished session can report: `COMPLETE` for a solo session or a decided 1v1 match, `TIE` when both seats totalled the same score — the only way callers can tell a genuine tie apart from a solo session, since both leave `winningSideKey` `null`. `seats` has one entry per configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type ScoreTrainingResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ScoreTrainingSeatResult[];
};

export type ScoreTrainingPlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: ScoreTrainingResultsSnapshot | null;
  pendingFinishScore: number | null;
  pendingDartObservation: DartObservation | null;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<ScoreTrainingSnapshot>;
  engine: ScoreTrainingEngine | null;
  timer: SegmentTimer | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: ScoreTrainingPlayContext): BoardMarker[];
  state(this: ScoreTrainingPlayContext): ScoreTrainingState | null;
  totalScoreFor(this: ScoreTrainingPlayContext, seatRef: string): number;
  threeDartAverageFor(this: ScoreTrainingPlayContext, seatRef: string): string;
  dartsThrownThisLegFor(
    this: ScoreTrainingPlayContext,
    seatRef: string,
  ): number;
  previousScoreThisLegFor(
    this: ScoreTrainingPlayContext,
    seatRef: string,
  ): string;
  remainingLabel(this: ScoreTrainingPlayContext): string;
  threeDartAverage(this: ScoreTrainingPlayContext): string;
  dartsThrownThisLeg(this: ScoreTrainingPlayContext): number;
  previousScoreThisLeg(this: ScoreTrainingPlayContext): string;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  retryReconciliation(this: ScoreTrainingPlayContext): Promise<void>;
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
  confirmFinish(this: ScoreTrainingPlayContext): Promise<void>;
  cancelFinish(this: ScoreTrainingPlayContext): void;
  recordDart(
    this: ScoreTrainingPlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: ScoreTrainingPlayContext): void;
  uploadAndCompleteSession(this: ScoreTrainingPlayContext): Promise<void>;
  back(this: ScoreTrainingPlayContext): Promise<void>;
  playAgain(this: ScoreTrainingPlayContext): Promise<void>;
  abandonAndExit(this: ScoreTrainingPlayContext): Promise<void>;
  destroy(this: ScoreTrainingPlayContext): void;
};

export type TuodSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  attempts: number;
  successes: number;
  failures: number;
};

/** `winningSideKey` is score-compare (highest target) resolved by the
 * engine; `null` for a solo session or a TIE. `status` mirrors the engine's
 * own completion state, collapsed to just the two outcomes a finished
 * session can report: `COMPLETE` for a solo session or a decided 1v1 match,
 * `TIE` when both seats reached the same target — the only way callers can
 * tell a genuine tie apart from a solo session, since both leave
 * `winningSideKey` `null`. `seats` has one entry per configured seat (1 for
 * solo, 2 for 1v1), in `$store.game.seats` order. */
export type TuodResultsSnapshot = {
  winningSideKey: string | null;
  status: "COMPLETE" | "TIE";
  seats: TuodSeatResult[];
};

export type TuodPlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: TuodResultsSnapshot | null;
  pendingAttempt: TuodAttemptInput | null;
  pendingCheckoutScore: number | null;
  pendingDartObservation: DartObservation | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  showDoubleConfirm: boolean;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot>;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: TuodPlayContext): BoardMarker[];
  state(this: TuodPlayContext): TuodState | null;
  currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string;
  currentTargetLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions;
  submitVisit(this: TuodPlayContext): Promise<void>;
  confirmDouble(this: TuodPlayContext): Promise<void>;
  cancelCheckout(this: TuodPlayContext): void;
  recordAttempt(this: TuodPlayContext, input: TuodAttemptInput): Promise<void>;
  recordDart(
    this: TuodPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: TuodPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoVisit(this: TuodPlayContext): void;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  back(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
};

export type ScoreTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: ScoreTrainingDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  $watch(
    key: "durationType",
    callback: (value: ScoreTrainingDurationType) => void,
  ): void;
  init(this: ScoreTrainingSetupContext): Promise<void>;
  reconcile(
    this: ScoreTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: ScoreTrainingSetupContext): Promise<void>;
  continueSession(this: ScoreTrainingSetupContext): void;
  abandonSession(this: ScoreTrainingSetupContext): Promise<void>;
  selectMode(
    this: ScoreTrainingSetupContext,
    type: ScoreTrainingDurationType,
  ): void;
  presetForMode(
    this: ScoreTrainingSetupContext,
    type: ScoreTrainingDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: ScoreTrainingSetupContext): void;
  removeGuest(this: ScoreTrainingSetupContext, index: number): void;
  forceRoundsIfGuested(this: ScoreTrainingSetupContext): void;
  start(this: ScoreTrainingSetupContext): Promise<void>;
};

export type FiveOhOneStartingScoreOption = "301" | "501" | "701" | "CUSTOM";

export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  startingScoreOption: FiveOhOneStartingScoreOption;
  startingScoreValue: number | string | null;
  scoreClampNotice: string;
  legsToWin: number | string | null;
  legsClampNotice: string;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: FiveOhOneSetupContext): Promise<void>;
  reconcile(
    this: FiveOhOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: FiveOhOneSetupContext): Promise<void>;
  continueSession(this: FiveOhOneSetupContext): void;
  abandonSession(this: FiveOhOneSetupContext): Promise<void>;
  basePreset(this: FiveOhOneSetupContext): ConfigurationPresetData | undefined;
  addGuest(this: FiveOhOneSetupContext): void;
  removeGuest(this: FiveOhOneSetupContext, index: number): void;
  start(this: FiveOhOneSetupContext): Promise<void>;
};

/**
 * The setup-page contract every preset-driven game shares. Five games declare
 * exactly this shape (Bob's 27, Shanghai, Around the Clock, and — plus
 * an `orderMode` field — Singles and Doubles Training), which is why
 * `createPresetSetupController` can serve all five from one implementation.
 *
 * `501`, Score Training, and 121 (V2 onward) deliberately keep hand-written
 * contexts: each replaces `start` wholesale (preset selection, leg counts, a
 * clamped custom starting score or duration value), so routing them through
 * the factory would need one hook per branch. See
 * `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
 *
 * The `this` parameters name this base type rather than a self-type
 * parameter: `type X = PresetSetupContext<X>` is rejected by TypeScript
 * (TS2456, circular type alias), and the `interface X extends …` form that
 * would compile may not live in `types.ts` (D103 — interfaces raise through
 * the parallel `interfaces.ts` chain). No method body needs the concrete
 * type; only `configOverrides` does, and it takes it as a generic parameter.
 */
export type PresetSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: PresetSetupContext): Promise<void>;
  reconcile(
    this: PresetSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: PresetSetupContext): Promise<void>;
  continueSession(this: PresetSetupContext): void;
  abandonSession(this: PresetSetupContext): Promise<void>;
  addGuest(this: PresetSetupContext): void;
  removeGuest(this: PresetSetupContext, index: number): void;
  start(this: PresetSetupContext): Promise<void>;
};

/**
 * What `createPresetSetupController` needs to know about one game. Everything
 * here is a fact about the game and nothing here is a behaviour switch — the
 * exception, `configOverrides`, exists because Singles Training, Doubles
 * Training, and Shanghai (V2's difficulty toggle) each inject one player-
 * chosen field into both the config snapshot and the create-session
 * overrides; nothing else among the games still on this controller deviates
 * at all.
 *
 * `label` is not derived from a key. The shipped copy reads `Bob's 27`, not
 * `BOBS27`, and a derivation would silently reword a user-visible message.
 */
export type PresetSetupControllerOptions<Ctx extends PresetSetupContext> = {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  playHref: string;
  label: string;
  configOverrides?: (ctx: Ctx) => Record<string, unknown>;
};

export type Bobs27SetupContext = PresetSetupContext;

export type SinglesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
  difficulty: "EASY" | "HARD" | "EXTREME";
};

/** One seat's own results stats, replayed from its own completed visits in
 * `turns`. `legsWon` comes from `state().sides`, never counted from
 * `turns` directly — a stage exists per leg *played*, not per leg *won*.
 * `checkoutPercentage` is `null` for a QUICK_SCORE session (checkout %
 * cannot be computed without per-dart data,
 * `05-Database/06-Spec/04-Runtime-Layer.md`); for VISUAL_BOARD it is
 * `legsWon` over `legsWon + checkoutAttemptCount(seatTurns)`, formatted by
 * `accuracyDisplay` (Pattern 20). Score-band counts are exclusive
 * (D238/D242, Pattern 21) — a visit increments exactly one of
 * `sixtyPlus`/`hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties`,
 * never more than one. */
export type FiveOhOneSeatResult = {
  participantRef: string;
  sideKey: string;
  legsWon: number;
  threeDartAverage: string;
  checkoutPercentage: string | null;
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

/** `winningSideKey` is `null` for a solo session — 501 has no tie outcome
 * (double-out racing to a fixed leg count always decides a winner), unlike
 * Score Training's fixed-rounds format. `seats` has one entry per
 * configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type FiveOhOneResultsSnapshot = {
  winningSideKey: string | null;
  seats: FiveOhOneSeatResult[];
};

export type FiveOhOnePlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: FiveOhOneResultsSnapshot | null;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showMatchFinishConfirm: boolean;
  $store: PlayStoreContext<FiveOhOneSnapshot>;
  engine: FiveOhOneEngine | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: FiveOhOnePlayContext): BoardMarker[];
  turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[];
  state(this: FiveOhOnePlayContext): FiveOhOneState | null;
  remainingScoreFor(this: FiveOhOnePlayContext, seatRef: string): number;
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLegFor(this: FiveOhOnePlayContext, seatRef: string): number;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  averageFor(this: FiveOhOnePlayContext, seatRef: string): string;
  average(this: FiveOhOnePlayContext): string;
  matchTitle(this: FiveOhOnePlayContext): string;
  previousScoreFor(this: FiveOhOnePlayContext, seatRef: string): string;
  previousScore(this: FiveOhOnePlayContext): string;
  legsWonFor(this: FiveOhOnePlayContext, seatRef: string): number;
  checkoutDartOptions(this: FiveOhOnePlayContext): CheckoutDartOptions;
  init(this: FiveOhOnePlayContext): Promise<void>;
  retryReconciliation(this: FiveOhOnePlayContext): Promise<void>;
  submitVisit(this: FiveOhOnePlayContext): Promise<void>;
  confirmDouble(this: FiveOhOnePlayContext): Promise<void>;
  cancelCheckout(this: FiveOhOnePlayContext): void;
  confirmMatchFinish(this: FiveOhOnePlayContext): Promise<void>;
  cancelMatchFinish(this: FiveOhOnePlayContext): void;
  recordVisit(
    this: FiveOhOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  recordDart(
    this: FiveOhOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: FiveOhOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: FiveOhOnePlayContext): void;
  uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void>;
  resultsTitle(this: FiveOhOnePlayContext): string;
  back(this: FiveOhOnePlayContext): Promise<void>;
  playAgain(this: FiveOhOnePlayContext): Promise<void>;
  abandonAndExit(this: FiveOhOnePlayContext): Promise<void>;
};

/** `target` is each seat's own current ladder position at completion. */
export type OneTwentyOneSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  visits: number;
  average: number;
};

/** `attempt` is 1-indexed: which attempt at the winning target succeeded —
 * always the attempt whose 3rd-or-earlier visit checked out at 170.
 * `status` is `"WON"` only for a genuine cap-170 checkout; a ROUNDS/MINUTES
 * session that stopped without reaching the cap reports `"COMPLETE"`. `seats`
 * has one entry per configured seat (1 for solo, 2 for 1v1), in
 * `$store.game.seats` order. */
export type OneTwentyOneResultsSnapshot = {
  target: number;
  status: "WON" | "COMPLETE";
  winningSideKey: string | null;
  seats: OneTwentyOneSeatResult[];
};

export type OneTwentyOnePlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: OneTwentyOneResultsSnapshot | null;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showSessionFinishConfirm: boolean;
  $store: PlayStoreContext<OneTwentyOneSnapshot | OneTwentyOneV2Snapshot>;
  engine: OneTwentyOneEngine | null;
  timer: SegmentTimer | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: OneTwentyOnePlayContext): BoardMarker[];
  state(this: OneTwentyOnePlayContext): OneTwentyOneState | null;
  remainingInAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number;
  remainingInAttempt(this: OneTwentyOnePlayContext): number;
  currentTargetLabelFor(this: OneTwentyOnePlayContext, seatRef: string): string;
  currentTargetLabel(this: OneTwentyOnePlayContext): string;
  checkoutHint(this: OneTwentyOnePlayContext): string;
  visitsThisAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number;
  visitsThisAttempt(this: OneTwentyOnePlayContext): number;
  dartsThrownThisSession(this: OneTwentyOnePlayContext): number;
  durationType(this: OneTwentyOnePlayContext): OneTwentyOneDurationType;
  attemptLabel(this: OneTwentyOnePlayContext): string;
  remainingLabel(this: OneTwentyOnePlayContext): string;
  init(this: OneTwentyOnePlayContext): Promise<void>;
  retryReconciliation(this: OneTwentyOnePlayContext): Promise<void>;
  submitVisit(this: OneTwentyOnePlayContext): Promise<void>;
  confirmDouble(this: OneTwentyOnePlayContext): Promise<void>;
  cancelCheckout(this: OneTwentyOnePlayContext): void;
  confirmSessionFinish(this: OneTwentyOnePlayContext): Promise<void>;
  cancelSessionFinish(this: OneTwentyOnePlayContext): void;
  checkoutDartOptions(this: OneTwentyOnePlayContext): CheckoutDartOptions;
  recordVisit(
    this: OneTwentyOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  recordDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: OneTwentyOnePlayContext): void;
  uploadAndCompleteSession(this: OneTwentyOnePlayContext): Promise<void>;
  back(this: OneTwentyOnePlayContext): Promise<void>;
  playAgain(this: OneTwentyOnePlayContext): Promise<void>;
  abandonAndExit(this: OneTwentyOnePlayContext): Promise<void>;
  destroy(this: OneTwentyOnePlayContext): void;
};

/** One dart slot in Bob's 27's shared visit preview — a resolved hit/miss mark, or a not-yet-thrown placeholder. */
export type Bobs27PreviewSegment = { status: "hit" | "miss" | "empty" };

export type Bobs27SeatResult = {
  participantRef: string;
  sideKey: string;
  score: number;
  darts: number;
  doubleHitRate: string;
  highestNumberReached: string;
};

/** `status` mirrors the match-level `Bobs27State.status`, not any one seat's
 * own per-seat status — a seat that wins because its opponent busted first
 * never itself transitions to `"WON"`, so match-level status is the only
 * correct source for this field in a 1v1 session. `seats` has one entry per
 * configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type Bobs27ResultsSnapshot = {
  status: "WON" | "LOST" | "COMPLETE";
  winningSideKey: string | null;
  seats: Bobs27SeatResult[];
};

export type Bobs27PlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: Bobs27ResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<Bobs27Snapshot>;
  engine: Bobs27Engine | null;
  visitMarkers(this: Bobs27PlayContext): BoardMarker[];
  state(this: Bobs27PlayContext): Bobs27State | null;
  currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string;
  currentTargetLabel(this: Bobs27PlayContext): string;
  currentScoreFor(this: Bobs27PlayContext, seatRef: string): string;
  currentScore(this: Bobs27PlayContext): string;
  previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[];
  init(this: Bobs27PlayContext): Promise<void>;
  retryReconciliation(this: Bobs27PlayContext): Promise<void>;
  recordTap(this: Bobs27PlayContext, hit: boolean): Promise<void>;
  recordDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: Bobs27PlayContext): void;
  uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void>;
  back(this: Bobs27PlayContext): Promise<void>;
  playAgain(this: Bobs27PlayContext): Promise<void>;
  abandonAndExit(this: Bobs27PlayContext): Promise<void>;
};

/** One dart slot in Singles Training's visit preview — a resolved hit/miss mark (by training points, not board score), or a not-yet-thrown placeholder. */
export type SinglesPreviewSegment = { status: "hit" | "miss" | "empty" };

/** `status` is this seat's own outcome — asymmetric under HARD/EXTREME
 * elimination, where one seat can read `"LOST"` while the other reads
 * `"WON"` from the same match. `"COMPLETE"`/`"TIE"` are score-compare
 * outcomes and always agree between both seats. */
export type SinglesTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  points: number;
  misses: number;
  singles: number;
  doubles: number;
  trebles: number;
  accuracy: string;
  status: "COMPLETE" | "TIE" | "WON" | "LOST";
};

export type SinglesTrainingResultsSnapshot = {
  winningSideKey: string | null;
  seats: SinglesTrainingSeatResult[];
};

export type SinglesTrainingPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: SinglesTrainingResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<SinglesSnapshot | SinglesV2Snapshot>;
  engine: SinglesTrainingEngine | null;
  state(this: SinglesTrainingPlayContext): SinglesTrainingState | null;
  visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabelFor(
    this: SinglesTrainingPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
  currentPointsFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  currentPoints(this: SinglesTrainingPlayContext): string;
  isBullVisit(this: SinglesTrainingPlayContext): boolean;
  previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[];
  missCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  missCount(this: SinglesTrainingPlayContext): string;
  singleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  singleCount(this: SinglesTrainingPlayContext): string;
  doubleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  doubleCount(this: SinglesTrainingPlayContext): string;
  trebleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  trebleCount(this: SinglesTrainingPlayContext): string;
  init(this: SinglesTrainingPlayContext): Promise<void>;
  retryReconciliation(this: SinglesTrainingPlayContext): Promise<void>;
  recordTap(
    this: SinglesTrainingPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: SinglesTrainingPlayContext): void;
  uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void>;
  back(this: SinglesTrainingPlayContext): Promise<void>;
  playAgain(this: SinglesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: SinglesTrainingPlayContext): Promise<void>;
};

/** One dart slot in Doubles Training's visit preview — a resolved hit/miss mark (against the visit's own intended double/bull), or a not-yet-thrown placeholder. */
export type DoublesPreviewSegment = { status: "hit" | "miss" | "empty" };

export type DoublesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
};

export type ShanghaiSetupContext = PresetSetupContext & {
  difficulty: "NORMAL" | "HARD";
};

/**
 * 121 keeps a hand-written setup context, like `501`/Score Training, rather
 * than `PresetSetupContext`: `121_V2` needs a TARGET/ROUNDS/MINUTES picker
 * with a clamped `duration_value`, the same shape Score Training's own
 * hand-written context already carries.
 */
export type OneTwentyOneSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: OneTwentyOneDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  $watch(
    key: "durationType",
    callback: (value: OneTwentyOneDurationType) => void,
  ): void;
  init(this: OneTwentyOneSetupContext): Promise<void>;
  reconcile(
    this: OneTwentyOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: OneTwentyOneSetupContext): Promise<void>;
  continueSession(this: OneTwentyOneSetupContext): void;
  abandonSession(this: OneTwentyOneSetupContext): Promise<void>;
  selectMode(
    this: OneTwentyOneSetupContext,
    type: OneTwentyOneDurationType,
  ): void;
  presetForMode(
    this: OneTwentyOneSetupContext,
    type: OneTwentyOneDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: OneTwentyOneSetupContext): void;
  removeGuest(this: OneTwentyOneSetupContext, index: number): void;
  forceTargetIfGuested(this: OneTwentyOneSetupContext): void;
  start(this: OneTwentyOneSetupContext): Promise<void>;
};

export type AroundTheClockSetupContext = PresetSetupContext;

export type DoublesTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  hits: number;
  on1st: number;
  on2nd: number;
  on3rd: number;
  accuracy: string;
  misses: number;
};

export type DoublesTrainingResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: DoublesTrainingSeatResult[];
};

export type DoublesTrainingPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: DoublesTrainingResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  state(this: DoublesTrainingPlayContext): DoublesTrainingState | null;
  visitMarkers(this: DoublesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabelFor(
    this: DoublesTrainingPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
  hitCountFor(this: DoublesTrainingPlayContext, seatRef: string): string;
  hitCount(this: DoublesTrainingPlayContext): string;
  missCountFor(this: DoublesTrainingPlayContext, seatRef: string): string;
  missCount(this: DoublesTrainingPlayContext): string;
  previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[];
  init(this: DoublesTrainingPlayContext): Promise<void>;
  retryReconciliation(this: DoublesTrainingPlayContext): Promise<void>;
  recordTap(this: DoublesTrainingPlayContext, hit: boolean): Promise<void>;
  commitDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: DoublesTrainingPlayContext): void;
  uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void>;
  back(this: DoublesTrainingPlayContext): Promise<void>;
  playAgain(this: DoublesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: DoublesTrainingPlayContext): Promise<void>;
};

/** One dart slot in Shanghai's visit preview — a resolved hit/miss mark (against the round's own number), or a not-yet-thrown placeholder. */
export type ShanghaiPreviewSegment = { status: "hit" | "miss" | "empty" };

/** One seat's own results stats. `round` is 1-indexed: the round that seat
 * ended on — always 20 for a `COMPLETE`/`TIE` session, the round the
 * Shanghai landed on for a `SHANGHAI` one (the losing seat in a
 * Shanghai-ending 1v1 session may show an earlier round, if the match ended
 * before its own turn came back around). `accuracy` is that seat's hits
 * (darts landing on its own round's assigned number) over darts thrown,
 * formatted as a percentage, `"0%"` when it never threw a dart (e.g. the
 * losing seat in a 1v1 session that ended on the opening seat's own
 * round-1 Shanghai). `trebles`/`doubles`/`singles` are raw zone tallies
 * over every dart that seat threw, independent of whether it hit that
 * round's own target — a bull hit or a miss increments none of the three. */
export type ShanghaiSeatResult = {
  participantRef: string;
  sideKey: string;
  score: number;
  round: number;
  accuracy: string;
  trebles: number;
  doubles: number;
  singles: number;
};

/** `status` mirrors the match-level `ShanghaiState.status`, not any one
 * seat's own status — a solo session's own status and the match status
 * always coincide, but only the match status can read `TIE`. `seats` has
 * one entry per configured seat (1 for solo, 2 for 1v1), in the same order
 * `$store.game.seats` is already in. */
export type ShanghaiResultsSnapshot = {
  status: "SHANGHAI" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ShanghaiSeatResult[];
};

export type ShanghaiPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: ShanghaiResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<ShanghaiSnapshot | ShanghaiV2Snapshot>;
  engine: ShanghaiEngine | null;
  visitMarkers(this: ShanghaiPlayContext): BoardMarker[];
  recordDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  state(this: ShanghaiPlayContext): ShanghaiState | null;
  currentTargetLabelFor(this: ShanghaiPlayContext, seatRef: string): string;
  currentTargetLabel(this: ShanghaiPlayContext): string;
  roundLabelFor(this: ShanghaiPlayContext, seatRef: string): string;
  roundLabel(this: ShanghaiPlayContext): string;
  currentScoreFor(this: ShanghaiPlayContext, seatRef: string): string;
  currentScore(this: ShanghaiPlayContext): string;
  isBullVisit(this: ShanghaiPlayContext): boolean;
  previewSegments(this: ShanghaiPlayContext): ShanghaiPreviewSegment[];
  init(this: ShanghaiPlayContext): Promise<void>;
  retryReconciliation(this: ShanghaiPlayContext): Promise<void>;
  recordTap(
    this: ShanghaiPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: ShanghaiPlayContext): void;
  uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void>;
  back(this: ShanghaiPlayContext): Promise<void>;
  playAgain(this: ShanghaiPlayContext): Promise<void>;
  abandonAndExit(this: ShanghaiPlayContext): Promise<void>;
};

/** One dart slot in Around the Clock's visit preview — a resolved hit/miss mark, or a not-yet-thrown placeholder. Every tap this game's recreational input renders is relative to whatever target was active the instant it was thrown, so a non-MISS tap is always a hit — but a VISUAL_BOARD dart can land on any number, so hit/miss is resolved by replaying the target-progression rules (`isAroundTheClockHit`), the same way Shanghai's preview does. */
export type AroundTheClockPreviewSegment = {
  status: "hit" | "miss" | "empty";
};

/** One seat's own results stats, replayed from its own completed turns.
 * `accuracy` is genuine target hits over darts thrown, formatted as a
 * percentage rounded to 2 decimals. */
export type AroundTheClockSeatResult = {
  participantRef: string;
  sideKey: string;
  turns: number;
  accuracy: string;
  totalDarts: number;
};

/** `winningSideKey` is score-compare (fewest darts) resolved by the engine;
 * `null` for a solo session or a TIE. `status` mirrors the engine's own
 * completion state: `COMPLETE` for a solo session or a decided 1v1 match,
 * `TIE` when both seats finished in the same number of darts — the only way
 * callers can tell a genuine tie apart from a solo session, since both leave
 * `winningSideKey` `null`. `seats` has one entry per configured seat (1 for
 * solo, 2 for 1v1), in `$store.game.seats` order. */
export type AroundTheClockResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: AroundTheClockSeatResult[];
};

export type AroundTheClockPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: AroundTheClockResultsSnapshot | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<AroundTheClockSnapshot>;
  engine: AroundTheClockEngine | null;
  visitMarkers(this: AroundTheClockPlayContext): BoardMarker[];
  recordDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  state(this: AroundTheClockPlayContext): AroundTheClockState | null;
  activeSeatState(
    this: AroundTheClockPlayContext,
  ): AroundTheClockSeatState | null;
  currentTargetLabelFor(
    this: AroundTheClockPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: AroundTheClockPlayContext): string;
  turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string;
  turnsSoFar(this: AroundTheClockPlayContext): string;
  accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string;
  accuracy(this: AroundTheClockPlayContext): string;
  isBullVisit(this: AroundTheClockPlayContext): boolean;
  previewSegments(
    this: AroundTheClockPlayContext,
  ): AroundTheClockPreviewSegment[];
  init(this: AroundTheClockPlayContext): Promise<void>;
  retryReconciliation(this: AroundTheClockPlayContext): Promise<void>;
  recordTap(
    this: AroundTheClockPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: AroundTheClockPlayContext): void;
  uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void>;
  back(this: AroundTheClockPlayContext): Promise<void>;
  playAgain(this: AroundTheClockPlayContext): Promise<void>;
  abandonAndExit(this: AroundTheClockPlayContext): Promise<void>;
};

/**
 * Games-page state. `activeRulesetKeys` holds every ACTIVE session's ruleset,
 * not one: the single-active-session index keys on `(player_id, game_type_id)`,
 * so one session per game type can be running at the same time.
 */
export type GamesIndexContext = {
  activeRulesetKeys: string[];
  $store: {
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: GamesIndexContext): Promise<void>;
  isVisible(
    this: GamesIndexContext,
    rulesetVersionKey: RulesetVersionKey,
  ): boolean;
  analyticsMode(this: GamesIndexContext): boolean;
  noneVisible(this: GamesIndexContext): boolean;
};

/** The guest-list state every setup screen's add-a-guest modal drives. */
export type GuestListContext = {
  guests: { displayName: string }[];
  newGuestName: string;
  showAddGuestModal: boolean;
};
