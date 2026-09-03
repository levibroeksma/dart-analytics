import { createPresetSetupController } from "@lib/game/setup-controller";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import type { ShanghaiSetupContext } from "./types";

/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: ShanghaiSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

/**
 * V1 has no difficulty setting (`ShanghaiConfig` is a `.strict()` empty
 * object) — a guested or DartBot session resolves to it, exactly like
 * `singlesTrainingSetup()`'s own guest/V1 resolver. Solo play keeps the V2
 * difficulty toggle.
 */
export function shanghaiSetup() {
  return {
    difficulty: "NORMAL" as ShanghaiSetupContext["difficulty"],
    ...createPresetSetupController<ShanghaiSetupContext>({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: (ctx) =>
        guested(ctx) ? "SHANGHAI_V1" : "SHANGHAI_V2",
      playHref: "/games/shanghai/play",
      label: "Shanghai",
      configOverrides: (ctx) =>
        guested(ctx) ? {} : { difficulty: ctx.difficulty },
    }),
    addGuest(this: ShanghaiSetupContext) {
      if (addTypedGuest(this)) this.difficulty = "NORMAL";
    },
    addBot(this: ShanghaiSetupContext) {
      if (addBotOpponent(this)) this.difficulty = "NORMAL";
    },
  };
}
