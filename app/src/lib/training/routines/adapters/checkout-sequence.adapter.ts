import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { summariseCheckoutSequence } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const checkoutSequenceAdapter = dartExerciseAdapter({
  key: "CHECKOUT_SEQUENCE",
  headerLabel: "Catch 40",
  title: "Catch 40",
  panel: "checkout-sequence",
  rulesetKey: "CHECKOUT_SEQUENCE_V1",
  slot: "checkoutSequenceEngine",
  engineClass: CheckoutSequenceEngine,
  summarise: (engine) => summariseCheckoutSequence(engine.state()),
});
