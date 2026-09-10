import type {
  RoutineDurationResult,
  RoutineStepDuration,
} from "@modules/types";

/**
 * A routine is one focused training block and may not exceed sixty minutes of
 * active training (09-training-routines.md §7). Its duration is the sum of its
 * steps and is never stored independently (§6), so this cannot be a database
 * CHECK — a CHECK cannot sum sibling rows — and the repository uses no
 * triggers. It is validated here and called from every routine write.
 *
 * A `ROUNDS` step contributes zero minutes: rounds have no wall-clock
 * duration, so a routine built only from them is accepted. Bounding those is a
 * separate rule, and does not exist yet.
 */
export const MAX_ROUTINE_MINUTES = 60;

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
): RoutineDurationResult {
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

  if (totalMinutes > MAX_ROUTINE_MINUTES) {
    issues.push(
      `routine is ${totalMinutes} minutes; the maximum is ${MAX_ROUTINE_MINUTES}`,
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, totalMinutes };
}
