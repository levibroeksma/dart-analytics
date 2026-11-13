/** Good leaves, best first: by how many times each halves evenly, ties to the higher (x01 inferred-aim design §4.3). */
export const LEAVE_RANK: readonly number[] = [
  32, 16, 40, 24, 8, 36, 28, 20, 12, 4,
];

/** Whether `leave` is a good leave: a multiple of 4 from 4 to 40. */
export function isGoodLeave(leave: number): boolean {
  return LEAVE_RANK.includes(leave);
}

/** Position of `leave` in `LEAVE_RANK`, `0` best; `-1` for a leave that is not good. */
function rankOf(leave: number): number {
  return LEAVE_RANK.indexOf(leave);
}

/**
 * The score among `scores` whose leave from `remaining` is the best-ranked
 * good leave; `undefined` when none leaves one. Distinct scores leave distinct
 * leaves, so the best is unique.
 */
export function bestLeavingScore(
  scores: readonly number[],
  remaining: number,
): number | undefined {
  return scores
    .filter((score) => isGoodLeave(remaining - score))
    .sort((a, b) => rankOf(remaining - a) - rankOf(remaining - b))[0];
}
