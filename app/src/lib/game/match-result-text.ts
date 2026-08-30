/**
 * The winning seat's own display name, or `undefined` when there is nothing
 * to name — a solo session (fewer than 2 seats) or no decided winner
 * (`winningSideKey` null, e.g. a TIE). Factors out the
 * `$store.game.seats.find((s) => s.sideKey === winningSideKey)?.displayName`
 * lookup every result modal's title ternary repeats.
 */
export function matchWinnerName(
  seats: readonly {
    participantRef: string;
    sideKey: string;
    displayName: string;
  }[],
  winningSideKey: string | null,
): string | undefined {
  if (!winningSideKey || seats.length < 2) return undefined;
  return seats.find((seat) => seat.sideKey === winningSideKey)?.displayName;
}

/**
 * Singles Training's results title, keyed off the owner's own per-seat
 * `status` rather than the match-level `winningSideKey` — under HARD/EXTREME
 * elimination a seat can read `LOST` while the other reads `WON` from the
 * same match, so the generic {@link matchWinnerName} compare only covers the
 * remaining COMPLETE/no-decided-winner case.
 */
export function singlesTrainingResultsTitle(
  seats: readonly {
    participantRef: string;
    sideKey: string;
    displayName: string;
    participantTypeKey: "PLAYER" | "GUEST";
  }[],
  resultsSnapshot:
    | {
        seats: readonly {
          participantRef: string;
          status: "COMPLETE" | "TIE" | "WON" | "LOST";
        }[];
        winningSideKey: string | null;
      }
    | null
    | undefined,
): string {
  const ownerRef = seats.find(
    (seat) => seat.participantTypeKey === "PLAYER",
  )?.participantRef;
  const ownerResult = resultsSnapshot?.seats.find(
    (seat) => seat.participantRef === ownerRef,
  );

  if (ownerResult?.status === "LOST") {
    return seats.length < 2
      ? "Game over — missed the target"
      : "Game over — you missed the target";
  }
  if (ownerResult?.status === "WON") {
    const loser = seats.find(
      (seat) => seat.sideKey !== resultsSnapshot?.winningSideKey,
    );
    return `${loser?.displayName} missed the target — you win!`;
  }
  if (ownerResult?.status === "TIE") return "Tie — same points!";

  const winner = matchWinnerName(
    seats,
    resultsSnapshot?.winningSideKey ?? null,
  );
  return winner ? `${winner} wins — highest points!` : "Session complete";
}
