import { searchParamFromLocation } from "@lib/location";

const ROUTINE_PARAM = "routine";

/** The routine id the current page was opened for (`?routine=<id>`), or null. */
export function routineIdFromLocation(): string | null {
  return searchParamFromLocation(ROUTINE_PARAM);
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
