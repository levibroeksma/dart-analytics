import {
  startTraining,
  startTrainingStep,
  completeTraining as apiCompleteTraining,
  abandonTraining,
} from "@client/api/training-sessions";
import { appendBatch, completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/routines/training.module";
import { resolveWarmUpPhaseDurations } from "@modules/training/exercises/warm-up.engine.module";
import { dartboardHighlightPath } from "@lib/game/board/board-highlight.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { SessionClock } from "@modules/ui/session-clock.module";
import { playAudioCue } from "@modules/ui/audio-cue.module";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { playPreviewSegments } from "@lib/game/play-lifecycle";
import { resolveSoloParticipantRef } from "@lib/training/exercises/solo-participant-upload";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import {
  stepAdapterKey,
  resolveStepAdapter,
} from "./adapters/step-adapter.registry";
import { routineIdFromLocation } from "./routine-route";
import { routineStartErrorMessage } from "./routine-start-error";
import { stepAdvanceErrorMessage } from "./step-advance-error";
import { activeSessionConflict } from "./step-session-conflict";
import type { TrainingEngine } from "@modules/interfaces";
import type { DartObservation } from "@modules/types";
import type {
  BoardMarker,
  ExerciseRulesetVersionKey,
  PreviewSegment,
  WarmUpEngineInput,
} from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";
import type { StepAdapter } from "@lib/interfaces";
import type { RoutinePlayContext, TrainingStepResolved } from "./types";
import type { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import type { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import {
  targetScoringPoints,
  targetScoringTargetLabel,
  type TargetScoringEngine,
} from "@modules/training/exercises/target-scoring.engine.module";
import type { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import type { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import type { DartFact } from "@modules/types";

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
    stepTimer: null,
    stepRemainingSeconds: 0,
    warmUpTimer: null,
    warmUpElapsedSeconds: 0,
    warmUpReady: false,
    warmUpConfiguration: null,
    adapter: null as StepAdapter | null,
    game: null,
    sessionClock: null,
    blockingSession: null,
    blockingError: "",
    resolvingBlockingSession: false,
    stepSummaries: [],
    routineFinished: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    ...boardInputData(
      (observation) => {
        if (self.switchingEngine) self.recordSwitchingDart(observation);
        else if (self.doublePatternEngine)
          self.recordDoublePatternDart(observation);
        else if (self.targetScoringEngine)
          self.recordTargetScoringDart(observation);
        else if (self.switchingTargetScoringEngine)
          self.recordSwitchingTargetScoringDart(observation);
        else if (self.scoreThresholdEngine)
          self.recordScoreThresholdDart(observation);
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
      | null {
      return (
        this.switchingEngine ??
        this.doublePatternEngine ??
        this.targetScoringEngine ??
        this.switchingTargetScoringEngine ??
        this.scoreThresholdEngine ??
        null
      );
    },

    visitMarkers(this: RoutinePlayContext): BoardMarker[] {
      return markersForTurns(this.activeDartEngine()?.facts().turns ?? []);
    },

    /**
     * Hit/miss marks for the current visit's darts. Each dart carries the
     * target it was thrown at (`intendedTargetNumber`), so no config lookup
     * is needed; Double Pattern additionally requires the double, since
     * nothing else scores under `DOUBLE_PATTERN_V1`, and both Target
     * Scoring exercises defer to their shared ring rule (a double is a miss).
     * 65 or More has no target: a dart on the board is a hit, off it a miss.
     */
    previewSegments(this: RoutinePlayContext): PreviewSegment[] {
      const turns = this.activeDartEngine()?.facts().turns ?? [];
      const requireDouble = this.doublePatternEngine !== null;
      const isHit = this.scoreThresholdEngine
        ? (dart: DartFact) => dart.hitTargetNumber !== null
        : this.targetScoringEngine || this.switchingTargetScoringEngine
          ? (dart: DartFact) =>
              dart.intendedTargetNumber !== null &&
              targetScoringPoints(dart.intendedTargetNumber, dart) !== null
          : (dart: DartFact) =>
              dart.hitTargetNumber === dart.intendedTargetNumber &&
              (!requireDouble || dart.hitZoneKey === "DOUBLE");
      return playPreviewSegments(turns, null, (dart) =>
        isHit(dart) ? "hit" : "miss",
      );
    },

    async init(this: RoutinePlayContext) {
      self = this;
      this.loading = true;
      this.error = "";
      const routineTemplateId = routineIdFromLocation();
      if (!routineTemplateId) {
        this.error = "No routine selected.";
        this.loading = false;
        return;
      }
      try {
        const result = await startTraining({ routineTemplateId });
        this.activityId = result.activityId;
        this.steps = result.steps;
        this.training = trainingEngine.create({
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
        });
        await this.startCurrentStep();
      } catch (err) {
        this.error = routineStartErrorMessage(err);
      } finally {
        this.loading = false;
      }
    },

    currentStep(this: RoutinePlayContext): TrainingStepResolved | null {
      if (!this.training) return null;
      const stepIndex = this.training.state().stepIndex;
      return this.steps[stepIndex] ?? null;
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
     * clock and the header the routine store drives. Which engine/clock/
     * header depends entirely on `stepAdapterKey()`'s resolved adapter — this
     * method itself no longer branches on the step kind.
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
      const startedAt = this.blockingSession?.startedAt;
      if (!startedAt) return "";
      const started = new Date(startedAt);
      return Number.isNaN(started.getTime())
        ? ""
        : started.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          });
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

    confirmWarmUpReady(this: RoutinePlayContext) {
      if (!this.warmUpConfiguration || this.warmUpReady) return;
      this.warmUpReady = true;
      this.startWarmUpTimer(this.warmUpConfiguration);
    },

    /**
     * Only ever reached via `confirmWarmUpReady()`'s click handler — that
     * gesture is what lets `SegmentTimer.unlockAudio()` actually unlock the
     * `AudioContext`; the timer's later beeps run from `setInterval`, which
     * alone can never satisfy browser autoplay policy.
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

    switchingPoints(this: RoutinePlayContext): number {
      return this.switchingEngine?.state().totalPoints ?? 0;
    },

    switchingTargetLabel(this: RoutinePlayContext): string {
      const target = this.switchingEngine?.state().currentTargetNumber;
      return target === undefined ? "" : String(target);
    },

    doublePatternPoints(this: RoutinePlayContext): number {
      return this.doublePatternEngine?.state().totalPoints ?? 0;
    },

    doublePatternLabel(this: RoutinePlayContext): string {
      const double = this.doublePatternEngine?.state().currentDoubleNumber;
      return double === undefined ? "" : `D${double}`;
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
