import { createPresetSetupController } from "@lib/game/setup-controller";
import type { CricketSetupContext } from "./types";

export function cricketSetup() {
  return createPresetSetupController<CricketSetupContext>({
    gameTypeKey: "CRICKET",
    rulesetVersionKey: (ctx) =>
      ctx.guests.length > 0 || ctx.bot !== null ? "CRICKET_V2" : "CRICKET_V1",
    playHref: "/games/cricket/play",
    label: "Cricket",
  });
}
