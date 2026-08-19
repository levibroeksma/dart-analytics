import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function shanghaiSetup() {
  return createPresetSetupController<ShanghaiSetupContext>({
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    playHref: "/games/shanghai/play",
    label: "Shanghai",
  });
}
