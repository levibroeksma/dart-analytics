import type { GameTypeKey } from "@lib/types";

/** The variation to send for `gameTypeKey`: `selected` for `501`, else `undefined` so other games never send the parameter. */
export function variationParam(
  gameTypeKey: GameTypeKey,
  selected: number,
): number | undefined {
  return gameTypeKey === "501" ? selected : undefined;
}
