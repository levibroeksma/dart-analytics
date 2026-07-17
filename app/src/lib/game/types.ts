import type { ConfigurationPresetData } from "@client/api/configuration-templates";
import type { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { GameConfigSnapshot, RecordedTurn } from "@stores/types";

export type ScoreTrainingPlayContext = {
  visitInput: string;
  error: string;
  completionFailed: boolean;
  finished: boolean;
  hasActiveSession: boolean;
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
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
  retryCompletion(this: ScoreTrainingPlayContext): Promise<void>;
  destroy(this: ScoreTrainingPlayContext): void;
};

export type ScoreTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  selectedTemplateId: string;
  loading: boolean;
  error: string;
  $store: { game: { startSession(input: unknown): void } };
  init(): Promise<void>;
  start(this: ScoreTrainingSetupContext): Promise<void>;
};
