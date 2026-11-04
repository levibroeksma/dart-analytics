import { durationSetupData } from "@lib/game/duration-setup.data";
import { startPresetSession } from "@lib/game/setup-controller";
import { createSetupSession } from "@lib/game/setup-session";
import { clampTuodDuration } from "@lib/game/tuod-duration";
import type { TuodDurationType, TuodSetupContext } from "./types";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY = "TUOD_V1";

const FALLBACK_DURATION: Record<TuodDurationType, number> = {
  ROUNDS: 10,
  MINUTES: 10,
};

export function tuodSetup() {
  return {
    ...createSetupSession({
      gameTypeKey: GAME_TYPE_KEY,
      playHref: "/games/tuod/play",
    }),
    ...durationSetupData<TuodDurationType>({
      gameTypeKey: GAME_TYPE_KEY,
      fallback: FALLBACK_DURATION,
    }),

    async start(this: TuodSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      const { value } = clampTuodDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;

      await startPresetSession(this, {
        gameTypeKey: GAME_TYPE_KEY,
        rulesetVersionKey: RULESET_VERSION_KEY,
        playHref: "/games/tuod/play",
        preset,
        overrides: { duration_value: value },
      });
    },
  };
}
