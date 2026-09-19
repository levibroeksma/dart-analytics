import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    scoringMode: "STANDARD" as SinglesTrainingSetupContext["scoringMode"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V3",
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
        difficulty: ctx.difficulty,
        scoring_mode: ctx.scoringMode,
      }),
    }),
  };
}
