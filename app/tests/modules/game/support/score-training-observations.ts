import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import type { ScoreTrainingInput } from "@modules/types";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import { located } from "./checkout-observations";

/** A keypad total: mostly in range, else negative, fractional or above `max`. */
function randomTotal(rand: () => number, max: number): number {
  const roll = rand();
  if (roll < 0.1) return -1 - Math.floor(rand() * 10);
  if (roll < 0.2) return Math.floor(rand() * max) + 0.5;
  if (roll < 0.3) return max + 1 + Math.floor(rand() * 20);
  return Math.floor(rand() * (max + 1));
}

/**
 * Mixes the two Score Training input shapes in one log: with probability
 * `visitRate` a keypad total (valid and invalid alike, so every refusal
 * fires), otherwise a located board dart — a miss stays unlocated.
 */
export function scoreTrainingInputs(
  visitRate: number,
  config: Seated<ScoreTrainingSnapshot>,
) {
  return (
    rand: () => number,
    _engine: OracleEngine<ScoreTrainingInput>,
  ): ScoreTrainingInput =>
    rand() < visitRate
      ? randomTotal(rand, config.maxVisitScore)
      : located(randomObservation(rand));
}
