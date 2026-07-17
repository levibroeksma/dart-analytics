import { fetchConfigurationPresets, type ConfigurationPresetData } from "@client/api/configuration-templates";
import { createSession, fetchActiveSessions, completeSession, type SessionActiveData } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { ScoreTrainingSetupContext } from "./types";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY = "SCORE_TRAINING_V1";

export function scoreTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    selectedTemplateId: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.selectedTemplateId = presets[0]?.configurationTemplateId ?? "";

        await this.reconcile(activeSessions);
      } catch {
        // Preset/active-session fetch itself failed — degrade to picker per
        // spec's "Setup Page Errors" (fetch failures show toast + picker as
        // fallback; this is distinct from an abandon_failed reconciliation).
        this.showActiveSessionModal = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async reconcile(this: ScoreTrainingSetupContext, activeSessions: SessionActiveData[]) {
      const result = await reconcileActiveSession(this.$store.game.sessionId, activeSessions, this.$store.game);

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        // Block: do not show the picker, do not allow session creation.
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: ScoreTrainingSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/score-training/play";
    },

    async abandonSession(this: ScoreTrainingSetupContext) {
      if (!this.activeSession) return;
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      }
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
        const config = preset.configuration as {
          duration_type: "ROUNDS" | "MINUTES";
          duration_value: number;
          max_darts_per_turn: number;
        };
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
