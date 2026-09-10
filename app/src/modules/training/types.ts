import type { ExerciseRulesetVersionKey } from "@lib/types";

/**
 * One resolved step of a routine as stored in the training snapshot. Resolved,
 * not template-shaped: any adaptive resolution (09-training-routines.md §21)
 * has already been applied before this reaches the runtime.
 */
export type RoutineStepSnapshot = {
  sequenceNumber: number;
  exerciseName: string;
  exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  configuration: Record<string, unknown>;
};

/**
 * The Resolved Training Configuration (§18) — the JSONB written to
 * `activity_configurations.configuration` at Training start and never updated.
 */
export type RoutineSnapshot = {
  routineName: string;
  steps: readonly RoutineStepSnapshot[];
};

export type TrainingState = {
  stepIndex: number;
  stepCount: number;
  currentStep: RoutineStepSnapshot;
  completedStepCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
