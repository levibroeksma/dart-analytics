import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ratioTile } from "@lib/stats/sections/comparison-tile";
import type { CheckoutComparison, PeakMeasure, TrackTile } from "@lib/types";

const NO_GOES = "No goes yet";

function signed(points: number): string {
  if (points === 0) return "±0";
  return `${points > 0 ? "+" : ""}${points}`;
}

function peakDetail(peak: PeakMeasure): string {
  if (peak.previousGoes === null || peak.previous === null)
    return "No earlier period";
  if (
    peak.current === null ||
    peak.currentGoes < MIN_TARGET_SAMPLE ||
    peak.previousGoes < MIN_TARGET_SAMPLE
  )
    return "No comparison yet";
  return `${signed(peak.current - peak.previous)} vs previous period`;
}

function peakTile(peak: PeakMeasure): TrackTile {
  const title = "Highest target";
  if (peak.current === null) return { title, value: "—", detail: NO_GOES };
  return { title, value: String(peak.current), detail: peakDetail(peak) };
}

/** The four Checkout comparison tiles: finish rate, highest target, recovery rate and bust rate, each with its change once both periods reach `MIN_TARGET_SAMPLE`. */
export function checkoutComparisonTiles(c: CheckoutComparison): TrackTile[] {
  const noMisses = c.peak.currentGoes === 0 ? NO_GOES : "No misses yet";
  return [
    ratioTile("Finish rate", c.finish, NO_GOES),
    peakTile(c.peak),
    ratioTile("Recovery rate", c.recovery, noMisses),
    ratioTile("Bust rate", c.bust, NO_GOES),
  ];
}
