import type { RoutinesLocation } from "./types";

const SESSION_PARAM = "session";

/** The session id the replay page was opened for (`?session=<id>`), or null. */
export function replaySessionIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(SESSION_PARAM);
  return value && value.trim().length > 0 ? value : null;
}

/** A session's replay page (D371 decision 9): a prerendered shell that reads the id client-side. */
export function replayPath(sessionId: string): string {
  return `/statistics/replay?${SESSION_PARAM}=${encodeURIComponent(sessionId)}`;
}

/** `/statistics`, opened on the Routines tab at `routineKey`'s `stepKey` when a routine is given. */
export function statisticsPath(
  routineKey: string | null,
  stepKey: string | null,
): string {
  if (routineKey === null) return "/statistics";
  const base = `/statistics?tab=routines&routine=${encodeURIComponent(routineKey)}`;
  return stepKey === null
    ? base
    : `${base}&step=${encodeURIComponent(stepKey)}`;
}

/** The routine and step `/statistics` was opened at (`?tab=routines&routine=<key>&step=<key>`), or null when the Routines tab names no routine. */
export function routinesLocationFromLocation(): RoutinesLocation | null {
  if (typeof window === "undefined") return null;
  const params = new URL(window.location.href).searchParams;
  const routineKey = params.get("routine");
  if (params.get("tab") !== "routines" || !routineKey?.trim()) return null;
  const stepKey = params.get("step");
  return { routineKey, stepKey: stepKey?.trim() ? stepKey : null };
}
