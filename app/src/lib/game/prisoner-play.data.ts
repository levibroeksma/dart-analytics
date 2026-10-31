import { boardInputData } from "@lib/game/board-input.data";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { matchWinnerName } from "@lib/game/match-result-text";
import { outOrderNames } from "@lib/game/killer-seats";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  resumeGameEngine,
  runPlayAgain,
  variantsPlayAgain,
} from "@lib/game/play-lifecycle";
import { joinSubtitle } from "@lib/game/play-subtitle";
import {
  prisonerResultRows,
  prisonerResultsSnapshot,
  prisonerTargetText,
  prisonerWonByLabel,
} from "@lib/game/prisoner-results";
import {
  PrisonerEngine,
  foldPrisonerState,
} from "@modules/game/prisoner.engine.module";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  PrisonerSeatState,
  PrisonerState,
} from "@modules/types";
import type {
  BoardMarker,
  PrisonerLodgedEntry,
  PrisonerPlayContext,
  PrisonerResultRow,
  PrisonerResultsSnapshot,
} from "./types";

const GAME_TYPE_KEY = "PRISONER";
const RULESET_VERSION_KEY: RulesetVersionKey = "PRISONER_V1";

function seatOf(
  context: PrisonerPlayContext,
  seatRef: string,
): PrisonerSeatState | undefined {
  return context
    .state()
    ?.seats.find((candidate) => candidate.participantRef === seatRef);
}

/** The banner text of a seat's target, e.g. `Outer 7`; `Done` once 20 is completed. */
function targetText(seat: PrisonerSeatState): string {
  return prisonerTargetText(seat.target);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach
 * this page's own `recordDart` with the live, reactive `this`.
 */
export function prisonerPlay() {
  let self: PrisonerPlayContext;

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
    resultsSnapshot: null as PrisonerResultsSnapshot | null,
    ...playAgainStarterData(),
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as PrisonerEngine | null,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: PrisonerPlayContext): PrisonerState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldPrisonerState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** The visual board shows in an active, unpaused, unfinished session; Prisoner is board-only. */
    showBoard(this: PrisonerPlayContext): boolean {
      return (
        !this.finished && !this.$store.game.timerPaused && this.hasActiveSession
      );
    },

    isBullVisit(): boolean {
      return false;
    },

    targetLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? targetText(seat) : "";
    },

    targetLabel(this: PrisonerPlayContext): string {
      const state = this.state();
      return state ? this.targetLabelFor(state.activeParticipantRef) : "";
    },

    /** Play-header subtitle: `TARGET: Outer 7` for the active seat; blank before config loads. */
    subtitle(this: PrisonerPlayContext): string {
      const label = this.targetLabel();
      return joinSubtitle(label ? [`TARGET: ${label}`] : []);
    },

    heldLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.held) : "";
    },

    heldLabel(this: PrisonerPlayContext): string {
      const state = this.state();
      return state ? this.heldLabelFor(state.activeParticipantRef) : "";
    },

    sittingLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.sitting) : "";
    },

    sittingLabel(this: PrisonerPlayContext): string {
      const state = this.state();
      return state ? this.sittingLabelFor(state.activeParticipantRef) : "";
    },

    capturedLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.captured) : "";
    },

    imprisonedLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.imprisoned) : "";
    },

    /** Darts a seat has to throw: the active seat's remainder this visit, a waiting seat's next-visit budget. */
    dartsLeftLabelFor(this: PrisonerPlayContext, seatRef: string): string {
      const state = this.state();
      const seat = seatOf(this, seatRef);
      if (!state || !seat) return "";
      const active = state.activeParticipantRef === seatRef;
      return String(active ? state.dartsLeft : seat.budget);
    },

    dartsLeftLabel(this: PrisonerPlayContext): string {
      const state = this.state();
      return state ? this.dartsLeftLabelFor(state.activeParticipantRef) : "";
    },

    /** The numbers holding prisoners, ascending, each with its count. */
    lodgedList(this: PrisonerPlayContext): PrisonerLodgedEntry[] {
      const state = this.state();
      if (!state) return [];
      return Object.entries(state.lodged)
        .map(([number, count]) => ({ number: Number(number), count }))
        .sort((a, b) => a.number - b.number);
    },

    async init(this: PrisonerPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, (game) =>
        resumeGameEngine(
          game,
          RULESET_VERSION_KEY,
          (engine): engine is PrisonerEngine =>
            engine instanceof PrisonerEngine,
        ),
      );
    },

    retryReconciliation(this: PrisonerPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordDart(this: PrisonerPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: PrisonerPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
    },

    /** The board markers for the last visit's located darts; none once that visit's reveal has cleared. */
    visitMarkers(this: PrisonerPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: PrisonerPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: PrisonerPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, prisonerResultsSnapshot);
    },

    resultsTitle(this: PrisonerPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "Session complete";
      const winner = matchWinnerName(
        this.$store.game.seats,
        snapshot.winningSideKey,
      );
      return winner ? `${winner} wins!` : "Session complete";
    },

    /** Eliminated seats' names in elimination order; blank before the results exist. */
    outOrderLabel(this: PrisonerPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "";
      return outOrderNames(snapshot.outOrder, this.$store.game.seats);
    },

    wonByLabel(this: PrisonerPlayContext): string {
      return prisonerWonByLabel(this.resultsSnapshot);
    },

    resultRows(this: PrisonerPlayContext): PrisonerResultRow[] {
      return prisonerResultRows(this.resultsSnapshot, this.$store.game.seats);
    },

    back(this: PrisonerPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: PrisonerPlayContext) {
      return playAbandonAndExit(this);
    },

    /** Replays the same preset, seating the chosen starter first. */
    playAgain(this: PrisonerPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof PrisonerEngine ? engine : null),
        variantsPlayAgain(RULESET_VERSION_KEY),
      );
    },
  };
}
