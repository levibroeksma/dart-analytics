import { createPresetSetupController } from "@lib/game/setup-controller";
import { starterFirstNumbers } from "@lib/game/killer-seats";
import type { KillerSetupContext } from "@lib/types";

/**
 * Killer setup controller: the preset controller plus the two seats' target
 * numbers. Start needs exactly one guest and two different numbers; `start`
 * is a no-op while blocked.
 */
export function killerSetup() {
  const base = createPresetSetupController<KillerSetupContext>({
    gameTypeKey: "KILLER",
    rulesetVersionKey: "KILLER_V1",
    playHref: "/games/killer/play",
    label: "Killer",
    configOverrides: (ctx) => ({
      seat_numbers: starterFirstNumbers(ctx.seatNumbers, ctx.starterIndex),
    }),
  });

  return {
    ...base,
    seatNumbers: [20, 19] as [number, number],

    canStart(this: KillerSetupContext) {
      return this.startBlockedReason() === "";
    },

    startBlockedReason(this: KillerSetupContext) {
      if (this.guests.length !== 1) return "Add a guest to play Killer.";
      if (this.seatNumbers[0] === this.seatNumbers[1])
        return "Pick different numbers.";
      return "";
    },

    async start(this: KillerSetupContext) {
      if (!this.canStart()) return;
      await base.start.call(this);
    },
  };
}
