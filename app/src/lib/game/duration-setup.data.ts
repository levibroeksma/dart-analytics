import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import { fetchActiveSessions } from "@client/api/sessions";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import type { DurationSetupContext } from "./types";

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number, so callers fall back to the factory's `fallback`.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

/** Whether this session will seat a second player — guest or DartBot. */
function guested<TType extends string>(
  ctx: DurationSetupContext<TType>,
): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

/**
 * The duration picker Score Training and TUOD share: preset-backed ROUNDS and
 * timed modes, `fallback` when a preset carries no numeric `duration_value`,
 * and ROUNDS forced once a guest or bot is seated. Spread after
 * `createSetupSession(...)` and before the factory's own members, so a
 * factory may still override any of them. `TType` must include `"ROUNDS"`.
 * Each call returns fresh `presets`.
 */
export function durationSetupData<TType extends string>(options: {
  gameTypeKey: string;
  fallback: Record<TType, number>;
}) {
  const { gameTypeKey, fallback } = options;
  const rounds = "ROUNDS" as TType;

  return {
    presets: [] as ConfigurationPresetData[],
    durationType: rounds,
    durationValue: fallback[rounds] as number | string | null,

    /**
     * On fetch failure, keeps the user on setup with a visible error and the
     * picker fallback rather than the active-session modal.
     */
    async init(this: DurationSetupContext<TType>) {
      this.$watch("durationType", (type) => {
        this.selectMode(type);
      });

      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(gameTypeKey),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.durationType = rounds;
        this.durationValue =
          durationValueOf(this.presetForMode(rounds)) ?? fallback[rounds];

        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    presetForMode(this: DurationSetupContext<TType>, type: TType) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(this: DurationSetupContext<TType>, type: TType) {
      this.durationType = type;
      this.durationValue =
        durationValueOf(this.presetForMode(type)) ?? fallback[type];
    },

    addGuest(this: DurationSetupContext<TType>) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    addBot(this: DurationSetupContext<TType>) {
      if (addBotOpponent(this)) this.forceRoundsIfGuested();
    },

    /**
     * A 1v1 match needs a fixed round count both seats share, not a
     * wall-clock timer running through alternating turns — see
     * `2026-08-22-single-opponent-seat-remaining-engines-design.md`. Once a
     * guest or bot is seated, TIMED (MINUTES) is locked back to ROUNDS.
     */
    forceRoundsIfGuested(this: DurationSetupContext<TType>) {
      if (guested(this)) this.durationType = rounds;
    },
  };
}
