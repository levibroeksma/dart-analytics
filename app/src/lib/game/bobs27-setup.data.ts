import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

export function bobs27Setup() {
  return createPresetSetupController<Bobs27SetupContext>({
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    playHref: "/games/bobs27/play",
    label: "Bob's 27",
  });
}
