import { playAgainStarterData } from "@lib/game/play-again-starter";
import {
  playUploadAndCompleteSession,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import {
  boardPlayActions,
  playScreenActions,
  playScreenState,
} from "@lib/game/play-screen.data";
import {
  duelWinningSideKey,
  marksNumberTargets,
  marksObjectiveLabel,
  marksPlayAccessors,
  marksPreviewSegments,
  recordMarksMiss,
  recordMarksTap,
  resumeMarksEngine,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import type { RulesetVersionKey } from "@lib/types";
import type { MickeyMouseSeatState, MickeyMouseState } from "@modules/types";
import type {
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

const NUMBER_TARGETS: MickeyMouseTapTarget[] = marksNumberTargets(
  MICKEY_MOUSE_OBJECTIVES,
);

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

export function mickeyMousePlay() {
  return {
    ...playScreenState<MickeyMouseEngine, MickeyMouseResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...playScreenActions(),
    ring: "SINGLE" as MickeyMouseRing,

    state(this: MickeyMousePlayContext): MickeyMouseState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldMickeyMouseState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    ...marksPlayAccessors(MICKEY_MOUSE_OBJECTIVES, marksObjectiveLabel),

    previewSegments(this: MickeyMousePlayContext): Bobs27PreviewSegment[] {
      return marksPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        isMickeyMouseTarget,
      );
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

    uploadAndCompleteSession(this: MickeyMousePlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, computeStats);
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
