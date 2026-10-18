import {
  startTraining,
  startTrainingStep,
  resumeTraining,
  completeTraining as apiCompleteTraining,
  abandonTraining,
} from "@client/api/training-sessions";
import { appendBatch, completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/routines/training.module";
import { resolveWarmUpPhaseDurations } from "@modules/training/exercises/warm-up.engine.module";
import {
  dartboardDimPath,
  dartboardHighlightPath,
  sectionRingPaths,
} from "@lib/game/board/board-highlight.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { SessionClock } from "@modules/ui/session-clock.module";
import { playAudioCue, unlockAudioCues } from "@modules/ui/audio-cue.module";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { resolveSoloParticipantRef } from "@lib/training/exercises/solo-participant-upload";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import {
  stepAdapterKey,
  resolveStepAdapter,
} from "./adapters/step-adapter.registry";
import {
  bullUpPreview,
  exerciseFamily,
  judgeDart,
  visitLabelsFor,
  visitPreview,
  windowIndex,
  windowPage,
} from "./exercise-preview";
import { routineIdFromLocation } from "./routine-route";
import { readyGate } from "./ready-gate";
import { routineHeader } from "./routine-header";
import { routineStartErrorMessage } from "./routine-start-error";
import { stepAdvanceErrorMessage } from "./step-advance-error";
import {
  activeRoutineConflict,
  activeSessionConflict,
} from "./step-session-conflict";
import type { TrainingEngine } from "@modules/interfaces";
import type { DartObservation, SessionContextRow } from "@modules/types";
import type {
  BoardMarker,
  DoublePatternConfigData,
  ExerciseRulesetVersionKey,
  PreviewSegment,
  SectionRingPaths,
  SwitchingConfigData,
  SwitchingTargetScoringConfigData,
  WarmUpEngineInput,
} from "@lib/types";
import type {
  ResumeTrainingResponseData,
  StartTrainingResponseData,
  StartTrainingStepResponseData,
} from "@client/api/types";
import type { StepAdapter } from "@lib/interfaces";
import type {
  DartJudgement,
  ReadyGateView,
  RoutineHeader,
  RoutinePlayContext,
  TrainingStepResolved,
} from "./types";
import type { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import type { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import {
  targetScoringTargetLabel,
  type TargetScoringEngine,
} from "@modules/training/exercises/target-scoring.engine.module";
import type { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import type { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import type { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import type { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import type { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import type { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import type { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import type { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import type { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { boardTargetLabel } from "@modules/game/board-progression.module";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import type { DartFact } from "@modules/types";

const SESSION_ALREADY_COMPLETED = "SESSION_ALREADY_COMPLETED";

function startedDateLabel(startedAt: string | null | undefined): string {
  if (!startedAt) return "";
  const started = new Date(startedAt);
  return Number.isNaN(started.getTime())
    ? ""
    : started.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Warm-Up ring radius: clears the 220mm board face inside `SectionRing`. */
const WARM_UP_RING_RADIUS_MM = 232;

/**
 * Each dart exercise's engine slot and the method that records a board dart
 * into it, in the order `activeDartEngine()` and the board dispatch probe
 * them. At most one slot is open at a time.
 */
const DART_ENGINE_RECORDERS = [
  ["switchingEngine", "recordSwitchingDart"],
  ["doublePatternEngine", "recordDoublePatternDart"],
  ["targetScoringEngine", "recordTargetScoringDart"],
  ["switchingTargetScoringEngine", "recordSwitchingTargetScoringDart"],
  ["scoreThresholdEngine", "recordScoreThresholdDart"],
  ["bullseyeCheckoutEngine", "recordBullseyeCheckoutDart"],
  ["bullUpEngine", "recordBullUpDart"],
  ["checkoutSequenceEngine", "recordCheckoutSequenceDart"],
  ["randomCheckoutEngine", "recordRandomCheckoutDart"],
  ["hitCountEngine", "recordHitCountDart"],
  ["switchbladeEngine", "recordSwitchbladeDart"],
  ["doublesLockEngine", "recordDoublesLockDart"],
] as const satisfies readonly (readonly [
  keyof RoutinePlayContext,
  keyof RoutinePlayContext,
])[];

const STEP_CHANGE_CUE_HZ = 660;
const STEP_CHANGE_CUE_SECONDS = 0.25;

let self: RoutinePlayContext;

async function advanceAfterStepCompletion(
  ctx: RoutinePlayContext,
  sessionId: string,
  training: TrainingEngine,
): Promise<void> {
  await ctx.uploadCurrentStepFacts();
  if (!ctx.adapter?.completesOwnSession) {
    await completeSession(sessionId, "COMPLETED");
  }
  ctx.captureStepSummary();
  ctx.currentSessionId = null;
  ctx.currentParticipantRef = null;
  ctx.adapter?.close(ctx);
  ctx.adapter = null;
  const state = training.completeStep();
  if (state.status === "COMPLETE") {
    ctx.stopSessionClock();
    ctx.$store.trainingSession.markComplete();
    ctx.routineFinished = true;
    await ctx.completeRoutine();
    return;
  }
  await ctx.startCurrentStep();
}

export function routinePlay() {
  return {
    loading: false,
    error: "",
    activityId: null,
    routineName: "",
    steps: [],
    currentSessionId: null,
    currentParticipantRef: null,
    training: null,
    warmUpEngine: null,
    switchingEngine: null,
    doublePatternEngine: null,
    targetScoringEngine: null,
    switchingTargetScoringEngine: null,
    scoreThresholdEngine: null,
    bullseyeCheckoutEngine: null,
    bullUpEngine: null,
    checkoutSequenceEngine: null,
    randomCheckoutEngine: null,
    hitCountEngine: null,
    switchbladeEngine: null,
    doublesLockEngine: null,
    stepTimer: null,
    stepRemainingSeconds: 0,
    warmUpTimer: null,
    warmUpElapsedSeconds: 0,
    warmUpConfiguration: null,
    stepConfiguration: null,
    adapter: null as StepAdapter | null,
    game: null,
    sessionClock: null,
    blockingSession: null,
    blockingError: "",
    resolvingBlockingSession: false,
    openRoutine: null,
    openRoutineError: "",
    resolvingOpenRoutine: false,
    stepSummaries: [],
    routineFinished: false,
    routineReady: false,
    confirmingReady: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    ...boardInputData(
      (observation) => {
        const open = DART_ENGINE_RECORDERS.find(([slot]) => self[slot]);
        if (open) self[open[1]](observation);
      },
      () => self.activeDartEngine()?.facts().turns ?? [],
    ),

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
      | null {
      const open = DART_ENGINE_RECORDERS.find(([slot]) => this[slot]);
      return open ? this[open[0]] : null;
    },

    visitMarkers(this: RoutinePlayContext): BoardMarker[] {
      return markersForTurns(this.activeDartEngine()?.facts().turns ?? []);
    },

    /**
     * The latest visit's darts as labelled preview slots. Bull Up Practice
     * shows only the throw about to be made; every other exercise shows one
     * slot per dart of the visit, judged by `judgeExerciseDart()` and
     * captioned by `exerciseVisitLabels()`.
     */
    previewSegments(this: RoutinePlayContext): PreviewSegment[] {
      if (this.bullUpEngine)
        return bullUpPreview(this.bullUpEngine.state().throws);
      const turns = this.activeDartEngine()?.facts().turns ?? [];
      return visitPreview({
        turns,
        visitLabels: (visitIndex) => this.exerciseVisitLabels(visitIndex),
        judge: (dart) => this.judgeExerciseDart(dart),
      });
    },

    /** Hit, miss or free-aim value for one dart (`judgeDart()`). */
    judgeExerciseDart(this: RoutinePlayContext, dart: DartFact): DartJudgement {
      return judgeDart(exerciseFamily(this) ?? "switching", dart);
    },

    /** One caption per dart slot of the latest visit (`visitLabelsFor()`). */
    exerciseVisitLabels(
      this: RoutinePlayContext,
      visitIndex: number,
    ): (string | undefined)[] {
      const progress = (
        this.targetScoringEngine ?? this.switchingTargetScoringEngine
      )?.state();
      return visitLabelsFor(exerciseFamily(this), {
        config: this.stepConfiguration,
        visitIndex,
        currentTargetNumber: progress?.currentTargetNumber,
        currentTargetLabel:
          this.hitCountTargetLabel() ||
          this.doublesLockTargetLabel() ||
          undefined,
        targetIndex: progress?.targetIndex ?? 0,
        dartsInOpenVisit:
          this.activeDartEngine()?.facts().turns.at(-1)?.darts.length ?? 0,
      });
    },

    /** The Switching step's targets, in throw order, paged around the current one (`windowPage`). */
    switchingSequence(this: RoutinePlayContext): string {
      const config = this.stepConfiguration as SwitchingConfigData | null;
      if (!config) return "";
      const index = this.switchingEngine?.state().targetIndex ?? 0;
      return windowPage(config.targets, index).map(String).join(" ");
    },

    /** The doubles of Double Pattern's current pattern. */
    doublePatternSequence(this: RoutinePlayContext): string {
      const config = this.stepConfiguration as DoublePatternConfigData | null;
      const index = this.doublePatternEngine?.state().patternIndex ?? 0;
      return config?.patterns[index]?.map((n) => `D${n}`).join(" ") ?? "";
    },

    /** Switching Target Scoring's targets, in sequence order. */
    switchingTargetScoringSequence(this: RoutinePlayContext): string {
      const config = this
        .stepConfiguration as SwitchingTargetScoringConfigData | null;
      return config?.targets.map(targetScoringTargetLabel).join(" ") ?? "";
    },

    async init(this: RoutinePlayContext) {
      self = this;
      this.loading = true;
      this.error = "";
      try {
        await this.startRequestedRoutine();
      } catch (err) {
        this.error = routineStartErrorMessage(err);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Starts the routine the URL names. A routine the player already has open
     * is not an error: it is held in `openRoutine` for the modal, which offers
     * to resume or abandon it before anything new starts.
     */
    async startRequestedRoutine(this: RoutinePlayContext) {
      const routineTemplateId = routineIdFromLocation();
      if (!routineTemplateId) {
        this.error = "No routine selected.";
        return;
      }
      let result: StartTrainingResponseData;
      try {
        result = await startTraining({ routineTemplateId });
      } catch (err: unknown) {
        const open = activeRoutineConflict(err);
        if (!open) throw err;
        this.openRoutine = open;
        return;
      }
      await this.beginRoutine(result);
    },

    /**
     * Builds the routine engine from a started or reopened routine and
     * shows the ready gate, which starts the step it stands on;
     * `completedStepCount` is how many leading steps already finished.
     */
    async beginRoutine(
      this: RoutinePlayContext,
      result: StartTrainingResponseData,
      completedStepCount = 0,
    ) {
      this.activityId = result.activityId;
      this.routineName = result.routineName;
      this.steps = result.steps;
      this.training = trainingEngine.create(
        {
          routineName: result.routineName,
          steps: this.steps.map((step) => ({
            sequenceNumber: step.sequenceNumber,
            exerciseName: step.exerciseTypeKey,
            exerciseRulesetVersionKey:
              step.exerciseTypeKey === "GAME"
                ? ("WARM_UP_V1" as const)
                : (step.exerciseRulesetVersionKey as ExerciseRulesetVersionKey),
            configuration: step.configuration,
          })),
        },
        completedStepCount,
      );
      this.routineReady = false;
    },

    /**
     * The routine's one ready gate. Runs inside the slide's gesture, which is
     * what lets `unlockAudioCues()` unlock the `AudioContext` — every later
     * cue (step change, Warm-Up section beeps, countdown end) plays from a
     * timer, which alone can never satisfy browser autoplay policy. No
     * server step starts before this, so the gate costs no step time. The
     * gate stays up until the step has started, so a failed start leaves
     * the slide there to retry.
     */
    async confirmRoutineReady(this: RoutinePlayContext) {
      if (this.routineReady || this.confirmingReady) return;
      this.confirmingReady = true;
      this.error = "";
      unlockAudioCues();
      try {
        await this.startCurrentStep();
        this.routineReady = true;
      } catch (err: unknown) {
        this.error = routineStartErrorMessage(err);
      } finally {
        this.confirmingReady = false;
      }
    },

    readyGateView(this: RoutinePlayContext): ReadyGateView {
      return readyGate(
        this.steps.map((step) => ({
          title:
            resolveStepAdapter(stepAdapterKey(step))?.title ??
            step.exerciseTypeKey,
          durationSeconds: step.durationSeconds,
        })),
      );
    },

    /**
     * When the open routine started, for the modal's own copy. Empty when the
     * server named no usable start time, so the sentence reads without it.
     */
    openRoutineStartedLabel(this: RoutinePlayContext): string {
      return startedDateLabel(this.openRoutine?.startedAt);
    },

    /**
     * Continues the open routine at its first unfinished step; the step that
     * was half played starts again. A routine whose steps had all finished is
     * closed by the server, so the requested one starts fresh instead. A
     * failed resume keeps the offer on screen for a retry.
     */
    async resumeOpenRoutine(this: RoutinePlayContext) {
      const open = this.openRoutine;
      if (!open || this.resolvingOpenRoutine) return;
      this.resolvingOpenRoutine = true;
      this.openRoutineError = "";
      let result: ResumeTrainingResponseData | null = null;
      try {
        result = await resumeTraining(open.activityId);
      } catch (err: unknown) {
        if ((err as { code?: string }).code !== SESSION_ALREADY_COMPLETED) {
          this.openRoutineError =
            "Could not resume that routine. Check your connection and try again.";
          this.resolvingOpenRoutine = false;
          return;
        }
      }
      this.openRoutine = null;
      try {
        if (result && result.completedStepCount < result.steps.length) {
          await this.beginRoutine(result, result.completedStepCount);
        } else {
          await this.startRequestedRoutine();
        }
      } catch (err: unknown) {
        this.error = routineStartErrorMessage(err);
      } finally {
        this.resolvingOpenRoutine = false;
      }
    },

    /**
     * Abandons the open routine and starts the requested one. Only the player
     * may end it — it can hold real darts — so nothing here runs on its own.
     * A failed abandon keeps the offer on screen for a retry.
     */
    async abandonOpenRoutine(this: RoutinePlayContext) {
      const open = this.openRoutine;
      if (!open || this.resolvingOpenRoutine) return;
      this.resolvingOpenRoutine = true;
      this.openRoutineError = "";
      try {
        await abandonTraining(open.activityId);
      } catch (err: unknown) {
        if ((err as { code?: string }).code !== SESSION_ALREADY_COMPLETED) {
          this.openRoutineError =
            "Could not abandon that routine. Check your connection and try again.";
          this.resolvingOpenRoutine = false;
          return;
        }
      }
      this.openRoutine = null;
      try {
        await this.startRequestedRoutine();
      } catch (err: unknown) {
        this.error = routineStartErrorMessage(err);
      } finally {
        this.resolvingOpenRoutine = false;
      }
    },

    currentStep(this: RoutinePlayContext): TrainingStepResolved | null {
      if (!this.training) return null;
      const stepIndex = this.training.state().stepIndex;
      return this.steps[stepIndex] ?? null;
    },

    header(this: RoutinePlayContext): RoutineHeader {
      const step = this.currentStep();
      return routineHeader({
        routineName: this.routineName,
        ready: this.routineReady,
        finished: this.routineFinished,
        stepIndex: step ? this.steps.indexOf(step) : -1,
        stepCount: this.steps.length,
        adapter: (step && resolveStepAdapter(stepAdapterKey(step))) ?? null,
        stepRemaining: this.stepTimer ? this.formattedStepRemaining() : null,
        warmUpElapsed: this.formattedWarmUpElapsed(),
      });
    },

    headerTitle(this: RoutinePlayContext): string {
      return this.header().title;
    },

    headerSubtitle(this: RoutinePlayContext): string {
      return this.header().subtitle;
    },

    headerClock(this: RoutinePlayContext): string {
      return this.header().clock;
    },

    headerClockLabel(this: RoutinePlayContext): string {
      return this.header().clockLabel;
    },

    /**
     * The context row a routine finish confirm shows: routine name and step
     * position, then the step game's round and value.
     */
    stepContextRow(this: RoutinePlayContext): SessionContextRow | null {
      if (!this.training) return null;
      const gameRow = this.$store.game.contextRow(
        this.$store.trainingSession.gameSessionId,
      );
      return {
        title: this.routineName || null,
        stage: `Step ${this.training.state().stepIndex + 1} of ${this.steps.length}`,
        round: gameRow?.round ?? null,
        value: gameRow?.value ?? null,
      };
    },

    /**
     * Starts the step the engine is on. An already-active game is the one
     * failure the player can resolve without leaving the routine, so it is
     * held in `blockingSession` for the modal rather than thrown — every
     * other failure still reaches the caller's own handling.
     */
    async startCurrentStep(this: RoutinePlayContext) {
      const step = this.currentStep();
      if (!this.activityId || !step) return;
      let result: StartTrainingStepResponseData;
      try {
        result = await startTrainingStep(this.activityId, step.sequenceNumber);
      } catch (err: unknown) {
        const conflict = activeSessionConflict(err);
        if (!conflict) throw err;
        this.blockingSession = conflict;
        return;
      }
      this.blockingSession = null;
      this.openStep(result, step.durationSeconds);
    },

    /**
     * Binds a started step's server session to the screen: its engine, its
     * clock and the `trainingSession` store's step label. All three come
     * from `stepAdapterKey()`'s resolved adapter; this method does not
     * branch on the step kind.
     */
    openStep(
      this: RoutinePlayContext,
      result: StartTrainingStepResponseData,
      durationSeconds: number,
    ) {
      const step = this.currentStep();
      const adapter = step ? resolveStepAdapter(stepAdapterKey(step)) : null;
      if (!step || !adapter) {
        this.error = "This step kind is not supported on this device.";
        return;
      }
      this.currentSessionId = result.sessionId;
      this.currentParticipantRef = result.participant.ref;
      this.stepConfiguration = result.configuration;
      if (this.$store.trainingSession.active) {
        playAudioCue(STEP_CHANGE_CUE_HZ, STEP_CHANGE_CUE_SECONDS);
      }
      this.adapter = adapter;
      this.$store.trainingSession.setStep(adapter.headerLabel);
      adapter.open(this, result, durationSeconds);
    },

    /**
     * When the blocking game started, for the modal's own copy. Empty when
     * the server named no start time, so the sentence reads without it.
     */
    blockingStartedLabel(this: RoutinePlayContext): string {
      return startedDateLabel(this.blockingSession?.startedAt);
    },

    /**
     * Abandons the game that blocks the current step and starts that step
     * again, so a forgotten Ten Up One Down costs the player one tap instead
     * of the whole routine (issue #357). Only the player may end that game —
     * it can hold real darts — which is why nothing here runs automatically.
     * A retry that hits the conflict again re-arms the modal on whatever
     * session the server now names.
     */
    async resolveBlockingSession(this: RoutinePlayContext) {
      const blocking = this.blockingSession;
      if (!blocking || this.resolvingBlockingSession) return;
      this.resolvingBlockingSession = true;
      this.blockingError = "";
      try {
        await completeSession(blocking.sessionId, "ABANDONED");
      } catch {
        this.blockingError =
          "Could not abandon that game. Check your connection and try again.";
        this.resolvingBlockingSession = false;
        return;
      }
      this.blockingSession = null;
      try {
        await this.startCurrentStep();
      } catch (err: unknown) {
        this.error = stepAdvanceErrorMessage(err);
      } finally {
        this.resolvingBlockingSession = false;
      }
    },

    /**
     * The routine's own clock: one count-up spanning every step, started by
     * whichever step runs first and stopped only when the last one ends.
     * Idempotent — each step calls it, the first call wins.
     */
    startSessionClock(this: RoutinePlayContext) {
      if (this.sessionClock) return;
      this.$store.trainingSession.startSession();
      this.sessionClock = new SessionClock({
        onTick: (elapsed) => {
          this.$store.trainingSession.tick(elapsed);
        },
      });
      this.sessionClock.start();
    },

    stopSessionClock(this: RoutinePlayContext) {
      this.sessionClock?.stop();
      this.sessionClock = null;
    },

    /**
     * Called from the warm-up adapter's `open()`. Audio was unlocked by the
     * routine ready gate's gesture (`confirmRoutineReady`); `unlockAudio()`
     * here is a harmless repeat.
     */
    startWarmUpTimer(
      this: RoutinePlayContext,
      configuration: Record<string, unknown>,
    ) {
      this.warmUpElapsedSeconds = 0;
      this.warmUpTimer = new SegmentTimer({
        direction: "countup",
        segmentDurationsSeconds: resolveWarmUpPhaseDurations(
          configuration as WarmUpEngineInput,
        ),
        onTick: (elapsed) => {
          this.warmUpElapsedSeconds = elapsed;
        },
        onSegmentChange: () => {
          this.warmUpEngine?.advance();
        },
        onComplete: () => {
          this.warmUpEngine?.advance();
          void this.completeCurrentStep();
        },
      });
      this.warmUpTimer.unlockAudio();
      this.warmUpTimer.start();
      this.startSessionClock();
    },

    formattedWarmUpElapsed(this: RoutinePlayContext): string {
      const minutes = Math.floor(this.warmUpElapsedSeconds / 60);
      const seconds = this.warmUpElapsedSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },

    warmUpHighlightPath(this: RoutinePlayContext): string {
      return dartboardHighlightPath(this.warmUpEngine?.state().targets ?? []);
    },

    warmUpDimPath(this: RoutinePlayContext): string {
      return dartboardDimPath(this.warmUpEngine?.state().targets ?? []);
    },

    warmUpRing(this: RoutinePlayContext): SectionRingPaths {
      const configuration = this
        .warmUpConfiguration as WarmUpEngineInput | null;
      if (!configuration) return { track: "", fill: "" };
      return sectionRingPaths(
        resolveWarmUpPhaseDurations(configuration),
        this.warmUpElapsedSeconds,
        WARM_UP_RING_RADIUS_MM,
      );
    },

    warmUpRingTrack(this: RoutinePlayContext): string {
      return this.warmUpRing().track;
    },

    warmUpRingFill(this: RoutinePlayContext): string {
      return this.warmUpRing().fill;
    },

    /**
     * The step's own clock. `SegmentTimer` drives both the on-screen
     * countdown and expiry, so there is no second scheduler to drift
     * against it. The engines stay clockless (D264): expiry reaches them
     * as `expireTimer()`.
     */
    startStepTimer(this: RoutinePlayContext, durationSeconds: number) {
      this.stepRemainingSeconds = durationSeconds;
      this.stepTimer = new SegmentTimer({
        segmentDurationsSeconds: [durationSeconds],
        direction: "countdown",
        onTick: (remaining) => {
          this.stepRemainingSeconds = remaining;
        },
        onComplete: () => {
          this.switchingEngine?.expireTimer();
          this.doublePatternEngine?.expireTimer();
          this.targetScoringEngine?.expireTimer();
          this.switchingTargetScoringEngine?.expireTimer();
          this.scoreThresholdEngine?.expireTimer();
          this.bullseyeCheckoutEngine?.expireTimer();
          this.bullUpEngine?.expireTimer();
          this.checkoutSequenceEngine?.expireTimer();
          this.randomCheckoutEngine?.expireTimer();
          this.hitCountEngine?.expireTimer();
          this.switchbladeEngine?.expireTimer();
          this.doublesLockEngine?.expireTimer();
          void this.completeCurrentStep();
        },
      });
      this.stepTimer.start();
      this.startSessionClock();
    },

    formattedStepRemaining(this: RoutinePlayContext): string {
      const remaining = Math.max(0, this.stepRemainingSeconds);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },

    recordSwitchingDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.switchingEngine) return;
      this.switchingEngine.record(observation);
    },

    recordDoublePatternDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.doublePatternEngine) return;
      this.doublePatternEngine.record(observation);
    },

    recordTargetScoringDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.targetScoringEngine) return;
      this.targetScoringEngine.record(observation);
    },

    recordSwitchingTargetScoringDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.switchingTargetScoringEngine) return;
      this.switchingTargetScoringEngine.record(observation);
    },

    recordScoreThresholdDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.scoreThresholdEngine) return;
      this.scoreThresholdEngine.record(observation);
    },

    recordBullseyeCheckoutDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.bullseyeCheckoutEngine) return;
      this.bullseyeCheckoutEngine.record(observation);
    },

    recordBullUpDart(this: RoutinePlayContext, observation: DartObservation) {
      if (!this.bullUpEngine) return;
      this.bullUpEngine.record(observation);
    },

    /**
     * Catch 40 ends on its own once the last outshot is attempted, so the
     * step completes without waiting for its deadline.
     */
    recordCheckoutSequenceDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.checkoutSequenceEngine) return;
      this.checkoutSequenceEngine.record(observation);
      if (this.checkoutSequenceEngine.isComplete()) {
        void this.completeCurrentStep();
      }
    },

    /** Random Checkout never ends on a dart; only the step deadline completes it. */
    recordRandomCheckoutDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.randomCheckoutEngine) return;
      this.randomCheckoutEngine.record(observation);
    },

    switchingPoints(this: RoutinePlayContext): number {
      return this.switchingEngine?.state().totalPoints ?? 0;
    },

    switchingTargetLabel(this: RoutinePlayContext): string {
      const target = this.switchingEngine?.state().currentTargetNumber;
      return target === undefined ? "" : String(target);
    },

    /** The current target's chip within `switchingSequence()`'s page. */
    switchingChipIndex(this: RoutinePlayContext): number {
      return windowIndex(this.switchingEngine?.state().targetIndex ?? 0);
    },

    doublePatternPoints(this: RoutinePlayContext): number {
      return this.doublePatternEngine?.state().totalPoints ?? 0;
    },

    doublePatternLabel(this: RoutinePlayContext): string {
      const double = this.doublePatternEngine?.state().currentDoubleNumber;
      return double === undefined ? "" : `D${double}`;
    },

    /** The current double's chip within `doublePatternSequence()`. */
    doublePatternChipIndex(this: RoutinePlayContext): number {
      return this.doublePatternEngine?.state().targetWithinPattern ?? 0;
    },

    targetScoringChain(this: RoutinePlayContext): number {
      return this.targetScoringEngine?.state().currentChain ?? 0;
    },

    targetScoringTargetLabel(this: RoutinePlayContext): string {
      const target = this.targetScoringEngine?.state().currentTargetNumber;
      return target === undefined ? "" : targetScoringTargetLabel(target);
    },

    targetScoringBestChain(this: RoutinePlayContext): number {
      return this.targetScoringEngine?.state().bestChain ?? 0;
    },

    targetScoringMarkToBeat(this: RoutinePlayContext): number | null {
      return this.targetScoringEngine?.state().markToBeat ?? null;
    },

    switchingTargetScoringChain(this: RoutinePlayContext): number {
      return this.switchingTargetScoringEngine?.state().currentChain ?? 0;
    },

    switchingTargetScoringTargetLabel(this: RoutinePlayContext): string {
      const target =
        this.switchingTargetScoringEngine?.state().currentTargetNumber;
      return target === undefined ? "" : targetScoringTargetLabel(target);
    },

    /** The current target's chip within `switchingTargetScoringSequence()`. */
    switchingTargetScoringChipIndex(this: RoutinePlayContext): number {
      return this.switchingTargetScoringEngine?.state().targetIndex ?? 0;
    },

    switchingTargetScoringBestChain(this: RoutinePlayContext): number {
      return this.switchingTargetScoringEngine?.state().bestChain ?? 0;
    },

    switchingTargetScoringMarkToBeat(this: RoutinePlayContext): number | null {
      return this.switchingTargetScoringEngine?.state().markToBeat ?? null;
    },

    scoreThresholdBeats(this: RoutinePlayContext): number {
      return this.scoreThresholdEngine?.state().beats ?? 0;
    },

    scoreThresholdVisits(this: RoutinePlayContext): number {
      return this.scoreThresholdEngine?.state().visits ?? 0;
    },

    scoreThresholdVisitTotal(this: RoutinePlayContext): number {
      return this.scoreThresholdEngine?.state().currentVisitTotal ?? 0;
    },

    scoreThresholdLastVisitTotal(this: RoutinePlayContext): number | null {
      return this.scoreThresholdEngine?.state().lastVisitTotal ?? null;
    },

    scoreThresholdBeatRate(this: RoutinePlayContext): string {
      const state = this.scoreThresholdEngine?.state();
      return !state || state.visits === 0
        ? "—"
        : accuracyDisplay(state.beats, state.visits);
    },

    bullseyeCheckoutCheckouts(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().checkouts ?? 0;
    },

    bullseyeCheckoutVisits(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().visits ?? 0;
    },

    bullseyeCheckoutLeft(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().currentLeft ?? 0;
    },

    bullseyeCheckoutLastResult(this: RoutinePlayContext): string {
      const last = this.bullseyeCheckoutEngine?.state().lastVisitCheckout;
      if (last === undefined || last === null) return "—";
      return last ? "✓" : "✗";
    },

    bullseyeCheckoutRate(this: RoutinePlayContext): string {
      const state = this.bullseyeCheckoutEngine?.state();
      return !state || state.visits === 0
        ? "—"
        : accuracyDisplay(state.checkouts, state.visits);
    },

    bullUpThrows(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().throws ?? 0;
    },

    bullUpBullseyes(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().bullseyes ?? 0;
    },

    bullUpBulls(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().bulls ?? 0;
    },

    bullUpLastResult(this: RoutinePlayContext): string {
      const last = this.bullUpEngine?.state().lastTier ?? null;
      if (last === null) return "—";
      return last === "BULLSEYE"
        ? "Bullseye"
        : last === "OUTER_BULL"
          ? "Outer bull"
          : "Miss";
    },

    bullUpBullseyeRate(this: RoutinePlayContext): string {
      const state = this.bullUpEngine?.state();
      return !state || state.throws === 0
        ? "—"
        : accuracyDisplay(state.bullseyes, state.throws);
    },

    bullUpBullRate(this: RoutinePlayContext): string {
      const state = this.bullUpEngine?.state();
      return !state || state.throws === 0
        ? "—"
        : accuracyDisplay(state.bulls, state.throws);
    },

    checkoutSequencePoints(this: RoutinePlayContext): number {
      return this.checkoutSequenceEngine?.state().points ?? 0;
    },

    checkoutSequenceOutshot(this: RoutinePlayContext): string {
      const outshot = this.checkoutSequenceEngine?.state().currentOutshot;
      return outshot === undefined || outshot === null ? "—" : String(outshot);
    },

    checkoutSequenceLeft(this: RoutinePlayContext): number {
      return this.checkoutSequenceEngine?.state().remaining ?? 0;
    },

    checkoutSequenceAttemptDart(this: RoutinePlayContext): number {
      return this.checkoutSequenceEngine?.state().attemptDart ?? 0;
    },

    checkoutSequenceLastResult(this: RoutinePlayContext): string {
      const last = this.checkoutSequenceEngine?.state().lastAttemptPoints;
      if (last === undefined || last === null) return "—";
      return last === 0 ? "0" : `+${last}`;
    },

    checkoutSequenceCheckouts(this: RoutinePlayContext): number {
      return this.checkoutSequenceEngine?.state().checkouts ?? 0;
    },

    randomCheckoutCheckouts(this: RoutinePlayContext): number {
      return this.randomCheckoutEngine?.state().checkouts ?? 0;
    },

    randomCheckoutStart(this: RoutinePlayContext): number {
      return this.randomCheckoutEngine?.state().startScore ?? 0;
    },

    randomCheckoutLeft(this: RoutinePlayContext): number {
      return this.randomCheckoutEngine?.state().remaining ?? 0;
    },

    randomCheckoutAttemptDart(this: RoutinePlayContext): number {
      return this.randomCheckoutEngine?.state().dartsInVisit ?? 0;
    },

    randomCheckoutLastResult(this: RoutinePlayContext): string {
      const last = this.randomCheckoutEngine?.state().lastAttempt;
      if (last === undefined || last === null) return "—";
      return last === "CHECKOUT" ? "✓" : "✗";
    },

    randomCheckoutRate(this: RoutinePlayContext): string {
      const state = this.randomCheckoutEngine?.state();
      return !state || state.attempts === 0
        ? "—"
        : accuracyDisplay(state.checkouts, state.attempts);
    },

    /** Hit Count never ends on a dart; only the step deadline completes it. */
    recordHitCountDart(this: RoutinePlayContext, observation: DartObservation) {
      if (!this.hitCountEngine) return;
      this.hitCountEngine.record(observation);
    },

    hitCountHits(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().hits ?? 0;
    },

    hitCountTargetLabel(this: RoutinePlayContext): string {
      const target = this.hitCountEngine?.state().currentTarget;
      return target === undefined ? "" : boardTargetLabel(target);
    },

    hitCountDartsLeft(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().dartsLeftOnTarget ?? 0;
    },

    hitCountPasses(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().passes ?? 0;
    },

    hitCountRate(this: RoutinePlayContext): string {
      const state = this.hitCountEngine?.state();
      return !state || state.dartsThrown === 0
        ? "—"
        : accuracyDisplay(state.hits, state.dartsThrown);
    },

    /** SwitchBlade never ends on a dart; only the step deadline completes it. */
    recordSwitchbladeDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.switchbladeEngine) return;
      this.switchbladeEngine.record(observation);
    },

    switchbladeTotal(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().total ?? 0;
    },

    switchbladeSlotLabel(this: RoutinePlayContext): string {
      const slot = this.switchbladeEngine?.state().currentSlot;
      return slot === undefined ? "" : boardTargetLabel(slot);
    },

    switchbladeRound(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().round ?? 1;
    },

    switchbladePasses(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().passes ?? 0;
    },

    /** Doubles Lock never ends on a dart; only the step deadline completes it. */
    recordDoublesLockDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.doublesLockEngine) return;
      this.doublesLockEngine.record(observation);
    },

    doublesLockBonus(this: RoutinePlayContext): number {
      return this.doublesLockEngine?.state().bonus ?? 0;
    },

    doublesLockTargetLabel(this: RoutinePlayContext): string {
      const target = this.doublesLockEngine?.state().currentDouble;
      return target === undefined ? "" : boardTargetLabel(target);
    },

    doublesLockLastLockLabel(this: RoutinePlayContext): string {
      const lock = this.doublesLockEngine?.state().lastLock;
      return lock ? boardTargetLabel(lock) : "—";
    },

    doublesLockPasses(this: RoutinePlayContext): number {
      return this.doublesLockEngine?.state().passes ?? 0;
    },

    doublesLockBestPass(this: RoutinePlayContext): string {
      const best = this.doublesLockEngine?.state().bestPassDarts;
      return best == null ? "—" : `${best} darts`;
    },

    dartsThrown(this: RoutinePlayContext): number {
      return this.activeDartEngine()?.state().dartsThrown ?? 0;
    },

    undoVisit(this: RoutinePlayContext) {
      this.activeDartEngine()?.undo();
    },

    async uploadCurrentStepFacts(this: RoutinePlayContext) {
      const facts = this.adapter?.facts(this);
      if (!facts || !this.currentSessionId || !this.currentParticipantRef) {
        return;
      }
      const resolved = resolveSoloParticipantRef(
        facts,
        this.currentParticipantRef,
      );
      const batch = buildEventsBatch(resolved);
      const idempotencyKey = crypto.randomUUID();
      await appendBatch(this.currentSessionId, idempotencyKey, batch);
    },

    /**
     * Snapshots the step that just finished while its engine/game store is
     * still in memory — `advanceAfterStepCompletion` closes the adapter a
     * few lines later, and nothing re-reads it afterwards. Warm-Up's own
     * adapter always returns `null`, since it throws no darts.
     */
    captureStepSummary(this: RoutinePlayContext) {
      const summary = this.adapter?.summarise(this);
      if (summary) this.stepSummaries.push(summary);
    },

    /**
     * Marks the routine complete server-side. Separate from the summary's
     * own visibility so a failed call leaves the player looking at their
     * results with a retry, rather than at a dead screen.
     */
    async completeRoutine(this: RoutinePlayContext) {
      if (!this.activityId) return;
      this.completionStatus = "saving";
      this.completionError = "";
      try {
        await apiCompleteTraining(this.activityId);
        this.completionStatus = "succeeded";
      } catch {
        this.completionError =
          "Could not save your session. Check your connection and retry.";
        this.completionStatus = "failed";
      }
    },

    dismissSummary(this: RoutinePlayContext) {
      this.$store.trainingSession.reset();
      globalThis.location.href = "/training";
    },

    async completeCurrentStep(this: RoutinePlayContext) {
      if (!this.currentSessionId || !this.training || !this.activityId) {
        return;
      }
      if (this.stepTimer) {
        this.stepTimer.stop();
        this.stepTimer = null;
      }
      if (this.warmUpTimer) {
        this.warmUpTimer.stop();
        this.warmUpTimer = null;
      }
      try {
        await advanceAfterStepCompletion(
          this,
          this.currentSessionId,
          this.training,
        );
      } catch (err: unknown) {
        this.error = stepAdvanceErrorMessage(err);
      }
    },

    /**
     * A GAME step's own game store carries its engine and facts on
     * `$store.game` (via the adapter's `open`), so its wrapped
     * `abandonAndExit` (`game-step.data.ts`) already uploads any partial
     * darts, marks that session ABANDONED, abandons the routine, and
     * redirects to `/training`. Every earlier step has no `GameEngine`, so
     * it abandons the current step's session directly and never touches
     * `$store.game`.
     */
    async abandonAndExit(this: RoutinePlayContext) {
      if (this.game) {
        if (this.stepTimer) {
          this.stepTimer.stop();
          this.stepTimer = null;
        }
        this.stopSessionClock();
        this.$store.trainingSession.reset();
        return this.game.abandonAndExit();
      }
      if (this.$store.game.loading) return;
      this.$store.game.loading = true;
      this.error = "";
      try {
        if (this.stepTimer) {
          this.stepTimer.stop();
          this.stepTimer = null;
        }
        if (this.warmUpTimer) {
          this.warmUpTimer.stop();
          this.warmUpTimer = null;
        }
        this.stopSessionClock();
        this.$store.trainingSession.reset();
        if (this.currentSessionId) {
          await this.uploadCurrentStepFacts();
          await completeSession(this.currentSessionId, "ABANDONED");
        }
        if (this.activityId) {
          await abandonTraining(this.activityId);
        }
        globalThis.location.href = "/training";
      } catch {
        this.error = "Could not leave. Try again.";
        this.$store.game.loading = false;
      }
    },
  };
}
