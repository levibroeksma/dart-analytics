import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function bobs27Setup() {
  return createPresetSetupController<Bobs27SetupContext>({
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    playHref: "/games/bobs27/play",
    label: "Bob's 27",
  });
}
