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
  ShanghaiSnapshot,
  OneTwentyOneSnapshot,
  AroundTheClockSnapshot,
  TuodSnapshot,
} from "./rulesets/types";

export * from "./rulesets/types";
export * from "./board/types";

export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";

export type TuodDurationType = "ROUNDS" | "MINUTES";

export type TuodSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: TuodDurationType;
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
  init(this: TuodSetupContext): Promise<void>;
  reconcile(
    this: TuodSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: TuodSetupContext): Promise<void>;
  continueSession(this: TuodSetupContext): void;
  abandonSession(this: TuodSetupContext): Promise<void>;
  presetForMode(
    this: TuodSetupContext,
    type: TuodDurationType,
  ): ConfigurationPresetData | undefined;
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

export type TuodResultsSnapshot = {
  target: number;
  attempts: number;
  successes: number;
  failures: number;
};

export type TuodPlayContext = {
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
  pendingAttempt: boolean | null;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot>;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  currentTargetLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  recordAttempt(this: TuodPlayContext, checkedOut: boolean): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoAttempt(this: TuodPlayContext): void;
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

/**
 * The setup-page contract every preset-driven game shares. Six games declare
 * exactly this shape (Bob's 27, Shanghai, 121, Around the Clock, and — plus
 * an `orderMode` field — Singles and Doubles Training), which is why
 * `createPresetSetupController` can serve all six from one implementation.
 *
 * `501` and Score Training deliberately keep hand-written contexts: both
 * replace `start` wholesale (preset selection, leg counts, a clamped custom
 * starting score), so routing them through the factory would need one hook
 * per branch. See `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
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
  start(this: PresetSetupContext): Promise<void>;
};

/**
 * What `createPresetSetupController` needs to know about one game. Everything
 * here is a fact about the game and nothing here is a behaviour switch — the
 * single exception, `configOverrides`, exists because Singles and Doubles
 * Training inject their chosen target order into both the config snapshot and
 * the create-session overrides, and nothing else in the six deviates at all.
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

/** `attempt` is 1-indexed: which attempt at the winning target succeeded — always the attempt whose 3rd-or-earlier visit checked out at 170. */
export type OneTwentyOneResultsSnapshot = {
  target: number;
  visits: number;
  average: number;
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
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showSessionFinishConfirm: boolean;
  $store: PlayStoreContext<OneTwentyOneSnapshot>;
  engine: OneTwentyOneEngine | null;
  remainingInAttempt(this: OneTwentyOnePlayContext): number;
  currentTargetLabel(this: OneTwentyOnePlayContext): string;
  checkoutHint(this: OneTwentyOnePlayContext): string;
  visitsThisAttempt(this: OneTwentyOnePlayContext): number;
  dartsThrownThisSession(this: OneTwentyOnePlayContext): number;
  init(this: OneTwentyOnePlayContext): Promise<void>;
  retryReconciliation(this: OneTwentyOnePlayContext): Promise<void>;
  submitVisit(this: OneTwentyOnePlayContext): Promise<void>;
  confirmDouble(this: OneTwentyOnePlayContext): Promise<void>;
  denyDouble(this: OneTwentyOnePlayContext): Promise<void>;
  cancelCheckout(this: OneTwentyOnePlayContext): void;
  confirmSessionFinish(this: OneTwentyOnePlayContext): Promise<void>;
  cancelSessionFinish(this: OneTwentyOnePlayContext): void;
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
    doubleHitRate: string;
    highestNumberReached: string;
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
  resultsSnapshot: {
    points: number;
    misses: number;
    singles: number;
    doubles: number;
    trebles: number;
    hitPercentage: string;
  } | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<SinglesSnapshot>;
  engine: SinglesTrainingEngine | null;
  visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
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

export type DoublesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
};

export type ShanghaiSetupContext = PresetSetupContext;

export type OneTwentyOneSetupContext = PresetSetupContext;

export type AroundTheClockSetupContext = PresetSetupContext;

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
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  visitMarkers(this: DoublesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
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

/** One dart slot in Shanghai's visit preview — a resolved hit/miss mark (against the round's own number), or a not-yet-thrown placeholder. */
export type ShanghaiPreviewSegment = { status: "hit" | "miss" | "empty" };

/** `round` is 1-indexed: the round the session ended on — always 20 for a `COMPLETE` session, the round the Shanghai landed on for a `SHANGHAI` one. */
export type ShanghaiResultsSnapshot = {
  score: number;
  status: "SHANGHAI" | "COMPLETE";
  round: number;
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
  $store: PlayStoreContext<ShanghaiSnapshot>;
  engine: ShanghaiEngine | null;
  visitMarkers(this: ShanghaiPlayContext): BoardMarker[];
  recordDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabel(this: ShanghaiPlayContext): string;
  roundLabel(this: ShanghaiPlayContext): string;
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

/** `turns` is the number of visits the session took to complete. `accuracy`/`totalDarts` are folded from the fact log at completion time, never accumulated by the engine. `accuracy` is genuine target hits over darts thrown, formatted as a percentage rounded to 2 decimals. */
export type AroundTheClockResultsSnapshot = {
  turns: number;
  accuracy: string;
  totalDarts: number;
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
  currentTargetLabel(this: AroundTheClockPlayContext): string;
  turnsSoFar(this: AroundTheClockPlayContext): string;
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
