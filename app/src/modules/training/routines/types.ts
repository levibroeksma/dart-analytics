import type { ExerciseRulesetVersionKey } from "@lib/types";

/**
 * One resolved step of a routine as stored in the training snapshot. Resolved,
 * not template-shaped: any adaptive resolution (09-Training/01-Routines.md §21)
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

/**
 * One step's duration contribution as validated by `routine-duration.module`
 * — a narrower shape than `RoutineStepSnapshot`, since duration validation
 * needs neither the exercise ruleset nor its configuration.
 */
export type RoutineStepDuration = {
  sequenceNumber: number;
  durationTypeKey: "ROUNDS" | "MINUTES";
  durationValue: number;
};

export type RoutineDurationResult =
  { ok: true; totalMinutes: number } | { ok: false; issues: string[] };

/**
 * Options for `validateRoutineDuration` (`routine-duration.module.ts`).
 */
export type RoutineDurationOptions = {
  /** Inclusive floor on the MINUTES total; 0 disables it. */
  minMinutes?: number;
  /** Inclusive cap on the MINUTES total; defaults to MAX_ROUTINE_MINUTES. */
  maxMinutes?: number;
};

/**
 * One line of a routine summary card. `value` is already formatted for
 * display — the modal renders rows through `x-for` and formats nothing.
 */
export type RoutineStatRow = {
  label: string;
  value: string;
};

/**
 * One completed exercise's contribution to the routine summary. Warm-Up
 * throws no darts and produces none, which is why no adapter ever pushes one
 * for it. `stepKey` is a plain string — `StepAdapterKey`-compatible
 * (`"SWITCHING"`, `"DOUBLE_PATTERN"`, `"GAME:<rulesetVersionKey>"`) — rather
 * than importing that type from `lib/training/routines/adapters/`, which
 * would invert the `lib` → `modules` dependency direction.
 */
export type RoutineStepSummary = {
  stepKey: string;
  label: string;
  rows: RoutineStatRow[];
};
