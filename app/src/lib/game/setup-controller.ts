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
  starterFirst,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type {
  PresetSetupContext,
  PresetSetupControllerOptions,
  RulesetVersionKey,
} from "./types";

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
 * Training and Doubles Training. `501`, Score Training, 121 and TUOD share
 * `startPresetSession` with it but keep their own `init` and pre-start steps
 * (preset choice, clamping, override building) in a hand-written setup
 * context — routing those through here would need one hook per branch,
 * which is the factory dissolving into its callers (`types.ts`'s
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
      await startPresetSession(this, {
        gameTypeKey,
        rulesetVersionKey,
        playHref,
        preset,
        overrides: configOverrides?.(this),
      });
    },
  };
}

/**
 * Starts a session from one configuration preset: snapshot the preset's
 * configuration with `overrides` laid over it, create the session, push it
 * into the game store and navigate to `playHref`. `overrides`, when given,
 * is also sent as the create-session overrides; when absent the key is
 * omitted. A `SESSION_ALREADY_ACTIVE` rejection re-runs reconciliation
 * instead of showing an error. `loading` is always cleared.
 *
 * Every preset setup ends here: `createPresetSetupController().start` and
 * the hand-written 501, 121, Score Training and TUOD `start` bodies, which
 * keep their own preset choice and clamping and then call this.
 */
export async function startPresetSession<Ctx extends PresetSetupContext>(
  ctx: Ctx,
  spec: {
    gameTypeKey: string;
    rulesetVersionKey: RulesetVersionKey;
    playHref: string;
    preset: ConfigurationPresetData;
    overrides?: Record<string, unknown>;
  },
): Promise<void> {
  const { gameTypeKey, rulesetVersionKey, playHref, preset, overrides } = spec;
  ctx.loading = true;
  ctx.error = "";
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
      ctx.$store.settings,
    );
    const participants = starterFirst(
      participantsFromGuests(ctx.guests, ctx.bot),
      ctx.starterIndex,
    );
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
    ctx.$store.game.startSession(
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
      await ctx.retryReconciliation();
      return;
    }
    ctx.error = "Could not start the session. Try again.";
  } finally {
    ctx.loading = false;
  }
}
