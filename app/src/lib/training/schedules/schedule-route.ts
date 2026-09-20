const SCHEDULE_PARAM = "schedule";

/** The schedule id the current page was opened for (`?schedule=<id>`), or null. */
export function scheduleIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(SCHEDULE_PARAM);
  return value && value.trim().length > 0 ? value : null;
}

export function scheduleEditPath(scheduleId: string): string {
  return `/training/schedules/edit?${SCHEDULE_PARAM}=${encodeURIComponent(scheduleId)}`;
}
