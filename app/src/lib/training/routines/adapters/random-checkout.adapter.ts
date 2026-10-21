import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { summariseRandomCheckout } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const randomCheckoutAdapter = dartExerciseAdapter({
  key: "RANDOM_CHECKOUT",
  headerLabel: "Random Checkout",
  title: "Random Checkout",
  panel: "random-checkout",
  rulesetKey: "RANDOM_CHECKOUT_V1",
  slot: "randomCheckoutEngine",
  engineClass: RandomCheckoutEngine,
  summarise: (engine) => summariseRandomCheckout(engine.state()),
});
