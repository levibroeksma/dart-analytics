import type { LadderProgressMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";
import type { LadderBand, LadderBandOptions, LadderTotal } from "./types";

/** `maxTarget` merges by `max`, with `null` as the identity. */
function combineMaxTarget(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** `ladder-progress` buckets folded into per-target totals, the highest target attempted, and after-a-miss counts. */
export function sumLadderTargets(
  buckets: readonly SeriesBucket<LadderProgressMetrics>[],
): {
  totals: Map<string, LadderTotal>;
  maxTarget: number | null;
  afterMiss: number;
  recovered: number;
} {
  const totals = new Map<string, LadderTotal>();
  let maxTarget: number | null = null;
  let afterMiss = 0;
  let recovered = 0;
  for (const b of buckets) {
    for (const [target, m] of Object.entries(b.metrics.targets)) {
      const existing = totals.get(target) ?? { attempts: 0, successes: 0 };
      existing.attempts += m.attempts;
      existing.successes += m.successes;
      totals.set(target, existing);
    }
    maxTarget = combineMaxTarget(maxTarget, b.metrics.maxTarget);
    afterMiss += b.metrics.afterMiss;
    recovered += b.metrics.recovered;
  }
  return { totals, maxTarget, afterMiss, recovered };
}

function bandStart(target: number, options: LadderBandOptions): number {
  if (target < options.origin) return 2;
  const steps = Math.floor((target - options.origin) / options.size);
  return options.origin + steps * options.size;
}

function bandEnd(start: number, options: LadderBandOptions): number {
  if (start < options.origin) return options.origin - 1;
  return Math.min(start + options.size - 1, options.cap);
}

/** Per-target totals grouped into bands, ascending, each with its own gated finish rate. */
export function ladderBands(
  totals: ReadonlyMap<string, LadderTotal>,
  options: LadderBandOptions,
): LadderBand[] {
  const bandTotals = new Map<number, LadderTotal>();
  for (const [targetKey, t] of totals.entries()) {
    const start = bandStart(Number(targetKey), options);
    const existing = bandTotals.get(start) ?? { attempts: 0, successes: 0 };
    existing.attempts += t.attempts;
    existing.successes += t.successes;
    bandTotals.set(start, existing);
  }
  return Array.from(bandTotals.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, t]) => ({
      start,
      end: bandEnd(start, options),
      attempts: t.attempts,
      successes: t.successes,
      rate: t.attempts >= options.minSample ? t.successes / t.attempts : null,
    }));
}
