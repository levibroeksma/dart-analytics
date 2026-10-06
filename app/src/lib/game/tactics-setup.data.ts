import { createPresetSetupController } from "@lib/game/setup-controller";
import type { TacticsSetupContext } from "./types";

export function tacticsSetup() {
  return createPresetSetupController<TacticsSetupContext>({
    gameTypeKey: "TACTICS",
    rulesetVersionKey: "TACTICS_V1",
    playHref: "/games/tactics/play",
    label: "Tactics",
  });
}
