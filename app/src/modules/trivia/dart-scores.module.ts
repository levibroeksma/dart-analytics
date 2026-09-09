const SINGLES = Array.from({ length: 20 }, (_, i) => i + 1);
const DOUBLES = SINGLES.map((n) => n * 2);
const TREBLES = SINGLES.map((n) => n * 3);
const BULLS = [25, 50];

// fallow-ignore-next-line unused-export -- exported for its own pool-composition test (mirrors 10-trivia.md's checkout-trivia-pool.test.ts precedent); no src consumer needs the raw pool, only getRandomDartScore
export const ONE_DART_SCORES: readonly number[] = Array.from(
  new Set<number>([...SINGLES, ...DOUBLES, ...TREBLES, ...BULLS]),
).sort((a, b) => a - b);

export function getRandomDartScore(maxScore: number): number {
  const candidates = ONE_DART_SCORES.filter((score) => score <= maxScore);
  if (candidates.length === 0) {
    throw new Error(`no reachable one-dart score for maxScore ${maxScore}`);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
