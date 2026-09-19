import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState, RoutineStepSummary } from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { SessionClock } from "@modules/ui/session-clock.module";
import type {
  StartTrainingResponseData,
  StartTrainingStepResponseData,
  RoutineSummaryData,
  RoutineExecutionData,
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

export type RoutinePlayContext = {
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
  init(this: RoutinePlayContext): Promise<void>;
  currentStep(this: RoutinePlayContext): TrainingStepResolved | null;
  buildWarmUpEngine(
    this: RoutinePlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildSwitchingEngine(
    this: RoutinePlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildDoublePatternEngine(
    this: RoutinePlayContext,
    configuration: Record<string, unknown>,
  ): void;
  startFinishingStep(
    this: RoutinePlayContext,
    result: StartTrainingStepResponseData,
  ): void;
  startCurrentStep(this: RoutinePlayContext): Promise<void>;
  openStep(
    this: RoutinePlayContext,
    result: StartTrainingStepResponseData,
    durationSeconds: number,
  ): void;
  resolveBlockingSession(this: RoutinePlayContext): Promise<void>;
  blockingStartedLabel(this: RoutinePlayContext): string;
  startSessionClock(this: RoutinePlayContext): void;
  stopSessionClock(this: RoutinePlayContext): void;
  confirmWarmUpReady(this: RoutinePlayContext): void;
  startWarmUpTimer(
    this: RoutinePlayContext,
    configuration: Record<string, unknown>,
  ): void;
  formattedWarmUpElapsed(this: RoutinePlayContext): string;
  warmUpHighlightPath(this: RoutinePlayContext): string;
  startStepTimer(this: RoutinePlayContext, durationSeconds: number): void;
  formattedStepRemaining(this: RoutinePlayContext): string;
  switchingPoints(this: RoutinePlayContext): number;
  switchingTargetLabel(this: RoutinePlayContext): string;
  doublePatternPoints(this: RoutinePlayContext): number;
  doublePatternLabel(this: RoutinePlayContext): string;
  dartsThrown(this: RoutinePlayContext): number;
  activeDartEngine(
    this: RoutinePlayContext,
  ): SwitchingEngine | DoublePatternEngine | null;
  visitMarkers(this: RoutinePlayContext): BoardMarker[];
  previewSegments(this: RoutinePlayContext): PreviewSegment[];
  recordSwitchingDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordDoublePatternDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: RoutinePlayContext): void;
  uploadCurrentStepFacts(this: RoutinePlayContext): Promise<void>;
  completeCurrentStep(this: RoutinePlayContext): Promise<void>;
  captureStepSummary(this: RoutinePlayContext): void;
  completeRoutine(this: RoutinePlayContext): Promise<void>;
  dismissSummary(this: RoutinePlayContext): void;
  abandonAndExit(this: RoutinePlayContext): Promise<void>;
};

export type TrainingSessionStoreContext = ReturnType<
  typeof trainingSessionStore
>;

export type TrainingIndexContext = {
  loading: boolean;
  error: string;
  routines: RoutineSummaryData[];
  init(this: TrainingIndexContext): Promise<void>;
  durationLabel(routine: RoutineSummaryData): string;
  detailHref(routine: RoutineSummaryData): string;
};

export type RoutineDetailContext = {
  loading: boolean;
  error: string;
  routine: RoutineExecutionData | null;
  deleting: boolean;
  deleteBusy: boolean;
  starting: boolean;
  navigate(path: string): void;
  init(this: RoutineDetailContext): Promise<void>;
  durationLabel(this: RoutineDetailContext): string;
  stepDuration(step: RoutineExecutionData["steps"][number]): string;
  canEdit(this: RoutineDetailContext): boolean;
  playPath(this: RoutineDetailContext): string;
  editPath(this: RoutineDetailContext): string;
  start(this: RoutineDetailContext): void;
  requestDelete(this: RoutineDetailContext): void;
  cancelDelete(this: RoutineDetailContext): void;
  confirmDelete(this: RoutineDetailContext): Promise<void>;
};
