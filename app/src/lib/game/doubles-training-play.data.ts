import {
  playScreenState,
  boardPlayActions,
  botVisualBoardData,
  playScreenActions,
  forActiveSeat,
} from "@lib/game/play-screen.data";
import { BOT_PACING, botDartIndex } from "@lib/game/play-bot-seat";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import {
  playUploadAndCompleteSession,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import { targetOrderFor } from "@lib/game/target-order";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import { orderModeLabel } from "@lib/game/play-subtitle";
import type { RulesetVersionKey, DartbotSeat } from "@lib/types";
import type {
  DartObservation,
  DoublesTrainingSeatState,
  DoublesTrainingState,
} from "@modules/types";
import type {
  BotPacing,
  DoublesPreviewSegment,
  DoublesTrainingPlayContext,
  DoublesTrainingResultsSnapshot,
  DoublesTrainingSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// doublesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  DoublesTrainingEngine,
  foldDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";

const GAME_TYPE_KEY = "DOUBLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "DOUBLES_TRAINING_V1";

function statsFor(seat: DoublesTrainingSeatState): DoublesTrainingSeatResult {
  const hitOutcomes = seat.outcomes.filter((outcome) => outcome.hit);
  const dartsThrown = seat.outcomes.reduce(
    (sum, outcome) => sum + (outcome.hitDartNumber ?? 3),
    0,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    hits: hitOutcomes.length,
    on1st: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 1).length,
    on2nd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 2).length,
    on3rd: hitOutcomes.filter((outcome) => outcome.hitDartNumber === 3).length,
    accuracy: accuracyDisplay(hitOutcomes.length, dartsThrown),
    misses: seat.outcomes.filter((outcome) => !outcome.hit).length,
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `bobs27-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: DoublesTrainingPlayContext["$store"]["game"],
): DoublesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof DoublesTrainingEngine ? engine : null;
}

/**
 * The real per-dart thrower: the shipped skill curve, seeded RNG, dictated
 * strategy and throw engine, combined the same way `bobs27-play.data.ts`
 * already does. The target path reads `config.targetOrder` rather than the
 * default ascending doubles path, since Doubles Training's order mode is
 * itself configurable. `dartIndex` is re-derived from the fact log on every
 * call — never held on this closure — so an undone bot visit re-throws
 * identically from the same seed (`08-DartBot.md` §Determinism and Replay).
 */
function throwBotDart(
  context: DoublesTrainingPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const config = context.$store.game.configSnapshot;
  const state = context.state();
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!config || !state || !seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const target = targetAt(
    doublesPath(config.targetOrder),
    seatState.targetIndex,
  );
  const intent = chooseTarget({ target });
  const thrown = botThrowDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: BOT_PACING,
  };
}

export function doublesTrainingPlay() {
  return {
    ...playScreenState<DoublesTrainingEngine, DoublesTrainingResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...botVisualBoardData(throwBotDart),
    ...playScreenActions(),

    state(this: DoublesTrainingPlayContext): DoublesTrainingState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldDoublesTrainingState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** Play-header subtitle: the session's target order in setup wording (`LOW → HIGH`); blank before config loads. */
    subtitle(this: DoublesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      return config ? orderModeLabel(config.orderMode) : "";
    },

    currentTargetLabelFor(
      this: DoublesTrainingPlayContext,
      seatRef: string,
    ): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!config || !seat) return "";
      return doublesPathTargetLabel(
        targetAt(doublesPath(config.targetOrder), seat.targetIndex),
      );
    },

    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      return forActiveSeat(this, (ref) => this.currentTargetLabelFor(ref), "");
    },

    hitCountFor(this: DoublesTrainingPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return String(
        seat?.outcomes.filter((outcome) => outcome.hit).length ?? 0,
      );
    },

    hitCount(this: DoublesTrainingPlayContext): string {
      return forActiveSeat(this, (ref) => this.hitCountFor(ref), "0");
    },

    missCountFor(this: DoublesTrainingPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return String(
        seat?.outcomes.filter((outcome) => !outcome.hit).length ?? 0,
      );
    },

    missCount(this: DoublesTrainingPlayContext): string {
      return forActiveSeat(this, (ref) => this.missCountFor(ref), "0");
    },

    previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`. */
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!this.engine || !config || !seat || this.finished) return;
      const target = targetAt(
        doublesPath(config.targetOrder),
        seat.targetIndex,
      );
      await this.commitDart(doublesPathObservation(target, hit));
    },

    uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => statsFor(seat)),
      }));
    },

    resultsTitle(this: DoublesTrainingPlayContext): string {
      if (this.resultsSnapshot?.status === "TIE")
        return "Tie — same doubles hit!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — most doubles hit!` : "Session complete";
    },

    playAgain(this: DoublesTrainingPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof DoublesTrainingEngine ? engine : null),
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
            },
          };
        },
      );
    },
  };
}
