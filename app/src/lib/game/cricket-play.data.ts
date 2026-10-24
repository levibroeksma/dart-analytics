import { playAgainStarterData } from "@lib/game/play-again-starter";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { boardInputData } from "@lib/game/board-input.data";
import { botThrowObservation, findBotSeat } from "@lib/game/play-bot-seat";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
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
import {
  duelWinningSideKey,
  marksPlayAccessors,
  marksPreviewSegments,
  recordMarksMiss,
  recordMarksTap,
  resumeMarksEngine,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import type { DartbotSeat, RulesetVersionKey } from "@lib/types";
import type { MarksView } from "@modules/interfaces";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
} from "@modules/types";
import type {
  BoardMarker,
  Bobs27PreviewSegment,
  CricketPlayContext,
  CricketResultsSnapshot,
  CricketRing,
  CricketSeatResult,
  BotDartThrower,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// both Cricket factories so the registry can resolve this page's own
// ruleset keys.
import {
  CRICKET_OBJECTIVES,
  CricketEngine,
  cricketMarksOf,
  foldCricketState,
  marksPerRound,
} from "@modules/game/cricket.engine.module";

const GAME_TYPE_KEY = "CRICKET";
const RESUMABLE = new Set<RulesetVersionKey>(["CRICKET_V1", "CRICKET_V2"]);

function objectiveLabel(objective: number): string {
  return objective === BULL_TARGET_NUMBER ? "Bull" : String(objective);
}

/** One seat's results row: darts, MPR to 2 dp, treble hits, the dart each objective closed on. */
export function cricketSeatResult(seat: CricketSeatState): CricketSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    marksPerRound: marksPerRound(seat).toFixed(2),
    trebles: seat.trebleHits,
    points: seat.points,
    dartsToClose: [...seat.closedAtDart],
  };
}

function computeStats(state: CricketState): CricketResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: duelWinningSideKey(state),
    seats: state.seats.map(cricketSeatResult),
  };
}

function resumeEngine(
  game: CricketPlayContext["$store"]["game"],
): CricketEngine | null {
  return resumeMarksEngine(
    game,
    RESUMABLE,
    (engine): engine is CricketEngine => engine instanceof CricketEngine,
  );
}

/**
 * Flattens the engine's two-seat state into the strategy's view: the bot's
 * own marks and its opponent's, per objective, in `CRICKET_OBJECTIVES` order.
 * @throws when the bot or its opponent has no seat in the state.
 */
export function cricketMarksView(
  state: CricketState,
  botRef: string,
): MarksView {
  const own = state.seats.find((seat) => seat.participantRef === botRef);
  const opponent = state.seats.find((seat) => seat.participantRef !== botRef);
  if (!own || !opponent) {
    throw new Error("DartBot has no opponent in this session's engine state");
  }
  return {
    ownPoints: own.points,
    opponentPoints: opponent.points,
    objectives: CRICKET_OBJECTIVES.map((targetNumber, index) => ({
      targetNumber,
      own: own.marks[index],
      opponent: opponent.marks[index],
    })),
  };
}

function throwBotDart(context: CricketPlayContext, botSeat: DartbotSeat) {
  const state = context.state();
  if (!state) throw new Error("DartBot has no session state to read");
  const intent = chooseTarget(cricketMarksView(state, botSeat.participantRef));
  return botThrowObservation(botSeat, context.$store.game.turns, intent);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function cricketPlay() {
  let self: CricketPlayContext;

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
    resultsSnapshot: null as CricketResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as CricketEngine | null,
    ring: "SINGLE" as CricketRing,
    botThrowing: false,
    botFlight: null,
    ...playAgainStarterData(),
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: CricketPlayContext): CricketState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldCricketState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    ...marksPlayAccessors(CRICKET_OBJECTIVES, objectiveLabel),

    previewSegments(this: CricketPlayContext): Bobs27PreviewSegment[] {
      return marksPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        (observation) => cricketMarksOf(observation) !== null,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: CricketPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async init(this: CricketPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
      await this.maybeRunBotVisit();
    },

    retryReconciliation(this: CricketPlayContext) {
      return playRetryReconciliation(this);
    },

    /** Tapping the selected ring again returns to SINGLE. */
    setRing(this: CricketPlayContext, ring: CricketRing) {
      toggleMarksRing(this, ring);
    },

    /** The recreational input's entry point: a tap on an objective with the
     * selected ring. The ring resets after every tap; Treble on the bull
     * (which has no such ring) records a single bull. */
    async recordObjective(this: CricketPlayContext, objective: number) {
      await recordMarksTap(this, objective);
    },

    /** A dart off every objective: counts as thrown, marks nothing. */
    async recordMiss(this: CricketPlayContext) {
      await recordMarksMiss(this);
    },

    async recordDart(this: CricketPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: CricketPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: CricketPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    async undoVisit(this: CricketPlayContext) {
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

    uploadAndCompleteSession(this: CricketPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
    },

    back(this: CricketPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: CricketPlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, under
     * the session's own ruleset key, with no overrides.
     */
    playAgain(this: CricketPlayContext) {
      const key = this.$store.game.rulesetVersionKey;
      if (!key) return Promise.resolve();
      return runPlayAgain(this, GAME_TYPE_KEY, key, (engine) =>
        engine instanceof CricketEngine ? engine : null,
      );
    },
  };
}
