import { createPresetSetupController } from "@lib/game/setup-controller";
import type { TacticsSetupContext } from "./types";

export function tacticsSetup() {
  return createPresetSetupController<TacticsSetupContext>({
    gameTypeKey: "TACTICS",
    rulesetVersionKey: (ctx) =>
      ctx.guests.length > 0 ? "TACTICS_V2" : "TACTICS_V1",
    playHref: "/games/tactics/play",
    label: "Tactics",
  });
}
