const SINGLES = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];
const TREBLES = Array.from({ length: 20 }, (_, i) => 3 * (i + 1));
const DOUBLES_AND_BULL = [
  ...Array.from({ length: 20 }, (_, i) => 2 * (i + 1)),
  50,
];
const ANY_DART_VALUE = Array.from(
  new Set([...SINGLES, ...TREBLES, ...DOUBLES_AND_BULL]),
);

const MAX_CHECKOUT_SCORE = 170;

/**
 * Minimum darts (1-3) to bring each score 0-170 to exactly zero on a double
 * or BULL, over every legal dart value. `null` marks a score no combination
 * of up to three legal darts can finish (every bogey number, 0, and 1).
 */
function buildMinimumCheckoutDarts(): readonly (number | null)[] {
  const minimum: (number | null)[] = new Array(MAX_CHECKOUT_SCORE + 1).fill(
    null,
  );

  for (const finish of DOUBLES_AND_BULL) {
    if (finish <= MAX_CHECKOUT_SCORE) minimum[finish] = 1;
  }
  for (const first of ANY_DART_VALUE) {
    for (const finish of DOUBLES_AND_BULL) {
      const score = first + finish;
      if (score <= MAX_CHECKOUT_SCORE && minimum[score] === null) {
        minimum[score] = 2;
      }
    }
  }
  for (const first of ANY_DART_VALUE) {
    for (const second of ANY_DART_VALUE) {
      for (const finish of DOUBLES_AND_BULL) {
        const score = first + second + finish;
        if (score <= MAX_CHECKOUT_SCORE && minimum[score] === null) {
          minimum[score] = 3;
        }
      }
    }
  }
  return minimum;
}

const MINIMUM_CHECKOUT_DARTS = buildMinimumCheckoutDarts();

/**
 * The fewest darts, over every legal dart value, that can bring
 * `remainingScore` to exactly zero on a double or BULL, or `null` when no
 * such route exists within three darts: every bogey number, 0, 1, a
 * non-integer, or anything above 170.
 */
export function minimumCheckoutDarts(remainingScore: number): number | null {
  if (!Number.isInteger(remainingScore)) return null;
  if (remainingScore < 0 || remainingScore > MAX_CHECKOUT_SCORE) return null;
  return MINIMUM_CHECKOUT_DARTS[remainingScore];
}

/**
 * Whether `remainingScore` can still be brought to exactly zero on a double
 * or BULL using no more than `dartsAvailable` darts.
 */
export function isCheckoutReachable(
  remainingScore: number,
  dartsAvailable: number,
): boolean {
  const minimum = minimumCheckoutDarts(remainingScore);
  return minimum !== null && minimum <= dartsAvailable;
}
