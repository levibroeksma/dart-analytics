import type { ConfigurationPresetData } from "@client/api/configuration-templates";
import type { SessionActiveData } from "@client/api/types";
import type { ScoreInputBuffer } from "@modules/game/score-input.module";
import type { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import type { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";
import type { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import type { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import type { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import type {
  BoardCoordinate,
  DartObservation,
  EngineFacts,
  MagnifierPlacement,
  StageFact,
  TurnFact,
} from "@modules/types";
import type { BoardHit } from "./board/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
  DoublesTrainingSnapshot,
} from "./rulesets/types";

export * from "./rulesets/types";
export * from "./board/types";

export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";

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
 */
export type PlayStoreContext<TConfig> = {
  game: {
    rulesetVersionKey: RulesetVersionKey | null;
    sessionId: string | null;
    participantRef: string | null;
    templateRef: string | null;
    configSnapshot: TConfig | null;
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
  $store: PlayStoreContext<TConfig>;
  engine: TEngine | null;
  init(): Promise<void>;
  uploadAndCompleteSession(): Promise<void>;
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
  resultsSnapshot: { total: number; visits: number; average: number } | null;
  pendingFinishScore: number | null;
  pendingDartObservation: DartObservation | null;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<ScoreTrainingSnapshot>;
  engine: ScoreTrainingEngine | null;
  timer: SegmentTimer | null;
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
  start(this: FiveOhOneSetupContext): Promise<void>;
};

export type Bobs27SetupContext = {
  presets: ConfigurationPresetData[];
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
  init(this: Bobs27SetupContext): Promise<void>;
  reconcile(
    this: Bobs27SetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: Bobs27SetupContext): Promise<void>;
  continueSession(this: Bobs27SetupContext): void;
  abandonSession(this: Bobs27SetupContext): Promise<void>;
  start(this: Bobs27SetupContext): Promise<void>;
};

export type SinglesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
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
  init(this: SinglesTrainingSetupContext): Promise<void>;
  reconcile(
    this: SinglesTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: SinglesTrainingSetupContext): Promise<void>;
  continueSession(this: SinglesTrainingSetupContext): void;
  abandonSession(this: SinglesTrainingSetupContext): Promise<void>;
  start(this: SinglesTrainingSetupContext): Promise<void>;
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
  resultsSnapshot: { total: number; legs: number; average: number } | null;
  pendingCheckoutScore: number | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showMatchFinishConfirm: boolean;
  $store: PlayStoreContext<FiveOhOneSnapshot>;
  engine: FiveOhOneEngine | null;
  turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[];
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  average(this: FiveOhOnePlayContext): string;
  previousScore(this: FiveOhOnePlayContext): string;
  init(this: FiveOhOnePlayContext): Promise<void>;
  retryReconciliation(this: FiveOhOnePlayContext): Promise<void>;
  submitVisit(this: FiveOhOnePlayContext): Promise<void>;
  confirmDouble(this: FiveOhOnePlayContext): Promise<void>;
  denyDouble(this: FiveOhOnePlayContext): Promise<void>;
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
  back(this: FiveOhOnePlayContext): Promise<void>;
  playAgain(this: FiveOhOnePlayContext): Promise<void>;
  abandonAndExit(this: FiveOhOnePlayContext): Promise<void>;
};

/** One dart slot in Bob's 27's shared visit preview — a resolved hit/miss mark, or a not-yet-thrown placeholder. */
export type Bobs27PreviewSegment = { status: "hit" | "miss" | "empty" };

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
  resultsSnapshot: {
    status: "WON" | "LOST";
    score: number;
    darts: number;
  } | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<Bobs27Snapshot>;
  engine: Bobs27Engine | null;
  visitMarkers(this: Bobs27PlayContext): BoardMarker[];
  currentTargetLabel(this: Bobs27PlayContext): string;
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
  resultsSnapshot: { points: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<SinglesSnapshot>;
  engine: SinglesTrainingEngine | null;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
  currentPoints(this: SinglesTrainingPlayContext): string;
  isBullVisit(this: SinglesTrainingPlayContext): boolean;
  previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[];
  missCount(this: SinglesTrainingPlayContext): string;
  singleCount(this: SinglesTrainingPlayContext): string;
  doubleCount(this: SinglesTrainingPlayContext): string;
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

export type DoublesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
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
  init(this: DoublesTrainingSetupContext): Promise<void>;
  reconcile(
    this: DoublesTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: DoublesTrainingSetupContext): Promise<void>;
  continueSession(this: DoublesTrainingSetupContext): void;
  abandonSession(this: DoublesTrainingSetupContext): Promise<void>;
  start(this: DoublesTrainingSetupContext): Promise<void>;
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
  resultsSnapshot: { hits: number; misses: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
  hitCount(this: DoublesTrainingPlayContext): string;
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
