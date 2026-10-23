import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

export function bobs27Setup() {
  return {
    easy: false as Bobs27SetupContext["easy"],
    ...createPresetSetupController<Bobs27SetupContext>({
      gameTypeKey: "BOBS27",
      rulesetVersionKey: (ctx) => (ctx.easy ? "BOBS27_V2" : "BOBS27_V1"),
      playHref: "/games/bobs27/play",
      label: "Bob's 27",
      configOverrides: (ctx) => (ctx.easy ? { mode: "EASY" } : undefined),
    }),
  };
}
