import type { ConfigurationPresetData } from "@client/api/configuration-templates";
import type { SessionActiveData } from "@client/api/types";
import type { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { GameConfigSnapshot, RecordedTurn } from "@stores/types";

export type ScoreTrainingPlayContext = {
  visitInput: string;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  resultsSnapshot: { total: number; visits: number; average: number } | null;
  $store: {
    game: {
      sessionId: string | null;
      participantRef: string | null;
      configSnapshot: GameConfigSnapshot | null;
      turns: RecordedTurn[];
      timerRemainingMs?: number | null;
      timerStartedAt?: string | null;
      timerExpired?: boolean;
      idempotencyKey?: string | null;
      recordTurn(turn: RecordedTurn): void;
      reset(): void;
    };
  };
  engine: ScoreTrainingEngine | null;
  timer: SegmentTimer | null;
  remainingLabel(this: ScoreTrainingPlayContext): string;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  retryReconciliation(this: ScoreTrainingPlayContext): Promise<void>;
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
  uploadAndCompleteSession(this: ScoreTrainingPlayContext): Promise<void>;
  back(this: ScoreTrainingPlayContext): Promise<void>;
  playAgain(this: ScoreTrainingPlayContext): Promise<void>;
  destroy(this: ScoreTrainingPlayContext): void;
};

export type ScoreTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  selectedTemplateId: string;
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
  };
  init(this: ScoreTrainingSetupContext): Promise<void>;
  reconcile(this: ScoreTrainingSetupContext, activeSessions: SessionActiveData[]): Promise<void>;
  retryReconciliation(this: ScoreTrainingSetupContext): Promise<void>;
  continueSession(this: ScoreTrainingSetupContext): void;
  abandonSession(this: ScoreTrainingSetupContext): Promise<void>;
  start(this: ScoreTrainingSetupContext): Promise<void>;
};
