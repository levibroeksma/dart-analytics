import { durationSetupData } from "@lib/game/duration-setup.data";
import { clampScoreTrainingDuration } from "@lib/game/score-training-duration";
import { startPresetSession } from "@lib/game/setup-controller";
import { createSetupSession } from "@lib/game/setup-session";
import type {
  ScoreTrainingDurationType,
  ScoreTrainingSetupContext,
} from "./types";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY = "SCORE_TRAINING_V1";

const FALLBACK_DURATION: Record<ScoreTrainingDurationType, number> = {
  ROUNDS: 10,
  MINUTES: 5,
};

export function scoreTrainingSetup() {
  return {
    ...createSetupSession({
      gameTypeKey: GAME_TYPE_KEY,
      playHref: "/games/score-training/play",
    }),
    ...durationSetupData<ScoreTrainingDurationType>({
      gameTypeKey: GAME_TYPE_KEY,
      fallback: FALLBACK_DURATION,
    }),

    /**
     * Unreachable while this game has an ACTIVE session, held here or
     * elsewhere: the setup modal hides the picker until the player
     * continues or abandons it (single active session, D118; D460).
     */
    async start(this: ScoreTrainingSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }
      const { value } = clampScoreTrainingDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;

      await startPresetSession(this, {
        gameTypeKey: GAME_TYPE_KEY,
        rulesetVersionKey: RULESET_VERSION_KEY,
        playHref: "/games/score-training/play",
        preset,
        overrides: { duration_value: value },
      });
    },
  };
}
