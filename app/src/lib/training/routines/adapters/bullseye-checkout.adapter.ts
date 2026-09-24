import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { summariseBullseyeCheckout } from "@modules/training/routines/routine-summary.module";
import type { BullseyeCheckoutConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const bullseyeCheckoutAdapter: StepAdapter = {
  key: "BULLSEYE_CHECKOUT",
  headerLabel: "Bullseye checkouts",
  panel: "bullseye-checkout",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("BULLSEYE_CHECKOUT_V1");
    const created = factory?.create(
      result.configuration as BullseyeCheckoutConfigData,
    );
    ctx.bullseyeCheckoutEngine =
      created instanceof BullseyeCheckoutEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.bullseyeCheckoutEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.bullseyeCheckoutEngine) return null;
    return summariseBullseyeCheckout(ctx.bullseyeCheckoutEngine.state());
  },
  close(ctx) {
    ctx.bullseyeCheckoutEngine = null;
  },
};
