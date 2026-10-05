import type { RoutinesLocation } from "./types";

/** The routine and step `/statistics` was opened at (`?tab=routines&routine=<key>&step=<key>`), or null when the Routines tab names no routine. */
export function routinesLocationFromLocation(): RoutinesLocation | null {
  if (typeof window === "undefined") return null;
  const params = new URL(window.location.href).searchParams;
  const routineKey = params.get("routine");
  if (params.get("tab") !== "routines" || !routineKey?.trim()) return null;
  const stepKey = params.get("step");
  return { routineKey, stepKey: stepKey?.trim() ? stepKey : null };
}
