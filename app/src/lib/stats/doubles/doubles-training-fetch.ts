import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import type {
  DoublesTrainingCard,
  RulesetVersionKey,
  TrendRangeKey,
} from "@lib/types";
import type {
  LooseDartsMetrics,
  MissDirectionMetrics,
  TargetAccuracyMetrics,
} from "@modules/types";
import { doublesTrainingCard } from "./doubles-training-card";

const GAME = "DOUBLES_TRAINING";

/** The card shown while loading, with no darts, or after a failed read. */
export const EMPTY_CARD: DoublesTrainingCard = {
  favourite: null,
  darts: 0,
  rows: [],
};

/** Reads `target-accuracy`, `miss-direction` and `loose-darts` un-bucketed over the page period and joins them; a failed read gives the empty card with the message. */
export async function loadDoublesTrainingCard(
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: DoublesTrainingCard; error: string | null }> {
  const range = { ...heatmapWindow(rangeKey, now), bucket: "none" as const };
  try {
    const [accuracy, misses, loose] = await Promise.all([
      loadGameSection<TargetAccuracyMetrics>(GAME, "target-accuracy", range),
      loadGameSection<MissDirectionMetrics>(GAME, "miss-direction", range),
      loadGameSection<LooseDartsMetrics>(GAME, "loose-darts", range),
    ]);
    const card = doublesTrainingCard({
      accuracy: accuracy.buckets,
      misses: misses.buckets,
      loose: loose.buckets,
    });
    return { card, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_CARD, error };
  }
}
