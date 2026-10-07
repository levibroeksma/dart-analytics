import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { summariseRandomCheckout } from "@modules/training/routines/routine-summary.module";
import type { RandomCheckoutConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const randomCheckoutAdapter: StepAdapter = {
  key: "RANDOM_CHECKOUT",
  headerLabel: "Random Checkout",
  panel: "random-checkout",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("RANDOM_CHECKOUT_V1");
    const created = factory?.create(
      result.configuration as RandomCheckoutConfigData,
    );
    ctx.randomCheckoutEngine =
      created instanceof RandomCheckoutEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.randomCheckoutEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.randomCheckoutEngine) return null;
    return summariseRandomCheckout(ctx.randomCheckoutEngine.state());
  },
  close(ctx) {
    ctx.randomCheckoutEngine = null;
  },
};
