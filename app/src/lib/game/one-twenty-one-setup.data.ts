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
  clampOneTwentyOneDuration,
  oneTwentyOneDurationClampNotice,
} from "@lib/game/one-twenty-one-duration";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { addTypedGuest } from "@lib/game/guest-list";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { RulesetVersionKey } from "@lib/types";
import type {
  OneTwentyOneDurationType,
  OneTwentyOneSetupContext,
} from "./types";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const RULESET_VERSION_KEY: RulesetVersionKey = "121_V2";

type ClampableDuration = Exclude<OneTwentyOneDurationType, "TARGET">;

const FALLBACK_DURATION: Record<ClampableDuration, number> = {
  ROUNDS: 10,
  MINUTES: 5,
};

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number (always the case for the TARGET preset), so callers fall back
 * to `FALLBACK_DURATION` for ROUNDS/MINUTES, or to `null` for TARGET.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

export function oneTwentyOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "TARGET" as OneTwentyOneDurationType,
    durationValue: null as number | string | null,
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

    async init(this: OneTwentyOneSetupContext) {
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
        this.durationType = "TARGET";
        this.durationValue = null;
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
      this: OneTwentyOneSetupContext,
      type: OneTwentyOneDurationType,
    ) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(this: OneTwentyOneSetupContext, type: OneTwentyOneDurationType) {
      this.durationType = type;
      this.durationValue =
        type === "TARGET"
          ? null
          : (durationValueOf(this.presetForMode(type)) ??
            FALLBACK_DURATION[type]);
      this.clampNotice = "";
    },

    addGuest(this: OneTwentyOneSetupContext) {
      if (addTypedGuest(this)) this.forceTargetIfGuested();
    },

    removeGuest(this: OneTwentyOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    /**
     * ROUNDS/MINUTES have no established 1v1 win condition (see the design
     * spec's Decisions section) — mirrors `scoreTrainingSetup()`'s own
     * `forceRoundsIfGuested`.
     */
    forceTargetIfGuested(this: OneTwentyOneSetupContext) {
      if (this.guests.length > 0) this.durationType = "TARGET";
    },

    /**
     * `abandon_failed` blocks session creation instead of silently
     * resetting: the orphan session is still ACTIVE server-side, so
     * showing the picker would let a new session violate the
     * single-active-session constraint (D118).
     */
    async reconcile(
      this: OneTwentyOneSetupContext,
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

    async retryReconciliation(this: OneTwentyOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: OneTwentyOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/121/play";
    },

    async abandonSession(this: OneTwentyOneSetupContext) {
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

    async start(this: OneTwentyOneSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      let overrides: Record<string, unknown> = {
        duration_type: this.durationType,
      };
      if (this.durationType !== "TARGET") {
        const { value, clamped } = clampOneTwentyOneDuration(
          this.durationType,
          this.durationValue,
        );
        this.durationValue = value;
        this.clampNotice = clamped
          ? oneTwentyOneDurationClampNotice(this.durationType)
          : "";
        overrides = { ...overrides, duration_value: value };
      } else {
        this.clampNotice = "";
      }

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          ...overrides,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides,
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
        globalThis.location.href = "/games/121/play";
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
