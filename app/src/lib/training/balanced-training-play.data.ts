import {
  startTraining,
  startTrainingStep,
  completeTraining as apiCompleteTraining,
} from "@client/api/training-sessions";
import { appendBatch, completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/training.module";
import { getExerciseEngineFactory } from "@modules/exercise/engine.registry";
import { resolveWarmUpPhaseDurations } from "@modules/exercise/warm-up.engine.module";
import { dartboardHighlightPath } from "@lib/game/board/board-highlight.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { getDartExerciseEngineFactory } from "@modules/exercise/dart-engine.registry";
import { SwitchingEngine } from "@modules/exercise/switching.engine.module";
import { DoublePatternEngine } from "@modules/exercise/double-pattern.engine.module";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { resolveSoloParticipantRef } from "@lib/exercise/solo-participant-upload";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { finishingStep } from "./finishing-step.data";
import type { ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type {
  WarmUpEngineInput,
  SwitchingConfigData,
  DoublePatternConfigData,
} from "@lib/types";
import type { DartObservation } from "@modules/types";
import type { BoardMarker } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";
import type {
  BalancedTrainingPlayContext,
  TrainingStepResolved,
} from "./types";

const ROUTINE_NAME = "Balanced Training";

let self: BalancedTrainingPlayContext;

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
    stepDeadline: null,
    warmUpTimer: null,
    warmUpElapsedSeconds: 0,
    warmUpReady: false,
    warmUpConfiguration: null,
    finishing: null,
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
      } catch {
        this.error =
          "Could not start this routine. Check your connection and retry.";
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
        configSnapshot: { ...result.configuration, seats: [] },
        captureModeKey: result.captureModeKey,
        inputModeKey: result.inputModeKey,
      });
      this.finishing = finishingStep(() => this.completeCurrentStep());
    },

    async startCurrentStep(this: BalancedTrainingPlayContext) {
      const step = this.currentStep();
      if (!this.activityId || !step) return;
      const result = await startTrainingStep(
        this.activityId,
        step.sequenceNumber,
      );
      this.currentSessionId = result.sessionId;
      this.currentParticipantRef = result.participant.ref;

      if (result.exerciseTypeKey === "WARM_UP") {
        this.buildWarmUpEngine(result.configuration);
        this.warmUpReady = false;
        this.warmUpConfiguration = result.configuration;
      }
      if (result.exerciseTypeKey === "SWITCHING") {
        this.buildSwitchingEngine(result.configuration);
        this.armStepDeadline(step.durationSeconds);
      }
      if (result.exerciseTypeKey === "DOUBLE_PATTERN") {
        this.buildDoublePatternEngine(result.configuration);
        this.armStepDeadline(step.durationSeconds);
      }
      if (result.exerciseTypeKey === "GAME") {
        this.startFinishingStep(result);
      }
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
    },

    formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string {
      const minutes = Math.floor(this.warmUpElapsedSeconds / 60);
      const seconds = this.warmUpElapsedSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },

    warmUpHighlightPath(this: BalancedTrainingPlayContext): string {
      return dartboardHighlightPath(this.warmUpEngine?.state().targets ?? []);
    },

    armStepDeadline(
      this: BalancedTrainingPlayContext,
      durationSeconds: number,
    ) {
      this.stepDeadline = setTimeout(() => {
        this.switchingEngine?.expireTimer();
        this.doublePatternEngine?.expireTimer();
        void this.completeCurrentStep();
      }, durationSeconds * 1000);
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

    undoVisit(this: BalancedTrainingPlayContext) {
      this.activeDartEngine()?.undo();
    },

    async uploadCurrentStepFacts(this: BalancedTrainingPlayContext) {
      const engine = this.activeDartEngine();
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

    async completeCurrentStep(this: BalancedTrainingPlayContext) {
      if (!this.currentSessionId || !this.training || !this.activityId) {
        return;
      }
      if (this.stepDeadline) {
        clearTimeout(this.stepDeadline);
        this.stepDeadline = null;
      }
      if (this.warmUpTimer) {
        this.warmUpTimer.stop();
        this.warmUpTimer = null;
      }
      await this.uploadCurrentStepFacts();
      if (this.currentStep()?.exerciseTypeKey !== "GAME") {
        await completeSession(this.currentSessionId, "COMPLETED");
      }
      this.currentSessionId = null;
      this.currentParticipantRef = null;
      this.warmUpEngine = null;
      this.switchingEngine = null;
      this.doublePatternEngine = null;
      this.finishing = null;
      const state = this.training.completeStep();
      if (state.status === "COMPLETE") {
        await apiCompleteTraining(this.activityId);
        globalThis.location.href = "/training";
        return;
      }
      await this.startCurrentStep();
    },
  };
}
