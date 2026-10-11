import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import { createSession, fetchActiveSessions } from "@client/api/sessions";
import { createSetupSession } from "@lib/game/setup-session";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_MAX,
  FIVE_OH_ONE_LEGS_MIN,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";
import {
  clampFiveOhOneStartingScore,
  FIVE_OH_ONE_STARTING_SCORE_DEFAULT,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";
import type {
  FiveOhOneSetupContext,
  FiveOhOneStartingScoreOption,
} from "./types";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY = "501_V2";

/** A V2-shaped preset: `configuration.legs` is an object (seed 0037). */
export function isV2Preset(
  preset: ConfigurationPresetData | undefined,
): boolean {
  const legs = preset?.configuration?.legs;
  return typeof legs === "object" && legs !== null;
}

type MatchMode = "FIRST_TO" | "BEST_OF";

type V2WireInput = {
  startingScore: number;
  matchMode: MatchMode;
  count: number;
  matchUnit: "LEGS" | "SETS";
  legsPerSetMode: MatchMode;
  legsPerSet: number;
  winByTwo: boolean;
  marginScope: "EVERY_SET" | "DECIDING_SET";
  cap: number | null;
};

/** Best-of counts must be odd; an even count rounds up, except at the 20 cap, which drops to 19. */
function oddFor(mode: MatchMode, count: number): number {
  if (mode !== "BEST_OF" || count % 2 !== 0) return count;
  return count >= FIVE_OH_ONE_LEGS_MAX ? count - 1 : count + 1;
}

function legTargetOf(mode: MatchMode, count: number): number {
  return mode === "FIRST_TO" ? count : (count + 1) / 2;
}

/**
 * The V2 overrides `start()` sends; mirrors FiveOhOneV2Config's refinements
 * so the server never rejects them.
 */
export function buildFiveOhOneV2Wire(
  input: V2WireInput,
): Record<string, unknown> {
  const outer = {
    mode: input.matchMode,
    count: oddFor(input.matchMode, input.count),
  };
  const setsOn = input.matchUnit === "SETS";
  const legs = setsOn
    ? {
        mode: input.legsPerSetMode,
        count: oddFor(input.legsPerSetMode, input.legsPerSet),
      }
    : outer;
  const target = legTargetOf(legs.mode, legs.count);
  return {
    starting_score: input.startingScore,
    legs,
    sets: setsOn ? outer : null,
    win_by_two: input.winByTwo
      ? {
          cap: Math.max(input.cap ?? target + 2, target),
          scope: setsOn ? input.marginScope : "EVERY_SET",
        }
      : null,
  };
}

export function fiveOhOneSetup() {
  return {
    ...createSetupSession({
      gameTypeKey: GAME_TYPE_KEY,
      playHref: "/games/501/play",
    }),
    presets: [] as ConfigurationPresetData[],
    startingScoreOption: "501" as FiveOhOneStartingScoreOption,
    startingScoreValue: FIVE_OH_ONE_STARTING_SCORE_DEFAULT as
      number | string | null,
    scoreClampNotice: "",
    matchMode: "FIRST_TO" as MatchMode,
    matchUnit: "LEGS" as "LEGS" | "SETS",
    legsToWin: FIVE_OH_ONE_LEGS_MIN as number | string | null,
    legsPerSetMode: "BEST_OF" as MatchMode,
    legsPerSet: 5 as number | string | null,
    winByTwo: false,
    marginScope: "EVERY_SET" as "EVERY_SET" | "DECIDING_SET",
    cap: null as number | string | null,
    autoCap: null as number | null,
    legsClampNotice: "",

    /** Legs a side needs per leg race: the cap stepper's floor and the base of its default. */
    capMin(this: FiveOhOneSetupContext): number {
      const setsOn = this.matchUnit === "SETS";
      const mode = setsOn ? this.legsPerSetMode : this.matchMode;
      const raw = setsOn ? this.legsPerSet : this.legsToWin;
      return legTargetOf(mode, oddFor(mode, clampFiveOhOneLegs(raw).value));
    },

    /** Keeps the cap at target + 2 until the player edits it; an edited cap is left alone. */
    syncCap(this: FiveOhOneSetupContext) {
      if (this.cap !== null && this.cap !== this.autoCap) return;
      const next = this.capMin() + 2;
      this.cap = next;
      this.autoCap = next;
    },

    async init(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        this.legsToWin = FIVE_OH_ONE_LEGS_MIN;
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
     * The V2-shaped template whose configuration is copied under the
     * player's chosen match format; V1 presets carry `legs_to_win`, which the
     * strict V2 schema rejects.
     */
    basePreset(this: FiveOhOneSetupContext) {
      return this.presets.find(isV2Preset);
    },

    addGuest(this: FiveOhOneSetupContext) {
      addTypedGuest(this);
    },

    addBot(this: FiveOhOneSetupContext) {
      addBotOpponent(this);
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
        const overrides = buildFiveOhOneV2Wire({
          startingScore,
          matchMode: this.matchMode,
          count: legsValue,
          matchUnit: this.matchUnit,
          legsPerSetMode: this.legsPerSetMode,
          legsPerSet: clampFiveOhOneLegs(this.legsPerSet).value,
          winByTwo: this.winByTwo,
          marginScope: this.marginScope,
          cap: this.cap === null ? null : clampFiveOhOneLegs(this.cap).value,
        });
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          ...overrides,
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
