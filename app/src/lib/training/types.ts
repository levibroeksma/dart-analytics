import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type { StartTrainingResponseData } from "@client/api/types";

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
  init(this: BalancedTrainingPlayContext): Promise<void>;
  currentStep(this: BalancedTrainingPlayContext): TrainingStepResolved | null;
  startCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  advanceWarmUp(this: BalancedTrainingPlayContext): void;
  completeCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
};
