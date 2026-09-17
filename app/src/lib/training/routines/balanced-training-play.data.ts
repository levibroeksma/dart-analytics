import {
  startTraining,
  startTrainingStep,
  completeTraining as apiCompleteTraining,
  abandonTraining,
} from "@client/api/training-sessions";
import { appendBatch, completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/routines/training.module";
import { getExerciseEngineFactory } from "@modules/training/exercises/engine.registry";
import { resolveWarmUpPhaseDurations } from "@modules/training/exercises/warm-up.engine.module";
import { dartboardHighlightPath } from "@lib/game/board/board-highlight.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { SessionClock } from "@modules/ui/session-clock.module";
import { playAudioCue } from "@modules/ui/audio-cue.module";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { playPreviewSegments } from "@lib/game/play-lifecycle";
import { resolveSoloParticipantRef } from "@lib/training/exercises/solo-participant-upload";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { finishingStep } from "./finishing-step.data";
import { routineStartErrorMessage } from "./routine-start-error";
import { stepAdvanceErrorMessage } from "./step-advance-error";
import { activeSessionConflict } from "./step-session-conflict";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseFinishing,
} from "@modules/training/routines/routine-summary.module";
import type { ExerciseEngine, TrainingEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type {
  WarmUpEngineInput,
  SwitchingConfigData,
  DoublePatternConfigData,
  TuodPlayContext,
} from "@lib/types";
import type { DartObservation } from "@modules/types";
import type { BoardMarker, PreviewSegment } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";
import type {
  BalancedTrainingPlayContext,
  TrainingStepResolved,
} from "./types";

const ROUTINE_NAME = "Balanced Training";
const FINISHING_RULESET_VERSION_KEY = "TUOD_V1";
const STEP_CHANGE_CUE_HZ = 660;
const STEP_CHANGE_CUE_SECONDS = 0.25;

let self: BalancedTrainingPlayContext;

async function advanceAfterStepCompletion(
  ctx: BalancedTrainingPlayContext,
  sessionId: string,
  training: TrainingEngine,
): Promise<void> {
  await ctx.uploadCurrentStepFacts();
  if (ctx.currentStep()?.exerciseTypeKey !== "GAME") {
    await completeSession(sessionId, "COMPLETED");
  }
  ctx.captureStepSummary();
  ctx.currentSessionId = null;
  ctx.currentParticipantRef = null;
  ctx.warmUpEngine = null;
  ctx.switchingEngine = null;
  ctx.doublePatternEngine = null;
  ctx.finishing = null;
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

export function balancedTrainingPlay() {
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
    stepTimer: null,
    stepRemainingSeconds: 0,
    warmUpTimer: null,
    warmUpElapsedSeconds: 0,
    warmUpReady: false,
    warmUpConfiguration: null,
    finishing: null,
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
      },
      () => self.activeDartEngine()?.facts().turns ?? [],
    ),

    activeDartEngine(
      this: BalancedTrainingPlayContext,
    ): SwitchingEngine | DoublePatternEngine | null {
      return this.switchingEngine ?? this.doublePatternEngine ?? null;
    },

    visitMarkers(this: BalancedTrainingPlayContext): BoardMarker[] {
      return markersForTurns(this.activeDartEngine()?.facts().turns ?? []);
    },

    /**
     * Hit/miss marks for the current visit's darts. Each dart carries the
     * target it was thrown at (`intendedTargetNumber`), so no config lookup
     * is needed; Double Pattern additionally requires the double, since
     * nothing else scores under `DOUBLE_PATTERN_V1`.
     */
    previewSegments(this: BalancedTrainingPlayContext): PreviewSegment[] {
      const turns = this.activeDartEngine()?.facts().turns ?? [];
      const requireDouble = this.doublePatternEngine !== null;
      return playPreviewSegments(turns, null, (dart) =>
        dart.hitTargetNumber === dart.intendedTargetNumber &&
        (!requireDouble || dart.hitZoneKey === "DOUBLE")
          ? "hit"
          : "miss",
      );
    },

    async init(this: BalancedTrainingPlayContext) {
      self = this;
      this.loading = true;
      this.error = "";
      try {
        const result = await startTraining({
          routineTemplateName: ROUTINE_NAME,
        });
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
                : (step.exerciseRulesetVersionKey as
                    "WARM_UP_V1" | "SWITCHING_V1" | "DOUBLE_PATTERN_V1"),
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

    currentStep(
      this: BalancedTrainingPlayContext,
    ): TrainingStepResolved | null {
      if (!this.training) return null;
      const stepIndex = this.training.state().stepIndex;
      return this.steps[stepIndex] ?? null;
    },

    buildWarmUpEngine(
      this: BalancedTrainingPlayContext,
      configuration: Record<string, unknown>,
    ) {
      const factory = getExerciseEngineFactory("WARM_UP_V1");
      this.warmUpEngine = factory
        ? (factory.create(
            configuration as WarmUpEngineInput,
          ) as ExerciseEngine<WarmUpState>)
        : null;
    },

    buildSwitchingEngine(
      this: BalancedTrainingPlayContext,
      configuration: Record<string, unknown>,
    ) {
      const factory = getDartExerciseEngineFactory("SWITCHING_V1");
      const created = factory?.create(configuration as SwitchingConfigData);
      this.switchingEngine =
        created instanceof SwitchingEngine ? created : null;
    },

    buildDoublePatternEngine(
      this: BalancedTrainingPlayContext,
      configuration: Record<string, unknown>,
    ) {
      const factory = getDartExerciseEngineFactory("DOUBLE_PATTERN_V1");
      const created = factory?.create(configuration as DoublePatternConfigData);
      this.doublePatternEngine =
        created instanceof DoublePatternEngine ? created : null;
    },

    startFinishingStep(
      this: BalancedTrainingPlayContext,
      result: StartTrainingStepResponseData,
    ) {
      self.$store.game.reset();
      self.$store.game.startSession({
        gameTypeKey: result.gameTypeKey,
        rulesetVersionKey: result.rulesetVersionKey,
        sessionId: result.sessionId,
        templateRef: null,
        configSnapshot: {
          ...toSnapshot(FINISHING_RULESET_VERSION_KEY, result.configuration),
          seats: [
            {
              participantRef: result.participant.ref,
              displayName: result.participant.displayName,
              sideKey: "A",
              participantTypeKey: "PLAYER",
            },
          ],
        },
        captureModeKey: result.captureModeKey,
        inputModeKey: result.inputModeKey,
      });
      this.startSessionClock();
      this.finishing = finishingStep(
        () => this.completeCurrentStep(),
        async () => {
          if (this.activityId) await abandonTraining(this.activityId);
        },
      );
    },

    /**
     * Starts the step the engine is on. An already-active game is the one
     * failure the player can resolve without leaving the routine, so it is
     * held in `blockingSession` for the modal rather than thrown — every
     * other failure still reaches the caller's own handling.
     */
    async startCurrentStep(this: BalancedTrainingPlayContext) {
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
     * clock and the header the routine store drives.
     */
    openStep(
      this: BalancedTrainingPlayContext,
      result: StartTrainingStepResponseData,
      durationSeconds: number,
    ) {
      this.currentSessionId = result.sessionId;
      this.currentParticipantRef = result.participant.ref;
      if (this.$store.trainingSession.active) {
        playAudioCue(STEP_CHANGE_CUE_HZ, STEP_CHANGE_CUE_SECONDS);
      }
      this.$store.trainingSession.setStep(result.exerciseTypeKey);

      if (result.exerciseTypeKey === "WARM_UP") {
        this.buildWarmUpEngine(result.configuration);
        this.warmUpReady = false;
        this.warmUpConfiguration = result.configuration;
      }
      if (result.exerciseTypeKey === "SWITCHING") {
        this.buildSwitchingEngine(result.configuration);
        this.startStepTimer(durationSeconds);
      }
      if (result.exerciseTypeKey === "DOUBLE_PATTERN") {
        this.buildDoublePatternEngine(result.configuration);
        this.startStepTimer(durationSeconds);
      }
      if (result.exerciseTypeKey === "GAME") {
        this.startFinishingStep(result);
      }
    },

    /**
     * When the blocking game started, for the modal's own copy. Empty when
     * the server named no start time, so the sentence reads without it.
     */
    blockingStartedLabel(this: BalancedTrainingPlayContext): string {
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
    async resolveBlockingSession(this: BalancedTrainingPlayContext) {
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
    startSessionClock(this: BalancedTrainingPlayContext) {
      if (this.sessionClock) return;
      this.$store.trainingSession.startSession();
      this.sessionClock = new SessionClock({
        onTick: (elapsed) => {
          this.$store.trainingSession.tick(elapsed);
        },
      });
      this.sessionClock.start();
    },

    stopSessionClock(this: BalancedTrainingPlayContext) {
      this.sessionClock?.stop();
      this.sessionClock = null;
    },

    confirmWarmUpReady(this: BalancedTrainingPlayContext) {
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
      this: BalancedTrainingPlayContext,
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

    formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string {
      const minutes = Math.floor(this.warmUpElapsedSeconds / 60);
      const seconds = this.warmUpElapsedSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },

    warmUpHighlightPath(this: BalancedTrainingPlayContext): string {
      return dartboardHighlightPath(this.warmUpEngine?.state().targets ?? []);
    },

    /**
     * The step's own clock. `SegmentTimer` drives both the on-screen
     * countdown and expiry, so there is no second scheduler to drift
     * against it. The engines stay clockless (D264): expiry reaches them
     * as `expireTimer()`.
     */
    startStepTimer(this: BalancedTrainingPlayContext, durationSeconds: number) {
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
          void this.completeCurrentStep();
        },
      });
      this.stepTimer.start();
      this.startSessionClock();
    },

    formattedStepRemaining(this: BalancedTrainingPlayContext): string {
      const remaining = Math.max(0, this.stepRemainingSeconds);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },

    recordSwitchingDart(
      this: BalancedTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.switchingEngine) return;
      this.switchingEngine.record(observation);
    },

    recordDoublePatternDart(
      this: BalancedTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.doublePatternEngine) return;
      this.doublePatternEngine.record(observation);
    },

    switchingPoints(this: BalancedTrainingPlayContext): number {
      return this.switchingEngine?.state().totalPoints ?? 0;
    },

    switchingTargetLabel(this: BalancedTrainingPlayContext): string {
      const target = this.switchingEngine?.state().currentTargetNumber;
      return target === undefined ? "" : String(target);
    },

    doublePatternPoints(this: BalancedTrainingPlayContext): number {
      return this.doublePatternEngine?.state().totalPoints ?? 0;
    },

    doublePatternLabel(this: BalancedTrainingPlayContext): string {
      const double = this.doublePatternEngine?.state().currentDoubleNumber;
      return double === undefined ? "" : `D${double}`;
    },

    dartsThrown(this: BalancedTrainingPlayContext): number {
      return this.activeDartEngine()?.state().dartsThrown ?? 0;
    },

    undoVisit(this: BalancedTrainingPlayContext) {
      this.activeDartEngine()?.undo();
    },

    async uploadCurrentStepFacts(this: BalancedTrainingPlayContext) {
      const engine = this.activeDartEngine() ?? this.warmUpEngine;
      if (!engine || !this.currentSessionId || !this.currentParticipantRef) {
        return;
      }
      const resolved = resolveSoloParticipantRef(
        engine.facts(),
        this.currentParticipantRef,
      );
      const batch = buildEventsBatch(resolved);
      const idempotencyKey = crypto.randomUUID();
      await appendBatch(this.currentSessionId, idempotencyKey, batch);
    },

    /**
     * Snapshots the step that just finished while its engine is still in
     * memory — `advanceAfterStepCompletion` clears every engine field a few
     * lines later, and nothing re-reads them afterwards. Warm-Up throws no
     * darts, so it contributes nothing.
     */
    captureStepSummary(this: BalancedTrainingPlayContext) {
      if (this.switchingEngine) {
        this.stepSummaries.push(
          summariseSwitching(
            this.switchingEngine.state(),
            this.switchingEngine.facts(),
          ),
        );
        return;
      }
      if (this.doublePatternEngine) {
        this.stepSummaries.push(
          summariseDoublePattern(this.doublePatternEngine.state()),
        );
        return;
      }
      const seat = (this.finishing as unknown as TuodPlayContext | null)
        ?.resultsSnapshot?.seats[0];
      if (seat) this.stepSummaries.push(summariseFinishing(seat));
    },

    /**
     * Marks the routine complete server-side. Separate from the summary's
     * own visibility so a failed call leaves the player looking at their
     * results with a retry, rather than at a dead screen.
     */
    async completeRoutine(this: BalancedTrainingPlayContext) {
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

    dismissSummary(this: BalancedTrainingPlayContext) {
      this.$store.trainingSession.reset();
      globalThis.location.href = "/training";
    },

    async completeCurrentStep(this: BalancedTrainingPlayContext) {
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
     * The Finishing step's TenUpOneDown carries its own engine and facts on
     * `$store.game` (via `startFinishingStep`), so its wrapped
     * `abandonAndExit` (`finishing-step.data.ts`) already uploads any
     * partial darts, marks that session ABANDONED, abandons the routine,
     * and redirects to `/training`. Every earlier step has no `GameEngine`,
     * so it abandons the current step's session directly and never touches
     * `$store.game`.
     */
    async abandonAndExit(this: BalancedTrainingPlayContext) {
      if (this.finishing) {
        if (this.stepTimer) {
          this.stepTimer.stop();
          this.stepTimer = null;
        }
        this.stopSessionClock();
        this.$store.trainingSession.reset();
        return (this.finishing as unknown as TuodPlayContext).abandonAndExit();
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
