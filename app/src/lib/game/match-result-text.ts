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
