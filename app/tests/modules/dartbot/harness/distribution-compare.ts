const BIN_WIDTH_MM = 10;
const BIN_COUNT = 12;

/**
 * Bins a sample of miss distances (mm) into a fixed-width histogram,
 * normalised to fractions. The last bin is an open-ended overflow bucket for
 * anything at or beyond `BIN_COUNT * BIN_WIDTH_MM`, so every sample lands
 * somewhere and the bins always sum to 1.
 */
export function distanceHistogram(samples: number[]): number[] {
  const bins = new Array(BIN_COUNT).fill(0) as number[];
  for (const distance of samples) {
    const index = Math.min(BIN_COUNT - 1, Math.floor(distance / BIN_WIDTH_MM));
    bins[index]!++;
  }
  return bins.map((count) => count / samples.length);
}

/**
 * Total variation distance between two histograms of equal bin count and
 * width: half the sum of absolute per-bin differences. Ranges 0 (identical
 * distributions) to 1 (disjoint support).
 */
export function totalVariationDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i]! - (b[i] ?? 0));
  }
  return sum / 2;
}
