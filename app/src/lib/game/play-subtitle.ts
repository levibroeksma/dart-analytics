import type { TargetOrderMode } from "./types";

/** Setup labels for a target-order mode, in setup order; play subtitles uppercase them. */
export const ORDER_MODE_LABELS: Readonly<Record<TargetOrderMode, string>> = {
  LOW_TO_HIGH: "Low → High",
  HIGH_TO_LOW: "High → Low",
  RANDOM: "Random",
};

/** A play-header subtitle: the non-empty parts joined with " · ". */
export function joinSubtitle(parts: readonly string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

/** A target-order mode's setup label in subtitle case (`LOW → HIGH`). */
export function orderModeLabel(mode: TargetOrderMode): string {
  return ORDER_MODE_LABELS[mode].toUpperCase();
}
