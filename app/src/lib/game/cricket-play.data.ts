import { getEngineFactory } from "@modules/game/engine.registry";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { openVisit } from "@modules/game/turn-log.module";
import { boardInputData } from "@lib/game/board-input.data";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  DartZoneKey,
} from "@modules/types";
import type {
  BoardMarker,
  Bobs27PreviewSegment,
  CricketObjectiveRow,
  CricketPlayContext,
  CricketResultsSnapshot,
  CricketRing,
  CricketSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// cricketEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  CRICKET_OBJECTIVES,
  CricketEngine,
  cricketMarksOf,
  foldCricketState,
  marksPerRound,
} from "@modules/game/cricket.engine.module";

const GAME_TYPE_KEY = "CRICKET";
const RULESET_VERSION_KEY: RulesetVersionKey = "CRICKET_V1";

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

/** One seat's results row: darts, MPR to 2 dp, the dart each objective closed on. */
export function cricketSeatResult(seat: CricketSeatState): CricketSeatResult {
  const dartsToClose = CRICKET_OBJECTIVES.map(
    (objective, i) =>
      `${objectiveLabel(objective)}: ${seat.closedAtDart[i] ?? "–"}`,
  ).join(" · ");
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    marksPerRound: marksPerRound(seat).toFixed(2),
    dartsToClose,
  };
}

function computeStats(state: CricketState): CricketResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: null,
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
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof CricketEngine ? engine : null;
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

    objectiveRows(this: CricketPlayContext): CricketObjectiveRow[] {
      const seat = this.state()?.seats[0];
      return CRICKET_OBJECTIVES.map((objective, i) => ({
        label: objectiveLabel(objective),
        objective,
        marks: seat?.marks[i] ?? 0,
        closed: (seat?.marks[i] ?? 0) === 3,
      }));
    },

    dartsThrown(this: CricketPlayContext): string {
      return String(this.state()?.seats[0]?.dartsThrown ?? 0);
    },

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
    },

    async undoVisit(this: CricketPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: CricketPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
    },

    resultsTitle(): string {
      return "Closed out!";
    },

    back(this: CricketPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: CricketPlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings.
     */
    playAgain(this: CricketPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof CricketEngine ? engine : null,
      );
    },
  };
}
