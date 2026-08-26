import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
  return createPresetSetupController<ShanghaiSetupContext>({
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    playHref: "/games/shanghai/play",
    label: "Shanghai",
  });
}
