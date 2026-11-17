import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
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

/** The Doubles Training card as the page loads it, with the failure message when a section could not be read. */
export const EMPTY_CARD: DoublesTrainingCard = {
  favourite: null,
  darts: 0,
  rows: [],
};

/** Reads `target-accuracy`, `miss-direction` and `loose-darts` un-bucketed over the page period and joins them; an unknown game or a failed read gives the empty card, with the message on failure. */
export async function loadDoublesTrainingCard(
  data: { rangeKey: TrendRangeKey; game: string; variation: number },
  now: Date,
): Promise<{ card: DoublesTrainingCard; error: string | null }> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[data.game as RulesetVersionKey];
  if (gameTypeKey === undefined) return { card: EMPTY_CARD, error: null };
  const range = {
    ...heatmapWindow(data.rangeKey, now),
    bucket: "none" as const,
    variation: variationParam(gameTypeKey, data.variation),
  };
  try {
    const [accuracy, misses, loose] = await Promise.all([
      loadGameSection<TargetAccuracyMetrics>(
        gameTypeKey,
        "target-accuracy",
        range,
      ),
      loadGameSection<MissDirectionMetrics>(
        gameTypeKey,
        "miss-direction",
        range,
      ),
      loadGameSection<LooseDartsMetrics>(gameTypeKey, "loose-darts", range),
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
