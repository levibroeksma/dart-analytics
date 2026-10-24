import { getEngineFactory } from "@modules/game/engine.registry";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { openVisit } from "@modules/game/turn-log.module";
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
} from "@lib/game/marks-play.data";
import type { DartbotSeat, RulesetVersionKey } from "@lib/types";
import type { MarksView } from "@modules/interfaces";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  DartZoneKey,
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

const BULL_RING: Record<Exclude<CricketRing, "TREBLE">, DartZoneKey> = {
  SINGLE: "OUTER_BULL",
  DOUBLE: "INNER_BULL",
};

/** The recreational tap → `DartObservation` for an objective and ring. */
export function cricketTapObservation(
  objective: number,
  ring: CricketRing,
): DartObservation {
  if (objective === BULL_TARGET_NUMBER) {
    if (ring === "TREBLE") throw new Error("The bull has no treble ring.");
    return {
      hitTargetNumber: objective,
      hitZoneKey: BULL_RING[ring],
      locationX: null,
      locationY: null,
    };
  }
  return {
    hitTargetNumber: objective,
    hitZoneKey: ring,
    locationX: null,
    locationY: null,
  };
}

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

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `bobs27-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: CricketPlayContext["$store"]["game"],
): CricketEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE.has(rulesetVersionKey)
  ) {
    return null;
  }
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof CricketEngine ? engine : null;
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
      const open = openVisit(this.$store.game.turns);
      const darts =
        open && open.clientKey !== this.hiddenTurnKey ? open.darts : [];
      return [0, 1, 2].map((i) =>
        i >= darts.length
          ? { status: "empty" }
          : { status: cricketMarksOf(darts[i]) ? "hit" : "miss" },
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
      this.ring = this.ring === ring ? "SINGLE" : ring;
    },

    /** The recreational input's entry point: a tap on an objective with the
     * selected ring. The ring resets after every tap; Treble on the bull
     * (which has no such ring) records a single bull. */
    async recordObjective(this: CricketPlayContext, objective: number) {
      if (!this.engine || this.finished) return;
      const ring =
        objective === BULL_TARGET_NUMBER && this.ring === "TREBLE"
          ? "SINGLE"
          : this.ring;
      this.ring = "SINGLE";
      await this.commitDart(cricketTapObservation(objective, ring));
    },

    /** A dart off every objective: counts as thrown, marks nothing. */
    async recordMiss(this: CricketPlayContext) {
      if (!this.engine || this.finished) return;
      this.ring = "SINGLE";
      await this.commitDart({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
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
