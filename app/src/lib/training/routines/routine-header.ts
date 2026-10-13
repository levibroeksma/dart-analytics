import type { RoutineHeader, RoutineHeaderInput } from "./types";

/**
 * The routine play header (design `Exercise Play.dc.html`): the step's
 * title over `STEP n OF m`, and the step clock — a countdown for a scored
 * exercise, elapsed time for Warm-Up, nothing for a game step (its own
 * countdown sits above the game). Behind the ready gate and after the last
 * step, the routine's name stands in.
 */
export function routineHeader(input: RoutineHeaderInput): RoutineHeader {
  const idle = { clock: "", clockLabel: "" };
  if (input.finished) {
    return { title: input.routineName, subtitle: "COMPLETE", ...idle };
  }
  if (!input.ready || !input.adapter || input.stepIndex < 0) {
    return { title: input.routineName, subtitle: "", ...idle };
  }
  const subtitle = `STEP ${input.stepIndex + 1} OF ${input.stepCount}`;
  if (input.adapter.panel === "warm-up") {
    return {
      title: input.adapter.title,
      subtitle,
      clock: input.warmUpElapsed,
      clockLabel: "Elapsed",
    };
  }
  if (input.stepRemaining !== null) {
    return {
      title: input.adapter.title,
      subtitle,
      clock: input.stepRemaining,
      clockLabel: "Step time remaining",
    };
  }
  return { title: input.adapter.title, subtitle, ...idle };
}
