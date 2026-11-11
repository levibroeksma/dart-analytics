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
  aceLastLabel,
  aceRoundResults,
  aceRoundRow,
  aceSeatResult,
  aceSeatTarget,
  aceTargetLabel,
  mintAceDrawSeed,
} from "@lib/game/ace-seats";
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
import type { AceState } from "@modules/types";
import type {
  AcePlayContext,
  AceResultsSnapshot,
  AceRoundRow,
  GamePreviewSegment,
  MarksRing,
} from "./types";
import {
  AceEngine,
  aceDartPoints,
  aceTargetFor,
  foldAceState,
} from "@modules/game/ace.engine.module";

const GAME_TYPE_KEY = "ACE";
const RULESET_VERSION_KEY: RulesetVersionKey = "ACE_V1";

/** Rebuilds the engine for the persisted session from the store's fact log. */
function resumeEngine(
  game: AcePlayContext["$store"]["game"],
): AceEngine | null {
  return resumeGameEngine(
    game,
    RULESET_VERSION_KEY,
    (engine): engine is AceEngine => engine instanceof AceEngine,
  );
}

function factsOf(context: AcePlayContext) {
  return {
    stages: context.$store.game.stages,
    turns: context.$store.game.turns,
  };
}

/** `acePlay`'s methods; each reads its instance through `this`. */
const acePlayMethods = {
  state(this: AcePlayContext): AceState | null {
    const config = this.$store.game.configSnapshot;
    if (!config) return null;
    return foldAceState(factsOf(this), config);
  },

  /** Play-header subtitle: the active seat's round of the total. */
  subtitle(this: AcePlayContext): string {
    const config = this.$store.game.configSnapshot;
    const seat = seatStateFor(
      this.state(),
      this.state()?.activeParticipantRef ?? "",
    );
    if (!config || !seat) return "";
    return joinSubtitle([
      `Round ${Math.min(seat.visits + 1, config.rounds)} of ${config.rounds}`,
    ]);
  },

  /** The target the seat throws at next: the number, or `Bull`. */
  targetLabelFor(this: AcePlayContext, seatRef: string): string {
    const config = this.$store.game.configSnapshot;
    const seat = seatStateFor(this.state(), seatRef);
    if (!config || !seat) return "";
    return aceTargetLabel(aceSeatTarget(seat, config));
  },

  targetLabel(this: AcePlayContext): string {
    return forActiveSeat(this, (ref) => this.targetLabelFor(ref), "");
  },

  /** A seat's running Ace total. */
  totalLabelFor(this: AcePlayContext, seatRef: string): string {
    const seat = seatStateFor(this.state(), seatRef);
    return seat ? String(seat.total) : "";
  },

  totalLabel(this: AcePlayContext): string {
    return forActiveSeat(this, (ref) => this.totalLabelFor(ref), "");
  },

  /** The open visit's Ace points; `—` with no dart thrown yet. */
  visitLabelFor(this: AcePlayContext, seatRef: string): string {
    const seat = seatStateFor(this.state(), seatRef);
    if (!seat) return "";
    return seat.dartsInVisit > 0 ? String(seat.openPoints) : "—";
  },

  visitLabel(this: AcePlayContext): string {
    return forActiveSeat(this, (ref) => this.visitLabelFor(ref), "");
  },

  /** How the seat's last closed round scored: `+3`, `0`, or `—` before its first. */
  lastLabelFor(this: AcePlayContext, seatRef: string): string {
    const config = this.$store.game.configSnapshot;
    if (!config || !seatStateFor(this.state(), seatRef)) return "";
    return aceLastLabel(factsOf(this), config, seatRef);
  },

  lastLabel(this: AcePlayContext): string {
    return forActiveSeat(this, (ref) => this.lastLabelFor(ref), "");
  },

  isBullVisit(): boolean {
    return false;
  },

  /** The open (or last) visit's darts: a hit scored on that round's target, a miss did not. */
  previewSegments(this: AcePlayContext): GamePreviewSegment[] {
    const config = this.$store.game.configSnapshot;
    const turns = this.$store.game.turns;
    return playPreviewSegments(turns, this.hiddenTurnKey, (dart) => {
      const last = turns.at(-1)!;
      const round =
        turns.filter((turn) => turn.participantRef === last.participantRef)
          .length - 1;
      const target = aceTargetFor(config!.drawSeed, round);
      return aceDartPoints(target, dart) > 0 ? "hit" : "miss";
    });
  },

  /** Tapping the selected ring again returns to SINGLE. */
  setRing(this: AcePlayContext, ring: MarksRing) {
    toggleMarksRing(this, ring);
  },

  /** A tap on a board number with the selected ring; the ring then resets. */
  async recordNumber(this: AcePlayContext, n: number) {
    await recordMarksTap(this, n);
  },

  /** A tap on the bull with the selected ring (treble records a single bull). */
  async recordBull(this: AcePlayContext) {
    await recordMarksTap(this, 25);
  },

  /** A dart off the target scores nothing; MISS records it. */
  async recordMiss(this: AcePlayContext) {
    await recordMarksMiss(this);
  },

  uploadAndCompleteSession(this: AcePlayContext): Promise<void> {
    return playUploadAndCompleteSession(this, (finalState) => {
      const rounds = aceRoundResults(
        factsOf(this),
        this.$store.game.configSnapshot!,
      );
      return {
        status: "COMPLETE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat, index) =>
          aceSeatResult(seat, rounds, index),
        ),
        rounds,
      };
    });
  },

  resultsTitle(this: AcePlayContext): string {
    const snapshot = this.resultsSnapshot;
    if (!snapshot) return "Session complete";
    const winner = matchWinnerName(
      this.$store.game.seats,
      snapshot.winningSideKey,
    );
    return winner ? `${winner} wins!` : "Shared win";
  },

  /** The results' round list: each round with its target and the seats' points. */
  roundRows(this: AcePlayContext): AceRoundRow[] {
    return (this.resultsSnapshot?.rounds ?? []).map(aceRoundRow);
  },

  /** Replays the same preset: the rounds again, a fresh draw, the chosen starter first. */
  playAgain(this: AcePlayContext) {
    return runPlayAgain(
      this,
      GAME_TYPE_KEY,
      RULESET_VERSION_KEY,
      (engine) => (engine instanceof AceEngine ? engine : null),
      (prior) => {
        const drawSeed = mintAceDrawSeed();
        return {
          snapshot: { ...prior, drawSeed },
          wire: { rounds: prior.rounds, drawSeed },
        };
      },
    );
  },
};

export function acePlay() {
  return {
    ...playScreenState<AceEngine, AceResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...playScreenActions(),

    ring: "SINGLE" as MarksRing,
    ...acePlayMethods,
  };
}
