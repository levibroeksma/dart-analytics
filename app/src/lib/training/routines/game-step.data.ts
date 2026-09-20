import { playAbandonAndExit } from "@lib/game/play-lifecycle";
import type { PlayLifecycleContext } from "@lib/types";
import type { GameEngine } from "@modules/interfaces";
import type { DartObservation } from "@modules/types";
import type { GameStepPlayContext } from "./types";

/**
 * Wraps a routine-eligible game's own play store so its completion also
 * advances the routine. `playFactory` itself is untouched — its
 * `uploadAndCompleteSession()` still uploads facts and marks the
 * `exercise_sessions` row COMPLETED exactly as a standalone session of that
 * game does; `onStepComplete` is the routine's own advance-or-finish call
 * (`routine-play.data.ts`'s `completeCurrentStep`). `abandonAndExit` is
 * replaced outright rather than delegating to the original (which redirects
 * to `/games`) so leaving mid-step lands back on `/training` and also
 * abandons the routine itself via `onAbandon`.
 *
 * The advance is gated on `completionStatus`: `playUploadAndCompleteSession`
 * reports an upload failure by setting `completionStatus = "failed"` and
 * returning rather than throwing, so an unconditional call here would
 * complete the routine with the step's darts never persisted.
 *
 * Both overrides are never bound to `base` directly — `base` itself lacks
 * `$store` (Alpine injects it only once the object is mounted as
 * `x-data`), so each original/shared call goes through `this` instead,
 * letting Alpine supply the real context at call time. `playAbandonAndExit`
 * needs the fuller `PlayLifecycleContext` shape (`$store`, `engine`, the
 * upload/error fields) that `GameStepPlayContext` deliberately omits — `T`
 * is generic here precisely so `gameStep` works across every routine-
 * eligible game, so the call is cast rather than typed exactly; every real
 * caller (`tuodPlay`, `scoreTrainingPlay`, `oneTwentyOnePlay`) actually
 * satisfies `PlayLifecycleContext` at runtime.
 */
export function gameStep<T extends GameStepPlayContext>(
  playFactory: () => T,
  onStepComplete: () => Promise<void>,
  onAbandon: () => void | Promise<void>,
): T {
  const base = playFactory();
  const originalUpload = base.uploadAndCompleteSession;
  base.uploadAndCompleteSession = async function (this: T) {
    await originalUpload.call(this);
    if (this.completionStatus !== "succeeded") return;
    await onStepComplete();
  };
  base.abandonAndExit = async function (this: T) {
    this.timer?.stop();
    await playAbandonAndExit(
      this as unknown as PlayLifecycleContext<
        unknown,
        GameEngine<DartObservation, unknown>,
        unknown
      >,
      onAbandon,
      "/training",
    );
  };
  return base;
}
