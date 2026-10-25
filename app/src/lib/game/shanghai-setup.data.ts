import { createPresetSetupController } from "@lib/game/setup-controller";
import { SHANGHAI_RANGES } from "./shanghai-ranges.data";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
  return {
    difficulty: "NORMAL" as ShanghaiSetupContext["difficulty"],
    range: "1-20" as ShanghaiSetupContext["range"],
    winRule: "INSTANT" as ShanghaiSetupContext["winRule"],
    ...createPresetSetupController<ShanghaiSetupContext>({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: "SHANGHAI_V3",
      playHref: "/games/shanghai/play",
      label: "Shanghai",
      configOverrides: (ctx) => {
        const range =
          SHANGHAI_RANGES.find((entry) => entry.value === ctx.range) ??
          SHANGHAI_RANGES[0];
        return {
          difficulty: ctx.difficulty,
          range_start: range.rangeStart,
          range_end: range.rangeEnd,
          instant_win: ctx.winRule === "INSTANT",
        };
      },
    }),
  };
}
