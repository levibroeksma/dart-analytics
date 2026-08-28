import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
  return {
    difficulty: "NORMAL" as ShanghaiSetupContext["difficulty"],
    ...createPresetSetupController<ShanghaiSetupContext>({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: "SHANGHAI_V2",
      playHref: "/games/shanghai/play",
      label: "Shanghai",
      configOverrides: (ctx) => ({
        difficulty: ctx.difficulty,
      }),
    }),
  };
}
