import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState, RoutineStepSummary } from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { SessionClock } from "@modules/ui/session-clock.module";
import type {
  StartTrainingResponseData,
  StartTrainingStepResponseData,
} from "@client/api/types";
import type { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import type { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import type { DartObservation } from "@modules/types";
import type { BoardMarker, PreviewSegment } from "@lib/types";
import type { finishingStep } from "./finishing-step.data";
import type { trainingSessionStore } from "@stores/training-session.store";

export type TrainingStepResolved = StartTrainingResponseData["steps"][number];

export type TrainingStepKey = TrainingStepResolved["exerciseTypeKey"];

export type BlockingSession = {
  sessionId: string;
  startedAt: string | null;
};

export type BalancedTrainingPlayContext = {
  loading: boolean;
  error: string;
  activityId: string | null;
  steps: TrainingStepResolved[];
  currentSessionId: string | null;
  currentParticipantRef: string | null;
  training: TrainingEngine | null;
  warmUpEngine: ExerciseEngine<WarmUpState> | null;
  switchingEngine: SwitchingEngine | null;
  doublePatternEngine: DoublePatternEngine | null;
  stepTimer: SegmentTimer | null;
  stepRemainingSeconds: number;
  warmUpTimer: SegmentTimer | null;
  warmUpElapsedSeconds: number;
  warmUpReady: boolean;
  warmUpConfiguration: Record<string, unknown> | null;
  finishing: ReturnType<typeof finishingStep> | null;
  sessionClock: SessionClock | null;
  blockingSession: BlockingSession | null;
  blockingError: string;
  resolvingBlockingSession: boolean;
  stepSummaries: RoutineStepSummary[];
  routineFinished: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  $store: {
    game: {
      loading: boolean;
      reset(): void;
      startSession(input: unknown): void;
    };
    trainingSession: TrainingSessionStoreContext;
  };
  init(this: BalancedTrainingPlayContext): Promise<void>;
  currentStep(this: BalancedTrainingPlayContext): TrainingStepResolved | null;
  buildWarmUpEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildSwitchingEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildDoublePatternEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  startFinishingStep(
    this: BalancedTrainingPlayContext,
    result: StartTrainingStepResponseData,
  ): void;
  startCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  openStep(
    this: BalancedTrainingPlayContext,
    result: StartTrainingStepResponseData,
    durationSeconds: number,
  ): void;
  resolveBlockingSession(this: BalancedTrainingPlayContext): Promise<void>;
  blockingStartedLabel(this: BalancedTrainingPlayContext): string;
  startSessionClock(this: BalancedTrainingPlayContext): void;
  stopSessionClock(this: BalancedTrainingPlayContext): void;
  confirmWarmUpReady(this: BalancedTrainingPlayContext): void;
  startWarmUpTimer(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string;
  warmUpHighlightPath(this: BalancedTrainingPlayContext): string;
  startStepTimer(
    this: BalancedTrainingPlayContext,
    durationSeconds: number,
  ): void;
  formattedStepRemaining(this: BalancedTrainingPlayContext): string;
  switchingPoints(this: BalancedTrainingPlayContext): number;
  switchingTargetLabel(this: BalancedTrainingPlayContext): string;
  doublePatternPoints(this: BalancedTrainingPlayContext): number;
  doublePatternLabel(this: BalancedTrainingPlayContext): string;
  dartsThrown(this: BalancedTrainingPlayContext): number;
  activeDartEngine(
    this: BalancedTrainingPlayContext,
  ): SwitchingEngine | DoublePatternEngine | null;
  visitMarkers(this: BalancedTrainingPlayContext): BoardMarker[];
  previewSegments(this: BalancedTrainingPlayContext): PreviewSegment[];
  recordSwitchingDart(
    this: BalancedTrainingPlayContext,
    observation: DartObservation,
  ): void;
  recordDoublePatternDart(
    this: BalancedTrainingPlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: BalancedTrainingPlayContext): void;
  uploadCurrentStepFacts(this: BalancedTrainingPlayContext): Promise<void>;
  completeCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  captureStepSummary(this: BalancedTrainingPlayContext): void;
  completeRoutine(this: BalancedTrainingPlayContext): Promise<void>;
  dismissSummary(this: BalancedTrainingPlayContext): void;
  abandonAndExit(this: BalancedTrainingPlayContext): Promise<void>;
};

export type TrainingSessionStoreContext = ReturnType<
  typeof trainingSessionStore
>;
