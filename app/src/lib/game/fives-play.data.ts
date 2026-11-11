import {
  playScreenState,
  boardPlayActions,
  playScreenActions,
  forActiveSeat,
  seatStateFor,
} from "@lib/game/play-screen.data";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { matchWinnerName } from "@lib/game/match-result-text";
import {
  fivesLastVisit,
  fivesLastVisitLabel,
  fivesSeatResult,
} from "@lib/game/fives-seats";
import {
  recordMarksMiss,
  recordMarksTap,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import {
  playPreviewSegments,
  playUploadAndCompleteSession,
  runPlayAgain,
  resumeGameEngine,
} from "@lib/game/play-lifecycle";
import { joinSubtitle } from "@lib/game/play-subtitle";
import type { RulesetVersionKey } from "@lib/types";
import type { FivesState } from "@modules/types";
import type {
  FivesPlayContext,
  FivesResultsSnapshot,
  GamePreviewSegment,
  MarksRing,
} from "./types";
import {
  FIVES_TARGET,
  FivesEngine,
  foldFivesState,
} from "@modules/game/fives.engine.module";

const GAME_TYPE_KEY = "FIVES";
const RULESET_VERSION_KEY: RulesetVersionKey = "FIVES_V1";

/** Rebuilds the engine for the persisted session from the store's fact log. */
function resumeEngine(
  game: FivesPlayContext["$store"]["game"],
): FivesEngine | null {
  return resumeGameEngine(
    game,
    RULESET_VERSION_KEY,
    (engine): engine is FivesEngine => engine instanceof FivesEngine,
  );
}

/** `fivesPlay`'s methods; each reads its instance through `this`. */
const fivesPlayMethods = {
  state(this: FivesPlayContext): FivesState | null {
    const config = this.$store.game.configSnapshot;
    if (!config) return null;
    return foldFivesState(
      { stages: this.$store.game.stages, turns: this.$store.game.turns },
      config,
    );
  },

  /** Play-header subtitle: the target every seat races to. */
  subtitle(this: FivesPlayContext): string {
    const config = this.$store.game.configSnapshot;
    if (!config) return "";
    return joinSubtitle([`First to exactly ${FIVES_TARGET}`]);
  },

  /** A seat's running fives total toward 51. */
  totalLabelFor(this: FivesPlayContext, seatRef: string): string {
    const seat = seatStateFor(this.state(), seatRef);
    return seat ? String(seat.total) : "";
  },

  totalLabel(this: FivesPlayContext): string {
    return forActiveSeat(this, (ref) => this.totalLabelFor(ref), "");
  },

  /** The open visit's running dart sum; `—` with no dart thrown yet. */
  visitLabelFor(this: FivesPlayContext, seatRef: string): string {
    const seat = seatStateFor(this.state(), seatRef);
    if (!seat) return "";
    return seat.dartsInVisit > 0 ? String(seat.openTotal) : "—";
  },

  visitLabel(this: FivesPlayContext): string {
    return forActiveSeat(this, (ref) => this.visitLabelFor(ref), "");
  },

  /** How the seat's last closed visit scored: `+9`, `0`, `Void` or `Bust`. */
  lastLabelFor(this: FivesPlayContext, seatRef: string): string {
    if (!seatStateFor(this.state(), seatRef)) return "";
    return fivesLastVisitLabel(fivesLastVisit(this.$store.game.turns, seatRef));
  },

  lastLabel(this: FivesPlayContext): string {
    return forActiveSeat(this, (ref) => this.lastLabelFor(ref), "");
  },

  isBullVisit(): boolean {
    return false;
  },

  /** The open (or last) visit's darts: on the board is a hit, off it a miss. */
  previewSegments(this: FivesPlayContext): GamePreviewSegment[] {
    return playPreviewSegments(
      this.$store.game.turns,
      this.hiddenTurnKey,
      (dart) => (dart.score > 0 ? "hit" : "miss"),
    );
  },

  /** Tapping the selected ring again returns to SINGLE. */
  setRing(this: FivesPlayContext, ring: MarksRing) {
    toggleMarksRing(this, ring);
  },

  /** A tap on a board number with the selected ring; the ring then resets. */
  async recordNumber(this: FivesPlayContext, n: number) {
    await recordMarksTap(this, n);
  },

  /** A tap on the bull with the selected ring (treble records a single bull). */
  async recordBull(this: FivesPlayContext) {
    await recordMarksTap(this, 25);
  },

  /** A dart off the board: it voids the visit. */
  async recordMiss(this: FivesPlayContext) {
    await recordMarksMiss(this);
  },

  uploadAndCompleteSession(this: FivesPlayContext): Promise<void> {
    return playUploadAndCompleteSession(this, (finalState) => ({
      status: "COMPLETE",
      winningSideKey: finalState.winningSideKey,
      seats: finalState.seats.map(fivesSeatResult),
    }));
  },

  resultsTitle(this: FivesPlayContext): string {
    const snapshot = this.resultsSnapshot;
    if (!snapshot) return "Session complete";
    const winner = matchWinnerName(
      this.$store.game.seats,
      snapshot.winningSideKey,
    );
    return winner ? `${winner} wins!` : "Session complete";
  },

  /** Replays the same preset with the chosen starter seated first. */
  playAgain(this: FivesPlayContext) {
    return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FivesEngine ? engine : null,
    );
  },
};

export function fivesPlay() {
  return {
    ...playScreenState<FivesEngine, FivesResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...playScreenActions(),

    ring: "SINGLE" as MarksRing,
    ...fivesPlayMethods,
  };
}
