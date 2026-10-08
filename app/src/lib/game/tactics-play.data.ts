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
import { joinSubtitle } from "@lib/game/play-subtitle";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  TacticsObjective,
  TacticsSeatState,
  TacticsState,
} from "@modules/types";
import type {
  BoardMarker,
  Bobs27PreviewSegment,
  TacticsObjectiveRow,
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
const RULESET_VERSION_KEY: RulesetVersionKey = "TACTICS_V1";

const BULL_RING: Record<Exclude<TacticsRing, "TREBLE">, DartZoneKey> = {
  SINGLE: "OUTER_BULL",
  DOUBLE: "INNER_BULL",
};

/** The recreational tap → `DartObservation` for a board number and ring. */
export function tacticsTapObservation(
  number: number,
  ring: TacticsRing,
): DartObservation {
  if (number === BULL_TARGET_NUMBER) {
    if (ring === "TREBLE") throw new Error("The bull has no treble ring.");
    return {
      hitTargetNumber: number,
      hitZoneKey: BULL_RING[ring],
      locationX: null,
      locationY: null,
    };
  }
  return {
    hitTargetNumber: number,
    hitZoneKey: ring,
    locationX: null,
    locationY: null,
  };
}

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

/** One seat's results row: darts, MPR to 2 dp, the dart each objective closed on. */
export function tacticsSeatResult(seat: TacticsSeatState): TacticsSeatResult {
  const dartsToClose = TACTICS_OBJECTIVES.map(
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

function computeStats(state: TacticsState): TacticsResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: null,
    seats: state.seats.map(tacticsSeatResult),
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `bobs27-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: TacticsPlayContext["$store"]["game"],
): TacticsEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof TacticsEngine ? engine : null;
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

    /** Play-header subtitle: `SOLO · 9 OBJECTIVES`; blank before config loads. */
    subtitle(this: TacticsPlayContext): string {
      if (!this.$store.game.configSnapshot) return "";
      return joinSubtitle(["SOLO", `${TACTICS_OBJECTIVES.length} OBJECTIVES`]);
    },

    objectiveRows(this: TacticsPlayContext): TacticsObjectiveRow[] {
      const seat = this.state()?.seats[0];
      return TACTICS_OBJECTIVES.map((objective, i) => ({
        label: objectiveLabel(objective),
        objective,
        marks: seat?.marks[i] ?? 0,
        closed: (seat?.marks[i] ?? 0) === 3,
      }));
    },

    dartsThrown(this: TacticsPlayContext): string {
      return String(this.state()?.seats[0]?.dartsThrown ?? 0);
    },

    previewSegments(this: TacticsPlayContext): Bobs27PreviewSegment[] {
      const open = openVisit(this.$store.game.turns);
      const darts =
        open && open.clientKey !== this.hiddenTurnKey ? open.darts : [];
      return [0, 1, 2].map((i) =>
        i >= darts.length
          ? { status: "empty" }
          : { status: isTacticsTarget(darts[i]) ? "hit" : "miss" },
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
      this.ring = this.ring === ring ? "SINGLE" : ring;
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
      if (!this.engine || this.finished) return;
      const ring =
        number === BULL_TARGET_NUMBER && this.ring === "TREBLE"
          ? "SINGLE"
          : this.ring;
      this.ring = "SINGLE";
      await this.commitDart(tacticsTapObservation(number, ring));
    },

    /** A dart off every objective: counts as thrown, marks nothing. */
    async recordMiss(this: TacticsPlayContext) {
      if (!this.engine || this.finished) return;
      this.ring = "SINGLE";
      await this.commitDart({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
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

    resultsTitle(): string {
      return "Closed out!";
    },

    back(this: TacticsPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: TacticsPlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings.
     */
    playAgain(this: TacticsPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof TacticsEngine ? engine : null,
      );
    },
  };
}
