import { createPresetSetupController } from "@lib/game/setup-controller";
import type { BaseballSetupContext } from "./types";

export function baseballSetup() {
  return createPresetSetupController<BaseballSetupContext>({
    gameTypeKey: "BASEBALL",
    rulesetVersionKey: "BASEBALL_V1",
    playHref: "/games/baseball/play",
    label: "Baseball Darts",
  });
}
