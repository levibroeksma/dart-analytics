import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import {
  createSession,
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import {
  clampScoreTrainingDuration,
  scoreTrainingDurationClampNotice,
} from "@lib/game/score-training-duration";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
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

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number, so callers fall back to `FALLBACK_DURATION`.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

export function scoreTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as ScoreTrainingDurationType,
    durationValue: 10 as number | string | null,
    clampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    /**
     * On fetch failure, keeps the user on setup with a visible error and the
     * picker fallback rather than the active-session modal.
     */
    async init(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.durationType = "ROUNDS";
        this.durationValue =
          durationValueOf(this.presetForMode("ROUNDS")) ??
          FALLBACK_DURATION.ROUNDS;
        this.clampNotice = "";

        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    presetForMode(
      this: ScoreTrainingSetupContext,
      type: ScoreTrainingDurationType,
    ) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(
      this: ScoreTrainingSetupContext,
      type: ScoreTrainingDurationType,
    ) {
      this.durationType = type;
      this.durationValue =
        durationValueOf(this.presetForMode(type)) ?? FALLBACK_DURATION[type];
      this.clampNotice = "";
    },

    /**
     * `abandon_failed` blocks session creation instead of silently
     * resetting: the orphan session is still ACTIVE server-side, so
     * showing the picker would let a new session violate the
     * single-active-session constraint (D118).
     */
    async reconcile(
      this: ScoreTrainingSetupContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        GAME_TYPE_KEY,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
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
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    async start(this: ScoreTrainingSetupContext) {
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }
      const { value, clamped } = clampScoreTrainingDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;
      this.clampNotice = clamped
        ? scoreTrainingDurationClampNotice(this.durationType)
        : "";

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          duration_value: value,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: { duration_value: value },
          },
        });
        this.$store.game.startSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          sessionId: session.sessionId,
          participantRef: session.participants[0].ref,
          templateRef: preset.configurationTemplateId,
          configSnapshot,
        });
        globalThis.location.href = "/games/score-training/play";
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
