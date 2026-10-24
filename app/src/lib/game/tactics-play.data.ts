import { playAgainStarterData } from "@lib/game/play-again-starter";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
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
import {
  duelWinningSideKey,
  marksPlayAccessors,
  marksPreviewSegments,
  recordMarksMiss,
  recordMarksTap,
  resumeMarksEngine,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  TacticsObjective,
  TacticsSeatState,
  TacticsState,
} from "@modules/types";
import type {
  BoardMarker,
  Bobs27PreviewSegment,
  TacticsPlayContext,
  TacticsResultsSnapshot,
  TacticsRing,
  TacticsSeatResult,
  TacticsTapTarget,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tacticsEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  foldTacticsState,
  isTacticsTarget,
  TACTICS_OBJECTIVES,
  TacticsEngine,
} from "@modules/game/tactics.engine.module";
import { marksPerRound } from "@modules/game/marks-close.module";

const GAME_TYPE_KEY = "TACTICS";
const RESUMABLE = new Set<RulesetVersionKey>(["TACTICS_V1", "TACTICS_V2"]);

function objectiveLabel(objective: TacticsObjective): string {
  if (objective === "DOUBLES") return "Doubles";
  if (objective === "TRIPLES") return "Triples";
  return objective === BULL_TARGET_NUMBER ? "Bull" : String(objective);
}

const NUMBER_TARGETS: TacticsTapTarget[] = TACTICS_OBJECTIVES.filter(
  (objective): objective is number => typeof objective === "number",
).map((number) => ({ number, label: objectiveLabel(number) }));

const LOW_TARGETS: TacticsTapTarget[] = Array.from({ length: 14 }, (_, i) => ({
  number: 14 - i,
  label: String(14 - i),
}));

/** One seat's results row: darts, MPR to 2 dp, bull hits, the dart each objective closed on. */
export function tacticsSeatResult(seat: TacticsSeatState): TacticsSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    marksPerRound: marksPerRound(seat).toFixed(2),
    bulls: seat.objectiveHits[TACTICS_OBJECTIVES.indexOf(BULL_TARGET_NUMBER)],
    points: seat.points,
    dartsToClose: [...seat.closedAtDart],
  };
}

function computeStats(state: TacticsState): TacticsResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: duelWinningSideKey(state),
    seats: state.seats.map(tacticsSeatResult),
  };
}

function resumeEngine(
  game: TacticsPlayContext["$store"]["game"],
): TacticsEngine | null {
  return resumeMarksEngine(
    game,
    RESUMABLE,
    (engine): engine is TacticsEngine => engine instanceof TacticsEngine,
  );
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function tacticsPlay() {
  let self: TacticsPlayContext;

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
    ...playAgainStarterData(),
    resultsSnapshot: null as TacticsResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as TacticsEngine | null,
    ring: "SINGLE" as TacticsRing,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: TacticsPlayContext): TacticsState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldTacticsState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    ...marksPlayAccessors(TACTICS_OBJECTIVES, objectiveLabel),

    previewSegments(this: TacticsPlayContext): Bobs27PreviewSegment[] {
      return marksPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        isTacticsTarget,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: TacticsPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async init(this: TacticsPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: TacticsPlayContext) {
      return playRetryReconciliation(this);
    },

    /** Tapping the selected ring again returns to SINGLE. */
    setRing(this: TacticsPlayContext, ring: TacticsRing) {
      toggleMarksRing(this, ring);
    },

    /** The buttons the recreational input shows: 20–15 and Bull, plus 14…1
     * once Double or Treble is selected so a D/T on any number can be entered. */
    tapTargets(this: TacticsPlayContext): TacticsTapTarget[] {
      return this.ring === "SINGLE"
        ? NUMBER_TARGETS
        : [...NUMBER_TARGETS, ...LOW_TARGETS];
    },

    /** The recreational input's entry point: a tap on a board number with the
     * selected ring. The ring resets after every tap; Treble on the bull
     * (which has no such ring) records a single bull. */
    async recordTarget(this: TacticsPlayContext, number: number) {
      await recordMarksTap(this, number);
    },

    /** A dart off every objective: counts as thrown, marks nothing. */
    async recordMiss(this: TacticsPlayContext) {
      await recordMarksMiss(this);
    },

    async recordDart(this: TacticsPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: TacticsPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
    },

    async undoVisit(this: TacticsPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: TacticsPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
    },

    back(this: TacticsPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: TacticsPlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, under
     * the session's own ruleset key, with no overrides.
     */
    playAgain(this: TacticsPlayContext) {
      const key = this.$store.game.rulesetVersionKey;
      if (!key) return Promise.resolve();
      return runPlayAgain(this, GAME_TYPE_KEY, key, (engine) =>
        engine instanceof TacticsEngine ? engine : null,
      );
    },
  };
}
