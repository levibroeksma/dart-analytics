import { boardInputData } from "@lib/game/board-input.data";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { matchWinnerName } from "@lib/game/match-result-text";
import { followTheLeaderResultsSnapshot } from "@lib/game/follow-the-leader-results";
import { outOrderNames } from "@lib/game/killer-seats";
import {
  recordMarksMiss,
  recordMarksTap,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUploadAndCompleteSession,
  playVisitMarkers,
  resumeGameEngine,
  runPlayAgain,
  variantsPlayAgain,
} from "@lib/game/play-lifecycle";
import { joinSubtitle } from "@lib/game/play-subtitle";
import { bedOf, sameBed } from "@modules/game/follow-the-leader-policy";
import {
  FollowTheLeaderEngine,
  foldFollowTheLeaderState,
} from "@modules/game/follow-the-leader.engine.module";
import type { RulesetVersionKey } from "@lib/types";
import type {
  BedFact,
  DartObservation,
  FollowTheLeaderAction,
  FollowTheLeaderSeatState,
  FollowTheLeaderState,
} from "@modules/types";
import type {
  BoardMarker,
  FollowTheLeaderPlayContext,
  FollowTheLeaderResultsSnapshot,
  GamePreviewSegment,
  MarksRing,
} from "./types";

const GAME_TYPE_KEY = "FOLLOW_THE_LEADER";
const RULESET_VERSION_KEY: RulesetVersionKey = "FOLLOW_THE_LEADER_V1";
const STOP_REFUSED = "Stop needs a match first";
const KEEP_REFUSED = "Keep not allowed";
const OPENING_NOTICE = "Opening dart: throw it with your off hand.";

const RING_WORDS = { SINGLE: "Single", DOUBLE: "Double", TREBLE: "Treble" };

/** The banner text of an exact bed, e.g. `Treble 18` or `Outer bull`; blank for none. */
function bedLabel(bed: BedFact | null): string {
  if (!bed) return "";
  if (bed.ring === "OUTER_BULL") return "Outer bull";
  if (bed.ring === "INNER_BULL") return "Inner bull";
  return `${RING_WORDS[bed.ring]} ${bed.number}`;
}

