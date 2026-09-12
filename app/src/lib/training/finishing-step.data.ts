import { tuodPlay } from "@lib/game/tuod-play.data";
import type { TuodPlayContext } from "@lib/types";

/**
 * Wraps the existing TUOD play store so the Finishing step's completion
 * also advances the routine. tuodPlay() itself is untouched - its own
 * uploadAndCompleteSession() still uploads facts and marks the
 * exercise_sessions row COMPLETED exactly as a standalone TUOD game does;
 * onStepComplete is the routine's own advance-or-finish call
 * (balanced-training-play.data.ts's completeCurrentStep).
 *
 * The override is never bound to `base` directly - `base` itself lacks
 * `$store` (Alpine injects it only once the object is mounted as
 * `x-data`), so the original method is called through `this` instead,
 * letting Alpine supply the real context at call time.
 */
export function finishingStep(onStepComplete: () => Promise<void>) {
  const base = tuodPlay();
  const originalUpload = base.uploadAndCompleteSession;
  base.uploadAndCompleteSession = async function (this: TuodPlayContext) {
    await originalUpload.call(this);
    await onStepComplete();
  };
  return base;
}
