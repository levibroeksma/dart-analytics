const ROUTINE_PARAM = "routine";

/** The routine id the current page was opened for (`?routine=<id>`), or null. */
export function routineIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(ROUTINE_PARAM);
  return value && value.trim().length > 0 ? value : null;
}

export function routineDetailPath(routineId: string): string {
  return `/training/routines/detail?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}

export function routinePlayPath(routineId: string): string {
  return `/training/routines/play?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}

export function routineEditPath(routineId: string): string {
  return `/training/routines/edit?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}
