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
import type { Bobs27SetupContext } from "./types";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY = "BOBS27_V1";

export function bobs27Setup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: Bobs27SetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async reconcile(
      this: Bobs27SetupContext,
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

    async retryReconciliation(this: Bobs27SetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: Bobs27SetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/bobs27/play";
    },

    async abandonSession(this: Bobs27SetupContext) {
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

    async start(this: Bobs27SetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Bob's 27.";
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          RULESET_VERSION_KEY,
          preset.configuration,
        );
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
        globalThis.location.href = "/games/bobs27/play";
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
