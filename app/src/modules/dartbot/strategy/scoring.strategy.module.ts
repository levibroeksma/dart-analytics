import type { ThrowIntent } from "@modules/types";

/**
 * Score Training's whole target: always treble 20. There is no checkout, no
 * double, and no decision axis to route on (D-G, `08-DartBot.md` §Guiding
 * Principle) — a weak bot still aims here, it just can't back it up.
 */
export function chooseTarget(): ThrowIntent {
  return { targetNumber: 20, zoneKey: "TREBLE" };
}
