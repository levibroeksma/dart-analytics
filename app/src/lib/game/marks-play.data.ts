import { matchWinnerName } from "@lib/game/match-result-text";
import { joinSubtitle } from "@lib/game/play-subtitle";
import type { MarksSeatState } from "@modules/types";
import type { MarksObjectiveRow } from "./types";

type SeatsState = { seats: readonly MarksSeatState[] } | null;

/** The seat with this participant ref, or undefined for a null state or unknown ref. */
function seatByRef<TSeat extends MarksSeatState>(
  state: { seats: readonly TSeat[] } | null,
  ref: string | undefined,
): TSeat | undefined {
  return state?.seats.find((seat) => seat.participantRef === ref);
}

function duelFlags(
  scores: boolean,
  marks: number,
  opponentMarks: number | null,
): Pick<MarksObjectiveRow<unknown>, "scoring" | "dead"> {
  if (!scores || opponentMarks === null || marks < 3) {
    return { scoring: false, dead: false };
  }
  return { scoring: opponentMarks < 3, dead: opponentMarks === 3 };
}

/** One seat's play-board rows; the opponent fields and flags are set only in a duel. */
function markRowsFor<TSeat extends MarksSeatState, TObjective>(
  state: { seats: readonly TSeat[] } | null,
  ref: string | undefined,
  objectives: readonly TObjective[],
  labelOf: (objective: TObjective) => string,
): MarksObjectiveRow<TObjective>[] {
  const seat = seatByRef(state, ref);
  const opponent = state?.seats.find(
    (candidate) => candidate.participantRef !== ref,
  );
  const duel = (state?.seats.length ?? 0) > 1;
  return objectives.map((objective, i) => {
    const marks = seat?.marks[i] ?? 0;
    const opponentMarks = duel ? (opponent?.marks[i] ?? 0) : null;
    return {
      label: labelOf(objective),
      objective,
      marks,
      closed: marks === 3,
      opponentMarks,
      ...duelFlags(typeof objective === "number", marks, opponentMarks),
    };
  });
}

function seatPointsText(
  state: { seats: readonly (MarksSeatState & { points: number })[] } | null,
  ref: string | undefined,
): string {
  return String(seatByRef(state, ref)?.points ?? 0);
}

function closedCountText(state: SeatsState, ref: string | undefined): string {
  const seat = seatByRef(state, ref);
  return String(seat?.marks.filter((count) => count === 3).length ?? 0);
}

function dartsThrownText(state: SeatsState, ref: string | undefined): string {
  return String(seatByRef(state, ref)?.dartsThrown ?? 0);
}

/** The winning seat's side key, or null while no seat has won. */
export function duelWinningSideKey(state: {
  seats: readonly { participantRef: string; sideKey: string }[];
  winnerParticipantRef: string | null;
}): string | null {
  const winner = state.seats.find(
    (seat) => seat.participantRef === state.winnerParticipantRef,
  );
  return winner?.sideKey ?? null;
}

/** `SOLO · 7 OBJECTIVES` or `1V1 · 9 OBJECTIVES`. */
function marksSubtitle(seatCount: number, objectiveCount: number): string {
  return joinSubtitle([
    seatCount > 1 ? "1V1" : "SOLO",
    `${objectiveCount} OBJECTIVES`,
  ]);
}

/** Results heading: `Closed out!` solo, `<name> wins!` for a duel winner, else `Game over`. */
function marksResultsTitle(
  seats: Parameters<typeof matchWinnerName>[0],
  winningSideKey: string | null,
): string {
  if (seats.length < 2) return "Closed out!";
  const winner = matchWinnerName(seats, winningSideKey);
  return winner ? `${winner} wins!` : "Game over";
}

type MarksAccessorContext = {
  state(): { seats: readonly (MarksSeatState & { points: number })[] } | null;
  resultsSnapshot: { winningSideKey: string | null } | null;
  $store: {
    game: {
      configSnapshot: { seats: readonly unknown[] } | null;
      seats: Parameters<typeof matchWinnerName>[0];
    };
  };
};

/**
 * The Alpine accessors every marks game's play page shares: the header
 * subtitle, one seat's rows, a seat's points, closed count and darts, the
 * solo darts count and the results title.
 */
export function marksPlayAccessors<TObjective>(
  objectives: readonly TObjective[],
  labelOf: (objective: TObjective) => string,
) {
  return {
    /** `SOLO · N OBJECTIVES` or `1V1 · N OBJECTIVES`; blank before config loads. */
    subtitle(this: MarksAccessorContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "";
      return marksSubtitle(config.seats.length, objectives.length);
    },

    /** One seat's rows; the opponent fields are set only in a duel. */
    objectiveRowsFor(
      this: MarksAccessorContext,
      ref: string | undefined,
    ): MarksObjectiveRow<TObjective>[] {
      return markRowsFor(this.state(), ref, objectives, labelOf);
    },

    pointsFor(this: MarksAccessorContext, ref: string | undefined): string {
      return seatPointsText(this.state(), ref);
    },

    closedCountFor(
      this: MarksAccessorContext,
      ref: string | undefined,
    ): string {
      return closedCountText(this.state(), ref);
    },

    dartsThrownFor(
      this: MarksAccessorContext,
      ref: string | undefined,
    ): string {
      return dartsThrownText(this.state(), ref);
    },

    dartsThrown(this: MarksAccessorContext): string {
      return String(this.state()?.seats[0]?.dartsThrown ?? 0);
    },

    resultsTitle(this: MarksAccessorContext): string {
      return marksResultsTitle(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
    },
  };
}
