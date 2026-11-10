import { createPresetSetupController } from "@lib/game/setup-controller";
import { mintAceDrawSeed } from "@lib/game/ace-seats";
import { ACE_ROUNDS_MAX, ACE_ROUNDS_MIN } from "@lib/game/rulesets/types";
import type { AceSetupContext } from "@lib/types";

const DEFAULT_ROUNDS = 8;

function clampRounds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_ROUNDS;
  }
  return Math.min(ACE_ROUNDS_MAX, Math.max(ACE_ROUNDS_MIN, Math.floor(value)));
}

/**
 * Ace setup controller: the preset controller plus the round count. The
 * draw seed is minted at Start and sent with `rounds` as the config
 * overrides, since the preset carries no seed. Start needs a guest seated;
 * `start` is a no-op while blocked.
 */
export function aceSetup() {
  const base = createPresetSetupController<AceSetupContext>({
    gameTypeKey: "ACE",
    rulesetVersionKey: "ACE_V1",
    playHref: "/games/ace/play",
    label: "Ace",
    configOverrides: (ctx) => ({
      rounds: clampRounds(ctx.rounds),
      drawSeed: mintAceDrawSeed(),
    }),
  });

  return {
    ...base,
    rounds: DEFAULT_ROUNDS,

    /** Loads the presets, then takes the preset's round count as the starting value. */
    async init(this: AceSetupContext) {
      await base.init.call(this);
      const configured = (
        this.presets[0]?.configuration as { rounds?: unknown } | undefined
      )?.rounds;
      this.rounds = clampRounds(configured);
    },

    canStart(this: AceSetupContext) {
      return this.guests.length > 0;
    },

    async start(this: AceSetupContext) {
      if (!this.canStart()) return;
      await base.start.call(this);
    },
  };
}
