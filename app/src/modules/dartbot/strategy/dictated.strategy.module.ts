import type { DictatedView } from "@modules/interfaces";
import type { ThrowIntent } from "@modules/types";

/**
 * The bull's board number, mirroring `BULL_TARGET_NUMBER` in
 * `@modules/game/board-progression.module` — kept as a local literal rather
 * than an import, since `modules/dartbot/*` may import `@modules/game/types`
 * but not `@modules/game/board-progression.module` (08-DartBot.md §Import
 * direction).
 */
const BULL_TARGET_NUMBER = 25;

/**
 * Converts the ruleset's own next `BoardTarget` into a `ThrowIntent`, for the
 * five rulesets that dictate their own target rather than letting the player
 * (or bot) choose one. A `NUMBER` target aims at the outer single — the
 * largest bed on that number, and the one a real player picks when told
 * "hit 14" with no zone specified. A `DOUBLE` target aims at that double
 * exactly, matching `isHitOn`'s strict double-only check. `BULL` aims at the
 * inner bull; `classify()` reports `targetNumber: 25` for a landing anywhere
 * in either bull ring, so a wide scatter still resolves to a real hit.
 */
export function chooseTarget(view: DictatedView): ThrowIntent {
  const { target } = view;
  if (target.kind === "BULL") {
    return { targetNumber: BULL_TARGET_NUMBER, zoneKey: "INNER_BULL" };
  }
  if (target.kind === "DOUBLE") {
    return { targetNumber: target.number, zoneKey: "DOUBLE" };
  }
  return { targetNumber: target.number, zoneKey: "OUTER_SINGLE" };
}
