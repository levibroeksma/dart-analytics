const GENERIC_ISSUE = "The schedule was not accepted.";

/**
 * Formats a schedule `VALIDATION_FAILED` envelope's `details` into a single
 * user-facing line. The service reports `{ reason, dayOfWeek? }` — a bare
 * duplicate-weekday check has no weekday to name, an unknown routine id does.
 */
export function formatScheduleIssues(
  details: Record<string, unknown> | undefined,
): string[] {
  if (!details) return [GENERIC_ISSUE];
  const reason =
    typeof details.reason === "string" ? details.reason : GENERIC_ISSUE;
  return [
    typeof details.dayOfWeek === "number"
      ? `${reason} (day ${details.dayOfWeek})`
      : reason,
  ];
}
