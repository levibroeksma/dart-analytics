import { fileURLToPath } from "node:url";
import { simulateTierStatsDetailed } from "../tests/modules/dartbot/harness/simulate-tier";

const SEED_BASE = 800000;
const VISITS = 5000;
const CHECKOUT_BATCH_COUNT = 20;

export type LevelSelectBand = { low: number; high: number };

/** Linear-interpolation percentile (numpy-default style) over a sorted-ascending array. */
export function percentile(sortedAscending: number[], p: number): number {
  const idx = (sortedAscending.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAscending[lower]!;
  const weight = idx - lower;
  return (
    sortedAscending[lower]! * (1 - weight) + sortedAscending[upper]! * weight
  );
}

/** 25th/75th percentile of per-visit totals, rounded to the nearest point. */
export function averageBand(visitTotals: number[]): LevelSelectBand {
  const sorted = [...visitTotals].sort((a, b) => a - b);
  return {
    low: Math.round(percentile(sorted, 0.25)),
    high: Math.round(percentile(sorted, 0.75)),
  };
}

/**
 * 25th/75th percentile of per-batch checkout rate, rounded to the nearest
 * whole percentage point. A single pass/fail attempt stream has no spread
 * of its own — batching is what turns it into a distribution.
 */
export function checkoutBand(
  outcomes: boolean[],
  batchCount: number,
): LevelSelectBand {
  const batchSize = Math.floor(outcomes.length / batchCount);
  const rates: number[] = [];
  for (let i = 0; i < batchCount; i++) {
    const batch = outcomes.slice(i * batchSize, (i + 1) * batchSize);
    rates.push(batch.filter(Boolean).length / batchSize);
  }
  rates.sort((a, b) => a - b);
  return {
    low: Math.round(percentile(rates, 0.25) * 100),
    high: Math.round(percentile(rates, 0.75) * 100),
  };
}

function main(): void {
  const table: Record<
    number,
    {
      averageLow: number;
      averageHigh: number;
      checkoutLow: number;
      checkoutHigh: number;
    }
  > = {};

  for (let level = 1; level <= 15; level++) {
    const { visitTotals, checkoutOutcomes } = simulateTierStatsDetailed(
      level,
      SEED_BASE + level,
      VISITS,
    );
    const avg = averageBand(visitTotals);
    const checkout = checkoutBand(checkoutOutcomes, CHECKOUT_BATCH_COUNT);
    table[level] = {
      averageLow: avg.low,
      averageHigh: avg.high,
      checkoutLow: checkout.low,
      checkoutHigh: checkout.high,
    };
  }

  console.log(JSON.stringify(table, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
