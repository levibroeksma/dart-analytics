import { getExerciseEngineFactory } from "@modules/training/exercises/engine.registry";
import type { ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type { WarmUpEngineInput } from "@lib/types";
import type { StepAdapter } from "./interfaces";

/**
 * Warm-Up throws no darts and produces no routine-summary row — its
 * `summarise` always returns `null`, mirroring the pre-adapter code, which
 * never pushed a summary for it either.
 */
export const warmUpAdapter: StepAdapter = {
  key: "WARM_UP",
  headerLabel: "warm up",
  panel: "warm-up",
  open(ctx, result) {
    const factory = getExerciseEngineFactory("WARM_UP_V1");
    ctx.warmUpEngine = factory
      ? (factory.create(
          result.configuration as WarmUpEngineInput,
        ) as ExerciseEngine<WarmUpState>)
      : null;
    ctx.warmUpReady = false;
    ctx.warmUpConfiguration = result.configuration;
  },
  facts(ctx) {
    return ctx.warmUpEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise() {
    return null;
  },
  close(ctx) {
    ctx.warmUpEngine = null;
    ctx.warmUpTimer?.stop();
    ctx.warmUpTimer = null;
  },
};
