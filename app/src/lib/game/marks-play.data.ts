import { matchWinnerName } from "@lib/game/match-result-text";
import { joinSubtitle } from "@lib/game/play-subtitle";
import type { MarksSeatState } from "@modules/types";
import type { MarksObjectiveRow } from "./types";

type SeatsState = { seats: readonly MarksSeatState[] } | null;

/** The seat with this participant ref, or undefined for a null state or unknown ref. */
export function seatByRef<TSeat extends MarksSeatState>(
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
export function markRowsFor<TSeat extends MarksSeatState, TObjective>(
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

export function seatPointsText(
  state: { seats: readonly (MarksSeatState & { points: number })[] } | null,
  ref: string | undefined,
): string {
  return String(seatByRef(state, ref)?.points ?? 0);
}

export function closedCountText(
  state: SeatsState,
  ref: string | undefined,
): string {
  const seat = seatByRef(state, ref);
  return String(seat?.marks.filter((count) => count === 3).length ?? 0);
}

export function dartsThrownText(
  state: SeatsState,
  ref: string | undefined,
): string {
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
export function marksSubtitle(
  seatCount: number,
  objectiveCount: number,
): string {
  return joinSubtitle([
    seatCount > 1 ? "1V1" : "SOLO",
    `${objectiveCount} OBJECTIVES`,
  ]);
}

/** Results heading: `Closed out!` solo, `<name> wins!` for a duel winner, else `Game over`. */
export function marksResultsTitle(
  seats: Parameters<typeof matchWinnerName>[0],
  winningSideKey: string | null,
): string {
  if (seats.length < 2) return "Closed out!";
  const winner = matchWinnerName(seats, winningSideKey);
  return winner ? `${winner} wins!` : "Game over";
}
