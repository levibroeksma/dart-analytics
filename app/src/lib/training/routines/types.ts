import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type {
  WarmUpState,
  RoutineStepSummary,
  RoutineDurationResult,
} from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { SessionClock } from "@modules/ui/session-clock.module";
import type {
  StartTrainingResponseData,
  StartTrainingStepResponseData,
  RoutineSummaryData,
  RoutineExecutionData,
  ExerciseTemplateCatalogEntryData,
} from "@client/api/types";
import type { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import type { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import type { DartObservation } from "@modules/types";
import type { BoardMarker, PreviewSegment } from "@lib/types";
import type { gameStep } from "./game-step.data";
import type { StepAdapter } from "./adapters/interfaces";
import type { trainingSessionStore } from "@stores/training-session.store";

export * from "./adapters/types";

export type TrainingStepResolved = StartTrainingResponseData["steps"][number];

export type BlockingSession = {
  sessionId: string;
  startedAt: string | null;
};

/**
 * What `gameStep()` needs from whichever game's own play store it wraps —
 * the record → mirror → complete cycle's completion status, the countdown
 * (some games run no timer), and the two lifecycle methods it overrides.
 * Deliberately narrower than `PlayLifecycleContext`: `gameStep` is generic
 * over every routine-eligible game, and this is the only shape all three
 * (TUOD, Score Training, 121) actually share at the type level.
 */
export type GameStepPlayContext = {
  completionStatus: string;
  timer?: { stop(): void } | null;
  uploadAndCompleteSession(): Promise<void>;
  abandonAndExit(): Promise<void>;
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
  adapter: StepAdapter | null;
  game: ReturnType<typeof gameStep> | null;
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

/** One row of `routineBuilder()`'s ordered step list. */
export type BuilderStep = {
  exerciseTemplateId: string;
  name: string;
  exerciseTypeKey: string;
  durationValue: number;
};

/**
 * Hand-written rather than `ReturnType<typeof routineBuilder>`: every method
 * below already types its own `this` as `RoutineBuilderContext`, so deriving
 * the type from the factory's return value is circular (ts(2456)).
 */
export type RoutineBuilderContext = {
  mode: "create" | "edit";
  routineId: string | null;
  loading: boolean;
  saving: boolean;
  error: string;
  serverIssues: string[];
  name: string;
  description: string;
  catalog: ExerciseTemplateCatalogEntryData[];
  steps: BuilderStep[];
  minMinutes: number;
  maxMinutes: number;
  maxSteps: number;
  stepMinMinutes: number;
  stepMaxMinutes: number;
  maxNameLength: number;
  navigate(path: string): void;
  init(this: RoutineBuilderContext): Promise<void>;
  loadExisting(this: RoutineBuilderContext): Promise<void>;
  addStep(
    this: RoutineBuilderContext,
    entry: ExerciseTemplateCatalogEntryData,
  ): void;
  removeStep(this: RoutineBuilderContext, index: number): void;
  moveUp(this: RoutineBuilderContext, index: number): void;
  moveDown(this: RoutineBuilderContext, index: number): void;
  setMinutes(this: RoutineBuilderContext, index: number, value: number): void;
  durationResult(this: RoutineBuilderContext): RoutineDurationResult;
  totalMinutes(this: RoutineBuilderContext): number;
  gameStepIssues(this: RoutineBuilderContext): string[];
  durationIssues(this: RoutineBuilderContext): string[];
  nameValid(this: RoutineBuilderContext): boolean;
  canSave(this: RoutineBuilderContext): boolean;
  payload(this: RoutineBuilderContext): {
    name: string;
    description: string | null;
    steps: {
      exerciseTemplateId: string;
      durationTypeKey: "MINUTES";
      durationValue: number;
    }[];
  };
  save(this: RoutineBuilderContext): Promise<void>;
  cancel(this: RoutineBuilderContext): void;
};
