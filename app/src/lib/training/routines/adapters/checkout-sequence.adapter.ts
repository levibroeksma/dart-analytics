import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { summariseCheckoutSequence } from "@modules/training/routines/routine-summary.module";
import type { CheckoutSequenceConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const checkoutSequenceAdapter: StepAdapter = {
  key: "CHECKOUT_SEQUENCE",
  headerLabel: "Catch 40",
  panel: "checkout-sequence",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("CHECKOUT_SEQUENCE_V1");
    const created = factory?.create(
      result.configuration as CheckoutSequenceConfigData,
    );
    ctx.checkoutSequenceEngine =
      created instanceof CheckoutSequenceEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.checkoutSequenceEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.checkoutSequenceEngine) return null;
    return summariseCheckoutSequence(ctx.checkoutSequenceEngine.state());
  },
  close(ctx) {
    ctx.checkoutSequenceEngine = null;
  },
};
