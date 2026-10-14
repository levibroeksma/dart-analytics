import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import { createSession, fetchActiveSessions } from "@client/api/sessions";
import { clampScoreTrainingDuration } from "@lib/game/score-training-duration";
import { createSetupSession } from "@lib/game/setup-session";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
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

/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: ScoreTrainingSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

export function scoreTrainingSetup() {
  return {
    ...createSetupSession({
      gameTypeKey: GAME_TYPE_KEY,
      playHref: "/games/score-training/play",
    }),
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as ScoreTrainingDurationType,
    durationValue: 10 as number | string | null,

    /**
     * On fetch failure, keeps the user on setup with a visible error and the
     * picker fallback rather than the active-session modal.
     */
    async init(this: ScoreTrainingSetupContext) {
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
    },

    addGuest(this: ScoreTrainingSetupContext) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    addBot(this: ScoreTrainingSetupContext) {
      if (addBotOpponent(this)) this.forceRoundsIfGuested();
    },

    /**
     * A 1v1 match needs a fixed round count both seats share, not a
     * wall-clock timer running through alternating turns — see
     * `2026-08-22-single-opponent-seat-remaining-engines-design.md`. Once a
     * guest or bot is seated, TIMED (MINUTES) is locked back to ROUNDS.
     */
    forceRoundsIfGuested(this: ScoreTrainingSetupContext) {
      if (guested(this)) this.durationType = "ROUNDS";
    },

    /**
     * Unreachable while this game has an ACTIVE session, held here or
     * elsewhere: the setup modal hides the picker until the player
     * continues or abandons it (single active session, D118; D460).
     */
    async start(this: ScoreTrainingSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }
      const { value } = clampScoreTrainingDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;

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
