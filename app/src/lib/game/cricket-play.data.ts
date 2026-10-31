import {
  playScreenState,
  boardPlayActions,
  botVisualBoardData,
  playScreenActions,
} from "@lib/game/play-screen.data";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { botThrowObservation } from "@lib/game/play-bot-seat";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
import {
  playUploadAndCompleteSession,
  runPlayAgain,
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
import type { CricketSeatState, CricketState } from "@modules/types";
import type {
  Bobs27PreviewSegment,
  CricketPlayContext,
  CricketResultsSnapshot,
  CricketRing,
  CricketSeatResult,
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

export function cricketPlay() {
  return {
    ...playScreenState<CricketEngine, CricketResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...botVisualBoardData(throwBotDart),
    ...playScreenActions(),

    ring: "SINGLE" as CricketRing,

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

    uploadAndCompleteSession(this: CricketPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
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
