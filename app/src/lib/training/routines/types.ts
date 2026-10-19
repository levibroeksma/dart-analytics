import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type {
  WarmUpState,
  RoutineStepSummary,
  RoutineDurationResult,
  SessionContextRow,
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
import type { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import type { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import type { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import type { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import type { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import type { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import type { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import type { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import type { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import type { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import type { DartFact, DartObservation } from "@modules/types";
import type {
  BoardMarker,
  CatalogTag,
  CatalogTagsResponse,
  PreviewSegment,
  SectionRingPaths,
} from "@lib/types";
import type { gameStep } from "./game-step.data";
import type { StepAdapter } from "./adapters/interfaces";
import type { trainingSessionStore } from "@stores/training-session.store";
import type { routineStatsStore } from "@stores/routine-stats.store";

export * from "./adapters/types";

/** How a thrown exercise dart reads in the visit preview. */
export type DartJudgement = "hit" | "miss" | "value";

/** The preview rules an exercise follows: how its darts are judged and its empty slots captioned. */
export type ExercisePreviewFamily =
  | "switching"
  | "doublePattern"
  | "targetScoring"
  | "switchingTargetScoring"
  | "freeAim"
  | "bullseye"
  | "hitCount"
  | "switchblade"
  | "doublesLock";

/** The engine slots `exerciseFamily()` reads. */
export type ExerciseEngineSlots = Pick<
  RoutinePlayContext,
  | "switchingEngine"
  | "doublePatternEngine"
  | "targetScoringEngine"
  | "switchingTargetScoringEngine"
  | "scoreThresholdEngine"
  | "bullseyeCheckoutEngine"
  | "checkoutSequenceEngine"
  | "randomCheckoutEngine"
  | "hitCountEngine"
  | "switchbladeEngine"
  | "doublesLockEngine"
>;

/** What `visitLabelsFor()` reads: the step's configuration and where the visit stands. */
export type VisitLabelInput = {
  config: Record<string, unknown> | null;
  visitIndex: number;
  currentTargetNumber: number | undefined;
  currentTargetLabel?: string;
  targetIndex: number;
  dartsInOpenVisit: number;
};

export type TrainingStepResolved = StartTrainingResponseData["steps"][number];

export type BlockingSession = {
  sessionId: string;
  startedAt: string | null;
};

export type OpenRoutine = {
  activityId: string;
  startedAt: string | null;
  routineName: string;
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
  targetScoringEngine: TargetScoringEngine | null;
  switchingTargetScoringEngine: SwitchingTargetScoringEngine | null;
  scoreThresholdEngine: ScoreThresholdEngine | null;
  bullseyeCheckoutEngine: BullseyeCheckoutEngine | null;
  bullUpEngine: BullUpEngine | null;
  checkoutSequenceEngine: CheckoutSequenceEngine | null;
  randomCheckoutEngine: RandomCheckoutEngine | null;
  hitCountEngine: HitCountEngine | null;
  switchbladeEngine: SwitchbladeEngine | null;
  doublesLockEngine: DoublesLockEngine | null;
  stepTimer: SegmentTimer | null;
  stepRemainingSeconds: number;
  warmUpTimer: SegmentTimer | null;
  warmUpElapsedSeconds: number;
  warmUpConfiguration: Record<string, unknown> | null;
  stepConfiguration: Record<string, unknown> | null;
  adapter: StepAdapter | null;
  game: ReturnType<typeof gameStep> | null;
  sessionClock: SessionClock | null;
  blockingSession: BlockingSession | null;
  blockingError: string;
  resolvingBlockingSession: boolean;
  routineName: string;
  openRoutine: OpenRoutine | null;
  openRoutineError: string;
  resolvingOpenRoutine: boolean;
  stepSummaries: RoutineStepSummary[];
  routineFinished: boolean;
  routineReady: boolean;
  confirmingReady: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  $store: {
    game: {
      loading: boolean;
      reset(): void;
      startSession(input: unknown): void;
      contextRow(
        expectedSessionId?: string | null,
        fallbackTitle?: string | null,
      ): SessionContextRow | null;
    };
    trainingSession: TrainingSessionStoreContext;
  };
  init(this: RoutinePlayContext): Promise<void>;
  currentStep(this: RoutinePlayContext): TrainingStepResolved | null;
  header(this: RoutinePlayContext): RoutineHeader;
  headerTitle(this: RoutinePlayContext): string;
  headerSubtitle(this: RoutinePlayContext): string;
  headerClock(this: RoutinePlayContext): string;
  headerClockLabel(this: RoutinePlayContext): string;
  stepContextRow(this: RoutinePlayContext): SessionContextRow | null;
  startCurrentStep(this: RoutinePlayContext): Promise<void>;
  openStep(
    this: RoutinePlayContext,
    result: StartTrainingStepResponseData,
    durationSeconds: number,
  ): void;
  resolveBlockingSession(this: RoutinePlayContext): Promise<void>;
  blockingStartedLabel(this: RoutinePlayContext): string;
  beginRoutine(
    this: RoutinePlayContext,
    result: StartTrainingResponseData,
    completedStepCount?: number,
  ): Promise<void>;
  startRequestedRoutine(this: RoutinePlayContext): Promise<void>;
  resumeOpenRoutine(this: RoutinePlayContext): Promise<void>;
  abandonOpenRoutine(this: RoutinePlayContext): Promise<void>;
  openRoutineStartedLabel(this: RoutinePlayContext): string;
  startSessionClock(this: RoutinePlayContext): void;
  stopSessionClock(this: RoutinePlayContext): void;
  confirmRoutineReady(this: RoutinePlayContext): Promise<void>;
  readyGateView(this: RoutinePlayContext): ReadyGateView;
  startWarmUpTimer(
    this: RoutinePlayContext,
    configuration: Record<string, unknown>,
  ): void;
  formattedWarmUpElapsed(this: RoutinePlayContext): string;
  warmUpHighlightPath(this: RoutinePlayContext): string;
  warmUpDimPath(this: RoutinePlayContext): string;
  warmUpRing(this: RoutinePlayContext): SectionRingPaths;
  warmUpRingTrack(this: RoutinePlayContext): string;
  warmUpRingFill(this: RoutinePlayContext): string;
  startStepTimer(this: RoutinePlayContext, durationSeconds: number): void;
  formattedStepRemaining(this: RoutinePlayContext): string;
  switchingPoints(this: RoutinePlayContext): number;
  switchingTargetLabel(this: RoutinePlayContext): string;
  switchingChipIndex(this: RoutinePlayContext): number;
  doublePatternPoints(this: RoutinePlayContext): number;
  doublePatternLabel(this: RoutinePlayContext): string;
  doublePatternChipIndex(this: RoutinePlayContext): number;
  targetScoringChain(this: RoutinePlayContext): number;
  targetScoringTargetLabel(this: RoutinePlayContext): string;
  targetScoringBestChain(this: RoutinePlayContext): number;
  targetScoringMarkToBeat(this: RoutinePlayContext): number | null;
  switchingTargetScoringChain(this: RoutinePlayContext): number;
  switchingTargetScoringTargetLabel(this: RoutinePlayContext): string;
  switchingTargetScoringChipIndex(this: RoutinePlayContext): number;
  switchingTargetScoringBestChain(this: RoutinePlayContext): number;
  switchingTargetScoringMarkToBeat(this: RoutinePlayContext): number | null;
  scoreThresholdBeats(this: RoutinePlayContext): number;
  scoreThresholdVisits(this: RoutinePlayContext): number;
  scoreThresholdVisitTotal(this: RoutinePlayContext): number;
  scoreThresholdLastVisitTotal(this: RoutinePlayContext): number | null;
  scoreThresholdBeatRate(this: RoutinePlayContext): string;
  bullseyeCheckoutCheckouts(this: RoutinePlayContext): number;
  bullseyeCheckoutVisits(this: RoutinePlayContext): number;
  bullseyeCheckoutLeft(this: RoutinePlayContext): number;
  bullseyeCheckoutLastResult(this: RoutinePlayContext): string;
  bullseyeCheckoutRate(this: RoutinePlayContext): string;
  bullUpThrows(this: RoutinePlayContext): number;
  bullUpBullseyes(this: RoutinePlayContext): number;
  bullUpBulls(this: RoutinePlayContext): number;
  bullUpLastResult(this: RoutinePlayContext): string;
  bullUpBullseyeRate(this: RoutinePlayContext): string;
  bullUpBullRate(this: RoutinePlayContext): string;
  checkoutSequencePoints(this: RoutinePlayContext): number;
  checkoutSequenceOutshot(this: RoutinePlayContext): string;
  checkoutSequenceLeft(this: RoutinePlayContext): number;
  checkoutSequenceAttemptDart(this: RoutinePlayContext): number;
  checkoutSequenceLastResult(this: RoutinePlayContext): string;
  checkoutSequenceCheckouts(this: RoutinePlayContext): number;
  randomCheckoutCheckouts(this: RoutinePlayContext): number;
  randomCheckoutStart(this: RoutinePlayContext): number;
  randomCheckoutLeft(this: RoutinePlayContext): number;
  randomCheckoutAttemptDart(this: RoutinePlayContext): number;
  randomCheckoutLastResult(this: RoutinePlayContext): string;
  randomCheckoutRate(this: RoutinePlayContext): string;
  recordHitCountDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  hitCountHits(this: RoutinePlayContext): number;
  hitCountTargetLabel(this: RoutinePlayContext): string;
  hitCountDartsLeft(this: RoutinePlayContext): number;
  hitCountPasses(this: RoutinePlayContext): number;
  hitCountRate(this: RoutinePlayContext): string;
  recordSwitchbladeDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  switchbladeTotal(this: RoutinePlayContext): number;
  switchbladeSlotLabel(this: RoutinePlayContext): string;
  switchbladeRound(this: RoutinePlayContext): number;
  switchbladePasses(this: RoutinePlayContext): number;
  recordDoublesLockDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  doublesLockBonus(this: RoutinePlayContext): number;
  doublesLockTargetLabel(this: RoutinePlayContext): string;
  doublesLockLastLockLabel(this: RoutinePlayContext): string;
  doublesLockPasses(this: RoutinePlayContext): number;
  doublesLockBestPass(this: RoutinePlayContext): string;
  dartsThrown(this: RoutinePlayContext): number;
  activeDartEngine(
    this: RoutinePlayContext,
  ):
    | SwitchingEngine
    | DoublePatternEngine
    | TargetScoringEngine
    | SwitchingTargetScoringEngine
    | ScoreThresholdEngine
    | BullseyeCheckoutEngine
    | BullUpEngine
    | CheckoutSequenceEngine
    | RandomCheckoutEngine
    | HitCountEngine
    | SwitchbladeEngine
    | DoublesLockEngine
    | null;
  visitMarkers(this: RoutinePlayContext): BoardMarker[];
  previewSegments(this: RoutinePlayContext): PreviewSegment[];
  judgeExerciseDart(this: RoutinePlayContext, dart: DartFact): DartJudgement;
  exerciseVisitLabels(
    this: RoutinePlayContext,
    visitIndex: number,
  ): (string | undefined)[];
  switchingSequence(this: RoutinePlayContext): string;
  doublePatternSequence(this: RoutinePlayContext): string;
  switchingTargetScoringSequence(this: RoutinePlayContext): string;
  recordSwitchingDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordDoublePatternDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordTargetScoringDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordSwitchingTargetScoringDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordScoreThresholdDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordBullseyeCheckoutDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordBullUpDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordCheckoutSequenceDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
  recordRandomCheckoutDart(
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

export type RoutineHeaderInput = {
  routineName: string;
  ready: boolean;
  finished: boolean;
  stepIndex: number;
  stepCount: number;
  adapter: { title: string; panel: string } | null;
  stepRemaining: string | null;
  warmUpElapsed: string;
};

export type ReadyGateRow = { number: string; title: string; duration: string };

export type ReadyGateView = { eyebrow: string; rows: ReadyGateRow[] };

export type RoutineHeader = {
  title: string;
  subtitle: string;
  clock: string;
  clockLabel: string;
};

export type TrainingSessionStoreContext = ReturnType<
  typeof trainingSessionStore
>;

/** One `Select` option, as the glass dropdown renders it. */
export type SelectOption = { value: string; label: string };

export type TrainingIndexContext = {
  loading: boolean;
  error: string;
  /** Open flag for the page's `RoutineFormModal`. */
  showModal: boolean;
  showScheduleModal: boolean;
  routines: RoutineSummaryData[];
  init(this: TrainingIndexContext): Promise<void>;
  /** The seeded default routines. */
  systemRoutines(this: TrainingIndexContext): RoutineSummaryData[];
  /** The user's own saved routines. */
  personalRoutines(this: TrainingIndexContext): RoutineSummaryData[];
  durationLabel(routine: RoutineSummaryData): string;
  detailHref(routine: RoutineSummaryData): string;
  /** The routine's player, for the row's play button. */
  playHref(routine: RoutineSummaryData): string;
};

export type StatisticsRoutinesContext = {
  $store: {
    routineStats: Pick<
      ReturnType<typeof routineStatsStore>,
      "routines" | "routineKey" | "selectRoutine"
    >;
  };
  /** The picked routine's `routineKey`, read from and written to the `routineStats` store; seeded to the first option, "" when none. */
  routine: string;
  /** Every trained routine as a `Select` option, most recently trained first. */
  routineOptions(): SelectOption[];
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
  /** Draft-local identity, so duplicate exercises stay distinct while sorting. */
  key: string;
  exerciseTemplateId: string;
  name: string;
  exerciseTypeKey: string;
  durationValue: number;
};

/** One picker card: a type's templates under its name, blurb and tags. */
export type CatalogGroup = {
  key: string;
  name: string;
  blurb: string | null;
  tags: CatalogTag[];
  entries: (ExerciseTemplateCatalogEntryData & {
    level: 1 | 2 | 3 | 4 | null;
    label: string;
  })[];
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
  attemptedSave: boolean;
  /** Live-region text for the last reorder, read out by assistive tech. */
  moveAnnouncement: string;
  error: string;
  serverIssues: string[];
  name: string;
  description: string;
  catalog: ExerciseTemplateCatalogEntryData[];
  catalogTags: CatalogTagsResponse | null;
  steps: BuilderStep[];
  minMinutes: number;
  maxMinutes: number;
  maxSteps: number;
  stepMinMinutes: number;
  stepMaxMinutes: number;
  maxNameLength: number;
  maxDescriptionLength: number;
  groups(this: RoutineBuilderContext): CatalogGroup[];
  clearServerIssues(): void;
  navigate(path: string): void;
  init(this: RoutineBuilderContext): Promise<void>;
  loadExisting(this: RoutineBuilderContext): Promise<void>;
  /** Clears a create draft, or reloads the saved routine in edit mode. */
  resetForm(this: RoutineBuilderContext): Promise<void>;
  addStep(
    this: RoutineBuilderContext,
    entry: ExerciseTemplateCatalogEntryData,
  ): void;
  removeStep(this: RoutineBuilderContext, index: number): void;
  moveStep(this: RoutineBuilderContext, key: string, position: number): void;
  /** Moves a step `delta` places; the keyboard path to `moveStep`. */
  nudgeStep(this: RoutineBuilderContext, key: string, delta: number): void;
  setMinutes(this: RoutineBuilderContext, index: number, value: number): void;
  durationResult(this: RoutineBuilderContext): RoutineDurationResult;
  totalMinutes(this: RoutineBuilderContext): number;
  stepMinFor(this: RoutineBuilderContext, step: BuilderStep): number;
  stepMaxFor(this: RoutineBuilderContext, step: BuilderStep): number;
  gameStepIssues(this: RoutineBuilderContext): string[];
  durationIssues(this: RoutineBuilderContext): string[];
  nameValid(this: RoutineBuilderContext): boolean;
  canSave(this: RoutineBuilderContext): boolean;
  saveDisabled(this: RoutineBuilderContext): boolean;
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
