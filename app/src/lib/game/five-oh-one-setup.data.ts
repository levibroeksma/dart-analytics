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
import {
  participantsFromGuests,
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
  FIVE_OH_ONE_STARTING_SCORE_DEFAULT,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
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
  cap: number;
};

/** Best-of counts must be odd; an even count rounds up. */
function oddFor(mode: MatchMode, count: number): number {
  return mode === "BEST_OF" && count % 2 === 0 ? count + 1 : count;
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
  const target = legs.mode === "FIRST_TO" ? legs.count : (legs.count + 1) / 2;
  return {
    starting_score: input.startingScore,
    legs,
    sets: setsOn ? outer : null,
    win_by_two: input.winByTwo
      ? {
          cap: Math.max(input.cap, target),
          scope: setsOn ? input.marginScope : "EVERY_SET",
        }
      : null,
  };
}

export function fiveOhOneSetup() {
  return {
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
    cap: 5 as number | string | null,
    legsClampNotice: "",
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
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

    removeGuest(this: FiveOhOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: FiveOhOneSetupContext) {
      this.bot = null;
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
        const overrides = buildFiveOhOneV2Wire({
          startingScore,
          matchMode: this.matchMode,
          count: legsValue,
          matchUnit: this.matchUnit,
          legsPerSetMode: this.legsPerSetMode,
          legsPerSet: Number(this.legsPerSet),
          winByTwo: this.winByTwo,
          marginScope: this.marginScope,
          cap: Number(this.cap),
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
