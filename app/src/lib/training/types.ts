import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type { StartTrainingResponseData } from "@client/api/types";
import type { SwitchingEngine } from "@modules/exercise/switching.engine.module";
import type { DartObservation } from "@modules/types";

export type TrainingStepResolved = StartTrainingResponseData["steps"][number];

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
  stepDeadline: ReturnType<typeof setTimeout> | null;
  init(this: BalancedTrainingPlayContext): Promise<void>;
  currentStep(this: BalancedTrainingPlayContext): TrainingStepResolved | null;
  startCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  advanceWarmUp(this: BalancedTrainingPlayContext): void;
  armStepDeadline(
    this: BalancedTrainingPlayContext,
    durationSeconds: number,
  ): void;
  recordSwitchingDart(
    this: BalancedTrainingPlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: BalancedTrainingPlayContext): void;
  uploadCurrentStepFacts(this: BalancedTrainingPlayContext): Promise<void>;
  completeCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
};
