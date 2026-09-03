import { createPresetSetupController } from "@lib/game/setup-controller";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: SinglesTrainingSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: (ctx) => (guested(ctx) ? "SINGLES_V1" : "SINGLES_V2"),
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
        difficulty: ctx.difficulty,
      }),
    }),
    addGuest(this: SinglesTrainingSetupContext) {
      if (addTypedGuest(this)) this.difficulty = "EASY";
    },
    addBot(this: SinglesTrainingSetupContext) {
      if (addBotOpponent(this)) this.difficulty = "EASY";
    },
  };
}
