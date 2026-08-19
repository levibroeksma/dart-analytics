import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { DoublesTrainingSetupContext } from "./types";

export function doublesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as DoublesTrainingSetupContext["orderMode"],
    ...createPresetSetupController<DoublesTrainingSetupContext>({
      gameTypeKey: "DOUBLES_TRAINING",
      rulesetVersionKey: "DOUBLES_TRAINING_V1",
      playHref: "/games/doubles-training/play",
      label: "Doubles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
      }),
    }),
  };
}
