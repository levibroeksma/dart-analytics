import { fetchConfigurationPresets, type ConfigurationPresetData } from "@client/api/configuration-templates";
import { createSession } from "@client/api/sessions";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY = "SCORE_TRAINING_V1";

export type ScoreTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  selectedTemplateId: string;
  loading: boolean;
  error: string;
  $store: { game: { startSession(input: unknown): void } };
  init(): Promise<void>;
  start(this: ScoreTrainingSetupContext): Promise<void>;
};

export function scoreTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    selectedTemplateId: "",
    loading: false,
    error: "",

    async init(this: Pick<ScoreTrainingSetupContext, "presets" | "selectedTemplateId">) {
      this.presets = await fetchConfigurationPresets(GAME_TYPE_KEY);
      this.selectedTemplateId = this.presets[0]?.configurationTemplateId ?? "";
    },

    async start(this: ScoreTrainingSetupContext) {
      const preset = this.presets.find((p) => p.configurationTemplateId === this.selectedTemplateId);
      if (!preset) {
        this.error = "Select a preset first.";
        return;
      }
      this.loading = true;
      try {
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
          config: { source: "template", templateRef: preset.configurationTemplateId },
        });
        const config = preset.configuration as { duration_type: "ROUNDS" | "MINUTES"; duration_value: number; max_darts_per_turn: number };
        this.$store.game.startSession({
          gameTypeKey: GAME_TYPE_KEY,
          sessionId: session.sessionId,
          participantRef: session.participants[0].ref,
          configSnapshot: {
            durationType: config.duration_type,
            durationValue: config.duration_value,
            maxDartsPerTurn: config.max_darts_per_turn,
          },
        });
        globalThis.location.href = "/games/score-training/play";
      } catch {
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
