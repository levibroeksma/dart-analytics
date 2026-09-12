import {
  startTraining,
  startTrainingStep,
  completeTraining as apiCompleteTraining,
} from "@client/api/training-sessions";
import { completeSession } from "@client/api/sessions";
import { trainingEngine } from "@modules/training/training.module";
import { getExerciseEngineFactory } from "@modules/exercise/engine.registry";
import "@modules/exercise/warm-up.engine.module";
import type { ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type { WarmUpEngineInput } from "@lib/types";
import type {
  BalancedTrainingPlayContext,
  TrainingStepResolved,
} from "./types";

const ROUTINE_NAME = "Balanced Training";

export function balancedTrainingPlay(): BalancedTrainingPlayContext {
  return {
    loading: false,
    error: "",
    activityId: null,
    steps: [],
    currentSessionId: null,
    currentParticipantRef: null,
    training: null,
    warmUpEngine: null,

    async init(this: BalancedTrainingPlayContext) {
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
        const factory = getExerciseEngineFactory("WARM_UP_V1");
        this.warmUpEngine = factory
          ? (factory.create(
              result.configuration as WarmUpEngineInput,
            ) as ExerciseEngine<WarmUpState>)
          : null;
      }
    },

    advanceWarmUp(this: BalancedTrainingPlayContext) {
      if (!this.warmUpEngine) return;
      this.warmUpEngine.advance();
      if (this.warmUpEngine.isComplete()) {
        void this.completeCurrentStep();
      }
    },

    async completeCurrentStep(this: BalancedTrainingPlayContext) {
      if (!this.currentSessionId || !this.training || !this.activityId) {
        return;
      }
      await completeSession(this.currentSessionId, "COMPLETED");
      this.currentSessionId = null;
      this.currentParticipantRef = null;
      this.warmUpEngine = null;
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
