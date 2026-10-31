import { createPresetSetupController } from "@lib/game/setup-controller";
import type { MickeyMouseSetupContext } from "./types";

export function mickeyMouseSetup() {
  return createPresetSetupController<MickeyMouseSetupContext>({
    gameTypeKey: "MICKEY_MOUSE",
    rulesetVersionKey: "MICKEY_MOUSE_V1",
    playHref: "/games/mickey-mouse/play",
    label: "Mickey Mouse",
  });
}