function seatOf(
  context: FollowTheLeaderPlayContext,
  seatRef: string,
): FollowTheLeaderSeatState | undefined {
  return context
    .state()
    ?.seats.find((candidate) => candidate.participantRef === seatRef);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach
 * this page's own `recordDart` with the live, reactive `this`.
 */
export function followTheLeaderPlay() {
  let self: FollowTheLeaderPlayContext;

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
    resultsSnapshot: null as FollowTheLeaderResultsSnapshot | null,
    ...playAgainStarterData(),
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as FollowTheLeaderEngine | null,
    ring: "SINGLE" as MarksRing,
    setChosen: false,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: FollowTheLeaderPlayContext): FollowTheLeaderState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldFollowTheLeaderState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    phase(this: FollowTheLeaderPlayContext) {
      return this.state()?.phase ?? "";
    },

    canStop(this: FollowTheLeaderPlayContext): boolean {
      return this.state()?.canStop ?? false;
    },

    keepAllowed(this: FollowTheLeaderPlayContext): boolean {
      return this.state()?.keepAllowed ?? false;
    },

    showKeepPrompt(this: FollowTheLeaderPlayContext): boolean {
      return this.keepAllowed() && !this.setChosen && !this.finished;
    },

    showPad(this: FollowTheLeaderPlayContext): boolean {
      return !this.showKeepPrompt();
    },

    targetLabel(this: FollowTheLeaderPlayContext): string {
      return bedLabel(this.state()?.target ?? null);
    },

    leaderName(this: FollowTheLeaderPlayContext): string {
      const leaderRef = this.state()?.leaderRef;
      if (!leaderRef) return "";
      return (
        this.$store.game.seats.find((seat) => seat.participantRef === leaderRef)
          ?.displayName ?? ""
      );
    },

    openingNotice(this: FollowTheLeaderPlayContext): string {
      return this.phase() === "OPENING" ? OPENING_NOTICE : "";
    },

    /** Play-header subtitle: `TARGET: Treble 18`; blank until a target is set. */
    subtitle(this: FollowTheLeaderPlayContext): string {
      const label = this.targetLabel();
      return joinSubtitle(label ? [`TARGET: ${label}`] : []);
    },

    livesLabelFor(this: FollowTheLeaderPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.lives) : "";
    },

    livesLabel(this: FollowTheLeaderPlayContext): string {
      const state = this.state();
      return state ? this.livesLabelFor(state.activeParticipantRef) : "";
    },

    /** `OUT` once eliminated, `LEADER` for the seat that set the target, else `—`. */
    statusLabelFor(this: FollowTheLeaderPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      if (!seat) return "";
      if (seat.out) return "OUT";
      return this.state()?.leaderRef === seatRef ? "LEADER" : "—";
    },

    statusLabel(this: FollowTheLeaderPlayContext): string {
      const state = this.state();
      return state ? this.statusLabelFor(state.activeParticipantRef) : "";
    },

    isBullVisit(): boolean {
      return false;
    },

    /** The open (or last) visit's darts: a dart in the target bed is a hit, anything else a miss. */
    previewSegments(this: FollowTheLeaderPlayContext): GamePreviewSegment[] {
      const target = this.state()?.target ?? null;
      return playPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
        (dart: DartObservation) => {
          const bed = bedOf(dart);
          return bed && target && sameBed(bed, target) ? "hit" : "miss";
        },
      );
    },

    async init(this: FollowTheLeaderPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, (game) =>
        resumeGameEngine(
          game,
          RULESET_VERSION_KEY,
          (engine): engine is FollowTheLeaderEngine =>
            engine instanceof FollowTheLeaderEngine,
        ),
      );
    },

    retryReconciliation(this: FollowTheLeaderPlayContext) {
      return playRetryReconciliation(this);
    },

    setRing(this: FollowTheLeaderPlayContext, ring: MarksRing) {
      toggleMarksRing(this, ring);
    },

    async recordNumber(this: FollowTheLeaderPlayContext, n: number) {
      await recordMarksTap(this, n);
    },

    async recordBull(this: FollowTheLeaderPlayContext) {
      await recordMarksTap(this, 25);
    },

    async recordMiss(this: FollowTheLeaderPlayContext) {
      await recordMarksMiss(this);
    },

    async recordDart(
      this: FollowTheLeaderPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(
      this: FollowTheLeaderPlayContext,
      observation: DartObservation,
    ) {
      const before = this.$store.game.turns;
      await playCommitDart(this, observation);
      if (this.$store.game.turns !== before) this.setChosen = false;
    },

    async commitAction(
      this: FollowTheLeaderPlayContext,
      action: FollowTheLeaderAction,
    ) {
      if (!this.engine || this.finished) return;
      if (this.$store.game.timerPaused) return;
      try {
        this.engine.record(action);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      this.setChosen = false;
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);
      armHiddenTimer(this, facts.turns);
      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    async stop(this: FollowTheLeaderPlayContext) {
      if (!this.canStop()) {
        this.error = STOP_REFUSED;
        return;
      }
      await this.commitAction({ kind: "STOP" });
    },

    async keep(this: FollowTheLeaderPlayContext) {
      if (!this.keepAllowed()) {
        this.error = KEEP_REFUSED;
        return;
      }
      await this.commitAction({ kind: "KEEP" });
    },

    chooseSet(this: FollowTheLeaderPlayContext) {
      this.setChosen = true;
    },

    visitMarkers(this: FollowTheLeaderPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: FollowTheLeaderPlayContext) {
      if (!this.engine || this.finished) return;
      if (!this.engine.undo()) return;
      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
      this.setChosen = false;
    },

    uploadAndCompleteSession(this: FollowTheLeaderPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, followTheLeaderResultsSnapshot);
    },

    resultsTitle(this: FollowTheLeaderPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "Session complete";
      const winner = matchWinnerName(
        this.$store.game.seats,
        snapshot.winningSideKey,
      );
      return winner ? `${winner} wins!` : "Session complete";
    },

    outOrderLabel(this: FollowTheLeaderPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot) return "";
      return outOrderNames(snapshot.outOrder, this.$store.game.seats);
    },

    back(this: FollowTheLeaderPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: FollowTheLeaderPlayContext) {
      return playAbandonAndExit(this);
    },

    /** Replays the same preset, seating the chosen starter first and resending lives. */
    playAgain(this: FollowTheLeaderPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof FollowTheLeaderEngine ? engine : null),
        variantsPlayAgain(RULESET_VERSION_KEY),
        () => {
          this.setChosen = false;
        },
      );
    },
  };
}
