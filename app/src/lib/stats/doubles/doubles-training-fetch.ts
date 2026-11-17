import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import type {
  DoublesTrainingCard,
  DoublesTrainingInput,
  GameTypeKey,
  TrendRangeKey,
} from "@lib/types";
import type {
  LooseDartsMetrics,
  MissDirectionMetrics,
  TargetAccuracyMetrics,
} from "@modules/types";
import { doublesTrainingCard } from "./doubles-training-card";

const GAME: GameTypeKey = "DOUBLES_TRAINING";

/** The card shown while loading, with no darts, or after a failed read. */
export const EMPTY_CARD: DoublesTrainingCard = {
  favourite: null,
  darts: 0,
  rows: [],
};

/** Reads `target-accuracy`, `miss-direction` and `loose-darts` un-bucketed over `span` for a game; any failed read rejects. */
export async function loadTargetInputsOver(
  gameTypeKey: GameTypeKey,
  span: { from: string; to: string },
): Promise<DoublesTrainingInput> {
  const range = { ...span, bucket: "none" as const };
  const [accuracy, misses, loose] = await Promise.all([
    loadGameSection<TargetAccuracyMetrics>(
      gameTypeKey,
      "target-accuracy",
      range,
    ),
    loadGameSection<MissDirectionMetrics>(gameTypeKey, "miss-direction", range),
    loadGameSection<LooseDartsMetrics>(gameTypeKey, "loose-darts", range),
  ]);
  return {
    accuracy: accuracy.buckets,
    misses: misses.buckets,
    loose: loose.buckets,
  };
}

/** `loadTargetInputsOver` the page period (`heatmapWindow`). */
export function loadTargetInputs(
  gameTypeKey: GameTypeKey,
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<DoublesTrainingInput> {
  return loadTargetInputsOver(gameTypeKey, heatmapWindow(rangeKey, now));
}

/** Joins the Doubles Training sections over the page period; a failed read gives the empty card with the message. */
export async function loadDoublesTrainingCard(
  rangeKey: TrendRangeKey,
  now: Date,
): Promise<{ card: DoublesTrainingCard; error: string | null }> {
  try {
    const input = await loadTargetInputs(GAME, rangeKey, now);
    return { card: doublesTrainingCard(input), error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "load failed";
    return { card: EMPTY_CARD, error };
  }
}
