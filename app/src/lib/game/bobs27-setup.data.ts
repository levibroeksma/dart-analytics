import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

export function bobs27Setup() {
  return {
    mode: "CLASSIC" as Bobs27SetupContext["mode"],
    ...createPresetSetupController<Bobs27SetupContext>({
      gameTypeKey: "BOBS27",
      rulesetVersionKey: (ctx) =>
        ctx.mode === "EASY" ? "BOBS27_V2" : "BOBS27_V1",
      playHref: "/games/bobs27/play",
      label: "Bob's 27",
      configOverrides: (ctx) =>
        ctx.mode === "EASY" ? { mode: "EASY" } : undefined,
    }),
  };
}
