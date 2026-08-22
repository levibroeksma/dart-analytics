/**
 * The side that survived, or null while nobody has failed yet. Elimination
 * games (Bob's 27) end the instant one seat fails — the match never asks
 * this again after that, so a tie (every seat failed at once) is not a real
 * case for turn-based play and falls through to null rather than guessing.
 */
export function eliminationWinner(
  seats: readonly { sideKey: string; failed: boolean }[],
): string | null {
  const survivors = seats.filter((seat) => !seat.failed);
  if (survivors.length === seats.length) return null;
  return survivors.length === 1 ? survivors[0].sideKey : null;
}

/**
 * The side that reached the finish line, or null while nobody has. Race
 * games (121) end the instant one seat finishes, so at most one seat is ever
 * `finished` at a time in practice; this reads whichever is.
 */
export function raceWinner(
  seats: readonly { sideKey: string; finished: boolean }[],
): string | null {
  const finishers = seats.filter((seat) => seat.finished);
  return finishers.length === 1 ? finishers[0].sideKey : null;
}

/**
 * The side with the best metric, once every seat has completed its session —
 * null while any seat is still playing, and null on a tie (deferred
 * tiebreak). `direction` picks whether "best" is highest or lowest, since
 * Around the Clock's metric (darts to complete) inverts the usual
 * highest-wins rule the other score-compare games use.
 */
export function scoreCompareWinner(
  seats: readonly { sideKey: string; completed: boolean; metric: number }[],
  direction: "HIGHEST" | "LOWEST",
): string | null {
  if (seats.some((seat) => !seat.completed)) return null;

  const best =
    direction === "HIGHEST"
      ? Math.max(...seats.map((seat) => seat.metric))
      : Math.min(...seats.map((seat) => seat.metric));
  const winners = seats.filter((seat) => seat.metric === best);
  return winners.length === 1 ? winners[0].sideKey : null;
}
