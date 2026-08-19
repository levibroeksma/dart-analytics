import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
      }),
    }),
  };
}
