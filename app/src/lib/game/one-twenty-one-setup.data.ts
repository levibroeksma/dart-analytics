import { createPresetSetupController } from "@lib/game/setup-controller";
import type { OneTwentyOneSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function oneTwentyOneSetup() {
  return createPresetSetupController<OneTwentyOneSetupContext>({
    gameTypeKey: "ONE_TWENTY_ONE",
    rulesetVersionKey: "121_V1",
    playHref: "/games/121/play",
    label: "121",
  });
}
