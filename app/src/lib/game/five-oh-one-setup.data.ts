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
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_MIN,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";
import {
  clampFiveOhOneStartingScore,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";
import type {
  FiveOhOneSetupContext,
  FiveOhOneStartingScoreOption,
} from "./types";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY = "501_V1";
const CUSTOM_STARTING_SCORE_DEFAULT = 101;

/**
 * Reads `legs_to_win` off a preset's `configuration`, which the API types as
 * `Record<string, unknown>`.
 */
function presetLegsToWin(
  preset: ConfigurationPresetData | undefined,
): number | undefined {
  const raw = preset?.configuration?.legs_to_win;
  return typeof raw === "number" ? raw : undefined;
}

export function fiveOhOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    startingScoreOption: "501" as FiveOhOneStartingScoreOption,
    startingScoreValue: CUSTOM_STARTING_SCORE_DEFAULT as number | string | null,
    scoreClampNotice: "",
    legsToWin: FIVE_OH_ONE_LEGS_MIN as number | string | null,
    legsClampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        this.legsToWin =
          presetLegsToWin(this.basePreset()) ?? FIVE_OH_ONE_LEGS_MIN;
        this.legsClampNotice = "";
        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    /**
     * The template whose configuration is copied, with `legs_to_win` and
     * `starting_score` overridden by the player's chosen values. The
     * single-leg preset is preferred so the overrides are the only
     * difference from a seeded default; any preset will do when that one is
     * absent, since every 501 preset shares the same locked V1 values for
     * every other key.
     */
    basePreset(this: FiveOhOneSetupContext) {
      return (
        this.presets.find((p) => presetLegsToWin(p) === FIVE_OH_ONE_LEGS_MIN) ??
        this.presets[0]
      );
    },

    async reconcile(
      this: FiveOhOneSetupContext,
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

    async retryReconciliation(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: FiveOhOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/501/play";
    },

    async abandonSession(this: FiveOhOneSetupContext) {
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

    async start(this: FiveOhOneSetupContext) {
      const preset = this.basePreset();
      if (!preset) {
        this.error = "Could not find a preset for 501.";
        return;
      }
      const { value: legsValue, clamped: legsClamped } = clampFiveOhOneLegs(
        this.legsToWin,
      );
      this.legsToWin = legsValue;
      this.legsClampNotice = legsClamped ? FIVE_OH_ONE_LEGS_NOTICE : "";

      let startingScore: number;
      if (this.startingScoreOption === "CUSTOM") {
        const { value: scoreValue, clamped: scoreClamped } =
          clampFiveOhOneStartingScore(this.startingScoreValue);
        this.startingScoreValue = scoreValue;
        this.scoreClampNotice = scoreClamped
          ? FIVE_OH_ONE_STARTING_SCORE_NOTICE
          : "";
        startingScore = scoreValue;
      } else {
        startingScore = Number(this.startingScoreOption);
        this.scoreClampNotice = "";
      }

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          legs_to_win: legsValue,
          starting_score: startingScore,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: {
              legs_to_win: legsValue,
              starting_score: startingScore,
            },
          },
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = "/games/501/play";
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
