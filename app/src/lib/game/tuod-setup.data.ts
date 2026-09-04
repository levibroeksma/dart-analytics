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
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
import {
  clampTuodDuration,
  tuodDurationClampNotice,
} from "@lib/game/tuod-duration";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { TuodDurationType, TuodSetupContext } from "./types";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY = "TUOD_V1";

const FALLBACK_DURATION: Record<TuodDurationType, number> = {
  ROUNDS: 10,
  MINUTES: 10,
};

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number, so callers fall back to `FALLBACK_DURATION`. Mirrors
 * `score-training-setup.data.ts`'s `durationValueOf`.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: TuodSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

export function tuodSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as TuodDurationType,
    durationValue: FALLBACK_DURATION.ROUNDS as number | string | null,
    clampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,

    async init(this: TuodSetupContext) {
      this.$watch("durationType", (type) => {
        this.selectMode(type);
      });

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

    presetForMode(this: TuodSetupContext, type: TuodDurationType) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(this: TuodSetupContext, type: TuodDurationType) {
      this.durationType = type;
      this.durationValue =
        durationValueOf(this.presetForMode(type)) ?? FALLBACK_DURATION[type];
      this.clampNotice = "";
    },

    addGuest(this: TuodSetupContext) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    addBot(this: TuodSetupContext) {
      if (addBotOpponent(this)) this.forceRoundsIfGuested();
    },

    removeGuest(this: TuodSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: TuodSetupContext) {
      this.bot = null;
    },

    /**
     * A 1v1 match needs a fixed round count both seats share, not a
     * wall-clock timer running through alternating turns — see
     * `2026-08-22-single-opponent-seat-remaining-engines-design.md`. Once a
     * guest or bot is seated, TIMED (MINUTES) is locked back to ROUNDS.
     */
    forceRoundsIfGuested(this: TuodSetupContext) {
      if (guested(this)) this.durationType = "ROUNDS";
    },

    async reconcile(
      this: TuodSetupContext,
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

    async retryReconciliation(this: TuodSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: TuodSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/tuod/play";
    },

    async abandonSession(this: TuodSetupContext) {
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

    async start(this: TuodSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      const { value, clamped } = clampTuodDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;
      this.clampNotice = clamped
        ? tuodDurationClampNotice(this.durationType)
        : "";

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          duration_value: value,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests, this.bot);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: { duration_value: value },
          },
          participants,
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
        globalThis.location.href = "/games/tuod/play";
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
