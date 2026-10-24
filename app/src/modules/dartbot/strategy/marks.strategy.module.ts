import type { MarksView } from "@modules/interfaces";
import type { ThrowIntent } from "@modules/types";

/** Marks that close an objective; mirrors `MARKS_TO_CLOSE` in `@modules/game/marks-close.module`, which `modules/dartbot/*` may not import. */
const MARKS_TO_CLOSE = 3;

/** The bull's board number; mirrors `BULL_TARGET_NUMBER` for the same reason. */
const BULL_TARGET_NUMBER = 25;

const FALLBACK_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

function intentFor(targetNumber: number): ThrowIntent {
  return targetNumber === BULL_TARGET_NUMBER
    ? { targetNumber, zoneKey: "INNER_BULL" }
    : { targetNumber, zoneKey: "TREBLE" };
}

/**
 * Picks the next dart's target: block an objective the opponent has closed
 * and the bot has not, else score on one the bot has closed and the opponent
 * has not (only while it does not lead on points; a lead needs no more
 * points, only the remaining closes), else close the first objective the bot has open. Each tier takes
 * the first match in the view's order. Re-derived from the view before every
 * dart, so a miss corrects itself with nothing held across a visit. The
 * fallback is reachable only when every objective is dead, which ends the
 * game before another dart.
 */
export function chooseTarget(view: MarksView): ThrowIntent {
  const { objectives } = view;
  const pick =
    objectives.find(
      (o) => o.opponent >= MARKS_TO_CLOSE && o.own < MARKS_TO_CLOSE,
    ) ??
    (view.ownPoints > view.opponentPoints
      ? undefined
      : objectives.find(
          (o) => o.own >= MARKS_TO_CLOSE && o.opponent < MARKS_TO_CLOSE,
        )) ??
    objectives.find((o) => o.own < MARKS_TO_CLOSE);
  return pick ? intentFor(pick.targetNumber) : FALLBACK_TARGET;
}
