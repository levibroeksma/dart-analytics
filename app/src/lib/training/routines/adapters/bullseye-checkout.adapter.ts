import { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { summariseBullseyeCheckout } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const bullseyeCheckoutAdapter = dartExerciseAdapter({
  key: "BULLSEYE_CHECKOUT",
  headerLabel: "Bullseye checkouts",
  title: "Bullseye Checkouts",
  panel: "bullseye-checkout",
  rulesetKey: "BULLSEYE_CHECKOUT_V1",
  slot: "bullseyeCheckoutEngine",
  engineClass: BullseyeCheckoutEngine,
  summarise: (engine) => summariseBullseyeCheckout(engine.state()),
});
