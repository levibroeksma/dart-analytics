import { createPresetSetupController } from "@lib/game/setup-controller";
import type { AroundTheClockSetupContext } from "./types";

export function aroundTheClockSetup() {
  return createPresetSetupController<AroundTheClockSetupContext>({
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    playHref: "/games/around-the-clock/play",
    label: "Around the Clock",
  });
}
