import { getEngineFactory } from "@modules/game/engine.registry";
import { boardInputData } from "@lib/game/board-input.data";
import { matchWinnerName } from "@lib/game/match-result-text";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type {
  BaseballSeatState,
  BaseballState,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type {
  BaseballPlayContext,
  BaseballResultsSnapshot,
  BaseballSeatResult,
  BoardMarker,
  GamePreviewSegment,
} from "./types";
import {
  BASEBALL_INNINGS,
  BaseballEngine,
  foldBaseballState,
} from "@modules/game/baseball.engine.module";

const GAME_TYPE_KEY = "BASEBALL";
const RULESET_VERSION_KEY: RulesetVersionKey = "BASEBALL_V1";

/** The 1-indexed inning a seat is on, capped at 9 once the game ends. */
function inningOf(seat: BaseballSeatState): number {
  return Math.min(seat.targetIndex + 1, BASEBALL_INNINGS);
}

/** One seat's results, its accuracy replayed from its own darts: dart i was thrown in inning floor(i / 3) + 1. */
export function baseballSeatResult(
  seat: BaseballSeatState,
  turns: readonly TurnFact[],
): BaseballSeatResult {
  const darts = turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .flatMap((turn) => turn.darts);
  const hits = darts.filter(
    (dart, index) => dart.hitTargetNumber === Math.floor(index / 3) + 1,
  ).length;
  const best = Math.max(...seat.runsPerInning);
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    runs: seat.runs,
    accuracy: accuracyDisplay(hits, darts.length),
    bestInning: best > 0 ? seat.runsPerInning.indexOf(best) + 1 : null,
    runsPerInning: [...seat.runsPerInning],
  };
}

/** Rebuilds the engine for the persisted session from the store's fact log. */
function resumeEngine(
  game: BaseballPlayContext["$store"]["game"],
): BaseballEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof BaseballEngine ? engine : null;
}

/** A seat in the folded state by ref. */
function seatOf(
  context: BaseballPlayContext,
  seatRef: string,
): BaseballSeatState | undefined {
  return context
    .state()
    ?.seats.find((candidate) => candidate.participantRef === seatRef);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach
 * this page's own `recordDart` with the live, reactive `this`.
 */
export function baseballPlay() {
  let self: BaseballPlayContext;

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
    resultsSnapshot: null as BaseballResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as BaseballEngine | null,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: BaseballPlayContext): BaseballState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldBaseballState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** Play-header subtitle: `INNING 3 OF 9`; blank before config loads. */
    subtitle(this: BaseballPlayContext): string {
      const state = this.state();
      const seat = state && seatOf(this, state.activeParticipantRef);
      return seat ? `INNING ${inningOf(seat)} OF ${BASEBALL_INNINGS}` : "";
    },

    currentTargetLabelFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(inningOf(seat)) : "";
    },

    currentTargetLabel(this: BaseballPlayContext): string {
      const state = this.state();
      return state
        ? this.currentTargetLabelFor(state.activeParticipantRef)
        : "";
    },

    inningLabelFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? `${inningOf(seat)}/${BASEBALL_INNINGS}` : "";
    },

    inningLabel(this: BaseballPlayContext): string {
      const state = this.state();
      return state ? this.inningLabelFor(state.activeParticipantRef) : "";
    },

    currentScoreFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.runs) : "";
    },

    currentScore(this: BaseballPlayContext): string {
      const state = this.state();
      return state ? this.currentScoreFor(state.activeParticipantRef) : "";
    },

    isBullVisit(): boolean {
      return false;
    },

    /** The open (or last) visit's darts against its own inning's number. */
    previewSegments(this: BaseballPlayContext): GamePreviewSegment[] {
      const turns = this.$store.game.turns;
      const inning = turns.length;
      return playPreviewSegments(turns, this.hiddenTurnKey, (dart) =>
        dart.hitTargetNumber === inning ? "hit" : "miss",
      );
    },

    async init(this: BaseballPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: BaseballPlayContext) {
      return playRetryReconciliation(this);
    },

    /** The recreational tap: S/D/T on the inning's number, or MISS. */
    async recordTap(
      this: BaseballPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      const state = this.state();
      if (!this.engine || !state) return;
      const inning = Number(
        this.currentTargetLabelFor(state.activeParticipantRef),
      );
      await this.commitDart({
        hitTargetNumber: ring === "MISS" ? null : inning,
        hitZoneKey: ring,
        locationX: null,
        locationY: null,
      });
    },

    async recordDart(this: BaseballPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: BaseballPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` with the shared play-lifecycle one. */
    visitMarkers(this: BaseballPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: BaseballPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: BaseballPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => baseballSeatResult(seat, turns)),
      }));
    },

    resultsTitle(this: BaseballPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot || snapshot.seats.length === 1) {
        return "Nine innings played";
      }
      if (snapshot.status === "TIE") return "Tie — same runs!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        snapshot.winningSideKey,
      );
      return winner ? `${winner} wins!` : "Session complete";
    },

    back(this: BaseballPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: BaseballPlayContext) {
      return playAbandonAndExit(this);
    },

    /** Replays the same preset with no overrides — V1 has nothing to set. */
    playAgain(this: BaseballPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof BaseballEngine ? engine : null,
      );
    },
  };
}
