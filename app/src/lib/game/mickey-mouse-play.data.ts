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
  MickeyMouseObjective,
  MickeyMouseSeatState,
  MickeyMouseState,
} from "@modules/types";
import type {
  BoardMarker,
  Bobs27PreviewSegment,
  MickeyMousePlayContext,
  MickeyMouseResultsSnapshot,
  MickeyMouseSeatResult,
  MickeyMouseRing,
  MickeyMouseTapTarget,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// mickeyMouseEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  foldMickeyMouseState,
  isMickeyMouseTarget,
  MICKEY_MOUSE_OBJECTIVES,
  MickeyMouseEngine,
} from "@modules/game/mickey-mouse.engine.module";

const GAME_TYPE_KEY = "MICKEY_MOUSE";
const RESUMABLE = new Set<RulesetVersionKey>(["MICKEY_MOUSE_V1"]);

function objectiveLabel(objective: MickeyMouseObjective): string {
  if (objective === "DOUBLES") return "Doubles";
  if (objective === "TRIPLES") return "Triples";
  return objective === BULL_TARGET_NUMBER ? "Bull" : String(objective);
}

const NUMBER_TARGETS: MickeyMouseTapTarget[] = MICKEY_MOUSE_OBJECTIVES.filter(
  (objective): objective is number => typeof objective === "number",
).map((number) => ({ number, label: objectiveLabel(number) }));

const LOW_TARGETS: MickeyMouseTapTarget[] = Array.from(
  { length: 11 },
  (_, i) => ({ number: 11 - i, label: String(11 - i) }),
);

/** One seat's results row: darts thrown and the dart each objective closed on. */
export function mickeyMouseSeatResult(
  seat: MickeyMouseSeatState,
): MickeyMouseSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    darts: seat.dartsThrown,
    dartsToClose: [...seat.closedAtDart],
  };
}

function computeStats(state: MickeyMouseState): MickeyMouseResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: duelWinningSideKey(state),
    seats: state.seats.map(mickeyMouseSeatResult),
  };
}

function resumeEngine(
  game: MickeyMousePlayContext["$store"]["game"],
): MickeyMouseEngine | null {
  return resumeMarksEngine(
    game,
    RESUMABLE,
    (engine): engine is MickeyMouseEngine =>
      engine instanceof MickeyMouseEngine,
  );
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function mickeyMousePlay() {
  let self: MickeyMousePlayContext;

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
    resultsSnapshot: null as MickeyMouseResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as MickeyMouseEngine | null,
    ring: "SINGLE" as MickeyMouseRing,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: MickeyMousePlayContext): MickeyMouseState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldMickeyMouseState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    ...marksPlayAccessors(MICKEY_MOUSE_OBJECTIVES, objectiveLabel),

    previewSegments(this: MickeyMousePlayContext): Bobs27PreviewSegment[] {
      return marksPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        isMickeyMouseTarget,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: MickeyMousePlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async init(this: MickeyMousePlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: MickeyMousePlayContext) {
      return playRetryReconciliation(this);
    },

    /** Tapping the selected ring again returns to SINGLE. */
    setRing(this: MickeyMousePlayContext, ring: MickeyMouseRing) {
      toggleMarksRing(this, ring);
    },

    /** The buttons the recreational input shows: 20–12 and Bull, plus 11…1
     * once Double or Treble is selected so a D/T on any number can be entered. */
    tapTargets(this: MickeyMousePlayContext): MickeyMouseTapTarget[] {
      return this.ring === "SINGLE"
        ? NUMBER_TARGETS
        : [...NUMBER_TARGETS, ...LOW_TARGETS];
    },

    /** The recreational input's entry point: a tap on a board number with the
     * selected ring. The ring resets after every tap; Treble on the bull
     * (which has no such ring) records a single bull. */
    async recordTarget(this: MickeyMousePlayContext, number: number) {
      await recordMarksTap(this, number);
    },

    /** A dart off every objective: counts as thrown, marks nothing. */
    async recordMiss(this: MickeyMousePlayContext) {
      await recordMarksMiss(this);
    },

    async recordDart(
      this: MickeyMousePlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(
      this: MickeyMousePlayContext,
      observation: DartObservation,
    ) {
      await playCommitDart(this, observation);
    },

    async undoVisit(this: MickeyMousePlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: MickeyMousePlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
    },

    back(this: MickeyMousePlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: MickeyMousePlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, under
     * the session's own ruleset key, with no overrides.
     */
    playAgain(this: MickeyMousePlayContext) {
      const key = this.$store.game.rulesetVersionKey;
      if (!key) return Promise.resolve();
      return runPlayAgain(this, GAME_TYPE_KEY, key, (engine) =>
        engine instanceof MickeyMouseEngine ? engine : null,
      );
    },
  };
}
