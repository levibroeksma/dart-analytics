import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import { boardInputData } from "@lib/game/board-input.data";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  Bobs27SeatState,
  Bobs27State,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type { BoardMarker, BotDartThrower, BotPacing } from "./types";
import type {
  Bobs27PlayContext,
  Bobs27PreviewSegment,
  Bobs27ResultsSnapshot,
  Bobs27SeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// bobs27EngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY: RulesetVersionKey = "BOBS27_V1";

function statsFor(
  seat: Bobs27SeatState,
  turns: readonly TurnFact[],
): Bobs27SeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const darts = seatTurns.reduce((sum, turn) => sum + turn.darts.length, 0);
  const hits = seatTurns.reduce(
    (sum, turn) =>
      sum +
      turn.darts.filter(
        (dart) =>
          dart.hitTargetNumber === dart.intendedTargetNumber &&
          dart.hitZoneKey === dart.intendedZoneKey,
      ).length,
    0,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.score,
    darts,
    doubleHitRate: accuracyDisplay(hits, darts),
    highestNumberReached: doublesPathTargetLabel(
      targetAt(doublesPath(), seat.targetIndex),
    ),
  };
}

function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
): Bobs27ResultsSnapshot {
  return {
    status: state.status as "WON" | "LOST" | "COMPLETE",
    winningSideKey: state.winningSideKey,
    seats: state.seats.map((seat) => statsFor(seat, turns)),
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `five-oh-one-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: Bobs27PlayContext["$store"]["game"],
): Bobs27Engine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof Bobs27Engine ? engine : null;
}

const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * The real per-dart thrower: phases 1–3's shipped pipeline (skill curve,
 * seeded RNG, dictated strategy, throw engine), combined the same way
 * `play-dictated-session.ts`'s test harness already does for a solo bot.
 * `dartIndex` is re-derived from the fact log on every call — never held on
 * this closure — so an undone bot visit re-throws identically from the same
 * seed (`08-DartBot.md` §Determinism and Replay).
 */
function throwBotDart(
  context: Bobs27PlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const state = context.state();
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!state || !seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const target = targetAt(doublesPath(), seatState.targetIndex);
  const intent = chooseTarget({ target });
  const thrown = botThrowDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function bobs27Play() {
  let self: Bobs27PlayContext;

  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as Bobs27ResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    botThrowing: false,
    engine: null as Bobs27Engine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: Bobs27PlayContext): Bobs27State | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!seat) return "";
      return doublesPathTargetLabel(targetAt(doublesPath(), seat.targetIndex));
    },

    currentTargetLabel(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.score) : "";
    },

    currentScore(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },

    previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: Bobs27PlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async init(this: Bobs27PlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
      await this.maybeRunBotVisit();
    },

    retryReconciliation(this: Bobs27PlayContext) {
      return playRetryReconciliation(this);
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`, exactly as the board's per-dart `recordDart` does. */
    async recordTap(this: Bobs27PlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const state = this.state();
      const activeSeat = state?.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      );
      if (!activeSeat) return;
      const target = targetAt(doublesPath(), activeSeat.targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    async recordDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: Bobs27PlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: Bobs27PlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    async undoVisit(this: Bobs27PlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        playUndoVisit(this);
      }
      await this.maybeRunBotVisit();
    },

    uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) =>
        computeStats(finalState, this.$store.game.turns),
      );
    },

    resultsTitle(this: Bobs27PlayContext): string {
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      if (winner) return `${winner} wins!`;
      return this.resultsSnapshot?.status === "LOST" ? "Game over!" : "Winner!";
    },

    back(this: Bobs27PlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: Bobs27PlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings.
     */
    playAgain(this: Bobs27PlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof Bobs27Engine ? engine : null,
      );
    },
  };
}
