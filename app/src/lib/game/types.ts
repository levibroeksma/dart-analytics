import type { ConfigurationPresetData } from "@client/api/configuration-templates";
import type { SessionActiveData } from "@client/api/types";
import type { ScoreInputBuffer } from "@modules/game/score-input.module";
import type { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import type { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";
import type {
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
} from "./rulesets/types";

export * from "./rulesets/types";
export * from "./board/types";

export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";

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
  $store: {
    game: {
      rulesetVersionKey: RulesetVersionKey | null;
      sessionId: string | null;
      participantRef: string | null;
      templateRef: string | null;
      configSnapshot: ScoreTrainingSnapshot | null;
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

export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  legsToWin: number | string | null;
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
  $store: {
    game: {
      rulesetVersionKey: RulesetVersionKey | null;
      sessionId: string | null;
      participantRef: string | null;
      templateRef: string | null;
      configSnapshot: FiveOhOneSnapshot | null;
      captureModeKey: string | null;
      inputModeKey: string | null;
      stages: StageFact[];
      turns: TurnFact[];
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
  engine: FiveOhOneEngine | null;
  turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[];
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  averageThisLeg(this: FiveOhOnePlayContext): string;
  previousScoreThisLeg(this: FiveOhOnePlayContext): string;
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
