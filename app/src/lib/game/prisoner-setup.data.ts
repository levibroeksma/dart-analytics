import { createPresetSetupController } from "@lib/game/setup-controller";
import type { PrisonerSetupContext } from "@lib/types";

/**
 * Prisoner setup controller: the preset controller with no per-seat options.
 * Start needs a guest seated; `start` is a no-op while blocked.
 */
export function prisonerSetup() {
  const base = createPresetSetupController<PrisonerSetupContext>({
    gameTypeKey: "PRISONER",
    rulesetVersionKey: "PRISONER_V1",
    playHref: "/games/prisoner/play",
    label: "Prisoner",
  });

  return {
    ...base,

    canStart(this: PrisonerSetupContext) {
      return this.guests.length > 0;
    },

    async start(this: PrisonerSetupContext) {
      if (!this.canStart()) return;
      await base.start.call(this);
    },
  };
}
