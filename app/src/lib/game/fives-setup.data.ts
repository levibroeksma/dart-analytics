import { createPresetSetupController } from "@lib/game/setup-controller";
import type { FivesSetupContext } from "@lib/types";

/**
 * Fives setup controller: the preset controller with no per-seat options.
 * Start needs a guest seated (the setup screens seat one); `start` is a
 * no-op while blocked.
 */
export function fivesSetup() {
  const base = createPresetSetupController<FivesSetupContext>({
    gameTypeKey: "FIVES",
    rulesetVersionKey: "FIVES_V1",
    playHref: "/games/fives/play",
    label: "Fives",
  });

  return {
    ...base,

    canStart(this: FivesSetupContext) {
      return this.guests.length > 0;
    },

    async start(this: FivesSetupContext) {
      if (!this.canStart()) return;
      await base.start.call(this);
    },
  };
}
