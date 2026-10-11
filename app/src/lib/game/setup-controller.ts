import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import { createSession, fetchActiveSessions } from "@client/api/sessions";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { createSetupSession } from "@lib/game/setup-session";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { PresetSetupContext, PresetSetupControllerOptions } from "./types";

/**
 * The setup controller every preset-driven game shares: load the presets and
 * any active session, then start — create the session, snapshot the config,
 * push it into the game store and navigate to play. The state and the
 * reconcile/retry/continue/abandon methods come from `createSetupSession`.
 *
 * V1 seeds exactly one configuration preset per game; index 0 is always that
 * preset.
 *
 * Five games use this: Bob's 27, Shanghai, Around the Clock, Singles
 * Training and Doubles Training. `501`, Score Training, 121 and TUOD
 * deliberately do not — each keeps a hand-written setup context that replaces
 * `start` wholesale, and routing them through here would need one hook per
 * branch, which is the factory dissolving into its callers (`types.ts`'s
 * `OneTwentyOneSetupContext`/`FiveOhOneSetupContext` docs say the same).
 * The touch list and the reasoning live in
 * `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
 */
export function createPresetSetupController<Ctx extends PresetSetupContext>(
  options: PresetSetupControllerOptions<Ctx>,
) {
  const { gameTypeKey, playHref, label, configOverrides } = options;

  return {
    ...createSetupSession({ gameTypeKey, playHref }),
    presets: [] as ConfigurationPresetData[],
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

    addGuest(this: Ctx) {
      addTypedGuest(this);
    },

    addBot(this: Ctx) {
      addBotOpponent(this);
    },

    async start(this: Ctx) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = `Could not find a preset for ${label}.`;
        return;
      }

      const rulesetVersionKey =
        typeof options.rulesetVersionKey === "function"
          ? options.rulesetVersionKey(this)
          : options.rulesetVersionKey;
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
        const participants = participantsFromGuests(this.guests, this.bot);
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
