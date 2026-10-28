import { getEngineFactory } from "@modules/game/engine.registry";
import { boardInputData } from "@lib/game/board-input.data";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { matchWinnerName } from "@lib/game/match-result-text";
import {
  killerSeatResult,
  outOrderNames,
  starterFirstNumbers,
} from "@lib/game/killer-seats";
import {
  recordMarksMiss,
  recordMarksTap,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
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
  variantsPlayAgain,
} from "@lib/game/play-lifecycle";
import { joinSubtitle } from "@lib/game/play-subtitle";
import type { KillerSnapshot, RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  KillerSeatState,
  KillerState,
} from "@modules/types";
import type {
  BoardMarker,
  GamePreviewSegment,
  KillerPlayContext,
  KillerResultsSnapshot,
  MarksRing,
} from "./types";
import {
  KillerEngine,
  foldKillerState,
} from "@modules/game/killer.engine.module";

const GAME_TYPE_KEY = "KILLER";
const RULESET_VERSION_KEY: RulesetVersionKey = "KILLER_V1";

/** Rebuilds the engine for the persisted session from the store's fact log. */
function resumeEngine(
  game: KillerPlayContext["$store"]["game"],
): KillerEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof KillerEngine ? engine : null;
}

/** A seat in the folded state by ref. */
function seatOf(
  context: KillerPlayContext,
  seatRef: string,
): KillerSeatState | undefined {
  return context
    .state()
    ?.seats.find((candidate) => candidate.participantRef === seatRef);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach
 * this page's own `recordDart` with the live, reactive `this`.
 */
export function killerPlay() {
  let self: KillerPlayContext;

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
    resultsSnapshot: null as KillerResultsSnapshot | null,
    ...playAgainStarterData(),
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as KillerEngine | null,
    ring: "SINGLE" as MarksRing,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: KillerPlayContext): KillerState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldKillerState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** Play-header subtitle: `YOU: 20 · GUEST: 19`; blank before config loads. */
    subtitle(this: KillerPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "";
      return joinSubtitle(
        config.seats.map(
          (seat, i) =>
            `${seat.displayName.toUpperCase()}: ${config.seatNumbers[i]}`,
        ),
      );
    },

    livesLabelFor(this: KillerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.lives) : "";
    },

    livesLabel(this: KillerPlayContext): string {
      const state = this.state();
      return state ? this.livesLabelFor(state.activeParticipantRef) : "";
    },

    numberLabelFor(this: KillerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.number) : "";
    },

    numberLabel(this: KillerPlayContext): string {
      const state = this.state();
      return state ? this.numberLabelFor(state.activeParticipantRef) : "";
    },

    /** `OUT` once eliminated, `KILLER` while armed, else `—`. */
    statusLabelFor(this: KillerPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      if (!seat) return "";
      if (seat.out) return "OUT";
      return seat.killer ? "KILLER" : "—";
    },

    statusLabel(this: KillerPlayContext): string {
      const state = this.state();
      return state ? this.statusLabelFor(state.activeParticipantRef) : "";
    },

    isBullVisit(): boolean {
      return false;
    },

    /** The open (or last) visit's darts: a double is a hit, anything else a miss. */
    previewSegments(this: KillerPlayContext): GamePreviewSegment[] {
      return playPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        (dart) => (dart.hitZoneKey === "DOUBLE" ? "hit" : "miss"),
      );
    },

    async init(this: KillerPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: KillerPlayContext) {
      return playRetryReconciliation(this);
    },

    /** Tapping the selected ring again returns to SINGLE. */
    setRing(this: KillerPlayContext, ring: MarksRing) {
      toggleMarksRing(this, ring);
    },

    /** A tap on a board number with the selected ring; the ring then resets. */
    async recordNumber(this: KillerPlayContext, n: number) {
      await recordMarksTap(this, n);
    },

    /** A tap on the bull with the selected ring (treble records a single bull). */
    async recordBull(this: KillerPlayContext) {
      await recordMarksTap(this, 25);
    },

    /** A dart off every number: counts as thrown, changes nothing. */
    async recordMiss(this: KillerPlayContext) {
      await recordMarksMiss(this);
    },

    async recordDart(this: KillerPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: KillerPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` with the shared play-lifecycle one. */
    visitMarkers(this: KillerPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: KillerPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: KillerPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: "COMPLETE",
        winningSideKey: finalState.winningSideKey,
        outOrder: [...finalState.outOrder],
        seats: finalState.seats.map(killerSeatResult),
      }));
    },

    resultsTitle(this: KillerPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "Session complete";
      const winner = matchWinnerName(
        this.$store.game.seats,
        snapshot.winningSideKey,
      );
      return winner ? `${winner} wins!` : "Session complete";
    },

    /** Eliminated seats' names in elimination order; blank before the results exist. */
    outOrderLabel(this: KillerPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "";
      return outOrderNames(snapshot.outOrder, this.$store.game.seats);
    },

    back(this: KillerPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: KillerPlayContext) {
      return playAbandonAndExit(this);
    },

    /** Replays the same preset, resending lives and seat numbers with the starter's number first. */
    playAgain(this: KillerPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof KillerEngine ? engine : null),
        (prior) =>
          variantsPlayAgain<KillerSnapshot>(RULESET_VERSION_KEY)({
            ...prior,
            seatNumbers: starterFirstNumbers(
              prior.seatNumbers,
              this.playAgainStarter ?? 0,
            ),
          }),
      );
    },
  };
}
