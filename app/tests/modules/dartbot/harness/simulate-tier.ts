import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/types";

const CALIBRATION_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };
const CHECKOUT_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "DOUBLE" };

/**
 * Offsets the checkout-attempt stream from the scoring-visit stream so the
 * two draw from independent dart sequences under the same top-level seed.
 * Arbitrary and large enough that no realistic `visits` count collides it
 * with the scoring stream's own dartIndex range.
 */
const CHECKOUT_SEED_OFFSET = 500000;

export type TierStats = {
  threeDartAverage: number;
  checkoutRate: number;
  t20RatePerVisit: number;
  oneHundredPlusRate: number;
  oneFortyPlusRate: number;
  oneEightyRate: number;
  trebleRate: number;
  missRate: number;
};

/**
 * Simulates `visits` three-dart visits at T20 treble plus `visits` single
 * checkout attempts at D20, both purely as a function of (seed, dartIndex)
 * per phase 1's determinism contract, and aggregates the emergent
 * statistics `08-DartBot.md` §Test Strategy names for tier calibration.
 */
export function simulateTierStats(
  level: number,
  seed: number,
  visits: number,
): TierStats {
  const profile = skillProfileForLevel(level);
  const visitTotals: number[] = [];
  let t20Hits = 0;
  let trebleHits = 0;
  let missHits = 0;
  let darts = 0;

  for (let visit = 0; visit < visits; visit++) {
    let visitTotal = 0;
    for (let dart = 0; dart < 3; dart++) {
      const rng = createDartRng(seed, visit * 3 + dart);
      const thrown = throwDart(CALIBRATION_TARGET, profile, rng);
      visitTotal += thrown.hit.score;
      darts++;
      if (thrown.hit.zoneKey === "TREBLE") trebleHits++;
      if (thrown.hit.zoneKey === "MISS") missHits++;
      if (thrown.hit.targetNumber === 20 && thrown.hit.zoneKey === "TREBLE") {
        t20Hits++;
      }
    }
    visitTotals.push(visitTotal);
  }

  let checkoutHits = 0;
  for (let attempt = 0; attempt < visits; attempt++) {
    const rng = createDartRng(seed + CHECKOUT_SEED_OFFSET, attempt);
    const thrown = throwDart(CHECKOUT_TARGET, profile, rng);
    if (thrown.hit.targetNumber === 20 && thrown.hit.zoneKey === "DOUBLE") {
      checkoutHits++;
    }
  }

  const threeDartAverage =
    visitTotals.reduce((sum, total) => sum + total, 0) / visits;

  return {
    threeDartAverage,
    checkoutRate: checkoutHits / visits,
    t20RatePerVisit: t20Hits / visits,
    oneHundredPlusRate:
      visitTotals.filter((total) => total >= 100).length / visits,
    oneFortyPlusRate:
      visitTotals.filter((total) => total >= 140).length / visits,
    oneEightyRate: visitTotals.filter((total) => total === 180).length / visits,
    trebleRate: trebleHits / darts,
    missRate: missHits / darts,
  };
}
