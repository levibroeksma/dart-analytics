import { loadGameSection } from "@lib/stats/load-game-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
import { aimOptionsFromDrift } from "./aim-options";
import { sumAimRows } from "./aim-rows";
import type { HeatmapTargetOption, TrendRangeKey } from "@lib/types";
import type { AimCountMetrics } from "@modules/types";

/** The 501 heatmap's aim options for a period and variation, read from the un-bucketed `aim-drift` section. */
export async function fetchAimOptions(
  period: TrendRangeKey,
  variation: number,
  now: Date,
): Promise<HeatmapTargetOption[]> {
  const window = heatmapWindow(period, now);
  const series = await loadGameSection<AimCountMetrics>("501", "aim-drift", {
    from: window.from,
    to: window.to,
    bucket: "none",
    variation: variationParam("501", variation),
  });
  return aimOptionsFromDrift(sumAimRows(series.buckets));
}
