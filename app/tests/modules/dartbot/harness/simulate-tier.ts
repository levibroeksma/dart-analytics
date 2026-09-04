import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { SkillProfile, ThrowIntent } from "@modules/types";

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

type ScoringTotals = {
  visitTotals: number[];
  t20Hits: number;
  trebleHits: number;
  missHits: number;
  darts: number;
};

/**
 * Throws `visits` three-dart visits at T20 treble, purely as a function of
 * (seed, dartIndex) per phase 1's determinism contract, and tallies the raw
 * counts `simulateTierStats` turns into rates.
 */
function simulateScoringVisits(
  profile: SkillProfile,
  seed: number,
  visits: number,
): ScoringTotals {
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

  return { visitTotals, t20Hits, trebleHits, missHits, darts };
}

/**
 * Throws `visits` single checkout attempts at D20, offset onto an
 * independent dart sequence from the scoring stream, and returns each
 * attempt's hit/miss outcome in order.
 */
function simulateCheckoutOutcomes(
  profile: SkillProfile,
  seed: number,
  visits: number,
): boolean[] {
  const outcomes: boolean[] = [];
  for (let attempt = 0; attempt < visits; attempt++) {
    const rng = createDartRng(seed + CHECKOUT_SEED_OFFSET, attempt);
    const thrown = throwDart(CHECKOUT_TARGET, profile, rng);
    outcomes.push(
      thrown.hit.targetNumber === 20 && thrown.hit.zoneKey === "DOUBLE",
    );
  }
  return outcomes;
}

function aggregateTierStats(
  scoring: ScoringTotals,
  checkoutOutcomes: boolean[],
  visits: number,
): TierStats {
  const threeDartAverage =
    scoring.visitTotals.reduce((sum, total) => sum + total, 0) / visits;
  const checkoutHits = checkoutOutcomes.filter(Boolean).length;

  return {
    threeDartAverage,
    checkoutRate: checkoutHits / visits,
    t20RatePerVisit: scoring.t20Hits / visits,
    oneHundredPlusRate:
      scoring.visitTotals.filter((total) => total >= 100).length / visits,
    oneFortyPlusRate:
      scoring.visitTotals.filter((total) => total >= 140).length / visits,
    oneEightyRate:
      scoring.visitTotals.filter((total) => total === 180).length / visits,
    trebleRate: scoring.trebleHits / scoring.darts,
    missRate: scoring.missHits / scoring.darts,
  };
}

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
  const scoring = simulateScoringVisits(profile, seed, visits);
  const checkoutOutcomes = simulateCheckoutOutcomes(profile, seed, visits);
  return aggregateTierStats(scoring, checkoutOutcomes, visits);
}

/**
 * `simulateTierStats` plus the raw per-visit totals and per-attempt
 * checkout outcomes, for callers that need a distribution rather than an
 * aggregate (`dartbot-level-select-stats.ts`, D-L level-select stats).
 */
export function simulateTierStatsDetailed(
  level: number,
  seed: number,
  visits: number,
): TierStats & { visitTotals: number[]; checkoutOutcomes: boolean[] } {
  const profile = skillProfileForLevel(level);
  const scoring = simulateScoringVisits(profile, seed, visits);
  const checkoutOutcomes = simulateCheckoutOutcomes(profile, seed, visits);
  return {
    ...aggregateTierStats(scoring, checkoutOutcomes, visits),
    visitTotals: scoring.visitTotals,
    checkoutOutcomes,
  };
}
