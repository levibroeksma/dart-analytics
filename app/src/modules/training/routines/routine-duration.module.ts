import type {
  RoutineDurationOptions,
  RoutineDurationResult,
  RoutineStepDuration,
} from "@modules/types";

/**
 * A routine is one focused training block and may not exceed sixty minutes of
 * active training (09-Training/01-Routines.md §7). Its duration is the sum of its
 * steps and is never stored independently (§6), so this cannot be a database
 * CHECK — a CHECK cannot sum sibling rows — and is enforced at commit by
 * `trg_routine_steps_duration_bounds` (migration `0038`); this module is the
 * shared pre-validation both the builder and the service run.
 *
 * A `ROUNDS` step contributes zero minutes: rounds have no wall-clock
 * duration, so a routine built only from them is accepted. Bounding those is a
 * separate rule, and does not exist yet.
 */
export const MAX_ROUTINE_MINUTES = 60;

/** User-authored routines also satisfy a floor (01-Routines.md §7, D305). */
export const MIN_USER_ROUTINE_MINUTES = 30;

function sequenceIssues(steps: readonly RoutineStepDuration[]): string[] {
  const ordered = [...steps]
    .map((step) => step.sequenceNumber)
    .sort((a, b) => a - b);
  return ordered.flatMap((sequenceNumber, index) =>
    sequenceNumber === index + 1
      ? []
      : [`step sequence must be 1..n with no gaps or duplicates`],
  );
}

export function validateRoutineDuration(
  steps: readonly RoutineStepDuration[],
  options: RoutineDurationOptions = {},
): RoutineDurationResult {
  const minMinutes = options.minMinutes ?? 0;
  const maxMinutes = options.maxMinutes ?? MAX_ROUTINE_MINUTES;
  const issues: string[] = [];

  if (steps.length === 0) issues.push("a routine must hold at least one step");

  for (const step of steps) {
    if (!Number.isInteger(step.durationValue) || step.durationValue < 1) {
      issues.push(
        `step ${step.sequenceNumber} must have a positive whole duration`,
      );
    }
  }

  issues.push(...new Set(sequenceIssues(steps)));

  const totalMinutes = steps.reduce(
    (total, step) =>
      step.durationTypeKey === "MINUTES"
        ? total + Math.max(step.durationValue, 0)
        : total,
    0,
  );

  if (totalMinutes < minMinutes) {
    issues.push(
      `routine is ${totalMinutes} minutes; the minimum is ${minMinutes}`,
    );
  }
  if (totalMinutes > maxMinutes) {
    issues.push(
      `routine is ${totalMinutes} minutes; the maximum is ${maxMinutes}`,
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, totalMinutes };
}
