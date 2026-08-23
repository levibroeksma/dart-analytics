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
import { addTypedGuest } from "@lib/game/guest-list";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { PresetSetupContext, PresetSetupControllerOptions } from "./types";

/**
 * The setup controller every preset-driven game shares: load the presets and
 * any active session, reconcile a recovered one, retry that reconciliation,
 * continue or abandon it, then start — create the session, snapshot the
 * config, push it into the game store and navigate to play.
 *
 * V1 seeds exactly one configuration preset per game; index 0 is always that
 * preset.
 *
 * Six games use this: Bob's 27, Shanghai, 121, Around the Clock, Singles
 * Training and Doubles Training. `501` and Score Training deliberately do
 * not — both replace `start` wholesale, and routing them through here would
 * need one hook per branch, which is the factory dissolving into its callers.
 * The touch list and the reasoning live in
 * `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
 */
export function createPresetSetupController<Ctx extends PresetSetupContext>(
  options: PresetSetupControllerOptions<Ctx>,
) {
  const { gameTypeKey, rulesetVersionKey, playHref, label, configOverrides } =
    options;

  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",

    async init(this: Ctx) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(gameTypeKey),
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

    async reconcile(this: Ctx, activeSessions: SessionActiveData[]) {
      const result = await reconcileActiveSession(
        gameTypeKey,
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

    async retryReconciliation(this: Ctx) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: Ctx) {
      this.showActiveSessionModal = false;
      globalThis.location.href = playHref;
    },

    async abandonSession(this: Ctx) {
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

    addGuest(this: Ctx) {
      addTypedGuest(this);
    },

    removeGuest(this: Ctx, index: number) {
      this.guests.splice(index, 1);
    },

    async start(this: Ctx) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = `Could not find a preset for ${label}.`;
        return;
      }

      const overrides = configOverrides?.(this);

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          rulesetVersionKey,
          overrides
            ? {
                ...(preset.configuration as Record<string, unknown>),
                ...overrides,
              }
            : preset.configuration,
        );
        const modePair = resolveSessionModePair(
          rulesetVersionKey,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests);
        const session = await createSession({
          gameTypeKey,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(overrides ? { overrides } : {}),
          },
          participants,
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey,
            rulesetVersionKey,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = playHref;
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
